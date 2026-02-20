from __future__ import annotations

import os
import sys
import tempfile
import subprocess
import glob
import shutil
from typing import Optional
from urllib.parse import urlparse

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import whisper

# -----------------------------
# FFmpeg PATH fix (Windows)
# -----------------------------
# Put your FFmpeg bin here (the folder that contains ffmpeg.exe)
FFMPEG_DIR = os.getenv(
    "FFMPEG_DIR",
    r"C:\Users\isrib\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.0.1-full_build\bin",
)

if os.path.isdir(FFMPEG_DIR):
    os.environ["PATH"] = FFMPEG_DIR + os.pathsep + os.environ.get("PATH", "")

print("[whisper_service] ffmpeg:", shutil.which("ffmpeg"))
print("[whisper_service] ffprobe:", shutil.which("ffprobe"))

# -----------------------------
# Whisper model
# -----------------------------
MODEL_NAME = os.getenv("WHISPER_MODEL", "medium")
print(f"[whisper_service] Loading model: {MODEL_NAME} ...")
model = whisper.load_model(MODEL_NAME)
print("[whisper_service] Model loaded.")

def transcribe_file(path: str) -> str:
    # fp16=False improves CPU stability on Windows CPU
    result = model.transcribe(path, fp16=False)
    return (result.get("text") or "").strip()

# -----------------------------
# FastAPI app
# -----------------------------
app = FastAPI(title="Whisper Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {
        "ok": True,
        "model": MODEL_NAME,
        "ffmpeg": shutil.which("ffmpeg"),
        "ffprobe": shutil.which("ffprobe"),
    }

# -----------------------------
# Upload endpoint
# -----------------------------
@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    if not file:
        raise HTTPException(status_code=400, detail="Missing file field 'file'")

    suffix = os.path.splitext(file.filename or "")[1].lower() or ".mp4"

    tmp_path: Optional[str] = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp_path = tmp.name
            size = 0

            while True:
                chunk = await file.read(1024 * 1024)  # 1MB
                if not chunk:
                    break
                tmp.write(chunk)
                size += len(chunk)

        print(f"[whisper_service] Saved upload: {file.filename} -> {tmp_path} ({size} bytes)")

        text = transcribe_file(tmp_path)
        print(f"[whisper_service] Transcribed length: {len(text)} chars")
        return {"text": text}

    except FileNotFoundError as e:
        # Usually ffmpeg missing
        raise HTTPException(
            status_code=500,
            detail=(
                f"{e}\n\n"
                f"ffmpeg={shutil.which('ffmpeg')}\n"
                f"ffprobe={shutil.which('ffprobe')}\n"
                "Fix: ensure FFMPEG_DIR points to the folder containing ffmpeg.exe, "
                "or add it to PATH."
            ),
        )
    except Exception as e:
        print("[whisper_service] ERROR:", repr(e))
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        try:
            await file.close()
        except Exception:
            pass

        if tmp_path:
            try:
                os.remove(tmp_path)
            except Exception:
                pass

# -----------------------------
# URL endpoint
# -----------------------------
class UrlReq(BaseModel):
    url: str

def _is_allowed_domain(url: str) -> bool:
    try:
        host = (urlparse(url).hostname or "").lower()
    except Exception:
        return False

    allowed = {
        "tiktok.com", "www.tiktok.com", "m.tiktok.com",
        "instagram.com", "www.instagram.com",
    }
    return host in allowed or host.endswith(".tiktok.com") or host.endswith(".instagram.com")

def _download_with_ytdlp(url: str, out_dir: str) -> str:
    """
    Best-effort download for public posts.
    Instagram often needs cookies or will rate-limit.
    Returns path to downloaded media file.
    """
    outtmpl = os.path.join(out_dir, "video.%(ext)s")

    cookie_args: list[str] = []
    host = (urlparse(url).hostname or "").lower()

    # Only attempt browser cookies for Instagram
    if "instagram.com" in host:
        # Try edge first (often works better than chrome on Windows)
        # Change to "chrome" if you are logged in via Chrome and NOT Edge
        cookie_args = ["--cookies-from-browser", "edge"]

    cmd = [
        sys.executable, "-m", "yt_dlp",
        *cookie_args,
        "--no-playlist",
        "--no-warnings",
        "--restrict-filenames",
        "-f", "bv*+ba/best",
        "--merge-output-format", "mp4",
        "-o", outtmpl,
        url,
    ]

    print("[whisper_service] yt-dlp cmd:", " ".join(cmd))

    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
    except FileNotFoundError:
        raise HTTPException(
            status_code=500,
            detail="yt-dlp is not installed in this Python environment. Run: python -m pip install -U yt-dlp",
        )
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=408, detail="Download timed out (180s). Try again or use file upload.")

    if p.returncode != 0:
        tail = (p.stderr or p.stdout or "")[-2000:]

        # Special-case the locked Chrome cookie DB problem
        if "Could not copy" in tail and "cookie database" in tail.lower():
            raise HTTPException(
                status_code=400,
                detail=(
                    "Could not read browser cookies (cookie DB is locked). "
                    "Close the browser completely (all chrome.exe/edge.exe), then retry. "
                    "Or use a cookies.txt file with --cookies.\n\n" + tail
                ),
            )

        raise HTTPException(
            status_code=400,
            detail=(
                "Could not download this URL (rate-limit/login required/block). "
                "Try again later, or use cookies, or upload the video file.\n\n" + tail
            ),
        )

    candidates = sorted(
        glob.glob(os.path.join(out_dir, "video.*")),
        key=os.path.getmtime,
        reverse=True,
    )
    if not candidates:
        raise HTTPException(status_code=500, detail="Download succeeded but no output file found.")

    return candidates[0]

@app.post("/transcribe-url")
def transcribe_url(req: UrlReq):
    url = (req.url or "").strip()
    if not url:
        raise HTTPException(status_code=400, detail="url required")

    if not _is_allowed_domain(url):
        raise HTTPException(status_code=400, detail="Only Instagram/TikTok URLs are allowed for this endpoint.")

    tmp_dir = tempfile.mkdtemp(prefix="url-dl-")
    try:
        media_path = _download_with_ytdlp(url, tmp_dir)
        print(f"[whisper_service] Downloaded media -> {media_path}")

        text = transcribe_file(media_path)
        print(f"[whisper_service] Transcribed length: {len(text)} chars")
        return {"text": text}
    finally:
        try:
            for f in glob.glob(os.path.join(tmp_dir, "*")):
                try:
                    os.remove(f)
                except Exception:
                    pass
            os.rmdir(tmp_dir)
        except Exception:
            pass