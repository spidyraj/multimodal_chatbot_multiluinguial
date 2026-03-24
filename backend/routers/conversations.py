from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from db.session import get_db
from db.models import User, Conversation, Message
from auth.security import get_current_user
from typing import List
from pydantic import BaseModel
from datetime import datetime

router = APIRouter()


class MessageOut(BaseModel):
    id: int
    role: str
    content: str
    created_at: datetime
    source: str  # "document" or "audio"

    class Config:
        from_attributes = True


@router.get("/history")
def get_chat_history(
    limit: int = 50,
    source: str = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Return the last `limit` messages for the current user.
    Optionally filter by source: ?source=document or ?source=audio
    """
    query = (
        db.query(Message, Conversation.title.label("source"))
        .join(Conversation, Message.conversation_id == Conversation.id)
        .filter(Conversation.user_id == current_user.id)
    )
    if source:
        query = query.filter(Conversation.title == source)

    rows = query.order_by(Message.created_at.asc()).limit(limit).all()

    return [
        {
            "id": msg.id,
            "role": msg.role,
            "content": msg.content,
            "created_at": msg.created_at,
            "source": src
        }
        for msg, src in rows
    ]


@router.delete("/history")
def clear_chat_history(
    source: str = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Clear chat history for the current user. Optionally filter by source."""
    try:
        convs_query = db.query(Conversation).filter(Conversation.user_id == current_user.id)
        if source:
            convs_query = convs_query.filter(Conversation.title == source)
        convs = convs_query.all()
        for conv in convs:
            db.query(Message).filter(Message.conversation_id == conv.id).delete()
            db.delete(conv)
        db.commit()
        return {"message": "Chat history cleared"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
