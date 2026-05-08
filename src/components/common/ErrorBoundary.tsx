import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { motion } from 'motion/react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  private handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center bg-black/90 backdrop-blur-xl rounded-[3rem] border border-white/5 m-4">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-20 h-20 bg-rose-500/10 rounded-3xl flex items-center justify-center mb-6 text-rose-500"
          >
            <AlertTriangle size={40} />
          </motion.div>
          
          <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white mb-4">
            Ops! Algo correu mal
          </h2>
          
          <p className="text-zinc-400 text-sm mb-8 leading-relaxed max-w-xs mx-auto font-medium">
            Ocorreu um erro ao carregar esta parte do aplicativo. Pode ser um problema temporário de conexão.
          </p>

          <div className="flex flex-col gap-3 w-full max-w-[200px]">
            <button
              onClick={this.handleReset}
              className="flex items-center justify-center gap-2 bg-pink-600 text-white font-black uppercase tracking-[0.2em] italic py-4 rounded-2xl active:scale-95 transition-all text-xs shadow-xl shadow-pink-900/40"
            >
              <RefreshCw size={16} />
              Tentar Novamente
            </button>
            <button
              onClick={this.handleGoHome}
              className="flex items-center justify-center gap-2 bg-white/5 text-zinc-400 font-black uppercase tracking-[0.2em] italic py-4 rounded-2xl hover:text-white transition-all text-[10px]"
            >
              <Home size={14} />
              Ir para o Início
            </button>
          </div>
          
          <div className="mt-8 pt-8 border-t border-white/5 w-full">
            <p className="text-[10px] text-zinc-600 font-mono break-all opacity-50 uppercase">
              {this.state.error?.name}: {this.state.error?.message?.slice(0, 50)}...
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
