from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Form
from typing import List
from models.request_models import ChatRequest
from sqlalchemy.orm import Session
from db.session import get_db
from db.models import User, Conversation, Message
from services.rag_service import RAGService
from auth.security import get_current_user
import os

router = APIRouter()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME", "queryvault")

rag_service = RAGService(
    groq_api_key=GROQ_API_KEY,
    pinecone_api_key=PINECONE_API_KEY,
    index_name=PINECONE_INDEX_NAME
)


def get_or_create_conversation(db: Session, user: User, source: str = "document") -> Conversation:
    """Get the user's latest active conversation or create a new one."""
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
async def upload_documents(
    files: List[UploadFile] = File(...),
    mode: str = Form("replace"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        result = rag_service.process_files(files, current_user.id, mode=mode)
        return {"message": result, "mode": mode}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/chat")
async def chat(
    request: ChatRequest,
    language: str = "English",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    history = [tuple(msg) for msg in request.chat_history]
    try:
        response = rag_service.get_response(request.question, history, current_user.id, language)
        # Persist to PostgreSQL
        conv = get_or_create_conversation(db, current_user, source="document")
        save_message(db, conv.id, "user", request.question)
        save_message(db, conv.id, "bot", response["answer"])
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
