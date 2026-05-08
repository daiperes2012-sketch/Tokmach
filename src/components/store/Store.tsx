import { motion } from 'motion/react';
import { Coins, Zap, Flame, Heart, Gift, ShoppingBag, CreditCard, Star } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function Store() {
  const { profile, updateProfile } = useAuth();
  const { toast } = useToast();

  const coinPackages = [
    { coins: 50, price: 'R$ 4,90', icon: Zap, color: 'text-blue-400' },
    { coins: 200, price: 'R$ 14,90', icon: Flame, color: 'text-orange-500', popular: true },
    { coins: 500, price: 'R$ 29,90', icon: Heart, color: 'text-pink-500' },
    { coins: 1500, price: 'R$ 79,90', icon: Star, color: 'text-yellow-500' },
    { coins: 5000, price: 'R$ 199,90', icon: Gift, color: 'text-purple-500', vip: true },
  ];

  const gifts = [
    { name: 'Coração', cost: 5, icon: Heart, color: 'text-pink-500' },
    { name: 'Fogo', cost: 10, icon: Flame, color: 'text-orange-500' },
    { name: 'Diamante', cost: 50, icon: ShoppingBag, color: 'text-blue-500' },
    { name: 'Coroa', cost: 100, icon: Star, color: 'text-yellow-500' },
  ];

  const handleBuy = async (amount: number) => {
    if (!profile) return;
    const newBalance = (profile.balance || 0) + amount;
    await updateProfile({ balance: newBalance });
    toast('success', `Sucesso! Você recebeu ${amount} moedas.`);
  };

  return (
    <div className="h-full bg-black text-white px-6 py-8 overflow-y-auto pb-24">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-glow-pink">Loja TokMatch</h1>
          <p className="text-xs text-zinc-500 uppercase tracking-widest mt-1">Turbine sua experiência</p>
        </div>
        <div className="bg-zinc-900 border border-white/5 py-2 px-4 rounded-2xl flex items-center gap-2">
          <Coins size={18} className="text-yellow-500" />
          <span className="font-bold text-lg">{profile?.balance || 0}</span>
        </div>
      </div>

      {/* Packages */}
      <section className="mb-12">
        <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-6 px-1">Pacotes de Moedas</h2>
        <div className="grid grid-cols-2 gap-4">
          {coinPackages.map((pkg: any) => (
            <motion.button
              key={pkg.coins}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleBuy(pkg.coins)}
              className={cn(
                "relative group flex flex-col items-center p-6 bg-zinc-900 rounded-3xl border transition-all",
                pkg.popular ? "border-pink-500/50 bg-pink-500/5" : "border-white/5",
                pkg.vip ? "col-span-2 flex-row justify-between border-purple-500/30 bg-purple-500/5" : ""
              )}
            >
              {pkg.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-pink-500 text-[8px] font-bold uppercase py-1 px-3 rounded-full text-white tracking-tighter">
                  Mais Popular
                </span>
              )}
              {pkg.vip && (
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(168,85,247,0.05),transparent)] pointer-events-none" />
              )}
              
              <div className={cn("flex flex-col items-center", pkg.vip ? "flex-row gap-4" : "")}>
                <pkg.icon size={32} className={cn("mb-3", pkg.color, pkg.vip ? "mb-0" : "")} />
                <div className={pkg.vip ? "text-left" : "text-center"}>
                  <span className="text-xl font-bold block">{pkg.coins}</span>
                  <span className="text-[10px] text-zinc-400 font-medium uppercase tracking-widest">{pkg.vip ? "Moedas VIP" : "Moedas"}</span>
                </div>
              </div>

              <div className={cn(
                "py-2 bg-white/5 rounded-xl font-bold text-sm text-zinc-100 group-hover:bg-white/10 transition-colors",
                pkg.vip ? "px-6" : "w-full mt-4"
              )}>
                {pkg.price}
              </div>
            </motion.button>
          ))}
        </div>
      </section>

      {/* Gifts Catalog preview */}
      <section>
        <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-6 px-1">Seu Inventário de Presentes</h2>
        <div className="bg-zinc-900/50 rounded-3xl p-6 border border-white/5">
          <div className="grid grid-cols-4 gap-4">
            {gifts.map(gift => (
              <div key={gift.name} className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center">
                  <gift.icon size={20} className={gift.color} />
                </div>
                <span className="text-[10px] uppercase font-bold text-zinc-600">{gift.cost} M</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="mt-12 p-6 bg-gradient-to-r from-zinc-900 to-black rounded-3xl border border-white/5 flex items-center gap-4">
        <div className="p-3 bg-pink-500/10 rounded-2xl">
          <CreditCard size={24} className="text-pink-500" />
        </div>
        <div>
          <h4 className="font-bold text-sm">Pagamento Seguro</h4>
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Processado instantaneamente</p>
        </div>
      </div>
    </div>
  );
}
