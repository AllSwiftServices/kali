"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  ArrowUpRight, 
  ArrowDownLeft, 
  History, 
  CreditCard, 
  Building, 
  Smartphone,
  CheckCircle2,
  Clock,
  XCircle,
  ChevronRight
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { useNavigate } from '@/lib/react-router-shim';
import { createPageUrl } from '@/utils';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import WalletCard from '@/components/wallet/WalletCard';
import { showToast } from '@/lib/toast';
import { CardSkeleton } from '@/components/common/LoadingSkeleton';

// Money direction per transaction type — NOT the sign of tx.amount, which is
// stored inconsistently across insert points (some routes store the debited
// stake as a positive magnitude, others as negative). 'credit' = money added
// to the wallet, 'debit' = money removed, 'neutral' = a status log entry for
// a transaction whose actual money movement already happened elsewhere (e.g.
// a trade loss — the stake was already debited at entry, so logging it again
// as a second outflow would double-count it).
const CREDIT_TYPES = new Set(['deposit', 'sell', 'trade_sell', 'holding_profit', 'managed_trade_payout']);
const DEBIT_TYPES = new Set(['withdraw', 'buy', 'trade_buy', 'trade_entry', 'managed_trade_entry', 'holding_loss']);
const NEUTRAL_TYPES = new Set(['managed_trade_loss']);

function getTxDirection(type: string): 'credit' | 'debit' | 'neutral' {
  if (CREDIT_TYPES.has(type)) return 'credit';
  if (NEUTRAL_TYPES.has(type)) return 'neutral';
  if (DEBIT_TYPES.has(type)) return 'debit';
  return 'debit'; // conservative default for any unrecognized type
}

export default function WalletPage() {
  const { user, isLoadingAuth } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [hideBalance, setHideBalance] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'deposits' | 'withdrawals'>('all');
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [selectedWithdrawWallet, setSelectedWithdrawWallet] = useState<any>(null);

  useEffect(() => {
    if (!isLoadingAuth && !user) {
      navigate(createPageUrl('Home'));
    }
  }, [user, isLoadingAuth, navigate]);

  const { data: assets } = useQuery({
    queryKey: ['assets'],
    queryFn: async () => {
      const { data, error } = await api.get<any[]>('/assets');
      if (error) throw error;
      return data;
    }
  });

  const { data: wallets, isLoading: isLoadingWallets } = useQuery({
    queryKey: ['wallets'],
    queryFn: async () => {
      const { data, error } = await api.get<any[]>('/wallets');
      if (error) throw error;
      return data;
    },
    enabled: !!user
  });

  const { data: portfolio } = useQuery({
    queryKey: ['portfolio'],
    queryFn: async () => {
      const { data, error } = await api.get<any[]>('/portfolio');
      if (error) throw error;
      return data;
    },
    enabled: !!user
  });

  const { data: transactions, isLoading: isLoadingTx } = useQuery({
    queryKey: ['transactions'],
    queryFn: async () => {
      const { data, error } = await api.get<any[]>('/transactions');
      if (error) throw error;
      return data;
    },
    enabled: !!user
  });

  const withdrawMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await api.post('/withdrawals', data);
      if (error) throw error;
    },
    onSuccess: () => {
      showToast.success('Withdrawal request submitted!');
      setIsWithdrawModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
    onError: (error: any) => {
      showToast.error(error.message || 'Failed to submit withdrawal');
    }
  });

  const handleWithdrawClick = (wallet: any) => {
    if (user?.kyc_status !== 'approved') {
      showToast.error('Please complete KYC verification to withdraw funds');
      navigate(createPageUrl('VerifyIdentity'));
      return;
    }
    setSelectedWithdrawWallet(wallet);
    setIsWithdrawModalOpen(true);
  };

  // All assets (crypto + stocks) are purchased from the holding wallet,
  // so ALL holding asset values belong to the Holding Wallet display.
  const calcValue = (holdings: any[]) => holdings.reduce((sum: number, h: any) => {
    const asset = assets?.find((a: any) => a.symbol === h.asset_symbol);
    return sum + (h.quantity * (asset?.price || h.avg_buy_price));
  }, 0);
  const allHoldingsValue = calcValue(portfolio || []);

  const tradingWallet = wallets?.find(w => w.currency === 'trading') || { main_balance: 0 };
  const holdingWallet = wallets?.find(w => w.currency === 'holding') || { main_balance: 0 };

  // Trading wallet = just its raw cash balance (no assets bought from here)
  const totalTradingValue = Number(tradingWallet.main_balance) || 0;
  // Holding wallet = its cash balance + all asset holdings purchased from it
  const totalHoldingValue = (Number(holdingWallet.main_balance) || 0) + allHoldingsValue;

  const filteredTransactions = transactions?.filter(tx => {
    if (activeTab === 'all') return true;
    if (activeTab === 'deposits') return tx.type === 'deposit' || tx.type === 'sell';
    if (activeTab === 'withdrawals') return tx.type === 'withdraw' || tx.type === 'buy';
    return true;
  }) || [];

  if (isLoadingAuth || isLoadingWallets) {
    return (
      <div className="min-h-screen pb-32 px-4 py-8 space-y-6">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-32 md:pb-8 bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-30 backdrop-blur-xl border-b bg-background/95 border-border pt-safe">
        <div className="px-4 py-4 flex items-center justify-between">
          <h1 className="font-bold text-2xl">Wallet</h1>
          <div className="flex gap-2">
            <Button size="icon" variant="ghost" className="rounded-full">
              <History className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <div className="px-4 py-6 space-y-8">
        {/* Balances Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <WalletCard
            type="crypto"
            title="Trading Wallet"
            balance={totalTradingValue}
            hideBalance={hideBalance}
            onToggleHide={() => setHideBalance(!hideBalance)}
            onDeposit={() => navigate(createPageUrl('Wallet/Deposit'))}
            onWithdraw={() => handleWithdrawClick(tradingWallet)}
          />
          <WalletCard
            type="stocks"
            title="Holding Wallet"
            balance={totalHoldingValue}
            hideBalance={hideBalance}
            onToggleHide={() => setHideBalance(!hideBalance)}
            onDeposit={() => navigate(createPageUrl('Wallet/Deposit'))}
            onWithdraw={() => handleWithdrawClick(holdingWallet)}
          />
        </div>

       

        {/* Transactions Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg">Transactions</h3>
            <div className="flex gap-2 p-1 bg-muted/50 rounded-xl">
              {(['all', 'deposits', 'withdrawals'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all",
                    activeTab === tab 
                      ? "bg-card text-foreground shadow-sm" 
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {isLoadingTx ? (
              <CardSkeleton />
            ) : filteredTransactions.length === 0 ? (
              <div className="text-center py-12 bg-card rounded-3xl border border-border">
                <History className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No transactions found</p>
              </div>
            ) : (
              filteredTransactions.map((tx, i) => {
                const direction = getTxDirection(tx.type);
                return (
                <motion.div
                  key={tx.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-4 p-4 rounded-2xl bg-card border border-border hover:border-primary/50 transition-colors group cursor-pointer"
                >
                  <div className={cn(
                    "p-3 rounded-xl",
                    direction === 'credit' ? "bg-success/10 text-success"
                      : direction === 'neutral' ? "bg-muted text-muted-foreground"
                      : "bg-destructive/10 text-destructive"
                  )}>
                    {direction === 'credit' ? <ArrowDownLeft className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm capitalize">{tx.type} {tx.symbol ? `- ${tx.symbol}` : ''}</span>
                      {tx.status === 'completed' ? (
                        <CheckCircle2 className="h-3 w-3 text-success" />
                      ) : tx.status === 'pending' ? (
                        <Clock className="h-3 w-3 text-amber-500" />
                      ) : (
                        <XCircle className="h-3 w-3 text-destructive" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(tx.created_at).toLocaleDateString()} • {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <p className={cn(
                      "font-bold text-sm",
                      direction === 'credit' ? "text-success"
                        : direction === 'neutral' ? "text-muted-foreground"
                        : "text-destructive"
                    )}>
                      {direction === 'neutral' ? '' : direction === 'credit' ? '+' : '-'}${tx.total_value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-[10px] text-muted-foreground uppercase">{tx.status}</p>
                  </div>

                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </motion.div>
              );})
            )}
          </div>
        </div>
      </div>

      <WithdrawalModal 
        isOpen={isWithdrawModalOpen}
        onClose={() => setIsWithdrawModalOpen(false)}
        wallet={selectedWithdrawWallet}
        onSubmit={(data: any) => withdrawMutation.mutate(data)}
        isSubmitting={withdrawMutation.isPending}
      />
    </div>
  );
}

function WithdrawalModal({ isOpen, onClose, wallet, onSubmit, isSubmitting }: any) {
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<'BTC' | 'USDT'>('USDT');
  const [address, setAddress] = useState('');

  if (!isOpen || !wallet) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      wallet_id: wallet.id,
      amount: parseFloat(amount),
      currency,
      network: currency === 'BTC' ? 'BTC' : 'TRC20',
      address
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
          />
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-md bg-card border border-border rounded-[2.5rem] shadow-2xl p-8"
          >
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold">Withdraw funds</h2>
                <p className="text-sm text-muted-foreground">From your {wallet.currency} wallet</p>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
                <XCircle className="h-6 w-6 text-muted-foreground" />
              </Button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="p-4 rounded-2xl bg-muted/30 border border-border flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Available Balance</span>
                <span className="font-bold">${Number(wallet.main_balance || 0).toLocaleString()}</span>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-muted-foreground uppercase px-1">Withdrawal Amount ($)</label>
                <input
                  type="number"
                  placeholder="0.00"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full h-14 px-4 bg-muted/50 border border-border rounded-2xl text-xl font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-muted-foreground uppercase px-1">Select Asset</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: 'BTC', label: 'Bitcoin', network: 'BTC' },
                    { id: 'USDT', label: 'USDT', network: 'TRC20' },
                  ].map((asset) => (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() => setCurrency(asset.id as any)}
                      className={cn(
                        "p-4 rounded-2xl border text-left transition-all",
                        currency === asset.id 
                          ? "bg-primary/5 border-primary shadow-sm ring-1 ring-primary/20" 
                          : "bg-card border-border hover:border-primary/50"
                      )}
                    >
                      <p className="font-bold text-sm">{asset.label}</p>
                      <p className="text-[10px] text-muted-foreground">{asset.network}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-muted-foreground uppercase px-1">Recipient Address ({currency === 'BTC' ? 'BTC' : 'TRC20'})</label>
                <input
                  type="text"
                  placeholder={`Enter your ${currency} address`}
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full h-14 px-4 bg-muted/50 border border-border rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-mono"
                />
              </div>

              <Button 
                type="submit" 
                disabled={isSubmitting || !amount || parseFloat(amount) <= 0 || parseFloat(amount) > wallet.main_balance || !address}
                className="w-full h-14 rounded-2xl font-bold text-lg shadow-lg shadow-primary/20"
              >
                {isSubmitting ? "Processing..." : "Confirm Withdrawal"}
              </Button>

              <p className="text-[10px] text-center text-muted-foreground font-medium">
                Withdrawals are processed manually by our finance team and may take up to 24 hours to reflect on the blockchain.
              </p>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
