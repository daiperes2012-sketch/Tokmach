import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { useNotifications } from './hooks/useNotifications';
import Navigation from './components/layout/Navigation';
import Feed from './components/feed/Feed';
import Messages from './components/messages/Messages';
import Match from './components/match/Match';
import Profile from './components/profile/Profile';
import Store from './components/store/Store';
import { LogIn, Video, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

function AppContent() {
  const { user, loading, login } = useAuth();
  const { permission, requestPermission } = useNotifications();
  const [activeTab, setActiveTab] = useState<'feed' | 'match' | 'messages' | 'profile' | 'store'>('feed');

  // Request notifications on first login
  useEffect(() => {
    if (user && permission === 'default') {
      const timer = setTimeout(() => {
        requestPermission();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [user, permission]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white">
        <motion.div
          animate={{ scale: [1, 1.2, 1], rotate: [0, 180, 360] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <Video size={48} className="text-pink-500" />
        </motion.div>
        <p className="mt-4 font-sans tracking-widest uppercase text-xs opacity-50">Carregando TokMatch...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm bg-zinc-900 rounded-3xl p-8 border border-zinc-800 shadow-2xl text-center"
        >
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-gradient-to-tr from-pink-500 to-violet-600 rounded-2xl shadow-lg shadow-pink-500/20">
              <Video size={40} className="text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-sans font-bold text-white mb-2 tracking-tight">TokMatch</h1>
          <p className="text-zinc-400 mb-8 text-sm leading-relaxed">
            Conecte-se com o mundo através de vídeos e encontre seu par ideal em tempo real.
          </p>
          <button
            onClick={login}
            className="w-full flex items-center justify-center gap-3 bg-white text-black font-semibold py-4 rounded-xl hover:bg-zinc-200 transition-all active:scale-95"
            id="login-button"
          >
            <LogIn size={20} />
            Entrar com Google
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-black text-white overflow-hidden max-w-md mx-auto relative shadow-2xl">
      <main className="flex-1 overflow-y-auto pb-20 no-scrollbar">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            {activeTab === 'feed' && <Feed />}
            {activeTab === 'match' && <Match />}
            {activeTab === 'messages' && <Messages />}
            {activeTab === 'profile' && <Profile />}
            {activeTab === 'store' && <Store />}
          </motion.div>
        </AnimatePresence>
      </main>

      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
