from pydantic import BaseModel
from typing import List, Optional

class ChatRequest(BaseModel):
    question: str
    chat_history: Optional[List[List[str]]] = []

class YouTubeChatRequest(BaseModel):
    url: str
    question: str
    chat_history: Optional[List[List[str]]] = []
    language: Optional[str] = "English"

class YouTubeSummaryRequest(BaseModel):
    url: str
    language: Optional[str] = "English"
