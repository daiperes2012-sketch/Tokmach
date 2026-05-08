import { useState, useRef, useEffect, memo } from 'react';
import { VideoPost, VideoComment } from '../../types';
import { Flame, MessageCircle, Share2, Music2, UserPlus, VideoOff, Send, X, Loader2, MoreVertical, Trash2, Edit3, Check } from 'lucide-react';
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
  updateDoc,
  setDoc
} from 'firebase/firestore';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface VideoCardProps {
  video: VideoPost;
}

const VideoCard = memo(function VideoCard({ video }: VideoCardProps) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [playing, setPlaying] = useState(false);
  const [liked, setLiked] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<VideoComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editDescription, setEditDescription] = useState(video.description || '');
  // Presence and focus tracking
  const [hasStartedLoading, setHasStartedLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const isOwner = user?.uid === video.creatorId;

  // Check if user has liked this video - Only when card is near visible
  useEffect(() => {
    if (!user || !video.id || !hasStartedLoading) return;
    
    // Check if user has liked this video - using specific ID for efficiency
    const likeDocRef = doc(db, 'likes', `${user.uid}_${video.id}`);
    
    const unsubscribe = onSnapshot(likeDocRef, (snapshot) => {
      setLiked(snapshot.exists());
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `likes/${user.uid}_${video.id}`);
    });

    return () => unsubscribe();
  }, [user, video.id, hasStartedLoading]);

  const toggleLike = async () => {
    if (!user || !video.id) return;

    const likeDocRef = doc(db, 'likes', `${user.uid}_${video.id}`);
    
    try {
      if (liked) {
        // Unlike: delete the specific like doc
        await deleteDoc(likeDocRef);
        // Decrement like count
        await updateDoc(doc(db, 'videos', video.id), {
          likesCount: increment(-1)
        });
      } else {
        // Like: create like doc with specific ID
        await setDoc(likeDocRef, {
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

  const [confirmingAction, setConfirmingAction] = useState<'delete' | 'delete-comment' | null>(null);
  const [targetCommentId, setTargetCommentId] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!video.id || isDeleting) return;
    
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'videos', video.id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `videos/${video.id}`);
    } finally {
      setIsDeleting(false);
      setShowMenu(false);
      setConfirmingAction(null);
    }
  };

  const handleUpdate = async () => {
    if (!video.id || isUpdating || !editDescription.trim()) return;

    setIsUpdating(true);
    try {
      await updateDoc(doc(db, 'videos', video.id), {
        description: editDescription.trim()
      });
      setShowEditModal(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `videos/${video.id}`);
    } finally {
      setIsUpdating(false);
    }
  };

  useEffect(() => {
    // We already have a parent LazyVideoCard, but we want to control
    // precisely when to PLAY versus just being MOUNTED (near).
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // Internal visibility for preloading/likes
          if (entry.isIntersecting && entry.intersectionRatio > 0.05) {
            setHasStartedLoading(true);
          }

          // Focus logic for autoplay (requires more of the video to be visible)
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            setIsFocused(true);
            if (videoRef.current && !hasError && video.type !== 'photo') {
              const playPromise = videoRef.current.play();
              if (playPromise !== undefined) {
                playPromise.catch(error => {
                  if (error.name !== "NotAllowedError" && error.name !== "AbortError") {
                    console.warn("Video play failed:", error);
                  }
                });
              }
              setPlaying(true);
            }
          } else {
            setIsFocused(false);
            if (videoRef.current && video.type !== 'photo') {
              videoRef.current.pause();
            }
            setPlaying(false);
          }
        });
      },
      { 
        threshold: [0.05, 0.6] // Multiple thresholds for different quality levels
      }
    );

    if (videoRef.current || video.type === 'photo') {
      const element = videoRef.current || (document.getElementById(`video-container-${video.id}`));
      if (element) observer.observe(element);
    }
    
    return () => observer.disconnect();
  }, [hasError, video.type, video.id]);

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
        toast('info', 'Link copiado para a área de transferência!');
      }
    } catch (err) {
      console.error('Error sharing:', err);
      // Fallback
      try {
        await navigator.clipboard.writeText(shareUrl);
        toast('info', 'Link copiado para a área de transferência!');
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

  const handleDeleteComment = async (commentId: string) => {
    if (!video.id || !commentId || isDeleting) return;

    try {
      await deleteDoc(doc(db, 'videos', video.id, 'comments', commentId));
      // Decrement comment count
      await updateDoc(doc(db, 'videos', video.id), {
        commentsCount: increment(-1)
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `videos/${video.id}/comments/${commentId}`);
    } finally {
      setConfirmingAction(null);
      setTargetCommentId(null);
    }
  };

  return (
    <div id={`video-container-${video.id}`} className="h-full w-full relative bg-black group">
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
      ) : video.type === 'photo' || (video.videoUrl && (video.videoUrl.startsWith('data:image/') || video.videoUrl.match(/\.(jpg|jpeg|png|webp|gif|svg)$|dicebear/i))) ? (
        <div className="h-full w-full relative">
          <img 
            src={video.videoUrl} 
            alt={video.description}
            className={cn(
              "h-full w-full object-cover transition-opacity duration-700 will-change-transform",
              hasStartedLoading ? "opacity-90" : "opacity-0"
            )}
            loading="lazy"
            decoding="async"
            onError={() => setHasError(true)}
          />
        </div>
      ) : (
        <video
          key={video.videoUrl}
          ref={videoRef}
          src={video.videoUrl} 
          className={cn(
            "h-full w-full object-cover transition-opacity duration-700 will-change-transform",
            hasStartedLoading ? "opacity-80" : "opacity-0"
          )}
          loop
          muted
          playsInline
          preload="metadata"
          onClick={togglePlay}
          onCanPlay={() => {
            if (playing && videoRef.current) {
               videoRef.current.play().catch(() => {});
            }
          }}
          onError={(e) => {
            const videoElement = e.currentTarget;
            if (videoElement.error && videoElement.error.code === 4) {
               console.warn("Video source not supported or missing:", video.videoUrl);
            }
            setHasError(true);
          }}
          poster={video.thumbnailUrl}
        />
      )}

      <div className="absolute inset-0 bg-gradient-to-b from-purple-900/40 via-transparent to-black pointer-events-none" />

      {/* Top Header Actions */}
      <div className="absolute top-6 left-0 right-0 px-4 flex items-center justify-between z-20">
        <div className="flex items-center gap-2">
          {/* Back button or logo could go here if needed, but keeping it clean */}
        </div>
        
        {isOwner && (
          <div className="relative">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="p-2 bg-black/20 backdrop-blur-md rounded-full text-white/70 hover:text-white hover:bg-black/40 transition-all border border-white/5 active:scale-90"
            >
              <MoreVertical size={20} />
            </button>

            <AnimatePresence>
              {showMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: -10 }}
                  className="absolute right-0 mt-2 w-48 bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden py-1 z-50"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button 
                    onClick={() => {
                      setShowEditModal(true);
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-zinc-300 hover:bg-white/5 hover:text-white transition-colors"
                  >
                    <Edit3 size={16} />
                    <span>Editar legenda</span>
                  </button>
                  <div className="h-px bg-white/5 mx-2" />
                  <button 
                    onClick={() => {
                      setConfirmingAction('delete');
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                  >
                    <Trash2 size={16} />
                    <span>Excluir vídeo</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <AnimatePresence>
        {showEditModal && (
          <div className="absolute inset-0 z-[60] flex items-center justify-center px-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowEditModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-sm bg-zinc-900 border border-white/10 rounded-3xl p-6 shadow-2xl relative z-10"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white">Editar Legenda</h3>
                <button onClick={() => setShowEditModal(false)} className="text-zinc-500 hover:text-white">
                  <X size={24} />
                </button>
              </div>
              
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Escreva algo sobre este vídeo..."
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white h-32 focus:outline-none focus:ring-2 focus:ring-pink-500/50 transition-all resize-none mb-6"
                autoFocus
              />
              
              <button
                onClick={handleUpdate}
                disabled={isUpdating || !editDescription.trim() || editDescription === video.description}
                className="w-full bg-gradient-to-r from-pink-500 to-rose-600 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale"
              >
                {isUpdating ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} />}
                <span>Salvar Alterações</span>
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[11px] text-zinc-300">@{comment.displayName}</span>
                            <span className="text-[9px] text-zinc-600 font-mono">
                              {comment.createdAt?.toDate ? new Date(comment.createdAt.toDate()).toLocaleDateString() : 'Agora'}
                            </span>
                          </div>
          <button 
            onClick={() => {
              setTargetCommentId(comment.id);
              setConfirmingAction('delete-comment');
            }}
            className="text-zinc-600 hover:text-red-400 opacity-0 group-hover/comment:opacity-100 transition-all p-1"
            title="Excluir comentário"
          >
            <Trash2 size={12} />
          </button>
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
        
        {video.commentsCount > 0 && (
          <button 
            onClick={() => setShowComments(true)}
            className="flex items-center gap-2 mb-4 text-[10px] uppercase font-black text-pink-500/80 hover:text-pink-500 transition-colors tracking-widest bg-pink-500/5 px-3 py-1.5 rounded-lg border border-pink-500/10 w-fit active:scale-95"
          >
            <MessageCircle size={14} />
            <span>Ver {video.commentsCount} comentários</span>
          </button>
        )}

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

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmingAction && (
          <div className="absolute inset-0 z-[70] flex items-center justify-center px-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmingAction(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-xs bg-zinc-900 border border-white/10 rounded-3xl p-6 shadow-2xl relative z-10 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <Trash2 className="mx-auto mb-4 text-red-500" size={32} />
              <h3 className="text-lg font-bold text-white mb-2">Tem certeza?</h3>
              <p className="text-sm text-zinc-400 mb-6">Esta ação não pode ser desfeita.</p>
              
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setConfirmingAction(null)}
                  className="bg-zinc-800 text-white font-bold py-3 rounded-xl active:scale-95 transition-all text-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    if (confirmingAction === 'delete') handleDelete();
                    else if (confirmingAction === 'delete-comment' && targetCommentId) handleDeleteComment(targetCommentId);
                  }}
                  className="bg-red-600 text-white font-bold py-3 rounded-xl active:scale-95 transition-all text-sm"
                >
                  Excluir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
});

export default VideoCard;
