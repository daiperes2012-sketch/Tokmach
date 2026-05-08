import { motion } from 'motion/react';
import { Video } from 'lucide-react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export default function Logo({ size = 'md', className = '' }: LogoProps) {
  const sizes = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24'
  };

  const iconSizes = {
    sm: 16,
    md: 24,
    lg: 32,
    xl: 48
  };

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <motion.div 
        animate={{ 
          scale: [1, 1.05, 1],
          rotate: [0, 5, -5, 0]
        }}
        transition={{ 
          duration: 4, 
          repeat: Infinity, 
          ease: "easeInOut" 
        }}
        className={`${sizes[size]} relative`}
      >
        {/* Glow effect */}
        <div className="absolute inset-0 bg-pink-500 blur-xl opacity-30 animate-pulse" />
        
        {/* Main Logo Container */}
        <div className={`relative w-full h-full bg-gradient-to-tr from-pink-500 via-rose-500 to-violet-600 rounded-[30%] shadow-2xl flex items-center justify-center border border-white/20`}>
          <Video 
            size={iconSizes[size]} 
            className="text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" 
            strokeWidth={2.5}
          />
          
          {/* Subtle connection dots */}
          <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-white rounded-full opacity-60" />
          <div className="absolute bottom-1.5 left-1.5 w-1 h-1 bg-white rounded-full opacity-40" />
        </div>
      </motion.div>
    </div>
  );
}
