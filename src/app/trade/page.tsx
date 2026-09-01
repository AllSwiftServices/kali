"use client";

import React, { useState } from 'react';
import AiTradingView from '@/components/trading/AiTradingView';
import LiveTradingView from '@/components/trading/LiveTradingView';
import { cn } from '@/lib/utils';
import { Zap, BarChart2 } from 'lucide-react';

export default function TradePage() {
  const [activeView, setActiveView] = useState<'ai' | 'live'>('ai');

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Global Trade Navigation Tab */}
      <div className="sticky top-0 z-40 bg-background border-b border-border shadow-sm">
        <div className="flex items-center justify-center p-2 sm:p-3">
          <div className="flex items-center bg-muted/50 p-1 rounded-2xl border border-border/50 w-full sm:w-auto overflow-x-auto no-scrollbar justify-start sm:justify-center">
            <button
              onClick={() => setActiveView('ai')}
              className={cn(
                "flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all min-w-fit shrink-0",
                activeView === 'ai'
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <Zap className="h-4 w-4" /> AI Trading
            </button>
            <button
              onClick={() => setActiveView('live')}
              className={cn(
                "flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all min-w-fit shrink-0",
                activeView === 'live'
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <BarChart2 className="h-4 w-4" /> Live Trading
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 w-full mx-auto pb-safe">
        {activeView === 'ai' 
          ? <AiTradingView onViewChange={setActiveView} /> 
          : <LiveTradingView onViewChange={setActiveView} />
        }
      </div>
    </div>
  );
}
