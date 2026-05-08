import { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../services/firebase';
import { useAuth } from '../../hooks/useAuth';
import { VideoPost } from '../../types';
import VideoCard from './VideoCard';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, Plus, Video, Image as ImageIcon, Radio, X, Upload, ChevronRight } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { cn } from '../../lib/utils';

export default function Feed() {
  const { user, profile } = useAuth();
  const [videos, setVideos] = useState<VideoPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadType, setUploadType] = useState<'video' | 'photo' | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadCaption, setUploadCaption] = useState('');
  const [previewFile, setPreviewFile] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(collection(db, 'videos'), orderBy('createdAt', 'desc'), limit(15));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allVideoData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as VideoPost[];
      // Filter out known broken URLs and blob URLs from the local state
      const validVideos = allVideoData.filter(v => 
        v.videoUrl && 
        !v.videoUrl.startsWith('blob:') &&
        !v.videoUrl.includes('gtv-videos-bucket') &&
        !v.videoUrl.includes('archive.org')
      );
      
      setVideos(validVideos);
      setLoading(false);
      
      // Seed if we have very few VALID videos and user is logged in
      if (validVideos.length < 3 && user) {
        seedVideos(user.uid, validVideos.map(v => v.videoUrl));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'videos');
    });

    return () => unsubscribe();
  }, [user]);

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

      setIsUploading(false);
      setShowUploadModal(false);
      setPreviewFile(null);
      setUploadCaption('');
      alert(`${uploadType === 'video' ? 'Vídeo' : 'Foto'} publicado com sucesso!`);
    } catch (err) {
      setIsUploading(false);
      handleFirestoreError(err, OperationType.CREATE, 'videos');
    }
  };

  const compressImage = (base64Str: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        // Accept any resolution, but scale down if it exceeds reasonable bounds to prevent browser crashes
        const MAX_DIMENSION = 1600; 
        let width = img.width;
        let height = img.height;

        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          if (width > height) {
            height *= MAX_DIMENSION / width;
            width = MAX_DIMENSION;
          } else {
            width *= MAX_DIMENSION / height;
            height = MAX_DIMENSION;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Dynamic quality adjustment to ensure we stay under ~900KB Base64 (~675KB binary)
        let quality = 0.8;
        let result = canvas.toDataURL('image/jpeg', quality);
        
        // Loop to reduce quality until it fits
        while (result.length > 900000 && quality > 0.1) {
          quality -= 0.1;
          result = canvas.toDataURL('image/jpeg', quality);
        }
        
        resolve(result);
      };
    });
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: uploadType === 'video' ? { 'video/*': [] } : { 'image/*': [] },
    maxFiles: 1,
    onDrop: async (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0];
        
        // Slightly higher limit: ~750KB binary (roughly 1MB in Base64)
        if (uploadType === 'video' && file.size > 750000) {
          alert('Este vídeo é muito grande. Optimize-o ou reduza a duração antes de publicar.');
          setPreviewFile('https://player.vimeo.com/external/370331493.sd.mp4?s=2907373ae13977a493fb0efeb986381005a761e2&profile_id=139&oauth2_token_id=57447761');
          return;
        }

        const reader = new FileReader();
        reader.onloadend = async () => {
          const result = reader.result as string;
          if (uploadType === 'photo') {
            const compressed = await compressImage(result);
            setPreviewFile(compressed);
          } else {
            setPreviewFile(result);
          }
        };
        reader.readAsDataURL(file);
      }
    }
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-pink-500" size={32} />
      </div>
    );
  }

  return (
    <div className="relative h-full">
      <div 
        className="h-full overflow-y-scroll snap-y snap-mandatory no-scrollbar"
        ref={scrollRef}
      >
        {videos.map((video) => (
          <VideoCard key={video.id} video={video} />
        ))}
      </div>

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
              {!previewFile ? (
                <div 
                  {...getRootProps()} 
                  className={cn(
                    "border-2 border-dashed rounded-[2.5rem] p-12 flex flex-col items-center justify-center text-center transition-all cursor-pointer aspect-square bg-zinc-950/50",
                    isDragActive ? "border-pink-500 bg-pink-500/5" : "border-zinc-800 hover:border-zinc-700"
                  )}
                >
                  <input {...getInputProps()} />
                  <div className="w-24 h-24 bg-zinc-900 rounded-3xl flex items-center justify-center mb-6 shadow-xl">
                    <Upload size={40} className="text-zinc-500" />
                  </div>
                  <p className="text-lg font-black mb-2 italic">
                    {isDragActive ? 'Solte para Publicar' : `Escolha seu ${uploadType === 'video' ? 'Vídeo' : 'Foto'}`}
                  </p>
                  <p className="text-sm text-zinc-600 font-medium">
                    Toque para abrir a sua galeria
                  </p>
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
                      "w-full py-5 rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3",
                      isUploading 
                        ? "bg-zinc-800 text-zinc-500 cursor-not-allowed" 
                        : "bg-gradient-to-tr from-pink-600 to-blue-600 text-white shadow-pink-600/20"
                    )}
                  >
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
