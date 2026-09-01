import React from 'react';
import { motion } from 'framer-motion';
import { X, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export default function PositionPanel({ position, currentPrice, onClose }: {
  position: {
    symbol: string,
    entryPrice: number,
    quantity: number,
    side: 'buy' | 'sell',
    leverage: number
  },
  currentPrice: number,
  onClose: () => void
}) {
  if (!position) return null;

  const pnl = (currentPrice - position.entryPrice) * position.quantity * (position.side === 'buy' ? 1 : -1);
  const pnlPct = (pnl / (position.entryPrice * position.quantity)) * 100;
  const isProfit = pnl >= 0;

  return (
    <motion.div
      className={cn(
        "rounded-3xl border overflow-hidden",
        isProfit ? 'border-primary/30 bg-primary/5' : 'border-destructive/30 bg-destructive/5'
      )}
    >
      <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn("w-2 h-2 rounded-full animate-pulse", isProfit ? "bg-primary" : "bg-destructive")} />
          <h3 className="font-bold text-sm">Open Position · {position.symbol}</h3>
        </div>
        <span className={cn(
          "text-xs px-2 py-1 rounded-full font-bold",
          position.side === 'buy' ? 'bg-primary/20 text-primary' : 'bg-destructive/20 text-destructive'
        )}>
          {position.side.toUpperCase()} {position.leverage}x
        </span>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[
            ['Entry Price', `$${position.entryPrice.toFixed(2)}`],
            ['Current Price', `$${currentPrice.toFixed(2)}`],
            ['Quantity', position.quantity.toFixed(4)],
            ['Margin', `$${(position.entryPrice * position.quantity / position.leverage).toFixed(2)}`],
          ].map(([label, val]) => (
            <div key={label} className="p-3 rounded-xl bg-muted/50 border border-border/50">
              <p className="text-[10px] text-muted-foreground mb-0.5">{label}</p>
              <p className="font-semibold text-sm">{val}</p>
            </div>
          ))}
        </div>

        <div className={cn(
          "p-4 rounded-2xl text-center mb-4 transition-colors",
          isProfit ? "bg-primary/10" : "bg-destructive/10"
        )}>
          <p className="text-xs text-muted-foreground mb-1">Unrealized P&L</p>
          <div className="flex items-center justify-center gap-2">
            {isProfit ? <TrendingUp className="h-5 w-5 text-primary" /> : <TrendingDown className="h-5 w-5 text-destructive" />}
            <p className={cn("text-2xl font-bold", isProfit ? "text-primary" : "text-destructive")}>
              {isProfit ? '+' : ''}${pnl.toFixed(2)}
            </p>
            <span className={cn("text-sm font-semibold", isProfit ? "text-primary" : "text-destructive")}>
              ({isProfit ? '+' : ''}{pnlPct.toFixed(2)}%)
            </span>
          </div>
        </div>

        <Button
          onClick={onClose}
          className={cn(
            "w-full h-11 rounded-2xl font-bold btn-press",
            isProfit ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-destructive text-destructive-foreground hover:bg-destructive/90"
          )}
        >
          Close Position
        </Button>
      </div>
    </motion.div>
  );
}