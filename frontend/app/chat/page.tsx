"use client";
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquare, FileUp, Mic, Send, LogOut, Loader2, Globe, Languages, Square, CheckCircle2, Headphones, UploadCloud } from 'lucide-react';

type Message = {
  role: 'user' | 'bot';
  content: string;
  audioUrl?: string;
};

export default function ChatPage() {
  const [ragMessages, setRagMessages] = useState<Message[]>([
    { role: 'bot', content: 'WELCOME TO QUERY VAULT 2.0 🚀 | Upload your documents and ask me anything!' }
  ]);
  const [audioMessages, setAudioMessages] = useState<Message[]>([
    { role: 'bot', content: '🎙️ Upload an MP3, WAV, or M4A file — I will transcribe it, summarize it, and let you chat with the content!' }
  ]);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'audio'>('chat');
  const [language, setLanguage] = useState<'English' | 'Hindi'>('English');
  const [isListening, setIsListening] = useState(false);

  // Doc RAG state
  const [isDocsLoaded, setIsDocsLoaded] = useState(false);

  // Audio Agent state
  const [audioSessionId, setAudioSessionId] = useState<string | null>(null);
  const [audioSummary, setAudioSummary] = useState('');
  const [audioChatHistory, setAudioChatHistory] = useState<[string, string][]>([]);
  const [isAudioProcessing, setIsAudioProcessing] = useState(false);

  // Resizable Sidebar
  const [sidebarWidth, setSidebarWidth] = useState(288);
  const [isResizing, setIsResizing] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Converts **bold** markdown to <strong> tags
  const renderText = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/);
    return parts.map((part, i) =>
      part.startsWith('**') && part.endsWith('**')
        ? <strong key={i} className="font-bold text-white">{part.slice(2, -2)}</strong>
        : <span key={i}>{part}</span>
    );
  };


  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) router.push('/login');
  }, [router]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ragMessages, audioMessages, activeTab]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      let newWidth = e.clientX;
      if (newWidth < 200) newWidth = 200;
      if (newWidth > 600) newWidth = 600;
      setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = 'default';
    };
    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window) && !('speechRecognition' in window)) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).speechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = language === 'Hindi' ? 'hi-IN' : 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      setInput(event.results[0][0].transcript);
    };
    recognition.start();
  };

  const cleanApiUrl = () =>
    (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000')
      .trim().replace(/^['"]+|['"]+$/g, '').replace(/\/+$/, '');

  // Document upload (sidebar)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setIsUploading(true);
    const formData = new FormData();
    for (let i = 0; i < e.target.files.length; i++) formData.append("files", e.target.files[i]);
    try {
      const res = await fetch(`${cleanApiUrl()}/docs/upload`, { method: 'POST', body: formData });
      if (res.ok) {
        setIsDocsLoaded(true);
        setRagMessages(prev => [...prev, { role: 'bot', content: "✅ Documents uploaded and indexed successfully! Ask me anything about them." }]);
      } else throw new Error("Upload failed");
    } catch {
      alert("Failed to upload documents.");
    } finally {
      setIsUploading(false);
    }
  };

  // Audio file upload (Audio Agent tab)
  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setIsAudioProcessing(true);
    setAudioSummary('');
    setAudioSessionId(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("language", language);

    try {
      const res = await fetch(`${cleanApiUrl()}/audio/upload`, { method: 'POST', body: formData });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Processing failed");
      }
      const data = await res.json();
      setAudioSessionId(data.session_id);
      setAudioSummary(data.summary);
      // Summary is shown in the card above — no chat bubble needed
    } catch (err) {
      setAudioMessages(prev => [...prev, { role: 'bot', content: `❌ Error: ${err instanceof Error ? err.message : "Unknown error"}` }]);
    } finally {
      setIsAudioProcessing(false);
    }
  };

  // Send chat message
  const handleSendMessage = async () => {
    if (!input.trim()) return;

    if (activeTab === 'chat') {
      const userMsg: Message = { role: 'user', content: input };
      setRagMessages(prev => [...prev, userMsg]);
      setInput('');
      setIsLoading(true);
      try {
        const res = await fetch(`${cleanApiUrl()}/docs/chat?language=${language}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: input, chat_history: ragMessages.filter(m => m.role !== 'bot' || !m.content.includes("✅")).map(m => [m.role === 'user' ? 'human' : 'assistant', m.content]) })
        });
        const data = await res.json();
        const botMsg: Message = { role: 'bot', content: data.answer || "No response", audioUrl: data.audio_url ? `${cleanApiUrl()}${data.audio_url}` : data.audioUrl ? `${cleanApiUrl()}${data.audioUrl}` : undefined };
        setRagMessages(prev => [...prev, botMsg]);
        // No autoplay — user presses play manually
      } catch {
        setRagMessages(prev => [...prev, { role: 'bot', content: "Error connecting to backend." }]);
      } finally { setIsLoading(false); }

    } else {
      // Audio chat
      if (!audioSessionId) {
        alert("Please upload an audio file first!");
        return;
      }
      const userMsg: Message = { role: 'user', content: input };
      setAudioMessages(prev => [...prev, userMsg]);
      setInput('');
      setIsLoading(true);
      try {
        const res = await fetch(`${cleanApiUrl()}/audio/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: audioSessionId, question: input, chat_history: audioChatHistory, language })
        });
        const data = await res.json();
        const botMsg: Message = { role: 'bot', content: data.answer || "No response", audioUrl: data.audio_url ? `${cleanApiUrl()}${data.audio_url}` : undefined };
        setAudioMessages(prev => [...prev, botMsg]);
        setAudioChatHistory(prev => [...prev, [input, data.answer]]);
        // No autoplay — user presses play manually
      } catch {
        setAudioMessages(prev => [...prev, { role: 'bot', content: "Error in Audio chat." }]);
      } finally { setIsLoading(false); }
    }
  };

  const currentMessages = activeTab === 'chat' ? ragMessages : audioMessages;

  return (
    <div className="flex h-screen bg-black text-white font-sans overflow-hidden">

      {/* SIDEBAR */}
      <aside
        className="glass flex flex-col p-4 border-r border-zinc-800 shrink-0 relative group"
        style={{ width: `${sidebarWidth}px` }}
      >
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="w-8 h-8 bg-gradient-to-tr from-purple-600 to-blue-500 rounded-lg shadow-lg shadow-blue-500/20" />
          <h1 className="text-xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400">
            QUERY VAULT 2.0 🚀
          </h1>
        </div>

        <nav className="flex-1 space-y-2">
          <button
            onClick={() => setActiveTab('chat')}
            className={`w-full flex items-center gap-3 p-4 rounded-2xl transition-all ${activeTab === 'chat' ? 'bg-zinc-800/50 text-white border border-zinc-700' : 'text-zinc-500 hover:text-white hover:bg-zinc-900 border border-transparent'}`}
          >
            <MessageSquare size={20} />
            <span className="font-bold uppercase tracking-wider text-xs">RAG Chatbot 🛡️</span>
          </button>
          <button
            onClick={() => setActiveTab('audio')}
            className={`w-full flex items-center gap-3 p-4 rounded-2xl transition-all ${activeTab === 'audio' ? 'bg-zinc-800/50 text-white border border-zinc-700' : 'text-zinc-500 hover:text-white hover:bg-zinc-900 border border-transparent'}`}
          >
            <Headphones size={20} />
            <span className="font-bold uppercase tracking-wider text-xs">Audio Agent 🎙️</span>
          </button>
        </nav>

        <div className="mt-auto pt-6 border-t border-zinc-800 space-y-4">
          <div className="p-4 bg-zinc-900/50 rounded-2xl border border-zinc-800">
            <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-3 font-bold px-1">Language Logic</div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setLanguage('English')} className={`p-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${language === 'English' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-zinc-500 bg-zinc-950'}`}>
                <Globe size={14} /> English
              </button>
              <button onClick={() => setLanguage('Hindi')} className={`p-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${language === 'Hindi' ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30' : 'text-zinc-500 bg-zinc-950'}`}>
                <Languages size={14} /> Hindi
              </button>
            </div>
          </div>


          <button
            onClick={() => { localStorage.removeItem('token'); router.push('/login'); }}
            className="w-full flex items-center gap-3 p-4 text-zinc-500 hover:text-rose-400 transition-all font-medium rounded-2xl"
          >
            <LogOut size={20} />
            <span>Sign Out</span>
          </button>
        </div>

        <div
          onMouseDown={() => setIsResizing(true)}
          className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-indigo-500/30 transition-colors z-50"
        />
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8 scroll-smooth pb-64">

          {/* Branding */}
          <div className="flex justify-center mb-8">
            <div className="px-6 py-2 bg-zinc-900/50 border border-zinc-800 rounded-full flex items-center gap-2">
              <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-black tracking-[0.2em] text-zinc-400 uppercase">Query Vault 2.0 Intelligence</span>
            </div>
          </div>

          {/* DOC UPLOAD BLOCK — RAG tab */}
          {activeTab === 'chat' && (
            <div className="max-w-4xl mx-auto w-full mb-10">
              <div className="glass p-8 rounded-[2.5rem] border border-zinc-800 shadow-2xl">
                <h2 className="text-2xl font-black mb-2 flex items-center gap-3 uppercase tracking-tighter">
                  <FileUp className="text-purple-400" /> RAG Chatbot 🛡️
                </h2>
                <p className="text-zinc-500 text-sm mb-6">Upload your documents — they will be indexed and you can chat with them below.</p>
                <label className={`flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-3xl cursor-pointer transition-all ${isUploading ? 'border-purple-500 bg-purple-500/5' : isDocsLoaded ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-zinc-700 hover:border-purple-500/50 bg-zinc-900/30'}`}>
                  {isUploading ? (
                    <><Loader2 className="animate-spin text-purple-400 mb-3" size={32} /><span className="text-purple-300 font-semibold">Indexing documents...</span></>
                  ) : isDocsLoaded ? (
                    <><CheckCircle2 className="text-emerald-400 mb-3" size={32} /><span className="text-emerald-300 font-semibold">Docs Loaded! Upload more</span></>
                  ) : (
                    <><UploadCloud className="text-zinc-500 mb-3" size={32} /><span className="text-zinc-300 font-semibold">Click to upload documents</span><span className="text-zinc-600 text-xs mt-1">PDF, DOCX, TXT</span></>
                  )}
                  <input type="file" accept=".pdf,.doc,.docx,.txt" className="hidden" multiple onChange={handleFileUpload} disabled={isUploading} />
                </label>
              </div>
            </div>
          )}

          {/* AUDIO UPLOAD BLOCK */}
          {activeTab === 'audio' && (
            <div className="max-w-4xl mx-auto w-full mb-10">
              <div className="glass p-8 rounded-[2.5rem] border border-zinc-800 shadow-2xl">
                <h2 className="text-2xl font-black mb-2 flex items-center gap-3 uppercase tracking-tighter">
                  <Headphones className="text-indigo-400" /> Audio Agent 🎙️
                </h2>
                <p className="text-zinc-500 text-sm mb-6">Upload an audio file — it will be transcribed by Whisper AI and summarized. You can then chat with the content.</p>

                <label className={`flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-3xl cursor-pointer transition-all ${isAudioProcessing ? 'border-indigo-500 bg-indigo-500/5' : audioSessionId ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-zinc-700 hover:border-indigo-500/50 bg-zinc-900/30'}`}>
                  {isAudioProcessing ? (
                    <><Loader2 className="animate-spin text-indigo-400 mb-3" size={32} /><span className="text-indigo-300 font-semibold">Transcribing with Whisper AI...</span><span className="text-zinc-500 text-xs mt-1">This may take 10-30 seconds</span></>
                  ) : audioSessionId ? (
                    <><CheckCircle2 className="text-emerald-400 mb-3" size={32} /><span className="text-emerald-300 font-semibold">Audio Loaded! Upload another</span></>
                  ) : (
                    <><UploadCloud className="text-zinc-500 mb-3" size={32} /><span className="text-zinc-300 font-semibold">Click to upload audio file</span><span className="text-zinc-600 text-xs mt-1">MP3, WAV, M4A, OGG, WEBM</span></>
                  )}
                  <input type="file" accept=".mp3,.wav,.m4a,.ogg,.webm" className="hidden" onChange={handleAudioUpload} disabled={isAudioProcessing} />
                </label>

                {audioSummary && (
                  <div className="mt-6 p-6 bg-black/50 rounded-2xl border border-zinc-800 max-h-60 overflow-y-auto">
                    <div className="text-[10px] uppercase tracking-widest text-indigo-400 mb-3 font-black">📋 AI Summary</div>
                    <p className="text-zinc-300 leading-relaxed text-sm">{audioSummary}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* CHAT MESSAGES */}
          {currentMessages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end animate-in fade-in slide-in-from-bottom-2 duration-300'}`}>
              <div className={`max-w-[75%] p-7 rounded-[2rem] shadow-2xl leading-relaxed relative ${msg.role === 'user'
                ? 'bg-gradient-to-br from-indigo-950/40 to-purple-950/40 border border-indigo-500/20 text-indigo-50 rounded-bl-none'
                : 'bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-br-none font-light'
              }`}>
                <div className={`text-[10px] uppercase tracking-[0.3em] mb-4 font-black flex items-center gap-2 ${msg.role === 'user' ? 'text-indigo-400' : 'text-zinc-500'}`}>
                  {msg.role === 'user' ? '👤 Sender' : '🤖 Intelligence'}
                </div>
                <div className="text-lg whitespace-pre-wrap">{renderText(msg.content)}</div>
                {msg.audioUrl && (
                  <div className="mt-4 pt-4 border-t border-zinc-800/50">
                    <audio controls className="w-full h-8 accent-indigo-500 rounded-lg opacity-70 hover:opacity-100 transition-opacity" src={msg.audioUrl}>
                      Your browser does not support the audio element.
                    </audio>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div className="h-20" />
          <div ref={scrollRef} />
        </div>

        {/* INPUT BAR */}
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10 pointer-events-none">
          <div className="max-w-4xl mx-auto glass p-3 rounded-[3rem] shadow-2xl border border-zinc-800/80 pointer-events-auto flex items-center gap-2 bg-black/40 backdrop-blur-3xl">
            <button
              onClick={startListening}
              className={`p-5 rounded-full transition-all shadow-xl ${isListening ? 'bg-rose-500 text-white animate-pulse' : 'bg-zinc-900/80 text-zinc-500 hover:text-purple-400'}`}
            >
              {isListening ? <Square size={22} fill="white" /> : <Mic size={22} />}
            </button>
            <input
              type="text"
              placeholder={activeTab === 'chat' ? `Ask the Vault... (${language})` : audioSessionId ? "Ask about the audio content..." : "Upload an audio file first..."}
              className="flex-1 bg-transparent p-4 outline-none text-zinc-100 placeholder-zinc-700 text-xl"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              disabled={activeTab === 'audio' && !audioSessionId}
            />
            <button
              onClick={handleSendMessage}
              disabled={isLoading || (activeTab === 'audio' && !audioSessionId)}
              className="p-5 bg-gradient-to-tr from-purple-600 to-indigo-600 rounded-full shadow-2xl disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="animate-spin" size={26} /> : <Send size={26} />}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
