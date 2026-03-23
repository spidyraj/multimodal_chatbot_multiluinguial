"use client";
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquare, Youtube, FileUp, Mic, Send, LogOut, Loader2, Globe, Languages, Play, Square } from 'lucide-react';

type Message = {
  role: 'user' | 'bot';
  content: string;
  audioUrl?: string;
};

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'youtube'>('chat');
  const [language, setLanguage] = useState<'English' | 'Hindi'>('English');
  const [isListening, setIsListening] = useState(false);
  
  // YouTube specific state
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [summary, setSummary] = useState('');
  const [ytChatHistory, setYtChatHistory] = useState<[string, string][]>([]);
  const [ytInput, setYtInput] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) router.push('/login');
    // Initial bot greeting
    setMessages([{ role: 'bot', content: 'Hello! I am Query Vault 2.0. How can I help you today?' }]);
  }, [router]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Speech to Text handler using Web Speech API
  const startListening = () => {
    if (!('webkitSpeechRecognition' in window) && !('speechRecognition' in window)) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).speechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.lang = language === 'Hindi' ? 'hi-IN' : 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (activeTab === 'chat') setInput(transcript);
      else setYtInput(transcript);
    };

    recognition.start();
  };

  const cleanApiUrl = () => {
    return (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000')
      .trim()
      .replace(/^['"]|['"]$/g, '')
      .replace(/\/+$/, '');
  };

  const handleSendMessage = async () => {
    if (!input.trim()) return;
    const userMsg: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const apiUrl = cleanApiUrl();
      // Pass the language as a query param
      const res = await fetch(`${apiUrl}/docs/chat?language=${language}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            question: input, 
            chat_history: messages.map(m => [m.role === 'user' ? 'human' : 'assistant', m.content]) 
          })
      });
      const data = await res.json();
      const botMsg: Message = { 
        role: 'bot', 
        content: data.answer || "No response",
        audioUrl: data.audioUrl ? `${apiUrl}${data.audioUrl}` : undefined
      };
      setMessages(prev => [...prev, botMsg]);
      
      // Auto-play audio response if available
      if (botMsg.audioUrl && audioRef.current) {
         audioRef.current.src = botMsg.audioUrl;
         audioRef.current.play().catch(err => console.error("Audio playback failed:", err));
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, { role: 'bot', content: "Error connecting to backend." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleYoutubeSummary = async () => {
    if (!youtubeUrl) return;
    setIsLoading(true);
    setSummary('');
    try {
        const apiUrl = cleanApiUrl();
        const res = await fetch(`${apiUrl}/youtube/summarize?url=${encodeURIComponent(youtubeUrl)}&language=${language}`, { 
          method: 'POST' 
        });
        const data = await res.json();
        setSummary(data.summary || "No summary provided.");
    } catch (error) {
        console.error("YouTube summary error:", error);
        setSummary("Failed to fetch summary.");
    } finally {
        setIsLoading(false);
    }
  };

  const handleYoutubeChat = async () => {
    if (!ytInput.trim() || !youtubeUrl) return;
    const userMsg: Message = { role: 'user', content: ytInput };
    setMessages(prev => [...prev, userMsg]);
    setYtInput('');
    setIsLoading(true);

    try {
      const apiUrl = cleanApiUrl();
      const res = await fetch(`${apiUrl}/youtube/chat?url=${encodeURIComponent(youtubeUrl)}&question=${encodeURIComponent(ytInput)}&language=${language}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ytChatHistory)
      });
      const data = await res.json();
      const botMsg: Message = { 
        role: 'bot', 
        content: data.answer || "No response",
        audioUrl: data.audioUrl ? `${apiUrl}${data.audioUrl}` : undefined
      };
      setMessages(prev => [...prev, botMsg]);
      setYtChatHistory(prev => [...prev, [ytInput, data.answer]]);

      if (botMsg.audioUrl && audioRef.current) {
        audioRef.current.src = botMsg.audioUrl;
        audioRef.current.play().catch(e => console.error("Audio playback failed:", e));
      }
    } catch (error) {
      console.error("YouTube chat error:", error);
      setMessages(prev => [...prev, { role: 'bot', content: "Error in YouTube chat." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-black text-white font-sans overflow-hidden">
      {/* Hidden Audio Player */}
      <audio ref={audioRef} hidden />
      
      {/* SIDEBAR */}
      <aside className="w-72 glass flex flex-col p-4 border-r border-zinc-800">
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="w-8 h-8 bg-gradient-to-tr from-purple-600 to-blue-500 rounded-lg shadow-lg shadow-blue-500/20" />
          <h1 className="text-xl font-bold gradient-text">Query Vault 2.0</h1>
        </div>

        <nav className="flex-1 space-y-2">
          <button 
            onClick={() => setActiveTab('chat')}
            className={`w-full flex items-center gap-3 p-4 rounded-2xl transition-all ${activeTab === 'chat' ? 'bg-zinc-800/50 text-white border border-zinc-700' : 'text-zinc-500 hover:text-white hover:bg-zinc-900'}`}
          >
            <MessageSquare size={20} />
            <span className="font-medium">RAG Chatbot</span>
          </button>
          <button 
            onClick={() => setActiveTab('youtube')}
            className={`w-full flex items-center gap-3 p-4 rounded-2xl transition-all ${activeTab === 'youtube' ? 'bg-zinc-800/50 text-white border border-zinc-700' : 'text-zinc-500 hover:text-white hover:bg-zinc-900'}`}
          >
            <Youtube size={20} />
            <span className="font-medium">YouTube Agent</span>
          </button>
        </nav>

        <div className="mt-auto pt-6 border-t border-zinc-800 space-y-4">
          <div className="p-4 bg-zinc-900/50 rounded-2xl border border-zinc-800">
             <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-3 font-bold px-1">Language Logic</div>
             <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => setLanguage('English')}
                  className={`p-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${language === 'English' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-lg shadow-blue-500/5' : 'text-zinc-500 bg-zinc-950 border border-transparent'}`}
                >
                  <Globe size={14} /> English
                </button>
                <button 
                  onClick={() => setLanguage('Hindi')}
                  className={`p-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${language === 'Hindi' ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30 shadow-lg shadow-purple-500/5' : 'text-zinc-500 bg-zinc-950 border border-transparent'}`}
                >
                  <Languages size={14} /> Hindi
                </button>
             </div>
          </div>

          <label className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-zinc-800 rounded-3xl hover:border-zinc-700 cursor-pointer transition-all bg-zinc-900/30 group">
            <FileUp className="text-zinc-500 mb-2 group-hover:text-purple-400 transition-colors" />
            <span className="text-sm text-zinc-400 font-medium">Upload Docs</span>
            <input type="file" className="hidden" multiple />
          </label>
          
          <button 
            onClick={() => { localStorage.removeItem('token'); router.push('/login'); }}
            className="w-full flex items-center gap-3 p-4 text-zinc-500 hover:text-rose-400 transition-all font-medium rounded-2xl hover:bg-rose-400/5"
          >
            <LogOut size={20} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col relative bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-900/20 via-black to-black">
        <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8 scroll-smooth pb-40">
          
          {/* YOUTUBE INPUT BLOCK (Sticky-like top section when in YouTube mode) */}
          {activeTab === 'youtube' && (
             <div className="max-w-4xl mx-auto w-full mb-10 group">
                <div className="glass p-8 rounded-[2.5rem] border border-zinc-800 shadow-2xl relative overflow-hidden group-hover:border-zinc-700 transition-all">
                   <div className="relative z-10">
                      <h2 className="text-2xl font-bold mb-4 flex items-center gap-3">
                         <Youtube className="text-rose-500" /> YouTube Intelligence
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
                            className="px-8 bg-rose-600 hover:bg-rose-500 rounded-2xl font-bold transition-all disabled:opacity-50 shadow-lg shadow-rose-900/20"
                         >
                            {isLoading ? <Loader2 className="animate-spin" /> : "Analyze"}
                         </button>
                      </div>
                      {summary && (
                         <div className="mt-6 p-6 bg-black/50 rounded-2xl border border-zinc-800 font-light leading-relaxed max-h-60 overflow-y-auto text-zinc-300">
                            <div className="text-[10px] uppercase tracking-widest text-rose-400 mb-3 font-black">Video Brief</div>
                            {summary}
                         </div>
                      )}
                   </div>
                   <div className="absolute top-0 right-0 w-48 h-48 bg-rose-500/5 blur-[100px] -mr-10 -mt-10" />
                </div>
             </div>
          )}

          {/* CHAT MESSAGES DISPLAY */}
          {messages.map((msg, idx) => (
            <div 
              key={idx} 
              className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end animate-in fade-in slide-in-from-bottom-2 duration-300'}`}
            >
              <div className={`max-w-[75%] p-7 rounded-[2rem] shadow-2xl leading-relaxed relative group ${
                msg.role === 'user' 
                  ? 'bg-gradient-to-br from-indigo-950/40 to-purple-950/40 border border-indigo-500/20 text-indigo-50 rounded-bl-none' 
                  : 'bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-br-none'
              }`}>
                <div className={`text-[10px] uppercase tracking-[0.3em] mb-4 font-black flex items-center gap-2 ${
                  msg.role === 'user' ? 'text-indigo-400' : 'text-zinc-500'
                }`}>
                    {msg.role === 'user' ? '👤 Human' : '🤖 Assistant'}
                </div>
                <div className="text-lg font-normal mb-2">{msg.content}</div>
                
                {msg.audioUrl && (
                  <div className="mt-4 flex justify-end">
                    <button 
                      onClick={() => { if(audioRef.current) { audioRef.current.src = msg.audioUrl!; audioRef.current.play(); } }}
                      className="p-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-full transition-all text-zinc-400 hover:text-white shadow-xl"
                      title="Play Audio"
                    >
                      <Play size={16} fill="currentColor" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={scrollRef} />
        </div>

        {/* UNIFIED FLOATING INPUT BAR */}
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10 pointer-events-none">
           <div className="max-w-4xl mx-auto glass p-3 rounded-[3rem] shadow-2xl border border-zinc-800/80 pointer-events-auto flex items-center gap-2 group focus-within:border-purple-500/40 transition-all bg-black/40 backdrop-blur-3xl">
              <button 
                onClick={startListening}
                className={`p-5 rounded-full transition-all shadow-xl ${isListening ? 'bg-rose-500 text-white animate-pulse' : 'bg-zinc-900/80 text-zinc-500 hover:text-purple-400 hover:bg-zinc-800'}`}
                title="Voice Input"
              >
                {isListening ? <Square size={22} fill="white" /> : <Mic size={22} />}
              </button>
              
              <input 
                type="text" 
                placeholder={activeTab === 'chat' ? `Ask the Vault in ${language}...` : "Discuss this video content..."}
                className="flex-1 bg-transparent p-4 outline-none text-zinc-100 placeholder-zinc-700 text-xl font-medium"
                value={activeTab === 'chat' ? input : ytInput}
                onChange={(e) => activeTab === 'chat' ? setInput(e.target.value) : setYtInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (activeTab === 'chat' ? handleSendMessage() : handleYoutubeChat())}
              />
              
              <button 
                onClick={activeTab === 'chat' ? handleSendMessage : handleYoutubeChat}
                disabled={isLoading}
                className="p-5 bg-gradient-to-tr from-purple-600 to-indigo-600 rounded-full shadow-2xl shadow-indigo-500/30 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="animate-spin" size={26} /> : <Send size={26} />}
              </button>
           </div>
        </div>
      </main>
    </div>
  );
}
