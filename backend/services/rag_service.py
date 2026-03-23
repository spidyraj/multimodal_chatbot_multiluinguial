import os
from typing import List, Dict, Any
from pinecone import Pinecone, ServerlessSpec
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_pinecone import PineconeVectorStore
from langchain_groq import ChatGroq
from langchain.chains import ConversationalRetrievalChain
from langchain_text_splitters import RecursiveCharacterTextSplitter
import docx
from gtts import gTTS
import uuid
from PyPDF2 import PdfReader

class RAGService:
    def __init__(self, groq_api_key: str, pinecone_api_key: str, index_name: str = "queryvault"):
        self.pc = Pinecone(api_key=pinecone_api_key)
        self.index_name = index_name
        self.embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
        self.llm = ChatGroq(model_name="llama-3.3-70b-versatile", groq_api_key=groq_api_key)
        
        # Ensure index exists
        active_indexes = [idx.name for idx in self.pc.list_indexes()]
        if self.index_name not in active_indexes:
            self.pc.create_index(
                name=self.index_name,
                dimension=384, # all-MiniLM-L6-v2 dimension
                metric="cosine",
                spec=ServerlessSpec(cloud="aws", region="us-east-1")
            )
        
        self.index = self.pc.Index(self.index_name)

    def process_files(self, files: List[Any], user_id: int) -> str:
        text = ""
        for file in files:
            file_extension = os.path.splitext(file.filename)[1].lower()
            if file_extension == ".pdf":
                pdf_reader = PdfReader(file.file)
                for page in pdf_reader.pages:
                    text += page.extract_text()
            elif file_extension == ".docx":
                doc = docx.Document(file.file)
                for para in doc.paragraphs:
                    text += para.text + "\n"
            else:
                text += file.file.read().decode("utf-8")

        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
        chunks = text_splitter.split_text(text)
        
        # Modern PineconeVectorStore usage
        vectorstore = PineconeVectorStore.from_texts(
            chunks, 
            self.embeddings, 
            index_name=self.index_name,
            namespace=f"user_{user_id}"
        )
        return "Documents processed successfully"

    def get_response(self, question: str, chat_history: List[tuple], user_id: int, language: str = "English"):
        # Set system prompt
        system_prompt = f"You are a professional AI Assistant. Reply in {language}."
        if language == "Hindi":
            system_prompt = "आप एक पेशेवर एआई सहायक हैं। कृपया हिंदी में उत्तर दें।"

        answer_text = ""
        try:
            # Check if namespace has documents (simple check or just try RAG)
            vectorstore = PineconeVectorStore.from_existing_index(
                index_name=self.index_name,
                embedding=self.embeddings,
                namespace=f"user_{user_id}"
            )
            
            # Simple retrieval check
            docs = vectorstore.similarity_search(question, k=1)
            
            if docs:
                chain = ConversationalRetrievalChain.from_llm(
                    llm=self.llm,
                    retriever=vectorstore.as_retriever(),
                    return_source_documents=True
                )
                response = chain.invoke({"question": question, "chat_history": chat_history})
                answer_text = response.get("answer", "")
            
            # Fallback if RAG is empty or returns a "don't know" answer
            if not answer_text or "does not mention" in answer_text.lower() or "don't know" in answer_text.lower() or "no information" in answer_text.lower():
                gen_prompt = ChatPromptTemplate.from_messages([
                    ("system", system_prompt),
                    ("human", "{question}")
                ])
                gen_chain = gen_prompt | self.llm | StrOutputParser()
                answer_text = gen_chain.invoke({"question": question})

        except Exception as e:
            print(f"RAG Error (falling back to general): {e}")
            gen_prompt = ChatPromptTemplate.from_messages([
                ("system", system_prompt),
                ("human", "{question}")
            ])
            gen_chain = gen_prompt | self.llm | StrOutputParser()
            answer_text = gen_chain.invoke({"question": question})

        if not answer_text:
            answer_text = "I'm sorry, I couldn't generate a response."

        # Generate TTS Audio
        audio_filename = f"{uuid.uuid4()}.mp3"
        audio_path = os.path.join("static", "audio", audio_filename)
        os.makedirs(os.path.dirname(audio_path), exist_ok=True)
        
        tts_lang = "hi" if language == "Hindi" else "en"
        tts = gTTS(text=answer_text, lang=tts_lang)
        tts.save(audio_path)
        
        return {
            "answer": answer_text,
            "audio_url": f"/static/audio/{audio_filename}"
        }
