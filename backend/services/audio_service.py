import os
import uuid
import requests
from langchain_groq import ChatGroq
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain.chains import ConversationalRetrievalChain
from langchain_community.vectorstores import FAISS
from langchain.docstore.document import Document
from langchain_community.embeddings import HuggingFaceEmbeddings
from gtts import gTTS


class AudioService:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.llm = ChatGroq(model_name="llama-3.3-70b-versatile", groq_api_key=api_key)
        self.embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
        # In-memory session store: session_id -> transcript text + vector store
        self.sessions: dict = {}

    def _transcribe_audio(self, file_bytes: bytes, filename: str) -> dict:
        """Send audio bytes to Groq Whisper API; returns transcript text + timestamped segments."""
        headers = {"Authorization": f"Bearer {self.api_key}"}
        ext = os.path.splitext(filename)[1].lower().lstrip(".")
        mime = f"audio/{ext}" if ext in ["mp3", "wav", "m4a", "ogg", "webm"] else "audio/mpeg"
        data = {"model": "whisper-large-v3", "response_format": "verbose_json"}
        files = {"file": (filename, file_bytes, mime)}
        response = requests.post(
            "https://api.groq.com/openai/v1/audio/transcriptions",
            headers=headers,
            data=data,
            files=files
        )
        if response.status_code != 200:
            raise Exception(f"Groq Whisper API error: {response.text}")
        result = response.json()
        segments = [
            {
                "start": round(s.get("start", 0), 1),
                "end": round(s.get("end", 0), 1),
                "text": s.get("text", "").strip()
            }
            for s in result.get("segments", [])
        ]
        return {"text": result.get("text", "").strip(), "segments": segments}

    def _build_vector_store(self, transcript: str, segments: list = None) -> FAISS:
        """Build FAISS from segments (with timestamps) or fallback to word-chunked transcript."""
        documents = []

        if segments:
            # Group adjacent segments into batches of 5 for richer context
            batch_size = 5
            for i in range(0, len(segments), batch_size):
                batch = segments[i:i + batch_size]
                start = batch[0]['start']
                mins = int(start // 60)
                secs = int(start % 60)
                timestamp = f"[{mins:02d}:{secs:02d}]"
                text = " ".join(s['text'] for s in batch)
                documents.append(Document(page_content=f"{timestamp} {text}"))
        else:
            # Fallback: chunk full transcript by words
            chunk_size = 600
            overlap = 60
            words = transcript.split()
            i = 0
            while i < len(words):
                documents.append(Document(page_content=" ".join(words[i:i + chunk_size])))
                i += chunk_size - overlap

        return FAISS.from_documents(documents, self.embeddings)

    def process_audio(self, file_bytes: bytes, filename: str, language: str = "English") -> dict:
        """
        Full pipeline: transcribe → summarize → build vector store → return session.
        Returns: {session_id, transcript, summary, segments}
        """
        transcription = self._transcribe_audio(file_bytes, filename)
        transcript = transcription["text"]
        segments = transcription["segments"]

        summary_prompt = ChatPromptTemplate.from_messages([
            ("system", f"You are a professional content summarizer. Create a comprehensive, well-structured summary in {language}. Include key points, main topics, and important details."),
            ("human", "Please summarize this audio transcript:\n\n{transcript}")
        ])
        summary_chain = summary_prompt | self.llm | StrOutputParser()
        summary = summary_chain.invoke({"transcript": transcript})

        vector_store = self._build_vector_store(transcript, segments)
        session_id = str(uuid.uuid4())
        self.sessions[session_id] = {
            "transcript": transcript,
            "vector_store": vector_store,
            "filename": filename
        }

        return {"session_id": session_id, "transcript": transcript, "summary": summary, "segments": segments}

    def chat(self, session_id: str, question: str, chat_history: list, language: str = "English") -> dict:
        """Chat with the audio content using RAG."""
        if session_id not in self.sessions:
            return {"answer": "Session expired. Please re-upload the audio file.", "audio_url": None}

        system_prompt = f"You are a professional AI Assistant. Reply in {language} and always reference timestamps if mentioned."
        if language == "Hindi":
            system_prompt = "आप एक पेशेवर एआई सहायक हैं। कृपया हिंदी में उत्तर दें।"

        vector_store = self.sessions[session_id]["vector_store"]
        template = f"""{system_prompt}
Answer questions based on the audio transcript context below.
Context: {{context}}
Question: {{question}}
"""
        prompt = ChatPromptTemplate.from_template(template)
        chain = ConversationalRetrievalChain.from_llm(
            llm=self.llm,
            retriever=vector_store.as_retriever(search_kwargs={"k": 6}),
            combine_docs_chain_kwargs={"prompt": prompt}
        )
        history = [tuple(msg) for msg in chat_history]
        response = chain.invoke({"question": question, "chat_history": history})
        answer_text = response["answer"]

        # TTS
        audio_filename = f"audio_{uuid.uuid4()}.mp3"
        audio_path = os.path.join("static", "audio", audio_filename)
        os.makedirs(os.path.dirname(audio_path), exist_ok=True)
        tts_lang = "hi" if language == "Hindi" else "en"
        gTTS(text=answer_text, lang=tts_lang).save(audio_path)

        return {"answer": answer_text, "audio_url": f"/static/audio/{audio_filename}"}
