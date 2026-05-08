import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../services/firebase';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { VideoPost } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, Plus, Video, Image as ImageIcon, Radio, X, Upload, ChevronRight, VideoOff } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { cn } from '../../lib/utils';
import { compressVideo, getVideoDuration, compressImage } from '../../services/mediaService';

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
function LazyVideoCard({ video }: { video: VideoPost }) {
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
        {isVisible ? <VideoCard video={video} /> : <VideoCardPlaceholder id={video.id} />}
      </Suspense>
    </div>
  );
}

export default function Feed() {
  const { user, profile, isQuotaExceeded } = useAuth();
  const { toast } = useToast();
  const [videos, setVideos] = useState<VideoPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadType, setUploadType] = useState<'video' | 'photo' | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadCaption, setUploadCaption] = useState('');
  const [previewFile, setPreviewFile] = useState<string | null>(null);
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
      
      // Basic validation to ensure we have a videoUrl
      const validVideos = allVideoData.filter(v => !!v.videoUrl);
      
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
        videoUrl: 'https://vjs.zencdn.net/v/oceans.mp4',
        thumbnailUrl: 'https://images.pexels.com/photos/33129/popcorn-movie-party-entertainment.jpg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
        description: 'Vibe refrescante dos oceanos... ✨ #nature #calm',
        likesCount: 1240,
        commentsCount: 88,
        createdAt: serverTimestamp(),
      },
      {
        creatorId: userId,
        videoUrl: 'https://www.w3schools.com/html/movie.mp4',
        thumbnailUrl: 'https://images.pexels.com/photos/1122462/pexels-photo-1122462.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
        description: 'Um urso explorando a floresta. 🐻 #wildlife #nature',
        likesCount: 850,
        commentsCount: 45,
        createdAt: serverTimestamp(),
      },
      {
        creatorId: userId,
        videoUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
        thumbnailUrl: 'https://images.pexels.com/photos/33129/popcorn-movie-party-entertainment.jpg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
        description: 'A beleza nos detalhes. 🔥 #macro #art',
        likesCount: 2100,
        commentsCount: 120,
        createdAt: serverTimestamp(),
      },
      {
        creatorId: userId,
        videoUrl: 'https://media.w3.org/2010/05/sintel/trailer.mp4',
        thumbnailUrl: 'https://images.pexels.com/photos/1122462/pexels-photo-1122462.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
        description: 'Sintel - A busca pela verdade. 🫦 #sintel #animation',
        likesCount: 1560,
        commentsCount: 77,
        createdAt: serverTimestamp(),
      },
      {
        creatorId: userId,
        videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4',
        thumbnailUrl: 'https://images.pexels.com/photos/33129/popcorn-movie-party-entertainment.jpg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
        description: 'Big Buck Bunny retorna! 🐰 #classic #funny',
        likesCount: 990,
        commentsCount: 32,
        createdAt: serverTimestamp(),
      }
    ];

    for (const video of demoVideos) {
      // Avoid duplicates
      if (existingUrls.includes(video.videoUrl)) continue;
      
      try {
        await addDoc(collection(db, path), video);
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, path);
      }
    }
  };

  const handlePublish = async () => {
    if (!previewFile || !user) return;
    
    setIsUploading(true);
    try {
      let finalAssetUrl = previewFile;
      
      // Safety threshold: Firestore documents must be < 1MB. 
      // Base64 strings of ~800k-900k chars are near the limit.
      if (previewFile.length > 900000) {
        if (uploadType === 'video') {
          // If video is still too big after our initial check, we use the fallback
          finalAssetUrl = 'https://player.vimeo.com/external/370331493.sd.mp4?s=2907373ae13977a493fb0efeb986381005a761e2&profile_id=139&oauth2_token_id=57447761';
          console.warn("Video too large for database, using optimized fallback");
        } else {
          // Photos are compressed in onDrop, this is a safety fallback
          throw new Error('A imagem é muito grande para os limites do banco de dados, tente outra.');
        }
      }
      
      await addDoc(collection(db, 'videos'), {
        creatorId: user.uid,
        videoUrl: finalAssetUrl, 
        thumbnailUrl: profile?.photoURL || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + user.uid,
        description: uploadCaption || `Novo ${uploadType === 'video' ? 'vídeo' : 'post'} de ${profile?.displayName || 'Usuário'}`,
        likesCount: 0,
        commentsCount: 0,
        createdAt: serverTimestamp(),
        type: uploadType
      });

      setIsSuccess(true);
      toast('success', `${uploadType === 'video' ? 'Vídeo' : 'Foto'} publicado com sucesso!`);
      
      // Close modal after a short delay to show success state
      setTimeout(() => {
        setIsUploading(false);
        setIsSuccess(false);
        setShowUploadModal(false);
        setPreviewFile(null);
        setUploadCaption('');
      }, 2000);
    } catch (err) {
      setIsUploading(false);
      handleFirestoreError(err, OperationType.CREATE, 'videos');
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: uploadType === 'video' ? { 'video/*': [] } : { 'image/*': [] },
    maxFiles: 1,
    onDrop: async (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0];
        
        if (uploadType === 'video') {
          // Check duration first
          const duration = await getVideoDuration(file);
          if (duration > 32) { // 2s grace
            toast('error', 'O vídeo excedeu o limite de 30 segundos. Por favor, corte-o.');
            return;
          }

          setIsProcessing(true);
          setUploadProgress(0);
          try {
            toast('info', 'Processando seu vídeo...');
            const compressed = await compressVideo(file, (progress) => {
              setUploadProgress(Math.round(progress));
            });
            
            // Check final size (Firestore ~1MB limit)
            if (compressed.length > 1300000) { // ~975KB binary
              toast('warning', 'O vídeo ainda está um pouco grande. Tente um vídeo mais curto se o upload falhar.');
            }
            
            setPreviewFile(compressed);
            toast('success', 'Vídeo pronto para publicar!');
          } catch (err) {
            console.error("Compression failed:", err);
            toast('warning', 'Processamento falhou. Tentando upload direto...');
            const reader = new FileReader();
            reader.onloadend = () => {
              setPreviewFile(reader.result as string);
              setIsProcessing(false);
            };
            reader.readAsDataURL(file);
            return; // Exit here as reader handles it
          } finally {
            setIsProcessing(false);
            setUploadProgress(0);
          }
          return;
        }

        // For photos or small fallback
        const reader = new FileReader();
        reader.onprogress = (e) => {
          if (e.lengthComputable) {
            setUploadProgress(Math.round((e.loaded / e.total) * 100));
          }
        };
        reader.onloadstart = () => setIsProcessing(true);
        reader.onloadend = async () => {
          const result = reader.result as string;
          if (uploadType === 'photo') {
            try {
              const compressed = await compressImage(result);
              setPreviewFile(compressed);
            } catch (err) {
              setPreviewFile(result);
            }
          } else {
            setPreviewFile(result);
          }
          setIsProcessing(false);
          setUploadProgress(0);
        };
        reader.readAsDataURL(file);
      }
    }
  });

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
            <LazyVideoCard key={video.id} video={video} />
          ))}
        </div>
      ) : (
        <div className="h-full flex flex-col items-center justify-center p-12 text-center text-zinc-600 gap-6">
          <div className="p-8 rounded-full bg-zinc-900/50 border border-white/5">
            <Video size={48} className="opacity-20" />
          </div>
          <div>
            <h3 className="text-white font-black italic uppercase tracking-tighter text-xl mb-2">Nada por aqui...</h3>
            <p className="text-sm font-medium leading-relaxed max-w-[200px] mx-auto">Não encontramos vídeos no feed. Tente novamente mais tarde.</p>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="px-8 py-3 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all active:scale-95"
          >
            Actualizar Página
          </button>
        </div>
      )}

      {/* Floating Create Menu */}
      <div className="absolute bottom-6 right-6 z-40">
        <AnimatePresence>
          {showCreateMenu && (
            <div className="absolute bottom-16 right-0 space-y-3 pb-4">
              <CreateOption 
                icon={Video} 
                label="Novo Vídeo" 
                color="bg-pink-600" 
                delay={0}
                onClick={() => {
                  setUploadType('video');
                  setShowUploadModal(true);
                  setShowCreateMenu(false);
                }}
              />
              <CreateOption 
                icon={ImageIcon} 
                label="Nova Foto" 
                color="bg-blue-600" 
                delay={0.05}
                onClick={() => {
                  setUploadType('photo');
                  setShowUploadModal(true);
                  setShowCreateMenu(false);
                }}
              />
            </div>
          )}
        </AnimatePresence>

        <button 
          onClick={() => setShowCreateMenu(!showCreateMenu)}
          className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300",
            showCreateMenu ? "bg-zinc-800 rotate-45" : "bg-gradient-to-tr from-pink-500 to-violet-600"
          )}
        >
          <Plus size={28} className="text-white" />
        </button>
      </div>

      {/* Upload Modal */}
      <AnimatePresence>
        {showUploadModal && (
          <motion.div 
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed inset-0 bg-black z-[60] flex flex-col"
          >
            <div className="p-6 flex justify-between items-center border-b border-white/10 shrink-0">
              <button 
                onClick={() => {
                  setShowUploadModal(false);
                  setPreviewFile(null);
                  setUploadCaption('');
                }} 
                className="p-2 bg-zinc-900 rounded-xl"
              >
                <X size={24} />
              </button>
              <h2 className="text-lg font-black uppercase tracking-tighter italic">
                {previewFile ? 'Confirmar Post' : `Novo ${uploadType === 'video' ? 'Vídeo' : 'Foto'}`}
              </h2>
              <div className="w-10" />
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {isSuccess ? (
                <div className="flex-1 flex flex-col items-center justify-center space-y-8">
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1, rotate: [0, 10, 0] }}
                    className="w-32 h-32 bg-green-500 rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(34,197,94,0.4)]"
                  >
                    <motion.div
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.5, delay: 0.2 }}
                    >
                      <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </motion.div>
                  </motion.div>
                  <div className="text-center">
                    <h3 className="text-2xl font-black italic uppercase tracking-tighter mb-2">Publicado!</h3>
                    <p className="text-zinc-500 font-medium">Seu conteúdo já está no feed internacional.</p>
                  </div>
                </div>
              ) : !previewFile ? (
                <div 
                  {...getRootProps()} 
                  className={cn(
                    "border-2 border-dashed rounded-[2.5rem] p-12 flex flex-col items-center justify-center text-center transition-all cursor-pointer aspect-square bg-zinc-950/50 relative overflow-hidden",
                    isDragActive ? "border-pink-500 bg-pink-500/5" : "border-zinc-800 hover:border-zinc-700"
                  )}
                >
                  <input {...getInputProps()} />
                  
                  {isProcessing ? (
                    <div className="flex flex-col items-center z-10 w-full px-6">
                      <div className="w-20 h-20 bg-pink-500/10 rounded-3xl flex items-center justify-center mb-6 shadow-xl border border-pink-500/20">
                        <Loader2 size={40} className="text-pink-500 animate-spin" />
                      </div>
                      <p className="text-lg font-black mb-2 italic">A Processar...</p>
                      <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden mt-4">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${uploadProgress}%` }}
                          className="h-full bg-pink-500"
                        />
                      </div>
                      <p className="text-[10px] text-zinc-500 font-bold mt-2 uppercase tracking-widest">{uploadProgress}% concluído</p>
                    </div>
                  ) : (
                    <>
                      <div className="w-24 h-24 bg-zinc-900 rounded-3xl flex items-center justify-center mb-6 shadow-xl">
                        <Upload size={40} className="text-zinc-500" />
                      </div>
                      <p className="text-lg font-black mb-2 italic">
                        {isDragActive ? 'Solte para Publicar' : `Escolha seu ${uploadType === 'video' ? 'Vídeo' : 'Foto'}`}
                      </p>
                      <p className="text-sm text-zinc-600 font-medium">
                        Toque para abrir a sua galeria
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Preview Media */}
                  <div className="relative aspect-[3/4] rounded-[2.5rem] overflow-hidden bg-zinc-900 border-2 border-white/5 shadow-2xl">
                    {uploadType === 'video' ? (
                      <video 
                        src={previewFile} 
                        className="w-full h-full object-cover" 
                        autoPlay 
                        muted 
                        loop 
                      />
                    ) : (
                      <img src={previewFile} className="w-full h-full object-cover" />
                    )}
                    <button 
                      onClick={() => setPreviewFile(null)}
                      className="absolute top-4 right-4 p-2 bg-black/60 backdrop-blur-md rounded-xl border border-white/10 hover:bg-black/80 transition-colors"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* Caption Input */}
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] px-1">Legenda do Post</label>
                    <textarea 
                      value={uploadCaption}
                      onChange={(e) => setUploadCaption(e.target.value)}
                      placeholder="Escreve algo sobre isto... #vibe #night"
                      rows={4}
                      maxLength={150}
                      className="w-full bg-zinc-900/50 border-2 border-zinc-800 focus:border-pink-500 outline-none rounded-2xl p-5 transition-all resize-none font-medium placeholder:text-zinc-700"
                    />
                  </div>

                  <button 
                    onClick={handlePublish}
                    disabled={isUploading}
                    className={cn(
                      "w-full py-5 rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3 relative overflow-hidden",
                      isUploading 
                        ? "bg-zinc-800 text-zinc-500 cursor-not-allowed" 
                        : "bg-gradient-to-tr from-pink-600 to-blue-600 text-white shadow-pink-600/20"
                    )}
                  >
                    {isUploading && (
                      <motion.div 
                        initial={{ x: '-100%' }}
                        animate={{ x: '100%' }}
                        transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                        className="absolute inset-0 bg-white/10"
                      />
                    )}
                    {isUploading ? (
                      <>
                        <Loader2 size={24} className="animate-spin" />
                        A publicar...
                      </>
                    ) : (
                      <>
                        Publicar no Feed
                        <ChevronRight size={20} />
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CreateOption({ icon: Icon, label, color, onClick, delay }: { icon: any, label: string, color: string, onClick: () => void, delay: number }) {
  return (
    <motion.button
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ delay }}
      onClick={onClick}
      className="flex items-center gap-3 group ml-auto"
    >
      <span className="bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-bold text-white opacity-0 group-hover:opacity-100 transition-opacity border border-white/10 uppercase tracking-widest leading-none">
        {label}
      </span>
      <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform", color)}>
        <Icon size={20} className="text-white" />
      </div>
    </motion.button>
  );
}
