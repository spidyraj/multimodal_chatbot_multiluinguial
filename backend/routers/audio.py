import os
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from sqlalchemy.orm import Session
from services.audio_service import AudioService
from db.session import get_db
from db.models import User, Conversation, Message
from auth.security import get_current_user
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


def get_or_create_conversation(db: Session, user: User, source: str = "audio") -> Conversation:
    conv = (
        db.query(Conversation)
        .filter(Conversation.user_id == user.id, Conversation.title == source)
        .order_by(Conversation.created_at.desc())
        .first()
    )
    if not conv:
        conv = Conversation(user_id=user.id, title=source)
        db.add(conv)
        db.commit()
        db.refresh(conv)
    return conv


def save_message(db: Session, conversation_id: int, role: str, content: str):
    msg = Message(conversation_id=conversation_id, role=role, content=content)
    db.add(msg)
    db.commit()


@router.post("/upload")
async def upload_audio(
    file: UploadFile = File(...),
    language: str = Form("English"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
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
async def audio_chat(
    request: AudioChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Chat with the uploaded audio using RAG."""
    try:
        result = audio_service.chat(
            session_id=request.session_id,
            question=request.question,
            chat_history=request.chat_history,
            language=request.language
        )
        # Persist Q&A to PostgreSQL
        conv = get_or_create_conversation(db, current_user, source="audio")
        save_message(db, conv.id, "user", request.question)
        save_message(db, conv.id, "bot", result["answer"])
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
