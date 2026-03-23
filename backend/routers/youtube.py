from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List
from services.youtube_service import YouTubeService
from models.request_models import YouTubeChatRequest, YouTubeSummaryRequest
import os

router = APIRouter()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
youtube_service = YouTubeService(api_key=GROQ_API_KEY)

@router.post("/summarize")
async def summarize_video(request: YouTubeSummaryRequest):
    result = youtube_service.get_summary(request.url, request.language)
    return {"summary": result}

@router.post("/chat")
async def youtube_chat(request: YouTubeChatRequest):
    # Convert list of lists to list of tuples
    history = [tuple(msg) for msg in request.chat_history]
    result = youtube_service.chat(request.url, request.question, history, request.language)
    return result
