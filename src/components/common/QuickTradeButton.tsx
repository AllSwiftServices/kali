import React from 'react';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickTradeButtonProps {
  onClick?: () => void;
}

export default function QuickTradeButton({ onClick }: QuickTradeButtonProps) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={cn(
        'fixed right-4 bottom-24 md:bottom-8 z-30',
        'w-14 h-14 rounded-full',
        'bg-primary',
        'text-primary-foreground shadow-lg shadow-primary/30',
        'flex items-center justify-center',
        'hover:shadow-xl hover:shadow-primary/40 transition-shadow'
      )}
    >
      <Plus className="h-6 w-6" />
    </motion.button>
  );
}