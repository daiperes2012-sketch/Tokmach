import { Flame, Bomb, MessageCircle, User, ShoppingBag } from 'lucide-react';
import { motion } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface NavigationProps {
  activeTab: 'feed' | 'match' | 'messages' | 'profile' | 'store';
  setActiveTab: (tab: 'feed' | 'match' | 'messages' | 'profile' | 'store') => void;
}

export default function Navigation({ activeTab, setActiveTab }: NavigationProps) {
  const tabs = [
    { id: 'feed', icon: Flame, label: 'Hot' },
    { id: 'match', icon: Bomb, label: 'Match' },
    { id: 'store', icon: ShoppingBag, label: 'Loja' },
    { id: 'messages', icon: MessageCircle, label: 'Chats' },
    { id: 'profile', icon: User, label: 'Perfil' },
  ] as const;

  return (
    <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-black/80 backdrop-blur-lg border-t border-white/10 px-6 py-3 z-50">
      <div className="flex justify-between items-center">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className="flex flex-col items-center relative group"
              id={`nav-${tab.id}`}
            >
              <div className={cn(
                "p-2 rounded-xl transition-all duration-300",
                isActive ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"
              )}>
                <tab.icon size={24} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              
              {isActive && (
                <motion.div
                  layoutId="nav-active"
                  className="absolute -top-1 w-1 h-1 bg-white rounded-full"
                />
              )}
              
              <span className={cn(
                "text-[10px] mt-1 font-medium transition-all",
                isActive ? "text-white opacity-100" : "text-zinc-500 opacity-60"
              )}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
