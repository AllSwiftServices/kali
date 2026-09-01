"use client";

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, ChevronDown, ChevronLeft, ChevronRight,
  BookOpen, TrendingUp, Wallet, User, Shield, MessageCircle, Zap
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useNavigate } from '@/lib/react-router-shim';

const CATEGORIES = [
  { key: 'getting-started', label: 'Getting Started', icon: BookOpen, color: 'bg-primary/10 text-primary' },
  { key: 'trading',         label: 'Trading',         icon: TrendingUp, color: 'bg-success/10 text-success' },
  { key: 'deposits',        label: 'Deposits & Withdrawals', icon: Wallet, color: 'bg-blue-500/10 text-blue-500' },
  { key: 'account',         label: 'Account',         icon: User, color: 'bg-purple-500/10 text-purple-500' },
  { key: 'security',        label: 'Security',        icon: Shield, color: 'bg-destructive/10 text-destructive' },
];

function ArticleCard({ article }: { article: any }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={cn(
        'border-b border-border last:border-0 transition-colors',
        open && 'bg-muted/20'
      )}
    >
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <span className="font-semibold text-sm pr-4">{article.title}</span>
        <ChevronDown className={cn('h-4 w-4 text-muted-foreground flex-shrink-0 transition-transform', open && 'rotate-180')} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed">{article.body}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function HelpCenterPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const { data: articles = [], isLoading } = useQuery({
    queryKey: ['help-articles'],
    queryFn: async () => {
      const { data } = await api.get<any>('/help-articles');
      return data?.data || [];
    }
  });

  const filtered = useMemo(() => {
    let items = articles;
    if (activeCategory) items = items.filter((a: any) => a.category === activeCategory);
    if (search.trim()) items = items.filter((a: any) =>
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.body.toLowerCase().includes(search.toLowerCase())
    );
    return items;
  }, [articles, activeCategory, search]);

  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {};
    filtered.forEach((a: any) => {
      if (!map[a.category]) map[a.category] = [];
      map[a.category].push(a);
    });
    return map;
  }, [filtered]);

  return (
    <div className="min-h-screen pb-32 md:pb-8 bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-30 backdrop-blur-xl border-b bg-background/95 border-border">
        <div className="px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-muted transition-colors">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="font-bold text-xl">Help Center</h1>
        </div>
      </header>

      <div className="px-4 py-6 space-y-6 max-w-2xl mx-auto">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl bg-primary p-6 text-white shadow-xl shadow-primary/20"
        >
          <Zap className="h-8 w-8 mb-3 opacity-80" />
          <h2 className="text-2xl font-black mb-1">How can we help?</h2>
          <p className="text-sm opacity-75 mb-4">Search our knowledge base or browse categories below.</p>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-black/50" />
            <input
              type="text"
              placeholder="Search articles..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-2xl bg-white/20 placeholder:text-black/50 text-black font-medium text-sm outline-none focus:bg-white/30 transition-all"
            />
          </div>
        </motion.div>

        {/* Category Pills */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          <button
            onClick={() => setActiveCategory(null)}
            className={cn(
              'flex-shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all',
              !activeCategory ? 'bg-primary text-black shadow-md shadow-primary/20' : 'bg-muted text-muted-foreground hover:text-foreground'
            )}
          >
            All
          </button>
          {CATEGORIES.map(cat => (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(activeCategory === cat.key ? null : cat.key)}
              className={cn(
                'flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all',
                activeCategory === cat.key ? 'bg-primary text-black shadow-md shadow-primary/20' : 'bg-muted text-muted-foreground hover:text-foreground'
              )}
            >
              <cat.icon className="h-3 w-3" />
              {cat.label}
            </button>
          ))}
        </div>

        {/* Articles */}
        {isLoading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-14 rounded-2xl bg-muted animate-pulse" />)}
          </div>
        ) : Object.keys(grouped).length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <Search className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-bold">No articles found</p>
            <p className="text-sm mt-1">Try a different search or category</p>
          </div>
        ) : (
          <div className="space-y-4">
            {CATEGORIES.filter(c => grouped[c.key]?.length > 0).map(cat => (
              <motion.div
                key={cat.key}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-3xl bg-card border border-border overflow-hidden"
              >
                <div className={cn('flex items-center gap-3 px-5 py-3 border-b border-border', 'bg-muted/30')}>
                  <div className={cn('h-7 w-7 rounded-lg flex items-center justify-center', cat.color)}>
                    <cat.icon className="h-4 w-4" />
                  </div>
                  <h3 className="font-bold text-sm">{cat.label}</h3>
                  <span className="ml-auto text-[10px] font-bold text-muted-foreground">{grouped[cat.key].length} articles</span>
                </div>
                {grouped[cat.key].map((article: any) => (
                  <ArticleCard key={article.id} article={article} />
                ))}
              </motion.div>
            ))}
          </div>
        )}

        {/* CTA — Live Chat */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-3xl bg-card border border-border p-6 flex items-center gap-4"
        >
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <MessageCircle className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-sm">Still need help?</p>
            <p className="text-xs text-muted-foreground mt-0.5">Chat with our support team — we typically reply in minutes.</p>
          </div>
          <button
            onClick={() => navigate('/profile/chat')}
            className="flex-shrink-0 px-4 py-2.5 rounded-2xl bg-primary text-white font-bold text-xs shadow-lg shadow-primary/20 hover:opacity-90 transition-all"
          >
            Chat Now
          </button>
        </motion.div>
      </div>
    </div>
  );
}
