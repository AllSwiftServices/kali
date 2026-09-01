"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Send, MessageCircle, CheckCircle, X, RefreshCcw } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { useNavigate } from '@/lib/react-router-shim';
import { createPageUrl } from '@/utils';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2 mb-3">
      <img src="/icon.png" alt="Crypto.com Support" className="h-8 w-8 rounded-full object-contain shadow flex-shrink-0" />
      <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            className="w-2 h-2 rounded-full bg-muted-foreground/50"
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ msg, userName }: { msg: any; userName: string }) {
  const isUser = msg.sender_role === 'user';
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex items-end gap-2 mb-3', isUser ? 'flex-row-reverse' : 'flex-row')}
    >
      {/* Avatar */}
      {!isUser && (
        <img src="/icon.png" alt="Crypto.com Support" className="h-8 w-8 rounded-full object-contain shadow flex-shrink-0" />
      )}
      {isUser && (
        <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 text-xs font-black text-primary">
          {userName.charAt(0).toUpperCase()}
        </div>
      )}

      {/* Bubble */}
      <div className={cn(
        'max-w-[75%] px-4 py-2.5 text-sm leading-relaxed',
        isUser
          ? 'bg-primary/10 text-foreground rounded-2xl rounded-tr-sm'
          : 'bg-muted text-foreground rounded-2xl rounded-tl-sm'
      )}>
        {!isUser && (
          <p className="text-[10px] font-black text-primary uppercase tracking-wider mb-1">Support</p>
        )}
        <p className="whitespace-pre-wrap">{msg.body}</p>
        <p className="text-[9px] text-muted-foreground mt-1 text-right">
          {msg.created_at ? format(new Date(msg.created_at), 'HH:mm') : ''}
        </p>
      </div>
    </motion.div>
  );
}

export default function LiveChatPage() {
  const { user, isLoadingAuth } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState('');
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [showTyping, setShowTyping] = useState(false);

  useEffect(() => {
    if (!isLoadingAuth && !user) navigate(createPageUrl('Home'));
  }, [user, isLoadingAuth, navigate]);

  // Fetch user's conversations
  const { data: conversations = [], isLoading: loadingConvs } = useQuery({
    queryKey: ['support-conversations'],
    queryFn: async () => {
      const { data } = await api.get<any>('/support/conversations');
      return data?.data || [];
    },
    enabled: !!user,
  });

  // Auto-resume most recent open conversation
  useEffect(() => {
    if (conversations.length > 0 && !activeConvId) {
      const open = conversations.find((c: any) => c.status === 'open');
      if (open) setActiveConvId(open.id);
    }
  }, [conversations, activeConvId]);

  const activeConv = (conversations as any[]).find((c: any) => c.id === activeConvId);

  // Fetch messages for active conversation
  const { data: messages = [], isLoading: loadingMsgs } = useQuery({
    queryKey: ['support-messages', activeConvId],
    queryFn: async () => {
      const { data } = await api.get<any>(`/support/conversations/${activeConvId}/messages`);
      return data?.data || [];
    },
    enabled: !!activeConvId,
    refetchInterval: 5000,
  });

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, showTyping]);

  // Start conversation + send first message
  const startConvMutation = useMutation({
    mutationFn: async (message: string) => {
      const { data } = await api.post<any>('/support/conversations', { message });
      return data;
    },
    onSuccess: (conv) => {
      setActiveConvId(conv.id);
      queryClient.invalidateQueries({ queryKey: ['support-conversations'] });
      queryClient.invalidateQueries({ queryKey: ['support-messages', conv.id] });
    },
  });

  // Send a message in existing conversation
  const sendMsgMutation = useMutation({
    mutationFn: async ({ convId, body }: { convId: string; body: string }) => {
      await api.post(`/support/conversations/${convId}/messages`, { body });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-messages', activeConvId] });
    },
  });

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    setShowTyping(false);

    if (!activeConvId) {
      await startConvMutation.mutateAsync(text);
    } else {
      await sendMsgMutation.mutateAsync({ convId: activeConvId, body: text });
    }
  }, [input, activeConvId, startConvMutation, sendMsgMutation]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const userName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'You';
  const isSending = startConvMutation.isPending || sendMsgMutation.isPending;
  const isClosed = activeConv?.status === 'closed';

  return (
    <div className="h-dvh flex flex-col bg-background text-foreground overflow-hidden">
      {/* Header */}
      <header className="sticky top-0 z-30 backdrop-blur-xl border-b bg-background/95 border-border px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-muted transition-colors">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <img src="/icon.png" alt="Crypto.com Support" className="h-10 w-10 rounded-full object-contain shadow flex-shrink-0" />
          <div>
            <p className="font-bold text-sm leading-none">Crypto.com Support</p>
            <div className="flex items-center gap-1.5 mt-1">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span className="text-[10px] text-muted-foreground font-medium">Online · Typically replies in minutes</span>
            </div>
          </div>
        </div>
        <button
          onClick={() => navigate('/help-center')}
          className="p-2 rounded-xl hover:bg-muted transition-colors"
        >
          <MessageCircle className="h-5 w-5 text-muted-foreground" />
        </button>
      </header>

      {/* Messages Area — flex-1 scrolls, pushes input to bottom */}
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-2">
        {/* Welcome Message */}
        {(messages as any[]).length === 0 && !loadingMsgs && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-end gap-2 mb-3"
          >
            <img src="/icon.png" alt="Crypto.com Support" className="h-8 w-8 rounded-full object-contain shadow flex-shrink-0" />
            <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 max-w-[75%]">
              <p className="text-[10px] font-black text-primary uppercase tracking-wider mb-1">Support</p>
              <p className="text-sm">
                👋 Hi {userName}! Welcome to Crypto.com support. How can we help you today?
              </p>
            </div>
          </motion.div>
        )}

        {loadingMsgs && (
          <div className="flex justify-center py-8">
            <RefreshCcw className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Render messages */}
        {(messages as any[]).map((msg: any) => (
          <MessageBubble key={msg.id} msg={msg} userName={userName} />
        ))}

        {showTyping && <TypingIndicator />}

        {/* Closed indicator */}
        {isClosed && (
          <div className="text-center py-4">
            <span className="text-[10px] font-bold text-muted-foreground bg-muted px-3 py-1 rounded-full uppercase tracking-wider">
              Conversation closed
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar — sits naturally at the bottom of the flex column */}
      <div className="shrink-0 border-t border-border bg-background/95 backdrop-blur-xl px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] md:pb-3">
        {isClosed ? (
          <button
            onClick={() => {
              setActiveConvId(null);
              queryClient.invalidateQueries({ queryKey: ['support-conversations'] });
            }}
            className="w-full py-3 rounded-2xl bg-primary text-white font-bold text-sm shadow-lg shadow-primary/20 hover:opacity-90 transition-all"
          >
            Start New Conversation
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className="flex-1 h-12 px-4 rounded-2xl bg-muted/50 border border-border text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              disabled={isSending}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isSending}
              className={cn(
                'h-12 w-12 rounded-2xl flex items-center justify-center transition-all',
                input.trim() && !isSending
                  ? 'bg-primary text-white shadow-lg shadow-primary/20 hover:opacity-90'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              {isSending ? (
                <RefreshCcw className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
