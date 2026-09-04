"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Bell, Menu, Gem } from 'lucide-react';
import { api } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { useNavigate } from '@/lib/react-router-shim';
import { createPageUrl } from '@/utils';
import { useAuth } from '@/lib/AuthContext';
import WalletBreakdown from '@/components/dashboard/WalletBreakdown';
import QuickActions from '@/components/dashboard/QuickActions';
import TopMovers from '@/components/dashboard/TopMovers';
import AnimatedNumber from '@/components/common/AnimatedNumber';
import { NotificationDrawer } from '@/components/notifications/NotificationDrawer';

export default function Dashboard() {
  const [hideBalance, setHideBalance] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const { user, isLoadingAuth } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoadingAuth && !user) {
      navigate(createPageUrl('Home'));
    }
  }, [user, isLoadingAuth, navigate]);

  const { data: assets } = useQuery({
    queryKey: ['assets'],
    queryFn: async () => {
      const { data, error } = await api.get<any[]>('/assets');
      if (error) throw error;
      return data;
    }
  });

  const { data: wallets } = useQuery({
    queryKey: ['wallets'],
    queryFn: async () => {
      const { data, error } = await api.get<any[]>('/wallets');
      if (error) throw error;
      return data;
    },
    enabled: !!user
  });

  const { data: portfolio } = useQuery({
    queryKey: ['portfolio'],
    queryFn: async () => {
      const { data, error } = await api.get<any[]>('/portfolio');
      if (error) throw error;
      return data;
    },
    enabled: !!user
  });

  const { data: notifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data, error } = await api.get<any[]>('/notifications');
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    refetchInterval: 30000 // Refresh every 30s
  });

  const unreadCount = notifications?.filter((n: any) => !n.is_read).length || 0;

  const tradingWallet = wallets?.find(w => w.currency === 'trading') || { main_balance: 0 };
  const holdingWallet = wallets?.find(w => w.currency === 'holding') || { main_balance: 0 };

  const calcValue = (holdings: any[]) => holdings.reduce((sum: number, h: any) => {
    const asset = assets?.find((a: any) => a.symbol === h.asset_symbol);
    return sum + (h.quantity * (asset?.price || h.avg_buy_price));
  }, 0);

  const allAssetsValue = calcValue(portfolio || []);
  
  // Trading wallet = cash balance
  const tradingBalance = tradingWallet.main_balance || 0;
  // Holding wallet = cash + asset holdings
  const holdingBalance = (holdingWallet.main_balance || 0) + allAssetsValue;
  
  const totalBalance = tradingBalance + holdingBalance;

  // Real 24h change derived from asset price changes
  const dollarChange = (portfolio || []).reduce((sum: number, h: any) => {
    const asset = assets?.find((a: any) => a.symbol === h.asset_symbol);
    const value = h.quantity * (asset?.price || h.avg_buy_price);
    const changePct = asset?.change_percent || 0;
    const valueYesterday = value / (1 + changePct / 100);
    return sum + (value - valueYesterday);
  }, 0);
  const yesterdayBalance = totalBalance - dollarChange;
  const percentChange = yesterdayBalance > 0 ? (dollarChange / yesterdayBalance) * 100 : 0;
  const isPositive = dollarChange >= 0;

  if (isLoadingAuth) return null;

  return (
    <div className="min-h-screen pb-32 md:pb-8 bg-[#0B1220] text-slate-100">
      {/* ── HEADER ── */}
      <header className="sticky top-0 z-30 bg-[#0B1220]/90 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center justify-between px-4 py-3 max-w-md mx-auto">
          {/* Menu icon → Profile */}
          <button 
            onClick={() => navigate(createPageUrl('Profile'))} 
            className="p-2 rounded-xl text-slate-300 hover:text-white transition-colors"
          >
            <Menu className="h-6 w-6 stroke-[2.2]" />
          </button>

          {/* Missions Badge & Notification Bell */}
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0F2A4A] border border-sky-500/30 text-xs font-bold text-sky-400 hover:bg-[#14365D] transition-all">
              <Gem className="h-3.5 w-3.5 fill-sky-400 text-sky-400" />
              <span>Missions</span>
            </button>

            <button 
              onClick={() => setIsNotificationsOpen(true)}
              className="p-2 rounded-xl text-slate-300 hover:text-white transition-colors relative"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-[#0B1220]" />
              )}
            </button>
          </div>
        </div>
      </header>

      <NotificationDrawer 
        open={isNotificationsOpen} 
        onOpenChange={setIsNotificationsOpen} 
      />

      <div className="px-4 py-6 space-y-7 max-w-md mx-auto">
        {/* ── SECTION 1: Total Balance Display (Centered matching mockup) ── */}
        <motion.div 
          initial={{ opacity: 0, y: 12 }} 
          animate={{ opacity: 1, y: 0 }}
          className="text-center pt-2 pb-2"
        >
          <div className="flex items-center justify-center gap-1.5 mb-2 text-slate-400 text-sm font-medium">
            <span>Total Balance</span>
            <button 
              onClick={() => setHideBalance(h => !h)} 
              className="text-slate-400 hover:text-slate-200 transition-colors p-0.5"
            >
              {hideBalance ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {hideBalance ? (
            <p className="text-4xl font-extrabold tracking-tight text-white my-1">••••••••</p>
          ) : (
            <div className="flex items-baseline justify-center gap-2">
              <AnimatedNumber 
                value={totalBalance} 
                prefix="$ " 
                decimals={2} 
                className="text-4xl font-black tracking-tight text-white" 
              />
              <span className="text-xl font-bold text-slate-400">USD</span>
            </div>
          )}

          {!hideBalance && (
            <div className="flex items-center justify-center gap-2 mt-2 text-sm font-bold">
              <span className={cn(isPositive ? 'text-[#00E676]' : 'text-red-400')}>
                {isPositive ? '+' : ''}{percentChange.toFixed(2)}%
              </span>
              <span className="text-slate-600">|</span>
              <span className={cn(isPositive ? 'text-[#00E676]' : 'text-red-400')}>
                {isPositive ? '+' : ''}${Math.abs(dollarChange).toFixed(0)}
              </span>
            </div>
          )}
        </motion.div>

        {/* ── SECTION 2: Action Buttons (Buy, Sell, Deposit, Pay) ── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <QuickActions
            onDeposit={() => navigate(createPageUrl('wallet'))}
            onMarkets={() => navigate(createPageUrl('Markets'))}
            onTrade={() => navigate(createPageUrl('trade'))}
            onWithdraw={() => navigate(createPageUrl('wallet'))}
          />
        </motion.div>

        {/* ── SECTION 3: Favourites / Top Assets List ── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <TopMovers
            assets={assets || []}
            onAssetClick={(asset: any) => navigate(createPageUrl('Markets') + `?asset=${asset.symbol}`)}
            onSeeAll={() => navigate(createPageUrl('Markets'))}
          />
        </motion.div>

        {/* ── SECTION 4: Wallet Breakdown ── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <p className="font-bold text-base mb-3 text-white">Wallets</p>
          <WalletBreakdown
            tradingBalance={tradingBalance}
            holdingBalance={holdingBalance}
            hideBalance={hideBalance}
          />
        </motion.div>
      </div>
    </div>
  );
}