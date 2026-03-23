"use client";
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquare, Youtube, FileUp, Mic, Send, LogOut, Loader2, Globe, Languages, Play, Square, CheckCircle2 } from 'lucide-react';

type Message = {
  role: 'user' | 'bot';
  content: string;
  audioUrl?: string;
};

export default function ChatPage() {
  // Separate chat histories for RAG and YouTube
  const [ragMessages, setRagMessages] = useState<Message[]>([
    { role: 'bot', content: 'WELCOME TO QUERY VAULT 2.0 🚀 | Upload your documents and ask me anything!' }
  ]);
  const [ytMessages, setYtMessages] = useState<Message[]>([
    { role: 'bot', content: 'Paste a YouTube link above and I can help you summarize or chat about it!' }
  ]);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'youtube'>('chat');
  const [language, setLanguage] = useState<'English' | 'Hindi'>('English');
  const [isListening, setIsListening] = useState(false);

  // YouTube specific state
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [summary, setSummary] = useState('');
  const [ytChatHistory, setYtChatHistory] = useState<[string, string][]>([]);
  const [isDocsLoaded, setIsDocsLoaded] = useState(false);

  // Resizable Sidebar State
  const [sidebarWidth, setSidebarWidth] = useState(288);
  const [isResizing, setIsResizing] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) router.push('/login');
  }, [router]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ragMessages, ytMessages, activeTab]);

  // Handle Sidebar Resizing
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
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
    };
    recognition.start();
  };

  const cleanApiUrl = () => {
    return (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000')
      .trim()
      .replace(/^['"]|['"]$/g, '')
      .replace(/\/+$/, '');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setIsUploading(true);
    const formData = new FormData();
    for (let i = 0; i < e.target.files.length; i++) {
      formData.append("files", e.target.files[i]);
    }

    try {
      const apiUrl = cleanApiUrl();
      const res = await fetch(`${apiUrl}/docs/upload`, {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        setIsDocsLoaded(true);
        setRagMessages(prev => [...prev, { role: 'bot', content: "✅ Documents uploaded and indexed successfully! You can now ask questions about them." }]);
      } else {
        throw new Error("Upload failed");
      }
    } catch (error) {
      console.error("Upload error:", error);
      alert("Failed to upload documents.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    // Add user message to the appropriate history
    if (activeTab === 'chat') {
      const userMsg: Message = { role: 'user', content: input };
      setRagMessages(prev => [...prev, userMsg]);
      setInput('');
      setIsLoading(true);

      try {
        const apiUrl = cleanApiUrl();
        const res = await fetch(`${apiUrl}/docs/chat?language=${language}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: input,
            chat_history: ragMessages.filter(m => m.role !== 'bot' || !m.content.includes("✅")).map(m => [m.role === 'user' ? 'human' : 'assistant', m.content])
          })
        });
        const data = await res.json();
        const botMsg: Message = {
          role: 'bot',
          content: data.answer || "No response",
          audioUrl: data.audioUrl ? `${apiUrl}${data.audioUrl}` : undefined
        };
        setRagMessages(prev => [...prev, botMsg]);
        if (botMsg.audioUrl && audioRef.current) {
          audioRef.current.src = botMsg.audioUrl;
          audioRef.current.play().catch(err => console.error("Audio playback failed:", err));
        }
      } catch {
        setRagMessages(prev => [...prev, { role: 'bot', content: "Error connecting to backend." }]);
      } finally {
        setIsLoading(false);
      }
    } else {
      // YouTube Chat logic
      if (!youtubeUrl) {
        alert("Please paste a YouTube URL first!");
        return;
      }
      const userMsg: Message = { role: 'user', content: input };
      setYtMessages(prev => [...prev, userMsg]);
      setInput('');
      setIsLoading(true);

      try {
        const apiUrl = cleanApiUrl();
        const res = await fetch(`${apiUrl}/youtube/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: youtubeUrl,
            question: input,
            chat_history: ytChatHistory,
            language: language
          })
        });
        const data = await res.json();
        const botMsg: Message = {
          role: 'bot',
          content: data.answer || "No response",
          audioUrl: data.audioUrl ? `${apiUrl}${data.audioUrl}` : undefined
        };
        setYtMessages(prev => [...prev, botMsg]);
        setYtChatHistory(prev => [...prev, [input, data.answer]]);
        if (botMsg.audioUrl && audioRef.current) {
          audioRef.current.src = botMsg.audioUrl;
          audioRef.current.play().catch(e => console.error("Audio playback failed:", e));
        }
      } catch {
        setYtMessages(prev => [...prev, { role: 'bot', content: "Error in YouTube chat." }]);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleYoutubeSummary = async () => {
    if (!youtubeUrl) return;
    setIsLoading(true);
    setSummary('');
    try {
      const apiUrl = cleanApiUrl();
      const res = await fetch(`${apiUrl}/youtube/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: youtubeUrl,
          language: language
        })
      });
      const data = await res.json();
      setSummary(data.summary || "No summary provided.");
      setYtMessages(prev => [...prev, { role: 'bot', content: `🎬 Summary Generated for: ${youtubeUrl}\n\n${data.summary}` }]);
    } catch (error) {
      console.error("YouTube summary error:", error);
      setSummary("Failed to fetch summary.");
    } finally {
      setIsLoading(false);
    }
  };

  const currentMessages = activeTab === 'chat' ? ragMessages : ytMessages;

  return (
    <div className="flex h-screen bg-black text-white font-sans overflow-hidden">
      <audio ref={audioRef} hidden />

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
            onClick={() => setActiveTab('youtube')}
            className={`w-full flex items-center gap-3 p-4 rounded-2xl transition-all ${activeTab === 'youtube' ? 'bg-zinc-800/50 text-white border border-zinc-700' : 'text-zinc-500 hover:text-white hover:bg-zinc-900 border border-transparent'}`}
          >
            <Youtube size={20} />
            <span className="font-bold uppercase tracking-wider text-xs">YouTube Agent 📺</span>
          </button>
        </nav>

        <div className="mt-auto pt-6 border-t border-zinc-800 space-y-4">
          <div className="p-4 bg-zinc-900/50 rounded-2xl border border-zinc-800">
            <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-3 font-bold px-1">Language Logic</div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setLanguage('English')}
                className={`p-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${language === 'English' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-zinc-500 bg-zinc-950'}`}
              >
                <Globe size={14} /> English
              </button>
              <button
                onClick={() => setLanguage('Hindi')}
                className={`p-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${language === 'Hindi' ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30' : 'text-zinc-500 bg-zinc-950'}`}
              >
                <Languages size={14} /> Hindi
              </button>
            </div>
          </div>

          <div className="relative">
            <label className={`flex flex-col items-center justify-center p-5 border-2 border-dashed rounded-3xl cursor-pointer transition-all bg-zinc-900/30 group ${isDocsLoaded ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-zinc-800 hover:border-zinc-700'}`}>
              {isUploading ? (
                <Loader2 className="animate-spin text-purple-400 mb-2" />
              ) : isDocsLoaded ? (
                <CheckCircle2 className="text-emerald-500 mb-2" />
              ) : (
                <FileUp className="text-zinc-500 mb-2 group-hover:text-purple-400" />
              )}
              <span className="text-sm text-zinc-400 font-medium">
                {isUploading ? "Indexing..." : isDocsLoaded ? "Docs Loaded" : "Upload Docs"}
              </span>
              <input type="file" className="hidden" multiple onChange={handleFileUpload} disabled={isUploading} />
            </label>
          </div>

          <button
            onClick={() => { localStorage.removeItem('token'); router.push('/login'); }}
            className="w-full flex items-center gap-3 p-4 text-zinc-500 hover:text-rose-400 transition-all font-medium rounded-2xl"
          >
            <LogOut size={20} />
            <span>Sign Out</span>
          </button>
        </div>

        {/* Resize Handle */}
        <div 
          onMouseDown={() => setIsResizing(true)}
          className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-indigo-500/30 transition-colors z-50 group-hover:block"
        />
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col relative transition-all duration-500 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8 scroll-smooth pb-40">
          
          {/* Main Scene Branding */}
          <div className="flex justify-center mb-8">
            <div className="px-6 py-2 bg-zinc-900/50 border border-zinc-800 rounded-full flex items-center gap-2">
                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-black tracking-[0.2em] text-zinc-400 uppercase">Query Vault 2.0 Intelligence</span>
            </div>
          </div>

          {/* YOUTUBE INPUT BLOCK */}
          {activeTab === 'youtube' && (
            <div className="max-w-4xl mx-auto w-full mb-10 group">
              <div className="glass p-8 rounded-[2.5rem] border border-zinc-800 shadow-2xl relative overflow-hidden group-hover:border-zinc-700 transition-all">
                <div className="relative z-10">
                  <h2 className="text-2xl font-black mb-4 flex items-center gap-3 uppercase tracking-tighter">
                    <Youtube className="text-rose-500" /> YouTube Agent 📺🤖
                  </h2>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      placeholder="Paste video URL..."
                      className="flex-1 bg-black/40 p-4 rounded-2xl border border-zinc-700 outline-none focus:border-rose-500 transition-all text-zinc-200"
                      value={youtubeUrl}
                      onChange={(e) => setYoutubeUrl(e.target.value)}
                    />
                    <button
                      onClick={handleYoutubeSummary}
                      disabled={isLoading}
                      className="px-8 bg-rose-600 hover:bg-rose-500 rounded-2xl font-bold transition-all disabled:opacity-50"
                    >
                      {isLoading ? <Loader2 className="animate-spin" /> : "Summarize"}
                    </button>
                  </div>
                  {summary && (
                    <div className="mt-6 p-6 bg-black/50 rounded-2xl border border-zinc-800 font-light leading-relaxed max-h-60 overflow-y-auto text-zinc-300">
                      <div className="text-[10px] uppercase tracking-widest text-rose-400 mb-3 font-black">Video Brief</div>
                      {summary}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* CHAT MESSAGES */}
          {currentMessages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end animate-in fade-in slide-in-from-bottom-2 duration-300'}`}
            >
              <div className={`max-w-[75%] p-7 rounded-[2rem] shadow-2xl leading-relaxed relative ${msg.role === 'user'
                  ? 'bg-gradient-to-br from-indigo-950/40 to-purple-950/40 border border-indigo-500/20 text-indigo-50 rounded-bl-none'
                  : 'bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-br-none font-light'
                }`}>
                <div className={`text-[10px] uppercase tracking-[0.3em] mb-4 font-black flex items-center gap-2 ${msg.role === 'user' ? 'text-indigo-400' : 'text-zinc-500'
                  }`}>
                  {msg.role === 'user' ? '👤 Sender' : '🤖 Intelligence'}
                </div>
                <div className="text-lg whitespace-pre-wrap">{msg.content}</div>

                {msg.audioUrl && (
                  <div className="mt-4 pt-4 border-t border-zinc-800/50">
                    <audio 
                      controls 
                      className="w-full h-8 accent-indigo-500 rounded-lg opacity-70 hover:opacity-100 transition-opacity" 
                      src={msg.audioUrl}
                    >
                      Your browser does not support the audio element.
                    </audio>
                  </div>
                )}
              </div>
            </div>
          ))}
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
              placeholder={activeTab === 'chat' ? `Ask the Vault... (${language})` : "Ask about the video..."}
              className="flex-1 bg-transparent p-4 outline-none text-zinc-100 placeholder-zinc-700 text-xl"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            />

            <button
              onClick={handleSendMessage}
              disabled={isLoading}
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
