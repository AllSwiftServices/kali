"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, BarChart3, RefreshCw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import AnimatedNumber from '@/components/common/AnimatedNumber';
import { api } from '@/lib/api';
import { useNavigate } from '@/lib/react-router-shim';
import { createPageUrl } from '@/utils';
import { useAuth } from '@/lib/AuthContext';
import AllocationChart from '@/components/portfolio/AllocationChart';
import { CardSkeleton } from '@/components/common/LoadingSkeleton';
import TradeModal from '@/components/trade/TradeModal';
import { toast } from 'sonner';
import AssetIcon from '@/components/common/AssetIcon';

interface PortfolioItemProps {
  item: any;
  currentPrice: number;
  index: number;
  onTradeClick?: (assetSymbol: string) => void;
  logoUrl?: string | null;
}

function PortfolioItem({ item, currentPrice, index, onTradeClick, logoUrl }: PortfolioItemProps) {
  const profitLoss = (currentPrice - item.avg_buy_price) * item.quantity;
  const profitLossPercent = ((currentPrice - item.avg_buy_price) / item.avg_buy_price) * 100;
  const isPositive = profitLoss >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="p-4 rounded-2xl bg-card border border-border flex items-center gap-4"
    >
      <AssetIcon symbol={item.asset_symbol} logoUrl={logoUrl} size="md" />
      <div className="flex-1">
        <p className="font-semibold text-sm">{item.asset_symbol}</p>
        <p className="text-xs text-muted-foreground">{item.quantity} units</p>
      </div>
      <div className="text-right flex flex-col items-end">
        <p className="font-semibold text-sm">${(item.quantity * currentPrice).toLocaleString()}</p>
        <p className={cn("text-xs font-medium mb-1", isPositive ? "text-primary" : "text-destructive")}>
          {isPositive ? '+' : ''}{profitLossPercent.toFixed(2)}%
        </p>
        {onTradeClick && (
          <button 
            onClick={() => onTradeClick(item.asset_symbol)}
            className="text-[10px] font-bold uppercase bg-muted hover:bg-muted/80 px-2 py-1 rounded-md transition-colors"
          >
            Trade
          </button>
        )}
      </div>
    </motion.div>
  );
}

export default function PortfolioPage() {
  const [activeTab, setActiveTab] = useState('all');
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  
  const { user, isLoadingAuth } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoadingAuth && !user) {
      navigate(createPageUrl('Home'));
    }
  }, [user, isLoadingAuth, navigate]);

  const { data: assets } = useQuery({
    queryKey: ['portfolio-assets'],
    queryFn: async () => {
      const { data, error } = await api.get<any[]>('/assets');
      if (error) throw error;
      return data;
    }
  });

  const { data: portfolio, isLoading, refetch: refetchPortfolio } = useQuery({
    queryKey: ['portfolio-items'],
    queryFn: async () => {
      const { data, error } = await api.get<any[]>('/portfolio');
      if (error) throw error;
      return data;
    },
    enabled: !!user,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const { data: wallets, refetch: refetchWallets } = useQuery({
    queryKey: ['wallets'],
    queryFn: async () => {
      const { data, error } = await api.get<any[]>('/wallets');
      if (error) throw error;
      return data;
    },
    enabled: !!user
  });

  const holdingWallet = wallets?.find((w: any) => w.currency === 'holding') || { available_balance: 0 };
  const currentPosition = portfolio?.find((p: any) => p.asset_symbol === selectedAsset?.symbol);

  // Calculate portfolio metrics
  const calculateMetrics = () => {
    if (!portfolio || !assets) return { totalValue: 0, totalInvested: 0, profitLoss: 0, profitLossPercent: 0 };

    let totalValue = 0;
    let totalInvested = 0;

    portfolio.forEach((holding: any) => {
      const asset = assets.find((a: any) => a.symbol === holding.asset_symbol);
      const currentPrice = asset?.price || holding.avg_buy_price;
      totalValue += holding.quantity * currentPrice;
      totalInvested += holding.total_invested || 0;
    });

    return {
      totalValue,
      totalInvested,
      profitLoss: totalValue - totalInvested,
      profitLossPercent: totalInvested > 0 ? ((totalValue - totalInvested) / totalInvested) * 100 : 0
    };
  };

  const metrics = calculateMetrics();
  const isPositive = metrics.profitLoss >= 0;

  // Filter portfolio by type
  const filteredPortfolio = portfolio?.filter((item: any) => {
    if (activeTab === 'all') return true;
    return item.asset_type === activeTab;
  }) || [];

  // Prepare allocation data for chart
  const allocationData = portfolio?.map((item: any) => {
    const asset = assets?.find((a: any) => a.symbol === item.asset_symbol);
    const currentPrice = asset?.price || item.avg_buy_price;
    return {
      name: item.asset_symbol,
      value: item.quantity * currentPrice
    };
  }) || [];

  const tabs = [
    { id: 'all', label: 'All' },
    { id: 'stock', label: 'Stocks' },
    { id: 'crypto', label: 'Crypto' },
  ];

  const handleTradeClick = (assetSymbol: string) => {
    const asset = assets?.find((a: any) => a.symbol === assetSymbol);
    if (asset) {
      setSelectedAsset(asset);
      setIsTradeModalOpen(true);
    }
  };

  const handleTrade = async (trade: any) => {
    const toastId = toast.loading(trade.type === 'buy' ? 'Buying...' : 'Selling...');
    try {
      if (trade.type === 'buy') {
        const { error } = await api.post('/portfolio/buy', {
          asset_symbol: trade.asset.symbol,
          asset_name: trade.asset.name,
          asset_type: trade.asset.type,
          quantity: trade.quantity,
          price_per_unit: trade.price,
        });
        if (error) throw error;
        toast.success(`Bought ${trade.quantity.toFixed(6)} ${trade.asset.symbol}!`, { id: toastId });
      } else {
        const { error } = await api.post('/portfolio/sell', {
          asset_symbol: trade.asset.symbol,
          quantity: trade.quantity,
        });
        if (error) throw error;
        toast.success(`Sold ${trade.quantity.toFixed(6)} ${trade.asset.symbol}!`, { id: toastId });
      }
      refetchPortfolio();
      refetchWallets();
    } catch (err: any) {
      toast.error(err.message || 'Trade failed', { id: toastId });
    }
  };

  return (
    <div className="min-h-screen pb-32 md:pb-8 bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-30 backdrop-blur-xl border-b bg-background/95 border-border pt-safe">
        <div className="px-4 py-4">
          <h1 className="font-bold text-2xl">Portfolio</h1>
        </div>
      </header>

      <div className="px-4 py-4 space-y-6">
        {/* Portfolio Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 rounded-3xl bg-card border border-border"
        >
          <div className="text-center mb-6">
            <p className="text-sm text-muted-foreground mb-1">Total Portfolio Value</p>
            <AnimatedNumber
              value={metrics.totalValue}
              prefix="$"
              decimals={2}
              className="text-4xl font-bold"
            />
            <div className="flex items-center justify-center gap-1 mt-2 font-medium" style={{ color: isPositive ? 'var(--color-primary)' : 'var(--color-destructive)' }}>
              {isPositive ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
              <span className="text-sm font-medium">
                {isPositive ? '+' : ''}{metrics.profitLossPercent.toFixed(2)}%
                ({isPositive ? '+' : ''}${Math.abs(metrics.profitLoss).toFixed(2)})
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-muted/50">
              <p className="text-xs text-muted-foreground mb-1">Total Invested</p>
              <p className="text-lg font-semibold">
                ${metrics.totalInvested.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className={cn("p-4 rounded-2xl", isPositive ? "bg-primary/10" : "bg-destructive/10")}>
              <p className="text-xs text-muted-foreground mb-1">Profit/Loss</p>
              <p className={cn("text-lg font-semibold", isPositive ? "text-primary" : "text-destructive")}>
                {isPositive ? '+' : ''}${metrics.profitLoss.toFixed(2)}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Allocation Chart */}
        {allocationData.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-6 rounded-3xl bg-card border border-border"
          >
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-semibold">Allocation</h3>
            </div>
            <AllocationChart data={allocationData} />
          </motion.div>
        )}

        {/* Holdings */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg">Holdings</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => refetchPortfolio()}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                title="Refresh holdings"
              >
                <RefreshCw className="h-4 w-4 text-muted-foreground" />
              </button>
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                    activeTab === tab.id
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
            </div>
          ) : filteredPortfolio.length === 0 ? (
            <div className="text-center py-12 bg-card rounded-3xl border border-border">
              <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-2">No holdings yet</p>
              <p className="text-sm text-muted-foreground">
                Start trading to build your portfolio
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredPortfolio.map((item: any, index: number) => {
                const asset = assets?.find((a: any) => a.symbol === item.asset_symbol);
                return (
                  <PortfolioItem
                    key={item.id}
                    item={item}
                    currentPrice={asset?.price || item.avg_buy_price}
                    index={index}
                    onTradeClick={handleTradeClick}
                    logoUrl={asset?.logo_url}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      <TradeModal
        asset={selectedAsset}
        isOpen={isTradeModalOpen}
        onClose={() => {
          setIsTradeModalOpen(false);
          setSelectedAsset(null);
        }}
        onTrade={handleTrade}
        balance={holdingWallet.available_balance || 0}
        currentPosition={currentPosition}
      />
    </div>
  );
}