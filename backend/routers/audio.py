import os
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from services.audio_service import AudioService
from pydantic import BaseModel
from typing import List

router = APIRouter()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
audio_service = AudioService(api_key=GROQ_API_KEY)


class AudioChatRequest(BaseModel):
    session_id: str
    question: str
    chat_history: List[List[str]] = []
    language: str = "English"


@router.post("/upload")
async def upload_audio(
    file: UploadFile = File(...),
    language: str = Form("English")
):
    """Upload an audio file, transcribe it, and return summary + session_id for chat."""
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in [".mp3", ".wav", ".m4a", ".ogg", ".webm"]:
        raise HTTPException(status_code=400, detail="Unsupported file type. Please upload an MP3, WAV, M4A, OGG, or WEBM file.")
    try:
        file_bytes = await file.read()
        result = audio_service.process_audio(file_bytes, file.filename, language)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/chat")
async def audio_chat(request: AudioChatRequest):
    """Chat with the uploaded audio using RAG."""
    try:
        result = audio_service.chat(
            session_id=request.session_id,
            question=request.question,
            chat_history=request.chat_history,
            language=request.language
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
