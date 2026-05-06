import { useState, useRef, useEffect } from 'react';
import { VideoPost, VideoComment } from '../../types';
import { Flame, MessageCircle, Share2, Music2, UserPlus, VideoOff, Send, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { db, handleFirestoreError, OperationType } from '../../services/firebase';
import { 
  collection, 
  addDoc, 
  getDocs,
  deleteDoc,
  query, 
  orderBy, 
  onSnapshot, 
  serverTimestamp, 
  where,
  increment, 
  doc, 
  updateDoc 
} from 'firebase/firestore';
import { useAuth } from '../../hooks/useAuth';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface VideoCardProps {
  video: VideoPost;
}

export default function VideoCard({ video }: VideoCardProps) {
  const { user, profile } = useAuth();
  const [playing, setPlaying] = useState(false);
  const [liked, setLiked] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<VideoComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Check if user has liked this video
  useEffect(() => {
    if (!user || !video.id) return;
    
    const q = query(
      collection(db, 'likes'),
      where('userId', '==', user.uid),
      where('videoId', '==', video.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setLiked(!snapshot.empty);
    }, (error) => {
      console.warn("Error checking like state", error);
    });

    return () => unsubscribe();
  }, [user, video.id]);

  const toggleLike = async () => {
    if (!user || !video.id) return;

    try {
      const q = query(
        collection(db, 'likes'),
        where('userId', '==', user.uid),
        where('videoId', '==', video.id)
      );
      
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        // Unlike: delete all matching like docs (should be only one)
        for (const likedDoc of snapshot.docs) {
          await deleteDoc(doc(db, 'likes', likedDoc.id));
        }
        // Decrement like count
        await updateDoc(doc(db, 'videos', video.id), {
          likesCount: increment(-1)
        });
      } else {
        // Like: create like doc
        await addDoc(collection(db, 'likes'), {
          userId: user.uid,
          videoId: video.id,
          createdAt: serverTimestamp()
        });
        // Increment like count
        await updateDoc(doc(db, 'videos', video.id), {
          likesCount: increment(1)
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'likes');
    }
  };

  const togglePlay = () => {
    if (videoRef.current && !hasError) {
      if (playing) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(console.error);
      }
      setPlaying(!playing);
    }
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (videoRef.current && !hasError) {
              videoRef.current.play().catch(error => {
                if (error.name !== "NotAllowedError") {
                  console.error("Autoplay error:", error);
                }
              });
              setPlaying(true);
            }
          } else {
            videoRef.current?.pause();
            setPlaying(false);
          }
        });
      },
      { threshold: 0.6 }
    );

    if (videoRef.current) observer.observe(videoRef.current);
    return () => observer.disconnect();
  }, [hasError]);

  useEffect(() => {
    if (showComments && video.id) {
      setLoadingComments(true);
      const q = query(
        collection(db, 'videos', video.id, 'comments'),
        orderBy('createdAt', 'desc')
      );
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const commentsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as VideoComment[];
        setComments(commentsData);
        setLoadingComments(false);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, `videos/${video.id}/comments`);
        setLoadingComments(false);
      });

      return () => unsubscribe();
    }
  }, [showComments, video.id]);

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}${window.location.pathname}?v=${video.id || ''}`;
    const shareData = {
      title: 'Confira este vídeo no Vibe Privada!',
      text: video.description || '',
      url: shareUrl,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareUrl);
        alert('Link copiado para a área de transferência!');
      }
    } catch (err) {
      console.error('Error sharing:', err);
      // Fallback
      try {
        await navigator.clipboard.writeText(shareUrl);
        alert('Link copiado para a área de transferência!');
      } catch (copyErr) {
        console.error('Copy failed:', copyErr);
      }
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newComment.trim() || !video.id) return;

    const commentText = newComment.trim();
    setNewComment('');

    try {
      await addDoc(collection(db, 'videos', video.id, 'comments'), {
        videoId: video.id,
        userId: user.uid,
        displayName: profile?.displayName || 'Anônimo',
        photoURL: profile?.photoURL || '',
        text: commentText,
        createdAt: serverTimestamp()
      });

      // Increment comment count
      await updateDoc(doc(db, 'videos', video.id), {
        commentsCount: increment(1)
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `videos/${video.id}/comments`);
    }
  };

  return (
    <div className="h-full w-full snap-start relative bg-black group">
      {!video.videoUrl || hasError ? (
        <div className="h-full w-full flex flex-col items-center justify-center bg-zinc-950 text-zinc-600 gap-4">
          <div className="p-8 rounded-full bg-zinc-900/50 border border-white/5">
            <VideoOff size={48} className="opacity-20" />
          </div>
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-[0.2em] font-black mb-1">Mídia Indisponível</p>
            <p className="text-[8px] text-zinc-500 font-mono">CODE: {video.id?.slice(0, 8)}</p>
          </div>
        </div>
      ) : video.type === 'photo' ? (
        <div className="h-full w-full relative">
          <img 
            src={video.videoUrl} 
            alt={video.description}
            className="h-full w-full object-cover opacity-90"
            onError={() => setHasError(true)}
          />
        </div>
      ) : (
        <video
          ref={videoRef}
          src={video.videoUrl}
          className="h-full w-full object-cover opacity-80"
          loop
          muted
          playsInline
          preload="metadata"
          onClick={togglePlay}
          onLoadedMetadata={(e) => {
            const videoElement = e.currentTarget;
            if (playing) {
               videoElement.play().catch(e => {
                 if (e.name !== 'AbortError' && e.name !== 'NotAllowedError') {
                   console.warn("Video autostart failed", e);
                 }
               });
            }
          }}
          onError={(e) => {
            const videoElement = e.currentTarget;
            console.warn("Video failed to load:", videoElement.src);
            setHasError(true);
          }}
          poster={video.thumbnailUrl}
        />
      )}

      <div className="absolute inset-0 bg-gradient-to-b from-purple-900/40 via-transparent to-black pointer-events-none" />

      {/* Right Actions */}
      <div className="absolute right-4 bottom-24 flex flex-col items-center gap-6 z-10">
        <div className="relative mb-2">
          <div className="w-12 h-12 rounded-full border-2 border-pink-500 overflow-hidden bg-zinc-800 shadow-lg shadow-pink-500/20">
            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${video.creatorId}`} alt="Creator" />
          </div>
          <button className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-pink-600 text-white rounded-full p-0.5 hover:scale-110 shadow-lg">
            <UserPlus size={14} />
          </button>
        </div>

        <button 
          onClick={toggleLike}
          className="flex flex-col items-center gap-1 group/btn"
        >
          <motion.div 
            animate={liked ? { 
              scale: [1, 1.6, 1.2, 1.4, 1], 
              rotate: [0, -20, 20, -10, 0],
              filter: ["drop-shadow(0 0 0px #ec4899)", "drop-shadow(0 0 20px #ec4899)", "drop-shadow(0 0 10px #ec4899)"]
            } : {}}
            transition={{ duration: 0.6 }}
            className={cn(
              "p-3 rounded-full bg-black/40 backdrop-blur-md transition-all active:scale-90 border border-white/5",
              liked ? "text-pink-500 bg-pink-500/20 border-pink-500/30" : "text-white"
            )}
          >
            <Flame size={28} fill={liked ? "currentColor" : "none"} strokeWidth={liked ? 1.5 : 2} />
          </motion.div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-300 drop-shadow-md">{video.likesCount}</span>
        </button>



        <button 
          onClick={() => setShowComments(true)}
          className="flex flex-col items-center gap-1 group/btn"
        >
          <div className="p-3 rounded-full bg-black/40 backdrop-blur-md text-white transition-all active:scale-90 border border-white/5 hover:bg-white/10">
            <MessageCircle size={28} />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-300 drop-shadow-md">{video.commentsCount}</span>
        </button>

        <button 
          onClick={handleShare}
          className="flex flex-col items-center gap-1 group/btn"
        >
          <div className="p-3 rounded-full bg-black/40 backdrop-blur-md text-white transition-all active:scale-90 border border-white/5 hover:bg-white/10">
            <Share2 size={28} />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-300 drop-shadow-md">Enviar</span>
        </button>
      </div>

      {/* Comments Drawer */}
      <AnimatePresence>
        {showComments && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowComments(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="absolute bottom-0 left-0 right-0 h-[70%] bg-zinc-900 rounded-t-3xl z-50 flex flex-col overflow-hidden shadow-2xl border-t border-white/10"
            >
              <div className="p-4 flex items-center justify-between border-b border-white/5 bg-zinc-900/50 backdrop-blur-md sticky top-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold uppercase tracking-widest text-xs text-zinc-400">Comentários</h3>
                  <span className="bg-zinc-800 text-zinc-500 text-[10px] px-2 py-0.5 rounded-full font-mono">
                    {video.commentsCount}
                  </span>
                </div>
                <button 
                  onClick={() => setShowComments(false)}
                  className="p-2 hover:bg-white/5 rounded-full transition-colors text-zinc-500"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
                {loadingComments ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 className="animate-spin text-pink-500" size={24} />
                  </div>
                ) : comments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-zinc-600 gap-4">
                    <MessageCircle size={48} className="opacity-10" />
                    <p className="text-[10px] uppercase tracking-[0.2em] font-medium">Seja o primeiro a comentar</p>
                  </div>
                ) : (
                  comments.map((comment) => (
                    <div key={comment.id} className="flex gap-3 group/comment">
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-zinc-800 shrink-0 border border-white/5">
                        <img 
                          src={comment.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${comment.userId}`} 
                          alt={comment.displayName} 
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="font-bold text-[11px] text-zinc-300">@{comment.displayName}</span>
                          <span className="text-[9px] text-zinc-600 font-mono">
                            {comment.createdAt?.toDate ? new Date(comment.createdAt.toDate()).toLocaleDateString() : 'Agora'}
                          </span>
                        </div>
                        <p className="text-sm text-zinc-400 leading-relaxed">{comment.text}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <form 
                onSubmit={handleAddComment}
                className="p-4 border-t border-white/5 bg-zinc-900/80 backdrop-blur-xl sticky bottom-0"
              >
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Adicione um comentário..."
                    className="flex-1 bg-white/5 border border-white/10 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-pink-500/50 transition-colors placeholder:text-zinc-600"
                  />
                  <button
                    type="submit"
                    disabled={!newComment.trim()}
                    className="w-10 h-10 rounded-full bg-pink-600 flex items-center justify-center text-white active:scale-90 transition-transform disabled:opacity-50 disabled:grayscale"
                  >
                    <Send size={18} />
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Bottom Info */}
      <div className="absolute left-4 right-16 bottom-6 z-10">
        <div className="flex items-center gap-2 mb-2">
          <h3 className="font-bold text-lg tracking-tight text-white drop-shadow-md">@{video.creatorId}</h3>
          <span className="bg-pink-500/20 text-pink-500 text-[8px] px-1.5 py-0.5 rounded font-bold uppercase tracking-widest border border-pink-500/30">Hot</span>
        </div>
        <p className="text-sm line-clamp-2 mb-4 leading-relaxed text-zinc-200 drop-shadow-sm">{video.description}</p>
        
        <div className="flex items-center gap-2 overflow-hidden bg-black/20 w-fit px-3 py-1 rounded-full backdrop-blur-sm border border-white/5">
          <Music2 size={14} className="shrink-0 text-pink-500 animate-pulse" />
          <div className="text-[10px] font-medium whitespace-nowrap overflow-hidden text-zinc-300 uppercase tracking-widest">
            <motion.p
              animate={{ x: [0, -150] }}
              transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
              className="inline-block px-1"
            >
              Som original - {video.creatorId} • Vibe Privada • Som original - {video.creatorId}
            </motion.p>
          </div>
        </div>
      </div>

      {/* Play/Pause Overlay */}
      <AnimatePresence>
        {!playing && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.5 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/10"
          >
            <div className="bg-black/40 p-10 rounded-full backdrop-blur-md border border-white/10 shadow-2xl">
              <Flame size={80} className="text-pink-500/40" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
