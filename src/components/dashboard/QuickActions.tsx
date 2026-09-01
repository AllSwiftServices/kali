import React from 'react';
import { motion } from 'framer-motion';
import { ArrowDownToLine, ArrowUpFromLine, Zap, TrendingUp } from 'lucide-react';
import { haptic } from '@/lib/haptics';

const actions = [
  { label: 'Deposit', icon: ArrowDownToLine },
  { label: 'Trade', icon: Zap },
  { label: 'Markets', icon: TrendingUp },
  { label: 'Withdraw', icon: ArrowUpFromLine },
];

interface QuickActionsProps {
  onDeposit: () => void;
  onMarkets: () => void;
  onTrade: () => void;
  onWithdraw: () => void;
}

export default function QuickActions({ onDeposit, onMarkets, onTrade, onWithdraw }: QuickActionsProps) {
  const handlers = [onDeposit, onTrade, onMarkets, onWithdraw];

  return (
    <div className="flex flex-wrap gap-3">
      {actions.map(({ label, icon: Icon }, i) => (
        <motion.button
          key={label}
          onClick={() => { haptic('light'); handlers[i](); }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06 }}
          whileTap={{ scale: 0.92 }}
          whileHover={{ y: -2 }}
          className="flex flex-col items-center gap-2 group touch-manipulation select-none"
        >
          <div className="w-24 h-12 rounded-full flex items-center justify-center transition-all duration-200 bg-primary shadow-lg shadow-primary/25 group-hover:shadow-primary/40">
            <Icon className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xs font-medium transition-colors text-muted-foreground group-hover:text-foreground">{label}</span>
        </motion.button>
      ))}
    </div>
  );
}
