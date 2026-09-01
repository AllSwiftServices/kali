import React from 'react';
import { motion } from 'framer-motion';
import { Wallet, Bitcoin, TrendingUp, Eye, EyeOff, ArrowUpRight, ArrowDownLeft, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AnimatedNumber from '../common/AnimatedNumber';
import { cn } from '@/lib/utils';

const iconMap = {
  main: Wallet,
  crypto: DollarSign,
  stocks: TrendingUp,
};

export default function WalletCard({
  type = 'main',
  title,
  balance,
  hideBalance,
  onToggleHide,
  onDeposit,
  onWithdraw
}: {
  type?: 'main' | 'crypto' | 'stocks';
  title: string;
  balance: number;
  hideBalance: boolean;
  onToggleHide: () => void;
  onDeposit?: () => void;
  onWithdraw?: () => void;
}) {
  const Icon = (iconMap as any)[type] || Wallet;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="relative overflow-hidden rounded-3xl p-5 border bg-card border-border shadow-md"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <span className="font-medium text-muted-foreground">{title}</span>
        </div>
        <button
          onClick={onToggleHide}
          className="p-2 rounded-lg transition-colors hover:bg-muted"
        >
          {hideBalance ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
        </button>
      </div>
      
      <div className="mb-4">
        {hideBalance ? (
          <span className="text-3xl font-bold tracking-tight text-foreground">••••••</span>
        ) : (
          <AnimatedNumber
            value={balance}
            prefix="$"
            decimals={2}
            className="text-3xl font-bold tracking-tight text-foreground"
          />
        )}
      </div>
      
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={onDeposit}
          className="flex-1 btn-press bg-muted hover:bg-muted/80 text-foreground transition-all border-none"
        >
          <ArrowDownLeft className="h-4 w-4 mr-1 text-primary" />
          Deposit
        </Button>
        <Button
          size="sm"
          onClick={onWithdraw}
          className="flex-1 btn-press bg-muted hover:bg-muted/80 text-foreground transition-all border-none"
        >
          <ArrowUpRight className="h-4 w-4 mr-1 text-primary" />
          Withdraw
        </Button>
      </div>
    </motion.div>
  );
}