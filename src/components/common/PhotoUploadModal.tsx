import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'motion/react';
import { X, Upload, Check, Loader2, Sparkles, Image as ImageIcon, ChevronRight, ChevronLeft, Type, Camera } from 'lucide-react';
import { cn } from '../../lib/utils';
import { compressImage, PHOTO_FILTERS } from '../../services/mediaService';
import { db, handleFirestoreError, OperationType } from '../../services/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import CameraModal from '../profile/CameraModal';

interface PhotoUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PhotoUploadModal({ isOpen, onClose }: PhotoUploadModalProps) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  
  const [step, setStep] = useState<'select' | 'caption'>('select');
  const [showCamera, setShowCamera] = useState(false);
  const [previewFile, setPreviewFile] = useState<string | null>(null);
  const [originalFile, setOriginalFile] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const reset = useCallback(() => {
    setStep('select');
    setShowCamera(false);
    setPreviewFile(null);
    setOriginalFile(null);
    setCaption('');
    setIsProcessing(false);
    setIsUploading(false);
    setUploadProgress(0);
  }, []);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    
    const file = acceptedFiles[0];
    const reader = new FileReader();
    
    reader.onloadstart = () => setIsProcessing(true);
    reader.onloadend = () => {
      setOriginalFile(reader.result as string);
      setPreviewFile(reader.result as string);
      setIsProcessing(false);
      setStep('caption');
    };
    reader.readAsDataURL(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    maxFiles: 1,
    disabled: isProcessing
  });

  const handleCameraCapture = (dataUrl: string) => {
    setOriginalFile(dataUrl);
    setPreviewFile(dataUrl);
    setStep('caption');
    setShowCamera(false);
  };

  const handleUpload = async () => {
    if (!user || !previewFile) return;

    setIsUploading(true);
    setUploadProgress(10);

    try {
      // Final compression and check
      const finalMedia = await compressImage(previewFile);
      setUploadProgress(40);
      
      if (finalMedia.length > 950000) {
        throw new Error('A imagem resultante ainda é muito grande para o banco de dados. Tente uma foto menor.');
      }

      setUploadProgress(70);
      
      await addDoc(collection(db, 'videos'), {
        creatorId: user.uid,
        userName: profile?.displayName || 'Usuário',
        userAvatar: profile?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
        videoUrl: finalMedia, 
        thumbnailUrl: profile?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
        description: caption || `Nova foto de ${profile?.displayName || 'Usuário'}`,
        likesCount: 0,
        commentsCount: 0,
        createdAt: serverTimestamp(),
        type: 'photo'
      });

      setUploadProgress(100);
      toast('success', 'Foto publicada com sucesso!');
      
      onClose();
      reset();
    } catch (error) {
      console.error(error);
      toast('error', error instanceof Error ? error.message : 'Falha ao publicar foto');
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/95 backdrop-blur-xl"
        />

        {/* Content */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-lg bg-zinc-900/50 border border-white/10 rounded-[3rem] overflow-hidden flex flex-col shadow-2xl"
        >
          {/* Header */}
          <div className="p-6 flex items-center justify-between border-b border-white/5">
            <button 
              onClick={() => {
                if (step === 'caption') setStep('select');
                else onClose();
              }}
              className="p-2 hover:bg-white/5 rounded-2xl transition-colors"
            >
              <ChevronLeft size={24} />
            </button>
            <div className="text-center">
              <h2 className="text-lg font-black uppercase tracking-tighter italic">
                {step === 'select' ? 'Nova Foto' : 'Legenda'}
              </h2>
              <div className="flex gap-1 justify-center mt-1">
                <div className={cn("w-10 h-1 rounded-full bg-white/10", step === 'select' && "bg-pink-500")} />
                <div className={cn("w-10 h-1 rounded-full bg-white/10", step === 'caption' && "bg-pink-500")} />
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/5 rounded-2xl transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6">
            {step === 'select' ? (
              <div className="space-y-4">
                <button
                  onClick={() => setShowCamera(true)}
                  className="w-full aspect-video rounded-[2.5rem] bg-gradient-to-tr from-pink-500 to-violet-600 flex flex-col items-center justify-center gap-4 shadow-xl shadow-pink-500/20 active:scale-95 transition-all"
                >
                  <div className="bg-white/20 p-4 rounded-3xl backdrop-blur-md">
                    <Camera size={32} className="text-white" />
                  </div>
                  <span className="text-xl font-black uppercase italic tracking-tighter text-white">Usar Câmera</span>
                </button>

                <div 
                  {...getRootProps()} 
                  className={cn(
                    "w-full aspect-video rounded-[2.5rem] border-2 border-dashed flex flex-col items-center justify-center p-8 transition-all cursor-pointer relative overflow-hidden",
                    isDragActive ? "border-pink-500 bg-pink-500/10" : "border-white/10 hover:border-white/20 bg-white/5",
                    isProcessing && "opacity-50 cursor-wait"
                  )}
                >
                  <input {...getInputProps()} />
                  {isProcessing ? (
                    <Loader2 size={32} className="animate-spin text-pink-500" />
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <div className="bg-white/10 p-4 rounded-3xl">
                        <ImageIcon size={32} className="text-zinc-400" />
                      </div>
                      <span className="text-xl font-black uppercase italic tracking-tighter text-zinc-400">Galeria</span>
                    </div>
                  )}
                  {isDragActive && (
                    <div className="absolute inset-0 bg-pink-500/20 backdrop-blur-sm flex items-center justify-center">
                      <p className="text-white font-black italic uppercase">Solte Agora!</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="w-24 aspect-[3/4] rounded-2xl overflow-hidden shrink-0 shadow-lg ring-1 ring-white/10">
                    <img src={previewFile || ''} className="w-full h-full object-cover" alt="Thumb" />
                  </div>
                  <div className="flex-1 space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                      <Type size={12} />
                      Legenda do Post
                    </label>
                    <textarea 
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      placeholder="Sobre o que é esse post? Adicione #hashtags..."
                      className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm font-medium placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-pink-500/50 h-32 resize-none"
                    />
                  </div>
                </div>

                <div className="bg-white/5 p-6 rounded-[2rem] border border-white/10 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-pink-500/20 flex items-center justify-center">
                      <Sparkles size={18} className="text-pink-500" />
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest leading-none mb-1">Dica de Engajamento</p>
                      <p className="text-[10px] text-zinc-500 font-medium">Use legendas curtas e impactantes para ganhar mais likes.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 pt-0">
            {step === 'select' ? null : (
              <div className="flex gap-3">
                <button 
                  onClick={handleUpload}
                  disabled={isUploading}
                  className="flex-1 py-4 bg-gradient-to-tr from-pink-500 to-violet-600 text-white font-black uppercase tracking-[0.2em] text-[11px] rounded-2xl flex items-center justify-center gap-2 hover:shadow-2xl hover:shadow-pink-500/40 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Publicando... {uploadProgress}%
                    </>
                  ) : (
                    <>
                      Publicar agora
                      <Check size={18} />
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      <CameraModal 
        isOpen={showCamera}
        onClose={() => setShowCamera(false)}
        onCapture={handleCameraCapture}
      />
    </AnimatePresence>
  );
}
