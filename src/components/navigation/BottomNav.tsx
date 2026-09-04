import React from 'react';
import { Link, useLocation } from '@/lib/react-router-shim';
import { motion } from 'framer-motion';
import { Home, Wallet, ArrowLeftRight, LineChart, CreditCard, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createPageUrl } from '@/utils';
import { useAuth } from '@/lib/AuthContext';
import { haptic } from '@/lib/haptics';

export default function BottomNav() {
  const location = useLocation();
  const { user } = useAuth();

  const navItems = [
    { icon: Home, label: 'Home', page: 'dashboard' },
    { icon: Wallet, label: 'Wallet', page: 'wallet' },
    { icon: ArrowLeftRight, label: 'Trade', page: 'trade', isTradeFab: true },
    { icon: LineChart, label: 'Track', page: 'markets' },
    { icon: CreditCard, label: 'Portfolio', page: 'portfolio' },
  ];

  return (
    <nav className={cn(
      'fixed bottom-0 left-0 right-0 z-40 md:hidden pb-safe',
      'bg-[#0B1220]/90 backdrop-blur-xl border-t border-white/5',
      'shadow-[0_-8px_30px_-8px_rgba(0,0,0,0.5)]'
    )}>
      <div className="flex items-end justify-around pt-2 pb-3 px-2 relative">
        {navItems.map((item) => {
          const isActive = location.pathname === createPageUrl(item.page);

          if (item.isTradeFab) {
            return (
              <Link
                key={item.page}
                to={createPageUrl(item.page)}
                onClick={() => haptic('medium')}
                className="relative flex flex-col items-center justify-center -top-4 group flex-1"
              >
                <motion.div
                  whileTap={{ scale: 0.9 }}
                  whileHover={{ scale: 1.05 }}
                  className={cn(
                    'w-14 h-14 rounded-full flex items-center justify-center text-white',
                    'bg-[#0082FF] shadow-lg shadow-sky-500/40 ring-4 ring-[#0B1220]',
                    'transition-all duration-200'
                  )}
                >
                  <ArrowLeftRight className="h-6 w-6 stroke-[2.2]" />
                </motion.div>
                <span className={cn(
                  'text-[10px] font-semibold mt-1 transition-colors',
                  isActive ? 'text-[#0082FF]' : 'text-slate-400 group-hover:text-white'
                )}>
                  {item.label}
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={item.page}
              to={createPageUrl(item.page)}
              onClick={() => haptic('light')}
              className={cn(
                'relative flex flex-col items-center justify-center py-1 px-1 transition-all active:scale-95 flex-1',
                isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200'
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="activeTabGlow"
                  className="absolute -top-2 w-8 h-1 bg-[#0082FF] rounded-full shadow-[0_0_8px_#0082FF]"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
              <item.icon className={cn(
                'h-5 w-5 transition-transform duration-200',
                isActive && 'scale-110 text-[#0082FF]'
              )} />
              <span className={cn(
                'text-[10px] mt-1 font-medium tracking-tight',
                isActive ? 'text-white font-semibold' : 'text-slate-400'
              )}>
                {item.label}
              </span>
            </Link>
          );
        })}

        {user?.role === 'admin' && (
          <Link
            to={createPageUrl('Admin')}
            onClick={() => haptic('light')}
            className={cn(
              'relative flex flex-col items-center justify-center py-1 px-1 transition-all active:scale-95 flex-1',
              location.pathname === '/admin' ? 'text-white' : 'text-slate-400'
            )}
          >
            <Shield className={cn(
              'h-5 w-5 transition-transform',
              location.pathname === '/admin' && 'scale-110 text-[#0082FF]'
            )} />
            <span className="text-[10px] mt-1 font-medium text-slate-400">
              Admin
            </span>
          </Link>
        )}
      </div>
    </nav>
  );
}