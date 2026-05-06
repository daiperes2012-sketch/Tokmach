import { useState, useRef, useEffect } from 'react';
import { X, Users, Heart, Share2, Send, Flame, MessageSquare, Gift, Coins } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../hooks/useAuth';

interface LiveStream {
  id: string;
  creatorId: string;
  creatorName: string;
  creatorPhoto: string;
  title: string;
  streamUrl: string;
  viewerCount: number;
}

interface Message {
  id: number;
  user: string;
  text: string;
  color: string;
}

export default function LiveSession({ live, onClose }: { live: LiveStream; onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [liked, setLiked] = useState(false);
  const [showGifts, setShowGifts] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { profile, updateProfile } = useAuth();
  
  const colors = ['text-blue-400', 'text-pink-400', 'text-yellow-400', 'text-green-400', 'text-purple-400'];
  const simulatedNames = ['Safadinha_88', 'LoverBoy', 'User99', 'HotGaby', 'NoiteFogo', 'PrivacyX', 'Ousado_123'];
  const simulatedTexts = [
    'Que delícia! 🫦',
    'Mostra mais!!',
    'Nossa, que vibe 🔥',
    'Oi linda!',
    'Top demais',
    'Amando essa live 🫦🫦',
    'Alguém de SP?',
    'Fogo no parquinho! 🔥🔥🔥'
  ];

  const gifts = [
    { id: 'rose', icon: '🌹', price: 10, label: 'Rosa' },
    { id: 'fire', icon: '🔥', price: 50, label: 'Fogo' },
    { id: 'heart', icon: '💝', price: 100, label: 'Amor' },
    { id: 'crown', icon: '👑', price: 500, label: 'Coroa' },
    { id: 'diamond', icon: '💎', price: 1000, label: 'Diamante' },
  ];

  useEffect(() => {
    // Simulate chat messages
    const interval = setInterval(() => {
      const newMessage: Message = {
        id: Date.now(),
        user: simulatedNames[Math.floor(Math.random() * simulatedNames.length)],
        text: simulatedTexts[Math.floor(Math.random() * simulatedTexts.length)],
        color: colors[Math.floor(Math.random() * colors.length)]
      };
      setMessages(prev => [...prev.slice(-20), newMessage]);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const sendGift = async (gift: typeof gifts[0]) => {
    if ((profile?.balance || 0) < gift.price) {
      alert("Saldo insuficiente! Compre mais moedas na loja.");
      return;
    }

    try {
      await updateProfile({ balance: (profile?.balance || 0) - gift.price });
      const newMessage: Message = {
        id: Date.now(),
        user: 'SISTEMA',
        text: `Enviou um(a) ${gift.label} ${gift.icon}!`,
        color: 'text-yellow-500 font-black'
      };
      setMessages(prev => [...prev.slice(-20), newMessage]);
      setShowGifts(false);
    } catch (e) {
      console.error(e);
    }
  };

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    
    const newMessage: Message = {
      id: Date.now(),
      user: 'Eu',
      text: inputText,
      color: 'text-white font-bold'
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
        {live.streamUrl && (
          <video 
            ref={videoRef}
            src={live.streamUrl}
            loop 
            muted 
            playsInline
            onLoadedMetadata={() => {
              const video = videoRef.current;
              if (video && (video.srcObject || video.src)) {
                video.muted = true;
                video.play().catch(e => {
                  if (e.name !== 'AbortError') {
                    console.warn("LiveSession video play failed", e);
                  }
                });
              }
            }}
            className="h-full w-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40" />
      </div>

      {/* Header */}
      <div className="relative p-6 flex justify-between items-start z-10 pt-12">
        <div className="flex items-center gap-3 bg-black/40 backdrop-blur-xl p-2 pr-4 rounded-full border border-white/10">
          <img src={live.creatorPhoto} className="w-10 h-10 rounded-full border-2 border-pink-500" />
          <div>
            <p className="text-white text-sm font-bold leading-none">{live.creatorName}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="bg-red-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded-sm uppercase tracking-tighter">LIVE</span>
              <div className="flex items-center gap-1 text-white/70 text-[10px]">
                <Users size={10} />
                {live.viewerCount}
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
        <div className="flex items-center gap-3">
          <form onSubmit={sendMessage} className="flex-1 flex items-center gap-3 bg-white/10 backdrop-blur-xl rounded-2xl px-4 py-3 border border-white/10">
            <input 
              type="text" 
              placeholder="Diga algo picante..." 
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="flex-1 bg-transparent border-none text-white text-sm placeholder:text-white/40 focus:ring-0 p-0"
            />
            <button type="submit">
              <Send size={18} className="text-pink-500" />
            </button>
          </form>

          <button 
            onClick={() => setLiked(!liked)}
            className={cn(
              "p-4 rounded-2xl transition-all border",
              liked ? "bg-pink-600 border-pink-500 text-white shadow-lg shadow-pink-600/30 scale-110" : "bg-white/10 border-white/10 text-white"
            )}
          >
            <Heart size={20} className={liked ? "fill-white" : ""} />
          </button>
          
          <button 
            onClick={() => setShowGifts(!showGifts)}
            className="p-4 bg-white/10 border border-white/10 rounded-2xl text-white hover:bg-white/20 transition-all relative"
          >
            <span className="absolute -top-1 -right-1 bg-yellow-500 text-black text-[8px] font-black px-1 rounded-full border border-black animate-bounce">
              GIFT
            </span>
            <Gift size={20} className="text-yellow-500" />
          </button>

          <button className="p-4 bg-white/10 border border-white/10 rounded-2xl text-white">
            <Share2 size={20} />
          </button>
        </div>
      </div>

      {/* Gifts Popup */}
      <AnimatePresence>
        {showGifts && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="absolute bottom-32 left-6 right-6 bg-black/60 backdrop-blur-3xl rounded-3xl p-6 border border-white/10 z-50"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-black italic tracking-tighter">ENVIAR PRESENTE</h3>
              <div className="flex items-center gap-1.5 bg-yellow-500/10 px-3 py-1 rounded-full border border-yellow-500/20">
                <Coins size={12} className="text-yellow-500" />
                <span className="text-[10px] font-bold text-yellow-500">{profile?.balance || 0}</span>
              </div>
            </div>
            <div className="grid grid-cols-5 gap-3">
              {gifts.map(gift => (
                <button
                  key={gift.id}
                  onClick={() => sendGift(gift)}
                  className="flex flex-col items-center gap-2 group active:scale-95 transition-all"
                >
                  <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-2xl group-hover:bg-white/10 border border-white/5 group-hover:border-white/20">
                    {gift.icon}
                  </div>
                  <span className="text-[8px] font-black text-yellow-500">{gift.price}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
