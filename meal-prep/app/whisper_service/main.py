from __future__ import annotations

import os
import tempfile
from typing import Optional

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware

import whisper

# Start small to confirm the pipeline works.
# You can switch to "medium" once it's working.
MODEL_NAME = os.getenv("WHISPER_MODEL", "base")
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
