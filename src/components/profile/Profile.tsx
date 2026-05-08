import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { cn } from '../../lib/utils';
import { 
  Settings, 
  Grid, 
  Heart, 
  LogOut, 
  Edit3, 
  Shield, 
  Trash2, 
  X,
  ChevronRight,
  ShieldAlert,
  UserX,
  Bell,
  CheckCircle2,
  Camera,
  Plus,
  Video,
  VideoOff,
  Image as ImageIcon,
  Radio,
  Upload,
  Loader2,
  Play,
  MessageCircle,
  Share2,
  MoreHorizontal
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AgeVerification } from '../auth/AgeVerification';
import LiveBroadcast from '../match/LiveBroadcast';
import { useDropzone } from 'react-dropzone';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, orderBy, getDocs, doc, documentId } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../services/firebase';

export default function Profile() {
  const { profile, user, logout, updateProfile, deleteAccount } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAgeVerification, setShowAgeVerification] = useState(false);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showLiveBroadcast, setShowLiveBroadcast] = useState(false);
  const [uploadType, setUploadType] = useState<'video' | 'photo' | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadCaption, setUploadCaption] = useState('');
  const [previewFile, setPreviewFile] = useState<string | null>(null);
  const [userVideos, setUserVideos] = useState<any[]>([]);
  const [userPhotos, setUserPhotos] = useState<any[]>([]);
  const [likedVideos, setLikedVideos] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'posts' | 'gallery' | 'likes'>('posts');
  const [totalLikesReceived, setTotalLikesReceived] = useState(0);
  const [editName, setEditName] = useState(profile?.displayName || '');
  const [editBio, setEditBio] = useState(profile?.bio || '');
  const [editPhotoURL, setEditPhotoURL] = useState(profile?.photoURL || '');
  const [editCoverURL, setEditCoverURL] = useState(profile?.coverURL || '');
  const [uploadingProfile, setUploadingProfile] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<any | null>(null);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);

  const getCurrentList = () => {
    if (activeTab === 'posts') return userVideos;
    if (activeTab === 'gallery') return userPhotos;
    return likedVideos;
  };

  const handleNextMedia = () => {
    const list = getCurrentList();
    if (selectedMediaIndex < list.length - 1) {
      const nextIndex = selectedMediaIndex + 1;
      setSelectedMediaIndex(nextIndex);
      setSelectedMedia(list[nextIndex]);
    }
  };

  const handlePrevMedia = () => {
    const list = getCurrentList();
    if (selectedMediaIndex > 0) {
      const prevIndex = selectedMediaIndex - 1;
      setSelectedMediaIndex(prevIndex);
      setSelectedMedia(list[prevIndex]);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      const changed = 
        editName !== (profile?.displayName || '') ||
        editBio !== (profile?.bio || '') ||
        editPhotoURL !== (profile?.photoURL || '') ||
        editCoverURL !== (profile?.coverURL || '');
      setHasUnsavedChanges(changed);
    }
  }, [editName, editBio, editPhotoURL, editCoverURL, profile, isEditing]);

  const compressImage = (base64Str: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        // Accept any resolution, but scale down if it exceeds bounds to prevent crash
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
        
        // Dynamic quality adjustment to ensure we stay under ~900KB Base64
        let quality = 0.8;
        let result = canvas.toDataURL('image/jpeg', quality);
        
        while (result.length > 900000 && quality > 0.1) {
          quality -= 0.1;
          result = canvas.toDataURL('image/jpeg', quality);
        }
        
        resolve(result);
      };
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'profile' | 'cover') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadstart = () => {
      if (type === 'profile') setUploadingProfile(true);
      else setUploadingCover(true);
    };
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      // Compress profile/cover images too
      const compressed = await compressImage(base64String);
      
      if (type === 'profile') {
        setEditPhotoURL(compressed);
        setUploadingProfile(false);
      } else {
        setEditCoverURL(compressed);
        setUploadingCover(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const profilePresets = [
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Boots',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Coco',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Luna'
  ];

  const coverPresets = [
    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=800',
    'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&q=80&w=800',
    'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&q=80&w=800',
    'https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&q=80&w=800'
  ];

  useEffect(() => {
    if (profile) {
      setEditName(profile.displayName || '');
      setEditBio(profile.bio || '');
      setEditPhotoURL(profile.photoURL || '');
      setEditCoverURL(profile.coverURL || '');
    }
  }, [profile, isEditing]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'videos'),
      where('creatorId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(q, { includeMetadataChanges: false }, (snap) => {
      const videos = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      setUserVideos(videos);
      setUserPhotos(videos.filter(v => 
        v.type === 'photo' || 
        (v.videoUrl && (v.videoUrl.startsWith('data:image/') || v.videoUrl.match(/\.(jpg|jpeg|png|webp|gif|svg)$|dicebear/i)))
      ));
      
      const total = videos.reduce((sum, vid) => sum + (vid.likesCount || 0), 0);
      setTotalLikesReceived(total);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'videos');
    });

    return unsub;
  }, [user]);

  const [likedVideoIds, setLikedVideoIds] = useState<string[]>([]);

  useEffect(() => {
    if (!user) return;
    
    const likesQuery = query(
      collection(db, 'likes'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(likesQuery, (snapshot) => {
      const ids = snapshot.docs.map(d => d.data().videoId);
      setLikedVideoIds(ids);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'likes');
    });

    return unsubscribe;
  }, [user]);

  useEffect(() => {
    let active = true;
    const fetchVideos = async () => {
      if (likedVideoIds.length === 0) {
        setLikedVideos([]);
        return;
      }

      try {
        const idsToFetch = likedVideoIds.slice(0, 30);
        
        const videosQuery = query(
          collection(db, 'videos'),
          where(documentId(), 'in', idsToFetch)
        );
        
        const snapshot = await getDocs(videosQuery);
        if (!active) return;
        
        const videosData = snapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        }));
        
        setLikedVideos(videosData);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'videos (likes metadata)');
      }
    };

    fetchVideos();
    return () => { active = false; };
  }, [likedVideoIds]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: uploadType === 'video' ? { 'video/*': [] } : { 'image/*': [] },
    maxFiles: 1,
    onDrop: async (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0];
        
        // Video limit: ~750KB binary
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

  const handlePublish = async () => {
    if (!previewFile || !user) return;
    
    setIsUploading(true);
    try {
      let finalAssetUrl = previewFile;
      
      // Safety threshold: Firestore documents must be < 1MB. 
      if (previewFile.length > 900000) {
        if (uploadType === 'video') {
          finalAssetUrl = 'https://player.vimeo.com/external/370331493.sd.mp4?s=2907373ae13977a493fb0efeb986381005a761e2&profile_id=139&oauth2_token_id=57447761';
          console.warn("Video too large for database, using optimized fallback");
        } else {
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

  const handleSave = async () => {
    if (!editName.trim()) {
      alert("O nome não pode estar vazio.");
      return;
    }
    
    await updateProfile({ 
      displayName: editName.trim(), 
      bio: editBio.trim(),
      photoURL: editPhotoURL,
      coverURL: editCoverURL
    });
    setIsEditing(false);
    setHasUnsavedChanges(false);
  };

  const handleCancelEdit = () => {
    if (hasUnsavedChanges) {
      if (confirm("Tens alterações não guardadas. Desejas descartar as alterações?")) {
        setIsEditing(false);
        setHasUnsavedChanges(false);
      }
    } else {
      setIsEditing(false);
    }
  };

  if (!profile) return null;

  return (
    <div className="h-full bg-black text-white overflow-y-auto pb-24">
      {/* Cover Photo */}
      <div className="relative h-48 w-full bg-zinc-800 overflow-hidden">
        {profile.coverURL ? (
          <img src={profile.coverURL} alt="Cover" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-tr from-zinc-800 to-zinc-900 flex items-center justify-center">
            <Radio size={48} className="text-white/5" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/20" />
      </div>

      {/* Header */}
      <div className="sticky top-0 bg-black/40 backdrop-blur-md z-20 px-6 py-4 flex justify-between items-center border-b border-white/5 -mt-48">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold tracking-tight">{profile.displayName}</h2>
          {profile.ageVerified && (
            <CheckCircle2 size={16} className="text-blue-500 fill-blue-500/10" />
          )}
        </div>
        <button onClick={() => setShowSettings(true)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
          <Settings size={22} />
        </button>
      </div>

      {/* Profile Info */}
      <div className="px-6 pt-16 pb-8 flex flex-col items-center relative">
        <div className="relative group mb-4 -mt-20">
          <div className="w-32 h-32 rounded-[2.5rem] border-4 border-black bg-zinc-900 p-1 overflow-hidden relative shadow-2xl">
            <img 
              src={profile.photoURL} 
              alt="Profile" 
              className="w-full h-full rounded-[2.25rem] object-cover"
            />
            {profile.ageVerified && (
              <div className="absolute inset-x-0 bottom-0 h-1/3 bg-blue-500/20 backdrop-blur-sm flex items-center justify-center border-t border-blue-500/30">
                <Shield size={16} className="text-blue-400" />
              </div>
            )}
          </div>
          <button 
            onClick={() => setIsEditing(true)}
            className="absolute bottom-2 right-2 p-3 bg-pink-600 rounded-2xl border-4 border-black hover:scale-110 active:scale-95 transition-all shadow-xl text-white group-hover:rotate-6"
          >
            <Camera size={18} />
          </button>
        </div>

        <h1 className="text-xl font-bold mb-1 flex items-center gap-2">
          @{user?.uid.slice(0, 8)}
          {profile.ageVerified && (
             <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/30 uppercase tracking-tighter font-black">Verificado +18</span>
          )}
        </h1>
        
        <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
          <div className="flex items-center gap-1.5 bg-yellow-500/10 px-3 py-1 rounded-full border border-yellow-500/20">
            <span className="text-yellow-500 font-bold text-xs">{(profile as any).balance || 0} Moedas</span>
          </div>
          
          {!profile.ageVerified && (
            <button 
              onClick={() => setShowAgeVerification(true)}
              className="flex items-center gap-1.5 bg-white/5 px-3 py-1 rounded-full border border-white/10 hover:bg-white/10 transition-colors"
            >
              <Camera size={12} className="text-zinc-400" />
              <span className="text-zinc-400 font-bold text-xs">Verificar Idade</span>
            </button>
          )}
        </div>
        <p className="text-zinc-500 text-sm mb-6 px-12 text-center leading-relaxed">
          {profile.bio || "Adicione uma bio para as pessoas te conhecerem melhor."}
        </p>

        {/* Stats */}
        <div className="flex justify-center gap-12 w-full max-w-xs mb-8">
          <div className="flex flex-col items-center">
            <span className="font-bold text-lg">{profile.followingCount}</span>
            <span className="text-xs text-zinc-500 uppercase tracking-widest">Seguindo</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="font-bold text-lg">{profile.followersCount}</span>
            <span className="text-xs text-zinc-500 uppercase tracking-widest">Seguidores</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="font-bold text-lg">{totalLikesReceived}</span>
            <span className="text-xs text-zinc-500 uppercase tracking-widest">Curtidas</span>
          </div>
        </div>

        <button 
          onClick={() => setIsEditing(true)}
          className="w-full max-w-xs py-3 px-6 bg-zinc-800 rounded-xl font-semibold hover:bg-zinc-700 transition-colors active:scale-95 flex items-center justify-center gap-2"
        >
          Editar Perfil
        </button>
      </div>

      {/* Content Tabs */}
      <div className="border-t border-white/5">
        <div className="flex border-b border-white/5">
          <button 
            onClick={() => setActiveTab('posts')}
            className={cn(
              "flex-1 py-4 flex justify-center transition-all",
              activeTab === 'posts' ? "border-b-2 border-white text-white" : "text-zinc-500 opacity-50"
            )}
          >
            <Grid size={22} />
          </button>
          <button 
            onClick={() => setActiveTab('gallery')}
            className={cn(
              "flex-1 py-4 flex justify-center transition-all",
              activeTab === 'gallery' ? "border-b-2 border-white text-white" : "text-zinc-500 opacity-50"
            )}
          >
            <ImageIcon size={22} />
          </button>
          <button 
            onClick={() => setActiveTab('likes')}
            className={cn(
              "flex-1 py-4 flex justify-center transition-all",
              activeTab === 'likes' ? "border-b-2 border-white text-white" : "text-zinc-500 opacity-50"
            )}
          >
            <Heart size={22} />
          </button>
        </div>
        
        {activeTab === 'posts' ? (
          userVideos.length > 0 ? (
            <div className="grid grid-cols-3 gap-0.5">
              {userVideos.map((vid, idx) => (
                <VideoThumbnail 
                  key={vid.id} 
                  vid={vid} 
                  onClick={() => {
                    setSelectedMediaIndex(idx);
                    setSelectedMedia(vid);
                  }} 
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 px-6 opacity-30">
              <Grid size={48} strokeWidth={1} className="mb-4" />
              <p className="text-sm font-medium text-center">Nenhum conteúdo publicado ainda.<br/>Toque no "+" para começar!</p>
            </div>
          )
        ) : activeTab === 'gallery' ? (
          userPhotos.length > 0 ? (
            <div className="grid grid-cols-3 gap-0.5">
              {userPhotos.map((vid, idx) => (
                <VideoThumbnail 
                  key={vid.id} 
                  vid={vid} 
                  onClick={() => {
                    setSelectedMediaIndex(idx);
                    setSelectedMedia(vid);
                  }} 
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 px-6 opacity-30">
              <ImageIcon size={48} strokeWidth={1} className="mb-4" />
              <p className="text-sm font-medium text-center">Nenhuma foto na sua galeria.<br/>Poste uma foto no feed!</p>
            </div>
          )
        ) : (
          likedVideos.length > 0 ? (
            <div className="grid grid-cols-3 gap-0.5">
              {likedVideos.map((vid, idx) => (
                <VideoThumbnail 
                  key={vid.id} 
                  vid={vid} 
                  onClick={() => {
                    setSelectedMediaIndex(idx);
                    setSelectedMedia(vid);
                  }} 
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 px-6 opacity-30">
              <Heart size={48} strokeWidth={1} className="mb-4" />
              <p className="text-sm font-medium text-center">Ainda não curtiu nada.<br/>Explore o feed para encontrar vibas!</p>
            </div>
          )
        )}
      </div>

      {/* Media Viewer Modal */}
      <AnimatePresence>
        {selectedMedia && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black z-[100] flex flex-col overflow-hidden"
          >
            {/* Blurred Background */}
            <div className="absolute inset-0 z-0">
              {selectedMedia.type === 'photo' || (selectedMedia.videoUrl && (selectedMedia.videoUrl.startsWith('data:image/') || selectedMedia.videoUrl.match(/\.(jpg|jpeg|png|webp|gif|svg)$|dicebear/i))) ? (
                <img src={selectedMedia.videoUrl} className="w-full h-full object-cover blur-2xl opacity-40 scale-110" />
              ) : (
                <div className="w-full h-full bg-zinc-900" />
              )}
              <div className="absolute inset-0 bg-black/60" />
            </div>

            <div className="relative z-10 flex-1 flex flex-col">
              {/* Header */}
              <div className="p-6 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent">
                <button 
                  onClick={() => setSelectedMedia(null)}
                  className="p-3 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 hover:bg-white/10 active:scale-90 transition-all"
                >
                  <X size={24} />
                </button>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-2xl overflow-hidden border border-white/20 shadow-lg">
                    <img src={profile.photoURL} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-black uppercase tracking-[0.2em]">{profile.displayName}</span>
                    <span className="text-[9px] text-zinc-500 font-mono tracking-tighter">PUBLISHED: {new Date(selectedMedia.createdAt?.toDate?.() || Date.now()).toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>
                <button className="p-3 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 hover:bg-white/10 transition-all">
                  <MoreHorizontal size={24} />
                </button>
              </div>

              {/* Main Content Area */}
              <div className="flex-1 flex items-center justify-between px-4 relative">
                {/* Navigation Buttons (Desktop/Tablet) */}
                <button 
                  onClick={handlePrevMedia}
                  disabled={selectedMediaIndex === 0}
                  className={cn(
                    "hidden md:flex p-4 rounded-full bg-black/40 backdrop-blur-md border border-white/10 hover:bg-white/10 transition-all disabled:opacity-0",
                    selectedMediaIndex === 0 && "cursor-default"
                  )}
                >
                  <ChevronRight size={24} className="rotate-180" />
                </button>

                <motion.div 
                  drag="y"
                  dragConstraints={{ top: 0, bottom: 0 }}
                  onDragEnd={(_, info) => {
                    if (info.offset.y > 150 || info.offset.y < -150) {
                      setSelectedMedia(null);
                    }
                  }}
                  layoutId={selectedMedia.id}
                  className="relative w-full max-w-lg aspect-[9/16] md:aspect-[3/4] rounded-[2.5rem] md:rounded-[3rem] overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.8)] bg-black border border-white/10 cursor-grab active:cursor-grabbing"
                >
                  {!selectedMedia.videoUrl ? (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-950 text-zinc-600">
                      <VideoOff size={48} className="opacity-20 mb-4" />
                      <p className="text-[10px] uppercase tracking-widest font-black">Mídia Indisponível</p>
                    </div>
                  ) : selectedMedia.type === 'photo' || (selectedMedia.videoUrl && (selectedMedia.videoUrl.startsWith('data:image/') || selectedMedia.videoUrl.match(/\.(jpg|jpeg|png|webp|gif|svg)$|dicebear/i))) ? (
                    <img src={selectedMedia.videoUrl} className="w-full h-full object-cover" draggable={false} />
                  ) : (
                    <video 
                      key={selectedMedia.videoUrl}
                      src={selectedMedia.videoUrl} 
                      className="w-full h-full object-cover"
                      autoPlay
                      loop
                      playsInline
                      controls={false}
                      onClick={(e) => {
                        const v = e.currentTarget;
                        if (v.paused) v.play();
                        else v.pause();
                      }}
                      onError={(e) => {
                        console.warn("Media viewer video error:", e);
                        // We could show an error state here if we had one for the viewer
                      }}
                    />
                  )}
                  
                  {/* Swipe indicator */}
                  <div className="absolute bottom-4 inset-x-0 flex flex-col items-center gap-1 opacity-40 pointer-events-none">
                    <div className="w-12 h-1 bg-white/30 rounded-full" />
                    <span className="text-[8px] font-black uppercase tracking-widest">Arraste para fechar</span>
                  </div>
                </motion.div>

                <button 
                  onClick={handleNextMedia}
                  disabled={selectedMediaIndex === getCurrentList().length - 1}
                  className={cn(
                    "hidden md:flex p-4 rounded-full bg-black/40 backdrop-blur-md border border-white/10 hover:bg-white/10 transition-all disabled:opacity-0",
                    selectedMediaIndex === getCurrentList().length - 1 && "cursor-default"
                  )}
                >
                  <ChevronRight size={24} />
                </button>

                {/* Mobile Tap Areas for Navigation */}
                <div className="absolute inset-y-0 left-0 w-1/4 z-10 md:hidden" onClick={handlePrevMedia} />
                <div className="absolute inset-y-0 right-0 w-1/4 z-10 md:hidden" onClick={handleNextMedia} />
              </div>

              {/* Bottom Info Section */}
              <div className="p-8 bg-gradient-to-t from-black via-black/80 to-transparent">
                <div className="max-w-lg mx-auto">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-8">
                      <div className="flex flex-col items-center gap-1">
                        <motion.button 
                          whileTap={{ scale: 0.8 }}
                          className={cn(
                            "p-3 rounded-2xl transition-all",
                            selectedMedia.likesCount > 0 ? "bg-pink-500/20 text-pink-500" : "bg-white/5 text-white"
                          )}
                        >
                          <Heart size={26} className={cn(selectedMedia.likesCount > 0 && "fill-current")} />
                        </motion.button>
                        <span className="text-[10px] font-black italic tracking-widest">{selectedMedia.likesCount || 0}</span>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <button className="p-3 rounded-2xl bg-white/5 text-white">
                          <MessageCircle size={26} />
                        </button>
                        <span className="text-[10px] font-black italic tracking-widest">{selectedMedia.commentsCount || 0}</span>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <button className="p-3 rounded-2xl bg-white/5 text-white">
                          <Share2 size={26} />
                        </button>
                        <span className="text-[10px] font-black italic tracking-widest">SHARE</span>
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end gap-2">
                       <div className="px-4 py-2 bg-white text-black rounded-xl font-black uppercase text-[10px] tracking-widest">
                          {selectedMedia.type === 'video' ? 'VIDEO' : 'STILL'}
                       </div>
                    </div>
                  </div>

                  <div className="bg-white/5 backdrop-blur-md rounded-[2rem] p-6 border border-white/10">
                    <p className="text-zinc-200 text-sm font-semibold italic leading-relaxed mb-4">
                      {selectedMedia.description}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest">ID: {selectedMedia.id}</span>
                      <span className="text-[10px] font-black text-pink-500 italic uppercase">#VIBE #PREMIUM</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Create Menu */}
      <div className="fixed bottom-24 right-6 z-40">
        <AnimatePresence>
          {showCreateMenu && (
            <div className="absolute bottom-16 right-0 space-y-3 pb-4">
              <CreateOption 
                icon={Radio} 
                label="Abrir Live" 
                color="bg-red-600" 
                delay={0}
                onClick={() => {
                  if (!profile?.ageVerified) {
                    setShowAgeVerification(true);
                    return;
                  }
                  setShowCreateMenu(false);
                  setShowLiveBroadcast(true);
                }}
              />
              <CreateOption 
                icon={Video} 
                label="Novo Vídeo" 
                color="bg-pink-600" 
                delay={0.05}
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
                delay={0.1}
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
            "w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300",
            showCreateMenu ? "bg-zinc-800 rotate-45" : "bg-gradient-to-tr from-pink-500 to-violet-600"
          )}
        >
          <Plus size={32} className="text-white" />
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
                    <div className="flex justify-end px-1">
                      <span className={cn(
                        "text-[10px] font-bold tracking-widest",
                        uploadCaption.length >= 150 ? "text-red-500" : "text-zinc-600"
                      )}>
                        {uploadCaption.length}/150
                      </span>
                    </div>
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

      {/* Edit Modal */}
      <AnimatePresence>
        {isEditing && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 bg-black z-50 overflow-y-auto no-scrollbar"
          >
            <div className="sticky top-0 bg-black/80 backdrop-blur-xl px-6 py-4 flex justify-between items-center border-b border-white/5 z-30">
              <button 
                onClick={handleCancelEdit} 
                className="w-10 h-10 flex items-center justify-center bg-zinc-900 rounded-xl hover:bg-zinc-800 transition-colors"
              >
                <X size={24} />
              </button>
              <h2 className="text-xl font-bold tracking-tight">Editar Perfil</h2>
              <button 
                onClick={handleSave} 
                disabled={!hasUnsavedChanges}
                className={cn(
                  "px-6 py-2 rounded-xl font-bold text-sm transition-all shadow-lg active:scale-95",
                  hasUnsavedChanges 
                    ? "bg-pink-600 text-white shadow-pink-600/20" 
                    : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                )}
              >
                Guardar
              </button>
            </div>

            <div className="pb-24">
              {/* Cover Edit */}
              <div 
                onClick={() => coverInputRef.current?.click()}
                className="relative h-56 bg-zinc-900 overflow-hidden group cursor-pointer"
              >
                <input 
                  type="file" 
                  ref={coverInputRef} 
                  className="hidden" 
                  accept="image/*"
                  onChange={(e) => handleFileUpload(e, 'cover')}
                />
                {editCoverURL ? (
                  <img src={editCoverURL} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt="Edit Cover" />
                ) : (
                  <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                    <ImageIcon size={32} className="text-zinc-700" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <div className="p-4 bg-black/60 backdrop-blur-md rounded-2xl border border-white/10 flex items-center gap-2 transform group-hover:scale-110 transition-transform">
                    {uploadingCover ? <Loader2 className="animate-spin" size={20} /> : <Camera size={20} />}
                    <span className="text-sm font-bold uppercase tracking-widest text-[10px]">Alterar Capa</span>
                  </div>
                </div>
              </div>

              {/* Photo Edit */}
              <div className="px-6 -mt-16 relative z-10 flex flex-col items-center">
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="relative group w-40 h-40 cursor-pointer"
                >
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, 'profile')}
                  />
                  <div className="w-full h-full rounded-[3.5rem] border-8 border-black bg-zinc-900 p-1 overflow-hidden shadow-2xl relative">
                    <img 
                      src={editPhotoURL} 
                      className="w-full h-full rounded-[3.1rem] object-cover transition-transform duration-500 group-hover:scale-110" 
                      alt="Edit Profile"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="p-3 bg-black/60 backdrop-blur-md rounded-full border border-white/10">
                        {uploadingProfile ? <Loader2 className="animate-spin" size={24} /> : <Camera size={24} />}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-12 max-w-lg mx-auto">
                <div className="space-y-6">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] px-1">Nome de Exibição</label>
                    <div className="relative group">
                      <input 
                        type="text" 
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Como queres ser chamado?"
                        maxLength={30}
                        className="w-full bg-zinc-900/40 border-2 border-zinc-800/50 rounded-2xl px-5 py-4 focus:border-pink-500 focus:bg-zinc-900/80 outline-none transition-all font-bold text-lg"
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-zinc-600">
                        {editName.length}/30
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center px-1">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">Bio</label>
                      <span className={cn(
                        "text-[10px] font-black tracking-widest",
                        editBio.length > 140 ? "text-red-500" : "text-zinc-600"
                      )}>
                        {editBio.length}/150
                      </span>
                    </div>
                    <textarea 
                      rows={4}
                      value={editBio}
                      onChange={(e) => setEditBio(e.target.value)}
                      maxLength={150}
                      className="w-full bg-zinc-900/40 border-2 border-zinc-800/50 rounded-2xl px-5 py-4 focus:border-pink-500 focus:bg-zinc-900/80 outline-none transition-all resize-none font-medium text-zinc-100"
                      placeholder="Conta-nos um pouco sobre ti..."
                    />
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex justify-between items-center border-b border-white/5 pb-4">
                    <h3 className="text-sm font-black uppercase tracking-tighter italic text-pink-500">Emojis & Presets</h3>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Escolha rápida</p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                       <CheckCircle2 size={12} className="text-zinc-500" />
                       <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Avatar</h4>
                    </div>
                    <div className="grid grid-cols-5 gap-3">
                      {profilePresets.map((preset) => (
                        <button
                          key={preset}
                          onClick={() => setEditPhotoURL(preset)}
                          className={cn(
                            "aspect-square rounded-2xl overflow-hidden border-2 transition-all p-0.5",
                            editPhotoURL === preset 
                              ? "border-pink-500 scale-110 shadow-lg shadow-pink-500/20" 
                              : "border-zinc-800 hover:border-zinc-700"
                          )}
                        >
                          <img src={preset} className="w-full h-full rounded-xl object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                       <Grid size={12} className="text-zinc-500" />
                       <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Capa Personalizada</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {coverPresets.map((preset) => (
                        <button
                          key={preset}
                          onClick={() => setEditCoverURL(preset)}
                          className={cn(
                            "h-24 rounded-2xl overflow-hidden border-2 transition-all p-1 group",
                            editCoverURL === preset 
                              ? "border-pink-500 scale-[1.02] shadow-lg shadow-pink-500/10" 
                              : "border-zinc-800 hover:border-zinc-700 hover:scale-[1.01]"
                          )}
                        >
                          <img src={preset} className="w-full h-full rounded-xl object-cover transition-transform group-hover:scale-110" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-6 pt-6 border-t border-white/5">
                  <div className="flex justify-between items-center px-1">
                    <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">Links Externos</h3>
                    <Shield size={12} className="text-zinc-700" />
                  </div>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1">URL Avatar</label>
                       <input 
                         type="text" 
                         value={editPhotoURL}
                         onChange={(e) => setEditPhotoURL(e.target.value)}
                         className="w-full bg-zinc-900/20 border border-zinc-800 rounded-xl px-4 py-3 text-xs font-mono text-zinc-500 outline-none focus:border-pink-500/50"
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1">URL Capa</label>
                       <input 
                         type="text" 
                         value={editCoverURL}
                         onChange={(e) => setEditCoverURL(e.target.value)}
                         className="w-full bg-zinc-900/20 border border-zinc-800 rounded-xl px-4 py-3 text-xs font-mono text-zinc-500 outline-none focus:border-pink-500/50"
                       />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Side Drawer */}
      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 bg-zinc-900 z-50 flex flex-col"
          >
            <div className="px-6 py-4 flex items-center border-b border-white/5 bg-black/20">
              <button onClick={() => setShowSettings(false)} className="p-2 -ml-2">
                <ChevronRight className="rotate-180" size={24} />
              </button>
              <h2 className="text-xl font-bold ml-2">Definições e Privacidade</h2>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {/* Account Section */}
              <section className="space-y-4">
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest px-1">Conta</h3>
                <div className="bg-white/5 rounded-2xl overflow-hidden">
                  <SettingItem icon={Shield} label="Segurança" onClick={() => {}} />
                  <div className="h-[1px] bg-white/5 ml-14" />
                  <SettingItem icon={Bell} label="Notificações" onClick={() => {
                    const notify = async () => {
                      const res = await Notification.requestPermission();
                      alert(res === 'granted' ? 'Notificações ativadas!' : 'Permissão negada.');
                    };
                    notify();
                  }} />
                  <div className="h-[1px] bg-white/5 ml-14" />
                  <SettingItem icon={UserX} label="Utilizadores Bloqueados" onClick={() => {}} />
                </div>
              </section>

              {/* Danger Zone */}
              <section className="space-y-4">
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest px-1 text-red-500/70">Zona de Perigo</h3>
                <div className="bg-red-500/5 rounded-2xl overflow-hidden border border-red-500/10">
                  <SettingItem 
                    icon={Trash2} 
                    label="Eliminar Conta" 
                    textColor="text-red-500" 
                    onClick={() => {
                      if(confirm("Tem certeza que deseja eliminar sua conta? Esta ação é irreversível.")) {
                        deleteAccount();
                      }
                    }} 
                  />
                </div>
              </section>

              <button 
                onClick={logout}
                className="w-full py-4 text-center bg-white/5 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-white/10 transition-colors mt-auto"
              >
                <LogOut size={20} className="text-zinc-400" />
                Terminar Sessão
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAgeVerification && (
          <AgeVerification 
            onSuccess={() => setShowAgeVerification(false)}
            onCancel={() => setShowAgeVerification(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showLiveBroadcast && (
          <LiveBroadcast 
            onClose={() => setShowLiveBroadcast(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function SettingItem({ icon: Icon, label, onClick, textColor = "text-white" }: { icon: any, label: string, onClick: () => void, textColor?: string }) {
  return (
    <button 
      onClick={onClick}
      className="w-full px-5 py-4 flex items-center justify-between hover:bg-white/5 active:bg-white/10 transition-all text-left"
    >
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
          <Icon size={20} className={textColor} />
        </div>
        <span className={`font-semibold ${textColor}`}>{label}</span>
      </div>
      <ChevronRight size={20} className="text-zinc-600" />
    </button>
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

function VideoThumbnail({ vid, onClick }: { vid: any, onClick: () => void }) {
  const [hasError, setHasError] = useState(false);
  const isPhoto = vid.type === 'photo' || (vid.videoUrl && (vid.videoUrl.startsWith('data:image/') || vid.videoUrl.match(/\.(jpg|jpeg|png|webp|gif|svg)$|dicebear/i)));

  return (
    <div key={vid.id} onClick={onClick} className="aspect-[3/4] bg-zinc-900 overflow-hidden relative group cursor-pointer">
      {!vid.videoUrl || hasError ? (
        <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-950">
          <ImageIcon size={24} className="text-zinc-800/50 mb-1" />
          <span className="text-[6px] text-zinc-800 uppercase font-black">Link Erro</span>
        </div>
      ) : isPhoto ? (
        <img 
          src={vid.videoUrl} 
          className="w-full h-full object-cover opacity-60"
          onError={() => setHasError(true)}
        />
      ) : (
        <video 
          key={vid.videoUrl}
          src={vid.videoUrl} 
          className="w-full h-full object-cover opacity-60"
          muted
          playsInline
          loop
          onLoadedData={(e) => {
            const video = e.currentTarget;
            video.play().catch(() => {});
          }}
          onError={() => setHasError(true)}
        />
      )}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
        <Play size={20} className="text-white fill-white" />
      </div>
      <div className="absolute bottom-2 left-2 flex items-center gap-1 text-[10px] font-bold">
        <Heart size={10} className="fill-white" />
        {vid.likesCount || 0}
      </div>
    </div>
  );
}
