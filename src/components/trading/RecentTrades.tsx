import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

function randomTrade(basePrice: number) {
  const isBuy = Math.random() > 0.5;
  const price = basePrice * (1 + (Math.random() - 0.5) * 0.003);
  const qty = (Math.random() * 2 + 0.01).toFixed(4);
  const now = new Date();
  return {
    id: Date.now() + Math.random(),
    price: price.toFixed(2),
    qty,
    isBuy,
    time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  };
}

export default function RecentTrades({ basePrice }: { basePrice: number }) {
  const [trades, setTrades] = useState(() =>
    Array.from({ length: 20 }, () => randomTrade(basePrice))
  );

  useEffect(() => {
    const interval = setInterval(() => {
      const newTrade = randomTrade(basePrice);
      setTrades(prev => [newTrade, ...prev.slice(0, 29)]);
    }, 800 + Math.random() * 1200);
    return () => clearInterval(interval);
  }, [basePrice]);

  return (
    <div className="rounded-3xl bg-card border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="font-bold text-sm">Recent Trades</h3>
      </div>
      <div className="px-2">
        <div className="flex justify-between text-[10px] font-semibold text-muted-foreground uppercase px-2 py-2">
          <span>Price</span><span>Qty</span><span>Time</span>
        </div>
        <div className="overflow-y-auto max-h-64 space-y-0.5 pb-3">
          <AnimatePresence initial={false}>
            {trades.map(trade => (
              <motion.div
                key={trade.id}
                initial={{ opacity: 0, x: -10, backgroundColor: trade.isBuy ? 'var(--color-success-muted)' : 'var(--color-destructive-muted)' }}
                animate={{ opacity: 1, x: 0, backgroundColor: 'transparent' }}
                transition={{ duration: 0.35 }}
                className="flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-mono"
              >
                <span className={cn("font-semibold", trade.isBuy ? "text-success" : "text-destructive")}>
                  {trade.price}
                </span>
                <span className="text-muted-foreground">{trade.qty}</span>
                <span className="text-muted-foreground text-[10px]">{trade.time}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}