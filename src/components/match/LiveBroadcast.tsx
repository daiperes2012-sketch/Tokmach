import { useState, useRef, useEffect } from 'react';
import { X, Camera, Mic, MicOff, VideoOff, Video, Send, Users, Heart, Share2, MessageSquare, Gift, Coins, Loader2, Smile } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { collection, addDoc, serverTimestamp, deleteDoc, doc, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../services/firebase';

interface Message {
  id: string;
  user: string;
  text: string;
  color: string;
}

export default function LiveBroadcast({ onClose }: { onClose: () => void }) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [liveId, setLiveId] = useState<string | null>(null);
  const [viewers, setViewers] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const commonEmojis = ['❤️', '🔥', '👏', '🙌', '😍', '✨', '😂', '💯', '🙏', '🎉', '🌟', '💎', '🚀', '👑', '🌈'];
  const { profile, user } = useAuth();
  const { toast } = useToast();

  const colors = ['text-blue-400', 'text-pink-400', 'text-yellow-400', 'text-green-400', 'text-purple-400'];

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
      if (liveId) deleteDoc(doc(db, 'lives', liveId));
    };
  }, []);

  useEffect(() => {
    if (stream && videoRef.current) {
      const video = videoRef.current;
      if (video.srcObject !== stream) {
        video.srcObject = stream;
        video.muted = true;
        video.play().catch(e => {
          if (e.name !== 'AbortError') {
            console.warn("Live broadcast video play failed in effect", e);
          }
        });
      }
    }
  }, [stream]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      setStream(mediaStream);
    } catch (err) {
      console.error('Error accessing camera:', err);
      toast('error', 'Não foi possível acessar a câmera. Verifique as permissões.');
      onClose();
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const startLive = async () => {
    if (!user || !profile) return;
    setIsStarting(true);
    try {
      const docRef = await addDoc(collection(db, 'lives'), {
        creatorId: user.uid,
        creatorName: profile.displayName,
        creatorPhoto: profile.photoURL,
        title: `${profile.displayName} está AO VIVO! 👋`,
        viewerCount: 0,
        tags: ['Geral', 'Novo'],
        thumbnailUrl: profile.photoURL || 'https://images.pexels.com/photos/1036622/pexels-photo-1036622.jpeg?auto=compress&cs=tinysrgb&w=1280',
        streamUrl: 'https://www.w3schools.com/html/mov_bbb.mp4', // Local demo stream
        createdAt: serverTimestamp(),
        status: 'online'
      });
      setLiveId(docRef.id);
      setIsStarting(false);
      
      // Simulate viewers and messages
      const interval = setInterval(() => {
        setViewers(prev => prev + Math.floor(Math.random() * 5));
      }, 5000);
      
      return () => clearInterval(interval);
    } catch (err) {
      console.error('Error starting live:', err);
      setIsStarting(false);
      handleFirestoreError(err, OperationType.CREATE, 'lives');
    }
  };

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    
    const newMessage: Message = {
      id: (Date.now() + Math.random()).toString(),
      user: 'Eu (Host)',
      text: inputText,
      color: 'text-pink-500 font-bold'
    };
    setMessages(prev => [...prev.slice(-20), newMessage]);
    setInputText('');
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black flex flex-col"
    >
      {/* Video Content */}
      <div className="absolute inset-0">
        {stream && (
          <video 
            ref={videoRef}
            muted 
            playsInline
            className={cn("h-full w-full object-cover transform scale-x-[-1]", isCameraOff && "hidden")}
          />
        )}
        {isCameraOff && (
          <div className="h-full w-full bg-zinc-900 flex flex-col items-center justify-center gap-4">
             <VideoOff size={64} className="text-zinc-700" />
             <p className="text-zinc-500 font-bold">Câmera Desativada</p>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40" />
      </div>

      {/* Header */}
      <div className="relative p-6 flex justify-between items-start z-10 pt-12">
        <div className="flex items-center gap-3 bg-black/40 backdrop-blur-xl p-2 pr-4 rounded-full border border-white/10">
          <img src={profile?.photoURL || undefined} className="w-10 h-10 rounded-full border-2 border-pink-500" />
          <div>
            <p className="text-white text-sm font-bold leading-none">{profile?.displayName}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className={cn(
                "text-white text-[8px] font-black px-1.5 py-0.5 rounded-sm uppercase tracking-tighter",
                liveId ? "bg-red-600 animate-pulse" : "bg-zinc-600"
              )}>
                {liveId ? 'AO VIVO' : 'OFFLINE'}
              </span>
              <div className="flex items-center gap-1 text-white/70 text-[10px]">
                <Users size={10} />
                {viewers}
              </div>
            </div>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="w-10 h-10 bg-black/40 backdrop-blur-xl rounded-full flex items-center justify-center text-white border border-white/10"
        >
          <X size={24} />
        </button>
      </div>

      {!liveId && (
        <div className="flex-1 flex flex-col items-center justify-center relative z-10 p-6 text-center">
           <h2 className="text-3xl font-black italic tracking-tighter text-white mb-4">PRONTO PARA BRILHAR?</h2>
           <p className="text-zinc-400 mb-8 max-w-xs">Inicie sua live agora e comece a receber presentes de seus seguidores!</p>
           <button
             onClick={startLive}
             disabled={isStarting}
             className="w-full max-w-xs py-5 bg-pink-600 hover:bg-pink-500 text-white font-black rounded-2xl shadow-2xl shadow-pink-600/40 transition-all flex items-center justify-center gap-3 active:scale-95"
           >
             {isStarting ? (
               <Loader2 size={24} className="animate-spin" />
             ) : (
               <>
                 INICIAR STREAMING
                 <Video size={20} />
               </>
             )}
           </button>
        </div>
      )}

      {liveId && (
        <div className="mt-auto relative z-10 flex flex-col p-6 pb-12 gap-6 bg-gradient-to-t from-black/90 to-transparent">
          {/* Chat Messages */}
          <div className="h-48 overflow-y-auto flex flex-col gap-2 no-scrollbar">
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-black/20 backdrop-blur-sm p-2 rounded-xl border border-white/5 self-start max-w-[80%]"
                >
                  <p className="text-xs">
                    <span className={cn("font-bold mr-2", msg.color)}>{msg.user}:</span>
                    <span className="text-white/90">{msg.text}</span>
                  </p>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center gap-3 relative">
            <form onSubmit={sendMessage} className="flex-1 flex items-center gap-3 bg-white/10 backdrop-blur-xl rounded-2xl px-4 py-3 border border-white/10">
              <button 
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="text-white/60 hover:text-pink-500 transition-colors"
              >
                <Smile size={20} />
              </button>
              <input 
                type="text" 
                placeholder="Interaja com seus fãs..." 
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="flex-1 bg-transparent border-none text-white text-sm placeholder:text-white/40 focus:ring-0 p-0"
              />
              <button type="submit">
                <Send size={18} className="text-pink-500" />
              </button>
            </form>

            <AnimatePresence>
              {showEmojiPicker && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute bottom-full left-0 mb-4 bg-zinc-900 border border-white/10 rounded-2xl p-3 shadow-2xl backdrop-blur-xl z-[110] grid grid-cols-5 gap-2"
                >
                  {commonEmojis.map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => {
                        setInputText(prev => prev + emoji);
                        setShowEmojiPicker(false);
                      }}
                      className="text-xl hover:bg-white/10 p-2 rounded-xl transition-all active:scale-90"
                    >
                      {emoji}
                    </button>
                  ))}
                  <div className="absolute w-4 h-4 bg-zinc-900 border-r border-b border-white/10 rotate-45 -bottom-2 left-6" />
                </motion.div>
              )}
            </AnimatePresence>

            <button 
              onClick={() => {
                setIsMuted(!isMuted);
                if (stream) {
                  stream.getAudioTracks().forEach(track => track.enabled = isMuted);
                }
              }}
              className={cn(
                "p-4 rounded-2xl transition-all border",
                isMuted ? "bg-red-600 border-red-500 text-white" : "bg-white/10 border-white/10 text-white"
              )}
            >
              {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
            </button>
            
            <button 
              onClick={() => {
                setIsCameraOff(!isCameraOff);
                if (stream) {
                  stream.getVideoTracks().forEach(track => track.enabled = isCameraOff);
                }
              }}
              className={cn(
                "p-4 rounded-2xl transition-all border",
                isCameraOff ? "bg-red-600 border-red-500 text-white" : "bg-white/10 border-white/10 text-white"
              )}
            >
              {isCameraOff ? <VideoOff size={20} /> : <Video size={20} />}
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
