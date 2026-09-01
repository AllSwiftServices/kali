import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export default function PortfolioItem({ item, currentPrice, index = 0 }: {
  item: {
    asset_symbol: string,
    quantity: number,
    total_invested: number,
    asset_type: string,
    avg_buy_price: number
  },
  currentPrice: number,
  index?: number
}) {
  const currentValue = item.quantity * currentPrice;
  const profitLoss = currentValue - item.total_invested;
  const profitLossPercent = ((currentValue - item.total_invested) / item.total_invested) * 100;
  const isPositive = profitLoss >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        'p-4 rounded-2xl bg-card border border-border/50',
        'hover:shadow-lg transition-all duration-200'
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            {item.asset_symbol?.slice(0, 2)}
          </div>
          <div>
            <h3 className="font-semibold">{item.asset_symbol}</h3>
            <p className="text-sm text-muted-foreground">
              {item.quantity?.toFixed(item.asset_type === 'crypto' ? 6 : 2)} shares
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-semibold">
            ${currentValue?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className={cn("text-sm font-semibold", isPositive ? "text-primary" : "text-destructive")}>
            {isPositive ? '+' : ''}{profitLossPercent?.toFixed(2)}%
          </p>
        </div>
      </div>
      
      <div className="flex justify-between text-xs text-muted-foreground pt-3 border-t border-border">
        <span>Avg: ${item.avg_buy_price?.toFixed(2)}</span>
        <span>Invested: ${item.total_invested?.toFixed(2)}</span>
        <span className={cn("font-semibold", isPositive ? "text-primary" : "text-destructive")}>
          {isPositive ? '+' : ''}${profitLoss?.toFixed(2)}
        </span>
      </div>
    </motion.div>
  );
}