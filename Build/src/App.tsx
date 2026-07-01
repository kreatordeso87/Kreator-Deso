import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  Video,
  Upload,
  Copy,
  RefreshCcw,
  RotateCcw,
  History as HistoryIcon,
  Sparkles,
  Check,
  AlertCircle,
  Trash2,
  FileText,
  Zap,
  ClipboardPaste,
  Type,
  Youtube,
  Link as LinkIcon,
  Search,
  ImageIcon,
  Settings,
  ChevronRight,
  ChevronLeft,
  X,
  Plus,
  Monitor,
  Github,
  Edit2,
  Save,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const MODEL_NAME = "gemini-3-flash-preview";

interface HistoryItem {
  id: number;
  type: 'image' | 'video' | 'youtube';
  preview: string;
  prompt: string;
  timestamp: string;
}

const App = () => {
  const [activeTab, setActiveTab] = useState<'file' | 'youtube'>('file');
  
  // File States
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileType, setFileType] = useState<'image' | 'video' | null>(null);
  const [extraInstructions, setExtraInstructions] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [result, setResult] = useState("");
  const [isEditingResult, setIsEditingResult] = useState(false);
  const [editedResult, setEditedResult] = useState("");
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);

  // YT States
  const [ytFile, setYtFile] = useState<File | null>(null);
  const [ytPreviewUrl, setYtPreviewUrl] = useState<string | null>(null);
  const [ytExtraInstructions, setYtExtraInstructions] = useState("");
  const [ytNegativePrompt, setYtNegativePrompt] = useState("");
  const [ytResult, setYtResult] = useState("");
  const [isYtEditingResult, setIsYtEditingResult] = useState(false);
  const [ytEditedResult, setYtEditedResult] = useState("");
  const [isYtGeneratingPrompt, setIsYtGeneratingPrompt] = useState(false);
  
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [isFetchingThumbnail, setIsFetchingThumbnail] = useState(false);
  
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [showCongrats, setShowCongrats] = useState(false);
  
  const [mobileView, setMobileView] = useState<'home' | 'history'>('home');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load history from localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem('vtp_history_v2');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to load history", e);
      }
    }
  }, []);

  // Save history to localStorage
  useEffect(() => {
    localStorage.setItem('vtp_history_v2', JSON.stringify(history));
  }, [history]);

  // Handle Clipboard Paste
  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      if (activeTab !== 'file') return;
      const items = event.clipboardData?.items;
      if (!items) return;
      
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file') {
          const blob = item.getAsFile();
          if (blob) processSelectedFile(blob);
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [activeTab]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const processSelectedFile = (selectedFile: File | Blob) => {
    if (!selectedFile) return;
    setError(null);
    setResult("");
    
    const isImage = selectedFile.type.startsWith('image/');
    const isVideo = selectedFile.type.startsWith('video/');
    
    if (!isImage && !isVideo) {
      setError("Format file tidak didukung. Gunakan JPG, PNG, atau WEBP.");
      return;
    }
    
    const type = isVideo ? 'video' : 'image';
    if (selectedFile.size > 20 * 1024 * 1024) {
      setError("Ukuran file terlalu besar. Maksimum 20MB.");
      return;
    }
    
    const fileToSet = selectedFile instanceof File ? selectedFile : new File([selectedFile], `pasted-image-${Date.now()}.png`, { type: selectedFile.type });
    
    setFile(fileToSet);
    setFileType(type);
    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
    showToast("File berhasil dimuat!");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processSelectedFile(e.target.files[0]);
    }
  };

  const fetchYoutubeThumbnail = async () => {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|live|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
    const match = youtubeUrl.match(regex);
    const videoId = match ? match[1] : null;

    if (!videoId) {
      setError("URL YouTube tidak valid! Pastikan link benar.");
      return;
    }

    setIsFetchingThumbnail(true);
    setError(null);

    const thumbUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    
    // Set preview immediately for instant feedback
    setYtPreviewUrl(thumbUrl);

    try {
      const response = await fetch(thumbUrl);
      if (!response.ok) throw new Error("Gagal mengambil thumbnail HD");
      const blob = await response.blob();

      const thumbFile = new File([blob], "youtube_thumb.jpg", { type: "image/jpeg" });
      setYtFile(thumbFile);
      // Update blob URL for better consistency if needed, though thumbUrl works for preview
      showToast("Thumbnail YouTube berhasil diambil!");
    } catch (err) {
      const fallbackUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      try {
        const resFallback = await fetch(fallbackUrl);
        const blobFallback = await resFallback.blob();
        const thumbFile = new File([blobFallback], "youtube_thumb.jpg", { type: "image/jpeg" });
        setYtFile(thumbFile);
        setYtPreviewUrl(URL.createObjectURL(blobFallback));
      } catch (e) {
        setError("Gagal memuat gambar thumbnail YouTube.");
      }
    } finally {
      setIsFetchingThumbnail(false);
    }
  };

  const toBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = error => reject(error);
  });

  const generatePrompt = async () => {
    const curFile = activeTab === 'file' ? file : ytFile;
    const curExtra = activeTab === 'file' ? extraInstructions : ytExtraInstructions;
    const curNegative = activeTab === 'file' ? negativePrompt : ytNegativePrompt;
    const setRes = activeTab === 'file' ? setResult : setYtResult;
    const setEdited = activeTab === 'file' ? setEditedResult : setYtEditedResult;
    const setIsGen = activeTab === 'file' ? setIsGeneratingPrompt : setIsYtGeneratingPrompt;
    const setIsEdit = activeTab === 'file' ? setIsEditingResult : setIsYtEditingResult;

    if (!curFile) return;
    setIsGen(true);
    setError(null);
    setRes("");
    setIsEdit(false);

    try {
      const base64Data = await toBase64(curFile);
      const mimeType = curFile.type || 'image/jpeg';
      
      const systemPrompt = `You are a professional AI Prompt Engineer for Stable Diffusion and Midjourney.
Analyze this visual media and generate a highly detailed, evocative, and technical descriptive prompt in English.

INSTRUCTION: 
1. Describe the main visual subject, scene composition, and emotional tone in detail.
2. Identify the specific artistic style or medium (e.g., analog photography, oil painting, 3D Octane render, cyberpunk digital art).
3. Describe lighting (e.g., volumetric lighting, soft bokeh, harsh neon colors), color palette, and atmospheric effects (e.g., foggy, misty, radiant).
4. Describe camera settings: angle (e.g., low angle, birds-eye), lens (e.g., 35mm, wide angle), and depth of field.
5. TRANSCRIPTION: Detect and transcribe ALL visible text, slogans, or labels EXACTLY.
6. TYPOGRAPHY: For every piece of text, describe its font style (serif, monospaced, brutalist, script), weight, color, and positioning.

${curExtra ? `EXTRA INSTRUCTIONS: ${curExtra}` : ''}
${curNegative ? `NEGATIVE STYLING (Avoid describing these): ${curNegative}` : ''}

Output a single, cohesive, long-form prompt block that captures everyone of these points.`;

      const resApi = await fetch("/api/generate-prompt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          systemPrompt,
          base64Data,
          mimeType,
          model: MODEL_NAME,
        }),
      });

      if (!resApi.ok) {
        const errorData = await resApi.json();
        throw new Error(errorData.error || "Gagal menghasilkan prompt");
      }

      const data = await resApi.json();
      const generatedText = data.text;
      if (!generatedText) throw new Error("Respons AI kosong.");

      setRes(generatedText);
      setEdited(generatedText);
      setShowCongrats(true);
      
      // Voice notification
      const speak = () => {
        if ('speechSynthesis' in window) {
          const message = new SpeechSynthesisUtterance("SUDAH BERES BOSKU");
          message.lang = 'id-ID';
          message.rate = 1.0;
          window.speechSynthesis.speak(message);
        }
      };
      speak();

      setTimeout(() => setShowCongrats(false), 5000);
      
      const newHistoryItem: HistoryItem = {
        id: Date.now(),
        type: activeTab === 'file' ? (fileType || 'image') : 'youtube',
        preview: (activeTab === 'file' ? previewUrl : ytPreviewUrl) || '',
        prompt: generatedText,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      };
      setHistory(prev => [newHistoryItem, ...prev.slice(0, 19)]);
      showToast("Prompt berhasil dihasilkan!");
    } catch (err: any) {
      console.error(err);
      setError(`Kesalahan: ${err.message || 'Gagal menganalisis gambar'}`);
    } finally {
      setIsGen(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      showToast("Tersalin ke papan klip!");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const resetAll = () => {
    if (activeTab === 'file') {
      setFile(null);
      setPreviewUrl(null);
      setFileType(null);
      setResult("");
      setExtraInstructions("");
      setNegativePrompt("");
      setIsEditingResult(false);
      setIsGeneratingPrompt(false);
    } else {
      setYtFile(null);
      setYtPreviewUrl(null);
      setYtResult("");
      setYoutubeUrl("");
      setYtExtraInstructions("");
      setYtNegativePrompt("");
      setIsYtEditingResult(false);
      setIsYtGeneratingPrompt(false);
    }
    setError(null);
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-bg-app">
      {/* Background Decorative */}
      <div className="fixed inset-0 grid-glow pointer-events-none" aria-hidden="true" />
      
      <header className="h-20 border-b border-stroke bg-bg-card sticky top-0 z-40 px-4 md:px-8 flex items-center justify-between shadow-xl shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-brand rounded-xl flex items-center justify-center text-black border border-brand/20 shadow-lg">
            <Sparkles className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-display uppercase tracking-wider text-brand leading-none">Visual to Prompt</h1>
            <p className="text-[11px] uppercase tracking-[0.2em] text-gray-500 font-extrabold mt-1">Design By Kreator Deso</p>
          </div>
        </div>

        <div className="hidden lg:flex flex-1 justify-center pointer-events-none">
          <p className="font-hand text-2xl text-brand/60 italic tracking-wide">
            " Kerjakan Lebih, Jika Ingin Hasil Lebih "
          </p>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <button 
            onClick={resetAll}
            className="flex items-center gap-2 px-3 md:px-5 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-lg md:rounded-xl transition-all font-black text-[10px] md:text-xs tracking-widest uppercase active:scale-95"
          >
            <RotateCcw className="w-3.5 h-3.5 md:w-4 h-4" />
            <span className="hidden xs:inline">RESET</span>
          </button>
          <div className="hidden sm:flex glass-pill">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[11px] font-bold text-gray-400">Gemini 3 Flash Ready</span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1600px] mx-auto w-full p-4 md:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 lg:h-[calc(100vh-5rem)] min-h-0 overflow-hidden">
        {/* Column 1: Input (Sumber Visual) */}
        <section className={`vtp-card flex flex-col h-full min-h-0 ${mobileView === 'history' ? 'hidden lg:flex' : 'flex'} overflow-hidden`}>
          <div className="p-4 border-b border-stroke bg-white/[0.02] flex items-center justify-between shrink-0">
            <h2 className="text-lg font-display uppercase tracking-widest flex items-center gap-2 text-brand">
              <ImageIcon className="w-5 h-5" /> Sumber Visual
            </h2>
            
            <div className="bg-black/40 p-1 rounded-xl flex gap-1 border border-white/5 scale-90">
              <button 
                onClick={() => setActiveTab('file')}
                className={`flex items-center gap-2 px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${activeTab === 'file' ? 'bg-brand text-black shadow-md' : 'text-gray-500 hover:text-gray-300'}`}
              >
                <Upload className="w-3 h-3" /> File / Paste
              </button>
              <button 
                onClick={() => setActiveTab('youtube')}
                className={`flex items-center gap-2 px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${activeTab === 'youtube' ? 'bg-red-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-300'}`}
              >
                <Youtube className="w-3 h-3" /> YouTube
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-6 custom-scrollbar">
            {/* Input Area */}
            <div className="relative">
              {!(activeTab === 'file' ? previewUrl : ytPreviewUrl) ? (
                <div className="animate-in fade-in zoom-in-95 duration-300">
                  {activeTab === 'file' ? (
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="group aspect-[16/10] border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-brand/40 hover:bg-brand/5 transition-all duration-500"
                    >
                      <div className="bg-white/5 p-4 rounded-3xl mb-3 group-hover:scale-110 transition-transform duration-500 border border-white/5">
                        <Upload className="w-8 h-8 text-gray-500 group-hover:text-brand" />
                      </div>
                      <p className="text-gray-300 text-sm font-bold">Pilih atau Tempel</p>
                      <p className="text-gray-500 text-[10px] mt-1 text-center px-6 uppercase tracking-wider font-bold">JPG, PNG, WEBP — Maks 20MB</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="relative">
                        <input 
                          type="text" 
                          value={youtubeUrl}
                          onChange={(e) => setYoutubeUrl(e.target.value)}
                          placeholder="https://www.youtube.com/watch?v=..."
                          className="vtp-input w-full pl-12 h-14 font-medium"
                        />
                        <Youtube className="absolute left-4 top-1/2 -translate-y-1/2 text-red-500/50 w-6 h-6" />
                      </div>
                      <button 
                        onClick={fetchYoutubeThumbnail}
                        disabled={isFetchingThumbnail || !youtubeUrl}
                        className="w-full h-14 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl shadow-lg shadow-red-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {isFetchingThumbnail ? <RefreshCcw className="animate-spin w-5 h-5" /> : <><Plus className="w-5 h-5" /> Ambil Thumbnail</>}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <motion.div 
                  layoutId="preview"
                  className="relative group aspect-video rounded-2xl overflow-hidden bg-black ring-1 ring-white/10 shadow-2xl"
                >
                  <img src={(activeTab === 'file' ? previewUrl : ytPreviewUrl) || ''} className="w-full h-full object-contain" alt="Preview" referrerPolicy="no-referrer" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <button 
                    onClick={() => { 
                      if (activeTab === 'file') {
                        setPreviewUrl(null); 
                        setFile(null); 
                      } else {
                        setYtPreviewUrl(null);
                        setYtFile(null);
                      }
                    }}
                    className="absolute top-4 right-4 p-2.5 bg-red-600 text-white rounded-full shadow-lg hover:bg-red-700 transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                  <div className="absolute bottom-4 left-4 flex gap-2">
                    <span className="px-3 py-1 bg-brand/80 backdrop-blur-md rounded-lg text-[10px] font-black text-black border border-white/10 uppercase">
                      {activeTab === 'youtube' ? 'YouTube HD' : (fileType || 'Image')}
                    </span>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Config Areas */}
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                  <Zap className="w-3 h-3 text-brand" /> Instruksi Tambahan
                </label>
                <textarea 
                  value={activeTab === 'file' ? extraInstructions : ytExtraInstructions}
                  onChange={(e) => activeTab === 'file' ? setExtraInstructions(e.target.value) : setYtExtraInstructions(e.target.value)}
                  placeholder="Fokus pada pencahayaan, gaya digital art..."
                  className="vtp-input w-full h-24 resize-none text-[13px]"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                  <X className="w-3 h-3 text-red-500" /> Negative Styling
                </label>
                <textarea 
                  value={activeTab === 'file' ? negativePrompt : ytNegativePrompt}
                  onChange={(e) => activeTab === 'file' ? setNegativePrompt(e.target.value) : setYtNegativePrompt(e.target.value)}
                  placeholder="Low quality, watermarks, deformities..."
                  className="vtp-input w-full h-24 resize-none text-[13px]"
                />
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-stroke bg-white/[0.02] shrink-0">
            <button 
              disabled={!(activeTab === 'file' ? file : ytFile) || (activeTab === 'file' ? isGeneratingPrompt : isYtGeneratingPrompt)}
              onClick={generatePrompt}
              className="w-full h-12 vtp-btn-primary rounded-xl font-black flex items-center justify-center gap-3 active:scale-[0.98]"
            >
              {(activeTab === 'file' ? isGeneratingPrompt : isYtGeneratingPrompt) ? <RefreshCcw className="animate-spin" /> : <><Sparkles className="w-5 h-5" /> Hasilkan Prompt</>}
            </button>
          </div>
        </section>

        {/* Column 2: Result (Prompt Hasil) */}
        <section className={`vtp-card flex flex-col h-full min-h-0 ${mobileView === 'history' ? 'hidden lg:flex' : 'flex'} overflow-hidden`}>
          <div className="p-4 border-b border-stroke bg-white/[0.02] flex items-center justify-between shrink-0">
            <h2 className="text-lg font-display uppercase tracking-widest flex items-center gap-2 text-brand">
              <FileText className="w-5 h-5" /> Prompt Hasil
            </h2>
            <div className="flex items-center gap-2">
              {(activeTab === 'file' ? result : ytResult) && (
                (activeTab === 'file' ? isEditingResult : isYtEditingResult) ? (
                  <>
                    <button 
                      onClick={() => { 
                        if (activeTab === 'file') {
                          setResult(editedResult); 
                          setIsEditingResult(false); 
                        } else {
                          setYtResult(ytEditedResult);
                          setIsYtEditingResult(false);
                        }
                        showToast("Disimpan!"); 
                      }}
                      className="p-1.5 bg-green-500/10 text-green-500 rounded-lg transition-colors border border-green-500/20"
                    >
                      <Save className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => { 
                        if (activeTab === 'file') {
                          setEditedResult(result); 
                          setIsEditingResult(false); 
                        } else {
                          setYtEditedResult(ytResult);
                          setIsYtEditingResult(false);
                        }
                      }}
                      className="p-1.5 bg-red-500/10 text-red-500 rounded-lg transition-colors border border-red-500/20"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <button 
                      onClick={() => {
                        if (activeTab === 'file') {
                          setIsEditingResult(true);
                        } else {
                          setIsYtEditingResult(true);
                        }
                      }}
                      className="p-1.5 bg-white/5 text-gray-400 rounded-lg transition-colors border border-white/10"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => copyToClipboard(activeTab === 'file' ? result : ytResult)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black tracking-wider transition-all ${copied ? 'bg-green-500 text-black' : 'bg-brand text-black shadow-md'}`}
                    >
                      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} {copied ? 'TERSALIN' : 'SALIN'}
                    </button>
                  </>
                )
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-5 bg-black/30 custom-scrollbar">
            {(activeTab === 'file' ? isGeneratingPrompt : isYtGeneratingPrompt) ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8">
                <div className="relative mb-10">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                    className="w-32 h-32 border-2 border-dashed border-brand/20 rounded-full"
                  />
                  <motion.div
                    animate={{ rotate: -360 }}
                    transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-4 border-2 border-dashed border-brand/40 rounded-full"
                  />
                  <motion.div
                    animate={{ rotate: 180 }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-8 border-2 border-dashed border-brand/60 rounded-full"
                  />
                  <motion.div
                    animate={{ scale: [1, 1.1, 1], rotate: [0, 90, 180, 270, 360] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <Settings className="w-10 h-10 text-brand" />
                  </motion.div>
                </div>
                
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  <p className="text-brand font-black text-xl italic tracking-tighter">MASIH DI GORENG GAMBARNYA...</p>
                  <div className="flex flex-col gap-1">
                    <p className="text-white font-bold text-sm tracking-[0.3em] uppercase opacity-70">Bismillah SUGEH</p>
                    <motion.p 
                      animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 1, repeat: Infinity }}
                      className="text-brand-light font-display text-5xl tracking-[0.2em]"
                    >
                      AMIN
                    </motion.p>
                  </div>
                </motion.div>
              </div>
            ) : (activeTab === 'file' ? result : ytResult) ? (
              (activeTab === 'file' ? isEditingResult : isYtEditingResult) ? (
                <textarea 
                  value={activeTab === 'file' ? editedResult : ytEditedResult}
                  onChange={(e) => activeTab === 'file' ? setEditedResult(e.target.value) : setYtEditedResult(e.target.value)}
                  className="w-full h-full bg-transparent border-none focus:ring-0 text-gray-300 font-mono text-[14px] p-0 resize-none leading-relaxed"
                />
              ) : (
                <div className="text-gray-300 font-mono text-[14px] leading-relaxed whitespace-pre-wrap select-all">
                  {activeTab === 'file' ? result : ytResult}
                </div>
              )
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-30">
                <Sparkles className="w-12 h-12 mb-3" />
                <p className="text-[10px] font-bold uppercase tracking-[0.2em]">Menunggu Analisis...</p>
              </div>
            )}
          </div>
        </section>

        {/* Column 3: History (Riwayat) */}
        <section className={`vtp-card flex flex-col h-full min-h-0 ${mobileView === 'home' && !result ? 'hidden lg:flex' : 'flex'} overflow-hidden`}>
          <div className="p-4 border-b border-stroke bg-white/[0.02] flex items-center justify-between shrink-0">
            <h2 className="text-lg font-display uppercase tracking-widest flex items-center gap-2 text-gray-400">
              <HistoryIcon className="w-5 h-5" /> Riwayat
            </h2>
            {history.length > 0 && (
              <button 
                onClick={() => { setHistory([]); localStorage.removeItem('vtp_history_v2'); }}
                className="text-[9px] font-black text-gray-600 hover:text-red-500 transition-colors uppercase tracking-widest"
              >
                Hapus
              </button>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
            {history.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-20">
                <HistoryIcon className="w-10 h-10 mb-3" />
                <p className="text-[9px] font-black uppercase tracking-widest">Kosong</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {history.map((item) => (
                  <motion.div 
                    key={item.id}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-white/[0.03] border border-white/5 rounded-xl p-3 flex gap-3 group hover:bg-white/[0.08] transition-all cursor-pointer"
                    onClick={() => {
                      const mode = item.type === 'youtube' ? 'youtube' : 'file';
                      setActiveTab(mode);
                      if (mode === 'file') {
                        setResult(item.prompt);
                        setPreviewUrl(item.preview);
                        setFile(new File([], "history_item"));
                        setFileType(item.type === 'video' ? 'video' : 'image');
                      } else {
                        setYtResult(item.prompt);
                        setYtPreviewUrl(item.preview);
                        setYtFile(new File([], "history_item"));
                      }
                    }}
                  >
                    <div className="w-20 h-14 rounded-lg bg-black flex-shrink-0 relative overflow-hidden ring-1 ring-white/10">
                      <img src={item.preview} className="w-full h-full object-cover opacity-80" alt="History" referrerPolicy="no-referrer" />
                      <div className="absolute top-0.5 right-0.5">
                         {item.type === 'youtube' ? <Youtube className="w-2.5 h-2.5 text-red-500" /> : <ImageIcon className="w-2.5 h-2.5 text-brand" />}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div className="flex items-center justify-between gap-1">
                         <span className="text-[9px] font-black text-gray-600 uppercase">{item.timestamp}</span>
                         <button 
                           onClick={(e) => { e.stopPropagation(); copyToClipboard(item.prompt); }}
                           className="p-1 hover:bg-white/10 rounded-md text-gray-500 opacity-0 group-hover:opacity-100 transition-all"
                         >
                            <Copy className="w-2.5 h-2.5" />
                         </button>
                      </div>
                      <p className="text-[10px] text-gray-400 font-medium line-clamp-2 leading-snug">
                        {item.prompt}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Mobile Navigation */}
      <nav className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-[400px] h-16 bg-bg-card/80 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl z-50 flex items-center justify-around px-2">
        <button 
          onClick={() => setMobileView('home')}
          className={`flex-1 flex flex-col items-center gap-1 transition-all ${mobileView === 'home' ? 'text-brand' : 'text-gray-500'}`}
        >
          <Monitor className="w-6 h-6" />
          <span className="text-[10px] font-bold">Studio</span>
        </button>
        <button 
          onClick={() => setMobileView('history')}
          className={`flex-1 flex flex-col items-center gap-1 transition-all ${mobileView === 'history' ? 'text-brand' : 'text-gray-500'}`}
        >
          <div className="relative">
            <HistoryIcon className="w-6 h-6" />
            {history.length > 0 && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-brand rounded-full border-2 border-bg-app" />}
          </div>
          <span className="text-[10px] font-bold">Riwayat</span>
        </button>
      </nav>

      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: 100, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 20, x: '-50%' }}
            className="fixed bottom-24 lg:bottom-12 left-1/2 z-[100] px-6 py-3 bg-white text-black font-black text-xs rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/20 whitespace-nowrap"
          >
            {toast.message.toUpperCase()}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCongrats && (
          <div className="fixed inset-0 z-[200] pointer-events-none flex items-center justify-center overflow-hidden">
            <motion.div 
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="relative z-10 p-12 rounded-[2rem] bg-black border-2 border-brand shadow-2xl text-center backdrop-blur-2xl"
            >
              <h2 className="text-6xl md:text-8xl font-display text-brand leading-none tracking-tighter">SUDAH BERES BOSKU!</h2>
              <p className="text-brand-light font-bold tracking-[0.3em] mt-4 uppercase">Prompt Generated Successfully</p>
            </motion.div>
            
            {/* Confetti simulation with motion */}
            {[...Array(50)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ 
                  top: -20, 
                  left: `${Math.random() * 100}%`,
                  rotate: 0,
                  opacity: 1
                }}
                animate={{ 
                  top: '120%', 
                  rotate: 360 * 2,
                  left: `${(Math.random() * 20 - 10) + (i * 2)}%`
                }}
                transition={{ 
                  duration: 2 + Math.random() * 3,
                  ease: "linear",
                  delay: Math.random() * 0.5
                }}
                className="absolute w-2 h-2 rounded-sm"
                style={{ 
                  backgroundColor: ['#22c55e', '#4ade80', '#15803d', '#ffffff'][Math.floor(Math.random() * 4)] 
                }}
              />
            ))}
          </div>
        )}
      </AnimatePresence>

      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange}
        className="hidden" 
        accept="image/*,video/mp4" 
      />

      <style dangerouslySetInnerHTML={{ __html: `
        .grid-glow {
          background-image: 
            radial-gradient(circle at 50% 50%, rgba(34, 197, 94, 0.05) 0%, transparent 100%),
            linear-gradient(rgba(34, 197, 94, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(34, 197, 94, 0.03) 1px, transparent 1px);
          background-size: 100% 100%, 40px 40px, 40px 40px;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(34, 197, 94, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(34, 197, 94, 0.2);
        }
      `}} />
    </div>
  );
};

export default App;
