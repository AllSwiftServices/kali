import React from 'react';
import { motion } from 'framer-motion';
import { PlusCircle, MinusCircle, ArrowDownToLine, ShoppingBag } from 'lucide-react';
import { haptic } from '@/lib/haptics';

const actions = [
  { label: 'Buy', icon: PlusCircle },
  { label: 'Sell', icon: MinusCircle },
  { label: 'Deposit', icon: ArrowDownToLine },
  { label: 'Pay', icon: ShoppingBag },
];

interface QuickActionsProps {
  onDeposit: () => void;
  onMarkets: () => void;
  onTrade: () => void;
  onWithdraw: () => void;
}

export default function QuickActions({ onDeposit, onMarkets, onTrade, onWithdraw }: QuickActionsProps) {
  // Map actions to appropriate navigation handlers
  const handlers = [
    onMarkets, // Buy -> Markets page
    onTrade,   // Sell -> Trade page
    onDeposit, // Deposit -> Wallet deposit page
    onWithdraw // Pay -> Wallet/Pay page
  ];

  return (
    <div className="grid grid-cols-4 gap-3 max-w-md mx-auto">
      {actions.map(({ label, icon: Icon }, i) => (
        <motion.button
          key={label}
          onClick={() => { haptic('light'); handlers[i](); }}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.05 }}
          whileTap={{ scale: 0.9 }}
          className="flex flex-col items-center gap-2 group touch-manipulation select-none"
        >
          <div className="w-14 h-14 rounded-full flex items-center justify-center bg-[#0082FF] text-white shadow-lg shadow-sky-500/25 group-hover:shadow-sky-500/40 group-hover:scale-105 transition-all duration-200">
            <Icon className="h-6 w-6 stroke-[2]" />
          </div>
          <span className="text-xs font-semibold text-slate-300 group-hover:text-white transition-colors">
            {label}
          </span>
        </motion.button>
      ))}
    </div>
  );
}

