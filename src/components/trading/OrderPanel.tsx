import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronLeft, ChevronRight, CheckCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/components/ui/ThemeProvider';
import { useAuth } from '@/lib/AuthContext';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';

const DURATIONS = [
  { label: '30 secs', value: 30 },
  { label: '1 min', value: 60 },
  { label: '5 mins', value: 300 },
  { label: '10 mins', value: 600 },
  { label: '20 mins', value: 1200 },
  { label: '30 mins', value: 1800 },
  { label: '1 hour', value: 3600 },
  { label: '2 hour', value: 7200 },
];

const OPTION_TYPES = ['High / Low', 'Touch / No Touch', 'In / Out'];
const PROFIT_RATE = 0.85; // 85% profit

export default function OrderPanel({ asset, price, balance: balanceProp = 0 }: any) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const dark = theme === 'dark';

  const [optionType, setOptionType] = useState(OPTION_TYPES[0]);
  const [optionOpen, setOptionOpen] = useState(false);
  const [amount, setAmount] = useState(100);
  const [duration, setDuration] = useState(60);
  const [step, setStep] = useState('input'); // input | success | active
  const [activeTradeId, setActiveTradeId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [lastSide, setLastSide] = useState('call');
  const [isLoading, setIsLoading] = useState(false);

  const { data: wallets } = useQuery({
    queryKey: ['wallets'],
    queryFn: async () => {
      const { data, error } = await api.get<any[]>('/wallets');
      if (error) throw error;
      return data;
    },
    enabled: !!user
  });

  const balance = (wallets as any[])?.find(w => w.currency === 'trading')?.main_balance ?? balanceProp;

  const { data: aiHistory, refetch: refetchHistory } = useQuery({
    queryKey: ['ai-trading-history'],
    queryFn: async () => {
      const { data, error } = await api.get<any[]>('/ai-trading/history');
      if (error) throw error;
      return data;
    },
    enabled: !!user
  });

  // Auto-resume active trade on load
  React.useEffect(() => {
    if (aiHistory && aiHistory.length > 0 && step === 'input') {
      const pendingTrade = aiHistory.find((tx: any) => tx.status === 'pending');
      if (pendingTrade) {
        const resolvesAt = new Date(pendingTrade.resolves_at).getTime();
        const now = Date.now();
        const remaining = Math.round((resolvesAt - now) / 1000);

        if (remaining > 0) {
          setStep('active');
          setTimeLeft(remaining);
          setActiveTradeId(pendingTrade.id);
          setAmount(pendingTrade.stake);
          setLastSide(pendingTrade.direction === 'UP' ? 'call' : 'put');

          // Countdown
          const timer = setInterval(() => {
            setTimeLeft(t => {
              if (t <= 1) {
                clearInterval(timer);
                return 0;
              }
              return t - 1;
            });
          }, 1000);

          // Resolution
          const resolveTimeout = setTimeout(async () => {
            try {
              const { data: resData, error: resError } = await api.post('/ai-trading/resolve', { tradeId: pendingTrade.id });
              if (resError) throw resError;
              
              haptic((resData as any).outcome === 'WIN' ? 'success' : 'warning');
              if ((resData as any).outcome === 'WIN') {
                toast.success(`Trade Won! +$${(resData as any).profit.toFixed(2)}`, { icon: '💰' });
              } else {
                toast.error("Trade Lost", { icon: '📉' });
              }
              
              queryClient.invalidateQueries({ queryKey: ['wallets'] });
              refetchHistory();
              setStep('input');
              setActiveTradeId(null);
            } catch (resolveErr) {
              console.error("Auto-resolve failed:", resolveErr);
              setStep('input');
              setActiveTradeId(null);
            }
          }, remaining * 1000);

          (window as any)._activeTradeTimers = { timer, resolveTimeout };
        }
      }
    }
  }, [aiHistory, step, queryClient, refetchHistory]);

  const potentialProfit = +(amount * PROFIT_RATE).toFixed(2);
  const isOverBalance = amount > Number(balance);

  const handleOrder = async (side: 'call' | 'put') => {
    haptic('medium');
    if (!user) {
      toast.error("User not logged in.");
      return;
    }
    if (!asset) {
      toast.error("No asset selected.");
      return;
    }
    if (amount <= 0) {
      toast.error("Invalid trade amount.");
      return;
    }
    if (amount > balance) {
      toast.error("Insufficient balance in your trading wallet.");
      return;
    }
    setIsLoading(true);
    setLastSide(side);
    try {
      // 1. Start the trade
      const { data, error } = await api.post('/ai-trading/start', {
        amount,
        duration,
        direction: side === 'call' ? 'UP' : 'DOWN',
        assetSymbol: asset?.symbol,
        price: Number(price) || 0,
      });

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['wallets'] });
      queryClient.invalidateQueries({ queryKey: ['order-wallets'] });
      refetchHistory();

      setStep('active');
      setTimeLeft(duration);
      const tradeId = (data as any).tradeId;
      setActiveTradeId(tradeId);

      // 2. Start Countdown
      const timer = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) {
            clearInterval(timer);
            return 0;
          }
          return t - 1;
        });
      }, 1000);

      // 3. Schedule resolution after duration
      const resolveTimeout = setTimeout(async () => {
        try {
          const { data: resData, error: resError } = await api.post('/ai-trading/resolve', { tradeId });
          if (resError) throw resError;
          
          if ((resData as any).outcome === 'WIN') {
            toast.success(`Trade Won! +$${(resData as any).profit.toFixed(2)}`, { icon: '💰' });
          } else {
            toast.error("Trade Lost", { icon: '📉' });
          }
          
          queryClient.invalidateQueries({ queryKey: ['wallets'] });
          refetchHistory();
          setStep('input');
          setActiveTradeId(null);
        } catch (resolveErr) {
          console.error("Auto-resolve failed:", resolveErr);
          setStep('input');
          setActiveTradeId(null);
        }
      }, duration * 1000);

      // Cleanup ref for timers
      (window as any)._activeTradeTimers = { timer, resolveTimeout };
    } catch (e: any) {
      console.error(e);
      toast.error("Trade failed: " + (e.message || "Unknown error"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-background text-foreground">
      {/* ── PLATFORM TIME BAR ── */}
      <div className="flex items-center justify-between px-4 py-2 text-xs border-b border-border text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>Balance</span>
          <span className="font-mono font-bold text-primary">
            ${balance?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span>Fixed Time</span>
          <div className="w-8 h-4 rounded-full relative bg-primary/20">
            <div className="w-3 h-3 rounded-full absolute top-0.5 right-0.5 bg-primary shadow-[0_0_8px_rgba(234,179,8,0.5)]" />
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-3">
        {/* ── OPTION TYPE SELECT ── */}
        <div className="relative">
          <button
            onClick={() => setOptionOpen(o => !o)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm bg-muted text-muted-foreground"
          >
            <span>{optionType}</span>
            <ChevronDown className="h-4 w-4" />
          </button>
          <AnimatePresence>
            {optionOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                className="absolute left-0 right-0 top-full mt-1 rounded-xl shadow-xl z-20 overflow-hidden bg-card border border-border"
              >
                {OPTION_TYPES.map(opt => (
                  <button
                    key={opt}
                    onClick={() => { setOptionType(opt); setOptionOpen(false); }}
                    className={cn(
                      "w-full text-left px-4 py-3 text-sm hover:bg-muted transition-colors border-b last:border-0 border-border",
                      opt === optionType ? 'text-primary' : 'text-foreground'
                    )}
                  >
                    {opt}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── ASSET TYPE (display only) ── */}
        <div
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm bg-muted text-muted-foreground"
        >
          <span>{asset?.name || asset?.symbol || 'Select asset'}</span>
          <ChevronDown className="h-4 w-4" />
        </div>

        {/* ── AMOUNT INPUT ── */}
        <div className="space-y-1.5">
          <div className={cn(
            "flex items-center rounded-xl overflow-hidden",
            isOverBalance ? "ring-2 ring-destructive bg-destructive/5" : "bg-muted"
          )}>
            <button
              onClick={() => setAmount(a => Math.max(1, a - (a >= 100 ? 10 : 1)))}
              className="px-4 py-3 hover:text-foreground text-muted-foreground transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(Math.max(1, Number(e.target.value)))}
              className={cn(
                "flex-1 text-center bg-transparent text-sm font-semibold focus:outline-none",
                isOverBalance ? "text-destructive" : "text-foreground"
              )}
            />
            <button
              onClick={() => setAmount(a => Math.min(Number(balance), a + (a >= 100 ? 10 : 1)))}
              className="px-4 py-3 hover:text-foreground text-muted-foreground transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          {isOverBalance && (
            <p className="text-[10px] font-bold text-destructive px-1">Insufficient balance</p>
          )}
        </div>

        {/* Potential profit hidden as per requirement */}

        {/* ── DURATION PILLS ── */}
        <div className="grid grid-cols-2 min-[400px]:grid-cols-4 gap-2">
          {DURATIONS.map(d => (
            <button
              key={d.value}
              onClick={() => setDuration(d.value)}
              className={cn(
                "py-2 rounded-xl text-xs font-semibold transition-all",
                duration === d.value ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-muted text-muted-foreground hover:text-foreground'
              )}
            >
              {d.label}
            </button>
          ))}
        </div>

        {/* ── CALL / PUT BUTTONS ── */}
        <AnimatePresence mode="wait">
          {step === 'active' ? (
            <motion.div
              key="active"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border border-border rounded-2xl p-5 flex flex-col items-center gap-4 relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-primary/5 animate-pulse" />
              <div className="flex items-center justify-between w-full relative z-10">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Current Trade</span>
                  <span className={cn("text-xs font-black", lastSide === 'call' ? "text-primary" : "text-destructive")}>
                    {lastSide === 'call' ? '⬆ CALL' : '⬇ PUT'} · ${amount}
                  </span>
                </div>
                <div className="text-right flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Time Remaining</span>
                  <span className="font-mono text-lg font-black text-foreground">{timeLeft}s</span>
                </div>
              </div>
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden relative z-10">
                <motion.div 
                  initial={{ width: "100%" }}
                  animate={{ width: "0%" }}
                  transition={{ duration: timeLeft, ease: "linear" }}
                  className="h-full bg-primary shadow-[0_0_10px_rgba(234,179,8,0.5)]"
                />
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-primary animate-bounce relative z-10">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                DETERMINING OUTCOME...
              </div>
            </motion.div>
          ) : step === 'success' ? (
            <motion.div
              key="success"
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-4 gap-2"
            >
              <div className="w-12 h-12 rounded-full flex items-center justify-center bg-primary shadow-lg shadow-primary/30">
                <CheckCircle className="h-6 w-6 text-black" />
              </div>
              <p className="font-bold text-sm text-foreground">
                {lastSide === 'call' ? 'Call' : 'Put'} order placed!
              </p>
            </motion.div>
          ) : (
            <motion.div key="btns" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-2 gap-3">
              <button
                disabled={isLoading || isOverBalance}
                onClick={() => handleOrder('call')}
                className="py-4 rounded-2xl font-bold text-white text-base flex items-center justify-center gap-2 transition-transform active:scale-95 bg-primary shadow-lg shadow-primary/20 disabled:opacity-50"
              >
                {isLoading && lastSide === 'call' ? (
                  <div className="h-5 w-5 border-2 border-white/30 border-t-white animate-spin rounded-full" />
                ) : (
                  <>
                     Call
                  </>
                )}
              </button>
              <button
                disabled={isLoading || isOverBalance}
                onClick={() => handleOrder('put')}
                className="py-4 rounded-2xl font-bold text-destructive-foreground text-base flex items-center justify-center gap-2 transition-transform active:scale-95 bg-destructive shadow-lg shadow-destructive/20 disabled:opacity-50"
              >
                {isLoading && lastSide === 'put' ? (
                  <div className="h-5 w-5 border-2 border-white/30 border-t-white animate-spin rounded-full" />
                ) : (
                  <>
                     Put
                  </>
                )}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── TRADING HISTORY (inline) ── */}
      <div className="px-4 pb-6">
        <div className="mb-3">
          <h3 className="font-bold text-base text-foreground">Trading History</h3>
          <p className="text-xs mt-0.5 text-muted-foreground">
            View all records and details of your past trading activities.
          </p>
        </div>

        <div className="space-y-0">
          {(aiHistory || []).map((tx: any) => {
            const isUp = tx.direction === 'UP';
            const isWin = tx.outcome === 'WIN';
            const status = tx.status;
            
            return (
              <div
                key={tx.id}
                className="py-3 border-b border-border last:border-0"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={cn("text-xs font-bold px-1.5 py-0.5 rounded", isUp ? "bg-primary/20 text-primary" : "bg-destructive/20 text-destructive")}>
                      {isUp ? 'Call' : 'Put'}
                    </span>
                    <span className="text-xs font-semibold text-foreground">
                      ${tx.stake?.toLocaleString('en-US', { minimumFractionDigits: 2 }) ?? '0.00'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn("text-xs font-bold", isWin ? "text-primary" : (status === 'resolved' ? "text-destructive" : "text-amber-500"))}>
                      {status === 'resolved' 
                        ? (isWin ? `+$${tx.profit?.toFixed(2)}` : `-$${tx.stake?.toFixed(2)}`)
                        : 'Pending'
                      }
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground">
                      {tx.created_at ? format(new Date(tx.created_at), 'MMM d, HH:mm') : '—'}
                    </span>
                  </div>
                  <span
                    className={cn(
                      "text-[10px] font-bold uppercase tracking-wider",
                      isWin ? 'text-primary' : (status === 'resolved' ? 'text-destructive' : 'text-amber-500')
                    )}
                  >
                    {status === 'resolved' ? (isWin ? 'Win' : 'Loss') : 'Processing'}
                  </span>
                </div>
              </div>
            );
          })}

          {(!aiHistory || aiHistory.length === 0) && (
            <p className="text-center py-8 text-xs text-muted-foreground">No trading history yet</p>
          )}
        </div>
      </div>
    </div>
  );
}