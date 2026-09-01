import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

function generateOrders(basePrice: number, side: 'ask' | 'bid', count = 8) {
  const orders = [];
  let p = side === 'ask' ? basePrice * 1.0005 : basePrice * 0.9995;
  for (let i = 0; i < count; i++) {
    const qty = parseFloat((Math.random() * 5 + 0.1).toFixed(4));
    const total = (p * qty).toFixed(2);
    orders.push({ price: p.toFixed(2), qty: qty.toFixed(4), total });
    p = side === 'ask' ? p * (1 + Math.random() * 0.001) : p * (1 - Math.random() * 0.001);
  }
  return side === 'bid' ? orders.sort((a, b) => parseFloat(b.price) - parseFloat(a.price)) : orders;
}

export default function OrderBook({ price }: { price: number }) {
  const [bids, setBids] = useState<{ price: string; qty: string; total: string }[]>([]);
  const [asks, setAsks] = useState<{ price: string; qty: string; total: string }[]>([]);
  const [flash, setFlash] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setBids(generateOrders(price, 'bid', 8));
    setAsks(generateOrders(price, 'ask', 8));
  }, [price]);

  useEffect(() => {
    const interval = setInterval(() => {
      const idx = Math.floor(Math.random() * 8);
      const side = Math.random() > 0.5 ? 'bid' : 'ask';
      const key = `${side}-${idx}`;
      setFlash(f => ({ ...f, [key]: true }));
      setTimeout(() => setFlash(f => { const nf = { ...f }; delete nf[key]; return nf; }), 400);

      if (side === 'bid') {
        setBids(prev => prev.map((b, i) => i === idx
          ? { ...b, qty: Math.max(0.01, parseFloat(b.qty) + (Math.random() - 0.5) * 0.5).toFixed(4) }
          : b
        ));
      } else {
        setAsks(prev => prev.map((a, i) => i === idx
          ? { ...a, qty: Math.max(0.01, parseFloat(a.qty) + (Math.random() - 0.5) * 0.5).toFixed(4) }
          : a
        ));
      }
    }, 900);
    return () => clearInterval(interval);
  }, []);

  const maxQty = Math.max(...[...bids, ...asks].map(o => parseFloat(o.qty)));

  const Row = ({ order, side, idx }: { order: any, side: 'ask' | 'bid', idx: number }) => {
    const key = `${side}-${idx}`;
    const isFlashing = flash[key];
    const pct = (parseFloat(order.qty) / maxQty) * 100;
    const isGreen = side === 'bid';
    return (
      <motion.div
        className={cn(
          'relative flex items-center justify-between py-1.5 px-2 rounded-lg text-xs font-mono transition-colors',
          isFlashing && (isGreen ? 'bg-success/20' : 'bg-destructive/20')
        )}
      >
        <div
          className={cn('absolute inset-y-0 left-0 rounded-lg opacity-10', isGreen ? 'bg-success' : 'bg-destructive')}
          style={{ width: `${pct}%` }}
        />
        <span className={cn("font-semibold z-10", isGreen ? "text-success" : "text-destructive")}>
          {order.price}
        </span>
        <span className="text-muted-foreground z-10">{order.qty}</span>
        <span className="text-muted-foreground z-10">{order.total}</span>
      </motion.div>
    );
  };

  const spread = asks[0] && bids[0]
    ? (parseFloat(asks[0].price) - parseFloat(bids[0].price)).toFixed(2)
    : '—';

  return (
    <div className="rounded-3xl bg-card border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="font-bold text-sm">Order Book</h3>
      </div>
      <div className="p-3">
        {/* Header */}
        <div className="flex justify-between text-[10px] font-semibold text-muted-foreground uppercase px-2 mb-1">
          <span>Price</span><span>Qty</span><span>Total</span>
        </div>

        {/* Asks (sell orders) */}
        <div className="space-y-0.5 mb-2">
          {asks.slice(0, 6).reverse().map((o, i) => (
            <Row key={`ask-${i}`} order={o} side="ask" idx={5 - i} />
          ))}
        </div>

        {/* Spread */}
        <div className="flex items-center justify-between px-2 py-2 my-1 bg-muted/50 rounded-xl">
          <span className="text-xs font-bold tabular-nums">${price.toFixed(2)}</span>
          <span className="text-[10px] text-muted-foreground">Spread: ${spread}</span>
        </div>

        {/* Bids (buy orders) */}
        <div className="space-y-0.5 mt-2">
          {bids.slice(0, 6).map((o, i) => (
            <Row key={`bid-${i}`} order={o} side="bid" idx={i} />
          ))}
        </div>
      </div>
    </div>
  );
}