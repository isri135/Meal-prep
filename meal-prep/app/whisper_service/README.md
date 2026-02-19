## Whisper Service

### Install (Windows)
From the project root:

```powershell
cd app\whisper_service
py -m pip install -r requirements.txt
py -m uvicorn main:app --reload --port 8000
