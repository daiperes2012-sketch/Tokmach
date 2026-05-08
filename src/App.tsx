import { useState, useEffect, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { useNotifications } from './hooks/useNotifications';
import Navigation from './components/layout/Navigation';
import Logo from './components/common/Logo';
import { LogIn, Video, Bell, Mail, Apple, Chrome, UserCircle, AlertTriangle, X, Phone, ChevronLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

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
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginMethod, setLoginMethod] = useState<'options' | 'phone'>('options');
  const [phoneNumber, setPhoneNumber] = useState('');

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
    const handleLogin = async () => {
      setIsLoggingIn(true);
      setLoginError(null);
      try {
        await login();
      } catch (error: any) {
        console.error("Login failed:", error);
        setLoginError("Ocorreu um erro ao entrar. Tente novamente.");
      } finally {
        setIsLoggingIn(false);
      }
    };

    const handlePhoneSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (phoneNumber.length < 8) {
        setLoginError('Por favor, insira um número válido.');
        return;
      }
      handleLogin();
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
              {loginMethod === 'options' ? 'Real connections, real vibes.' : 'Entrar com telefone'}
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
              {loginMethod === 'options' ? (
                <motion.div 
                  key="options"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-3"
                >
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <button
                      onClick={handleLogin}
                      disabled={isLoggingIn}
                      className="group relative h-14 overflow-hidden rounded-2xl transition-all active:scale-[0.98] disabled:opacity-80 shadow-xl shadow-pink-500/5"
                      id="login-google"
                    >
                      <div className="absolute inset-0 bg-white" />
                      <div className="relative flex items-center justify-center gap-2 text-black font-black uppercase text-[10px] tracking-widest">
                        <Chrome size={16} />
                        <span>Google</span>
                      </div>
                    </button>

                    <button
                      onClick={handleLogin}
                      disabled={isLoggingIn}
                      className="group relative h-14 overflow-hidden rounded-2xl transition-all active:scale-[0.98] disabled:opacity-80"
                      id="login-apple"
                    >
                      <div className="absolute inset-0 bg-zinc-800 border border-white/5" />
                      <div className="relative flex items-center justify-center gap-2 text-white font-black uppercase text-[10px] tracking-widest">
                        <Apple size={16} fill="currentColor" />
                        <span>Apple ID</span>
                      </div>
                    </button>
                  </div>

                  <button
                    onClick={() => setLoginMethod('phone')}
                    className="group relative w-full h-14 overflow-hidden rounded-2xl transition-all active:scale-[0.98]"
                    id="login-phone"
                  >
                    <div className="absolute inset-0 bg-pink-600 shadow-[0_0_20px_rgba(219,39,119,0.3)]" />
                    <div className="relative flex items-center justify-center gap-3 text-white font-black uppercase text-xs tracking-widest">
                      <Phone size={18} />
                      <span>Telefone</span>
                    </div>
                  </button>


                  <div className="py-2 flex items-center gap-4">
                    <div className="h-px flex-1 bg-white/5" />
                    <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">OU</span>
                    <div className="h-px flex-1 bg-white/5" />
                  </div>

                  <button
                    onClick={() => alert("Login por e-mail em breve!")}
                    className="group relative w-full h-14 overflow-hidden rounded-2xl transition-all active:scale-[0.98]"
                    id="login-email"
                  >
                    <div className="absolute inset-0 bg-zinc-950/50 border border-white/10" />
                    <div className="relative flex items-center justify-center gap-3 text-zinc-400 font-black uppercase text-xs tracking-widest">
                      <Mail size={18} />
                      <span>E-mail</span>
                    </div>
                  </button>
                  
                  <button
                    onClick={handleLogin}
                    className="group relative w-full overflow-hidden rounded-2xl transition-all active:scale-[0.98] mt-2"
                    id="login-guest"
                  >
                    <div className="relative flex items-center justify-center gap-2 py-2 text-zinc-500 font-black uppercase text-[10px] tracking-[0.2em] hover:text-zinc-300 transition-colors">
                      <UserCircle size={14} />
                      <span>Convidado</span>
                    </div>
                  </button>
                </motion.div>
              ) : (
                <motion.div 
                  key="phone"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <form onSubmit={handlePhoneSubmit} className="space-y-4">
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 text-sm font-black italic">
                        +55
                      </div>
                      <input 
                        autoFocus
                        type="tel"
                        placeholder="(00) 00000-0000"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 pl-14 pr-4 text-white font-bold tracking-widest placeholder:text-zinc-700 focus:border-pink-500/50 focus:outline-none transition-colors"
                      />
                    </div>
                    
                    <button
                      type="submit"
                      disabled={isLoggingIn || phoneNumber.length < 8}
                      className="group relative w-full h-14 overflow-hidden rounded-2xl transition-all active:scale-[0.98] disabled:opacity-50"
                    >
                      <div className="absolute inset-0 bg-white" />
                      <div className="relative flex items-center justify-center gap-3 text-black font-black uppercase text-xs tracking-[0.2em]">
                        {isLoggingIn ? (
                           <div className="w-4 h-4 border-2 border-zinc-200 border-t-black rounded-full animate-spin" />
                        ) : (
                          <span>Enviar Código</span>
                        )}
                      </div>
                    </button>
                  </form>

                  <button 
                    onClick={() => setLoginMethod('options')}
                    className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors mx-auto text-[10px] font-black uppercase tracking-widest"
                  >
                    <ChevronLeft size={14} />
                    Voltar para opções
                  </button>
                </motion.div>
              )}
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
            <Suspense fallback={<ViewLoader />}>
              {activeTab === 'feed' && <Feed />}
              {activeTab === 'match' && <Match />}
              {activeTab === 'messages' && <Messages />}
              {activeTab === 'profile' && <Profile />}
              {activeTab === 'store' && <Store />}
            </Suspense>
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
