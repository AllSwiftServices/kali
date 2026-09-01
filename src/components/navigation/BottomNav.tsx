import React from 'react';
import { Link, useLocation } from '@/lib/react-router-shim';
import { motion } from 'framer-motion';
import { LayoutDashboard, TrendingUp, PieChart, Wallet, Zap, Radio } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createPageUrl } from '@/utils';

const navItems = [
  { icon: LayoutDashboard, label: 'Home', page: 'dashboard' },
  { icon: TrendingUp, label: 'Markets', page: 'markets' },
  { icon: Zap, label: 'Trade', page: 'trade' },
  { icon: PieChart, label: 'Portfolio', page: 'portfolio' },
  { icon: Wallet, label: 'Wallet', page: 'wallet' },
];

import { useAuth } from '@/lib/AuthContext';
import { Shield } from 'lucide-react';
import { haptic } from '@/lib/haptics';

export default function BottomNav() {
  const location = useLocation();
  const { user } = useAuth();

  return (
    <nav className={cn(
      'fixed bottom-0 left-0 right-0 z-40 md:hidden pb-safe',
      // Frosted glass, no hard edge: heavy blur + high saturation with a
      // very light fill so it reads as translucent glass, not a bordered
      // panel — no border, no top highlight line, just a soft lift shadow.
      'bg-background/30 backdrop-blur-[80px] backdrop-saturate-200',
      'shadow-[0_-8px_30px_-8px_rgba(0,0,0,0.25)]'
    )}>
      <div className="flex items-center justify-around pt-3 pb-5 px-1">
        {navItems.map((item) => {
          const isActive = location.pathname === createPageUrl(item.page);
          return (
            <Link
              key={item.page}
              to={createPageUrl(item.page)}
              onClick={() => haptic('light')}
              className={cn(
                'relative flex flex-col items-center justify-center py-2 px-1 rounded-2xl transition-all active:scale-90 flex-1',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-primary/10 rounded-2xl"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
              <item.icon className={cn(
                'h-5 w-5 relative z-10 transition-transform',
                isActive && 'scale-110'
              )} />
              <span className="text-[9px] min-[380px]:text-[10px] mt-1 font-medium relative z-10">
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
                'relative flex flex-col items-center justify-center py-2 px-1 rounded-2xl transition-all active:scale-90 flex-1',
                location.pathname === '/admin' ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <Shield className={cn(
                'h-5 w-5 relative z-10 transition-transform',
                location.pathname === '/admin' && 'scale-110'
              )} />
              <span className="text-[9px] min-[380px]:text-[10px] mt-1 font-medium relative z-10">
                Admin
              </span>
            </Link>
        )}
      </div>
    </nav>
  );
}