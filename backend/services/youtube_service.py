import os
import re
from youtube_transcript_api import YouTubeTranscriptApi
from langchain_groq import ChatGroq
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain.chains import ConversationalRetrievalChain
from langchain_community.vectorstores import FAISS
from langchain.docstore.document import Document
from gtts import gTTS
import uuid
from langchain_community.embeddings import HuggingFaceEmbeddings
import yt_dlp
import requests

class CustomChunk:
    def __init__(self, text, start, duration):
        self.text = text
        self.start = start
        self.duration = duration

class YouTubeService:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.llm = ChatGroq(model_name="llama-3.3-70b-versatile", groq_api_key=api_key)
        self.embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
        self.transcript_cache = {} # Cache for storing transcripts for RAG

    def extract_video_id(self, url: str) -> str:
        patterns = [
            r'(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/embed/)([a-zA-Z0-9_-]{11})',
            r'youtube\.com/watch\?.*v=([a-zA-Z0-9_-]{11})'
        ]
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)
        return None

    def _fetch_transcript(self, video_id: str) -> list:
        from youtube_transcript_api import YouTubeTranscriptApi
        youtube_api = YouTubeTranscriptApi()
        try:
            # Try native API first
            return youtube_api.fetch(video_id, ['en', 'hi', 'en-US', 'hi-IN'])
        except Exception as e:
            # If native API fails (IP Block, Disabled Captions, None generated), use Whisper audio fallback
            try:
                print(f"Native fetch failed (likely IP Block or No Captions). Falling back to Whisper AI for video {video_id}...")
                return self._fallback_whisper_transcription(video_id)
            except Exception as whisper_e:
                raise Exception(f"Native captions unavailable AND Whisper AI generation failed: {str(whisper_e)}. Original API Error: {str(e)}")

    def _fallback_whisper_transcription(self, video_id: str) -> list:
        url = f"https://www.youtube.com/watch?v={video_id}"
        audio_path = os.path.join("static", "audio", f"{video_id}_temp.m4a")
        os.makedirs(os.path.dirname(audio_path), exist_ok=True)
        
        ydl_opts = {
            'format': 'm4a/bestaudio/best',
            'outtmpl': audio_path,
            'quiet': True,
            'postprocessors': [{'key': 'FFmpegExtractAudio', 'preferredcodec': 'm4a'}],
        }
        
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([url])
                
            with open(audio_path, "rb") as audio_file:
                headers = {"Authorization": f"Bearer {self.api_key}"}
                data = {
                    "model": "whisper-large-v3", # Groq's insanely fast Whisper
                    "response_format": "verbose_json"
                }
                files = {"file": (f"{video_id}.m4a", audio_file, "audio/m4a")}
                
                response = requests.post(
                    "https://api.groq.com/openai/v1/audio/transcriptions",
                    headers=headers,
                    data=data,
                    files=files
                )
                
            if response.status_code != 200:
                raise Exception(f"Groq API error: {response.text}")
                
            result = response.json()
            chunks = []
            for seg in result.get('segments', []):
                chunks.append(CustomChunk(
                    text=seg['text'],
                    start=seg.get('start', 0.0),
                    duration=seg.get('end', 0.0) - seg.get('start', 0.0)
                ))
            return chunks
        finally:
            if os.path.exists(audio_path):
                try:
                    os.remove(audio_path)
                except:
                    pass

    def get_summary(self, video_url: str, language: str = "English") -> str:
        video_id = self.extract_video_id(video_url)
        if not video_id:
            return "Invalid YouTube URL"

        try:
            # Fetch with unified robust method
            transcript_list = self._fetch_transcript(video_id)
            
            # Combine transcript chunks
            transcript_text = ' '.join([chunk.text for chunk in transcript_list])
            self.transcript_cache[video_id] = transcript_list # Store original list for RAG
            
            summary_prompt = ChatPromptTemplate.from_messages([
                ("system", f"You are a professional content summarizer. Create a comprehensive, well-structured summary in {language}. Include key points, main topics, and important details."),
                ("human", "Please summarize this transcript:\n\n{transcript}")
            ])
            
            summary_chain = summary_prompt | self.llm | StrOutputParser()
            return summary_chain.invoke({"transcript": transcript_text})
        except Exception as e:
            error_msg = str(e)
            if "InvalidVideoId" in error_msg:
                return "Error: Invalid YouTube video ID. Please check the URL and try again."
            elif "VideoUnavailable" in error_msg:
                return "Error: This video is not available or has been removed."
            else:
                return f"Error Summarizing Video: {error_msg}"

    def chat(self, video_url: str, question: str, chat_history: list, language: str = "English"):
        video_id = self.extract_video_id(video_url)
        if not video_id:
            return {"answer": "Invalid YouTube URL", "audio_url": None}

        # Set system prompt
        system_prompt = f"You are a professional AI Assistant. Reply in {language}."
        if language == "Hindi":
            system_prompt = "आप एक पेशेवर एआई सहायक हैं। कृपया हिंदी में उत्तर दें।"

        try:
            # Fetch transcript if not cached
            if video_id not in self.transcript_cache:
                transcript_list = self._fetch_transcript(video_id)
                self.transcript_cache[video_id] = transcript_list
            else:
                transcript_list = self.transcript_cache[video_id]

            # Create documents with timestamps
            documents = []
            for chunk in transcript_list:
                start_time = chunk.start
                minutes = int(start_time // 60)
                seconds = int(start_time % 60)
                timestamp = f"{minutes:02d}:{seconds:02d}"
                doc = Document(
                    page_content=f"[{timestamp}] {chunk.text}",
                    metadata={"timestamp": timestamp}
                )
                documents.append(doc)

            vector_store = FAISS.from_documents(documents, self.embeddings)
            
            template = f"""{system_prompt}
            Answer questions about the video transcript. ALWAYS include timestamps [MM:SS] if possible.
            Context: {{context}}
            Question: {{question}}
            """
            prompt = ChatPromptTemplate.from_template(template)
            
            chain = ConversationalRetrievalChain.from_llm(
                llm=self.llm,
                retriever=vector_store.as_retriever(),
                combine_docs_chain_kwargs={"prompt": prompt}
            )
            
            response = chain.invoke({"question": question, "chat_history": chat_history})
            answer_text = response['answer']

            # Generate TTS Audio
            audio_filename = f"yt_{uuid.uuid4()}.mp3"
            audio_path = os.path.join("static", "audio", audio_filename)
            os.makedirs(os.path.dirname(audio_path), exist_ok=True)
            
            tts_lang = "hi" if language == "Hindi" else "en"
            tts = gTTS(text=answer_text, lang=tts_lang)
            tts.save(audio_path)
            
            return {
                "answer": answer_text,
                "audio_url": f"/static/audio/{audio_filename}"
            }

        except Exception as e:
            error_msg = str(e)
            if "InvalidVideoId" in error_msg:
                user_msg = "Error: Invalid YouTube video ID."
            elif "VideoUnavailable" in error_msg:
                user_msg = "Error: This video is not available or has been removed."
            else:
                user_msg = f"Error processing video chat: {error_msg}"
            return {"answer": user_msg, "audio_url": None}
