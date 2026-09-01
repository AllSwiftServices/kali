import React from 'react';
import { motion } from 'framer-motion';

interface WalletBreakdownCardProps {
  title: string;
  balance: number;
  hideBalance: boolean;
  index: number;
}

function WalletBreakdownCard({ title, balance, hideBalance, index }: WalletBreakdownCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.08 }}
      className="shrink-0 w-48 rounded-2xl p-4 border transition-all bg-card border-border shadow-sm"
    >
      <p className="text-xs font-medium mb-3 text-muted-foreground">{title}</p>
      <p className="font-bold text-lg tracking-tight text-foreground">
        {hideBalance ? '••••••' : `$${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
      </p>
    </motion.div>
  );
}

interface WalletBreakdownProps {
  tradingBalance: number;
  holdingBalance: number;
  hideBalance: boolean;
}

export default function WalletBreakdown({ tradingBalance, holdingBalance, hideBalance }: WalletBreakdownProps) {
  const cards = [
    { title: 'Trading Wallet', balance: tradingBalance },
    { title: 'Holding Wallet', balance: holdingBalance },
  ];

  return (
    <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide no-scrollbar">
      {cards.map((c, i) => (
        <WalletBreakdownCard key={c.title} {...c} hideBalance={hideBalance} index={i} />
      ))}
    </div>
  );
}