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

class YouTubeService:
    def __init__(self, api_key: str):
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

    def get_summary(self, video_url: str, language: str = "English") -> str:
        video_id = self.extract_video_id(video_url)
        if not video_id:
            return "Invalid YouTube URL"

        try:
            # More robust transcript fetching (tries all available languages)
            try:
                transcript_list = YouTubeTranscriptApi.get_transcript(video_id, languages=['en', 'hi'])
            except:
                # Fallback to listing all and picking the first available
                try:
                    transcript_list = YouTubeTranscriptApi.get_transcript(video_id)
                except Exception as inner_e:
                    # If everything fails, try to list them explicitly
                    # Using the list_transcripts function which might be what's needed
                    from youtube_transcript_api import YouTubeTranscriptApi as YT
                    transcript_list = YT.get_transcript(video_id)
            
            # Combine transcript chunks
            transcript_text = ' '.join([chunk['text'] for chunk in transcript_list])
            self.transcript_cache[video_id] = transcript_list # Store original list for RAG
            
            summary_prompt = ChatPromptTemplate.from_messages([
                ("system", f"You are a professional content summarizer. Create a comprehensive, well-structured summary in {language}. Include key points, main topics, and important details."),
                ("human", "Please summarize this transcript:\n\n{transcript}")
            ])
            
            summary_chain = summary_prompt | self.llm | StrOutputParser()
            return summary_chain.invoke({"transcript": transcript_text})
        except Exception as e:
            return f"Error fetching transcript: {str(e)}. (Note: Some videos have transcripts disabled by the owner)."

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
                try:
                    transcript_list = YouTubeTranscriptApi.get_transcript(video_id)
                except:
                    transcripts = YouTubeTranscriptApi.list_transcripts(video_id)
                    transcript_obj = transcripts.find_transcript(['en', 'hi', 'en-US', 'hi-IN'])
                    transcript_list = transcript_obj.fetch()
                self.transcript_cache[video_id] = transcript_list
            else:
                transcript_list = self.transcript_cache[video_id]

            # Create documents with timestamps
            documents = []
            for chunk in transcript_list:
                start_time = chunk['start']
                minutes = int(start_time // 60)
                seconds = int(start_time % 60)
                timestamp = f"{minutes:02d}:{seconds:02d}"
                doc = Document(
                    page_content=f"[{timestamp}] {chunk['text']}",
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
            return {"answer": f"Error in YouTube chat: {str(e)}", "audio_url": None}
