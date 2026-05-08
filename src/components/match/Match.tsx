import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  X, 
  Zap, 
  RefreshCw,
  User as UserIcon,
  ShieldCheck,
  ShieldOff,
  Coins,
  Skull,
  Flame,
  Bomb,
  Languages,
  Loader2,
  Tv,
  Heart
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  onSnapshot, 
  query, 
  where, 
  doc, 
  deleteDoc, 
  serverTimestamp,
  getDocs,
  limit
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../services/firebase';
import { translateText } from '../../services/translationService';
import { cn } from '../../lib/utils';
import LivesList from './LivesList';
import LiveSession from './LiveSession';
import LiveBroadcast from './LiveBroadcast';
import { useToast } from '../../hooks/useToast';

const PRESET_FETISHES = ['Submisso', 'Dominante', 'BDSM', 'Fetichista', 'Voyeur', 'Exibicionismo', 'Roleplay', 'Lingerie'];

export default function Match() {
  const { profile, user, updateProfile } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'match' | 'lives'>('match');
  const [isNaughtyMode, setIsNaughtyMode] = useState(false);
  const [status, setStatus] = useState<'idle' | 'searching' | 'matched'>('idle');
  const [showLiveBroadcast, setShowLiveBroadcast] = useState(false);
  const [matchedUser, setMatchedUser] = useState<any>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isTranslating, setIsLiveTranslating] = useState(false);
  const [translatedDisplay, setTranslatedDisplay] = useState<string | null>(null);
  const [isMatchedVisible, setIsMatchedVisible] = useState(false);
  const [sessionDocId, setSessionDocId] = useState<string | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [selectedFetishes, setSelectedFetishes] = useState<string[]>(profile?.fetishes || []);
  const [selectedLive, setSelectedLive] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [quality, setQuality] = useState<'poor' | 'fair' | 'good' | 'excellent'>('good');
  const [partnerBlur, setPartnerBlur] = useState(true);
  const [partnerQuality, setPartnerQuality] = useState<'poor' | 'fair' | 'good' | 'excellent'>('excellent');
  const [callTimeLeft, setCallTimeLeft] = useState(30);

  // Monitor connection quality
  useEffect(() => {
    const navConn = (navigator as any).connection;
    if (navConn) {
      const updateQuality = () => {
        const type = navConn.effectiveType;
        let newQuality: 'poor' | 'fair' | 'good' | 'excellent' = 'good';
        if (type === '4g') newQuality = 'excellent';
        else if (type === '3g') newQuality = 'good';
        else if (type === '2g') newQuality = 'fair';
        else newQuality = 'poor';
        
        setQuality(newQuality);
        
        if (newQuality === 'poor') {
          setError("Sua conexão está fraca. A qualidade do vídeo será reduzida.");
        }
      };
      
      navConn.addEventListener('change', updateQuality);
      updateQuality();
      return () => navConn.removeEventListener('change', updateQuality);
    }
  }, []);

  // Clear error after 5s
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const toggleFetish = (f: string) => {
    const newFetishes = selectedFetishes.includes(f)
      ? selectedFetishes.filter(item => item !== f)
      : [...selectedFetishes, f];
    setSelectedFetishes(newFetishes);
    updateProfile({ fetishes: newFetishes });
  };

  const startSearching = async () => {
    if (!user) return;
    
    if (selectedFetishes.length === 0) {
      setError("Escolha pelo menos uma preferência para encontrar seu par ideal.");
      return;
    }
    
    setStatus('searching');
    setError(null);
    
    // Choose resolution based on connection quality
    const resolutionMap = {
      excellent: { width: 1280, height: 720 },
      good: { width: 640, height: 480 },
      fair: { width: 480, height: 360 },
      poor: { width: 320, height: 240 }
    };
    
    const constraints = resolutionMap[quality];

    try {
      const activeStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          ...constraints,
          facingMode: 'user'
        }, 
        audio: true 
      });
      
      setStream(activeStream);
    } catch (err) {
      console.error("Camera access denied or error:", err);
      let errorMsg = "Não foi possível acessar a câmera.";
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') errorMsg = "Permissão de câmera negada. Verifique as configurações do navegador.";
        else if (err.name === 'NotFoundError') errorMsg = "Nenhuma câmera encontrada.";
      }
      toast('error', errorMsg);
      setError(errorMsg);
      setStatus('idle');
      return;
    }

    try {
      const qDoc = await addDoc(collection(db, 'matches'), {
        userId: user.uid,
        displayName: profile?.displayName || 'Anônimo',
        photoURL: profile?.photoURL || '',
        fetishes: selectedFetishes,
        status: 'searching',
        createdAt: serverTimestamp()
      });
      setSessionDocId(qDoc.id);
    } catch (err: any) {
      console.error(err);
      setError("Erro ao iniciar busca. Tente novamente.");
      setStatus('idle');
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
        setStream(null);
      }
    }
  };

  useEffect(() => {
    let searchInterval: any;
    let unsub: (() => void) | null = null;

    if (status === 'searching' && sessionDocId && user) {
      const findMatch = async () => {
        const path = 'matches';
        const q = query(
          collection(db, path), 
          where('status', '==', 'searching'),
          where('userId', '!=', user.uid),
          limit(1)
        );
        try {
          const snap = await getDocs(q);
          if (!snap.empty) {
            const otherPeer = snap.docs[0];
            const otherPeerId = otherPeer.id;
            const otherPeerData = otherPeer.data();
            
            // Coordination: Only the user with the smaller UID initiates the match process
            // to avoid both users trying to update at the same time.
            if (user.uid < otherPeerData.userId) {
              try {
                await updateDoc(doc(db, path, sessionDocId), { 
                  status: 'matched', 
                  matchedWith: otherPeerData.userId,
                  updatedAt: serverTimestamp()
                });
                await updateDoc(doc(db, path, otherPeerId), { 
                  status: 'matched', 
                  matchedWith: user.uid,
                  updatedAt: serverTimestamp()
                });
                setMatchedUser(otherPeerData);
                const qualities: ('poor' | 'fair' | 'good' | 'excellent')[] = ['fair', 'good', 'excellent'];
                setPartnerQuality(qualities[Math.floor(Math.random() * qualities.length)]);
                setStatus('matched');
                setPartnerBlur(true);
              } catch (e) {
                console.warn("Match claim failed, will retry:", e);
              }
            }
          }
        } catch (err) {
          console.error("Match searching error:", err);
        }
      };

      searchInterval = setInterval(findMatch, 2500);
      findMatch(); // Initial check

      unsub = onSnapshot(doc(db, 'matches', sessionDocId), (docSnap) => {
        if (docSnap.exists() && docSnap.data().status === 'matched') {
          const data = docSnap.data();
          if (data.matchedWith && !matchedUser) {
            setStatus('matched');
            fetchMatchedUserInfo(data.matchedWith);
            setPartnerBlur(true);
          }
        }
      }, (err) => {
        handleFirestoreError(err, OperationType.GET, `matches/${sessionDocId}`);
      });
    }

    return () => {
      if (searchInterval) clearInterval(searchInterval);
      if (unsub) unsub();
    };
  }, [status, sessionDocId, user]);

  const fetchMatchedUserInfo = async (peerUid: string) => {
    const peerQ = query(
      collection(db, 'matches'), 
      where('userId', '==', peerUid), 
      where('matchedWith', '==', user.uid),
      limit(1)
    );
    const peerSnap = await getDocs(peerQ);
    if (!peerSnap.empty) {
      const data = peerSnap.docs[0].data();
      setMatchedUser(data);
      if (isTranslating && data.status) {
        const trans = await translateText(data.status);
        setTranslatedDisplay(trans);
      }
    }
  };

  const toggleMute = () => {
    const newState = !isMuted;
    setIsMuted(newState);
    if (stream) {
      stream.getAudioTracks().forEach(track => track.enabled = !newState);
    }
  };

  const toggleCamera = () => {
    const newState = !isCameraOff;
    setIsCameraOff(newState);
    if (stream) {
      stream.getVideoTracks().forEach(track => track.enabled = !newState);
    }
  };

  const stopSearching = async () => {
    if (sessionDocId) {
      await deleteDoc(doc(db, 'matches', sessionDocId));
    }
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setStatus('idle');
    setMatchedUser(null);
    setSessionDocId(null);
  };

  useEffect(() => {
    return () => {
      if (sessionDocId) deleteDoc(doc(db, 'matches', sessionDocId));
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
  }, [sessionDocId, stream]);

  useEffect(() => {
    if (status === 'matched') {
      setCallTimeLeft(30);
      const timer = setInterval(() => {
        setCallTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            stopSearching();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [status]);

  useEffect(() => {
    if (status === 'matched') {
      setTimeout(() => {
        setIsMatchedVisible(true);
      }, 500);
    } else {
      setIsMatchedVisible(false);
    }
  }, [status]);

  useEffect(() => {
    if (stream && localVideoRef.current && (status === 'searching' || status === 'matched')) {
      const video = localVideoRef.current;
      if (video.srcObject !== stream) {
        video.srcObject = stream;
        video.muted = true;
        // Add a small delay to ensure the browser is ready
        setTimeout(() => {
          video.play().catch(e => {
            if (e.name !== 'AbortError') {
               console.warn("Match video play failed in effect", e);
            }
          });
        }, 100);
      }
    }
  }, [stream, status]);

  return (
    <div className={cn(
      "h-full flex flex-col relative overflow-hidden transition-colors duration-700",
      isNaughtyMode ? "bg-black" : "bg-zinc-950"
    )}>
      {/* Error Toast */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] w-full max-w-xs px-4"
          >
            <div className="bg-red-600/90 backdrop-blur-xl text-white py-3 px-6 rounded-2xl shadow-2xl shadow-red-600/40 border border-red-500 flex items-center gap-3">
              <Bomb size={20} className="animate-bounce" />
              <p className="text-xs font-black uppercase tracking-widest">{error}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Glitch Overlay for Naughty Mode */}
      {isNaughtyMode && (
        <div className="absolute inset-0 pointer-events-none z-10 opacity-30">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20" />
          <motion.div 
            animate={{ 
              opacity: [0.1, 0.3, 0.1],
              x: [-2, 2, -1],
              y: [1, -1, 1],
            }}
            transition={{ duration: 0.1, repeat: Infinity }}
            className="absolute inset-0 border-[20px] border-red-600/10 blur-3xl" 
          />
        </div>
      )}
      {/* Top Bar with Balance and Tabs */}
      <div className={cn(
        "p-4 flex flex-col gap-4 z-40 backdrop-blur-xl border-b transition-colors duration-500",
        isNaughtyMode ? "bg-red-950/20 border-red-500/20" : "bg-zinc-950/80 border-white/5"
      )}>
        <div className="flex justify-between items-center">
          <h2 className={cn(
            "text-xl font-black font-display tracking-tighter italic transition-colors",
            isNaughtyMode ? "text-red-600 animate-pulse" : "text-pink-500"
          )}>
            {isNaughtyMode ? "VIBE NAUGHTY" : "TOKMATCH"}
          </h2>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsNaughtyMode(!isNaughtyMode)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-xl border-2 transition-all font-black text-[10px] uppercase tracking-wider group relative overflow-hidden",
                isNaughtyMode 
                  ? "bg-red-600 border-red-500 text-white shadow-lg shadow-red-600/40" 
                  : "bg-zinc-900 border-white/5 text-zinc-500 hover:border-white/10"
              )}
            >
              {isNaughtyMode && (
                <motion.div 
                  layoutId="naughty-glow"
                  className="absolute inset-0 bg-white/20 animate-pulse"
                />
              )}
              <Skull size={14} className={cn("relative z-10", isNaughtyMode ? "fill-white" : "")} />
              <span className="relative z-10">{isNaughtyMode ? "NAUGHTY ATIVO" : "MODO NAUGHTY"}</span>
            </button>
            <div className="flex items-center gap-2 bg-zinc-900 px-3 py-1.5 rounded-xl border border-white/5">
              <Coins size={14} className="text-yellow-500" />
              <span className="text-xs font-bold">{profile?.balance || 0}</span>
            </div>
          </div>
        </div>
        
        {status === 'idle' && (
          <div className="flex p-1 bg-zinc-900 rounded-2xl border border-white/5">
            <button 
              onClick={() => setActiveTab('match')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-black rounded-xl transition-all uppercase tracking-widest",
                activeTab === 'match' 
                  ? (isNaughtyMode ? "bg-red-600 text-white shadow-lg shadow-red-600/30" : "bg-white text-black shadow-lg") 
                  : "text-zinc-500 hover:text-white"
              )}
            >
              <Zap size={14} />
              Picante
            </button>
            <button 
              onClick={() => setActiveTab('lives')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-black rounded-xl transition-all uppercase tracking-widest",
                activeTab === 'lives' 
                  ? (isNaughtyMode ? "bg-red-600 text-white shadow-lg shadow-red-600/30" : "bg-white text-black shadow-lg") 
                  : "text-zinc-500 hover:text-white"
              )}
            >
              <Tv size={14} />
              Lives
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-hidden relative flex flex-col">
        {activeTab === 'match' && (
          <div className="h-full flex flex-col flex-1 items-center justify-center">
            {status === 'idle' && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                key={isNaughtyMode ? 'naughty' : 'normal'}
                className="text-center px-8 w-full max-w-sm"
              >
                <div className={cn(
                  "w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl rotate-3 border-4 transition-all duration-500",
                  isNaughtyMode 
                    ? "bg-gradient-to-tr from-red-600 to-black border-red-500 shadow-red-600/40" 
                    : "bg-gradient-to-tr from-pink-600 to-purple-800 border-white/10 shadow-pink-500/20"
                )}>
                  <Flame size={48} className={cn("text-white animate-pulse", isNaughtyMode ? "fill-red-500" : "fill-white")} />
                </div>
                <h1 className={cn(
                  "text-3xl font-display font-black mb-2 tracking-tighter italic transition-colors",
                  isNaughtyMode ? "text-red-500" : "text-white"
                )}>
                  {isNaughtyMode ? "MATCH SEM LIMITES" : "MATCH AO VIVO"}
                </h1>
                <p className="text-zinc-500 mb-8 text-sm">
                  {isNaughtyMode 
                    ? "Aviso: Sem filtros de imagem e linguagem ativos. Entre por sua conta e risco. 🫦" 
                    : "Entre no quarto e encontre alguém sem restrições agora."}
                </p>
                
                <div className="flex flex-wrap gap-2 justify-center mb-10">
                  {PRESET_FETISHES.map(f => (
                    <button
                      key={f}
                      onClick={() => toggleFetish(f)}
                      className={cn(
                        "px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border-2",
                        selectedFetishes.includes(f)
                          ? (isNaughtyMode ? "bg-red-600 border-red-500 text-white shadow-lg shadow-red-600/30" : "bg-pink-500 border-pink-400 text-white shadow-lg shadow-pink-500/20")
                          : "bg-zinc-900 border-white/5 text-zinc-500 hover:border-white/10"
                      )}
                    >
                      {f}
                    </button>
                  ))}
                </div>

                <div className="space-y-3 mb-10 w-full flex flex-col items-center">
                  <FeatureBadge icon={ShieldOff} label={isNaughtyMode ? "FILTROS VISUAIS: OFF" : "Sem Censura"} className={isNaughtyMode ? "text-red-500 border-red-500/20 bg-red-500/5" : ""} />
                  <FeatureBadge icon={Languages} label={isNaughtyMode ? "FILTRO DE LINGUAGEM: OFF" : "Tradução Direta"} className={isNaughtyMode ? "text-red-500 border-red-500/20 bg-red-500/5" : ""} />
                  <FeatureBadge icon={Skull} label={isNaughtyMode ? "CONTEÚDO EXPLÍCITO" : "Privado & Ousado"} className={isNaughtyMode ? "text-red-500 border-red-500/20 bg-red-500/5" : ""} />
                </div>

                <button 
                  onClick={startSearching}
                  className={cn(
                    "w-full font-black py-5 rounded-2xl transition-all active:scale-95 shadow-xl flex items-center justify-center gap-3 uppercase tracking-[0.2em] italic",
                    isNaughtyMode 
                      ? "bg-red-600 text-white shadow-red-900/50 hover:bg-red-500" 
                      : "bg-white hover:bg-zinc-200 text-black shadow-white/10"
                  )}
                >
                  {isNaughtyMode ? "QUERO TUDO AGORA" : "CONECTAR AGORA"}
                  <Zap size={20} className={isNaughtyMode ? "fill-white" : "fill-black"} />
                </button>
              </motion.div>
            )}

            {(status === 'searching' || status === 'matched') && (
              <div className="h-full w-full flex flex-col relative bg-black">
                {/* Peer Video (Matched) or Loading (Searching) */}
                <div className="flex-1 bg-zinc-900 relative">
                  {status === 'matched' ? (
                    <div className="h-full w-full relative">
                      <img 
                        src={matchedUser?.photoURL || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1'} 
                        className={cn(
                          "w-full h-full object-cover transition-all duration-1000",
                          partnerBlur ? "blur-3xl scale-110" : "blur-0 scale-100",
                          isNaughtyMode ? "grayscale-0 opacity-100" : "grayscale opacity-80"
                        )}
                      />
                      
                      <AnimatePresence>
                        {partnerBlur && (
                          <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm z-30"
                          >
                            <div className="text-center p-8">
                              <motion.div 
                                animate={{ scale: [1, 1.1, 1] }} 
                                transition={{ repeat: Infinity, duration: 2 }}
                                className={cn(
                                  "w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6",
                                  isNaughtyMode ? "bg-red-600" : "bg-pink-500"
                                )}
                              >
                                <Heart size={40} className="text-white fill-white" />
                              </motion.div>
                              <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white mb-2 leading-none">CONEXÃO ENCONTRADA!</h3>
                              <p className="text-zinc-300 text-xs font-medium uppercase tracking-[0.2em] mb-8">Algo especial está esperando por você...</p>
                              <button 
                                onClick={() => setPartnerBlur(false)}
                                className={cn(
                                  "px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl active:scale-95 transition-all",
                                  isNaughtyMode ? "bg-red-600 text-white shadow-red-600/30" : "bg-white text-black shadow-white/10"
                                )}
                              >
                                {isNaughtyMode ? "VER TUDO AGORA 😈" : "REVELAR MATCH"}
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <motion.div 
                        initial={{ opacity: 0, scale: 0.8, y: 20 }}
                        animate={{ 
                          opacity: (isMatchedVisible && !partnerBlur) ? 1 : 0, 
                          scale: (isMatchedVisible && !partnerBlur) ? 1 : 0.8,
                          y: (isMatchedVisible && !partnerBlur) ? 0 : 20 
                        }}
                        className="absolute inset-0 flex flex-col items-center justify-center text-center p-6"
                      >
                        {/* Remote Quality Indicator */}
                        <div className="absolute top-6 left-6 z-30 flex flex-col gap-2">
                          <div className="flex items-center gap-2 bg-black/40 backdrop-blur-xl px-3 py-1.5 rounded-full border border-white/10">
                            <ConnectionIndicator quality={partnerQuality} size="sm" />
                            <span className="text-[10px] font-black text-white/70 uppercase tracking-tighter">Sinal do Parceiro</span>
                          </div>
                          
                          <motion.div 
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className={cn(
                              "flex items-center gap-2 bg-black/40 backdrop-blur-xl px-3 py-1.5 rounded-full border border-white/10 self-start",
                              callTimeLeft <= 10 ? "border-red-500 text-red-500 animate-pulse" : "text-white"
                            )}
                          >
                            <Loader2 size={12} className={cn(callTimeLeft > 0 && "animate-spin")} />
                            <span className="text-xs font-black tracking-tighter">{callTimeLeft}s restantes</span>
                          </motion.div>
                        </div>

                        <div className={cn(
                          "w-32 h-32 rounded-[2rem] border-4 p-1 mb-6 shadow-2xl transition-all duration-1000 rotate-3",
                          isNaughtyMode ? "border-red-600 shadow-red-600/50" : "border-pink-500 shadow-pink-500/50"
                        )}>
                          <img src={matchedUser?.photoURL || undefined} className="w-full h-full rounded-[1.75rem] object-cover" />
                        </div>
                        <h2 className={cn(
                          "text-4xl font-black italic uppercase tracking-tighter mb-2",
                          isNaughtyMode ? "text-white drop-shadow-[0_0_20px_rgba(220,38,38,1)]" : "text-white drop-shadow-[0_0_15px_rgba(236,72,153,0.8)]"
                        )}>{matchedUser?.displayName}</h2>
                        
                        <div className="flex flex-wrap justify-center gap-2 mt-4 max-w-xs">
                          {(matchedUser?.fetishes || []).map((f: string) => (
                            <span key={f} className={cn(
                              "text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full border",
                              isNaughtyMode ? "bg-red-600/20 text-red-500 border-red-500/20" : "bg-white/10 text-white border-white/10"
                            )}>
                              {f}
                            </span>
                          ))}
                        </div>

                        <p className={cn(
                          "font-black text-xs uppercase tracking-[0.3em] mt-8 px-6 py-2 rounded-2xl border transition-all animate-pulse",
                          isNaughtyMode 
                            ? "bg-red-600 text-white border-red-400 shadow-lg shadow-red-600/40" 
                            : "bg-pink-500 text-white border-pink-400 shadow-lg shadow-pink-500/20"
                        )}>
                          {translatedDisplay || matchedUser?.status || (isNaughtyMode ? "MODO EXPLÍCITO" : "HOT MATCH")}
                        </p>
                      </motion.div>
                    </div>
                  ) : (
                    <div className="h-full w-full flex flex-col items-center justify-center text-zinc-600 bg-zinc-950 relative overflow-hidden">
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(220,38,38,0.05),transparent)] animate-pulse" />
                      <motion.div 
                        animate={{ 
                          rotate: 360, 
                          scale: [1, 1.2, 1], 
                          filter: ["hue-rotate(0deg)", "hue-rotate(360deg)"],
                          boxShadow: ["0 0 20px rgba(220,38,38,0)", "0 0 60px rgba(220,38,38,0.4)", "0 0 20px rgba(220,38,38,0)"]
                        }}
                        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                        className="mb-8 p-6 rounded-full border-2 border-dashed border-red-500/20"
                      >
                        <RefreshCw size={80} className={isNaughtyMode ? "text-red-600" : "text-pink-500"} />
                      </motion.div>
                      <p className="text-lg font-black italic uppercase tracking-[0.3em] text-white/50 animate-pulse relative z-10">
                        {isNaughtyMode ? "DESCENDO AO SUBTERRÂNEO..." : "PROCURANDO CONEXÃO..."}
                      </p>
                      {/* Scanning Line */}
                      <motion.div 
                        initial={{ top: '0%' }}
                        animate={{ top: '100%' }}
                        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                        className="absolute left-0 right-0 h-[2px] bg-red-500/30 blur-sm shadow-[0_0_15px_rgba(220,38,38,0.8)] z-20"
                      />
                    </div>
                  )}
                </div>

                {/* Local Video (Self) */}
                <div className={cn(
                  "absolute top-6 right-6 w-32 h-44 bg-zinc-800 rounded-2xl border-2 shadow-2xl overflow-hidden z-20",
                  isNaughtyMode ? "border-red-500/50" : "border-white/20"
                )}>
                  {stream && (
                    <video 
                      ref={localVideoRef} 
                      muted 
                      playsInline 
                      className={cn("w-full h-full object-cover transform scale-x-[-1]", isCameraOff && "hidden")} 
                    />
                  )}
                  {isCameraOff && (
                    <div className="w-full h-full flex items-center justify-center bg-zinc-800">
                      <UserIcon size={32} className="text-zinc-600" />
                    </div>
                  )}

                  {/* Quality Indicator */}
                  <div className="absolute top-2 left-2 z-30">
                    <ConnectionIndicator quality={quality} />
                  </div>

                  <div className={cn(
                    "absolute bottom-2 left-2 bg-black/50 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest",
                    isNaughtyMode ? "text-red-500" : "text-pink-500"
                  )}>VOCÊ</div>
                </div>

                {/* Controls */}
                <div className="absolute bottom-10 left-0 right-0 flex justify-center items-center gap-6 z-30 px-6">
                  <button 
                    onClick={toggleMute}
                    className={cn(
                      "p-5 rounded-2xl transition-all shadow-xl border-2",
                      isMuted 
                        ? (isNaughtyMode ? "bg-red-600 border-red-500 text-white" : "bg-red-500 border-red-400 text-white") 
                        : "bg-white/10 backdrop-blur-xl border-white/10 text-white hover:bg-white/20"
                    )}
                  >
                    {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                  </button>

                  {status === 'matched' && (
                    <button 
                      onClick={async () => {
                        if (translatedDisplay) {
                          setTranslatedDisplay(null);
                          setIsLiveTranslating(false);
                        } else {
                          setIsLiveTranslating(true);
                          const trans = await translateText(matchedUser?.status || "Searching...");
                          setTranslatedDisplay(trans);
                        }
                      }}
                      className={cn(
                        "p-5 rounded-2xl transition-all shadow-xl border-2",
                        translatedDisplay 
                          ? (isNaughtyMode ? "bg-red-600 border-red-500 text-white" : "bg-pink-500 border-pink-400 text-white") 
                          : "bg-white/10 backdrop-blur-xl border-white/10 text-white hover:bg-white/20"
                      )}
                    >
                      {isTranslating && !translatedDisplay ? <Loader2 size={24} className="animate-spin" /> : <Languages size={24} />}
                    </button>
                  )}

                  <button 
                    onClick={stopSearching}
                    className={cn(
                      "p-8 rounded-3xl transition-all shadow-2xl active:scale-95 border-b-4",
                      isNaughtyMode 
                        ? "bg-red-600 hover:bg-red-700 text-white border-red-900" 
                        : "bg-white hover:bg-zinc-200 text-black border-zinc-300"
                    )}
                  >
                    <X size={36} strokeWidth={4} />
                  </button>

                  <button 
                    onClick={toggleCamera}
                    className={cn(
                      "p-5 rounded-2xl transition-all shadow-xl border-2",
                      isCameraOff 
                        ? (isNaughtyMode ? "bg-red-600 border-red-500 text-white" : "bg-red-500 border-red-400 text-white") 
                        : "bg-white/10 backdrop-blur-xl border-white/10 text-white hover:bg-white/20"
                    )}
                  >
                    {isCameraOff ? <VideoOff size={24} /> : <Video size={24} />}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'lives' && (
          <LivesList 
            onSelectLive={(live) => {
              setSelectedLive(live);
            }} 
            onStartLive={() => {
              setShowLiveBroadcast(true);
            }}
          />
        )}
      </div>

      <AnimatePresence>
        {selectedLive && (
          <LiveSession 
            live={selectedLive} 
            onClose={() => setSelectedLive(null)} 
          />
        )}
        {showLiveBroadcast && (
          <LiveBroadcast 
            onClose={() => setShowLiveBroadcast(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function FeatureBadge({ icon: Icon, label, className }: { icon: any, label: string, className?: string }) {
  return (
    <div className={cn(
      "flex items-center gap-3 py-3 px-5 bg-white/5 rounded-2xl border border-white/5 mx-auto w-fit",
      className
    )}>
      <Icon size={18} className={cn("text-pink-500", className?.includes('text-red-500') ? "text-red-500" : "text-pink-500")} />
      <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
    </div>
  );
}

function ConnectionIndicator({ quality, size = 'md' }: { quality: 'poor' | 'fair' | 'good' | 'excellent', size?: 'sm' | 'md' }) {
  const bars = {
    poor: 1,
    fair: 2,
    good: 3,
    excellent: 4
  };

  const colors = {
    poor: 'bg-red-500',
    fair: 'bg-yellow-500',
    good: 'bg-green-500',
    excellent: 'bg-cyan-500 shadow-[0_0_10px_#22d3ee]'
  };

  return (
    <div className="flex items-end gap-1 h-3">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className={cn(
            "rounded-full transition-all duration-500",
            size === 'sm' ? "w-1" : "w-1.5",
            i <= bars[quality] ? colors[quality] : "bg-white/10"
          )}
          style={{ height: `${i * 25}%` }}
        />
      ))}
    </div>
  );
}

