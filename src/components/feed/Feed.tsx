import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../services/firebase';
import { useAuth } from '../../hooks/useAuth';
import { VideoPost } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, Plus, VideoOff } from 'lucide-react';
import { cn } from '../../lib/utils';
import PhotoUploadModal from '../common/PhotoUploadModal';

// Lazy load VideoCard for better initial performance
const VideoCard = lazy(() => import('./VideoCard'));

// Placeholder component for lazy loading
function VideoCardPlaceholder({ id }: { id?: string }) {
  return (
    <div className="h-full w-full snap-start relative bg-black flex flex-col items-center justify-center text-zinc-600 gap-4">
      <div className="p-8 rounded-full bg-zinc-900/50 border border-white/5">
        <VideoOff size={48} className="opacity-20 animate-pulse" />
      </div>
      <div className="text-center">
        <p className="text-[10px] uppercase tracking-[0.2em] font-black mb-1 animate-pulse">Carregando...</p>
        {id && <p className="text-[8px] text-zinc-500 font-mono opacity-50">CODE: {id.slice(0, 8)}</p>}
      </div>
    </div>
  );
}

// Wrapper to only render VideoCard when it's near the viewport
function LazyVideoCard({ video, openProfile }: { video: VideoPost, openProfile: (uid: string) => void }) {
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Increase margin to preload earlier for smoother scrolling
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      {
        rootMargin: '1000px 0px', // Load 1-2 screens ahead
        threshold: 0.01
      }
    );

    const currentRef = containerRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div 
      ref={containerRef} 
      className="h-full w-full snap-start relative bg-black shrink-0"
    >
      <Suspense fallback={<VideoCardPlaceholder id={video.id} />}>
        {isVisible ? <VideoCard video={video} openProfile={openProfile} /> : <VideoCardPlaceholder id={video.id} />}
      </Suspense>
    </div>
  );
}

export default function Feed({ openProfile }: { openProfile: (uid: string) => void }) {
  const { user, profile, isQuotaExceeded } = useAuth();
  const [videos, setVideos] = useState<VideoPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    
    // Safety timeout for loading state
    const loadingTimeout = setTimeout(() => {
      setLoading(false);
    }, 5000);

    const q = query(collection(db, 'videos'), orderBy('createdAt', 'desc'), limit(20));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      clearTimeout(loadingTimeout);
      const allVideoData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as VideoPost[];
      
      // Deduplicate by ID and basic validation
      const seenIds = new Set<string>();
      const validVideos = allVideoData.filter(v => {
        if (!v.videoUrl || seenIds.has(v.id)) return false;
        seenIds.add(v.id);
        return true;
      });
      
      setVideos(validVideos);
      setLoading(false);
      
      // Only seed if absolutely no videos exist in the collection
      if (allVideoData.length === 0 && user && !isQuotaExceeded) {
        seedVideos(user.uid, []);
      }
    }, (error) => {
      clearTimeout(loadingTimeout);
      handleFirestoreError(error, OperationType.LIST, 'videos');
      setLoading(false);
    });

    return () => {
      unsubscribe();
      clearTimeout(loadingTimeout);
    };
  }, [user, isQuotaExceeded]);

  const seedVideos = async (userId: string, existingUrls: string[]) => {
    const path = 'videos';
    const demoVideos = [
      {
        creatorId: userId,
        userName: 'TokMatch Official',
        userAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=TokMatch',
        videoUrl: 'https://images.pexels.com/photos/1382731/pexels-photo-1382731.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
        thumbnailUrl: 'https://images.pexels.com/photos/1382731/pexels-photo-1382731.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
        description: 'Vibe refrescante do verão... ✨ #nature #calm',
        likesCount: 1240,
        commentsCount: 88,
        createdAt: serverTimestamp(),
        type: 'photo'
      },
      {
        creatorId: userId,
        userName: 'Art Explorer',
        userAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Art',
        videoUrl: 'https://images.pexels.com/photos/1122462/pexels-photo-1122462.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
        thumbnailUrl: 'https://images.pexels.com/photos/1122462/pexels-photo-1122462.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
        description: 'Explorando cores e luzes. 🐻 #art #aesthetic',
        likesCount: 850,
        commentsCount: 45,
        createdAt: serverTimestamp(),
        type: 'photo'
      }
    ];

    for (const video of demoVideos) {
      if (existingUrls.includes(video.videoUrl)) continue;
      try {
        await addDoc(collection(db, path), video);
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, path);
      }
    }
  };

  if (loading && videos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-black">
        <Loader2 className="animate-spin text-pink-500 mb-4" size={40} />
        <p className="text-[10px] font-black text-pink-500/50 uppercase tracking-[0.3em] animate-pulse">Sincronizando Feed...</p>
      </div>
    );
  }

  return (
    <div className="relative h-full bg-black">
      {videos.length > 0 ? (
        <div 
          className="h-full overflow-y-scroll snap-y snap-mandatory no-scrollbar"
          ref={scrollRef}
        >
          {videos.map((video) => (
            <LazyVideoCard key={video.id} video={video} openProfile={openProfile} />
          ))}
        </div>
      ) : (
        <div className="h-full flex flex-col items-center justify-center p-12 text-center text-zinc-600 gap-6">
          <div className="p-8 rounded-full bg-zinc-900/50 border border-white/5">
            <VideoOff size={48} className="opacity-20" />
          </div>
          <div>
            <h3 className="text-white font-black italic uppercase tracking-tighter text-xl mb-2">Nada por aqui...</h3>
            <p className="text-sm font-medium leading-relaxed max-w-[200px] mx-auto">Não encontramos fotos no feed. Tente novamente mais tarde.</p>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="px-8 py-3 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all active:scale-95"
          >
            Actualizar Página
          </button>
        </div>
      )}

      {/* Floating Plus Button */}
      <div className="absolute bottom-6 right-6 z-40">
        <button 
          onClick={() => setShowUploadModal(true)}
          className="w-14 h-14 rounded-full flex items-center justify-center shadow-2xl bg-gradient-to-tr from-pink-500 to-violet-600 active:scale-95 transition-all"
        >
          <Plus size={32} className="text-white" />
        </button>
      </div>

      <PhotoUploadModal 
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
      />
    </div>
  );
}
