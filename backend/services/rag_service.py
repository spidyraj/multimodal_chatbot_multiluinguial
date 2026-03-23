import os
from typing import List, Dict, Any
from pinecone import Pinecone, ServerlessSpec
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import Pinecone as PineconeStore
from langchain_groq import ChatGroq
from langchain.chains import ConversationalRetrievalChain
from langchain_text_splitters import RecursiveCharacterTextSplitter
from PyPDF2 import PdfReader
import docx

class RAGService:
    def __init__(self, groq_api_key: str, pinecone_api_key: str, index_name: str = "queryvault"):
        self.pc = Pinecone(api_key=pinecone_api_key)
        self.index_name = index_name
        self.embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
        self.llm = ChatGroq(model_name="llama-3.3-70b-versatile", groq_api_key=groq_api_key)
        
        # Ensure index exists
        if self.index_name not in [idx.name for idx in self.pc.list_indexes()]:
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
        
        # In a real app, we would add metadata to restrict results by user_id
        # For simplicity, we create a specialized vectorstore per request or use namespaces
        vectorstore = PineconeStore.from_texts(
            chunks, 
            self.embeddings, 
            index_name=self.index_name,
            namespace=f"user_{user_id}"
        )
        return "Documents processed successfully"

    def get_response(self, question: str, chat_history: List[tuple], user_id: int):
        vectorstore = PineconeStore.from_existing_index(
            index_name=self.index_name,
            embedding=self.embeddings,
            namespace=f"user_{user_id}"
        )
        
        chain = ConversationalRetrievalChain.from_llm(
            llm=self.llm,
            retriever=vectorstore.as_retriever(),
            return_source_documents=True
        )
        
        response = chain({"question": question, "chat_history": chat_history})
        return response["answer"]
