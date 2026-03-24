import os
from db.models import Base
from db.session import engine
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Query Vault 2.0 API", version="1.0.0")

@app.on_event("startup")
def startup_event():
    # Automatically create database tables on startup
    print("Initializng database tables...")
    Base.metadata.create_all(bind=engine)
    print("Database tables initialized!")

# Create static directory if it doesn't exist
os.makedirs("static/audio", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

# CORS Configuration
frontend_url = os.getenv("FRONTEND_URL", "").strip().replace("'", "").replace('"', "")
if frontend_url.endswith("/"):
    frontend_url = frontend_url[:-1]

origins = [
    "http://localhost:3000",
    "http://localhost:8000",
]
if frontend_url:
    origins.append(frontend_url)
else:
    origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False, # We use JWT in headers, no cookies needed
    allow_methods=["*"],
    allow_headers=["*"],
)

from routers.auth import router as auth_router
from routers.documents import router as doc_router
from routers.audio import router as audio_router
from routers.conversations import router as conv_router

app.include_router(auth_router, prefix="/auth", tags=["Authentication"])
app.include_router(doc_router, prefix="/docs", tags=["Documents & RAG"])
app.include_router(audio_router, prefix="/audio", tags=["Audio Agent"])
app.include_router(conv_router, prefix="/conversations", tags=["Chat History"])

@app.get("/")
async def root():
    return {"message": "Welcome to Query Vault 2.0 API", "status": "running"}
