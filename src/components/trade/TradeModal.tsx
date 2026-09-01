import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import AssetIcon from '@/components/common/AssetIcon';

export default function TradeModal({ asset, isOpen, onClose, onTrade, balance = 0, currentPosition }: {
  asset: any,
  isOpen: boolean,
  onClose: () => void,
  onTrade: (trade: any) => void,
  balance?: number,
  currentPosition?: { quantity: number; avg_buy_price: number; total_invested: number } | null
}) {
  const [tradeType, setTradeType] = useState('buy');
  const [amount, setAmount] = useState('');
  const [step, setStep] = useState('input');

  if (!asset) return null;

  const numAmount = parseFloat(amount) || 0;
  const quantity = numAmount / (asset?.price || 1);
  const isPositive = asset.change_percent >= 0;
  const maxSellQty = currentPosition?.quantity || 0;
  // Fix: when selling, compare the requested quantity to the max quantity (with slight fp tolerance)
  const canAfford = tradeType === 'buy' ? numAmount <= balance : quantity <= (maxSellQty + 0.000001);

  const chartData = asset.price_history?.length > 0 
    ? asset.price_history 
    : generateChartData(asset.price, isPositive);

  const handleConfirm = () => {
    if (step === 'input' && numAmount > 0 && canAfford) {
      setStep('confirm');
    } else if (step === 'confirm') {
      onTrade({
        type: tradeType,
        asset,
        amount: numAmount,
        quantity,
        price: asset.price
      });
      setStep('success');
      setTimeout(() => {
        onClose();
        setStep('input');
        setAmount('');
      }, 2000);
    }
  };

  const quickActions = tradeType === 'buy' 
    ? [
        { label: '$100', value: 100 },
        { label: '$500', value: 500 },
        { label: '$1k', value: 1000 },
        { label: 'Max', value: balance }
      ]
    : [
        { label: '25%', value: (maxSellQty * 0.25) * (asset?.price || 0) },
        { label: '50%', value: (maxSellQty * 0.50) * (asset?.price || 0) },
        { label: '75%', value: (maxSellQty * 0.75) * (asset?.price || 0) },
        { label: 'Max', value: maxSellQty * (asset?.price || 0) }
      ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={cn(
              'fixed bottom-0 left-0 right-0 z-50 max-h-[90vh] overflow-y-auto',
              'bg-background rounded-t-3xl',
              'md:bottom-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2',
              'md:rounded-3xl md:max-w-md md:w-full'
            )}
          >
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <AssetIcon symbol={asset.symbol} logoUrl={asset.logo_url} size="lg" className="shadow-lg" />
                  <div>
                    <h2 className="font-bold text-lg">{asset.name}</h2>
                    <p className="text-sm text-muted-foreground">{asset.symbol}</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-full hover:bg-muted transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {step === 'input' && (
                <>
                  {/* Price Chart */}
                  <div className="h-40 mb-6">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <XAxis dataKey="time" hide />
                        <YAxis domain={['auto', 'auto']} hide />
                        <Tooltip 
                          contentStyle={{ 
                            background: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '12px',
                            boxShadow: '0 4px 6px -1px var(--color-primary-foreground)'
                          }}
                          formatter={(value: any) => [`$${parseFloat(value).toFixed(2)}`, 'Price']}
                        />
                        <Line
                          type="monotone"
                          dataKey="price"
                          stroke={isPositive ? 'var(--color-primary)' : 'var(--color-destructive)'}
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Current Price */}
                  <div className="text-center mb-6">
                    <p className="text-3xl font-bold">
                      ${asset.price?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className={cn(
                      'text-sm font-medium',
                      isPositive ? 'text-primary' : 'text-destructive'
                    )}>
                      {isPositive ? '↑' : '↓'} {Math.abs(asset.change_percent).toFixed(2)}% today
                    </p>
                  </div>

                  {/* Buy/Sell Toggle */}
                  <div className="flex gap-2 p-1 bg-muted rounded-2xl mb-6">
                    <button
                      onClick={() => setTradeType('buy')}
                      className={cn(
                        'flex-1 py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2',
                        tradeType === 'buy'
                          ? 'bg-primary text-primary-foreground shadow-lg'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <TrendingUp className="h-4 w-4" />
                      Buy
                    </button>
                    <button
                      onClick={() => setTradeType('sell')}
                      className={cn(
                        'flex-1 py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2',
                        tradeType === 'sell'
                          ? 'bg-destructive text-destructive-foreground shadow-lg'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <TrendingDown className="h-4 w-4" />
                      Sell
                    </button>
                  </div>

                  {/* Amount Input */}
                  <div className="mb-4">
                    <label className="text-sm text-muted-foreground mb-2 block">
                      Amount (USD)
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                        $
                      </span>
                      <Input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        className="pl-8 h-14 text-xl font-semibold rounded-2xl"
                      />
                    </div>
                    {numAmount > 0 && (
                      <p className="text-sm text-muted-foreground mt-2">
                        ≈ {quantity.toFixed(6)} {asset.symbol}
                      </p>
                    )}
                  </div>

                  {/* Quick Amounts */}
                  <div className="flex gap-2 mb-6">
                    {quickActions.map((action) => (
                      <button
                        key={action.label}
                        onClick={() => {
                          if (action.value > 0) {
                            // Convert to string without scientific notation or trailing zeros
                            setAmount(Number(action.value.toFixed(6)).toString());
                          }
                        }}
                        className={cn(
                          'flex-1 py-2 rounded-xl text-sm font-medium transition-all',
                          'bg-muted hover:bg-muted/80'
                        )}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>

                  {/* Balance / Position Info */}
                  <div className="space-y-2 mb-6 px-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {tradeType === 'buy' ? 'Holding Balance' : 'Your Position'}
                      </span>
                      <span className="font-medium">
                        {tradeType === 'buy'
                          ? `$${balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                          : `${maxSellQty.toFixed(6)} ${asset.symbol}`
                        }
                      </span>
                    </div>
                    {tradeType === 'sell' && currentPosition && (
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Avg buy price</span>
                        <span>${currentPosition.avg_buy_price.toFixed(2)}</span>
                      </div>
                    )}
                    {tradeType === 'sell' && !currentPosition && (
                      <p className="text-xs text-destructive">You don't hold any {asset.symbol}</p>
                    )}
                  </div>

                  {!canAfford && numAmount > 0 && (
                    <div className="flex items-center gap-2 p-3 mb-4 bg-destructive/10 text-destructive rounded-xl text-sm">
                      <AlertCircle className="h-4 w-4" />
                      {tradeType === 'buy' ? 'Insufficient balance' : `Insufficient ${asset.symbol} holdings`}
                    </div>
                  )}

                  <Button
                    onClick={handleConfirm}
                    disabled={numAmount <= 0 || !canAfford}
                    className={cn(
                      'w-full h-14 rounded-2xl font-semibold text-lg btn-press',
                      tradeType === 'buy'
                        ? 'bg-primary text-primary-foreground hover:opacity-90'
                        : 'bg-destructive text-destructive-foreground hover:opacity-90'
                    )}
                  >
                    {tradeType === 'buy' ? 'Buy' : 'Sell'} {asset.symbol}
                  </Button>
                </>
              )}

              {step === 'confirm' && (
                <div className="text-center py-6">
                  <h3 className="text-xl font-bold mb-6">Confirm Order</h3>
                  <div className="space-y-4 mb-8">
                    <div className="flex justify-between py-3 border-b border-border">
                      <span className="text-muted-foreground">Type</span>
                      <span className={cn('font-semibold', tradeType === 'buy' ? 'text-primary' : 'text-destructive')}>
                        {tradeType.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex justify-between py-3 border-b border-border">
                      <span className="text-muted-foreground">Amount</span>
                      <span className="font-semibold">${numAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between py-3 border-b border-border">
                      <span className="text-muted-foreground">Quantity</span>
                      <span className="font-semibold">{quantity.toFixed(6)} {asset.symbol}</span>
                    </div>
                    <div className="flex justify-between py-3">
                      <span className="text-muted-foreground">Price</span>
                      <span className="font-semibold">${asset.price.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setStep('input')}
                      className="flex-1 h-12 rounded-xl"
                    >
                      Back
                    </Button>
                    <Button
                      onClick={handleConfirm}
                      className={cn(
                        'flex-1 h-12 rounded-xl font-semibold btn-press',
                        tradeType === 'buy'
                          ? 'bg-primary text-primary-foreground hover:opacity-90'
                          : 'bg-destructive text-destructive-foreground hover:opacity-90'
                      )}
                    >
                      Confirm
                    </Button>
                  </div>
                </div>
              )}

              {step === 'success' && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-center py-12"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', delay: 0.2 }}
                    className={cn(
                      'w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center',
                      tradeType === 'buy' ? 'bg-primary' : 'bg-destructive'
                    )}
                  >
                    {tradeType === 'buy' ? (
                      <TrendingUp className="h-10 w-10 text-primary-foreground" />
                    ) : (
                      <TrendingDown className="h-10 w-10 text-destructive-foreground" />
                    )}
                  </motion.div>
                  <h3 className="text-2xl font-bold mb-2">Order Placed!</h3>
                  <p className="text-muted-foreground">
                    {tradeType === 'buy' ? 'Bought' : 'Sold'} {quantity.toFixed(6)} {asset.symbol}
                  </p>
                </motion.div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function generateChartData(currentPrice: number, isPositive: boolean) {
  const data = [];
  let price = currentPrice * (isPositive ? 0.95 : 1.05);
  
  for (let i = 0; i < 24; i++) {
    const change = (Math.random() - (isPositive ? 0.4 : 0.6)) * (currentPrice * 0.02);
    price = Math.max(currentPrice * 0.9, Math.min(currentPrice * 1.1, price + change));
    data.push({ time: `${i}:00`, price });
  }
  
  data.push({ time: '24:00', price: currentPrice });
  return data;
}