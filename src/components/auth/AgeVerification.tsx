import React, { useRef, useState, useCallback } from 'react';
import { Camera, ShieldCheck, AlertCircle, RefreshCw, X, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from "@google/genai";
import { useAuth } from '../../hooks/useAuth';
import { cn } from '../../lib/utils';
import { serverTimestamp } from 'firebase/firestore';

interface AgeVerificationProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const AgeVerification: React.FC<AgeVerificationProps> = ({ onSuccess, onCancel }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { updateProfile } = useAuth();
  
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'capturing' | 'analyzing' | 'success' | 'failed'>('idle');
  const [error, setError] = useState<string | null>(null);

  const startCamera = async () => {
    try {
      setStatus('capturing');
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } 
      });
      setStream(mediaStream);
    } catch (err) {
      console.error('Error accessing camera:', err);
      setError('Não foi possível acessar a câmera. Verifique as permissões.');
      setStatus('failed');
    }
  };

  React.useEffect(() => {
    if (videoRef.current && stream && status === 'capturing') {
      videoRef.current.srcObject = stream;
    }
  }, [stream, status]);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setCapturedImage(dataUrl);
        stopCamera();
        analyzeImage(dataUrl);
      }
    }
  };

  const analyzeImage = async (base64Image: string) => {
    setStatus('analyzing');
    setError(null);
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error('API Key não configurada');

      const ai = new GoogleGenAI({ apiKey });
      
      const genImage = {
        inlineData: {
          data: base64Image.split(',')[1],
          mimeType: "image/jpeg",
        },
      };

      const prompt = "Analise a pessoa nesta foto. Ela parece ter 18 anos ou mais? Seja rigoroso. Responda apenas em JSON.";

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: { parts: [genImage, { text: prompt }] },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              isAbove18: { type: Type.BOOLEAN },
              confidence: { type: Type.NUMBER },
              reasoning: { type: Type.STRING }
            },
            required: ["isAbove18", "confidence", "reasoning"]
          }
        }
      });

      const result = JSON.parse(response.text);
      console.log('Verification result:', result);

      if (result.isAbove18 && result.confidence > 0.7) {
        setStatus('success');
        await updateProfile({ ageVerified: true, ageVerifiedAt: serverTimestamp() });
        setTimeout(() => {
          onSuccess?.();
        }, 2000);
      } else {
        setStatus('failed');
        setError('Verificação falhou. Você não parece ter mais de 18 anos ou a imagem não está clara.');
      }
    } catch (err) {
      console.error('Error analyzing image:', err);
      setError('Ocorreu um erro na análise. Tente novamente.');
      setStatus('failed');
    }
  };

  const reset = () => {
    setCapturedImage(null);
    setError(null);
    setStatus('idle');
    startCamera();
  };

  React.useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="w-full max-w-md overflow-hidden rounded-3xl bg-zinc-900 shadow-2xl border border-zinc-800"
      >
        {/* Header */}
        <div className="relative p-6 text-center border-b border-zinc-800">
          {!onCancel && (
            <button 
              onClick={onCancel}
              className="absolute right-4 top-4 p-2 rounded-full hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5 text-zinc-400" />
            </button>
          )}
          <div className="mx-auto w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center mb-4">
            <ShieldCheck className="w-6 h-6 text-zinc-100" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2 font-display">Verificação de Idade</h2>
          <p className="text-sm text-zinc-400">
            Para acessar conteúdos adultos, precisamos confirmar que você é maior de 18 anos através de biometria facial.
          </p>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="relative aspect-square rounded-2xl bg-zinc-950 overflow-hidden border-2 border-dashed border-zinc-800 flex items-center justify-center">
            {status === 'capturing' && stream && (
              <video 
                ref={videoRef} 
                playsInline 
                muted
                onLoadedMetadata={() => {
                  videoRef.current?.play().catch(e => {
                    if (e.name !== 'AbortError') console.warn("Video play failed", e);
                  });
                }}
                className="w-full h-full object-cover"
              />
            )}
            
            {capturedImage && (
              <img 
                src={capturedImage} 
                alt="Captured" 
                className="w-full h-full object-cover"
              />
            )}

            {status === 'analyzing' && (
              <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
                <RefreshCw className="w-10 h-10 text-white animate-spin mb-4" />
                <p className="text-white font-medium">Analisando sua idade...</p>
                <p className="text-zinc-400 text-xs mt-2 px-8 text-center italic">
                  Isso pode levar alguns segundos.
                </p>
              </div>
            )}

            {status === 'success' && (
              <div className="absolute inset-0 bg-green-500/20 flex flex-col items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center mb-4">
                  <CheckCircle className="w-8 h-8 text-white" />
                </div>
                <p className="text-white font-bold text-lg">Verificado!</p>
                <p className="text-zinc-200 text-sm mt-1">Acesso liberado.</p>
              </div>
            )}

            {status === 'failed' && error && !capturedImage && (
              <div className="flex flex-col items-center justify-center p-8 text-center">
                <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                <p className="text-red-400 font-medium mb-4">{error}</p>
                <button 
                  onClick={reset}
                  className="px-6 py-2 bg-zinc-800 text-white rounded-xl hover:bg-zinc-700 transition-colors flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Tentar novamente
                </button>
              </div>
            )}

            {/* Scanning Overlay */}
            {status === 'capturing' && (
              <div className="absolute inset-0 pointer-events-none border-4 border-zinc-100/30 rounded-2xl flex items-center justify-center">
                <div className="w-[80%] h-[80%] border border-zinc-100/30 rounded-full" />
                <motion.div 
                  initial={{ top: '10%' }}
                  animate={{ top: '85%' }}
                  transition={{ duration: 2, repeat: Infinity, repeatType: 'reverse' }}
                  className="absolute left-0 right-0 h-1 bg-zinc-100/50 blur-sm z-10"
                />
              </div>
            )}
          </div>

          <canvas ref={canvasRef} className="hidden" />

          {status === 'capturing' && (
            <div className="mt-6 flex justify-center">
              <button 
                onClick={capturePhoto}
                className="w-16 h-16 rounded-full border-4 border-white/20 p-1 hover:scale-105 transition-transform"
              >
                <div className="w-full h-full rounded-full bg-white flex items-center justify-center shadow-lg">
                  <Camera className="w-6 h-6 text-black" />
                </div>
              </button>
            </div>
          )}

          {status === 'failed' && capturedImage && (
            <div className="mt-6 flex flex-col items-center gap-4">
              <div className="flex items-center gap-2 text-red-400 bg-red-400/10 px-4 py-2 rounded-lg border border-red-400/20">
                <AlertCircle className="w-4 h-4" />
                <span className="text-xs font-medium">{error || "Não foi possível confirmar sua idade"}</span>
              </div>
              <button 
                onClick={reset}
                className="w-full py-3 bg-white text-black font-bold rounded-2xl hover:bg-zinc-200 transition-colors"
              >
                Tirar outra foto
              </button>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="p-6 bg-zinc-950/50 border-t border-zinc-800 text-[10px] text-zinc-500 text-center uppercase tracking-widest leading-relaxed">
          Suas fotos são processadas pela IA e deletadas instantaneamente. <br />
          Não armazenamos imagens pessoais.
        </div>
      </motion.div>
    </div>
  );
};
