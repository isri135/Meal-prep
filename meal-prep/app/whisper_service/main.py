from __future__ import annotations

import os
import sys
import tempfile
import subprocess
import glob
from typing import Optional
from urllib.parse import urlparse

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import whisper

# Start small to confirm the pipeline works.
# You can switch to "medium" once it's working.
MODEL_NAME = os.getenv("WHISPER_MODEL", "medium")
print(f"[whisper_service] Loading model: {MODEL_NAME} ...")
model = whisper.load_model(MODEL_NAME)
print("[whisper_service] Model loaded.")

def transcribe_file(path: str) -> str:
    # fp16=False improves CPU stability on Windows
    result = model.transcribe(path, fp16=False)
    return (result.get("text") or "").strip()

app = FastAPI(title="Whisper Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"ok": True, "model": MODEL_NAME}

# -----------------------------
# Existing upload endpoint (unchanged)
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

    except Exception as e:
        print("[whisper_service] ERROR:", repr(e))
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        try:
            await file.close()
        except:
            pass
        if tmp_path:
            try:
                os.remove(tmp_path)
            except:
                pass

# -----------------------------
# NEW: URL → download → transcribe
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
    Best-effort download for PUBLIC posts only.
    Returns path to downloaded media file.
    """
    outtmpl = os.path.join(out_dir, "video.%(ext)s")

    cmd = [
        sys.executable, "-m", "yt_dlp",
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
            detail="yt-dlp is not installed. Run: py -m pip install yt-dlp"
        )
    except subprocess.TimeoutExpired:
        raise HTTPException(
            status_code=408,
            detail="Download timed out (180s). Try again or use file upload."
        )

    if p.returncode != 0:
        tail = (p.stderr or p.stdout or "")[-1400:]
        raise HTTPException(
            status_code=400,
            detail=(
                "Could not download this URL (likely blocked / not public / requires login). "
                "Use the upload flow as a fallback.\n\n" + tail
            )
        )

    candidates = sorted(
        glob.glob(os.path.join(out_dir, "video.*")),
        key=os.path.getmtime,
        reverse=True
    )
    if not candidates:
        raise HTTPException(status_code=500, detail="Download succeeded but no output file found.")

    return candidates[0]

# ✅ FIX: use hyphen route to match Next.js proxy (/api/transcribe-url -> PY /transcribe-url)
@app.post("/transcribe-url")
def transcribe_url(req: UrlReq):
    url = (req.url or "").strip()
    if not url:
        raise HTTPException(status_code=400, detail="url required")

    # Basic SSRF safety: only allow IG/TikTok domains
    if not _is_allowed_domain(url):
        raise HTTPException(
            status_code=400,
            detail="Only Instagram/TikTok URLs are allowed for this endpoint."
        )

    tmp_dir = tempfile.mkdtemp(prefix="url-dl-")
    try:
        media_path = _download_with_ytdlp(url, tmp_dir)
        print(f"[whisper_service] Downloaded media -> {media_path}")

        text = transcribe_file(media_path)
        print(f"[whisper_service] Transcribed length: {len(text)} chars")
        return {"text": text}

    finally:
        # Cleanup downloaded files
        try:
            for f in glob.glob(os.path.join(tmp_dir, "*")):
                try:
                    os.remove(f)
                except:
                    pass
            os.rmdir(tmp_dir)
        except:
            pass