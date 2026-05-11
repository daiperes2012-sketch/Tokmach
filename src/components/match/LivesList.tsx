import { useState, useEffect, useRef, memo, useMemo } from 'react';
import { collection, query, onSnapshot, addDoc, serverTimestamp, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../services/firebase';
import { useAuth } from '../../hooks/useAuth';
import { Users, Flame, Play, Plus, Loader2, Sparkles, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface LiveStream {
  id: string;
  creatorId: string;
  creatorName: string;
  creatorPhoto: string;
  title: string;
  thumbnailUrl: string;
  streamUrl: string;
  viewerCount: number;
  tags: string[];
}

const CATEGORIES = ['Tudo', 'Hot', 'Conversa', 'BDSM', 'Private', 'Estreia'];

const LiveSkeleton = () => (
  <div className="aspect-[9/16] bg-zinc-900 rounded-3xl overflow-hidden border border-white/5 relative animate-pulse">
    <div className="absolute top-3 left-3 flex gap-2">
      <div className="w-12 h-4 bg-zinc-800 rounded" />
      <div className="w-10 h-4 bg-zinc-800 rounded" />
    </div>
    <div className="absolute bottom-4 left-4 right-4">
      <div className="w-full h-3 bg-zinc-800 rounded mb-2" />
      <div className="w-2/3 h-3 bg-zinc-800 rounded mb-4" />
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 bg-zinc-800 rounded-full" />
        <div className="w-16 h-2 bg-zinc-800 rounded" />
      </div>
    </div>
  </div>
);

const LiveCard = memo(({ 
  live, 
  onClick, 
  delay 
}: { 
  live: LiveStream, 
  onClick: () => void,
  delay: number 
}) => {
  const [isInView, setIsInView] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry.isIntersecting);
      },
      { threshold: 0.1, rootMargin: '100px' }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (isHovering && videoRef.current && isInView) {
      videoRef.current.play().catch(() => {});
    } else if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, [isHovering, isInView]);

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0 }}
      transition={{ 
        delay: delay * 0.03,
        duration: 0.4,
        ease: [0.16, 1, 0.3, 1]
      }}
      onClick={onClick}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      className="relative aspect-[9/16] bg-zinc-900 rounded-3xl overflow-hidden group cursor-pointer border border-white/5 shadow-2xl active:scale-95 transition-all duration-300"
    >
      {/* Thumbnail / Preview */}
      <div className="absolute inset-0 bg-zinc-800">
        <AnimatePresence mode="wait">
          {!isHovering ? (
            <motion.img
              key="thumb"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              src={live.thumbnailUrl || 'https://images.pexels.com/photos/1036622/pexels-photo-1036622.jpeg?auto=compress&cs=tinysrgb&w=1280'}
              className="w-full h-full object-cover grayscale group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-700"
              loading="lazy"
            />
          ) : (
            <motion.div
              key="preview"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full h-full relative"
            >
              <video
                ref={videoRef}
                src={live.streamUrl}
                muted
                loop
                playsInline
                onLoadedData={() => setVideoLoaded(true)}
                className={`w-full h-full object-cover transition-opacity duration-500 ${videoLoaded ? 'opacity-100' : 'opacity-0'}`}
              />
              {!videoLoaded && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-pink-500 animate-spin" />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/20 to-transparent" />
      
      {/* Top Badges */}
      <div className="absolute top-3 left-3 right-3 flex justify-between items-start">
        <div className="flex gap-1.5 flex-wrap">
          <span className="bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded-sm flex items-center gap-1 shadow-lg shadow-red-600/30 uppercase tracking-tighter italic">
            <Flame size={10} className="fill-white" />
            AO VIVO
          </span>
          <span className="bg-black/60 backdrop-blur-xl text-white text-[10px] font-black px-2 py-0.5 rounded-sm flex items-center gap-1 border border-white/10 shadow-lg leading-none">
            <Users size={10} className="text-pink-500" />
            {(live.viewerCount > 1000 ? (live.viewerCount/1000).toFixed(1) + 'k' : live.viewerCount)}
          </span>
        </div>
      </div>

      {/* Bottom Info */}
      <div className="absolute bottom-4 left-4 right-4 z-10">
        <div className="flex gap-1 mb-2">
            {(live.tags || []).slice(0, 2).map((tag, i) => (
                <span key={i} className="text-[8px] font-bold text-white/40 border border-white/10 px-1 rounded uppercase tracking-widest bg-black/20 backdrop-blur-sm">{tag}</span>
            ))}
        </div>
        <p className="text-white text-xs font-bold leading-tight line-clamp-2 mb-2 group-hover:text-pink-400 transition-colors drop-shadow-md">
          {live.title}
        </p>
        <div className="flex items-center gap-2">
          <div className="relative">
            <img src={live.creatorPhoto || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=compress&cs=tinysrgb&w=100'} className="w-6 h-6 rounded-full border-2 border-pink-500/30 object-cover" />
            <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full border border-black" />
          </div>
          <span className="text-[10px] font-bold text-white/90 truncate tracking-wide uppercase">{live.creatorName}</span>
        </div>
      </div>

      {/* Play Overlay Icon */}
      {!isHovering && (
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform scale-90 group-hover:scale-100 bg-black/20">
          <div className="w-14 h-14 bg-pink-500/20 backdrop-blur-2xl rounded-full flex items-center justify-center border border-white/20 shadow-2xl">
            <Play size={28} className="text-white fill-white ml-1" />
          </div>
        </div>
      )}
    </motion.div>
  );
});

LiveCard.displayName = 'LiveCard';

export default function LivesList({ onSelectLive, onStartLive }: { 
  onSelectLive: (live: LiveStream) => void, 
  onStartLive: () => void
}) {
  const [lives, setLives] = useState<LiveStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('Tudo');
  const { user } = useAuth();

  useEffect(() => {
    const q = query(collection(db, 'lives'), limit(20));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const d = doc.data();
        return { 
          id: doc.id, 
          tags: d.tags || [],
          ...d 
        };
      }) as LiveStream[];

      // Deduplicate by ID
      const seenIds = new Set<string>();
      const uniqueLives = data.filter(l => {
        if (seenIds.has(l.id)) return false;
        seenIds.add(l.id);
        return true;
      });

      setLives(uniqueLives);
      setLoading(false);
      
      if (data.length === 0 && user) {
        seedLives(user.uid);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'lives');
    });

    return () => unsubscribe();
  }, [user]);

  const filteredLives = useMemo(() => {
    if (activeCategory === 'Tudo') return lives;
    return lives.filter(live => (live.tags || []).some(tag => tag.toLowerCase() === activeCategory.toLowerCase()));
  }, [lives, activeCategory]);

  const seedLives = async (userId: string) => {
    try {
      const demoLives = [
        {
          creatorId: userId,
          creatorName: 'Gaby Lux',
          creatorPhoto: 'https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
          title: 'Festa privada no quarto... sem regras 🫦🔥',
          thumbnailUrl: 'https://images.pexels.com/photos/1125328/pexels-photo-1125328.jpeg?auto=compress&cs=tinysrgb&w=1280',
          streamUrl: 'https://www.w3schools.com/html/mov_bbb.mp4',
          viewerCount: 1240,
          tags: ['Private', 'Hot'],
          createdAt: serverTimestamp()
        },
        {
          creatorId: userId,
          creatorName: 'Bella Hot',
          creatorPhoto: 'https://images.pexels.com/photos/1587009/pexels-photo-1587009.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
          title: 'Bora conversar? 🫦 Só para os ousados.',
          thumbnailUrl: 'https://images.pexels.com/photos/1462637/pexels-photo-1462637.jpeg?auto=compress&cs=tinysrgb&w=1280',
          streamUrl: 'https://vjs.zencdn.net/v/oceans.mp4',
          viewerCount: 850,
          tags: ['Conversa', 'Estreia'],
          createdAt: serverTimestamp()
        },
        {
          creatorId: userId,
          creatorName: 'Mistress D',
          creatorPhoto: 'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
          title: 'Sessão BDSM ao vivo. Obedeça ou saia. ⛓️',
          thumbnailUrl: 'https://images.pexels.com/photos/704971/pexels-photo-704971.jpeg?auto=compress&cs=tinysrgb&w=1280',
          streamUrl: 'https://media.w3.org/2010/05/sintel/trailer.mp4',
          viewerCount: 2310,
          tags: ['BDSM', 'Private'],
          createdAt: serverTimestamp()
        }
      ];

      for (const live of demoLives) {
        await addDoc(collection(db, 'lives'), live);
      }
    } catch (err) {
      console.error("Error seeding lives:", err);
      handleFirestoreError(err, OperationType.WRITE, 'lives');
    }
  };

  const startMyLive = async () => {
    if (!user) return;
    onStartLive();
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-black overflow-hidden">
      {/* Category Header */}
      <div className="flex items-center gap-4 px-4 py-3 overflow-x-auto no-scrollbar border-b border-white/5 bg-black/40 backdrop-blur-xl shrink-0">
        <div className="p-2 bg-pink-500/10 rounded-lg border border-pink-500/20 text-pink-500 shrink-0">
            <Filter size={16} />
        </div>
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
              activeCategory === cat 
              ? 'bg-pink-600 text-white shadow-lg shadow-pink-600/30 ring-1 ring-white/20' 
              : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-24 no-scrollbar">
        {loading ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {[...Array(6)].map((_, i) => <LiveSkeleton key={`live-skeleton-${i}`} />)}
          </div>
        ) : filteredLives.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {filteredLives.map((live, idx) => (
              <LiveCard 
                key={live.id}
                live={live}
                delay={idx}
                onClick={() => onSelectLive(live)}
              />
            ))}
          </div>
        ) : (
          <div className="h-[60vh] flex flex-col items-center justify-center text-center px-8">
            <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center mb-6 border border-white/5 shadow-2xl">
                <Sparkles className="text-zinc-700" size={32} />
            </div>
            <h3 className="text-white font-black text-xl mb-2 italic">SEM LIVES NESSA CATEGORIA</h3>
            <p className="text-zinc-500 text-xs font-bold leading-relaxed uppercase tracking-wider">Seja o primeiro a começar uma live agora mesmo!</p>
            <button 
                onClick={startMyLive}
                className="mt-8 px-6 py-3 bg-white text-black font-black rounded-2xl text-xs uppercase tracking-tighter hover:bg-pink-500 hover:text-white transition-all shadow-xl"
            >
                INICIAR MINHA LIVE
            </button>
          </div>
        )}
      </div>

      <motion.button 
        whileHover={{ scale: 1.05, rotate: 5 }}
        whileTap={{ scale: 0.95 }}
        onClick={startMyLive}
        className="absolute bottom-24 right-6 w-16 h-16 bg-gradient-to-br from-pink-600 to-rose-600 text-white rounded-3xl shadow-2xl shadow-pink-600/40 flex items-center justify-center transition-all z-50 border border-white/20 group"
      >
        <Plus size={32} strokeWidth={3} className="group-hover:scale-110 transition-transform" />
      </motion.button>
    </div>
  );
}
