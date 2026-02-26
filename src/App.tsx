import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Sparkles, Search, Brain, Globe, Cpu, Star, ChevronRight, MessageSquare, MoreVertical, Pin, Trash2, Plus, PanelLeft, X, Image as ImageIcon, Zap, Loader2, Clock, LogIn, LogOut, Chrome, Facebook, Apple, User, Camera, Paperclip, FileText } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { askMagagalaxy, AGENTS, Agent, generateImage } from './services/geminiService';

declare global {
  interface Window {
    faceapi: any;
  }
}

const faceapi = typeof window !== 'undefined' ? window.faceapi : null;

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  thoughts?: string;
  imageUrl?: string;
  isMedia?: boolean;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  isPinned: boolean;
  createdAt: number;
}

export default function App() {
  const [input, setInput] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [isSuperMode, setIsSuperMode] = useState(false);
  const [showSuperTransition, setShowSuperTransition] = useState(false);
  const [isGeneratingMedia, setIsGeneratingMedia] = useState<'image' | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showLoginOverlay, setShowLoginOverlay] = useState(false);
  const [showBiometric, setShowBiometric] = useState(false);
  const [userAge, setUserAge] = useState<number | null>(null);
  const [user, setUser] = useState<any>(null);
  const [attachedFile, setAttachedFile] = useState<{ data: string; mimeType: string; name: string } | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const cameraCanvasRef = useRef<HTMLCanvasElement>(null);
  
  const [isThinking, setIsThinking] = useState(false);
  const [isWarping, setIsWarping] = useState(false);
  const [thinkingStep, setThinkingStep] = useState<number>(0);
  const [activeAgents, setActiveAgents] = useState<Agent[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const currentConversation = conversations.find(c => c.id === activeId);
  const messages = currentConversation?.messages || [];

  useEffect(() => {
    // Check auth status
    fetch('/api/user')
      .then(res => res.json())
      .then(data => {
        if (data.user) {
          setUser(data.user);
          setShowLoginOverlay(false);
          // Check if age is already verified (using localStorage for persistence in this demo)
          const savedAge = localStorage.getItem('magagalaxy_user_age');
          if (savedAge) {
            setUserAge(parseInt(savedAge));
            setShowBiometric(false);
          } else {
            setShowBiometric(true);
          }
        } else {
          setShowLoginOverlay(true);
        }
      });

    // Listen for OAuth success
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        setUser(event.data.user);
        setShowLoginOverlay(false);
        const savedAge = localStorage.getItem('magagalaxy_user_age');
        if (savedAge) {
          setUserAge(parseInt(savedAge));
        } else {
          setShowBiometric(true);
        }
      }
    };
    window.addEventListener('message', handleMessage);

    // Load initial conversation if none exists
    const timer = setTimeout(() => setIsLoading(false), 2500);
    
    if (conversations.length === 0) {
      const newId = crypto.randomUUID();
      setConversations([{
        id: newId,
        title: 'Nova Conversa',
        messages: [],
        isPinned: false,
        createdAt: Date.now()
      }]);
      setActiveId(newId);
    }
    return () => {
      clearTimeout(timer);
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isThinking]);

  const createNewConversation = () => {
    const newId = crypto.randomUUID();
    const newConv: Conversation = {
      id: newId,
      title: 'Nova Conversa',
      messages: [],
      isPinned: false,
      createdAt: Date.now()
    };
    setConversations(prev => [newConv, ...prev]);
    setActiveId(newId);
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const deleteConversation = (id: string) => {
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeId === id) {
      const remaining = conversations.filter(c => c.id !== id);
      setActiveId(remaining.length > 0 ? remaining[0].id : null);
    }
    setMenuOpenId(null);
  };

  const togglePin = (id: string) => {
    setConversations(prev => prev.map(c => 
      c.id === id ? { ...c, isPinned: !c.isPinned } : c
    ));
    setMenuOpenId(null);
  };

  const toggleSuperMode = () => {
    setShowSuperTransition(true);
    setIsSuperMode(!isSuperMode);
    setTimeout(() => setShowSuperTransition(false), 800);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isThinking || !activeId) return;

    const userMessage = input;
    const currentAttachedFile = attachedFile;
    setInput('');
    setAttachedFile(null);
    setIsWarping(true);
    setTimeout(() => setIsWarping(false), 600);
    
    // Update messages and title if it's the first message
    setConversations(prev => prev.map(c => {
      if (c.id === activeId) {
        const newMessages: Message[] = [...c.messages, { 
          role: 'user', 
          content: userMessage,
          imageUrl: currentAttachedFile?.mimeType.startsWith('image/') ? currentAttachedFile.data : undefined
        }];
        return {
          ...c,
          messages: newMessages,
          title: c.messages.length === 0 ? userMessage.slice(0, 30) + (userMessage.length > 30 ? '...' : '') : c.title
        };
      }
      return c;
    }));

    setIsThinking(true);
    setThinkingStep(1);

    // Simulate thinking steps
    const stepInterval = setInterval(() => {
      setThinkingStep(prev => (prev < 4 ? prev + 1 : prev));
    }, 1200);

    // Simulate agent activation
    const interval = setInterval(() => {
      setActiveAgents(prev => {
        const next = [...prev];
        const idleAgents = AGENTS.filter(a => !next.find(na => na.id === a.id));
        if (idleAgents.length > 0) {
          const randomAgent = idleAgents[Math.floor(Math.random() * idleAgents.length)];
          const limit = isSuperMode ? 24 : 12;
          return [...next, { ...randomAgent, status: 'active' as const }].slice(-limit);
        }
        return next;
      });
    }, isSuperMode ? 200 : 400);

    try {
      const response = await askMagagalaxy(
        userMessage, 
        userAge || undefined,
        currentAttachedFile?.mimeType.startsWith('image/') ? { data: currentAttachedFile.data, mimeType: currentAttachedFile.mimeType } : undefined
      );
      
      setConversations(prev => prev.map(c => {
        if (c.id === activeId) {
          return {
            ...c,
            messages: [...c.messages, { 
              role: 'assistant', 
              content: response.text || "Desculpe, não consegui processar sua solicitação.",
              thoughts: response.candidates?.[0]?.groundingMetadata?.searchEntryPoint?.renderedContent
            }]
          };
        }
        return c;
      }));
    } catch (error) {
      setConversations(prev => prev.map(c => {
        if (c.id === activeId) {
          return {
            ...c,
            messages: [...c.messages, { role: 'assistant', content: "Erro ao conectar com a galáxia de IAs. Verifique sua conexão." }]
          };
        }
        return c;
      }));
    } finally {
      clearInterval(interval);
      clearInterval(stepInterval);
      setIsThinking(false);
      setThinkingStep(0);
      setActiveAgents([]);
    }
  };

  const handleLogin = async (provider: string) => {
    try {
      const res = await fetch(`/api/auth/${provider}/url`);
      const { url } = await res.json();
      window.open(url, 'oauth_popup', 'width=600,height=700');
    } catch (err) {
      console.error('Login error:', err);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const data = event.target?.result as string;
      setAttachedFile({
        data,
        mimeType: file.type,
        name: file.name
      });
    };
    reader.readAsDataURL(file);
  };

  const openCamera = async () => {
    setShowCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      setShowCamera(false);
    }
  };

  const capturePhoto = () => {
    if (cameraVideoRef.current && cameraCanvasRef.current) {
      const video = cameraVideoRef.current;
      const canvas = cameraCanvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(video, 0, 0);
      const data = canvas.toDataURL('image/png');
      setAttachedFile({
        data,
        mimeType: 'image/png',
        name: 'camera_photo.png'
      });
      closeCamera();
    }
  };

  const closeCamera = () => {
    if (cameraVideoRef.current?.srcObject) {
      const stream = cameraVideoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    setShowCamera(false);
  };

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    setUser(null);
    setUserAge(null);
    localStorage.removeItem('magagalaxy_user_age');
    setShowLoginOverlay(true);
  };

  const handleMediaGeneration = async (type: 'image') => {
    if (!input.trim() || isThinking || !activeId) return;
    
    const prompt = input;
    setInput('');
    setIsGeneratingMedia(type);

    setConversations(prev => prev.map(c => {
      if (c.id === activeId) {
        return {
          ...c,
          messages: [...c.messages, { role: 'user', content: `Gerar imagem: ${prompt}` }]
        };
      }
      return c;
    }));

    try {
      const mediaUrl = await generateImage(prompt);

      setConversations(prev => prev.map(c => {
        if (c.id === activeId) {
          return {
            ...c,
            messages: [...c.messages, { 
              role: 'assistant', 
              content: `Aqui está a sua imagem gerada pelo Super-Magagalaxy.`,
              imageUrl: mediaUrl,
              isMedia: true
            }]
          };
        }
        return c;
      }));
    } catch (error) {
      setConversations(prev => prev.map(c => {
        if (c.id === activeId) {
          return {
            ...c,
            messages: [...c.messages, { role: 'assistant', content: `Erro ao gerar imagem.` }]
          };
        }
        return c;
      }));
    } finally {
      setIsGeneratingMedia(null);
    }
  };

  const sortedConversations = [...conversations].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return b.createdAt - a.createdAt;
  });

  return (
    <div className="relative min-h-screen flex bg-galaxy-bg overflow-hidden font-sans">
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.1, filter: 'blur(20px)' }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center overflow-hidden"
          >
            <div className="absolute inset-0 cosmic-gradient opacity-40" />
            <div className="absolute inset-0 star-field" />
            
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ 
                duration: 1, 
                ease: "easeOut",
                type: "spring",
                stiffness: 100
              }}
              className="relative z-10 flex flex-col items-center gap-8"
            >
              <div className="relative">
                <motion.div
                  animate={{ 
                    rotate: 360,
                    scale: [1, 1.1, 1],
                  }}
                  transition={{ 
                    rotate: { duration: 20, repeat: Infinity, ease: "linear" },
                    scale: { duration: 4, repeat: Infinity, ease: "easeInOut" }
                  }}
                  className="w-32 h-32 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 flex items-center justify-center"
                >
                  <Star className="w-16 h-16 text-indigo-400 fill-indigo-400 animate-pulse" />
                </motion.div>
                <div className="absolute -inset-8 bg-indigo-500/20 blur-3xl rounded-full animate-pulse" />
              </div>
              
              <div className="flex flex-col items-center gap-2">
                <motion.h1 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="text-5xl font-display font-black text-white tracking-tighter"
                >
                  MAGAGALAXY
                </motion.h1>
                <motion.p 
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.7 }}
                  className="text-indigo-400 text-xs uppercase tracking-[0.5em] font-bold"
                >
                  Iniciando Sistemas Galácticos
                </motion.p>
              </div>
            </motion.div>

            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: "200px" }}
              transition={{ duration: 2, ease: "easeInOut" }}
              className="absolute bottom-20 h-1 bg-indigo-500 rounded-full shadow-[0_0_15px_rgba(99,102,241,0.5)]"
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCamera && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-4"
          >
            <div className="relative max-w-md w-full aspect-video bg-zinc-900 rounded-3xl overflow-hidden border border-white/10">
              <video ref={cameraVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
              <canvas ref={cameraCanvasRef} className="hidden" />
              
              <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-6">
                <button
                  onClick={closeCamera}
                  className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white"
                >
                  <X className="w-6 h-6" />
                </button>
                <button
                  onClick={capturePhoto}
                  className="w-16 h-16 rounded-full bg-white flex items-center justify-center text-black shadow-2xl scale-110 active:scale-95 transition-transform"
                >
                  <div className="w-12 h-12 rounded-full border-2 border-black" />
                </button>
              </div>
            </div>
            <p className="mt-6 text-slate-400 text-sm font-medium uppercase tracking-widest">Capture sua imagem</p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showBiometric && (
          <BiometricVerification 
            onComplete={(age) => {
              setUserAge(age);
              localStorage.setItem('magagalaxy_user_age', age.toString());
              setShowBiometric(false);
            }} 
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showLoginOverlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-2xl flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="max-w-md w-full bg-zinc-900/50 border border-white/10 rounded-3xl p-8 flex flex-col items-center text-center space-y-8 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute inset-0 cosmic-gradient opacity-10 pointer-events-none" />
              
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
                  <Star className="w-10 h-10 text-indigo-400 fill-indigo-400" />
                </div>
                <div className="absolute -inset-4 bg-indigo-500/20 blur-2xl rounded-full -z-10 animate-pulse" />
              </div>

              <div className="space-y-2">
                <h2 className="text-3xl font-display font-bold text-white tracking-tight">Acesse a Galáxia</h2>
                <p className="text-slate-400 text-sm">
                  Conecte-se para desbloquear o poder total do Magagalaxy e do Super Mode ilimitado.
                </p>
              </div>

              <div className="w-full space-y-3">
                <button
                  onClick={() => handleLogin('google')}
                  className="w-full py-4 px-6 rounded-2xl bg-white text-black font-bold flex items-center justify-center gap-3 hover:bg-slate-200 transition-all active:scale-[0.98]"
                >
                  <Chrome className="w-5 h-5" />
                  Continuar com Google
                </button>
                <button
                  onClick={() => handleLogin('facebook')}
                  className="w-full py-4 px-6 rounded-2xl bg-[#1877F2] text-white font-bold flex items-center justify-center gap-3 hover:bg-[#166fe5] transition-all active:scale-[0.98]"
                >
                  <Facebook className="w-5 h-5 fill-current" />
                  Continuar com Facebook
                </button>
                <button
                  onClick={() => handleLogin('apple')}
                  className="w-full py-4 px-6 rounded-2xl bg-black border border-white/20 text-white font-bold flex items-center justify-center gap-3 hover:bg-zinc-800 transition-all active:scale-[0.98]"
                >
                  <Apple className="w-5 h-5 fill-current" />
                  Continuar com Apple
                </button>

                <div className="pt-2">
                  <button
                    onClick={() => setShowLoginOverlay(false)}
                    className="text-slate-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors"
                  >
                    Continuar sem login
                  </button>
                </div>
              </div>

              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                Seguro • Galáctico • Ilimitado
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background Effects */}
      <div className={cn(
        "fixed inset-0 transition-colors duration-1000 pointer-events-none",
        isSuperMode ? "bg-rose-950/20" : "cosmic-gradient"
      )} />
      <motion.div 
        animate={{ 
          x: [0, -20, 0],
          y: [0, -10, 0]
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        className="fixed inset-0 star-field opacity-20 pointer-events-none" 
      />
      
      <AnimatePresence>
        {isWarping && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 pointer-events-none overflow-hidden"
          >
            {Array.from({ length: 20 }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ x: "50%", y: "50%", scale: 0, opacity: 1 }}
                animate={{ 
                  x: `${Math.random() * 200 - 50}%`, 
                  y: `${Math.random() * 200 - 50}%`, 
                  scale: 2, 
                  opacity: 0 
                }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className={cn(
                  "absolute w-1 h-32 rounded-full blur-[2px]",
                  isSuperMode ? "bg-rose-400" : "bg-indigo-400"
                )}
                style={{ rotate: `${Math.random() * 360}deg` }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSuperTransition && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={cn(
              "fixed inset-0 z-[60] pointer-events-none flex items-center justify-center",
              isSuperMode ? "bg-rose-500/20" : "bg-indigo-500/20"
            )}
          >
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 2, rotate: 0 }}
              className={cn(
                "w-96 h-96 rounded-full blur-[100px]",
                isSuperMode ? "bg-rose-500" : "bg-indigo-500"
              )}
            />
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative z-10 text-4xl font-black text-white tracking-widest italic text-center px-4"
            >
              {isSuperMode ? "SUPER MODE ACTIVATED" : "NORMAL MODE"}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {isSuperMode && (
        <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(244,63,94,0.1),transparent_70%)] pointer-events-none animate-pulse" />
      )}

      {/* Sidebar */}
      <AnimatePresence mode="wait">
        {isSidebarOpen && (
          <motion.aside
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            className="relative z-30 w-72 border-r border-white/10 bg-black/60 backdrop-blur-xl flex flex-col"
          >
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Star className={cn(
                  "w-5 h-5 transition-colors duration-500",
                  isSuperMode ? "text-rose-400 fill-rose-400" : "text-indigo-400 fill-indigo-400"
                )} />
                <span className={cn(
                  "font-display font-bold tracking-tight transition-colors duration-500",
                  isSuperMode ? "text-rose-100" : "text-white"
                )}>
                  {isSuperMode ? "SUPER-MAGAGALAXY" : "MAGAGALAXY"}
                </span>
              </div>
              <button 
                onClick={() => setIsSidebarOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 md:hidden"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-2">
              <button
                onClick={createNewConversation}
                className={cn(
                  "w-full py-3 px-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white text-sm font-medium flex items-center justify-center gap-2 transition-all group active:scale-95",
                  isSuperMode ? "hover:border-rose-500/30" : "hover:border-indigo-500/30"
                )}
              >
                <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" />
                Nova Conversa
              </button>

              <button
                onClick={toggleSuperMode}
                className={cn(
                  "w-full py-3 px-4 rounded-xl border transition-all duration-500 text-sm font-bold flex items-center justify-center gap-2",
                  isSuperMode 
                    ? "bg-rose-500/20 border-rose-500/50 text-rose-400 shadow-[0_0_25px_rgba(244,63,94,0.3)] animate-pulse" 
                    : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
                )}
              >
                <Zap className={cn("w-4 h-4 transition-colors", isSuperMode && "fill-rose-400")} />
                {isSuperMode ? "SUPER MODE ON" : "ATIVAR SUPER MODE"}
              </button>

              {user ? (
                <>
                  <div className={cn(
                    "p-3 rounded-xl border flex items-center gap-3 transition-all duration-500",
                    isSuperMode ? "bg-rose-500/10 border-rose-500/20" : "bg-indigo-500/10 border-indigo-500/20"
                  )}>
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center border",
                      isSuperMode ? "bg-rose-500/20 border-rose-500/30 text-rose-400" : "bg-indigo-500/20 border-indigo-500/30 text-indigo-400"
                    )}>
                      <User className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-white truncate">{user.name}</p>
                      <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
                    </div>
                    <button 
                      onClick={handleLogout}
                      className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  </div>
                  <button
                    onClick={() => setShowBiometric(true)}
                    className={cn(
                      "w-full mt-2 py-2 px-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center justify-center gap-2 transition-all",
                      isSuperMode ? "hover:border-rose-500/30" : "hover:border-indigo-500/30"
                    )}
                  >
                    <User className="w-3 h-3" />
                    Refazer Biometria
                  </button>
                </>
              ) : (
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 px-1">Entrar na Galáxia</p>
                  <div className="grid grid-cols-3 gap-2">
                    <button 
                      onClick={() => handleLogin('google')}
                      className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all flex items-center justify-center group"
                    >
                      <Chrome className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
                    </button>
                    <button 
                      onClick={() => handleLogin('facebook')}
                      className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all flex items-center justify-center group"
                    >
                      <Facebook className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
                    </button>
                    <button 
                      onClick={() => handleLogin('apple')}
                      className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all flex items-center justify-center group"
                    >
                      <Apple className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-2 space-y-1 custom-scrollbar">
              <AnimatePresence mode="popLayout">
                {sortedConversations.map((conv, idx) => (
                  <motion.div 
                    key={conv.id} 
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ delay: idx * 0.05 }}
                    className="relative group"
                  >
                    <div
                      onClick={() => setActiveId(conv.id)}
                      className={cn(
                        "w-full text-left p-3 rounded-xl flex items-center gap-3 transition-all duration-300 group/item cursor-pointer border border-transparent",
                        activeId === conv.id 
                          ? isSuperMode 
                            ? "bg-rose-600/20 border-rose-500/30 text-white shadow-[0_0_15px_rgba(244,63,94,0.15)]"
                            : "bg-indigo-600/20 border-indigo-500/30 text-white shadow-[0_0_15px_rgba(99,102,241,0.1)]" 
                          : "text-slate-400 hover:bg-white/5 hover:border-white/5"
                      )}
                    >
                      <MessageSquare className={cn(
                        "w-4 h-4 flex-shrink-0 transition-all duration-300", 
                        activeId === conv.id 
                          ? isSuperMode ? "text-rose-400 scale-110" : "text-indigo-400 scale-110" 
                          : "text-slate-500"
                      )} />
                      <span className="text-xs font-medium truncate flex-1">{conv.title}</span>
                      {conv.isPinned && <Pin className={cn(
                        "w-3 h-3 fill-current animate-in fade-in zoom-in duration-300",
                        isSuperMode ? "text-rose-400" : "text-indigo-400"
                      )} />}
                      
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpenId(menuOpenId === conv.id ? null : conv.id);
                          }}
                          className="p-1 rounded-md hover:bg-white/10 opacity-0 group-hover/item:opacity-100 transition-all duration-300"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        <AnimatePresence>
                          {menuOpenId === conv.id && (
                            <motion.div 
                              initial={{ opacity: 0, scale: 0.9, y: -10 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.9, y: -10 }}
                              className="absolute right-0 top-full mt-1 w-32 bg-zinc-900 border border-white/10 rounded-lg shadow-2xl z-50 py-1 overflow-hidden"
                            >
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  togglePin(conv.id);
                                }}
                                className="w-full px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-slate-300 hover:bg-white/5 flex items-center gap-2 transition-colors"
                              >
                                <Pin className="w-3 h-3" />
                                {conv.isPinned ? 'Desafixar' : 'Fixar'}
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteConversation(conv.id);
                                }}
                                className="w-full px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition-colors"
                              >
                                <Trash2 className="w-3 h-3" />
                                Excluir
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col relative min-w-0">
        {/* Header */}
        <header className="relative z-10 border-b border-white/10 bg-black/40 backdrop-blur-md px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {!isSidebarOpen && (
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 rounded-lg hover:bg-white/5 text-slate-400 mr-2"
              >
                <PanelLeft className="w-5 h-5" />
              </button>
            )}
            <div className="flex flex-col">
              <h1 className="font-display font-bold text-lg tracking-tight text-white leading-none">
                {currentConversation?.title || (isSuperMode ? 'SUPER-MAGAGALAXY' : 'MAGAGALAXY')}
              </h1>
              <p className={cn(
                "text-[10px] uppercase tracking-[0.2em] font-semibold mt-1 transition-colors duration-500",
                isSuperMode ? "text-rose-400" : "text-indigo-400"
              )}>
                {isSuperMode ? "Orquestrador de 87+ IAs (Premium)" : "Orquestrador de 50+ IAs"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs font-medium text-slate-400">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/5 bg-white/5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Sistemas Online
            </div>
          </div>
        </header>

        {/* Chat Area */}
        <main className="relative z-10 flex-1 flex flex-col max-w-5xl mx-auto w-full px-4 py-8 overflow-hidden">
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto space-y-8 pr-2 custom-scrollbar"
        >
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-6 py-20">
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ 
                  scale: 1, 
                  opacity: 1,
                  rotate: isSuperMode ? [0, 5, -5, 0] : 0
                }}
                transition={{ 
                  rotate: { duration: 4, repeat: Infinity, ease: "easeInOut" }
                }}
                className="w-24 h-24 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center relative"
              >
                <Sparkles className={cn(
                  "w-12 h-12 transition-colors duration-500",
                  isSuperMode ? "text-rose-400" : "text-indigo-400"
                )} />
                <div className={cn(
                  "absolute -inset-4 blur-3xl rounded-full -z-10 transition-colors duration-500",
                  isSuperMode ? "bg-rose-500/20" : "bg-indigo-500/20"
                )} />
              </motion.div>
              <div className="space-y-2">
                <h2 className="text-3xl font-display font-bold text-white">Bem-vindo à Magagalaxy</h2>
                <p className="text-slate-400 max-w-md mx-auto">
                  Faça qualquer pergunta. Eu vou pesquisar, pensar e consultar minha galáxia de agentes especializados para você.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl">
                {[
                  "Como funciona a fusão nuclear?",
                  "Me conte a história da computação quântica",
                  "Quais as tendências de IA para 2026?",
                  "Explique a teoria da relatividade para uma criança"
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setInput(suggestion)}
                    className="p-4 rounded-2xl border border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all text-left group"
                  >
                    <p className="text-sm text-slate-300 group-hover:text-white transition-colors">{suggestion}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20, scale: 0.95, filter: 'blur(10px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              transition={{ 
                type: "spring", 
                stiffness: 100, 
                damping: 15,
                delay: 0.1
              }}
              className={cn(
                "flex gap-4",
                msg.role === 'user' ? "justify-end" : "justify-start"
              )}
            >
              <div className={cn(
                "max-w-[85%] rounded-2xl p-4 transition-all duration-500 relative overflow-hidden group/msg",
                msg.role === 'user' 
                  ? isSuperMode 
                    ? "bg-rose-600 text-white shadow-lg shadow-rose-600/20"
                    : "bg-indigo-600 text-white shadow-lg shadow-indigo-600/10" 
                  : msg.isMedia 
                    ? isSuperMode
                      ? "bg-rose-500/10 border border-rose-500/30 shadow-[0_0_30px_rgba(244,63,94,0.15)]"
                      : "bg-amber-500/10 border border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.05)]"
                    : isSuperMode
                      ? "bg-pink-600/10 border border-pink-500/30 shadow-[0_0_25px_rgba(236,72,153,0.1)]"
                      : "bg-purple-600/10 border border-purple-500/30 shadow-[0_0_20px_rgba(168,85,247,0.05)]"
              )}>
                {/* Shine effect for assistant messages */}
                {msg.role === 'assistant' && (
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover/msg:translate-x-full transition-transform duration-1000" />
                )}

                {msg.role === 'assistant' && (
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/5 relative z-10">
                    {msg.isMedia 
                      ? <Zap className={cn("w-4 h-4", isSuperMode ? "text-rose-400" : "text-amber-400")} /> 
                      : <Brain className={cn("w-4 h-4", isSuperMode ? "text-pink-400" : "text-purple-400")} />
                    }
                    <span className={cn(
                      "text-[10px] uppercase tracking-widest font-bold",
                      msg.isMedia 
                        ? isSuperMode ? "text-rose-400" : "text-amber-400" 
                        : isSuperMode ? "text-pink-400" : "text-purple-400"
                    )}>
                      {msg.isMedia ? "Super-Magagalaxy Media" : "Resposta da Galáxia"}
                    </span>
                  </div>
                )}
                <div className="markdown-body relative z-10">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
                {msg.imageUrl && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="mt-4 rounded-xl overflow-hidden border border-white/10 relative group/img"
                  >
                    <img src={msg.imageUrl} alt="Generated" className="w-full h-auto transition-transform duration-500 group-hover/img:scale-105" />
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                      <ImageIcon className="w-8 h-8 text-white/50" />
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          ))}

          {isThinking && (
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="max-w-[85%] rounded-2xl p-5 bg-white/5 border border-white/10 w-full backdrop-blur-sm">
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          <div className={cn(
                            "w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:-0.3s]",
                            isSuperMode ? "bg-rose-400" : "bg-indigo-400"
                          )} />
                          <div className={cn(
                            "w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:-0.15s]",
                            isSuperMode ? "bg-rose-400" : "bg-indigo-400"
                          )} />
                          <div className={cn(
                            "w-1.5 h-1.5 rounded-full animate-bounce",
                            isSuperMode ? "bg-rose-400" : "bg-indigo-400"
                          )} />
                        </div>
                        <span className={cn(
                          "text-[10px] uppercase tracking-widest font-bold",
                          isSuperMode ? "text-rose-400" : "text-indigo-400"
                        )}>Processamento Galáctico</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        STEP_0{thinkingStep}/04
                      </div>
                    </div>

                    {/* Thinking Steps Flow */}
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { icon: MessageSquare, label: "Analisar" },
                        { icon: Search, label: "Pesquisar" },
                        { icon: Brain, label: "Sintetizar" },
                        { icon: Sparkles, label: "Formular" }
                      ].map((step, idx) => {
                        const stepNum = idx + 1;
                        const isActive = thinkingStep === stepNum;
                        const isCompleted = thinkingStep > stepNum;
                        
                        return (
                          <div key={idx} className="flex flex-col items-center gap-2">
                            <div className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300",
                              isActive 
                                ? isSuperMode 
                                  ? "bg-rose-500 text-white scale-110 shadow-[0_0_20px_rgba(244,63,94,0.5)]"
                                  : "bg-indigo-500 text-white scale-110 shadow-[0_0_15px_rgba(99,102,241,0.4)]" 
                                : isCompleted ? "bg-emerald-500/20 text-emerald-400" : "bg-white/5 text-slate-600"
                            )}>
                              <step.icon className="w-4 h-4" />
                            </div>
                            <span className={cn(
                              "text-[8px] uppercase tracking-tighter font-bold transition-colors",
                              isActive 
                                ? isSuperMode ? "text-rose-400" : "text-indigo-400" 
                                : isCompleted ? "text-emerald-500/60" : "text-slate-700"
                            )}>
                              {step.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    
                    <div className="h-px bg-white/5 w-full" />

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      <AnimatePresence mode="popLayout">
                        {activeAgents.map((agent, idx) => (
                          <motion.div
                            key={agent.id}
                            initial={{ opacity: 0, scale: 0.5, x: -20 }}
                            animate={{ opacity: 1, scale: 1, x: 0 }}
                            exit={{ opacity: 0, scale: 0.5, x: 20 }}
                            transition={{ 
                              type: "spring",
                              stiffness: 200,
                              damping: 20
                            }}
                            className="p-1.5 rounded-lg bg-white/5 border border-white/5 flex items-center gap-2"
                          >
                            <motion.div 
                              animate={{ 
                                scale: [1, 1.5, 1],
                                opacity: [0.5, 1, 0.5]
                              }}
                              transition={{ duration: 2, repeat: Infinity, delay: idx * 0.1 }}
                              className={cn(
                                "w-1.5 h-1.5 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.5)]",
                                isSuperMode ? "bg-rose-500" : "bg-indigo-500"
                              )} 
                            />
                            <div className="min-w-0">
                              <p className="text-[9px] font-bold text-white truncate">{agent.name}</p>
                              <p className="text-[7px] text-slate-500 truncate leading-none">{agent.specialty}</p>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="mt-8 space-y-4">
          {attachedFile && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 p-2 rounded-xl bg-white/5 border border-white/10"
            >
              {attachedFile.mimeType.startsWith('image/') ? (
                <img src={attachedFile.data} alt="Preview" className="w-12 h-12 rounded-lg object-cover" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-indigo-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate">{attachedFile.name}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest">{attachedFile.mimeType}</p>
              </div>
              <button 
                onClick={() => setAttachedFile(null)}
                className="p-2 rounded-lg hover:bg-white/10 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {isSuperMode && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 p-2 rounded-2xl bg-rose-500/5 border border-rose-500/20"
            >
              <div className="flex-1 flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                <button
                  onClick={() => handleMediaGeneration('image')}
                  disabled={isGeneratingMedia !== null || !input.trim()}
                  className={cn(
                    "flex-shrink-0 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 border transition-all disabled:opacity-50 active:scale-95",
                    isSuperMode 
                      ? "bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/20"
                      : "bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border-indigo-500/20"
                  )}
                >
                  {isGeneratingMedia === 'image' ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImageIcon className="w-3 h-3" />}
                  Gerar Imagem
                </button>
                
                <div className="h-8 w-px bg-white/5 self-center" />
                
                <div className="flex items-center gap-2 text-[10px] text-rose-400 font-bold px-2">
                  <Clock className="w-3 h-3" />
                  Geração Premium Ativa
                </div>
              </div>
            </motion.div>
          )}

          <form 
            onSubmit={handleSubmit}
            className="relative group"
          >
            <div className={cn(
              "absolute -inset-1 rounded-2xl blur opacity-20 group-focus-within:opacity-40 transition-all duration-500",
              isSuperMode ? "bg-gradient-to-r from-rose-500 to-pink-600" : "bg-gradient-to-r from-indigo-500 to-purple-600"
            )} />
            <div className="relative flex items-center bg-black/60 border border-white/10 rounded-2xl p-2 backdrop-blur-xl">
              <div className="flex items-center gap-1 pl-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 rounded-xl hover:bg-white/5 text-slate-500 transition-colors"
                  title="Anexar arquivo ou foto"
                >
                  <Paperclip className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={openCamera}
                  className="p-2 rounded-xl hover:bg-white/5 text-slate-500 transition-colors"
                  title="Tirar foto"
                >
                  <Camera className="w-5 h-5" />
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  className="hidden" 
                  accept="image/*,application/pdf,text/*"
                />
              </div>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isSuperMode ? "O que o Super-Magagalaxy pode criar para você?" : "Pergunte qualquer coisa à Magagalaxy..."}
                className="flex-1 bg-transparent border-none focus:ring-0 text-white placeholder-slate-500 py-3"
              />
              <button
                type="submit"
                disabled={!input.trim() || isThinking || !activeId}
                className={cn(
                  "p-3 rounded-xl transition-all flex items-center justify-center",
                  input.trim() && !isThinking && activeId
                    ? isSuperMode
                      ? "bg-rose-600 text-white hover:bg-rose-500 shadow-lg shadow-rose-600/30"
                      : "bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-600/20" 
                    : "bg-white/5 text-slate-600 cursor-not-allowed"
                )}
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </form>
          <div className="mt-4 flex items-center justify-center gap-6">
            <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium uppercase tracking-wider">
              <Globe className="w-3 h-3" /> Pesquisa em Tempo Real
            </div>
            <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium uppercase tracking-wider">
              <Cpu className="w-3 h-3" /> 50+ Agentes Especializados
            </div>
            <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium uppercase tracking-wider">
              <Brain className="w-3 h-3" /> Raciocínio Profundo
            </div>
          </div>
        </div>
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}} />

      {/* Close menu on click outside */}
      {menuOpenId && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setMenuOpenId(null)}
        />
      )}
    </div>
  </div>
  );
}

function BiometricVerification({ onComplete }: { onComplete: (age: number) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState("SISTEMA OFF");
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [detected, setDetected] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const [finalAgeRange, setFinalAgeRange] = useState("--");
  const [detectedAge, setDetectedAge] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let interval: any;

    const setup = async () => {
      try {
        if (!faceapi) {
          setStatus("ERRO: BIBLIOTECA OFF");
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
        if (videoRef.current) videoRef.current.srcObject = stream;
        
        const MODELS_URL = 'https://raw.githubusercontent.com/vladmandic/face-api/master/model/';
        setStatus("CARREGANDO BIOMETRIA...");
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_URL);
        await faceapi.nets.ageGenderNet.loadFromUri(MODELS_URL);
        
        setStatus("BIOMETRIA ATIVA");
        
        interval = setInterval(async () => {
          if (isScanning || showDrawer || !videoRef.current) return;
          const detection = await faceapi.detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions());
          if (detection) {
            setDetected(true);
            setStatus("USUÁRIO DETECTADO");
          } else {
            setDetected(false);
            setStatus("AGUARDANDO ROSTO");
          }
        }, 1000);

      } catch (e) {
        console.error(e);
        setError("ACESSO À CÂMERA NEGADO");
        setStatus("ERRO: HARDWARE OFF");
      }
    };

    setup();

    return () => {
      clearInterval(interval);
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
      }
    };
  }, [isScanning, showDrawer]);

  const startScan = async () => {
    if (!detected || isScanning) return;
    setIsScanning(true);
    setStatus("MAPEANDO TRAÇOS NEURAIS...");
    
    let collectedAges: number[] = [];
    let currentProgress = 0;

    const progressInterval = setInterval(() => {
      currentProgress += 1.25; // 8 seconds total (100 / 80 steps of 100ms)
      setProgress(Math.min(currentProgress, 100));
    }, 100);

    const scanInt = setInterval(async () => {
      if (!videoRef.current) return;
      const res = await faceapi.detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions()).withAgeAndGender();
      if (res) collectedAges.push(res.age);
    }, 1500);

    setTimeout(() => {
      clearInterval(progressInterval);
      clearInterval(scanInt);
      const finalAge = collectedAges.length > 0 
        ? Math.round(collectedAges.reduce((a, b) => a + b) / collectedAges.length) 
        : 18;
      
      setDetectedAge(finalAge);
      setFinalAgeRange(`${finalAge-1}-${finalAge+1}`);
      setIsScanning(false);
      setShowDrawer(true);
    }, 8000);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[90] bg-black flex items-center justify-center overflow-hidden"
    >
      <div className={cn(
        "w-full max-w-[360px] text-center relative transition-all duration-500",
        detected && "active-scan",
        showDrawer && "scale-90 -translate-y-10"
      )}>
        {/* HUD Corners */}
        <div className="absolute w-[220px] h-[220px] left-1/2 top-0 -translate-x-1/2 pointer-events-none z-10">
          <div className={cn("absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 transition-all duration-400", detected ? "border-purple-500 opacity-100 w-8 h-8" : "border-purple-500/30 opacity-30")} />
          <div className={cn("absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 transition-all duration-400", detected ? "border-purple-500 opacity-100 w-8 h-8" : "border-purple-500/30 opacity-30")} />
        </div>

        <div className={cn(
          "w-[220px] h-[220px] mx-auto mb-8 rounded-full border-2 overflow-hidden relative bg-black transition-all duration-500",
          detected ? "border-purple-500 scale-105" : "border-zinc-800"
        )}>
          {/* Processing Spinner */}
          <div className={cn(
            "absolute -inset-1 border-2 border-transparent border-t-purple-500 rounded-full transition-opacity duration-300",
            isScanning ? "opacity-100 animate-spin" : "opacity-0"
          )} />
          
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">{status}</p>
            <div className="w-[200px] h-1 bg-zinc-900 mx-auto rounded-full overflow-hidden">
              <div 
                className="h-full bg-purple-500 transition-all duration-300"
                style={{ width: isScanning ? `${progress}%` : detected ? "100%" : "5%" }}
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 items-center">
            {error ? (
              <div className="space-y-4 w-full">
                <button
                  onClick={() => window.location.reload()}
                  className="w-full py-4 rounded-full bg-purple-600 text-white font-bold text-sm shadow-lg shadow-purple-600/30 active:scale-95 transition-all"
                >
                  ABRIR CONFIGURAÇÕES
                </button>
                <p className="text-[10px] text-red-400 font-medium px-4">
                  Acesso à câmera bloqueado. Clique acima para recarregar e permitir nas configurações do seu navegador.
                </p>
              </div>
            ) : (
              <div className="flex gap-3 w-full">
                <button
                  onClick={startScan}
                  disabled={!detected || isScanning || showDrawer}
                  className={cn(
                    "flex-1 py-4 rounded-full font-bold text-sm transition-all active:scale-95",
                    detected && !isScanning && !showDrawer
                      ? "bg-purple-500 text-white shadow-lg shadow-purple-500/30" 
                      : "bg-white text-black opacity-30"
                  )}
                >
                  {isScanning ? "PROCESSANDO..." : "INICIAR SCAN"}
                </button>
                <button
                  onClick={() => onComplete(18)}
                  disabled={isScanning || showDrawer}
                  className="px-6 py-4 rounded-full font-bold text-sm bg-white/5 text-slate-400 hover:bg-white/10 transition-all border border-white/10 active:scale-95"
                >
                  PULAR
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Drawer */}
        <div className={cn(
          "fixed bottom-0 left-0 w-full h-[300px] bg-zinc-900 border-t border-white/10 rounded-t-[40px] transition-transform duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] flex flex-col items-center justify-center z-[100]",
          showDrawer ? "translate-y-0" : "translate-y-full"
        )}>
          <div className="text-[11px] font-black text-purple-400 uppercase tracking-widest mb-2">IDENTIDADE ESTIMADA</div>
          <div className="text-6xl font-black text-white mb-8">{finalAgeRange}</div>
          <button 
            onClick={() => detectedAge && onComplete(detectedAge)}
            className="px-12 py-4 bg-purple-500 text-white rounded-full font-bold text-sm shadow-lg shadow-purple-500/20 active:scale-95 transition-transform"
          >
            CONFIRMAR ACESSO
          </button>
        </div>
      </div>
    </motion.div>
  );
}
