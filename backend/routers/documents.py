from fastapi import APIRouter, Depends, UploadFile, File, List, HTTPException
from sqlalchemy.orm import Session
from db.session import get_db
from services.rag_service import RAGService
import os

router = APIRouter()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")

rag_service = RAGService(groq_api_key=GROQ_API_KEY, pinecone_api_key=PINECONE_API_KEY)

@router.post("/upload")
async def upload_documents(files: List[UploadFile] = File(...), user_id: int = 1):
    # In a real app, user_id would be extracted from the JWT token
    try:
        result = rag_service.process_files(files, user_id)
        return {"message": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/chat")
async def chat(question: str, chat_history: List[List[str]] = [], user_id: int = 1):
    # Convert chat_history list of lists to list of tuples for LangChain
    history = [tuple(msg) for msg in chat_history]
    try:
        response = rag_service.get_response(question, history, user_id)
        return {"response": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
