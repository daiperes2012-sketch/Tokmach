import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, getDocs, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../services/firebase';
import { useAuth } from '../../hooks/useAuth';
import { Users, Flame, Play, Plus } from 'lucide-react';
import { motion } from 'motion/react';

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

export default function LivesList({ onSelectLive, onVerifRequired, onStartLive }: { 
  onSelectLive: (live: LiveStream) => void, 
  onVerifRequired: (action: () => void) => void,
  onStartLive: () => void
}) {
  const [lives, setLives] = useState<LiveStream[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, profile } = useAuth();

  useEffect(() => {
    const q = query(collection(db, 'lives'), limit(20));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as LiveStream[];
      setLives(data);
      setLoading(false);
      
      if (data.length === 0 && user) {
        seedLives(user.uid);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'lives');
    });

    return () => unsubscribe();
  }, [user]);

  const seedLives = async (userId: string) => {
    const demoLives = [
      {
        creatorId: userId,
        creatorName: 'Gaby Lux',
        creatorPhoto: 'https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
        title: 'Festa privada no quarto... sem regras 🫦🔥',
        thumbnailUrl: 'https://images.pexels.com/photos/30598686/pexels-photo-30598686/free-photo-of-close-up-de-pimentas-frescas-em-fundo-branco.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
        streamUrl: 'https://www.w3schools.com/html/mov_bbb.mp4',
        viewerCount: 1240,
        tags: ['Private', 'NoLimits', 'Hot'],
        createdAt: serverTimestamp()
      },
      {
        creatorId: userId,
        creatorName: 'Bella Hot',
        creatorPhoto: 'https://images.pexels.com/photos/1587009/pexels-photo-1587009.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
        title: 'Bora conversar? 🫦 Só para os ousados.',
        thumbnailUrl: 'https://images.pexels.com/photos/3782789/pexels-photo-3782789.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
        streamUrl: 'https://vjs.zencdn.net/v/oceans.mp4',
        viewerCount: 850,
        tags: ['Chat', 'Open', 'Fun'],
        createdAt: serverTimestamp()
      },
      {
        creatorId: userId,
        creatorName: 'Mistress D',
        creatorPhoto: 'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
        title: 'Sessão BDSM ao vivo. Obedeça ou saia. ⛓️',
        thumbnailUrl: 'https://images.pexels.com/photos/33129/popcorn-movie-party-entertainment.jpg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
        streamUrl: 'https://media.w3.org/2010/05/sintel/trailer.mp4',
        viewerCount: 2310,
        tags: ['BDSM', 'Mistress', 'Hard'],
        createdAt: serverTimestamp()
      }
    ];

    for (const live of demoLives) {
      await addDoc(collection(db, 'lives'), live);
    }
  };

  const startMyLive = async () => {
    if (!user) return;
    
    if (!profile?.ageVerified) {
      onVerifRequired(onStartLive);
      return;
    }

    onStartLive();
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 pb-24 no-scrollbar">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {lives.map((live, idx) => (
          <motion.div
            key={live.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            onClick={() => {
              if (!profile?.ageVerified) {
                onVerifRequired(() => onSelectLive(live));
              } else {
                onSelectLive(live);
              }
            }}
            className="relative aspect-[9/16] bg-zinc-900 rounded-3xl overflow-hidden group cursor-pointer border border-white/5 active:scale-95 transition-all"
          >
            <img src={live.thumbnailUrl} className="w-full h-full object-cover grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-500" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
            
            <div className="absolute top-3 left-3 flex gap-2">
              <span className="bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded-sm flex items-center gap-1 shadow-lg shadow-red-600/30 uppercase tracking-tighter italic animate-pulse">
                <Flame size={10} className="fill-white" />
                AO VIVO
              </span>
              <span className="bg-black/60 backdrop-blur-xl text-white text-[10px] font-black px-2 py-0.5 rounded-sm flex items-center gap-1 border border-white/10">
                <Users size={10} className="text-pink-500" />
                {live.viewerCount.toLocaleString()}
              </span>
            </div>

            <div className="absolute bottom-4 left-4 right-4">
              <p className="text-white text-xs font-bold leading-tight line-clamp-2 mb-2">{live.title}</p>
              <div className="flex items-center gap-2">
                <img src={live.creatorPhoto} className="w-5 h-5 rounded-full border border-white/20" />
                <span className="text-[10px] font-medium text-white/70 truncate">{live.creatorName}</span>
              </div>
            </div>

            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-xl rounded-full flex items-center justify-center">
                <Play size={24} className="text-white fill-white ml-1" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <button 
        onClick={startMyLive}
        className="fixed bottom-24 right-6 w-14 h-14 bg-pink-600 hover:bg-pink-500 text-white rounded-2xl shadow-xl shadow-pink-600/30 flex items-center justify-center transition-all active:scale-95 z-50"
      >
        <Plus size={28} strokeWidth={3} />
      </button>
    </div>
  );
}
