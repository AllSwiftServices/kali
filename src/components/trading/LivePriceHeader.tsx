import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

export default function LivePriceHeader({ price, prevPrice, change, changePercent, high24h, low24h, volume }: {
  price: number;
  prevPrice: number | null;
  change: number;
  changePercent: number;
  high24h: number;
  low24h: number;
  volume: string;
}) {
  const isPositive = changePercent >= 0;
  const direction = !prevPrice || price === prevPrice ? 'same' : price > prevPrice ? 'up' : 'down';

  const fmt = (n: number, d = 2) =>
    n?.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) ?? '—';

  return (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
      <div className="flex items-baseline gap-3">
        <AnimatePresence mode="popLayout">
          <motion.span
            key={Math.round(price * 100)}
            className={cn(
              "text-2xl min-[360px]:text-3xl md:text-4xl font-bold tabular-nums tracking-tight",
              direction === 'up' ? 'text-success' : direction === 'down' ? 'text-destructive' : 'text-foreground'
            )}
          >
            ${fmt(price)}
          </motion.span>
        </AnimatePresence>

        <span className={cn(
          "text-sm md:base font-semibold px-2 py-0.5 rounded-lg whitespace-nowrap",
          isPositive ? 'text-success bg-success/10' : 'text-destructive bg-destructive/10'
        )}>
          {isPositive ? '+' : ''}{fmt(changePercent)}%
        </span>
      </div>

      <div className="flex flex-wrap gap-4 text-[10px] md:text-xs text-muted-foreground sm:ml-auto">
        <span className="whitespace-nowrap">H: <span className="text-foreground font-medium">${fmt(high24h)}</span></span>
        <span className="whitespace-nowrap">L: <span className="text-foreground font-medium">${fmt(low24h)}</span></span>
        <span className="whitespace-nowrap">Vol: <span className="text-foreground font-medium">{volume}</span></span>
      </div>
    </div>
  );
}