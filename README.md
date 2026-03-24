# 🔐 Query Vault 2.0 - High Performance AI Suite

A professional, multi-modal RAG-based SaaS application designed for intelligent document interaction, audio processing, and video summarization.

**Live Demo:** [https://frontend-production-9855.up.railway.app](https://frontend-production-9855.up.railway.app)

---

## 🚀 Overview
Query Vault 2.0 is a state-of-the-art AI platform that allows users to securely upload, store, and query their private data using large language models. Built with a focus on speed, security, and a premium "Neon" aesthetic, it bridges the gap between raw data and actionable intelligence.

---

## ✨ Core Features

### 📄 Document RAG (Retrieval-Augmented Generation)
- **Multi-format Support:** Upload PDF, DOCX, and TXT files.
- **Intelligent Chunking:** Uses recursive character splitting to maintain context within chunks.
- **Vector Search:** Powered by Pinecone with per-user namespacing for strict data isolation.
- **Contextual Chat:** Ask complex questions and get answers grounded in your specific documents.

### 🎙️ Audio Chat & Transcription
- **Whisper Integration:** High-accuracy transcription using Groq's `whisper-large-v3`.
- **Automated Summarization:** Instantly generates a concise summary of long audio recordings.
- **Timestamped RAG:** Searchable index built from timestamped segments, allowing the AI to cite specific moments (e.g., *"[02:15] The speaker mentions..."*).
- **Export Capabilities:** Download the summary and full timestamped transcript as JSON or DOC formats.

### 📺 YouTube Summarizer
- Extracts core insights from YouTube videos simply by providing a URL.
- Eliminates the need to watch long videos to get the main points.

### 🔐 Secure Multi-User System
- **JWT Authentication:** Robust login/registration system with encrypted passwords and token-based sessions.
- **Data Isolation:** Every user's documents and chat history are physically partitioned in both the database and the vector store.

---

## 🛠️ Tech Stack

### Frontend
- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS (Custom "Neon" Theme)
- **Icons:** Lucide React
- **Animations:** Custom CSS Keyframes & Shimmer Effects
- **State Management:** React Hooks (useState/useEffect/useRef)

### Backend
- **API:** FastAPI (Python 3.10+)
- **Database:** PostgreSQL (SQLAlchemy ORM)
- **Vector Database:** Pinecone (Serverless)
- **LLM & Audio:** Groq API (LLaMA 3.3-70B & Whisper Large v3)
- **RAG Engine:** LangChain-inspired custom implementation

---

## ⚙️ Internal Working

### 1. The RAG Pipeline
1. **Extraction:** Backend reads file content using `PyPDF2` or `python-docx`.
2. **Chunking:** Text is split into overlapping chunks for consistency.
3. **Embedding:** Chunks are sent to an embedding model (handled via Pinecone/Groq integration).
4. **Upsert:** Embeddings are stored in Pinecone under the user's unique `namespace`.
5. **Retrieval:** On query, similar chunks are retrieved and fed to LLaMA-3.3 with a specialized system prompt.

### 2. Audio Processing Flow
1. **Transcription:** Audio is sent to Groq Whisper in `verbose_json` mode.
2. **Segmentation:** Transcription is broken into `[MM:SS]` segments.
3. **Double Storage:** Summary is saved for instant display; segments are indexed for RAG.
4. **Chatting:** When you ask about audio, the system retrieves only the most relevant time-segments.

---

## 🌉 API Reference (Internal)

- `POST /auth/register`: Create a new account.
- `POST /auth/token`: Login and receive JWT.
- `GET /documents`: List uploaded files.
- `POST /documents/upload`: Upload and index new documents.
- `POST /audio/upload`: Process audio for transcription and summary.
- `POST /chat/query`: Standard RAG query for documents.
- `POST /audio/query`: Specialized RAG query for audio content.

---

## 🚄 Local Development

1. **Clone & Setup Backend:**
   ```bash
   cd backend
   pip install -r requirements.txt
   # Setup .env with GROQ_API_KEY, PINECONE_API_KEY, DATABASE_URL
   python init_db.py
   uvicorn main:app --reload
   ```

2. **Frontend Setup:**
   ```bash
   cd frontend
   npm install
   # Setup .env.local with NEXT_PUBLIC_API_URL
   npm run dev
   ```

---
*Query Vault 2.0 - Unleashing Intelligent Document Communication.*
