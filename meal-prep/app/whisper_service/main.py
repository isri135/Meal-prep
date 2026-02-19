from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import tempfile, os

# ---- use your own transcribe function here ----
# Example: from your_script import transcribe_file
import whisper
model = whisper.load_model("medium")

def transcribe_file(path: str) -> str:
    result = model.transcribe(path)
    return result.get("text", "")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    suffix = os.path.splitext(file.filename)[1].lower()
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name
    try:
        text = transcribe_file(tmp_path)
        return {"text": text}
    finally:
        try: os.remove(tmp_path)
        except: pass

