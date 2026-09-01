import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, TrendingUp } from 'lucide-react';
import { api } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '@/components/ui/ThemeProvider';
import { useAuth } from '@/lib/AuthContext';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const TABS = [
  { key: 'ai_trades', label: 'AI Trades' },
  { key: 'positions', label: 'Positions' },
  { key: 'orders', label: 'Orders' },
  { key: 'deals', label: 'Deals' },
];

export default function TradingHistoryPanel({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const [activeTab, setActiveTab] = useState('ai_trades');
  const [search, setSearch] = useState('');
  const { theme } = useTheme();
  const { user } = useAuth();
  const dark = theme === 'dark';

  const { data: transactions, isLoading: isLoadingTx } = useQuery({
    queryKey: ['transactions-all'],
    queryFn: async () => {
      const { data, error } = await api.get<any[]>('/transactions?order=created_at.desc&limit=200');
      if (error) throw error;
      return data;
    },
    enabled: isOpen && !!user,
  });

  const { data: aiTrades, isLoading: isLoadingAi } = useQuery({
    queryKey: ['ai-trades-history'],
    queryFn: async () => {
      const { data, error } = await api.get<any[]>('/ai-trading/history');
      if (error) throw error;
      return data;
    },
    enabled: isOpen && !!user,
  });

  const isLoading = isLoadingTx || isLoadingAi;

  const txList = transactions || [];

  // Summary numbers
  const profit = txList.filter((t: any) => t.type === 'sell').reduce((s: number, t: any) => s + (t.amount || 0), 0)
    - txList.filter((t: any) => t.type === 'buy').reduce((s: number, t: any) => s + (t.amount || 0), 0);
  const deposit = txList.filter((t: any) => t.type === 'deposit').reduce((s: number, t: any) => s + (t.amount || 0), 0);
  const balance = deposit + profit;

  // Filter list by tab and search
  const typeMap: Record<string, string[]> = { positions: ['buy', 'sell'], orders: ['buy', 'sell'], deals: ['deposit', 'withdraw'] };
  
  let filtered = [];
  if (activeTab === 'ai_trades') {
    filtered = (aiTrades || []).filter((tx: any) => 
      !search || tx.asset_symbol?.toLowerCase().includes(search.toLowerCase())
    );
  } else {
    const types = typeMap[activeTab] || ['buy', 'sell'];
    filtered = txList.filter((tx: any) => {
      const matchType = types.includes(tx.type);
      const matchSearch = !search || tx.asset_symbol?.toLowerCase().includes(search.toLowerCase());
      return matchType && matchSearch;
    });
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />

          {/* Panel */}
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 32 }}
            className="fixed inset-x-0 bottom-0 top-0 z-50 flex flex-col md:top-4 md:left-4 md:right-4 md:bottom-4 md:rounded-2xl overflow-hidden bg-background text-foreground"
          >
            {/* ── HEADER ── */}
            <div className="flex items-center justify-between px-4 py-3 border-b shrink-0 border-border bg-card">
              <div className="flex items-center gap-3">
                <h2 className="font-bold text-base text-foreground">History</h2>
                {/* search */}
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-muted">
                  <Search className="h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="All symbols"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="bg-transparent focus:outline-none w-24 text-xs text-foreground"
                  />
                </div>
              </div>
              <button onClick={onClose} className="p-2 rounded-xl transition-colors text-muted-foreground hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* ── TABS ── */}
            <div className="flex border-b shrink-0 border-border bg-card">
              {TABS.map(t => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={cn(
                    "flex-1 py-3 text-sm font-semibold transition-all border-b-2",
                    activeTab === t.key ? "text-primary border-primary" : "text-muted-foreground border-transparent"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* ── SUMMARY ROW ── */}
            <div className="px-4 py-3 border-b shrink-0 border-border bg-card">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Profit:</span>
                <span className={cn("font-bold", profit >= 0 ? "text-primary" : "text-destructive")}>
                  {profit >= 0 ? '+' : ''}{profit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-muted-foreground">Deposit:</span>
                <span className="font-bold text-foreground">
                  {deposit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-sm mt-1 pt-1 border-t border-border">
                <span className="font-semibold text-muted-foreground">Balance:</span>
                <span className="font-bold text-base text-primary">
                  {balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* ── TRANSACTION LIST ── */}
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="flex justify-center items-center h-32">
                  <div className="animate-spin h-7 w-7 rounded-full border-2 border-primary border-t-transparent" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 gap-3">
                  <TrendingUp className="h-10 w-10 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">No transactions found</p>
                </div>
              ) : (
                filtered.map((tx: any, i: number) => {
                  if (activeTab === 'ai_trades') {
                    const isUp = tx.direction === 'UP';
                    const isWin = tx.outcome === 'WIN';
                    const isResolved = tx.status === 'resolved';

                    return (
                      <motion.div
                        key={tx.id}
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.01 }}
                        className={cn("border-b transition-colors", i % 2 === 0 ? "bg-card" : "bg-background")}
                      >
                        <div className="flex items-start justify-between px-4 pt-3 pb-1">
                          <div className="flex items-center gap-2">
                            <span className={cn("text-xs font-bold px-2 py-0.5 rounded", isUp ? "bg-primary/20 text-primary" : "bg-destructive/20 text-destructive")}>
                              {isUp ? 'CALL' : 'PUT'}
                            </span>
                            <span className="font-bold text-sm text-foreground">
                              ${tx.stake?.toLocaleString()}
                            </span>
                          </div>
                          <span className={cn("font-bold text-sm", isResolved ? (isWin ? "text-primary" : "text-destructive") : "text-amber-500")}>
                            {isResolved ? (isWin ? `+$${tx.profit?.toFixed(2)}` : `-$${tx.stake?.toFixed(2)}`) : 'PENDING'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between px-4 pb-3">
                          <span className="text-xs text-muted-foreground">
                            {tx.created_at ? format(new Date(tx.created_at), 'yyyy.MM.dd HH:mm:ss') : '—'}
                          </span>
                          <span className={cn("text-[10px] font-bold uppercase", isResolved ? (isWin ? "text-primary" : "text-destructive") : "text-amber-500")}>
                            {isResolved ? (isWin ? 'Profit' : 'Loss') : 'Processing'}
                          </span>
                        </div>
                      </motion.div>
                    );
                  }

                  const isPositive = tx.type === 'buy' || tx.type === 'deposit';

                  return (
                    <motion.div
                      key={tx.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.02 }}
                      className={cn("border-b transition-colors", i % 2 === 0 ? "bg-card" : "bg-background")}
                    >
                      {/* Row top: symbol + side + qty → price movement */}
                      <div className="flex items-start justify-between px-4 pt-3 pb-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-foreground">
                            {tx.asset_symbol || tx.type}
                          </span>
                          <span className={cn("text-xs font-bold uppercase", isPositive ? "text-primary" : "text-destructive")}>
                            {tx.type}
                            {tx.quantity ? ` ${tx.quantity}` : ''}
                          </span>
                        </div>
                        <span className={cn("font-bold text-sm", isPositive ? "text-primary" : "text-destructive")}>
                          {isPositive ? '+' : '-'}{tx.amount?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '0.00'}
                        </span>
                      </div>

                      {/* Row bottom: date + price details */}
                      <div className="flex items-center justify-between px-4 pb-3">
                        <span className="text-xs text-muted-foreground">
                          {tx.created_at ? format(new Date(tx.created_at), 'yyyy.MM.dd HH:mm:ss') : '—'}
                        </span>
                        {tx.price_at_transaction ? (
                          <span className="text-xs font-mono text-muted-foreground">
                            @ ${tx.price_at_transaction.toLocaleString('en-US', { minimumFractionDigits: 4 })}
                          </span>
                        ) : null}
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}