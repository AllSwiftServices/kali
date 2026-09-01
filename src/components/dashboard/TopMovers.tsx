import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import AssetIcon from '@/components/common/AssetIcon';

interface SparklineProps {
  data: any[];
  isPositive: boolean;
}

function Sparkline({ data, isPositive }: SparklineProps) {
  // Sparkline needs hex for SVG stroke
  const color = isPositive ? 'var(--color-primary)' : 'var(--color-destructive)';
  return (
    <div className="w-16 h-8">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function makeSparkData(isPositive: boolean) {
  let v = 100;
  return Array.from({ length: 12 }, () => {
    v += (Math.random() - (isPositive ? 0.42 : 0.58)) * 4;
    return { v: parseFloat(v.toFixed(2)) };
  });
}

interface TopMoversProps {
  assets?: any[];
  onAssetClick?: (asset: any) => void;
}

export default function TopMovers({ assets, onAssetClick }: TopMoversProps) {
  const movers = [...(assets || [])]
    .sort((a, b) => Math.abs(b.change_percent ?? 0) - Math.abs(a.change_percent ?? 0))
    .slice(0, 6)
    .map(a => ({
      ...a,
      sparkData: makeSparkData(a.change_percent >= 0),
    }));

  return (
    <div>
      <p className="font-bold text-base mb-3 text-foreground">Top Movers</p>
      <div>
        {movers.map((asset, i) => {
          const isPositive = asset.change_percent >= 0;
          return (
            <motion.button
              key={asset.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => onAssetClick?.(asset)}
              className="w-full flex items-center gap-3 px-2 py-3.5 rounded-2xl hover:bg-muted/30 transition-colors text-left"
            >
              {/* Icon */}
              <AssetIcon symbol={asset.symbol} logoUrl={asset.logo_url} />

              {/* Name */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-foreground">{asset.name}</p>
                <p className="text-xs truncate text-muted-foreground">{asset.symbol}</p>
              </div>

              {/* Sparkline */}
              <Sparkline data={asset.sparkData} isPositive={isPositive} />

              {/* Change */}
              <div className="text-right w-16 shrink-0">
                <p className="text-sm font-semibold text-foreground">
                  ${asset.price?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className={cn('text-xs font-bold', isPositive ? 'text-primary' : 'text-destructive')}>
                  {isPositive ? '+' : ''}{asset.change_percent?.toFixed(2)}%
                </p>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}