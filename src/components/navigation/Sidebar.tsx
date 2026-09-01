import React from 'react';
import { Link, useLocation } from '@/lib/react-router-shim';
import { motion } from 'framer-motion';
import { LayoutDashboard, TrendingUp, PieChart, Wallet, User, Zap, Radio } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createPageUrl } from '@/utils';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', page: 'dashboard' },
  { icon: TrendingUp, label: 'Markets', page: 'markets' },
  { icon: Zap, label: 'Trade', page: 'trade' },
  { icon: PieChart, label: 'Portfolio', page: 'portfolio' },
  { icon: Wallet, label: 'Wallet', page: 'wallet' },
  { icon: User, label: 'Profile', page: 'profile' },
];

const adminItems = [
  { icon: Shield, label: 'Admin Dashboard', page: 'Admin' },
];

import { useAuth } from '@/lib/AuthContext';
import { Shield } from 'lucide-react';

export default function Sidebar() {
  const location = useLocation();
  const { user } = useAuth();

  return (
    <aside className={cn(
      'hidden md:flex flex-col fixed left-0 top-0 bottom-0 w-64',
      'bg-card border-r border-border p-4'
    )}>
      <div className="flex items-center gap-3 px-3 py-4 mb-6">
        <img src="/logo.svg" alt="Crypto.com" className="h-7 w-auto object-contain" />
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === createPageUrl(item.page);
          return (
            <Link
              key={item.page}
              to={createPageUrl(item.page)}
              className={cn(
                'relative flex items-center gap-3 px-4 py-3 rounded-xl transition-all',
                'hover:bg-muted',
                isActive ? 'text-primary bg-primary/10' : 'text-muted-foreground'
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="activeSidebar"
                  className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-full"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
              <item.icon className="h-5 w-5" />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}

        {user?.role === 'admin' && (
          <div className="pt-4 mt-4 border-t border-border">
            <p className="px-4 mb-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Admin</p>
            {adminItems.map((item) => {
              const isActive = location.pathname === createPageUrl(item.page);
              return (
                <Link
                  key={item.page}
                  to={createPageUrl(item.page)}
                  className={cn(
                    'relative flex items-center gap-3 px-4 py-3 rounded-xl transition-all',
                    'hover:bg-muted',
                    isActive ? 'text-primary bg-primary/10' : 'text-muted-foreground'
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeSidebar"
                      className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-full"
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  )}
                  <item.icon className="h-5 w-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </nav>

      
    </aside>
  );
}