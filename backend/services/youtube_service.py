import os
import re
from youtube_transcript_api import YouTubeTranscriptApi
from langchain_groq import ChatGroq
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate

class YouTubeService:
    def __init__(self, api_key: str):
        self.llm = ChatGroq(model_name="llama-3.3-70b-versatile", groq_api_key=api_key)

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

    def get_summary(self, video_url: str, language: str = "English") -> dict:
        video_id = self.extract_video_id(video_url)
        if not video_id:
            return {"error": "Invalid YouTube URL"}

        try:
            transcript_list = YouTubeTranscriptApi.get_transcript(video_id)
            transcript_text = ' '.join([chunk['text'] for chunk in transcript_list])
            
            prompt = ChatPromptTemplate.from_messages([
                ("system", f"You are a professional content summarizer. Create a comprehensive, well-structured summary in {language}. Include key points, main topics, and important details."),
                ("human", "Please summarize this transcript:\n\n{transcript}")
            ])
            
            chain = prompt | self.llm | StrOutputParser()
            summary = chain.invoke({"transcript": transcript_text})
            
            return {
                "summary": summary,
                "transcript": transcript_text,
                "video_id": video_id
            }
        except Exception as e:
            return {"error": str(e)}
