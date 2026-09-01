"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, TrendingDown, Clock, RefreshCcw, CheckCircle, X,
  History, ArrowUpCircle, ChevronDown, Activity, LayoutDashboard,
  Wallet, Info
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { useNavigate } from '@/lib/react-router-shim';
import { createPageUrl } from '@/utils';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';
import CandlestickChart from '@/components/trading/CandlestickChart';
import { haptic } from '@/lib/haptics';

// ─── Constants ──────────────────────────────────────────────────────────────

// Assets will be fetched from API

// ─── Sub-components ──────────────────────────────────────────────────────────

/** Platform clock showing UTC time */
const PlatformClock = () => {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="font-mono text-xs text-muted-foreground">
      {time.toISOString().slice(11, 19)} UTC
    </span>
  );
};

/** Countdown from a given endsAt timestamp */
const StakeCountdown = ({
  endsAt,
  onExpire,
}: {
  endsAt: string;
  onExpire: () => void;
}) => {
  const [left, setLeft] = useState('');
  const calledRef = useRef(false);

  useEffect(() => {
    const tick = () => {
      const diff = new Date(endsAt).getTime() - Date.now();
      if (diff <= 0) {
        setLeft('Resolving…');
        if (!calledRef.current) {
          calledRef.current = true;
          onExpire();
        }
        return;
      }
      const s = Math.floor((diff / 1000) % 60);
      const m = Math.floor(diff / 60_000);
      setLeft(m > 0 ? `${m}m ${s.toString().padStart(2, '0')}s` : `${s}s`);
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [endsAt, onExpire]);

  return <span className="font-mono font-bold text-primary">{left}</span>;
};

// ─── Result overlay ──────────────────────────────────────────────────────────

const TradeResultOverlay = ({
  result,
  onClose,
}: {
  result: { isWin: boolean; totalPayout: number; tradeAmount: number; profitAmount: number } | null;
  onClose: () => void;
}) => (
  <AnimatePresence>
    {result && (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          onClick={e => e.stopPropagation()}
          className={cn(
            "bg-card border rounded-3xl p-8 max-w-xs w-full text-center shadow-2xl",
            result.isWin ? "border-primary/40 shadow-primary/20" : "border-destructive/40 shadow-destructive/20"
          )}
        >
          <div className={cn(
            "h-16 w-16 rounded-full mx-auto mb-4 flex items-center justify-center",
            result.isWin ? "bg-primary/20" : "bg-destructive/20"
          )}>
            {result.isWin
              ? <TrendingUp className="h-8 w-8 text-primary" />
              : <TrendingDown className="h-8 w-8 text-destructive" />}
          </div>
          <h2 className={cn("text-2xl font-black mb-1", result.isWin ? "text-primary" : "text-destructive")}>
            {result.isWin ? 'Profit! 🎉' : 'Trade Lost'}
          </h2>
          {result.isWin ? (
            <>
              <p className="text-muted-foreground text-sm mb-3">Payout credited to your wallet</p>
              <p className="text-4xl font-black text-primary">+${result.totalPayout.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">Profit: ${result.profitAmount.toLocaleString()}</p>
            </>
          ) : (
            <>
              <p className="text-muted-foreground text-sm mb-3">Better luck next time</p>
              <p className="text-2xl font-black text-destructive">-${result.tradeAmount.toLocaleString()}</p>
            </>
          )}
          <button
            onClick={onClose}
            className="mt-6 w-full h-12 rounded-2xl bg-primary text-black font-bold text-sm hover:opacity-90 transition-all"
          >
            Continue Trading
          </button>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

// ─── Main Component ──────────────────────────────────────────────────────────

interface LiveTradingViewProps {
  onViewChange?: (view: 'ai' | 'live') => void;
}

export default function LiveTradingView({ onViewChange }: LiveTradingViewProps) {
  const { user, isLoadingAuth } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Selections
  const [selOptionType, setSelOptionType] = useState('Crypto');
  const [selAsset, setSelAsset] = useState('BTC');
  const [selDuration, setSelDuration] = useState('');
  const [tradeAmount, setTradeAmount] = useState('');
  const [isFixedTime, setIsFixedTime] = useState(true);
  const [historyView, setHistoryView] = useState(false);

  // Active trade stake being watched
  const [activePendingStake, setActivePendingStake] = useState<{
    stakeId: string; endsAt: string; direction: string; amount: number;
  } | null>(null);
  const [tradeResult, setTradeResult] = useState<{
    isWin: boolean; totalPayout: number; tradeAmount: number; profitAmount: number;
  } | null>(null);
  const [isTrading, setIsTrading] = useState(false);

  // Live chart price simulation
  const [livePrice, setLivePrice] = useState(0);
  const prevPriceRef = useRef(0);
  const [prevPrice, setPrevPrice] = useState(0);
  const [changePercent, setChangePercent] = useState(0);

  useEffect(() => {
    if (!isLoadingAuth && !user) navigate(createPageUrl('Home'));
  }, [user, isLoadingAuth, navigate]);

  // Managed trades (active signals from admin)
  const { data: trades, isLoading: loadingTrades } = useQuery({
    queryKey: ['managed-trades'],
    queryFn: async () => {
      const { data, error } = await api.get<any[]>('/managed-trades');
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    refetchInterval: 10_000,
  });
  
  // Dynamic assets from admin
  const { data: adminAssets, isLoading: loadingAssets } = useQuery({
    queryKey: ['assets'],
    queryFn: async () => {
      const { data, error } = await api.get<any[]>('/assets');
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });



  const { OPTION_TYPES, ASSETS_BY_TYPE } = useMemo(() => {
    if (!adminAssets || adminAssets.length === 0) {
      return { OPTION_TYPES: [], ASSETS_BY_TYPE: {} };
    }
    const typesSet = new Set<string>();
    const byType: Record<string, string[]> = {};
    
    adminAssets.forEach(a => {
      const type = a.type ? (a.type.charAt(0).toUpperCase() + a.type.slice(1)) : 'Other';
      typesSet.add(type);
      if (!byType[type]) byType[type] = [];
      byType[type].push(a.symbol || a.name);
    });
    
    return {
      OPTION_TYPES: Array.from(typesSet).sort(),
      ASSETS_BY_TYPE: byType
    };
  }, [adminAssets]);

  const DURATIONS = useMemo(() => [
    { label: '30 Seconds', value: '30s', ms: 30_000 },
    { label: '1 Minute', value: '1m', ms: 60_000 },
    { label: '2 Minutes', value: '2m', ms: 120_000 },
    { label: '3 Minutes', value: '3m', ms: 180_000 },
    { label: '5 Minutes', value: '5m', ms: 300_000 },
    { label: '10 Minutes', value: '10m', ms: 600_000 },
    { label: '15 Minutes', value: '15m', ms: 900_000 },
    { label: '20 Minutes', value: '20m', ms: 1_200_000 },
    { label: '30 Minutes', value: '30m', ms: 1_800_000 },
    { label: '45 Minutes', value: '45m', ms: 2_700_000 },
  ], []);

  const activeTrades = useMemo(() => {
    if (!trades) return [];
    const now = Date.now();
    return trades.filter(t => t.status === 'active' && new Date(t.ends_at).getTime() > now);
  }, [trades]);

  const currentAsset = useMemo(() => {
    return adminAssets?.find(a => a.symbol === selAsset);
  }, [adminAssets, selAsset]);

  // Always show ALL option types from the static list
  const availableOptionTypes = OPTION_TYPES;

  // Always show ALL assets for the selected option type from the static list
  const availableAssets = ASSETS_BY_TYPE[selOptionType] || [];

  // Keep selOptionType valid
  useEffect(() => {
    if (OPTION_TYPES.length > 0 && !OPTION_TYPES.includes(selOptionType)) {
      setSelOptionType(OPTION_TYPES[0]);
    }
  }, [OPTION_TYPES, selOptionType]);

  // Keep selAsset valid when option type changes
  useEffect(() => {
    if (availableAssets.length > 0 && !availableAssets.includes(selAsset)) {
      setSelAsset(availableAssets[0]);
    }
  }, [availableAssets, selAsset]);



  // Find the matching admin trade — fuzzy match asset name/symbol, ignore duration
  const selectedTrade = useMemo(() => {
    return activeTrades.find(t => 
      t.asset_symbol === selAsset && 
      (t.asset_type?.toLowerCase() === selOptionType.toLowerCase() || selOptionType === 'Other')
    );
  }, [activeTrades, selAsset, selOptionType]);

  // If admin trade has a duration, lock to it; otherwise let user pick
  const adminLockedDuration = selectedTrade?.duration || null;

  // Available durations for user picker (only relevant when not locked)
  const availableDurations = DURATIONS.map(d => d.value);

  // Auto-apply admin duration when trade changes
  useEffect(() => {
    if (adminLockedDuration) {
      setSelDuration(adminLockedDuration);
    } else if (availableDurations.length > 0 && !availableDurations.includes(selDuration)) {
      setSelDuration(availableDurations[0]);
    }
  }, [adminLockedDuration, selDuration]);

  // Wallet balance
  const { data: wallets } = useQuery({
    queryKey: ['wallets'],
    queryFn: async () => {
      const { data } = await api.get<any[]>('/wallets');
      return data || [];
    },
    enabled: !!user,
  });
  const walletBalance = (wallets as any[])?.find(w => w.currency === 'trading')?.main_balance ?? 0;

  // My trades history
  const { data: myTrades } = useQuery({
    queryKey: ['my-managed-trades'],
    queryFn: async () => {
      const { data } = await api.get<any[]>('/managed-trades/my-trades');
      return data || [];
    },
    enabled: !!user,
  });

  // Price simulation — seeded from the real asset price (same as AI Trading),
  // and intentionally NOT dependent on selectedTrade/entry_price so opening
  // or resolving a trade never resets or otherwise affects the chart.
  useEffect(() => {
    const base = currentAsset?.price || 100;
    setLivePrice(base);
    prevPriceRef.current = base;
    setPrevPrice(base);
    setChangePercent(currentAsset?.change_percent ?? 0);
  }, [selAsset, currentAsset?.price]);

  useEffect(() => {
    if (!livePrice) return;
    const v = 0.001;
    const id = setInterval(() => {
      setLivePrice(prev => {
        const change = (Math.random() - 0.49) * prev * v;
        const next = Math.max(prev * 0.95, prev + change);
        setPrevPrice(prevPriceRef.current);
        prevPriceRef.current = prev;
        return next;
      });
    }, 1200);
    return () => clearInterval(id);
  }, [livePrice]);

  // Profit preview
  const durationMeta = DURATIONS.find(d => d.value === selDuration);
  const profitPreview = useMemo(() => {
    const amount = parseFloat(tradeAmount);
    if (isNaN(amount) || amount <= 0) return 0;
    const pct = selectedTrade?.profit_percent ?? 80;
    return (amount * pct) / 100;
  }, [tradeAmount, selectedTrade]);

  // Resolve individual stake when countdown hits zero
  const handleStakeExpiry = useCallback(async () => {
    if (!activePendingStake) return;
    try {
      const res = await fetch('/api/managed-trades/resolve-stake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stakeId: activePendingStake.stakeId }),
        credentials: 'include',
      });
      const result = await res.json();
      if (result.success) {
        haptic(result.isWin ? 'success' : 'warning');
        setTradeResult({
          isWin: result.isWin,
          totalPayout: result.totalPayout,
          tradeAmount: result.tradeAmount,
          profitAmount: result.profitAmount,
        });
      }
      queryClient.invalidateQueries({ queryKey: ['my-managed-trades'] });
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
    } catch (e) {
      console.error('Resolve stake error:', e);
    } finally {
      setActivePendingStake(null);
    }
  }, [activePendingStake, queryClient]);

  // Place trade
  const handleTrade = async (direction: 'call' | 'put') => {
    haptic('medium');
    const amount = parseFloat(tradeAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    if (selectedTrade && amount < (selectedTrade.min_stake || 0)) {
      toast.error(`Minimum stake: $${selectedTrade.min_stake}`);
      return;
    }
    if (!selDuration) {
      toast.error('Select an expiration time');
      return;
    }
    if (amount > walletBalance) {
      toast.error('Insufficient trading balance');
      return;
    }
    if (activePendingStake) {
      toast.error('You already have an active trade running');
      return;
    }

    setIsTrading(true);
    try {
      let data: any;

      if (selectedTrade) {
        // Admin signal exists — use normal managed trade entry
        const res = await api.post<any>(`/managed-trades/${selectedTrade.id}/enter`, {
          amount,
          direction,
          user_duration: selDuration,
        });
        if (res.error) throw res.error;
        data = res.data;
      } else {
        // No admin signal — use standalone entry (always loses)
        const res = await api.post<any>('/managed-trades/standalone-enter', {
          amount,
          direction,
          user_duration: selDuration,
          asset_symbol: selAsset,
          asset_name: selAsset,
          asset_type: currentAsset?.type || 'Asset',
        });
        if (res.error) throw res.error;
        data = res.data;
      }

      // Compute local countdown
      const dMs = DURATIONS.find(d => d.value === selDuration)?.ms ?? 60_000;
      const endsAt = new Date(Date.now() + dMs).toISOString();

      setActivePendingStake({
        stakeId: data.id,
        endsAt,
        direction,
        amount,
      });

      toast.success(`${direction === 'call' ? '↑ Call' : '↓ Put'} position opened!`);
      setTradeAmount('');
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
    } catch (err: any) {
      toast.error(err.message || 'Failed to open trade');
    } finally {
      setIsTrading(false);
    }
  };

  const parsedAmount = parseFloat(tradeAmount);
  const isOverBalance = !!tradeAmount && !isNaN(parsedAmount) && parsedAmount > walletBalance;
  const canTrade = !!tradeAmount && !isNaN(parsedAmount) && parsedAmount > 0 && !!selDuration && !activePendingStake && !isOverBalance;

  if (isLoadingAuth || loadingTrades || loadingAssets) {
    return (
      <div className="flex-1 flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <>
      <TradeResultOverlay result={tradeResult} onClose={() => setTradeResult(null)} />

      <div className="bg-background text-foreground pb-24 lg:pb-8">
        {/* ── Chart ─────────────────────────────────────────── */}
        <div className="px-3 pt-3">
          <div className="rounded-3xl bg-card border border-border p-4 mb-3">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-bold text-sm">{selAsset}</p>
                <p className="text-[10px] text-muted-foreground">{currentAsset?.type || 'Asset'}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className={cn(
                    "text-lg font-black",
                    livePrice > prevPrice ? "text-success" : "text-destructive"
                  )}>
                    {livePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <PlatformClock />
              </div>
            </div>
            <CandlestickChart basePrice={livePrice} isPositive={livePrice >= prevPrice} />
          </div>
        </div>

        {/* ── View toggle ────────────────────────────────────── */}
        <div className="px-3 pb-3 flex gap-2">
          <button
            onClick={() => setHistoryView(false)}
            className={cn(
              "flex-1 py-2 rounded-2xl text-xs font-bold transition-all",
              !historyView ? "bg-primary text-black" : "bg-muted text-muted-foreground"
            )}
          >
            Trade
          </button>
          <button
            onClick={() => setHistoryView(true)}
            className={cn(
              "flex-1 py-2 rounded-2xl text-xs font-bold transition-all",
              historyView ? "bg-primary text-black" : "bg-muted text-muted-foreground"
            )}
          >
            History
          </button>
        </div>

        <AnimatePresence mode="wait">
          {!historyView ? (
            <motion.div
              key="trade"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-3 space-y-3 max-w-lg mx-auto"
            >
              {/* ── Active stake countdown ─────────────────────── */}
              {activePendingStake && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "rounded-3xl border p-4 flex items-center justify-between",
                    activePendingStake.direction === 'call'
                      ? "bg-success/10 border-success/30"
                      : "bg-destructive/10 border-destructive/30"
                  )}
                >
                  <div>
                    <p className="text-xs font-bold uppercase">
                      {activePendingStake.direction === 'call' ? '↑ Call' : '↓ Put'} — ${activePendingStake.amount}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Resolving in…</p>
                  </div>
                  <StakeCountdown
                    endsAt={activePendingStake.endsAt}
                    onExpire={handleStakeExpiry}
                  />
                </motion.div>
              )}

              {/* ── Execution Panel ───────────────────────────────── */}
              <div className="rounded-3xl bg-card border border-border overflow-hidden">
                {/* Option Type */}
                <div className="p-4 border-b border-border space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    Option Type <Info className="h-3 w-3" />
                  </label>
                  <div className="relative">
                    <select
                      value={selOptionType}
                      onChange={e => setSelOptionType(e.target.value)}
                      className="w-full h-11 bg-muted/40 border border-border rounded-2xl px-4 pr-10 font-semibold text-sm appearance-none outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    >
                      {availableOptionTypes.map((t: string) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  </div>
                </div>

                {/* Asset Name */}
                <div className="p-4 border-b border-border space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Asset Name</label>
                  <div className="relative">
                    <select
                      value={selAsset}
                      onChange={e => setSelAsset(e.target.value)}
                      className="w-full h-11 bg-muted/40 border border-border rounded-2xl px-4 pr-10 font-semibold text-sm appearance-none outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    >
                      {availableAssets.map((a: string) => <option key={a} value={a}>{a}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  </div>
                </div>

                {/* Platform Time + Fixed Time toggle */}
                <div className="p-4 border-b border-border flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Platform Time</p>
                    <PlatformClock />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground">Fixed Time</span>
                    <button
                      onClick={() => setIsFixedTime(v => !v)}
                      className={cn(
                        "relative h-6 w-11 rounded-full transition-colors focus:outline-none",
                        isFixedTime ? "bg-primary" : "bg-muted"
                      )}
                    >
                      <motion.span
                        layout
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        className={cn(
                          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm",
                          isFixedTime ? "left-5.5" : "left-0.5"
                        )}
                        style={{ left: isFixedTime ? '22px' : '2px' }}
                      />
                    </button>
                  </div>
                </div>

                {/* Amount */}
                <div className="p-4 border-b border-border space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Amount</label>
                    <span className={cn(
                      "text-[10px] font-semibold",
                      isOverBalance ? "text-destructive" : "text-muted-foreground"
                    )}>
                      Balance: ${Number(walletBalance).toLocaleString()}
                    </span>
                  </div>
                  <div className="relative">
                    <span className={cn(
                      "absolute left-4 top-1/2 -translate-y-1/2 font-bold",
                      isOverBalance ? "text-destructive" : "text-muted-foreground"
                    )}>$</span>
                    <input
                      type="number"
                      value={tradeAmount}
                      onChange={e => setTradeAmount(e.target.value)}
                      placeholder="0.00"
                      className={cn(
                        "w-full h-11 pl-9 pr-4 bg-muted/40 border rounded-2xl font-bold text-sm outline-none transition-all",
                        isOverBalance
                          ? "border-destructive ring-2 ring-destructive/20 text-destructive"
                          : "border-border focus:ring-2 focus:ring-primary/20"
                      )}
                    />
                  </div>
                  {isOverBalance && (
                    <p className="text-[10px] font-bold text-destructive">Insufficient balance</p>
                  )}
                  {selectedTrade && !isOverBalance && (
                    <p className="text-[10px] text-muted-foreground">Min: ${selectedTrade.min_stake}</p>
                  )}
                </div>

                {/* Expiration Time */}
                <div className="p-4 border-b border-border space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Expiration Time</label>
                  {adminLockedDuration ? (
                    <div className="h-11 bg-muted/40 border border-border rounded-2xl px-4 flex items-center justify-between">
                      <span className="font-semibold text-sm">
                        {DURATIONS.find(d => d.value === adminLockedDuration)?.label || adminLockedDuration}
                      </span>
                      <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Fixed</span>
                    </div>
                  ) : (
                    <div className="relative">
                      <select
                        value={selDuration}
                        onChange={e => setSelDuration(e.target.value)}
                        className={cn(
                          "w-full h-11 bg-muted/40 border rounded-2xl px-4 pr-10 font-semibold text-sm appearance-none outline-none focus:ring-2 focus:ring-primary/20 transition-all",
                          !selDuration ? "border-primary" : "border-border"
                        )}
                      >
                        <option value="">Select a value</option>
                        {availableDurations.map(d => {
                          const meta = DURATIONS.find(dm => dm.value === d);
                          return <option key={d} value={d}>{meta?.label || d}</option>;
                        })}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    </div>
                  )}
                </div>

                {/* Profit preview hidden as per requirement */}



                {/* Call / Put Buttons */}
                <div className="p-4 grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleTrade('call')}
                    disabled={!canTrade || isTrading}
                    className={cn(
                      "h-14 rounded-2xl flex items-center justify-center gap-2 font-black text-base transition-all shadow-lg",
                      canTrade && !isTrading
                        ? "bg-success text-white shadow-success/20 hover:opacity-90 active:scale-[0.97]"
                        : "bg-success/30 text-white/50 cursor-not-allowed"
                    )}
                  >
                    {isTrading
                      ? <RefreshCcw className="h-5 w-5 animate-spin" />
                      : <><ArrowUpCircle className="h-5 w-5" /> Call</>
                    }
                  </button>
                  <button
                    onClick={() => handleTrade('put')}
                    disabled={!canTrade || isTrading}
                    className={cn(
                      "h-14 rounded-2xl flex items-center justify-center gap-2 font-black text-base transition-all shadow-lg",
                      canTrade && !isTrading
                        ? "bg-destructive text-white shadow-destructive/20 hover:opacity-90 active:scale-[0.97]"
                        : "bg-destructive/30 text-white/50 cursor-not-allowed"
                    )}
                  >
                    {isTrading
                      ? <RefreshCcw className="h-5 w-5 animate-spin" />
                      : <><ArrowUpCircle className="h-5 w-5 rotate-180" /> Put</>
                    }
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="history"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-3 space-y-3 max-w-lg mx-auto"
            >
              {/* Active positions */}
              {(myTrades ?? []).filter((t: any) => t.status === 'active').length > 0 && (
                <div className="rounded-3xl bg-card border border-border p-5">
                  <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" /> Active Trades
                  </h3>
                  <div className="space-y-2">
                    {(myTrades ?? []).filter((t: any) => t.status === 'active').map((t: any) => (
                      <div key={t.id} className="flex items-center justify-between p-3 rounded-2xl bg-muted/30 border border-border/50">
                        <div>
                          <p className="text-xs font-bold">{t.managed_trades?.asset_symbol} – {t.direction}</p>
                          <p className="text-[10px] text-muted-foreground">${t.stake_amount}</p>
                        </div>
                        <p className="text-xs font-bold text-amber-500">Pending</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* History */}
              <div className="rounded-3xl bg-card border border-border p-5">
                <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                  <History className="h-4 w-4 text-muted-foreground" /> Trade History
                </h3>
                {!myTrades || myTrades.filter((t: any) => t.status !== 'active').length === 0 ? (
                  <div className="py-12 text-center opacity-40">
                    <History className="h-8 w-8 mx-auto mb-2" />
                    <p className="text-sm font-bold">No history yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {myTrades.filter((t: any) => t.status !== 'active').map((t: any) => (
                      <div key={t.id} className="flex items-center justify-between p-3 rounded-2xl bg-muted/20 border border-border/40">
                        <div className="flex items-center gap-2">
                          {t.status === 'paid_out'
                            ? <CheckCircle className="h-4 w-4 text-success shrink-0" />
                            : <X className="h-4 w-4 text-destructive shrink-0" />}
                          <div>
                            <p className="text-xs font-bold">{t.managed_trades?.asset_symbol} ({t.direction})</p>
                            <p className="text-[10px] text-muted-foreground">{format(new Date(t.created_at), 'MMM dd, HH:mm')}</p>
                          </div>
                        </div>
                        <p className={cn("text-xs font-black", t.status === 'paid_out' ? "text-success" : "text-destructive")}>
                          {t.status === 'paid_out'
                            ? `+$${(Number(t.stake_amount) * (1 + (t.managed_trades?.profit_percent || 0) / 100)).toFixed(2)}`
                            : `-$${Number(t.stake_amount).toFixed(2)}`}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
