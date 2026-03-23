from fastapi import APIRouter, HTTPException
from services.youtube_service import YouTubeService
import os

router = APIRouter()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
youtube_service = YouTubeService(api_key=GROQ_API_KEY)

@router.post("/summarize")
async def summarize_video(url: str, language: str = "English"):
    result = youtube_service.get_summary(url, language)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result
