import { useState, useEffect, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { useNotifications } from './hooks/useNotifications';
import { ToastProvider, useToast } from './hooks/useToast';
import Navigation from './components/layout/Navigation';
import Logo from './components/common/Logo';
import ErrorBoundary from './components/common/ErrorBoundary';
import { LogIn, Video, Bell, Chrome, UserCircle, AlertTriangle, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth } from './services/firebase';

// Lazy load heavy views for faster initial loading
const Feed = lazy(() => import('./components/feed/Feed'));
const Messages = lazy(() => import('./components/messages/Messages'));
const Match = lazy(() => import('./components/match/Match'));
const Profile = lazy(() => import('./components/profile/Profile'));
const Store = lazy(() => import('./components/store/Store'));

// Loading component for lazy views
const ViewLoader = () => (
  <div className="flex items-center justify-center h-full bg-black/50 backdrop-blur-sm">
    <motion.div
      animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
      className="flex flex-col items-center gap-4"
    >
      <div className="w-8 h-8 border-2 border-pink-500/20 border-t-pink-500 rounded-full animate-spin" />
      <span className="text-[10px] font-black text-pink-500/50 uppercase tracking-widest">Sincronizando...</span>
    </motion.div>
  </div>
);

function AppContent() {
  const { user, loading, login, isQuotaExceeded } = useAuth();
  const { permission, requestPermission } = useNotifications();
  const [activeTab, setActiveTab] = useState<'feed' | 'match' | 'messages' | 'profile' | 'store'>('feed');
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  // Helper to open a specific profile
  const openProfile = (uid: string) => {
    setProfileUserId(uid);
    setActiveTab('profile');
  };

  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginMethod, setLoginMethod] = useState<'options'>('options');

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
    const handleLogin = async (method: 'google' | 'anonymous' = 'google') => {
      setIsLoggingIn(true);
      setLoginError(null);
      try {
        await login(method);
      } catch (error: any) {
        console.error("Login failed:", error);
        if (error.code === 'auth/popup-closed-by-user') {
          setLoginError("Login cancelado. Tente novamente.");
        } else if (error.code === 'auth/network-request-failed') {
          setLoginError("Erro de rede. Verifique sua conexão.");
        } else if (error.code === 'auth/admin-restricted-operation') {
          setLoginError("Operação restrita. Certifique-se de que o método de login (Google/Anônimo) está ativado no Firebase Console.");
        } else if (error.code === 'auth/invalid-credential') {
          setLoginError("Credencial inválida. Isso pode ocorrer se as chaves da API não estiverem configuradas corretamente ou se a sessão expirou.");
        } else {
          setLoginError("Erro ao entrar. " + (error.message || "Tente novamente."));
        }
      } finally {
        setIsLoggingIn(false);
      }
    };

    return (
      <div className="relative flex flex-col items-center justify-center min-h-screen bg-black overflow-hidden font-sans p-6">
        {/* Background Image / Overlay */}
        <div className="absolute inset-0 z-0">
          <motion.img 
            initial={{ scale: 1.1 }}
            animate={{ scale: 1 }}
            transition={{ duration: 15, repeat: Infinity, repeatType: "reverse", ease: "linear" }}
            src="https://images.unsplash.com/photo-1516035069371-29a1b244cc32?q=60&w=1200&auto=format&fit=crop" 
            alt="Background" 
            className="w-full h-full object-cover opacity-20"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black via-black/40 to-black" />
        </div>

        {/* Animated Background Circles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div 
            animate={{ 
              x: [0, 50, 0], 
              y: [0, 80, 0],
              scale: [1, 1.2, 1],
              opacity: [0.1, 0.2, 0.1]
            }} 
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute top-1/4 -left-20 w-[400px] h-[400px] bg-pink-600/30 blur-[150px] rounded-full" 
          />
          <motion.div 
            animate={{ 
              x: [0, -50, 0], 
              y: [0, -80, 0],
              scale: [1, 1.3, 1],
              opacity: [0.1, 0.15, 0.1]
            }} 
            transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
            className="absolute bottom-1/4 -right-20 w-[500px] h-[500px] bg-violet-600/30 blur-[150px] rounded-full" 
          />
        </div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="z-10 w-full max-w-sm flex flex-col items-center"
        >
          <div className="bg-zinc-900/40 backdrop-blur-3xl rounded-[3.5rem] p-10 border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] text-center w-full relative overflow-hidden">
            {/* Logo Section */}
            <div className="flex justify-center mb-6 relative">
              <div className="absolute inset-0 bg-pink-500/20 blur-2xl rounded-full scale-150" />
              <Logo size="xl" />
            </div>

            <h1 className="text-4xl font-display font-black text-white mb-2 tracking-tight italic">
              Tok<span className="text-pink-500">Match</span>
            </h1>
            <p className="text-zinc-400 mb-10 text-xs leading-relaxed font-bold uppercase tracking-widest opacity-80 px-4">
              Real connections, real vibes.
            </p>

            {/* Error Message */}
            <AnimatePresence mode="wait">
              {loginError && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mb-8 bg-red-500/10 border border-red-500/20 rounded-2xl p-4"
                >
                  <p className="text-red-400 text-[10px] font-black uppercase tracking-widest">{loginError}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
              <motion.div 
                key="options"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 gap-3 mb-3">
                  <button
                    onClick={() => handleLogin('google')}
                    disabled={isLoggingIn}
                    className="group relative h-14 overflow-hidden rounded-2xl transition-all active:scale-[0.98] disabled:opacity-80 shadow-xl shadow-pink-500/5 focus:outline-none focus:ring-2 focus:ring-pink-500/20"
                    id="login-google"
                  >
                    <div className="absolute inset-0 bg-white" />
                    <div className="relative flex items-center justify-center gap-2 text-black font-black uppercase text-[10px] tracking-widest">
                      <Chrome size={16} />
                      <span>Entrar com Google</span>
                    </div>
                  </button>
                </div>

                <div className="py-2 flex items-center gap-4">
                  <div className="h-px flex-1 bg-white/5" />
                  <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">OU</span>
                  <div className="h-px flex-1 bg-white/5" />
                </div>

                <button
                  onClick={() => handleLogin('anonymous')}
                  className="group relative w-full h-14 overflow-hidden rounded-2xl transition-all active:scale-[0.98] border border-white/10 hover:bg-white/5"
                  id="login-guest"
                >
                  <div className="relative flex items-center justify-center gap-3 text-zinc-300 font-black uppercase text-xs tracking-widest">
                    <UserCircle size={18} />
                    <span>Entrar como Convidado</span>
                  </div>
                </button>
              </motion.div>
            </AnimatePresence>

            {/* Footer Links */}
            <div className="mt-10 pt-8 border-t border-white/5">
              <p className="text-zinc-600 text-[9px] uppercase font-bold tracking-[0.15em] leading-loose">
                Ao entrar, você aceita os <br/>
                <button className="text-zinc-400 hover:text-white transition-colors">Termos de Uso</button> 
                <span className="mx-2 text-zinc-800">•</span>
                <button className="text-zinc-400 hover:text-white transition-colors">Privacidade</button>
              </p>
            </div>
          </div>
          
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="mt-10 flex flex-col items-center gap-5"
          >
            <div className="flex -space-x-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="relative">
                  <div className="absolute inset-0 bg-pink-500/20 blur-md rounded-full" />
                  <img 
                    src={`https://api.dicebear.com/7.x/avataaars/svg?seed=user${i + 10}`}
                    alt="User"
                    className="w-10 h-10 rounded-2xl border-2 border-black bg-zinc-900 relative z-10"
                  />
                </div>
              ))}
              <div className="w-10 h-10 rounded-2xl border-2 border-black bg-zinc-800 flex items-center justify-center text-[10px] font-black text-pink-500 relative z-10 shadow-lg">
                +12k
              </div>
            </div>
            <div className="px-4 py-1.5 bg-white/5 backdrop-blur-xl border border-white/10 rounded-full">
              <p className="text-zinc-400 text-[10px] font-black uppercase tracking-widest">
                Junte-se à maior comunidade VIBE
              </p>
            </div>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  const handleTabChange = (tab: any) => {
    if (tab === 'profile') {
      setProfileUserId(null);
    }
    setActiveTab(tab);
  };

  return (
    <div className="flex flex-col h-screen bg-black text-white overflow-hidden max-w-md mx-auto relative shadow-2xl">
      <main className="flex-1 overflow-y-auto pb-20 no-scrollbar relative">
        <AnimatePresence initial={false}>
          <motion.div
            key={activeTab + (activeTab === 'profile' ? (profileUserId || 'self') : '')}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="h-full w-full absolute inset-0"
          >
            <ErrorBoundary>
              <Suspense fallback={<ViewLoader />}>
                {activeTab === 'feed' && <Feed openProfile={openProfile} />}
                {activeTab === 'match' && <Match />}
                {activeTab === 'messages' && <Messages />}
                {activeTab === 'profile' && (
                  <Profile 
                    targetUserId={profileUserId} 
                    onBack={() => {
                      setProfileUserId(null);
                      setActiveTab('feed');
                    }} 
                  />
                )}
                {activeTab === 'store' && <Store />}
              </Suspense>
            </ErrorBoundary>
          </motion.div>
        </AnimatePresence>
      </main>

      <Navigation activeTab={activeTab} setActiveTab={handleTabChange} />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </AuthProvider>
  );
}
