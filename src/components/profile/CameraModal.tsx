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
  const [mode, setMode] = useState<'photo' | 'video'>('photo');
  const [isRecording, setIsRecording] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [flash, setFlash] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

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
        audio: mode === 'video'
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
    if (timerRef.current) {
      clearInterval(timerRef.current);
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

  const startRecording = () => {
    if (!stream) return;
    setIsRecording(true);
    setRecordingTime(0);
    chunksRef.current = [];
    
    const recorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp8'
    });

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    recorder.onstop = async () => {
      const mimeTypeToUse = recorder.mimeType || 'video/webm';
      const blob = new Blob(chunksRef.current, { type: mimeTypeToUse });
      const file = new File([blob], 'captured_video.webm', { type: mimeTypeToUse });
      
      // Since video capture can be heavy, always try to use the compression logic 
      // if it's over 300KB to ensure we stay under Firestore limits.
      if (blob.size > 300000) {
        try {
          // Pass dummy progress for now or add a message
          const compressed = await compressVideo(file, () => {});
          onCapture(compressed, 'video');
          onClose();
        } catch (err) {
          console.error("Camera compression error:", err);
          const reader = new FileReader();
          reader.onloadend = () => {
            onCapture(reader.result as string, 'video');
            onClose();
          };
          reader.readAsDataURL(blob);
        }
      } else {
        const reader = new FileReader();
        reader.onloadend = () => {
          onCapture(reader.result as string, 'video');
          onClose();
        };
        reader.readAsDataURL(blob);
      }
    };

    mediaRecorderRef.current = recorder;
    recorder.start();

    timerRef.current = setInterval(() => {
      setRecordingTime(prev => {
        if (prev >= 30) {
          stopRecording();
          return 30;
        }
        return prev + 1;
      });
    }, 1000);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const handleCaptureClick = () => {
    if (mode === 'photo') {
      capturePhoto();
    } else {
      if (isRecording) {
        stopRecording();
      } else {
        startRecording();
      }
    }
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
                
                {isRecording && (
                  <div className="flex items-center gap-2 bg-red-500 px-4 py-1.5 rounded-full font-black text-sm">
                    <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                    {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
                  </div>
                )}

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
                {/* Mode Selector */}
                {!isRecording && (
                  <div className="flex bg-black/40 backdrop-blur-xl p-1 rounded-2xl border border-white/10">
                    <button 
                      onClick={() => setMode('photo')}
                      className={cn(
                        "px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                        mode === 'photo' ? "bg-white text-black" : "text-white/40"
                      )}
                    >
                      Foto
                    </button>
                    <button 
                      onClick={() => setMode('video')}
                      className={cn(
                        "px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                        mode === 'video' ? "bg-white text-black" : "text-white/40"
                      )}
                    >
                      Vídeo
                    </button>
                  </div>
                )}

                {/* Capture Button */}
                <div className="flex items-center justify-center w-full">
                  <button 
                    onClick={handleCaptureClick}
                    className="relative flex items-center justify-center group"
                  >
                    <div className="absolute inset-0 bg-white/20 rounded-full scale-125 blur-sm opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="w-20 h-20 border-4 border-white rounded-full flex items-center justify-center p-1">
                      <div className={cn(
                        "w-full h-full rounded-full transition-all duration-300",
                        mode === 'photo' ? "bg-white" : isRecording ? "bg-red-500 scale-50 rounded-lg" : "bg-red-500"
                      )} />
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
