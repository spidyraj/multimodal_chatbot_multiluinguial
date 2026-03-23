import os
import re
import json
import base64
import streamlit as st
from gtts import gTTS
from streamlit_mic_recorder import speech_to_text

from langchain_groq import ChatGroq
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_text_splitters import CharacterTextSplitter
from langchain.chains import ConversationalRetrievalChain
from langchain.memory import ConversationBufferMemory
from langchain_community.vectorstores import FAISS
from PyPDF2 import PdfReader
import docx
from youtube_transcript_api import YouTubeTranscriptApi

st.set_page_config(page_title="Query Vault 2.0", layout="wide")

st.markdown("""
<style>
    /* Pure Dark Mode Aesthetics */
    .stApp {
        background-color: #09090b !important;
        color: #f3f4f6;
    }
    #MainMenu {visibility: hidden;}
    footer {visibility: hidden;}
    
    [data-testid="stSidebar"] {
        background-color: #111116 !important;
        color: #f3f4f6;
        border-right: 1px solid #27272a;
    }
    
    /* Massive Gradient Header */
    .query-header {
        text-align: center;
        margin-top: 15px;
        margin-bottom: 40px;
    }
    .query-header h1 {
        font-size: 4.5rem !important;
        font-weight: 900;
        background: -webkit-linear-gradient(45deg, #a855f7, #3b82f6);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin: 0;
        padding: 0;
        line-height: 1.1;
    }
    .query-header p {
        color: #9ca3af;
        font-size: 1.2rem;
        margin-top: 5px;
        letter-spacing: 1px;
    }
    
    /* Distinct Chat Bubbles */
    .chat-container {
        display: flex;
        flex-direction: column;
        gap: 20px;
        margin-bottom: 30px;
        padding: 0 10px;
        padding: 0 10px;
    }
    .chat-bubble {
        padding: 16px 24px;
        border-radius: 20px;
        max-width: 75%;
        line-height: 1.6;
        font-size: 16px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        word-wrap: break-word;
        word-wrap: break-word;
        margin: 8px 0;
    }
    .chat-bubble.user {
        background-color: #2e1065; /* Distinct User Purple */
        align-self: flex-start; /* Left Aligned */
        border-bottom-left-radius: 4px;
        border-bottom-right-radius: 20px;
        color: #f3e8ff;
        margin-right: auto;
        margin-right: auto;
        margin-left: 0;
    }
    .chat-bubble.bot {
        background-color: #18181b; /* Total Black/Grey for AI */
        border: 1px solid #27272a;
        align-self: flex-end; /* Right Aligned */
        border-bottom-right-radius: 4px;
        border-bottom-left-radius: 20px;
        color: #e4e4e7;
        margin-left: auto;
        margin-left: auto;
        margin-right: 0;
    }
    .chat-bubble .role {
        font-size: 12px;
        font-weight: bold;
        margin-bottom: 8px;
        color: #a1a1aa;
        display: flex;
        align-items: center;
        gap: 6px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }
    
    /* Audio element inline styling */
    .audio-wrapper {
        margin-top: 15px;
        display: flex;
        justify-content: flex-end;
    }
    audio {
        height: 38px;
        border-radius: 8px;
        outline: none;
        opacity: 0.85;
    }
    
    /* Seamless Input Field Styling */
    .stTextInput > div > div > input {
        background-color: #18181b !important;
        color: white !important;
        border: 1px solid #3f3f46 !important;
        border-radius: 10px !important;
        padding: 15px 20px !important;
    }
    
    /* Center the Mic button inside its column */
    .st-key-STT_Mic button {
        background-color: transparent !important;
        border-radius: 50% !important;
        width: 45px !important;
        height: 45px !important;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px solid rgba(255,255,255,0.1);
        font-size: 20px;
        transition: 0.2s all;
        box-shadow: none !important;
    }
    .st-key-STT_Mic button:hover {
        background-color: rgba(255,255,255,0.1) !important;
    }
    
    /* Hide fullscreen button on images */
    button[title="View fullscreen"] {
        display: none !important;
    }
    
    /* Blend the header screenshot background naturally into the app */
    .query-header img {
        mix-blend-mode: screen; 
    }
    
    /* Remove gaps strictly for the text input and mic row */
    [data-testid="stHorizontalBlock"] {
        gap: 0px !important;
    }
    [data-testid="column"]:first-child {
        padding-right: 2px !important;
    }
    [data-testid="column"]:last-child {
        padding-left: 0px !important;
    }
</style>
""", unsafe_allow_html=True)

# Initialize Session States
if "conversation_history" not in st.session_state:
    st.session_state.conversation_history = []
if "chat_history" not in st.session_state:
    st.session_state.chat_history = []    
if "conversation" not in st.session_state:
    st.session_state.conversation = None
if "processComplete" not in st.session_state:
    st.session_state.processComplete = None    
if 'audio_files' not in st.session_state:
    st.session_state.audio_files = []
if 'temp_input' not in st.session_state:
    st.session_state.temp_input = ""
if 'text_field' not in st.session_state:
    st.session_state.text_field = ""

def submit_text():
    st.session_state.temp_input = st.session_state.text_field
    st.session_state.text_field = ""

def get_tts_language(language_setting, text=None):
    if language_setting == "Hindi":
        return "hi"
    return "en"

try:
    api_key = st.secrets["groq"]["api_key"]
except Exception as e:
    st.error("Secrets not configured correctly. Please configure .streamlit/secrets.toml")
    st.stop()


# --- SIDEBAR (Restored Document Upload & Language Settings) ---
with st.sidebar:
    st.markdown("### 🧭 Navigation")
    page = st.radio("Select Feature:", ["💬 RAG Chatbot", "📹 YouTube Summarizer"], index=0)
    
    st.markdown("---")
    st.markdown("### 🌐 Application Language")
    app_language = st.radio("Select Chat Language:", ["English", "Hindi"], horizontal=True)
    
    st.markdown("---")
    st.markdown("### 📁 Document Hub")
    if not st.session_state.processComplete:
        st.markdown("<p style='text-align:center; background:rgba(0,0,0,0.2); padding:10px; border-radius:10px;'>No documents loaded</p>", unsafe_allow_html=True)
    else:
        st.markdown("<p style='text-align:center; background:rgba(46, 204, 113, 0.2); padding:10px; border-radius:10px; color:#2ecc71;'>✅ Documents Loaded</p>", unsafe_allow_html=True)

    st.markdown("#### 📤 Upload PDFs")
    uploaded_files = st.file_uploader("", type=["pdf", "docx"], accept_multiple_files=True)
    
    upload_mode = st.radio("Upload mode:", ["Replace existing", "Add to existing"], horizontal=False)
    
    if st.button("🚀 Upload & Process", use_container_width=True):
        if uploaded_files:
            with st.spinner("Processing documents into Vault..."):
                text = ""
                for up_file in uploaded_files:
                    _, ext = os.path.splitext(up_file.name)
                    if ext == ".pdf":
                        try:
                            reader = PdfReader(up_file)
                            text += "".join([page.extract_text() for page in reader.pages if page.extract_text() is not None])
                        except Exception as e:
                            st.warning(f"Failed to read PDF: {e}")
                    elif ext == ".docx":
                        doc = docx.Document(up_file)
                        text += ' '.join([para.text for para in doc.paragraphs])
                
                splitter = CharacterTextSplitter(separator="\n", chunk_size=1000, chunk_overlap=150)
                text_chunks = splitter.split_text(text)
                embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
                vector_store = FAISS.from_texts(text_chunks, embeddings)
                
                model = ChatGroq(model_name="llama-3.3-70b-versatile", groq_api_key=api_key)
                st.session_state.conversation = ConversationalRetrievalChain.from_llm(
                    llm=model, retriever=vector_store.as_retriever()
                )
                if "Replace" in upload_mode:
                    st.session_state.conversation_history = []
                    st.session_state.chat_history = []
                    st.session_state.audio_files = []
                st.session_state.processComplete = True
                st.success("✅ Documents fully processed!")
        else:
            st.warning("Please upload files first.")

    st.markdown("---")
    st.markdown("### ⚙️ Export & Manage")
    st.markdown(f"**💬 {len(st.session_state.conversation_history)} messages**")
    
    formatted_txt = ""
    for i, msg in enumerate(st.session_state.conversation_history):
        role = "User" if msg["role"] == "user" else "Bot"
        formatted_txt += f"{role}: {msg['content']}\n\n"
    
    st.download_button("📄 Download (TXT)", data=formatted_txt, file_name="chat.txt", mime="text/plain", use_container_width=True)
    json_data = json.dumps(st.session_state.conversation_history, indent=4)
    st.download_button("📊 Download (JSON)", data=json_data, file_name="chat.json", mime="application/json", use_container_width=True)
    
    if st.button("🗑️ Reset Chat", use_container_width=True):
        st.session_state.conversation_history = []
        st.session_state.audio_files = []
        st.session_state.chat_history = []
        st.rerun()


if page == "💬 RAG Chatbot":
    # --- HEADER (Huge & Professional) ---
    st.markdown("<div class='query-header'>", unsafe_allow_html=True)
    try:
        head_col1, head_col2, head_col3 = st.columns([0.3, 0.4, 0.3])
        with head_col2:
            st.image("Screenshot 2026-03-23 173317.png", use_container_width=True)
    except:
        st.markdown("<h1 style='font-size: 3.5rem !important; color: white !important; font-weight: 600;'>What are you working on?</h1>", unsafe_allow_html=True)
    st.markdown("</div>", unsafe_allow_html=True)


    # --- PROMPTS ---
    system_prompt_map = {
        "English": "You are a professional AI Assistant. You MUST strictly reply entirely in English. Be highly helpful, concise, and friendly.",
        "Hindi": "आप एक पेशेवर एआई सहायक हैं। आपको हमेशा उपयोगकर्ता को हिंदी भाषा में ही उत्तर देना है।"
    }

    chat_template = ChatPromptTemplate.from_messages([
        ("system", system_prompt_map[app_language]),
        ("human", "{human_input}")
    ])
    fallback_model = ChatGroq(model_name="llama-3.3-70b-versatile", groq_api_key=api_key)
    fallback_chain = chat_template | fallback_model | StrOutputParser()


    # --- CHAT DISPLAY ---
    bot_audio_idx = 0
    st.markdown('<div class="chat-container">', unsafe_allow_html=True)
    for msg in st.session_state.conversation_history:
        if msg["role"] == "user":
            st.markdown(f"""
<div class="chat-bubble user">
    <div class="role">👤 You</div>
    <div class="message">{msg['content']}</div>
</div>
""", unsafe_allow_html=True)
        else:
            audio_html = ""
            if bot_audio_idx < len(st.session_state.audio_files):
                audio_file = st.session_state.audio_files[bot_audio_idx]
                if os.path.exists(audio_file):
                    with open(audio_file, "rb") as f:
                        audio_b64 = base64.b64encode(f.read()).decode()
                    audio_html = f"""
<div class="audio-wrapper">
    <audio controls src="data:audio/mp3;base64,{audio_b64}"></audio>
</div>
"""
                bot_audio_idx += 1
                
            st.markdown(f"""
<div class="chat-bubble bot">
    <div class="role">🤖 Assistant</div>
    <div class="message">{msg['content']}</div>
    {audio_html}
</div>
""", unsafe_allow_html=True)
    st.markdown('</div>', unsafe_allow_html=True)


    # --- UNIFIED INPUT FIELD ---
    st.markdown("---")

    col_txt, col_mic = st.columns([0.91, 0.09], vertical_alignment="bottom")
    with col_txt:
        st.text_input("Message", key="text_field", on_change=submit_text, placeholder="Ask anything", label_visibility="collapsed")
    with col_mic:
        # Enhanced Minimalistic Mic button
        voice_input = speech_to_text(
            language="hi-IN" if app_language == "Hindi" else "en-US", 
            start_prompt="🎙️", 
            stop_prompt="🔴", 
            use_container_width=True, 
            just_once=True, 
            key="STT_Mic"
        )

    final_input = None
    if st.session_state.temp_input:
        final_input = st.session_state.temp_input
        st.session_state.temp_input = "" # Consume it fully
    elif voice_input:
        final_input = voice_input

    if final_input:
        st.session_state.conversation_history.append({"role": "user", "content": final_input})
        
        with st.spinner("Processing..."):
            if st.session_state.processComplete and st.session_state.conversation:
                augmented_input = f"Please reply entirely in {app_language}. Query: " + final_input
                response = st.session_state.conversation({
                    'question': augmented_input,
                    'chat_history': st.session_state.chat_history
                })
                answer_text = response['answer']
                st.session_state.chat_history = response['chat_history']
            else:
                answer_text = fallback_chain.invoke({"human_input": final_input})
                
            st.session_state.conversation_history.append({"role": "bot", "content": answer_text})
            
            response_audio_file = f"response_audio_{len(st.session_state.audio_files) + 1}.mp3"
            tts_lang = get_tts_language(app_language, answer_text)
            tts = gTTS(text=answer_text, lang=tts_lang)
            tts.save(response_audio_file)
            st.session_state.audio_files.append(response_audio_file)
            
        st.rerun()


elif page == "📹 YouTube Summarizer":
    # --- YOUTUBE SUMMARIZER PAGE ---
    st.markdown("<div class='query-header'>", unsafe_allow_html=True)
    st.markdown("<h1>YouTube Summarizer</h1>", unsafe_allow_html=True)
    st.markdown("<p>Get detailed summaries of YouTube videos instantly</p>", unsafe_allow_html=True)
    st.markdown("</div>", unsafe_allow_html=True)
    
    # Initialize session states for YouTube summarizer
    if 'youtube_summary' not in st.session_state:
        st.session_state.youtube_summary = ""
    if 'youtube_url' not in st.session_state:
        st.session_state.youtube_url = ""
    if 'youtube_transcript' not in st.session_state:
        st.session_state.youtube_transcript = ""
    if 'youtube_chat_history' not in st.session_state:
        st.session_state.youtube_chat_history = []
    if 'youtube_conversation' not in st.session_state:
        st.session_state.youtube_conversation = None
    if 'clear_input' not in st.session_state:
        st.session_state.clear_input = False
    if 'youtube_audio_files' not in st.session_state:
        st.session_state.youtube_audio_files = []
    if 'youtube_temp_input' not in st.session_state:
        st.session_state.youtube_temp_input = ""
    if 'youtube_text_field' not in st.session_state:
        st.session_state.youtube_text_field = ""
    
    # YouTube URL input
    youtube_url = st.text_input(
        "Enter YouTube URL:", 
        value=st.session_state.youtube_url,
        placeholder="https://www.youtube.com/watch?v=...",
        help="Paste the full YouTube video URL"
    )
    
    def extract_video_id(url):
        """Extract video ID from YouTube URL"""
        patterns = [
            r'(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/embed/)([a-zA-Z0-9_-]{11})',
            r'youtube\.com/watch\?.*v=([a-zA-Z0-9_-]{11})'
        ]
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)
        return None
    
    def submit_youtube_text():
        """Handle YouTube chat text submission"""
        if 'youtube_text_field' in st.session_state and st.session_state.youtube_text_field:
            st.session_state.youtube_temp_input = st.session_state.youtube_text_field
            st.session_state.youtube_text_field = ""
            # Process the text input immediately
            send_youtube_message()
    
    def send_youtube_message():
        """Callback function to handle message sending"""
        # Check both text input and voice input
        final_input = ""
        if 'youtube_question_input' in st.session_state and st.session_state.youtube_question_input:
            final_input = st.session_state.youtube_question_input
        elif 'youtube_temp_input' in st.session_state and st.session_state.youtube_temp_input:
            final_input = st.session_state.youtube_temp_input
            st.session_state.youtube_temp_input = ""
        
        if final_input and st.session_state.youtube_conversation:
            # Add user message to chat history
            st.session_state.youtube_chat_history.append({"role": "user", "content": final_input})
            
            # Format chat history for ConversationalRetrievalChain
            formatted_history = []
            for msg in st.session_state.youtube_chat_history[:-1]:  # Exclude current user message
                if msg["role"] == "user":
                    formatted_history.append(("human", msg["content"]))
                else:
                    formatted_history.append(("assistant", msg["content"]))
            
            # Get AI response
            with st.spinner("Thinking..."):
                response = st.session_state.youtube_conversation({
                    'question': final_input,
                    'chat_history': formatted_history
                })
                answer = response['answer']
                
                # Extract source documents and timestamps
                source_info = ""
                if 'source_documents' in response and response['source_documents']:
                    timestamps = []
                    for doc in response['source_documents']:
                        if 'metadata' in doc and 'timestamp' in doc.metadata:
                            timestamps.append(doc.metadata['timestamp'])
                    
                    if timestamps:
                        unique_timestamps = list(set(timestamps))
                        source_info = f"\n\n📍 *Source timestamps: {', '.join(unique_timestamps)}*"
                
                # Add bot response to chat history with source info
                full_response = answer + source_info
                st.session_state.youtube_chat_history.append({"role": "bot", "content": full_response})
                
                # Generate TTS audio for bot response
                response_audio_file = f"youtube_response_audio_{len(st.session_state.youtube_audio_files) + 1}.mp3"
                tts_lang = get_tts_language(app_language, full_response)
                tts = gTTS(text=full_response, lang=tts_lang)
                tts.save(response_audio_file)
                st.session_state.youtube_audio_files.append(response_audio_file)
            
            # Clear the input by setting flag
            st.session_state.clear_input = True
    
    def get_youtube_summary(video_url):
        """Get transcript and generate summary"""
        video_id = extract_video_id(video_url)
        if not video_id:
            return "Error: Invalid YouTube URL. Please check the URL and try again."
        
        try:
            # Get transcript
            transcript_list = YouTubeTranscriptApi.get_transcript(video_id)
            
            # Combine transcript chunks
            transcript_text = ' '.join([chunk.text for chunk in transcript_list])
            
            # Store transcript for chat functionality
            st.session_state.youtube_transcript = transcript_text
            st.session_state.youtube_transcript_chunks = transcript_list
            
            # Create vector store for RAG-style chat
            from langchain_text_splitters import RecursiveCharacterTextSplitter
            from langchain_community.embeddings import HuggingFaceEmbeddings
            from langchain_community.vectorstores import FAISS
            from langchain.chains import ConversationalRetrievalChain
            from langchain.docstore.document import Document
            
            # Create documents with metadata including timestamps
            documents = []
            for i, chunk in enumerate(transcript_list):
                start_time = chunk.start
                minutes = int(start_time // 60)
                seconds = int(start_time % 60)
                timestamp = f"{minutes:02d}:{seconds:02d}"
                
                # Create document with metadata
                doc = Document(
                    page_content=f"[{timestamp}] {chunk.text}",
                    metadata={"timestamp": timestamp, "start_time": start_time, "duration": chunk.duration}
                )
                documents.append(doc)
            
            # Create vector store with timestamped documents
            embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
            vector_store = FAISS.from_documents(documents, embeddings)
            
            # Create conversation chain with custom prompt that includes timestamp requests
            model = ChatGroq(model_name="llama-3.3-70b-versatile", groq_api_key=api_key)
            
            # Custom prompt template that asks for timestamps
            from langchain_core.prompts import ChatPromptTemplate
            template = """You are a helpful AI assistant that answers questions about YouTube video transcripts. 
            When providing information from the transcript, ALWAYS include the timestamp [MM:SS] where the information was discussed.
            
            Use the following context from the video transcript to answer the question. The transcript includes timestamps in [MM:SS] format.
            
            Context: {context}
            
            Question: {question}
            
            Helpful Answer (include timestamps when possible):"""
            
            prompt = ChatPromptTemplate.from_template(template)
            
            st.session_state.youtube_conversation = ConversationalRetrievalChain.from_llm(
                llm=model,
                retriever=vector_store.as_retriever(),
                combine_docs_chain_kwargs={"prompt": prompt},
                return_source_documents=True
            )
            
            # Create summary prompt
            summary_prompt = ChatPromptTemplate.from_messages([
                ("system", "You are a professional content summarizer. Create a comprehensive, well-structured summary of the YouTube video transcript provided. Include key points, main topics, and important details. The summary should be detailed yet easy to read and understand."),
                ("human", "Please summarize this YouTube video transcript:\n\n{transcript}")
            ])
            
            # Generate summary
            summary_chain = summary_prompt | model | StrOutputParser()
            summary = summary_chain.invoke({"transcript": transcript_text})
            
            return summary
            
        except Exception as e:
            error_msg = str(e)
            if "Could not retrieve a transcript" in error_msg:
                return "Error: This video doesn't have available transcripts. This could be because:\n• The video has no closed captions\n• The video is private or restricted\n• The video has been removed\n\nPlease try a different YouTube video that has closed captions enabled."
            elif "InvalidVideoId" in error_msg:
                return "Error: Invalid YouTube video ID. Please check the URL and try again."
            elif "VideoUnavailable" in error_msg:
                return "Error: This video is not available or has been removed."
            else:
                return f"Error processing video: {str(e)}"
    
    # Generate summary button
    if st.button("🎬 Generate Summary", use_container_width=True, type="primary"):
        if youtube_url:
            with st.spinner("Fetching transcript and generating summary..."):
                st.session_state.youtube_summary = get_youtube_summary(youtube_url)
                st.session_state.youtube_url = youtube_url
                st.rerun()
        else:
            st.warning("Please enter a YouTube URL.")
    
    # Display summary
    if st.session_state.youtube_summary:
        st.markdown("---")
        st.markdown("### 📝 Video Summary")
        
        # Display in a styled card
        st.markdown("""
        <div style="background-color: #18181b; border: 1px solid #27272a; border-radius: 15px; padding: 25px; margin: 20px 0;">
            <div style="color: #e4e4e7; line-height: 1.8; font-size: 16px;">
                {}  
            </div>
        </div>
        """.format(st.session_state.youtube_summary.replace('\n', '<br>')), unsafe_allow_html=True)
        
        # Download summary button
        st.download_button(
            "📄 Download Summary",
            data=st.session_state.youtube_summary,
            file_name="youtube_summary.txt",
            mime="text/plain",
            use_container_width=True
        )
        
        # Transcript section with timestamps
        if 'youtube_transcript_chunks' in st.session_state and st.session_state.youtube_transcript_chunks:
            st.markdown("---")
            st.markdown("### 📝 Full Transcript with Timestamps")
            
            # Add expandable transcript
            with st.expander("📖 View Full Transcript", expanded=False):
                for i, chunk in enumerate(st.session_state.youtube_transcript_chunks):
                    start_time = chunk.start
                    duration = chunk.duration
                    text = chunk.text
                    
                    # Format timestamp
                    minutes = int(start_time // 60)
                    seconds = int(start_time % 60)
                    timestamp = f"{minutes:02d}:{seconds:02d}"
                    
                    st.markdown(f"""
                    <div style="margin-bottom: 12px; padding: 8px; background-color: #1a1a1a; border-radius: 8px; border-left: 3px solid #3b82f6;">
                        <span style="color: #3b82f6; font-weight: bold; font-size: 12px;">[{timestamp}]</span>
                        <span style="color: #e4e4e7; margin-left: 10px; font-size: 14px;">{text}</span>
                    </div>
                    """, unsafe_allow_html=True)
            
            # Download transcript button
            transcript_text = ""
            for chunk in st.session_state.youtube_transcript_chunks:
                minutes = int(chunk.start // 60)
                seconds = int(chunk.start % 60)
                timestamp = f"[{minutes:02d}:{seconds:02d}]"
                transcript_text += f"{timestamp} {chunk.text}\n"
                
            st.download_button(
                "📄 Download Transcript",
                data=transcript_text,
                file_name="youtube_transcript.txt",
                mime="text/plain",
                use_container_width=True
            )
        
        # Chat about the video section
        if st.session_state.youtube_conversation:
            st.markdown("---")
            st.markdown("### 💬 Chat About This Video")
            st.markdown("Ask questions about the video content and get answers based on the transcript.")
            
            # Display chat history
            chat_container = st.container()
            with chat_container:
                bot_audio_idx = 0
                for i, msg in enumerate(st.session_state.youtube_chat_history):
                    if msg["role"] == "user":
                        st.markdown(f"""
<div class="chat-bubble user">
    <div class="role">👤 You</div>
    <div class="message">{msg['content']}</div>
</div>
""", unsafe_allow_html=True)
                    else:
                        # Add audio playback for bot responses
                        audio_html = ""
                        if bot_audio_idx < len(st.session_state.youtube_audio_files):
                            audio_file = st.session_state.youtube_audio_files[bot_audio_idx]
                            if os.path.exists(audio_file):
                                with open(audio_file, "rb") as f:
                                    audio_b64 = base64.b64encode(f.read()).decode()
                                audio_html = f"""
<div class="audio-wrapper">
    <audio controls src="data:audio/mp3;base64,{audio_b64}"></audio>
</div>
"""
                            bot_audio_idx += 1
                        
                        st.markdown(f"""
<div class="chat-bubble bot">
    <div class="role">🤖 Video Assistant</div>
    <div class="message">{msg['content']}</div>
    {audio_html}
</div>
""", unsafe_allow_html=True)
        
    # Chat input
    st.markdown("---")
    col_txt, col_mic = st.columns([0.91, 0.09], vertical_alignment="bottom")
    
    # Determine input value based on clear flag
    input_value = "" if st.session_state.clear_input else ""
    if st.session_state.clear_input:
        st.session_state.clear_input = False
    
    with col_txt:
        st.text_input("Ask about video:", key="youtube_text_field", on_change=submit_youtube_text, placeholder="What were the main points discussed?...", label_visibility="collapsed")
    with col_mic:
        # Enhanced Minimalistic Mic button for YouTube chat
        youtube_voice_input = speech_to_text(
            language="hi-IN" if app_language == "Hindi" else "en-US", 
            start_prompt="🎙️", 
            stop_prompt="🔴", 
            use_container_width=True, 
            just_once=True, 
            key="youtube_STT_Mic_YT"
        )
        
    # Process final input from text or voice
    final_youtube_input = None
    if st.session_state.youtube_temp_input:
        final_youtube_input = st.session_state.youtube_temp_input
        st.session_state.youtube_temp_input = ""
    elif youtube_voice_input:
        final_youtube_input = youtube_voice_input
    
    if final_youtube_input:
        with st.spinner("Processing..."):
            send_youtube_message()
    
    # Also handle voice input immediately if detected
    if youtube_voice_input and not final_youtube_input:
        with st.spinner("Processing voice input..."):
            st.session_state.youtube_chat_history.append({"role": "user", "content": youtube_voice_input})
            
            # Format chat history for ConversationalRetrievalChain
            formatted_history = []
            for msg in st.session_state.youtube_chat_history[:-1]:
                if msg["role"] == "user":
                    formatted_history.append(("human", msg["content"]))
                else:
                    formatted_history.append(("assistant", msg["content"]))
            
            # Get AI response
            with st.spinner("Thinking..."):
                response = st.session_state.youtube_conversation({
                    'question': youtube_voice_input,
                    'chat_history': formatted_history
                })
                answer = response['answer']
                
                # Extract source documents and timestamps
                source_info = ""
                if 'source_documents' in response and response['source_documents']:
                    timestamps = []
                    for doc in response['source_documents']:
                        if 'metadata' in doc and 'timestamp' in doc.metadata:
                            timestamps.append(doc.metadata['timestamp'])
                        
                    if timestamps:
                        unique_timestamps = list(set(timestamps))
                        source_info = f"\n\n📍 *Source timestamps: {', '.join(unique_timestamps)}*"
                
                # Add bot response to chat history with source info
                full_response = answer + source_info
                st.session_state.youtube_chat_history.append({"role": "bot", "content": full_response})
                
                # Generate TTS audio for bot response
                response_audio_file = f"youtube_response_audio_{len(st.session_state.youtube_audio_files) + 1}.mp3"
                tts_lang = get_tts_language(app_language, full_response)
                tts = gTTS(text=full_response, lang=tts_lang)
                tts.save(response_audio_file)
                st.session_state.youtube_audio_files.append(response_audio_file)
            
            st.rerun()
            
    # Clear chat button
