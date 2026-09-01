"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  TrendingUp, TrendingDown, Zap, Shield, BarChart3, 
  History, Settings, Bell, Search, Menu, Sun, Moon,
  ArrowUpRight, ArrowDownRight, Share2, Info, ChevronDown,
  Volume2, VolumeX, Timer, Target, PieChart, Activity, BarChart2
} from 'lucide-react';
import { api } from '@/lib/api';
import TradingHistoryPanel from '@/components/trading/TradingHistoryPanel';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useNavigate } from '@/lib/react-router-shim';
import { createPageUrl } from '@/utils';
import AssetSelector from '@/components/trading/AssetSelector';
import LivePriceHeader from '@/components/trading/LivePriceHeader';
import CandlestickChart from '@/components/trading/CandlestickChart';
import OrderPanel from '@/components/trading/OrderPanel';
import ProOrderPanel from '@/components/trading/ProOrderPanel';
import OrderBook from '@/components/trading/OrderBook';
import RecentTrades from '@/components/trading/RecentTrades';
import PositionPanel from '@/components/trading/PositionPanel';
import LiveIndicator from '@/components/trading/LiveIndicator';
import { useAuth } from '@/lib/AuthContext';

const ASSET_DEFAULTS: Record<string, { price: number, type: string }> = {
  AAPL: { price: 178.42, type: 'stock' },
  TSLA: { price: 248.75, type: 'stock' },
  GOOGL: { price: 141.85, type: 'stock' },
  MSFT: { price: 378.92, type: 'stock' },
  NVDA: { price: 495.22, type: 'stock' },
  AMZN: { price: 178.25, type: 'stock' },
  BTC: { price: 67432.5, type: 'crypto' },
  ETH: { price: 3542.18, type: 'crypto' },
  SOL: { price: 148.65, type: 'crypto' },
  XRP: { price: 0.52, type: 'crypto' },
};

const DEFAULT_ASSET = { symbol: 'BTC', name: 'Bitcoin', type: 'crypto', pair: 'BTC/USDT' };

interface AiTradingViewProps {
  onViewChange?: (view: 'ai' | 'live') => void;
}

export default function AiTradingView({ onViewChange }: AiTradingViewProps) {
  const searchParams = useSearchParams();
  const initialAssetSymbol = searchParams.get('asset') || 'BTC';
  const [selectedAsset, setSelectedAsset] = useState<any>(
    ASSET_DEFAULTS[initialAssetSymbol] 
      ? { symbol: initialAssetSymbol, ...ASSET_DEFAULTS[initialAssetSymbol] }
      : DEFAULT_ASSET
  );
  const { user, isLoadingAuth } = useAuth();
  const navigate = useNavigate();

  const { data: assets } = useQuery({
    queryKey: ['trading-assets'],
    queryFn: async () => {
      const { data, error } = await api.get<any[]>('/assets');
      if (error) throw error;
      return data;
    }
  });

  const { data: wallets } = useQuery({
    queryKey: ['wallets'],
    queryFn: async () => {
      const { data, error } = await api.get<any[]>('/wallets');
      if (error) throw error;
      return data;
    },
    enabled: !!user
  });

  // Pick initial asset once list loads
  useEffect(() => {
    if (assets && assets.length > 0) {
      const initialAssetSymbol = searchParams.get('asset') || 'BTC';
      const dbAsset = assets.find((a: any) => a.symbol === initialAssetSymbol) || assets[0];
      setSelectedAsset(dbAsset);
    }
  }, [assets]);

  useEffect(() => {
    if (!isLoadingAuth && !user) {
      navigate(createPageUrl('Home'));
    }
  }, [user, isLoadingAuth, navigate]);

  const [livePrice, setLivePrice] = useState<number | null>(null);
  const prevPriceRef = useRef<number | null>(null);
  const [prevPrice, setPrevPrice] = useState<number | null>(null);
  const [changePercent, setChangePercent] = useState(0);
  const [high24h, setHigh24h] = useState(0);
  const [low24h, setLow24h] = useState(0);
  const [loading, setLoading] = useState(false);
  const [openPosition, setOpenPosition] = useState<any>(null);
  const [soundOn, setSoundOn] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [tradeMode, setTradeMode] = useState<'binary' | 'advanced'>('binary');

  const walletBalance = (wallets as any[])?.find(w => w.currency === 'trading')?.main_balance ?? 0;

  // Initialize price from DB or fallback
  useEffect(() => {
    setLoading(true);
    const dbAsset = assets?.find((a: any) => a.symbol === selectedAsset.symbol);
    const basePrice = dbAsset?.price ?? ASSET_DEFAULTS[selectedAsset.symbol]?.price ?? 100;
    const baseChange = dbAsset?.change_percent ?? 0;
    setLivePrice(basePrice);
    setPrevPrice(basePrice);
    prevPriceRef.current = basePrice;
    setChangePercent(baseChange);
    setHigh24h(basePrice * 1.025);
    setLow24h(basePrice * 0.975);
    setTimeout(() => setLoading(false), 400);
  }, [selectedAsset.symbol, assets]);

  // Simulate live price ticking
  useEffect(() => {
    if (!livePrice) return;
    const volatility = selectedAsset.type === 'crypto' ? 0.0015 : 0.0005;
    const interval = setInterval(() => {
      setLivePrice(prev => {
        if (!prev) return prev;
        const change = (Math.random() - 0.49) * prev * volatility;
        const next = Math.max(prev * 0.95, prev + change);
        setPrevPrice(prevPriceRef.current);
        prevPriceRef.current = prev;
        setHigh24h(h => Math.max(h, next));
        setLow24h(l => Math.min(l, next));
        return next;
      });
    }, 1000 + Math.random() * 500);
    return () => clearInterval(interval);
  }, [livePrice, selectedAsset.type]);

  const handleAssetChange = (asset: any) => {
    setSelectedAsset(asset);
    setOpenPosition(null);
  };

  const handleClosePosition = () => {
    setOpenPosition(null);
  };

  const handlePlaceOrder = ({ side, quantity, entryPrice, leverage }: any) => {
    setOpenPosition({
      symbol: selectedAsset.symbol,
      side,
      quantity,
      entryPrice,
      leverage,
    });
  };

  const displayPrice = livePrice ?? 0;
  const volLabel = selectedAsset.type === 'crypto'
    ? `${(Math.random() * 5000 + 1000).toFixed(0)}M`
    : `${(Math.random() * 80 + 10).toFixed(0)}M`;

  return (
    <div className="pb-24 md:pb-8 bg-background flex flex-col">
      {/* ── TOP BAR ── */}
      <header className="sticky top-0 z-30 bg-background/90 backdrop-blur-xl border-b border-border">
        <div className="flex flex-wrap items-center justify-between px-2 sm:px-4 py-2 sm:py-3 gap-2 sm:gap-3">
          <AssetSelector selected={selectedAsset} onChange={handleAssetChange} assets={assets || undefined} />
          
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Mode toggle */}
            <div className="flex items-center rounded-xl overflow-hidden bg-muted">
              <button
                onClick={() => setTradeMode('binary')}
                className={cn(
                  "flex items-center gap-1 px-2 sm:px-2.5 py-1.5 text-[10px] sm:text-xs font-semibold transition-all",
                  tradeMode === 'binary' ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                )}
              >
                <Zap className="h-3 sm:h-3.5 w-3 sm:w-3.5" /> <span className="hidden min-[360px]:inline">AI Trading</span>
                <span className="min-[360px]:hidden">AI</span>
              </button>
              <button
                onClick={() => onViewChange?.('live')}
                className={cn(
                  "flex items-center gap-1 px-2 sm:px-2.5 py-1.5 text-[10px] sm:text-xs font-semibold transition-all",
                  "text-muted-foreground hover:bg-muted"
                )}
              >
                <BarChart2 className="h-3 sm:h-3.5 w-3 sm:w-3.5" /> <span className="hidden min-[360px]:inline">Live Trading</span>
                <span className="min-[360px]:hidden">Live</span>
              </button>
            </div>
            
            <button
              onClick={() => setHistoryOpen(true)}
              className="flex items-center justify-center p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-muted text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
            >
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">History</span>
            </button>
            <LiveIndicator soundOn={soundOn} onToggleSound={() => setSoundOn(s => !s)} />
          </div>
        </div>

        {/* Price strip */}
        <div className="px-4 pb-3">
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div key="skel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="h-10 w-48 rounded-xl mb-1 bg-muted animate-pulse" />
                <div className="h-4 w-64 rounded-xl bg-muted animate-pulse" />
              </motion.div>
            ) : (
              <motion.div key={selectedAsset.symbol} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <LivePriceHeader
                  price={displayPrice}
                  prevPrice={prevPrice}
                  change={displayPrice - (livePrice ?? 0)}
                  changePercent={changePercent}
                  high24h={high24h}
                  low24h={low24h}
                  volume={volLabel}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      <AnimatePresence mode="wait">
        {tradeMode === 'binary' ? (
          <motion.div key="binary" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full max-w-2xl mx-auto">
            {/* Chart */}
            <div className="px-3 pt-3">
              <AnimatePresence mode="wait">
                {loading ? (
                  <motion.div key="chart-skel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <div className="rounded-2xl bg-card border border-border p-4">
                      <div className="h-48 rounded-xl bg-muted animate-pulse" />
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key={selectedAsset.symbol + 'chart'}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl bg-card border border-border p-3"
                  >
                    <CandlestickChart basePrice={displayPrice} isPositive={changePercent >= 0} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <OrderPanel asset={selectedAsset} price={displayPrice} balance={walletBalance} />
          </motion.div>
        ) : (
          <motion.div key="advanced" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-3 py-4 space-y-4 max-w-7xl mx-auto">
            <div className="md:grid md:grid-cols-[1fr_340px] md:gap-4">
              {/* LEFT: Chart + Order Book + Recent Trades */}
              <div className="space-y-4">
                <AnimatePresence mode="wait">
                  {loading ? (
                    <motion.div key="chart-skel2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <div className="rounded-3xl bg-card border border-border p-4">
                        <div className="h-72 rounded-2xl bg-muted animate-pulse" />
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key={selectedAsset.symbol + 'chart2'}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-3xl bg-card border border-border p-4"
                    >
                      <CandlestickChart basePrice={displayPrice} isPositive={changePercent >= 0} />
                    </motion.div>
                  )}
                </AnimatePresence>

                {openPosition && (
                  <PositionPanel position={openPosition} currentPrice={displayPrice} onClose={handleClosePosition} />
                )}

                <div className="md:hidden">
                  <ProOrderPanel asset={selectedAsset} price={displayPrice} balance={walletBalance} onOrderPlaced={handlePlaceOrder} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <OrderBook price={displayPrice} />
                  <RecentTrades basePrice={displayPrice} />
                </div>
              </div>

              {/* RIGHT: Order panel (desktop) */}
              <div className="hidden md:flex flex-col gap-4">
                <ProOrderPanel asset={selectedAsset} price={displayPrice} balance={walletBalance} onOrderPlaced={handlePlaceOrder} />
                {openPosition && (
                  <PositionPanel position={openPosition} currentPrice={displayPrice} onClose={handleClosePosition} />
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <TradingHistoryPanel isOpen={historyOpen} onClose={() => setHistoryOpen(false)} />
    </div>
  );
}