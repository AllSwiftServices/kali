import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import AssetIcon from '@/components/common/AssetIcon';

interface SparklineProps {
  data: any[];
}

function Sparkline({ data }: SparklineProps) {
  // Vibrant Crypto.com blue line chart matching target mockup
  return (
    <div className="w-20 h-10">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line 
            type="monotone" 
            dataKey="v" 
            stroke="#0082FF" 
            strokeWidth={2} 
            dot={false} 
            isAnimationActive={false} 
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function makeSparkData(isPositive: boolean) {
  let v = 100;
  return Array.from({ length: 14 }, () => {
    v += (Math.random() - (isPositive ? 0.4 : 0.6)) * 4;
    return { v: parseFloat(v.toFixed(2)) };
  });
}

interface TopMoversProps {
  assets?: any[];
  onAssetClick?: (asset: any) => void;
  onSeeAll?: () => void;
}

export default function TopMovers({ assets, onAssetClick, onSeeAll }: TopMoversProps) {
  const favoritesList = [...(assets || [])]
    .sort((a, b) => Math.abs(b.change_percent ?? 0) - Math.abs(a.change_percent ?? 0))
    .slice(0, 5)
    .map(a => ({
      ...a,
      sparkData: makeSparkData((a.change_percent ?? 0) >= 0),
    }));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-lg text-white tracking-tight">Favourites</h2>
        <button
          onClick={onSeeAll}
          className="text-xs font-semibold text-[#0082FF] hover:underline"
        >
          See All
        </button>
      </div>

      <div className="space-y-3">
        {favoritesList.map((asset, i) => {
          const isPositive = (asset.change_percent ?? 0) >= 0;
          return (
            <motion.button
              key={asset.id || asset.symbol}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => onAssetClick?.(asset)}
              className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-[#10192A]/90 border border-white/5 shadow-md hover:border-sky-500/30 transition-all text-left group"
            >
              {/* Asset Info */}
              <div className="flex items-center gap-3 min-w-[130px]">
                <AssetIcon symbol={asset.symbol} logoUrl={asset.logo_url} size="md" />
                <div className="min-w-0">
                  <p className="font-bold text-sm text-white truncate group-hover:text-[#0082FF] transition-colors">
                    {asset.name}
                  </p>
                  <p className="text-xs font-medium text-slate-400 uppercase">
                    {asset.symbol}
                  </p>
                </div>
              </div>

              {/* Center Sparkline Graph */}
              <div className="flex-1 flex justify-center px-2">
                <Sparkline data={asset.sparkData} />
              </div>

              {/* Price & Delta */}
              <div className="text-right min-w-[90px] shrink-0">
                <p className="text-sm font-bold text-white tracking-tight">
                  ${asset.price?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: asset.price < 1 ? 5 : 2 })}
                </p>
                <p className={cn('text-xs font-bold mt-0.5', isPositive ? 'text-[#00E676]' : 'text-red-400')}>
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