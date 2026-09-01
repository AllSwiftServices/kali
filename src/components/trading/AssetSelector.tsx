import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import AssetIcon from '@/components/common/AssetIcon';

const ASSETS: any[] = [];

export default function AssetSelector({ 
  selected, 
  onChange, 
  assets: customAssets 
}: { 
  selected: any, 
  onChange: (asset: any) => void,
  assets?: any[]
}) {
  const assetsToUse = customAssets || ASSETS;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = assetsToUse.filter(a =>
    a.symbol.toLowerCase().includes(query.toLowerCase()) ||
    a.name.toLowerCase().includes(query.toLowerCase())
  );

  const displayName = selected?.type === 'crypto' ? (selected?.pair || `${selected?.symbol}/USDT`) : selected?.symbol;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl transition-all',
          'bg-muted/60 hover:bg-muted border border-border/50',
          'text-left font-semibold'
        )}
      >
        <AssetIcon symbol={selected?.symbol || ''} logoUrl={selected?.logo_url} size="sm" className="rounded-lg" />
        <span className="text-sm sm:text-base">{displayName}</span>
        <ChevronDown className={cn('h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className={cn(
              'absolute top-full left-0 mt-2 w-[calc(100vw-2rem)] sm:w-64 z-50',
              'bg-card border border-border rounded-2xl shadow-2xl overflow-hidden'
            )}
          >
            <div className="p-2 border-b border-border">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  autoFocus
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search..."
                  className="w-full pl-9 pr-3 py-2 text-sm bg-muted rounded-xl outline-none"
                />
              </div>
            </div>
            <div className="max-h-56 overflow-y-auto p-2 space-y-0.5">
              {['stock', 'crypto'].map(type => {
                const group = filtered.filter(a => a.type === type);
                if (!group.length) return null;
                return (
                  <div key={type}>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase px-2 py-1">
                      {type === 'stock' ? 'Stocks' : 'Crypto'}
                    </p>
                    {group.map(asset => (
                      <button
                        key={asset.symbol}
                        onClick={() => { onChange(asset); setOpen(false); setQuery(''); }}
                        className={cn(
                          'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors',
                          'hover:bg-muted',
                          selected?.symbol === asset.symbol && 'bg-primary/10 text-primary'
                        )}
                      >
                        <AssetIcon symbol={asset.symbol} logoUrl={asset.logo_url} size="sm" />
                        <div>
                          <p className="font-semibold text-sm">{asset.name}</p>
                          <p className="text-xs text-muted-foreground">{asset.pair || asset.symbol}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}