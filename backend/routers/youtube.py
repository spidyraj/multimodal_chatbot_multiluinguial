from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List
from services.youtube_service import YouTubeService
import os

router = APIRouter()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
youtube_service = YouTubeService(api_key=GROQ_API_KEY)

@router.post("/summarize")
async def summarize_video(url: str, language: str = "English"):
    result = youtube_service.get_summary(url, language)
    return {"summary": result}

@router.post("/chat")
async def youtube_chat(url: str, question: str, chat_history: List[List[str]] = [], language: str = "English"):
    # Convert list of lists to list of tuples
    history = [tuple(msg) for msg in chat_history]
    result = youtube_service.chat(url, question, history, language)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result
