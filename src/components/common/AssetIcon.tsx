"use client";

import { useState } from 'react';
import { cn } from '@/lib/utils';

// Real-world brand colors for well-known assets (industry-standard, used by
// every exchange). Anything not listed falls back to a deterministic hash
// color so a list of unlisted assets still reads as visually distinct
// rather than uniform.
const ASSET_COLORS: Record<string, string> = {
  BTC: '#F7931A', ETH: '#627EEA', USDT: '#26A17B', USDC: '#2775CA',
  BNB: '#F0B90B', SOL: '#14F195', XRP: '#25A768', ADA: '#0033AD',
  DOGE: '#C2A633', AVAX: '#E84142', TRX: '#EF0027', LINK: '#2A5ADA',
  DOT: '#E6007A', SHIB: '#FFA409', TON: '#0098EA', SUI: '#4DA2FF',
};
const FALLBACK_PALETTE = ['#0D9488', '#0891B2', '#7C3AED', '#DB2777', '#EA580C', '#65A30D'];

function colorFor(symbol: string) {
  if (ASSET_COLORS[symbol]) return ASSET_COLORS[symbol];
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
  return FALLBACK_PALETTE[Math.abs(hash) % FALLBACK_PALETTE.length];
}

const SIZE_CLASSES: Record<string, string> = {
  sm: 'w-7 h-7 text-[10px]',
  md: 'w-9 h-9 text-xs',
  lg: 'w-12 h-12 text-sm',
};

interface AssetIconProps {
  symbol: string;
  logoUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Real logo when we have one (crypto via CoinGecko, stocks via Financial
 * Modeling Prep's ticker-keyed image endpoint) — falls back to a colored
 * letter avatar for anything without a logo_url, or if the image 404s.
 * Shared across dashboard favorites, Markets, Trade, and Portfolio so all
 * four stay visually consistent.
 */
export default function AssetIcon({ symbol, logoUrl, size = 'md', className }: AssetIconProps) {
  const [failed, setFailed] = useState(false);
  const sizeClass = SIZE_CLASSES[size];

  if (logoUrl && !failed) {
    return (
      <img
        src={logoUrl}
        alt={symbol}
        className={cn(sizeClass, 'rounded-full shrink-0 object-cover bg-muted', className)}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <div
      className={cn(sizeClass, 'rounded-full flex items-center justify-center font-bold shrink-0 text-white', className)}
      style={{ backgroundColor: colorFor(symbol) }}
    >
      {symbol.slice(0, 2)}
    </div>
  );
}
