import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import MiniChart from '../common/MiniChart';
import AssetIcon from '../common/AssetIcon';

export default function AssetCard({ asset, onClick, index = 0 }: { asset: any, onClick: () => void, index?: number }) {
  const isPositive = asset.change_percent >= 0;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className={cn(
        'flex items-center justify-between p-4 rounded-2xl cursor-pointer',
        'hover:bg-muted/30 transition-colors duration-200'
      )}
    >
      <div className="flex items-center gap-3">
        <AssetIcon symbol={asset.symbol} logoUrl={asset.logo_url} size="lg" className="shadow-lg shadow-primary/20" />
        <div>
          <h3 className="font-semibold text-foreground">{asset.name}</h3>
          <p className="text-sm text-muted-foreground truncate max-w-[120px]">
            {asset.symbol}
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <MiniChart 
          data={asset.price_history} 
          isPositive={isPositive}
        />
        <div className="text-right min-w-[80px]">
          <p className="font-semibold text-foreground">
            ${asset.price?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className={cn(
            'text-sm font-semibold',
            isPositive ? 'text-success' : 'text-destructive'
          )}>
            {isPositive ? '+' : ''}{asset.change_percent?.toFixed(2)}%
          </p>
        </div>
      </div>
    </motion.div>
  );
}