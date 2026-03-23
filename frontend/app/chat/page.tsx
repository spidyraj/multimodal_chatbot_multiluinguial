"use client";
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquare, Youtube, FileUp, Mic, Send, LogOut, Loader2 } from 'lucide-react';

export default function ChatPage() {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'youtube'>('chat');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [summary, setSummary] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) router.push('/login');
    // For now, we manually push an initial message
    setMessages([{ role: 'bot', content: 'Hello! I am Query Vault 2.0. How can I help you today?' }]);
  }, [router]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!input.trim()) return;
    const userMsg = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const res = await fetch(`${apiUrl}/docs/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: input, chat_history: [] })
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'bot', content: data.response || "No response" }]);
    } catch {
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
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        const res = await fetch(`${apiUrl}/youtube/summarize?url=${encodeURIComponent(youtubeUrl)}`, { method: 'POST' });
        const data = await res.json();
        setSummary(data.summary || data.detail);
    } catch {
        setSummary("Failed to fetch summary.");
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-black text-white font-sans overflow-hidden">
      {/* SIDEBAR */}
      <aside className="w-72 glass flex flex-col p-4 border-r border-zinc-800">
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="w-8 h-8 bg-gradient-to-tr from-purple-600 to-blue-500 rounded-lg shadow-lg shadow-blue-500/20" />
          <h1 className="text-xl font-bold gradient-text">Query Vault 2.0</h1>
        </div>

        <nav className="flex-1 space-y-2">
          <button 
            onClick={() => setActiveTab('chat')}
            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${activeTab === 'chat' ? 'bg-zinc-800/50 text-white' : 'text-zinc-500 hover:text-white hover:bg-zinc-900'}`}
          >
            <MessageSquare size={20} />
            <span>RAG Chatbot</span>
          </button>
          <button 
            onClick={() => setActiveTab('youtube')}
            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${activeTab === 'youtube' ? 'bg-zinc-800/50 text-white' : 'text-zinc-500 hover:text-white hover:bg-zinc-900'}`}
          >
            <Youtube size={20} />
            <span>YouTube Summarizer</span>
          </button>
        </nav>

        <div className="mt-auto pt-6 border-t border-zinc-800 space-y-4">
          <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-zinc-800 rounded-2xl hover:border-zinc-700 cursor-pointer transition-all bg-zinc-900/30">
            <FileUp className="text-zinc-500 mb-2" />
            <span className="text-sm text-zinc-400">Upload Documents</span>
            <input type="file" className="hidden" multiple />
          </label>
          
          <button 
            onClick={() => { localStorage.removeItem('token'); router.push('/login'); }}
            className="w-full flex items-center gap-3 p-3 text-zinc-500 hover:text-red-400 transition-all"
          >
            <LogOut size={20} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col relative">
        {activeTab === 'chat' ? (
          <>
            {/* CHAT DISPLAY */}
            <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8 scroll-smooth">
              {messages.map((msg, idx) => (
                <div 
                  key={idx} 
                  className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}
                >
                  <div className={`max-w-[80%] p-5 rounded-2xl shadow-xl leading-relaxed ${
                    msg.role === 'user' 
                      ? 'bg-purple-900/30 border border-purple-500/20 text-purple-100 rounded-bl-none' 
                      : 'bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-br-none'
                  }`}>
                    <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2 font-bold flex items-center gap-2">
                        {msg.role === 'user' ? '👤 Your Query' : '🤖 Assistant'}
                    </div>
                    {msg.content}
                  </div>
                </div>
              ))}
              <div ref={scrollRef} />
            </div>

            {/* INPUT AREA */}
            <div className="p-6 md:p-10 pt-0">
               <div className="max-w-4xl mx-auto flex items-end gap-3 glass p-2 rounded-2xl shadow-2xl">
                  <input 
                    type="text" 
                    placeholder="Ask anything..."
                    className="flex-1 bg-transparent p-3 outline-none text-zinc-200 placeholder-zinc-600"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  />
                  <button className="p-3 text-zinc-500 hover:text-purple-400 transition-all">
                    <Mic size={22} />
                  </button>
                  <button 
                    onClick={handleSendMessage}
                    disabled={isLoading}
                    className="p-3 bg-gradient-to-tr from-purple-600 to-blue-500 rounded-xl shadow-lg shadow-blue-500/10 hover:opacity-90 disabled:opacity-50 transition-all"
                  >
                    {isLoading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
                  </button>
               </div>
            </div>
          </>
        ) : (
          /* YOUTUBE VIEW */
          <div className="flex-1 flex flex-col items-center justify-center p-10 max-w-4xl mx-auto w-full">
            <h2 className="text-4xl font-bold gradient-text mb-4">YouTube Summarizer</h2>
            <p className="text-zinc-400 mb-10">Paste a link and get a detailed brief in seconds.</p>
            
            <div className="w-full space-y-4">
                <input 
                    type="text" 
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="w-full p-4 glass rounded-2xl outline-none focus:border-blue-500 transition-all"
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                />
                <button 
                  onClick={handleYoutubeSummary}
                  disabled={isLoading}
                  className="w-full p-4 bg-gradient-to-r from-blue-600 to-purple-600 font-bold rounded-2xl shadow-xl hover:opacity-90 transition-all disabled:opacity-50"
                >
                  {isLoading ? "Analyzing Video..." : "Generate Summary"}
                </button>
            </div>

            {summary && (
                <div className="mt-10 w-full p-8 glass rounded-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-4">Summary Output</h3>
                    <div className="text-zinc-300 leading-relaxed text-lg whitespace-pre-wrap">{summary}</div>
                </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
