"use client";
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquare, FileUp, Mic, Send, LogOut, Loader2, Globe, Languages, Square, CheckCircle2, Headphones, UploadCloud, RefreshCw, PlusCircle, Download, Share2, Trash2, MessageCircle, Mail, Copy } from 'lucide-react';

type Message = {
  role: 'user' | 'bot';
  content: string;
  audioUrl?: string;
  source?: 'document' | 'audio';
};

/** Small copy + share dropdown shown on bot bubble hover */
function BubbleShareMenu({ content }: { content: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={handleCopy}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all text-[11px] font-semibold ${
          copied
            ? 'bg-emerald-950/40 border-emerald-700 text-emerald-400'
            : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600'
        }`}
      >
        {copied ? (
          <><span>✓</span> Copied!</>
        ) : (
          <><Copy size={11} /> Copy</>
        )}
      </button>
      <div className="relative">
        <button
          onClick={() => setOpen(p => !p)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-blue-400 hover:text-blue-200 hover:border-blue-700 transition-all text-[11px] font-semibold"
        >
          <Share2 size={11} /> Share
        </button>
        {open && (
          <div className="absolute bottom-9 left-0 bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl py-1.5 z-50 min-w-[150px]">
            <button
              onClick={() => { window.open(`https://wa.me/?text=${encodeURIComponent(content.slice(0, 1500))}`, '_blank'); setOpen(false); }}
              className="w-full text-left px-4 py-2.5 text-[11px] text-emerald-400 hover:bg-zinc-800 flex items-center gap-2 font-semibold transition-all"
            >
              <MessageCircle size={12} /> WhatsApp
            </button>
            <button
              onClick={() => { window.open(`https://mail.google.com/mail/?view=cm&su=${encodeURIComponent('AI Response')}&body=${encodeURIComponent(content.slice(0, 3000))}`, '_blank'); setOpen(false); }}
              className="w-full text-left px-4 py-2.5 text-[11px] text-rose-400 hover:bg-zinc-800 flex items-center gap-2 font-semibold transition-all"
            >
              <Mail size={12} /> Gmail
            </button>
          </div>
        )}
      </div>
    </div>
  );
}


export default function ChatPage() {
  const [ragMessages, setRagMessages] = useState<Message[]>([]);
  const [audioMessages, setAudioMessages] = useState<Message[]>([]);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'audio'>('chat');
  const [language, setLanguage] = useState<'English' | 'Hindi'>('English');
  const [isListening, setIsListening] = useState(false);
  const [username, setUsername] = useState('');
  const [token, setToken] = useState('');

  // Doc RAG state
  const [isDocsLoaded, setIsDocsLoaded] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<FileList | null>(null);
  const [showModeModal, setShowModeModal] = useState(false);

  // Audio Chat state
  const [audioSessionId, setAudioSessionId] = useState<string | null>(null);
  const [audioChatHistory, setAudioChatHistory] = useState<[string, string][]>([]);
  const [isAudioProcessing, setIsAudioProcessing] = useState(false);
  const [audioSegments, setAudioSegments] = useState<{start:number;end:number;text:string}[]>([]);
  const [pendingAudioFile, setPendingAudioFile] = useState<File | null>(null);
  const [showAudioModeModal, setShowAudioModeModal] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);

  // Scroll refs
  const chatAreaRef = useRef<HTMLDivElement>(null);

  const [sidebarWidth, setSidebarWidth] = useState(288);
  const [isResizing, setIsResizing] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const cleanApiUrl = () =>
    (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000')
      .trim().replace(/^['\"]+|['\"]+$/g, '').replace(/\/+$/, '');

  const authHeaders = (extra?: Record<string, string>) => ({
    'Authorization': `Bearer ${token}`,
    ...extra,
  });

  // Converts **bold** markdown to <strong> tags, preserves newlines
  const renderText = (text: string) => {
    return text.split('\n').map((line, lineIdx, arr) => {
      const parts = line.split(/(\*\*[^*]+\*\*)/);
      return (
        <span key={lineIdx}>
          {parts.map((part, i) =>
            part.startsWith('**') && part.endsWith('**')
              ? <strong key={i} className="font-bold text-white">{part.slice(2, -2)}</strong>
              : <span key={i}>{part}</span>
          )}
          {lineIdx < arr.length - 1 && <br />}
        </span>
      );
    });
  };

  // Load token + username, then fetch history
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (!storedToken) { router.push('/login'); return; }
    setToken(storedToken);
    try {
      const payload = JSON.parse(atob(storedToken.split('.')[1]));
      setUsername(payload.sub || payload.username || payload.email || 'USER');
    } catch { /* ignore */ }
  }, [router]);

  // Fetch message history once token is available
  useEffect(() => {
    if (!token) return;
    const fetchHistory = async () => {
      try {
        const res = await fetch(`${cleanApiUrl()}/conversations/history?limit=100`, {
          headers: authHeaders(),
        });
        if (!res.ok) return;
        const data: { role: string; content: string; source: string }[] = await res.json();
        const docMsgs = data
          .filter(m => m.source === 'document')
          .map(m => ({ role: m.role as 'user' | 'bot', content: m.content }));
        const audioMsgs = data
          .filter(m => m.source === 'audio')
          .map(m => ({ role: m.role as 'user' | 'bot', content: m.content }));
        if (docMsgs.length) { setRagMessages(docMsgs); setIsDocsLoaded(true); }
        if (audioMsgs.length) setAudioMessages(audioMsgs);
      } catch { /* ignore */ }
    };
    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

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
    const handleMouseUp = () => { setIsResizing(false); document.body.style.cursor = 'default'; };
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
      alert("Speech recognition not supported in this browser.");
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).webkitSpeechRecognition || (window as any).speechRecognition;
    const recognition = new SR();
    recognition.lang = language === 'Hindi' ? 'hi-IN' : 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => setInput(event.results[0][0].transcript);
    recognition.start();
  };

  // Called when user picks a file — if docs already loaded, show Replace/Add modal
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    if (isDocsLoaded) {
      setPendingFiles(e.target.files);
      setShowModeModal(true);
    } else {
      doUploadDocs(e.target.files, 'replace');
    }
  };

  const doUploadDocs = async (files: FileList, mode: 'replace' | 'add') => {
    setShowModeModal(false);
    setPendingFiles(null);
    setIsUploading(true);
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) formData.append("files", files[i]);
    formData.append("mode", mode);
    try {
      const res = await fetch(`${cleanApiUrl()}/docs/upload`, {
        method: 'POST',
        headers: authHeaders(),
        body: formData,
      });
      if (res.ok) {
        setIsDocsLoaded(true);
        if (mode === 'replace') setRagMessages([]); // clear UI history on replace
      } else {
        const err = await res.json();
        alert(`Upload failed: ${err.detail}`);
      }
    } catch {
      alert("Failed to upload documents.");
    } finally {
      setIsUploading(false);
    }
  };

  // Audio file upload — show mode modal if session already loaded
  const handleAudioFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    if (audioSessionId) {
      setPendingAudioFile(file);
      setShowAudioModeModal(true);
    } else {
      doUploadAudio(file);
    }
  };

  const doUploadAudio = async (file: File) => {
    setShowAudioModeModal(false);
    setPendingAudioFile(null);
    setIsAudioProcessing(true);
    setAudioSessionId(null);
    setAudioSegments([]);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("language", language);

    try {
      const res = await fetch(`${cleanApiUrl()}/audio/upload`, {
        method: 'POST',
        headers: authHeaders(),
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Processing failed");
      }
      const data = await res.json();
      setAudioSessionId(data.session_id);
      setAudioSegments(data.segments || []);
      // Strip any leading 'Summary:' prefix the backend may include to avoid duplication
      const summaryText = (data.summary || '').replace(/^\s*\*?\*?Summary:?\*?\*?\s*/i, '').trim();
      setAudioMessages(prev => [...prev, {
        role: 'bot',
        content: `✅ Audio transcribed successfully!\n\n📋 **Summary:**\n${summaryText}\n\nYou can now ask questions about the audio content.`
      }]);
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
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ question: input, chat_history: ragMessages.map(m => [m.role === 'user' ? 'human' : 'assistant', m.content]) })
        });
        const data = await res.json();
        const botMsg: Message = {
          role: 'bot',
          content: data.answer || "No response",
          audioUrl: data.audio_url ? `${cleanApiUrl()}${data.audio_url}` : undefined
        };
        setRagMessages(prev => [...prev, botMsg]);
      } catch {
        setRagMessages(prev => [...prev, { role: 'bot', content: "Error connecting to backend." }]);
      } finally { setIsLoading(false); }

    } else {
      if (!audioSessionId) { alert("Please upload an audio file first!"); return; }
      const userMsg: Message = { role: 'user', content: input };
      setAudioMessages(prev => [...prev, userMsg]);
      setInput('');
      setIsLoading(true);
      try {
        const res = await fetch(`${cleanApiUrl()}/audio/chat`, {
          method: 'POST',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ session_id: audioSessionId, question: input, chat_history: audioChatHistory, language })
        });
        const data = await res.json();
        const botMsg: Message = {
          role: 'bot',
          content: data.answer || "No response",
          audioUrl: data.audio_url ? `${cleanApiUrl()}${data.audio_url}` : undefined
        };
        setAudioMessages(prev => [...prev, botMsg]);
        setAudioChatHistory(prev => [...prev, [input, data.answer]]);
      } catch {
        setAudioMessages(prev => [...prev, { role: 'bot', content: "Error in Audio chat." }]);
      } finally { setIsLoading(false); }
    }
  };

  const currentMessages = activeTab === 'chat' ? ragMessages : audioMessages;
  const setCurrentMessages = activeTab === 'chat' ? setRagMessages : setAudioMessages;

  /** Delete a user message at `idx` and the immediately following bot reply */
  const deletePair = (idx: number) => {
    setCurrentMessages(prev => {
      const next = [...prev];
      // Remove bot reply first (if it follows), then the user msg
      if (next[idx + 1]?.role === 'bot') next.splice(idx, 2);
      else next.splice(idx, 1);
      return next;
    });
  };
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);

  // ---- Chat export helpers ----
  const chatToText = (msgs: Message[]) =>
    msgs.map(m => `[${m.role === 'user' ? username.toUpperCase() || 'YOU' : 'AI'}]\n${m.content}`).join('\n\n---\n\n');

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    setShowDownloadMenu(false);
  };

  const handleDownload = (fmt: 'txt' | 'json' | 'doc') => {
    const label = activeTab === 'chat' ? 'document_chat' : 'audio_chat';
    const msgs = currentMessages;
    if (fmt === 'txt') {
      downloadFile(chatToText(msgs), `${label}.txt`, 'text/plain');
    } else if (fmt === 'json') {
      downloadFile(JSON.stringify(msgs, null, 2), `${label}.json`, 'application/json');
    } else {
      const html = `<html><body style="font-family:Arial">${msgs.map(m =>
        `<p><b>${m.role === 'user' ? username.toUpperCase() || 'YOU' : 'AI'}:</b><br/>${m.content.replace(/\n/g, '<br/>')}</p><hr/>`
      ).join('')}</body></html>`;
      downloadFile(html, `${label}.doc`, 'application/msword');
    }
  };

  const handleShare = (platform: 'whatsapp' | 'gmail') => {
    const text = chatToText(currentMessages);
    const label = activeTab === 'chat' ? 'Document Chat' : 'Audio Chat';
    if (platform === 'whatsapp') {
      window.open(`https://wa.me/?text=${encodeURIComponent(`Query Vault ${label} History:\n\n${text.slice(0, 1500)}`)}`, '_blank');
    } else {
      window.open(`https://mail.google.com/mail/?view=cm&su=${encodeURIComponent(`Query Vault ${label} History`)}&body=${encodeURIComponent(text.slice(0, 3000))}`, '_blank');
    }
    setShowShareMenu(false);
  };

  const handleClearChat = async () => {
    if (!confirm('Clear all chat history for this tab? This cannot be undone.')) return;
    const src = activeTab === 'chat' ? 'document' : 'audio';
    try {
      await fetch(`${cleanApiUrl()}/conversations/history?source=${src}`, {
        method: 'DELETE', headers: authHeaders()
      });
    } catch { /* ignore */ }
    if (activeTab === 'chat') setRagMessages([]);
    else setAudioMessages([]);
  };

  return (
    <div className="flex h-screen bg-black text-white font-sans overflow-hidden">
      <style>{`
        @keyframes shimmerHeading {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes spinBorder {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        /* Very mild background shading inside bubble */
        @keyframes mildInnerShade {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .heading-shimmer {
          background: linear-gradient(90deg, #e0e7ff, #67e8f9, #818cf8, #c4b5fd, #67e8f9, #e0e7ff);
          background-size: 300% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: shimmerHeading 4s linear infinite;
          filter: drop-shadow(0 0 10px rgba(165,243,252,0.6));
        }
        /* Wrapper: just 2px padding = the visible neon border strip */
        .neon-orbit-wrap {
          position: relative;
          border-radius: 2rem;
          padding: 2px;
          overflow: hidden;
        }
        /* Spinning conic gradient fills the 2px gap only (inner div is fully opaque) */
        .neon-orbit-wrap .neon-spinner {
          position: absolute;
          inset: -100%;
          width: 300%;
          height: 300%;
          animation: spinBorder 2.5s linear infinite;
          border-radius: 50%;
        }
        .neon-orbit-user .neon-spinner {
          background: conic-gradient(transparent 0deg, #818cf8 40deg, #a78bfa 80deg, #c4b5fd 120deg, transparent 180deg);
        }
        .neon-orbit-bot .neon-spinner {
          background: conic-gradient(transparent 0deg, #06b6d4 40deg, #22d3ee 80deg, #67e8f9 120deg, transparent 180deg);
        }
        /* Fully opaque inner backgrounds — neon cannot bleed through */
        .neon-orbit-inner-user {
          position: relative;
          z-index: 1;
          border-radius: calc(2rem - 2px);
          /* Solid base + very mild shimmer */
          background: linear-gradient(135deg, #1a1040 0%, #1e1060 40%, #1a1040 100%);
          background-size: 200% 200%;
          animation: mildInnerShade 8s ease infinite;
        }
        .neon-orbit-inner-bot {
          position: relative;
          z-index: 1;
          border-radius: calc(2rem - 2px);
          /* Almost black base + very mild cyan tint shimmer */
          background: linear-gradient(135deg, #0f1117 0%, #0f1a1f 40%, #0f1117 100%);
          background-size: 200% 200%;
          animation: mildInnerShade 8s ease infinite;
        }
      `}</style>

      {/* SIDEBAR */}
      <aside
        className="glass flex flex-col p-4 border-r border-zinc-800 shrink-0 relative group"
        style={{ width: `${sidebarWidth}px` }}
      >
        {/* Branding */}
        <div className="flex items-center gap-3 mb-6 px-2">
          <div className="w-10 h-10 bg-gradient-to-tr from-purple-600 to-blue-500 rounded-xl shadow-lg shadow-blue-500/30 flex items-center justify-center text-xl">🔐</div>
          <div>
            <h1 className="heading-shimmer text-2xl font-black tracking-tighter leading-none"
            >QUERY VAULT</h1>
          </div>
        </div>

        {/* Username — plain, no box */}
        {username && (
          <p className="px-2 mb-6 text-sm font-black uppercase tracking-widest"
            style={{ color: '#a78bfa', textShadow: '0 0 10px rgba(167,139,250,0.6)' }}
          >{username}</p>
        )}

        <nav className="flex-1 space-y-2">
          <button
            onClick={() => setActiveTab('chat')}
            className={`w-full flex items-center gap-3 p-4 rounded-2xl transition-all ${activeTab === 'chat' ? 'bg-zinc-800/50 text-white border border-zinc-700' : 'text-zinc-500 hover:text-white hover:bg-zinc-900 border border-transparent'}`}
          >
            <MessageSquare size={20} />
            <span className="font-bold uppercase tracking-wider text-xs">📄 Document Chat</span>
          </button>
          <button
            onClick={() => setActiveTab('audio')}
            className={`w-full flex items-center gap-3 p-4 rounded-2xl transition-all ${activeTab === 'audio' ? 'bg-zinc-800/50 text-white border border-zinc-700' : 'text-zinc-500 hover:text-white hover:bg-zinc-900 border border-transparent'}`}
          >
            <Headphones size={20} />
            <span className="font-bold uppercase tracking-wider text-xs">🎙️ Audio Chat</span>
          </button>
        </nav>

        <div className="mt-auto pt-6 border-t border-zinc-800 space-y-4">
          <div className="p-4 bg-zinc-900/50 rounded-2xl border border-zinc-800">
            <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-3 font-bold px-1">🌐 Language</div>
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

        <div onMouseDown={() => setIsResizing(true)} className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-indigo-500/30 transition-colors z-50" />
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col relative overflow-hidden">

        {/* STICKY TOP HEADER */}
        <div className="sticky top-0 z-40 border-b bg-black/80 backdrop-blur-xl px-8 py-4 flex items-center gap-4"
          style={{ borderColor: 'rgba(99,102,241,0.4)', boxShadow: '0 1px 20px rgba(99,102,241,0.15)' }}
        >
          <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
          <h2 className="heading-shimmer text-3xl font-black tracking-tight flex-1">
            {activeTab === 'chat' ? '📄 Query Vault Document Chat' : '🎙️ Query Vault Audio Chat'}
          </h2>

          {/* ACTION TOOLBAR */}
          {currentMessages.length > 0 && (
            <div className="flex items-center gap-2">

              {/* DOWNLOAD */}
              <div className="relative">
                <button
                  onClick={() => { setShowDownloadMenu(p => !p); setShowShareMenu(false); }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500 transition-all text-xs font-bold"
                >
                  <Download size={14} /> Download
                </button>
                {showDownloadMenu && (
                  <div className="absolute right-0 top-12 bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl py-2 z-50 min-w-[140px]">
                    {([['txt', '📝 TXT'], ['json', '🗂️ JSON'], ['doc', '📄 DOC']] as const).map(([fmt, label]) => (
                      <button key={fmt} onClick={() => handleDownload(fmt)}
                        className="w-full text-left px-4 py-3 text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 transition-all font-semibold">
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* SHARE */}
              <div className="relative">
                <button
                  onClick={() => { setShowShareMenu(p => !p); setShowDownloadMenu(false); }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500 transition-all text-xs font-bold"
                >
                  <Share2 size={14} /> Share
                </button>
                {showShareMenu && (
                  <div className="absolute right-0 top-12 bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl py-2 z-50 min-w-[160px]">
                    <button onClick={() => handleShare('whatsapp')}
                      className="w-full text-left px-4 py-3 text-xs text-emerald-400 hover:bg-zinc-800 transition-all font-semibold flex items-center gap-2">
                      <MessageCircle size={14} /> WhatsApp
                    </button>
                    <button onClick={() => handleShare('gmail')}
                      className="w-full text-left px-4 py-3 text-xs text-rose-400 hover:bg-zinc-800 transition-all font-semibold flex items-center gap-2">
                      <Mail size={14} /> Gmail
                    </button>
                  </div>
                )}
              </div>

              {/* CLEAR */}
              <button
                onClick={handleClearChat}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 border border-red-900/40 text-red-400 hover:text-red-300 hover:border-red-700 transition-all text-xs font-bold"
              >
                <Trash2 size={14} /> Clear
              </button>
            </div>
          )}
        </div>

        {/* SCROLLABLE CHAT AREA */}
        <div
          ref={chatAreaRef}
          className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8 scroll-smooth pb-36 relative"
        >
          {/* Scroll to top / bottom floating buttons */}
          <div className="fixed right-8 bottom-36 flex flex-col gap-2 z-30">
            <button
              onClick={() => chatAreaRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
              title="Scroll to top"
              className="w-9 h-9 rounded-full bg-zinc-900/90 border border-zinc-700 text-zinc-400 hover:text-white hover:border-indigo-500 transition-all flex items-center justify-center shadow-xl text-base"
            >↑</button>
            <button
              onClick={() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' })}
              title="Scroll to bottom"
              className="w-9 h-9 rounded-full bg-zinc-900/90 border border-zinc-700 text-zinc-400 hover:text-white hover:border-cyan-500 transition-all flex items-center justify-center shadow-xl text-base"
            >↓</button>
          </div>

          {/* DOC UPLOAD BLOCK */}
          {activeTab === 'chat' && (
            <div className="max-w-4xl mx-auto w-full">
              <label className={`flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-3xl cursor-pointer transition-all ${isUploading ? 'border-purple-500 bg-purple-500/5' : isDocsLoaded ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-zinc-700 hover:border-purple-500/50 bg-zinc-900/20'}`}>
                {isUploading ? (
                  <><Loader2 className="animate-spin text-purple-400 mb-3" size={32} /><span className="text-purple-300 font-semibold">Indexing documents...</span></>
                ) : isDocsLoaded ? (
                  <><CheckCircle2 className="text-emerald-400 mb-3" size={32} /><span className="text-emerald-300 font-semibold">✅ Docs Loaded — Click to upload more</span></>
                ) : (
                  <><FileUp className="text-zinc-500 mb-3" size={32} /><span className="text-zinc-300 font-semibold">Click to upload documents</span><span className="text-zinc-600 text-xs mt-1">PDF, DOCX, TXT</span></>
                )}
                <input type="file" accept=".pdf,.doc,.docx,.txt" className="hidden" multiple onChange={handleFileSelect} disabled={isUploading} />
              </label>
            </div>
          )}

          {/* AUDIO UPLOAD BLOCK */}
          {activeTab === 'audio' && (
            <div className="max-w-4xl mx-auto w-full space-y-4">
              <label className={`flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-3xl cursor-pointer transition-all ${isAudioProcessing ? 'border-indigo-500 bg-indigo-500/5' : audioSessionId ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-zinc-700 hover:border-indigo-500/50 bg-zinc-900/20'}`}>
                {isAudioProcessing ? (
                  <><Loader2 className="animate-spin text-indigo-400 mb-3" size={32} /><span className="text-indigo-300 font-semibold">Transcribing...</span><span className="text-zinc-500 text-xs mt-1">This may take 10–30 seconds</span></>
                ) : audioSessionId ? (
                  <><CheckCircle2 className="text-emerald-400 mb-3" size={32} /><span className="text-emerald-300 font-semibold">✅ Audio Loaded — Click to upload another</span></>
                ) : (
                  <><UploadCloud className="text-zinc-500 mb-3" size={32} /><span className="text-zinc-300 font-semibold">Click to upload audio file</span><span className="text-zinc-600 text-xs mt-1">MP3, WAV, M4A, OGG, WEBM</span></>
                )}
                <input type="file" accept=".mp3,.wav,.m4a,.ogg,.webm" className="hidden" onChange={handleAudioFileSelect} disabled={isAudioProcessing} />
              </label>

              {/* Timestamp transcript accordion */}
              {audioSegments.length > 0 && (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
                  <button
                    onClick={() => setShowTranscript(p => !p)}
                    className="w-full flex items-center justify-between px-5 py-4 text-sm font-bold text-zinc-300 hover:text-white transition-colors"
                  >
                    <span>📄 Transcript with Timestamps</span>
                    <span className="text-zinc-500 text-xs">{showTranscript ? '▲ Hide' : '▼ Show'}</span>
                  </button>
                  {showTranscript && (
                    <div className="max-h-64 overflow-y-auto divide-y divide-zinc-800/50">
                      {audioSegments.map((seg, i) => (
                        <div key={i} className="flex gap-3 px-5 py-3 hover:bg-zinc-800/30 transition-colors">
                          <span className="text-[11px] font-mono text-cyan-500 shrink-0 pt-0.5">
                            {String(Math.floor(seg.start / 60)).padStart(2,'0')}:{String(Math.floor(seg.start % 60)).padStart(2,'0')}
                          </span>
                          <span className="text-sm text-zinc-300 leading-relaxed">{seg.text}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* CHAT MESSAGES */}
          {currentMessages.map((msg, idx) => (
            <div key={idx} className={`group flex flex-col max-w-4xl mx-auto w-full gap-1 ${msg.role === 'user' ? 'items-start' : 'items-end animate-in fade-in slide-in-from-bottom-2 duration-300'}`}>

              {/* Neon orbit wrapper */}
              <div className={`neon-orbit-wrap max-w-[80%] shadow-2xl ${
                msg.role === 'user' ? 'neon-orbit-user rounded-bl-none' : 'neon-orbit-bot rounded-br-none'
              }`}>
                <div className="neon-spinner" />
                <div className={`p-6 leading-relaxed ${
                  msg.role === 'user'
                    ? 'neon-orbit-inner-user text-indigo-50 rounded-bl-none'
                    : 'neon-orbit-inner-bot text-zinc-200 rounded-br-none'
                }`}>
                  <div className={`text-[10px] uppercase tracking-[0.3em] mb-3 font-black flex items-center gap-2 ${msg.role === 'user' ? 'text-indigo-400' : 'text-cyan-500'}`}>
                    {msg.role === 'user' ? `👤 ${username || 'You'}` : '🤖 Intelligence'}
                  </div>
                  <div className="text-base leading-relaxed">{renderText(msg.content)}</div>
                  {msg.audioUrl && (
                    <div className="mt-4 pt-4 border-t border-zinc-800/50">
                      <audio controls className="w-full h-8 accent-indigo-500 rounded-lg opacity-70 hover:opacity-100 transition-opacity" src={msg.audioUrl}>
                        Your browser does not support the audio element.
                      </audio>
                    </div>
                  )}
                </div>
              </div>

              {/* PER-BUBBLE ACTION ROW — appears on hover */}
              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 px-2">
                {msg.role === 'bot' ? (
                  // Bot bubble actions: Copy + Share dropdown
                  <BubbleShareMenu content={msg.content} />
                ) : (
                  // User bubble: Delete pair
                  <button
                    onClick={() => deletePair(idx)}
                    title="Delete this Q&A pair"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 border border-red-900/40 text-red-500 hover:text-red-300 hover:border-red-700 transition-all text-[11px] font-semibold"
                  >
                    <Trash2 size={11} /> Delete
                  </button>
                )}
              </div>
            </div>
          ))}

          {currentMessages.length === 0 && (
            <div className="max-w-4xl mx-auto w-full text-center py-10">
              <p className="text-zinc-500 text-lg font-medium">
                {activeTab === 'chat' ? '📂 Upload a document above, then start chatting below.' : '🎵 Upload an audio file above to begin.'}
              </p>
            </div>
          )}

          <div className="h-10" />
          <div ref={scrollRef} />
        </div>

        {/* REPLACE / ADD MODAL */}
        {showModeModal && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="glass border border-zinc-700 rounded-[2rem] p-8 max-w-sm w-full mx-4 shadow-2xl">
              <h3 className="text-xl font-black text-white mb-2">Upload Mode</h3>
              <p className="text-zinc-400 text-sm mb-6">You already have documents loaded. What would you like to do?</p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => pendingFiles && doUploadDocs(pendingFiles, 'replace')}
                  className="flex items-center gap-3 p-4 bg-rose-600/20 border border-rose-500/30 rounded-2xl text-rose-300 font-semibold hover:bg-rose-600/30 transition-all"
                >
                  <RefreshCw size={20} />
                  <div className="text-left">
                    <div className="font-bold">🔄 Replace Existing</div>
                    <div className="text-xs text-rose-400/70">Clear old documents and start fresh</div>
                  </div>
                </button>
                <button
                  onClick={() => pendingFiles && doUploadDocs(pendingFiles, 'add')}
                  className="flex items-center gap-3 p-4 bg-emerald-600/20 border border-emerald-500/30 rounded-2xl text-emerald-300 font-semibold hover:bg-emerald-600/30 transition-all"
                >
                  <PlusCircle size={20} />
                  <div className="text-left">
                    <div className="font-bold">➕ Add to Existing</div>
                    <div className="text-xs text-emerald-400/70">Keep old docs and add new ones</div>
                  </div>
                </button>
                <button
                  onClick={() => { setShowModeModal(false); setPendingFiles(null); }}
                  className="text-zinc-600 hover:text-zinc-400 text-sm mt-2 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* AUDIO REPLACE / ADD MODAL */}
        {showAudioModeModal && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="glass border border-zinc-700 rounded-[2rem] p-8 max-w-sm w-full mx-4 shadow-2xl">
              <h3 className="text-xl font-black text-white mb-2">Upload Audio Mode</h3>
              <p className="text-zinc-400 text-sm mb-6">You already have an audio session loaded. What would you like to do?</p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => pendingAudioFile && doUploadAudio(pendingAudioFile)}
                  className="flex items-center gap-3 p-4 bg-rose-600/20 border border-rose-500/30 rounded-2xl text-rose-300 font-semibold hover:bg-rose-600/30 transition-all"
                >
                  <RefreshCw size={20} />
                  <div className="text-left">
                    <div className="font-bold">🔄 Replace Existing</div>
                    <div className="text-xs text-rose-400/70">Clear old audio and start fresh</div>
                  </div>
                </button>
                <button
                  onClick={() => { setShowAudioModeModal(false); setPendingAudioFile(null); if (pendingAudioFile) doUploadAudio(pendingAudioFile); }}
                  className="flex items-center gap-3 p-4 bg-emerald-600/20 border border-emerald-500/30 rounded-2xl text-emerald-300 font-semibold hover:bg-emerald-600/30 transition-all"
                >
                  <PlusCircle size={20} />
                  <div className="text-left">
                    <div className="font-bold">➕ Keep &amp; Add New Session</div>
                    <div className="text-xs text-emerald-400/70">Load new audio into a new session</div>
                  </div>
                </button>
                <button
                  onClick={() => { setShowAudioModeModal(false); setPendingAudioFile(null); }}
                  className="text-zinc-600 hover:text-zinc-400 text-sm mt-2 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* INPUT BAR */}
        <div className="p-4 md:p-6">
          <div className="max-w-4xl mx-auto flex items-center gap-2 glass p-3 rounded-[3rem] border border-zinc-800/80">
            <button
              onClick={startListening}
              className={`p-4 rounded-full transition-all ${isListening ? 'bg-rose-500 text-white animate-pulse' : 'bg-zinc-900/80 text-zinc-500 hover:text-purple-400'}`}
            >
              {isListening ? <Square size={20} fill="white" /> : <Mic size={20} />}
            </button>
            <input
              type="text"
              placeholder={activeTab === 'chat' ? `Ask about your documents... (${language})` : audioSessionId ? "Ask about the audio content..." : "Upload an audio file first..."}
              className="flex-1 bg-transparent p-3 outline-none text-zinc-100 placeholder-zinc-700 text-lg"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              disabled={activeTab === 'audio' && !audioSessionId}
            />
            <button
              onClick={handleSendMessage}
              disabled={isLoading || (activeTab === 'audio' && !audioSessionId)}
              className="p-4 bg-gradient-to-tr from-purple-600 to-indigo-600 rounded-full shadow-2xl disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="animate-spin" size={22} /> : <Send size={22} />}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
