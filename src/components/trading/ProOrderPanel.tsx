import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/components/ui/ThemeProvider';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';

export default function ProOrderPanel({ asset, price, balance: balanceProp = 0, onOrderPlaced }: {
  asset: any,
  price: number,
  balance?: number,
  onOrderPlaced?: (params: { side: string, quantity: number, entryPrice: number, leverage: number }) => void
}) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const dark = theme === 'dark';

  const [tab, setTab] = useState('buy');
  const [orderType, setOrderType] = useState('market');
  const [quantity, setQuantity] = useState('');
  const [limitPrice, setLimitPrice] = useState('');
  const [leverage, setLeverage] = useState(1);
  const [step, setStep] = useState('input');
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

  const balance = wallets?.[0]?.main_balance ?? balanceProp;

  const execPrice = orderType === 'market' ? price : (parseFloat(limitPrice) || price);
  const total = (parseFloat(quantity) || 0) * execPrice;
  const isBuy = tab === 'buy';
  const isOverBalance = isBuy && total > Number(balance);

  const handleSubmit = async () => {
    const qty = parseFloat(quantity);
    if (!qty || qty <= 0 || !user) {
      toast.error("Please enter a valid quantity.");
      return;
    }
    
    setIsLoading(true);
    const toastId = toast.loading('Placing order...');
    
    try {
      const { data, error } = await api.post('/transactions', {
        user_id: user.id,
        type: isBuy ? 'buy' : 'sell',
        asset_symbol: asset?.symbol,
        amount: total, // Still send amount for legacy/transaction record
        total_value: total, // Explicitly send total_value for balance adjustment
        currency: 'trading', // Expressly use the trading wallet for advanced trading view
        price_at_transaction: execPrice,
        quantity: qty,
        status: 'completed',
      });

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['transactions-all'] });
      queryClient.invalidateQueries({ queryKey: ['wallets'] });

      setStep('success');
      onOrderPlaced?.({ side: tab, quantity: qty, entryPrice: execPrice, leverage });
      toast.success('Order placed successfully!', { id: toastId });
      setTimeout(() => { 
        setStep('input'); 
        setQuantity(''); 
      }, 2500);
    } catch (e: any) {
      console.error(e);
      toast.error('Failed to place order: ' + (e.message || 'Unknown error'), { id: toastId });
    } finally {
      setIsLoading(false);
    }
  };

  const pcts = [25, 50, 75, 100];

  return (
    <div className="rounded-3xl border p-4 space-y-4 bg-card border-border shadow-md">
      {/* Buy / Sell tabs */}
      <div className="grid grid-cols-2 rounded-2xl overflow-hidden bg-muted">
        {['buy', 'sell'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "py-2.5 text-sm font-bold capitalize transition-all",
              tab === t
                ? (t === 'buy' ? 'bg-primary text-white rounded-2xl shadow-lg shadow-primary/20' : 'bg-destructive text-destructive-foreground rounded-2xl shadow-lg shadow-destructive/20')
                : "text-muted-foreground"
            )}
          >
            {t === 'buy' ? '▲ Buy / Long' : '▼ Sell / Short'}
          </button>
        ))}
      </div>

      {/* Order type */}
      <div className="flex gap-2">
        {['market', 'limit', 'stop'].map(ot => (
          <button
            key={ot}
            onClick={() => setOrderType(ot)}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all",
              orderType === ot
                ? 'bg-primary text-white shadow-sm shadow-primary/20'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            )}
          >
            {ot}
          </button>
        ))}
      </div>

      {/* Price display */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Market Price</span>
        <span className={cn("font-bold", isBuy ? "text-primary" : "text-destructive")}>
          ${price?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '—'}
        </span>
      </div>

      {/* Limit price input */}
      {orderType !== 'market' && (
        <div>
          <p className="text-xs mb-1.5 text-muted-foreground">
            {orderType === 'limit' ? 'Limit Price' : 'Stop Price'}
          </p>
          <input
            type="number"
            placeholder="Enter price"
            value={limitPrice}
            onChange={e => setLimitPrice(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none bg-muted text-foreground"
          />
        </div>
      )}

      {/* Quantity */}
      <div>
        <p className="text-xs mb-1.5 text-muted-foreground">Quantity ({asset?.symbol})</p>
        <input
          type="number"
          placeholder="0.00"
          value={quantity}
          onChange={e => setQuantity(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none bg-muted text-foreground placeholder:text-muted-foreground/50"
        />
        <div className="flex gap-2 mt-2">
          {pcts.map(pct => (
            <button
              key={pct}
              onClick={() => {
                const qtyValue = (balance * pct / 100) / price;
                setQuantity(qtyValue.toFixed(6));
              }}
              className="flex-1 py-1 rounded-lg text-xs font-semibold bg-muted text-muted-foreground hover:text-foreground"
            >
              {pct}%
            </button>
          ))}
        </div>
      </div>

      {/* Leverage */}
      <div>
        <div className="flex justify-between text-xs mb-1.5 text-muted-foreground">
          <span>Leverage</span>
          <span className="font-bold text-primary">{leverage}x</span>
        </div>
        <input
          type="range" min={1} max={100} value={leverage}
          onChange={e => setLeverage(Number(e.target.value))}
          className="w-full accent-primary h-1.5 rounded-full appearance-none bg-muted"
        />
        <div className="flex justify-between text-[10px] mt-0.5 text-muted-foreground">
          <span>1x</span><span>25x</span><span>50x</span><span>100x</span>
        </div>
      </div>

      {/* Order total */}
      <div className={cn(
        "flex items-center justify-between px-3 py-2.5 rounded-xl",
        isOverBalance ? "bg-destructive/10 ring-1 ring-destructive" : "bg-muted"
      )}>
        <span className="text-xs text-muted-foreground">Order Total</span>
        <span className={cn(
          "text-sm font-bold",
          isOverBalance ? "text-destructive" : "text-foreground"
        )}>
          ${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>
      {isOverBalance && (
        <p className="text-[10px] font-bold text-destructive px-1 -mt-2">Insufficient balance (Balance: ${Number(balance).toLocaleString()})</p>
      )}

      {/* Submit */}
      <AnimatePresence mode="wait">
        {step === 'success' ? (
          <motion.div
            key="success"
            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}
            className="flex flex-col items-center py-3 gap-2"
          >
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-primary shadow-lg shadow-primary/30">
              <CheckCircle className="h-5 w-5 text-black" />
            </div>
            <p className="text-sm font-bold text-foreground">Order placed!</p>
          </motion.div>
        ) : (
          <motion.button
            key="btn"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            onClick={handleSubmit}
            disabled={isLoading || isOverBalance}
            className={cn(
              "w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg",
              isBuy ? "bg-primary text-white shadow-primary/20" : "bg-destructive text-destructive-foreground shadow-destructive/20"
            )}
          >
            {isBuy ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            {isBuy ? 'Buy / Long' : 'Sell / Short'} {asset?.symbol}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}