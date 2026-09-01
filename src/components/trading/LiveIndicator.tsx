import React from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function LiveIndicator({ soundOn, onToggleSound }: { soundOn: boolean, onToggleSound: () => void }) {
  return (
    <div className="flex items-center gap-1.5 sm:gap-3">
      <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-full bg-destructive/10 border border-destructive/20">
        <span className="relative flex h-1.5 w-1.5 sm:h-2 sm:w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 sm:h-2 sm:w-2 bg-destructive" />
        </span>
        <span className="text-[9px] sm:text-[11px] font-bold text-destructive tracking-wider">LIVE</span>
      </div>
      <button
        onClick={onToggleSound}
        className={cn(
          'p-1 sm:p-1.5 rounded-lg transition-colors',
          soundOn ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:bg-muted'
        )}
        title="Toggle sound"
      >
        {soundOn ? <Volume2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <VolumeX className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
      </button>
    </div>
  );
}