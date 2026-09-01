"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownLeft, TrendingUp, TrendingDown, Search, Filter } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { api } from '@/lib/api';
import { useNavigate } from '@/lib/react-router-shim';
import { createPageUrl } from '@/utils';
import { useAuth } from '@/lib/AuthContext';

// buy = spends cash to acquire an asset (debit); sell = converts an asset
// back to cash (credit) — confirmed against the actual wallet-balance
// adjustment in /api/transactions/route.ts (`sell`/`deposit` add to balance,
// `buy`/`withdraw` subtract). managed_trade_loss is a status log for a trade
// whose stake was already debited at entry, so it's neutral, not a second debit.
const TYPE_CONFIG: any = {
  buy: { label: 'Buy', icon: ArrowUpRight, color: 'text-destructive', bg: 'bg-destructive/10' },
  sell: { label: 'Sell', icon: ArrowDownLeft, color: 'text-primary', bg: 'bg-primary/10' },
  trade_buy: { label: 'Buy', icon: ArrowUpRight, color: 'text-destructive', bg: 'bg-destructive/10' },
  trade_sell: { label: 'Sell', icon: ArrowDownLeft, color: 'text-primary', bg: 'bg-primary/10' },
  deposit: { label: 'Deposit', icon: ArrowDownLeft, color: 'text-primary', bg: 'bg-primary/10' },
  withdraw: { label: 'Withdraw', icon: ArrowUpRight, color: 'text-destructive', bg: 'bg-destructive/10' },
  managed_trade_stake: { label: 'Trade Entry', icon: ArrowUpRight, color: 'text-destructive', bg: 'bg-destructive/10' },
  managed_trade_entry: { label: 'Trade Entry', icon: ArrowUpRight, color: 'text-destructive', bg: 'bg-destructive/10' },
  managed_trade_payout: { label: 'Trade Result', icon: ArrowDownLeft, color: 'text-primary', bg: 'bg-primary/10' },
  managed_trade_loss: { label: 'Trade Loss', icon: ArrowUpRight, color: 'text-muted-foreground', bg: 'bg-muted' },
  trade_entry: { label: 'AI Trade Entry', icon: ArrowUpRight, color: 'text-destructive', bg: 'bg-destructive/10' },
  holding_profit: { label: 'Holding Profit', icon: ArrowDownLeft, color: 'text-primary', bg: 'bg-primary/10' },
  holding_loss: { label: 'Holding Loss', icon: ArrowUpRight, color: 'text-destructive', bg: 'bg-destructive/10' },
};

const CREDIT_TYPES = new Set(['deposit', 'sell', 'trade_sell', 'holding_profit', 'managed_trade_payout']);
const NEUTRAL_TYPES = new Set(['managed_trade_loss']);

const TABS = ['all', 'buy', 'sell', 'deposit', 'withdraw', 'trades'];

export default function TradingHistory() {
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const { user, isLoadingAuth } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoadingAuth && !user) {
      navigate(createPageUrl('Home'));
    }
  }, [user, isLoadingAuth, navigate]);

  const { data: transactions, isLoading } = useQuery({
    queryKey: ['transactions'],
    queryFn: async () => {
      const { data, error } = await api.get<any[]>('/transactions?order=created_at.desc');
      if (error) throw error;
      return data;
    },
    enabled: !!user
  });

  const filtered = (transactions || []).filter((tx: any) => {
    const isTrade = tx.type === 'managed_trade_stake' || tx.type === 'managed_trade_entry' || tx.type === 'managed_trade_payout';
    const matchTab = activeTab === 'all' || (activeTab === 'trades' && isTrade) || tx.type === activeTab;
    const matchSearch = !search ||
      tx.asset_symbol?.toLowerCase().includes(search.toLowerCase()) ||
      tx.type?.toLowerCase().includes(search.toLowerCase()) ||
      tx.description?.toLowerCase().includes(search.toLowerCase());
    return matchTab && matchSearch;
  });

  const totalBuys = (transactions || []).filter((t: any) => t.type === 'buy').reduce((s: number, t: any) => s + (t.amount || 0), 0);
  const totalSells = (transactions || []).filter((t: any) => t.type === 'sell').reduce((s: number, t: any) => s + (t.amount || 0), 0);
  const totalPayouts = (transactions || []).filter((t: any) => t.type === 'managed_trade_payout').reduce((s: number, t: any) => s + (t.amount || 0), 0);
  const totalTrades = (transactions || []).filter((t: any) => t.type === 'managed_trade_stake' || t.type === 'managed_trade_entry').reduce((s: number, t: any) => s + Math.abs(t.amount || 0), 0);
  const tradeProfit = totalPayouts - totalTrades;

  return (
    <div className="min-h-screen pb-32 md:pb-8 bg-background text-foreground">
      <header className="sticky top-0 z-30 backdrop-blur-xl border-b px-4 py-4 bg-background/95 border-border pt-safe">
        <h1 className="font-bold text-2xl mb-4 text-foreground">Trading History</h1>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by asset or type..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm border focus:outline-none focus:ring-1 focus:ring-primary bg-card border-border text-foreground transition-colors"
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 no-scrollbar">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-4 py-1.5 rounded-xl text-xs font-semibold capitalize whitespace-nowrap transition-all",
                activeTab === tab ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </header>

      <div className="px-4 py-5 space-y-5">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Total Bought', value: totalBuys, color: 'text-primary' },
            { label: 'Total Sold', value: totalSells, color: 'text-destructive' },
            { label: 'Trade Profit', value: tradeProfit, color: tradeProfit >= 0 ? 'text-success' : 'text-destructive' },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-2xl p-3 border text-center bg-card border-border shadow-sm">
              <p className="text-[10px] text-muted-foreground font-medium mb-1">{label}</p>
              <p className={cn("text-sm font-bold", color)}>${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
          ))}
        </div>

        {/* Transaction List */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin h-8 w-8 rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 rounded-3xl border bg-card border-border shadow-sm">
            <Filter className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground font-medium">No transactions found</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filtered.map((tx: any, i: number) => {
              const cfg = TYPE_CONFIG[tx.type] || TYPE_CONFIG.buy;
              const Icon = cfg.icon;
              const isNeutral = NEUTRAL_TYPES.has(tx.type);
              const isIncome = CREDIT_TYPES.has(tx.type);
              return (
                <motion.div
                  key={tx.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex items-center justify-between p-4 rounded-2xl border bg-card border-border shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0", cfg.bg)}>
                      <Icon className={cn("h-5 w-5", cfg.color)} />
                    </div>
                    <div>
                      <p className="font-semibold text-sm capitalize text-foreground">
                        {cfg.label}{tx.asset_symbol ? ` ${tx.asset_symbol}` : ''}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-muted-foreground">
                          {tx.created_at ? format(new Date(tx.created_at), 'MMM d, yyyy · h:mm a') : '—'}
                        </p>
                        {tx.quantity && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md font-mono bg-muted text-muted-foreground">
                            {tx.quantity} units
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={cn("font-bold text-sm", isNeutral ? "text-muted-foreground" : isIncome ? "text-primary" : "text-destructive")}>
                      {isNeutral ? '' : isIncome ? '+' : '-'}${tx.amount?.toFixed(2)}
                    </p>
                    {tx.price_at_transaction && (
                      <p className="text-[11px] mt-0.5 text-muted-foreground">
                        @ ${tx.price_at_transaction?.toFixed(2)}
                      </p>
                    )}
                      <span className={cn(
                        'text-[10px] font-medium px-2 py-0.5 rounded-full mt-1 inline-block capitalize',
                        tx.status === 'completed' ? 'bg-primary/10 text-primary' : tx.status === 'failed' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'
                      )}>
                        {tx.status || 'completed'}
                      </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}