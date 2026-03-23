import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Query Vault 2.0 API", version="1.0.0")

# CORS Configuration
origins = [
    "http://localhost:3000", # Next.js default porta
    "https://your-frontend-domain.render.com", # Placeholder
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For development, we allow all. Adjust for production.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from routers.auth import router as auth_router
from routers.documents import router as doc_router
from routers.youtube import router as yt_router

app.include_router(auth_router, prefix="/auth", tags=["Authentication"])
app.include_router(doc_router, prefix="/docs", tags=["Documents & RAG"])
app.include_router(yt_router, prefix="/youtube", tags=["YouTube Summarizer"])

@app.get("/")
async def root():
    return {"message": "Welcome to Query Vault 2.0 API", "status": "running"}
