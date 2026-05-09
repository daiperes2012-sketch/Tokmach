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
  ChevronLeft,
  ShieldAlert,
  UserX,
  Bell,
  CheckCircle2,
  Camera,
  Plus,
  VideoOff,
  Image as ImageIcon,
  Radio,
  Loader2,
  Play,
  MessageCircle,
  Share2,
  MoreHorizontal,
  UserPlus,
  UserMinus,
  Upload
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, serverTimestamp, query, where, onSnapshot, orderBy, getDocs, doc, deleteDoc, updateDoc, increment, addDoc, setDoc, documentId } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../services/firebase';
import { useToast } from '../../hooks/useToast';
import { compressImage } from '../../services/mediaService';
import { useDropzone } from 'react-dropzone';
import CameraModal from './CameraModal';
import PhotoUploadModal from '../common/PhotoUploadModal';

export default function Profile({ targetUserId, onBack }: { targetUserId?: string | null; onBack?: () => void }) {
  const { profile: myProfile, user, logout, updateProfile, deleteAccount } = useAuth();
  const { toast, confirm: appConfirm } = useToast();
  
  const [targetProfile, setTargetProfile] = useState<any | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);

  const isOwnProfile = !targetUserId || targetUserId === user?.uid;
  const profile = isOwnProfile ? myProfile : targetProfile;
  const currentUserId = isOwnProfile ? user?.uid : targetUserId;

  const [isEditing, setIsEditing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [userPhotos, setUserPhotos] = useState<any[]>([]);
  const [likedPhotos, setLikedPhotos] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'gallery' | 'likes'>('gallery');
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
  
  // State for profile/cover simple uploads
  const [simpleUploadProgress, setSimpleUploadProgress] = useState(0);
  const [isProcessingSimple, setIsProcessingSimple] = useState(false);

  // Fetch target profile if not own
  useEffect(() => {
    if (isOwnProfile || !targetUserId) {
      setTargetProfile(null);
      return;
    }

    setLoadingProfile(true);
    const unsub = onSnapshot(doc(db, 'users', targetUserId), (snap) => {
      if (snap.exists()) {
        setTargetProfile({ id: snap.id, ...snap.data() });
      }
      setLoadingProfile(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `users/${targetUserId}`);
      setLoadingProfile(false);
    });

    return unsub;
  }, [targetUserId, isOwnProfile]);

  // Check if following
  useEffect(() => {
    if (isOwnProfile || !user || !targetUserId) {
      setIsFollowing(false);
      return;
    }

    const followId = `${user.uid}_${targetUserId}`;
    const unsub = onSnapshot(doc(db, 'follows', followId), (snap) => {
      setIsFollowing(snap.exists());
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `follows/${followId}`);
    });

    return unsub;
  }, [user, targetUserId, isOwnProfile]);

  const handleFollow = async () => {
    if (!user || !targetUserId || isOwnProfile || isFollowLoading) return;

    setIsFollowLoading(true);
    const followId = `${user.uid}_${targetUserId}`;
    const followDoc = doc(db, 'follows', followId);

    try {
      if (isFollowing) {
        // Unfollow
        await deleteDoc(followDoc);
        // Decrement counts
        await updateDoc(doc(db, 'users', user.uid), { followingCount: increment(-1) });
        await updateDoc(doc(db, 'users', targetUserId), { followersCount: increment(-1) });
        toast('info', `Deixaste de seguir @${targetUserId.slice(0, 8)}`);
      } else {
        // Follow
        await setDoc(followDoc, {
          followerId: user.uid,
          followedId: targetUserId,
          createdAt: serverTimestamp()
        });
        // Increment counts
        await updateDoc(doc(db, 'users', user.uid), { followingCount: increment(1) });
        await updateDoc(doc(db, 'users', targetUserId), { followersCount: increment(1) });
        toast('success', `Agora segues @${targetUserId.slice(0, 8)}`);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'follows');
    } finally {
      setIsFollowLoading(false);
    }
  };

  const getCurrentList = () => {
    if (activeTab === 'gallery') return userPhotos;
    return likedPhotos;
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

  const avatarInputRef = useRef<HTMLInputElement>(null);
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'cover') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (type === 'avatar') setUploadingProfile(true);
    else setUploadingCover(true);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        const compressed = await compressImage(base64);
        if (type === 'avatar') {
          setEditPhotoURL(compressed);
        } else {
          setEditCoverURL(compressed);
        }
        setHasUnsavedChanges(true);
        if (type === 'avatar') setUploadingProfile(false);
        else setUploadingCover(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      toast('error', 'Falha ao processar imagem');
      if (type === 'avatar') setUploadingProfile(false);
      else setUploadingCover(false);
    }
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
    if (!currentUserId) return;
    const q = query(
      collection(db, 'videos'),
      where('creatorId', '==', currentUserId),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(q, { includeMetadataChanges: false }, (snap) => {
      const posts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      
      // Deduplicate
      const seen = new Set();
      const uniquePosts = posts.filter(p => {
        if (seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      });
      
      setUserPhotos(uniquePosts);
      
      const total = uniquePosts.reduce((sum, vid) => sum + (vid.likesCount || 0), 0);
      setTotalLikesReceived(total);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'videos');
    });

    return unsub;
  }, [currentUserId]);

  const [likedPostIds, setLikedPostIds] = useState<string[]>([]);

  useEffect(() => {
    if (!currentUserId) return;
    
    const likesQuery = query(
      collection(db, 'likes'),
      where('userId', '==', currentUserId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(likesQuery, (snapshot) => {
      const ids = snapshot.docs.map(d => d.data().videoId);
      // Deduplicate IDs
      const uniqueIds = Array.from(new Set(ids));
      setLikedPostIds(uniqueIds);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'likes');
    });

    return unsubscribe;
  }, [user]);

  useEffect(() => {
    let active = true;
    const fetchPosts = async () => {
      if (likedPostIds.length === 0) {
        setLikedPhotos([]);
        return;
      }

      try {
        const idsToFetch = likedPostIds.slice(0, 30);
        
        const videosQuery = query(
          collection(db, 'videos'),
          where(documentId(), 'in', idsToFetch)
        );
        
        const snapshot = await getDocs(videosQuery);
        if (!active) return;
        
        const postsData = snapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        }));
        
        setLikedPhotos(postsData);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'videos (likes metadata)');
      }
    };

    fetchPosts();
    return () => { active = false; };
  }, [likedPostIds]);

  const handleCameraCapture = (dataUrl: string) => {
    // For now, camera capture on profile goes to new post
    // But since the new modal handles the whole flow, we just trigger it
    toast('info', 'Por favor, carregue a foto da galeria para usar os novos filtros.');
    setShowCamera(false);
  };

  const handleSave = async () => {
    if (!editName.trim()) {
      toast('error', "O nome não pode estar vazio.");
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
      appConfirm({
        title: "Alterações não guardadas",
        message: "Desejas descartar as alterações?",
        onConfirm: () => {
          setIsEditing(false);
          setHasUnsavedChanges(false);
        }
      });
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
            {!isOwnProfile && onBack && (
              <button 
                onClick={onBack} 
                className="p-2 -ml-2 hover:bg-white/10 rounded-full transition-colors mr-1"
              >
                <ChevronLeft size={24} />
              </button>
            )}
            <h2 className="text-xl font-bold tracking-tight">{profile.displayName}</h2>
          </div>
          <div className="flex items-center gap-2">
            {isOwnProfile ? (
              <>
                <button 
                  onClick={() => setShowCamera(true)} 
                  className="p-2 hover:bg-white/10 rounded-full transition-colors text-pink-500"
                >
                  <Camera size={22} />
                </button>
                <button onClick={() => setShowSettings(true)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <Settings size={22} />
                </button>
              </>
            ) : (
              <button className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <MoreHorizontal size={22} />
              </button>
            )}
          </div>
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
          </div>
          {isOwnProfile && (
            <button 
              onClick={() => setIsEditing(true)}
              className="absolute bottom-2 right-2 p-3 bg-pink-600 rounded-2xl border-4 border-black hover:scale-110 active:scale-95 transition-all shadow-xl text-white group-hover:rotate-6"
            >
              <Camera size={18} />
            </button>
          )}
        </div>

        <h1 className="text-xl font-bold mb-1 flex items-center gap-2">
          @{currentUserId?.slice(0, 8)}
        </h1>
        
        <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
          <div className="flex items-center gap-1.5 bg-yellow-500/10 px-3 py-1 rounded-full border border-yellow-500/20">
            <span className="text-yellow-500 font-bold text-xs">{profile.balance || 0} Moedas</span>
          </div>
        </div>
        <p className="text-zinc-500 text-sm mb-6 px-12 text-center leading-relaxed">
          {profile.bio || (isOwnProfile ? "Adicione uma bio para as pessoas te conhecerem melhor." : "Este usuário ainda não adicionou uma bio.")}
        </p>

        {/* Stats */}
        <div className="flex justify-center gap-12 w-full max-w-xs mb-8">
          <div className="flex flex-col items-center">
            <span className="font-bold text-lg">{profile.followingCount || 0}</span>
            <span className="text-xs text-zinc-500 uppercase tracking-widest">Seguindo</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="font-bold text-lg">{profile.followersCount || 0}</span>
            <span className="text-xs text-zinc-500 uppercase tracking-widest">Seguidores</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="font-bold text-lg">{totalLikesReceived}</span>
            <span className="text-xs text-zinc-500 uppercase tracking-widest">Curtidas</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 px-6 mb-8 w-full max-w-sm mx-auto">
        {isOwnProfile ? (
          <button 
            onClick={() => setShowUploadModal(true)}
            className="flex-1 py-4 bg-pink-600 text-white font-black uppercase tracking-widest text-[11px] rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-pink-600/20 active:scale-95 transition-all"
          >
            <Plus size={18} />
            Postar Foto
          </button>
        ) : (
          <div className="flex gap-3 w-full">
            <button 
              onClick={handleFollow}
              disabled={isFollowLoading}
              className={cn(
                "flex-1 py-4 rounded-2xl font-black uppercase tracking-widest text-[11px] transition-all active:scale-95 flex items-center justify-center gap-2",
                isFollowing 
                  ? "bg-zinc-800 text-white hover:bg-zinc-700" 
                  : "bg-pink-600 text-white hover:bg-pink-700 shadow-lg shadow-pink-600/20"
              )}
            >
              {isFollowLoading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : isFollowing ? (
                <>
                  <UserMinus size={18} />
                  <span>Seguindo</span>
                </>
              ) : (
                <>
                  <UserPlus size={18} />
                  <span>Seguir</span>
                </>
              )}
            </button>
            <button className="flex-1 py-4 bg-zinc-800 text-white font-black uppercase tracking-widest text-[11px] rounded-2xl hover:bg-zinc-700 transition-colors active:scale-95 flex items-center justify-center gap-2">
              <LogOut size={18} className="rotate-180" />
              Chat
            </button>
          </div>
        )}
      </div>

      {/* Content Tabs */}
      <div className="border-t border-white/5">
        <div className="flex border-b border-white/5">
          <button 
            onClick={() => setActiveTab('gallery')}
            className={cn(
              "flex-1 py-4 flex justify-center transition-all",
              activeTab === 'gallery' ? "border-b-2 border-white text-white" : "text-zinc-500 opacity-50"
            )}
          >
            <Grid size={22} />
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
        
        {activeTab === 'gallery' ? (
          userPhotos.length > 0 ? (
            <div className="grid grid-cols-3 gap-0.5">
              {userPhotos.map((vid, idx) => (
                <div 
                  key={vid.id} 
                  className="aspect-[3/4] bg-zinc-900 group relative cursor-pointer overflow-hidden"
                  onClick={() => {
                    setSelectedMediaIndex(idx);
                    setSelectedMedia(vid);
                  }} 
                >
                  <img src={vid.videoUrl} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 px-6 opacity-30">
              <Grid size={48} strokeWidth={1} className="mb-4" />
              <p className="text-sm font-medium text-center">Nenhum conteúdo publicado ainda.<br/>Toque no "+" para começar!</p>
            </div>
          )
        ) : (
          likedPhotos.length > 0 ? (
            <div className="grid grid-cols-3 gap-0.5">
              {likedPhotos.map((vid, idx) => (
                <div 
                  key={vid.id} 
                  className="aspect-[3/4] bg-zinc-900 group relative cursor-pointer overflow-hidden"
                  onClick={() => {
                    setSelectedMediaIndex(idx);
                    setSelectedMedia(vid);
                  }} 
                >
                  <img src={vid.videoUrl} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
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
                      <ImageIcon size={48} className="opacity-20 mb-4" />
                      <p className="text-[10px] uppercase tracking-widest font-black">Foto Indisponível</p>
                    </div>
                  ) : (
                    <img src={selectedMedia.videoUrl} className="w-full h-full object-cover" draggable={false} />
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
                  </div>

                  <div className="bg-white/5 backdrop-blur-md rounded-[2rem] p-6 border border-white/10">
                    <p className="text-zinc-200 text-sm font-semibold italic leading-relaxed mb-4">
                      {selectedMedia.description}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest">ID: {selectedMedia.id}</span>
                      <span className="text-[10px] font-black text-pink-500 italic uppercase">#VIBE #PHOTO</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Plus Button */}
      {isOwnProfile && (
        <div className="fixed bottom-24 right-6 z-40">
          <button 
            onClick={() => setShowUploadModal(true)}
            className="w-14 h-14 rounded-full flex items-center justify-center shadow-2xl bg-gradient-to-tr from-pink-500 to-violet-600 active:scale-95 transition-all"
          >
            <Plus size={32} className="text-white" />
          </button>
        </div>
      )}

      <PhotoUploadModal 
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
      />

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
                  onClick={() => avatarInputRef.current?.click()}
                  className="relative group w-40 h-40 cursor-pointer"
                >
                  <input 
                    type="file" 
                    ref={avatarInputRef} 
                    className="hidden" 
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, 'avatar')}
                  />
                  <div className="w-full h-full rounded-[3.5rem] border-8 border-black bg-zinc-900 p-1 overflow-hidden shadow-2xl relative">
                    <img 
                      src={editPhotoURL || undefined} 
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
                      toast(res === 'granted' ? 'success' : 'error', res === 'granted' ? 'Notificações ativadas!' : 'Permissão negada.');
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
                      appConfirm({
                        title: "Eliminar Conta",
                        message: "Tem certeza que deseja eliminar sua conta? Esta ação é irreversível.",
                        isDanger: true,
                        confirmText: "Eliminar",
                        onConfirm: () => deleteAccount()
                      });
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

      <CameraModal 
        isOpen={showCamera}
        onClose={() => setShowCamera(false)}
        onCapture={handleCameraCapture}
      />
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
