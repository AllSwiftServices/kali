"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, X, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastType = 'success' | 'error' | 'info' | 'loading';

interface CustomToastProps {
  message: string;
  type?: ToastType;
  description?: string;
  onClose?: () => void;
}

const icons = {
  success: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
  error: <AlertCircle className="h-5 w-5 text-rose-500" />,
  info: <Info className="h-5 w-5 text-blue-500" />,
  loading: <Zap className="h-5 w-5 text-amber-500 animate-pulse" />,
};

const colors = {
  success: "border-emerald-500/20 bg-emerald-500/5",
  error: "border-rose-500/20 bg-rose-500/5",
  info: "border-blue-500/20 bg-blue-500/5",
  loading: "border-amber-500/20 bg-amber-500/5",
};

export function CustomToast({ message, type = 'info', description, onClose }: CustomToastProps) {
  return (
    <div className={cn(
      "relative flex items-start gap-4 p-4 rounded-2xl border backdrop-blur-xl shadow-2xl min-w-[320px] max-w-[420px] transition-all duration-300",
      colors[type],
      "bg-card/80 border-border/50"
    )}>
      <div className="shrink-0 mt-0.5">
        {icons[type]}
      </div>
      
      <div className="flex-1 min-w-0 pr-6">
        <h3 className="text-sm font-bold text-foreground leading-tight">
          {message}
        </h3>
        {description && (
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            {description}
          </p>
        )}
      </div>

      <button 
        onClick={onClose}
        className="absolute top-3 right-3 p-1 rounded-lg hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>

      {/* Progress bar effect for auto-dismissible toasts could be added here */}
      <div 
        className={cn(
          "absolute bottom-0 left-0 h-1 bg-current opacity-20 rounded-full transition-all duration-4000 ease-linear",
          type === 'success' && "text-emerald-500",
          type === 'error' && "text-rose-500",
          type === 'info' && "text-blue-500",
          type === 'loading' && "text-amber-500"
        )}
        style={{ width: '100%' }}
      />
    </div>
  );
}
