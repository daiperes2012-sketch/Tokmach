import { useState, useRef, useEffect } from 'react';
import { Camera, X, RefreshCw, Zap, Square, Circle, Video, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { compressImage, compressVideo } from '../../services/mediaService';

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (dataUrl: string, type: 'photo' | 'video') => void;
}

export default function CameraModal({ isOpen, onClose, onCapture }: CameraModalProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [flash, setFlash] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen, facingMode]);

  const startCamera = async () => {
    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode,
          width: { ideal: 1080 },
          height: { ideal: 1920 }
        },
        audio: false // No audio needed for photos
      });
      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const flipCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const capturePhoto = async () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Flip if using front camera
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(videoRef.current, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    const compressed = await compressImage(dataUrl);
    onCapture(compressed, 'photo');
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center"
        >
          {/* Viewport */}
          <div className="relative w-full h-full max-w-md bg-zinc-900 overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={cn(
                "w-full h-full object-cover",
                facingMode === 'user' && "transform -scale-x-100"
              )}
            />

            {/* Overlays */}
            <div className="absolute inset-0 flex flex-col justify-between p-6 pointer-events-none">
              {/* Top Controls */}
              <div className="flex justify-between items-center pointer-events-auto">
                <button onClick={onClose} className="p-3 bg-black/20 backdrop-blur-md rounded-2xl border border-white/10">
                  <X size={24} />
                </button>
                
                <div className="flex gap-3">
                  <button onClick={() => setFlash(!flash)} className={cn("p-3 bg-black/20 backdrop-blur-md rounded-2xl border border-white/10", flash && "text-yellow-400 border-yellow-400/50")}>
                    <Zap size={24} />
                  </button>
                  <button onClick={flipCamera} className="p-3 bg-black/20 backdrop-blur-md rounded-2xl border border-white/10">
                    <RefreshCw size={24} />
                  </button>
                </div>
              </div>

              {/* Bottom Controls */}
              <div className="flex flex-col items-center gap-8 pointer-events-auto">
                {/* Capture Button */}
                <div className="flex items-center justify-center w-full">
                  <button 
                    onClick={capturePhoto}
                    className="relative flex items-center justify-center group"
                  >
                    <div className="absolute inset-0 bg-white/20 rounded-full scale-125 blur-sm opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="w-20 h-20 border-4 border-white rounded-full flex items-center justify-center p-1">
                      <div className="w-full h-full rounded-full transition-all duration-300 bg-white" />
                    </div>
                  </button>
                </div>
              </div>
            </div>

            {/* Flash Effect */}
            <AnimatePresence>
              {flash && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-white pointer-events-none"
                />
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
