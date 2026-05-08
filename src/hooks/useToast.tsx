import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle, Info, X, Trash2, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';

type NotificationType = 'success' | 'error' | 'info' | 'warning';

interface Notification {
  id: string;
  type: NotificationType;
  message: string;
}

interface Confirm {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
}

interface ToastContextType {
  toast: (type: NotificationType, message: string) => void;
  confirm: (options: Confirm) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [confirmOptions, setConfirmOptions] = useState<Confirm | null>(null);

  const toast = useCallback((type: NotificationType, message: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setNotifications(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 4000);
  }, []);

  const confirm = useCallback((options: Confirm) => {
    setConfirmOptions(options);
  }, []);

  const handleConfirm = () => {
    if (confirmOptions) {
      confirmOptions.onConfirm();
      setConfirmOptions(null);
    }
  };

  const handleCancel = () => {
    if (confirmOptions) {
      confirmOptions.onCancel?.();
      setConfirmOptions(null);
    }
  };

  return (
    <ToastContext.Provider value={{ toast, confirm }}>
      {children}
      
      {/* Notifications Portal */}
      <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 pointer-events-none w-full max-w-xs px-4">
        <AnimatePresence>
          {notifications.map(n => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, y: -20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, y: -20 }}
              className={cn(
                "w-full p-4 rounded-2xl shadow-2xl border backdrop-blur-xl flex items-center gap-3 pointer-events-auto",
                n.type === 'success' && "bg-emerald-500/90 border-emerald-400 text-white shadow-emerald-500/20",
                n.type === 'error' && "bg-rose-500/90 border-rose-400 text-white shadow-rose-500/20",
                n.type === 'warning' && "bg-amber-500/90 border-amber-400 text-white shadow-amber-500/20",
                n.type === 'info' && "bg-blue-500/90 border-blue-400 text-white shadow-blue-500/20"
              )}
            >
              <div className="shrink-0">
                {n.type === 'success' && <CheckCircle2 size={20} />}
                {n.type === 'error' && <AlertCircle size={20} />}
                {n.type === 'warning' && <AlertTriangle size={20} />}
                {n.type === 'info' && <Info size={20} />}
              </div>
              <p className="text-xs font-black uppercase tracking-widest flex-1">{n.message}</p>
              <button onClick={() => setNotifications(prev => prev.filter(item => item.id !== n.id))} className="opacity-50 hover:opacity-100 transition-opacity p-1">
                <X size={16} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Confirmation Modal Portal */}
      <AnimatePresence>
        {confirmOptions && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCancel}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-sm bg-zinc-900 border border-white/10 rounded-[2.5rem] p-8 shadow-2xl relative z-10 text-center"
              onClick={e => e.stopPropagation()}
            >
              {confirmOptions.isDanger ? (
                <div className="w-20 h-20 rounded-3xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto mb-6 text-rose-500">
                  <Trash2 size={32} />
                </div>
              ) : (
                <div className="w-20 h-20 rounded-3xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center mx-auto mb-6 text-pink-500">
                  <AlertTriangle size={32} />
                </div>
              )}
              
              <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white mb-2">{confirmOptions.title}</h3>
              <p className="text-zinc-400 text-sm leading-relaxed mb-8">{confirmOptions.message}</p>
              
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleConfirm}
                  className={cn(
                    "w-full py-4 rounded-2xl font-black uppercase tracking-[0.2em] italic text-sm transition-all active:scale-95 shadow-xl",
                    confirmOptions.isDanger ? "bg-rose-600 text-white shadow-rose-900/50" : "bg-pink-600 text-white shadow-pink-900/50"
                  )}
                >
                  {confirmOptions.confirmText || 'Confirmar'}
                </button>
                <button
                  onClick={handleCancel}
                  className="w-full py-4 rounded-2xl font-black uppercase tracking-[0.2em] italic text-xs text-zinc-500 hover:text-white transition-all underline underline-offset-4"
                >
                  {confirmOptions.cancelText || 'Cancelar'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
