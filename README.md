# Query Vault 2.0 - High Performance AI Suite

A professional, decoupled RAG-based AI application featuring document interaction, YouTube video summarization, and secure JWT authentication.

## 🚀 Architecture
- **Frontend:** Next.js 14, Tailwind CSS, Lucide Icons, Framer Motion.
- **Backend:** FastAPI (Python), SQLAlchemy, JWT (OAuth2).
- **Storage:** PostgreSQL (User data/History), Pinecone (Clound Vector DB).

## 🛠️ Local Setup

### 1. Backend
```bash
cd backend
pip install -r requirements.txt
python init_db.py  # Initialize Postgres tables
uvicorn main:app --reload
```

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
```

## 🌐 Cloud Deployment (Railway)
1. Push this repository to GitHub.
2. Connect your repository to Railway.
3. Set up two separate services for `frontend` and `backend` using their respective root directories.
4. Add your Environment Variables as specified in the walkthrough.
5. Deploy!

---
*Query Vault 2.0 - Unleashing Intelligent Document Communication.*

