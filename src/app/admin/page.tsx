"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, CheckCircle, XCircle, Clock, Search, 
  ExternalLink, Eye, EyeOff, AlertCircle, FileText, 
  Shield, ArrowLeft, LayoutDashboard, Wallet, 
  TrendingUp, Settings, ChevronRight, Save,
  RefreshCcw, Filter, ArrowUpRight, ArrowDownRight,
  UserPlus, Mail, Phone, Calendar, MapPin,
  Zap, Bot, TrendingDown, BarChart3, MessageCircle, Send, X, Trash2
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { useNavigate } from '@/lib/react-router-shim';
import { createPageUrl } from '@/utils';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import AssetIcon from '@/components/common/AssetIcon';

type AdminTab = 'overview' | 'users' | 'deposits' | 'withdrawals' | 'kyc' | 'assets' | 'trades' | 'settings' | 'notifications' | 'support' | 'email';

interface UserData {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  kyc_status: string;
  created_at: string;
}

interface Deposit {
  id: string;
  user_id: string;
  user_email: string;
  amount: number;
  currency: string;
  address: string;
  receipt_url: string;
  tx_hash: string;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string;
  created_at: string;
}

interface KYCSubmission {
  id: string;
  user_id: string;
  user_email: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postal_code: string;
  id_type: string;
  id_number: string;
  id_front_image: string;
  id_back_image: string;
  selfie_image: string;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string;
  created_at: string;
}

interface Asset {
  id: string;
  symbol: string;
  name: string;
  type: string;
  price: number;
  change_percent: number;
  logo_url?: string | null;
  updated_at: string;
}

interface ManagedTrade {
  id: string;
  asset_symbol: string;
  asset_name: string;
  asset_type: string;
  profit_percent: number;
  min_amount: number;
  starts_at: string;
  ends_at: string;
  scope: 'all' | 'user';
  target_user_id?: string;
  status: 'active' | 'completed' | 'cancelled';
  signal_type?: 'call' | 'put';
  entry_price?: number;
  duration?: string;
  outcome?: 'win' | 'loss';
  created_at: string;
}

interface Withdrawal {
  id: string;
  user_id: string;
  wallet_id: string;
  amount: number;
  currency: string;
  network: string;
  address: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_feedback?: string;
  created_at: string;
  users?: {
    email: string;
    name: string;
  };
}

function SupportAdminPanel() {
  const [selectedConv, setSelectedConv] = React.useState<any>(null);
  const [replyText, setReplyText] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const { data: conversations = [], refetch: refetchConvs, isLoading } = useQuery({
    queryKey: ['admin-support-conversations'],
    queryFn: async () => {
      const { data } = await api.get<any>('/admin/support');
      return data?.data || [];
    },
    refetchInterval: 8000,
  });

  const { data: messages = [], refetch: refetchMsgs } = useQuery({
    queryKey: ['admin-support-messages', selectedConv?.id],
    queryFn: async () => {
      if (!selectedConv?.id) return [];
      const { data } = await api.get<any>(`/support/conversations/${selectedConv.id}/messages`);
      return data?.data || [];
    },
    enabled: !!selectedConv?.id,
    refetchInterval: 5000,
  });

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleReply = async () => {
    if (!replyText.trim() || !selectedConv?.id) return;
    setSending(true);
    try {
      await api.post(`/support/conversations/${selectedConv.id}/messages`, { body: replyText.trim() });
      setReplyText('');
      refetchMsgs();
    } catch (err: any) {
      toast.error(err.message || 'Failed to send reply');
    } finally {
      setSending(false);
    }
  };

  const handleClose = async (convId: string) => {
    try {
      await api.post(`/support/conversations/${convId}/close`, {});
      toast.success('Conversation closed');
      refetchConvs();
      if (selectedConv?.id === convId) setSelectedConv((prev: any) => ({ ...prev, status: 'closed' }));
    } catch (err: any) {
      toast.error(err.message || 'Failed to close');
    }
  };

  const openCount = (conversations as any[]).filter((c: any) => c.status === 'open').length;

  return (
    <motion.div
      key="support"
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
      className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 h-[calc(100vh-220px)] min-h-[500px]"
    >
      {/* Left: conversation list */}
      <div className="bg-card border border-border rounded-3xl overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="font-bold">Support Conversations</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{openCount} open</p>
          </div>
          <button onClick={() => refetchConvs()} className="p-2 rounded-xl hover:bg-muted transition-colors">
            <RefreshCcw className={cn('h-4 w-4 text-muted-foreground', isLoading && 'animate-spin')} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {(conversations as any[]).length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-12">
              <MessageCircle className="h-10 w-10 mb-2 opacity-20" />
              <p className="text-sm font-bold">No conversations yet</p>
            </div>
          ) : (
            (conversations as any[]).map((conv: any) => {
              const lastMsg = conv.support_messages?.slice(-1)[0];
              const isSelected = selectedConv?.id === conv.id;
              return (
                <div
                  key={conv.id}
                  onClick={() => setSelectedConv(conv)}
                  className={cn(
                    'px-5 py-4 border-b border-border/50 cursor-pointer transition-colors',
                    isSelected ? 'bg-primary/5' : 'hover:bg-muted/30'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sm truncate">{conv.users?.name || conv.users?.email || 'User'}</p>
                      <p className="text-xs text-muted-foreground truncate">{conv.users?.email}</p>
                      {lastMsg && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">{lastMsg.body}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={cn(
                        'text-[9px] font-black uppercase px-2 py-0.5 rounded-full',
                        conv.status === 'open' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
                      )}>
                        {conv.status}
                      </span>
                      {lastMsg && (
                        <span className="text-[9px] text-muted-foreground">
                          {format(new Date(lastMsg.created_at), 'HH:mm')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right: message thread */}
      <div className="bg-card border border-border rounded-3xl overflow-hidden flex flex-col">
        {!selectedConv ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <MessageCircle className="h-12 w-12 mb-3 opacity-20" />
            <p className="font-bold">Select a conversation</p>
            <p className="text-xs mt-1">Click a conversation on the left to view messages</p>
          </div>
        ) : (
          <>
            {/* Thread header */}
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div>
                <p className="font-bold text-sm">{selectedConv.users?.name || 'User'}</p>
                <p className="text-xs text-muted-foreground">{selectedConv.users?.email}</p>
              </div>
              {selectedConv.status === 'open' && (
                <button
                  onClick={() => handleClose(selectedConv.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-xs font-bold hover:bg-muted transition-colors"
                >
                  <X className="h-3.5 w-3.5" /> Close
                </button>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {(messages as any[]).map((msg: any) => {
                const isAdmin = msg.sender_role === 'admin';
                return (
                  <div key={msg.id} className={cn('flex', isAdmin ? 'justify-end' : 'justify-start')}>
                    <div className={cn(
                      'max-w-[70%] px-4 py-2.5 rounded-2xl text-sm',
                      isAdmin ? 'bg-primary/15 text-foreground rounded-tr-sm' : 'bg-muted text-foreground rounded-tl-sm'
                    )}>
                      {!isAdmin && <p className="text-[9px] font-black text-primary uppercase tracking-wider mb-1">User</p>}
                      {isAdmin && <p className="text-[9px] font-black text-primary uppercase tracking-wider mb-1">You (Admin)</p>}
                      <p className="whitespace-pre-wrap">{msg.body}</p>
                      <p className="text-[9px] text-muted-foreground text-right mt-1">
                        {format(new Date(msg.created_at), 'HH:mm')}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply form */}
            {selectedConv.status === 'open' ? (
              <div className="px-4 py-3 border-t border-border flex gap-2">
                <input
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply(); }}}
                  placeholder="Type a reply..."
                  className="flex-1 h-10 px-4 rounded-xl bg-muted/50 border border-border text-sm outline-none focus:ring-2 focus:ring-primary/20"
                />
                <button
                  onClick={handleReply}
                  disabled={!replyText.trim() || sending}
                  className="h-10 w-10 rounded-xl bg-primary text-white flex items-center justify-center disabled:opacity-50 hover:opacity-90 transition-all"
                >
                  {sending ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
            ) : (
              <div className="px-4 py-3 border-t border-border text-center">
                <span className="text-xs font-bold text-muted-foreground bg-muted px-3 py-1 rounded-full">Conversation closed</span>
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}

export default function AdminDashboard() {
  const { user, isLoadingAuth } = useAuth();
  const navigate = useNavigate();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Data states
  const [users, setUsers] = useState<UserData[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [kycSubmissions, setKycSubmissions] = useState<KYCSubmission[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [managedTrades, setManagedTrades] = useState<ManagedTrade[]>([]);
  
  // Selection states
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [selectedDeposit, setSelectedDeposit] = useState<Deposit | null>(null);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<Withdrawal | null>(null);
  const [selectedKYC, setSelectedKYC] = useState<KYCSubmission | null>(null);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);

  const [processing, setProcessing] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [balanceAdjust, setBalanceAdjust] = useState('');
  const [adjustWalletType, setAdjustWalletType] = useState<'holding' | 'trading'>('holding');
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [userTab, setUserTab] = useState<'overview'|'balances'|'holdings'|'edit'>('overview');
  const [userDetail, setUserDetail] = useState<any>(null);
  const [userDetailLoading, setUserDetailLoading] = useState(false);
  const [editForm, setEditForm] = useState<{ name: string; role: string; status: string }>({ name: '', role: '', status: '' });
  const [holdingAdjust, setHoldingAdjust] = useState<Record<string, { amount: string; loading: boolean }>>({});
  const [aiTradeSettings, setAiTradeSettings] = useState<{ mode: string; stats: any } | null>(null);
  const [aiModeLoading, setAiModeLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [newTrade, setNewTrade] = useState<Partial<ManagedTrade>>({
    asset_symbol: '',
    profit_percent: 10,
    min_amount: 10,
    scope: 'all',
    signal_type: 'call',
    outcome: 'win',
    ends_at: '' // Initialize as empty to avoid hydration mismatch, will set in useEffect
  });

  const [settings, setSettings] = useState<any[]>([]);
  const [notificationForm, setNotificationForm] = useState({ target: 'all', title: '', body: '' });
  const [emailForm, setEmailForm] = useState({ target: 'all', name: '', subject: '', body: '' });
  const [recipientType, setRecipientType] = useState<'platform' | 'external'>('platform');

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['overview', 'users', 'deposits', 'withdrawals', 'kyc', 'assets', 'trades', 'settings', 'notifications', 'support', 'email'].includes(tab)) {
      setActiveTab(tab as AdminTab);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!isLoadingAuth) {
      if (!user || user.role !== 'admin') {
        navigate(createPageUrl('Home'));
        return;
      }
      fetchAllData();
      // Initialize default trade date only on client to prevent hydration mismatch
      setNewTrade(prev => ({
        ...prev,
        ends_at: format(new Date(Date.now() + 86400000), "yyyy-MM-dd'T'HH:mm")
      }));
    }
  }, [user, isLoadingAuth, navigate]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [uRes, dRes, kRes, aRes, tRes, wRes, sRes] = await Promise.all([
        api.get<UserData[]>('/users'),
        api.get<Deposit[]>('/deposits'),
        api.get<KYCSubmission[]>('/kyc'),
        api.get<Asset[]>('/assets'),
        api.get<ManagedTrade[]>('/managed-trades'),
        api.get<Withdrawal[]>('/withdrawals'),
        api.get<any[]>('/admin/settings')
      ]);

      setUsers(uRes.data || []);
      setDeposits(dRes.data || []);
      setKycSubmissions(kRes.data || []);
      setAssets(aRes.data || []);
      setManagedTrades(tRes.data || []);
      setWithdrawals(wRes.data || []);
      setSettings(sRes.data || []);

      // Fetch AI trade settings
      const { data: aiData } = await api.get<any>('/admin/ai-trade-settings');
      if (aiData) setAiTradeSettings(aiData);
    } catch (err: any) {
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const openUserDetail = async (u: UserData) => {
    setSelectedUser(u);
    setUserTab('overview');
    setEditForm({ name: u.name || '', role: u.role || 'buyer', status: u.status || 'active' });
    setUserDetailLoading(true);
    setUserDetail(null);
    setHoldingAdjust({});
    try {
      const { data } = await api.get<any>(`/users/${u.id}`);
      setUserDetail(data);
    } catch (e) {
      console.error('Failed to load user detail', e);
    } finally {
      setUserDetailLoading(false);
    }
  };

  const handleAdjustHolding = async (holdingId: string, action: 'add' | 'reduce') => {
    const usd_amount = parseFloat(holdingAdjust[holdingId]?.amount || '');
    if (isNaN(usd_amount) || usd_amount <= 0) {
      toast.error('Enter a valid USD amount');
      return;
    }
    setHoldingAdjust(prev => ({ ...prev, [holdingId]: { ...prev[holdingId], loading: true } }));
    try {
      const { error } = await api.post('/portfolio/admin-adjust-holding', {
        user_id: selectedUser!.id,
        holding_id: holdingId,
        usd_amount,
        action,
      });
      if (error) throw error;
      toast.success(action === 'add' ? `$${usd_amount} added as profit` : `$${usd_amount} reduced as loss`);
      // Reload user detail to reflect updated holding
      const { data } = await api.get<any>(`/users/${selectedUser!.id}`);
      setUserDetail(data);
      setHoldingAdjust(prev => ({ ...prev, [holdingId]: { amount: '', loading: false } }));
    } catch (err: any) {
      toast.error(err.message || 'Failed to adjust holding');
      setHoldingAdjust(prev => ({ ...prev, [holdingId]: { ...prev[holdingId], loading: false } }));
    }
  };

  const handleUpdateDeposit = async (id: string, status: 'approved' | 'rejected') => {
    if (status === 'rejected' && !rejectReason) {
      toast.error("Please provide a rejection reason");
      return;
    }
    setProcessing(true);
    try {
      const { error } = await api.post(`/deposits/${id}`, { status, rejection_reason: rejectReason });
      if (error) throw error;
      toast.success(`Deposit ${status}`);
      setSelectedDeposit(null);
      setRejectReason("");
      fetchAllData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setProcessing(false);
    }
  };
  const handleUpdateWithdrawal = async (id: string, status: 'approved' | 'rejected') => {
    if (status === 'rejected' && !rejectReason) {
      toast.error("Please provide a rejection reason");
      return;
    }
    setProcessing(true);
    try {
      const { error } = await api.patch(`/withdrawals/${id}`, { status, admin_feedback: rejectReason });
      if (error) throw error;
      toast.success(`Withdrawal ${status}`);
      setSelectedWithdrawal(null);
      setRejectReason("");
      fetchAllData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleUpdateKYC = async (userId: string, status: 'approved' | 'rejected') => {
      if (status === 'rejected' && !rejectReason) {
          toast.error("Please provide a rejection reason");
          return;
      }
      setProcessing(true);
      try {
          const { error } = await api.post(`/kyc/${userId}`, { status, rejection_reason: rejectReason });
          if (error) throw error;
          toast.success(`KYC ${status}`);
          setSelectedKYC(null);
          setRejectReason("");
          fetchAllData();
      } catch (err: any) {
          toast.error(err.message);
      } finally {
          setProcessing(false);
      }
  };

  const handleUpdateUser = async (id: string, updates: Partial<UserData>) => {
      setProcessing(true);
      try {
          const { error } = await api.patch(`/users/${id}`, updates);
          if (error) throw error;
          toast.success("User updated");
          setSelectedUser(null);
          fetchAllData();
      } catch (err: any) {
          toast.error(err.message);
      } finally {
          setProcessing(false);
      }
  };

  const handleDeleteUser = async (id: string, email: string) => {
      if (!window.confirm(`Are you sure you want to PERMANENTLY delete user ${email}? This cannot be undone and will remove all their data.`)) {
          return;
      }
      setProcessing(true);
      try {
          const { error } = await api.delete(`/users/${id}`);
          if (error) throw error;
          toast.success("User deleted successfully");
          fetchAllData();
      } catch (err: any) {
          toast.error(err.message || "Failed to delete user");
      } finally {
          setProcessing(false);
      }
  };

  const handleAdjustBalance = async (userId: string, direction: 'add' | 'remove') => {
      const amount = parseFloat(balanceAdjust);
      if (!amount || amount <= 0) { toast.error('Enter a valid amount'); return; }
      setProcessing(true);
      try {
          const delta = direction === 'add' ? amount : -amount;
          const { error } = await api.post('/portfolio/admin-adjust', { 
            user_id: userId, 
            delta, 
            currency: adjustWalletType 
          });
          if (error) throw error;
          toast.success(`Successfully ${direction === 'add' ? 'added' : 'removed'} $${amount} ${direction === 'add' ? 'to' : 'from'} ${adjustWalletType} balance`);
          setBalanceAdjust('');
          setSelectedUser(null);
      } catch (err: any) {
          toast.error(err.message);
      } finally {
          setProcessing(false);
      }
  };

  const handleSyncPrices = async () => {
    setSyncing(true);
    try {
      const { data, error } = await api.post<{ updated: number; failed: string[] }>('/assets/sync', {});
      if (error) throw error;
      toast.success(`Prices synced! Updated ${data?.updated} assets${data?.failed?.length ? `, ${data.failed.length} failed: ${data.failed.join(', ')}` : ''}`);
      setLastSynced(new Date());
      fetchAllData();
    } catch (err: any) {
      toast.error('Sync failed: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleUpdateAsset = async () => {
      if (!editingAsset) return;
      setProcessing(true);
      try {
          const { error } = await api.patch(`/assets/${editingAsset.id}`, {
              price: editingAsset.price,
              change_percent: editingAsset.change_percent
          });
          if (error) throw error;
          toast.success("Asset updated");
          setEditingAsset(null);
          fetchAllData();
      } catch (err: any) {
          toast.error(err.message);
      } finally {
          setProcessing(false);
      }
  };

  const calculateEndsAt = (durationStr?: string) => {
    if (!durationStr) return;
    const match = durationStr.toLowerCase().match(/^(\d+)(s|m|h|d|w)$/);
    if (!match) return;
    
    const value = parseInt(match[1]);
    const unit = match[2];
    let seconds = 0;
    switch (unit) {
      case 's': seconds = value; break;
      case 'm': seconds = value * 60; break;
      case 'h': seconds = value * 3600; break;
      case 'd': seconds = value * 86400; break;
      case 'w': seconds = value * 604800; break;
    }
    
    if (seconds > 0) {
      const date = new Date(Date.now() + (seconds * 1000));
      // Format as YYYY-MM-DDTHH:mm:ss for datetime-local with seconds
      const tzOffset = date.getTimezoneOffset() * 60000;
      const localISOTime = new Date(date.getTime() - tzOffset).toISOString().slice(0, 19);
      setNewTrade(prev => ({ ...prev, ends_at: localISOTime }));
    }
  };

  const handleCreateTrade = async () => {
    if (!newTrade.asset_symbol || !newTrade.profit_percent || !newTrade.ends_at) {
      toast.error("Please fill all required fields");
      return;
    }
    const asset = assets.find(a => a.symbol === newTrade.asset_symbol);
    setProcessing(true);
    try {
      const { error } = await api.post('/managed-trades', {
        ...newTrade,
        asset_name: asset?.name || newTrade.asset_symbol,
        asset_type: asset?.type || 'crypto'
      });
      if (error) throw error;
      toast.success("Managed trade created");
      setNewTrade({
        asset_symbol: '',
        profit_percent: 10,
        min_amount: 10,
        scope: 'all',
        signal_type: 'call',
        outcome: 'win',
        ends_at: format(new Date(Date.now() + 86400000), "yyyy-MM-dd'T'HH:mm")
      });
      fetchAllData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleCompleteTrade = async (id: string) => {
    setProcessing(true);
    try {
      const { data, error } = await api.post<any>(`/managed-trades/${id}/complete`, {});
      if (error) throw error;
      toast.success(data.message || "Trade completed and traders paid out");
      fetchAllData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleUpdateSetting = async (key: string, value: any) => {
    setProcessing(true);
    try {
      const { error } = await api.patch('/admin/settings', { key, value });
      if (error) throw error;
      toast.success("Settings updated");
      fetchAllData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleSendNotification = async () => {
    if (!notificationForm.title || !notificationForm.body) {
      toast.error("Please fill title and body");
      return;
    }
    setProcessing(true);
    try {
      const { error } = await api.post('/admin/notifications', notificationForm);
      if (error) throw error;
      toast.success("Notification(s) sent");
      setNotificationForm({ target: 'all', title: '', body: '' });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleSendEmail = async () => {
    if (!emailForm.subject || !emailForm.body) {
      toast.error("Please fill subject and body");
      return;
    }
    if (recipientType === 'external' && (!emailForm.target || !emailForm.target.includes('@'))) {
      toast.error("Please enter a valid email address");
      return;
    }
    setProcessing(true);
    try {
      const { data, error } = await api.post<{ count: number }>('/admin/send-email', emailForm);
      if (error) throw error;
      toast.success(`Successfully sent ${data?.count || 0} email(s)!`);
      setEmailForm({ target: recipientType === 'platform' ? 'all' : '', name: '', subject: '', body: '' });
    } catch (err: any) {
      toast.error(err.message || "Failed to send email");
    } finally {
      setProcessing(false);
    }
  };


  if (isLoadingAuth || (user && user.role !== 'admin')) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-32">
      {/* ── HEADER ── */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border px-4 py-4 md:px-8 pt-safe">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 md:h-12 md:w-12 rounded-xl md:rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20 shrink-0">
              <Shield className="h-6 w-6 md:h-7 md:w-7 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight">Admin Console</h1>
              <p className="text-[10px] md:text-xs text-muted-foreground">Manage users, funding, and platform assets</p>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-3">
             <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input 
                  type="text"
                  placeholder="Search everything..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-muted/50 border border-border rounded-xl md:rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
              <button 
                onClick={fetchAllData}
                disabled={loading}
                className="p-2.5 rounded-xl md:rounded-2xl bg-muted hover:bg-muted/80 transition-colors disabled:opacity-50 shrink-0"
              >
                <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
              </button>
          </div>
        </div>
      </header>

      {/* ── NAVIGATION TABS ── */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 mt-6">
        <div className="flex items-center gap-1 p-1 bg-muted rounded-2xl w-full md:w-fit overflow-x-auto scrollbar-hide">
          {(['overview', 'users', 'deposits', 'withdrawals', 'kyc', 'assets', 'trades', 'settings', 'notifications', 'support', 'email'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-5 py-2.5 rounded-xl text-sm font-bold capitalize transition-all whitespace-nowrap flex-1 md:flex-initial text-center",
                activeTab === tab 
                  ? "bg-background shadow text-primary" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 md:px-8 mt-8">
          <AnimatePresence mode="wait">
              {activeTab === 'overview' && (
                <motion.div 
                    key="overview"
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
                >
                    <StatCard icon={Users} label="Total Users" value={users.length} color="primary" />
                    <StatCard icon={Clock} label="Pending KYC" value={kycSubmissions.filter(s => s.status === 'pending').length} color="amber" />
                    <StatCard icon={Wallet} label="Pending Deposits" value={deposits.filter(d => d.status === 'pending').length} color="success" />
                    <StatCard icon={TrendingUp} label="Total Assets" value={assets.length} color="blue" />
                    
                    {/* Activity Feed placeholders */}
                    <div className="md:col-span-2 lg:col-span-3 bg-card border border-border rounded-3xl p-4 md:p-6">
                        <h3 className="font-bold mb-3 md:mb-4">Recent Deposits</h3>
                        <div className="space-y-4">
                            {deposits.slice(0, 5).map(d => (
                                <div key={d.id} className="flex items-center justify-between p-3 rounded-2xl bg-muted/30">
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-lg bg-success/10 flex items-center justify-center">
                                            <ArrowUpRight className="h-4 w-4 text-success" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold">${d.amount} {d.currency}</p>
                                            <p className="text-[10px] text-muted-foreground">{d.user_email}</p>
                                        </div>
                                    </div>
                                    <span className={cn(
                                        "text-[9px] font-bold px-2 py-0.5 rounded-full uppercase",
                                        d.status === 'approved' ? 'bg-success/10 text-success' : 
                                        d.status === 'rejected' ? 'bg-destructive/10 text-destructive' : 'bg-amber-500/10 text-amber-500'
                                    )}>{d.status}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </motion.div>
              )}

              {activeTab === 'overview' && aiTradeSettings && (
                <motion.div
                  key="ai-control"
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className="mt-6 bg-card border border-border rounded-3xl p-4 md:p-6"
                >
                  <div className="flex items-center gap-3 mb-5">
                    <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Bot className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm">AI Trade Outcome Control</h3>
                      <p className="text-[10px] text-muted-foreground">Override the outcome for all users' AI (Live Trading) trades</p>
                    </div>
                    <button onClick={fetchAllData} className="ml-auto p-2 rounded-xl hover:bg-muted transition-colors">
                      <RefreshCcw className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mb-6">
                    {[
                      { mode: 'normal', label: 'Normal', sub: '30% win rate', icon: BarChart3 },
                      { mode: 'always_win', label: 'Always Win', sub: 'Force all wins', icon: TrendingUp },
                      { mode: 'always_loss', label: 'Always Loss', sub: 'Force all losses', icon: TrendingDown },
                    ].map(({ mode, label, sub, icon: Icon }) => {
                      const isActive = aiTradeSettings.mode === mode;
                      const activeColor = mode === 'always_win'
                        ? 'bg-success/10 text-success border border-success/30'
                        : mode === 'always_loss'
                          ? 'bg-destructive/10 text-destructive border border-destructive/30'
                          : 'bg-primary/10 text-primary border border-primary/30';
                      return (
                        <button
                          key={mode}
                          disabled={aiModeLoading}
                          onClick={async () => {
                            setAiModeLoading(true);
                            try {
                              const { error } = await api.post('/admin/ai-trade-settings', { mode });
                              if (error) throw error;
                              setAiTradeSettings(prev => prev ? { ...prev, mode } : null);
                              toast.success(`AI trade mode set to "${label}"`);
                            } catch (err: any) {
                              toast.error(err.message || 'Failed to update mode');
                            } finally {
                              setAiModeLoading(false);
                            }
                          }}
                          className={cn(
                            'flex flex-col items-center gap-1 p-3 rounded-2xl text-xs font-bold transition-all',
                            isActive ? activeColor + ' ring-2 ring-primary/20 shadow-md' : 'bg-muted/40 text-muted-foreground hover:bg-muted',
                            aiModeLoading && 'opacity-50 cursor-not-allowed'
                          )}
                        >
                          <Icon className="h-5 w-5 mb-0.5" />
                          <span>{label}</span>
                          <span className="text-[9px] font-normal opacity-70">{sub}</span>
                          {isActive && <span className="text-[8px] font-black uppercase tracking-wider mt-0.5">● Active</span>}
                        </button>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {[
                      { label: 'Total Staked', value: `$${(aiTradeSettings.stats?.totalStaked || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`, color: 'text-foreground' },
                      { label: 'Paid Out', value: `$${(aiTradeSettings.stats?.totalPaidOut || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`, color: 'text-destructive' },
                      { label: 'House Profit', value: `$${(aiTradeSettings.stats?.houseProfit || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`, color: (aiTradeSettings.stats?.houseProfit || 0) >= 0 ? 'text-success' : 'text-destructive' },
                      { label: 'Total Trades', value: String(aiTradeSettings.stats?.totalTradeCount || 0), color: 'text-foreground' },
                      { label: 'Wins', value: String(aiTradeSettings.stats?.totalWinCount || 0), color: 'text-success' },
                      { label: 'Losses', value: String(aiTradeSettings.stats?.totalLossCount || 0), color: 'text-destructive' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="bg-muted/30 rounded-2xl p-3 text-center">
                        <p className="text-[9px] text-muted-foreground uppercase font-bold mb-1">{label}</p>
                        <p className={cn('font-black text-base', color)}>{value}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {activeTab === 'users' && (
                  <motion.div key="users" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                      {/* Mobile Card View */}
                      <div className="grid grid-cols-1 gap-4 md:hidden">
                          {users.filter(u => u.email.includes(searchQuery) || u.name?.includes(searchQuery)).map(u => (
                              <div key={u.id} onClick={() => openUserDetail(u)} className="bg-card border border-border p-4 rounded-3xl flex items-center justify-between group active:scale-[0.98] transition-all">
                                  <div className="flex flex-col gap-1">
                                      <span className="text-sm font-bold">{u.name || 'Anonymous'}</span>
                                      <span className="text-[10px] text-muted-foreground font-mono">{u.email}</span>
                                      <div className="flex gap-2 mt-1">
                                          <span className={cn(
                                              "px-2 py-0.5 rounded-full text-[8px] font-bold uppercase",
                                              u.role === 'admin' ? 'bg-purple-500/10 text-purple-500' : 'bg-blue-500/10 text-blue-500'
                                          )}>{u.role}</span>
                                          <span className={cn(
                                              "px-2 py-0.5 rounded-full text-[8px] font-bold uppercase",
                                              u.kyc_status === 'approved' ? 'bg-success/10 text-success' : 'bg-amber-500/10 text-amber-500'
                                          )}>{u.kyc_status}</span>
                                      </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                      <button 
                                          onClick={(e) => { e.stopPropagation(); handleDeleteUser(u.id, u.email); }}
                                          className="p-2 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                                      >
                                          <Trash2 className="h-4 w-4" />
                                      </button>
                                      <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                                  </div>
                              </div>
                          ))}
                      </div>

                      {/* Desktop Table View */}
                      <div className="hidden md:block bg-card border border-border rounded-3xl overflow-hidden">
                          <table className="w-full text-left">
                              <thead>
                                  <tr className="bg-muted/30 border-b border-border">
                                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">User</th>
                                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Role</th>
                                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">KYC Status</th>
                                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Joined</th>
                                      <th className="px-6 py-4 text-right"></th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-border">
                                  {users.filter(u => u.email.includes(searchQuery) || u.name?.includes(searchQuery)).map(u => (
                                      <tr key={u.id} className="hover:bg-muted/10 transition-colors group">
                                          <td className="px-6 py-4">
                                              <div className="flex flex-col">
                                                  <span className="text-sm font-bold">{u.name || 'Anonymous'}</span>
                                                  <span className="text-[10px] text-muted-foreground font-mono">{u.email}</span>
                                              </div>
                                          </td>
                                          <td className="px-6 py-4">
                                              <span className={cn(
                                                  "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                                                  u.role === 'admin' ? 'bg-purple-500/10 text-purple-500' : 'bg-blue-500/10 text-blue-500'
                                              )}>{u.role}</span>
                                          </td>
                                          <td className="px-6 py-4">
                                               <span className={cn(
                                                  "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                                                  u.kyc_status === 'approved' ? 'bg-success/10 text-success' : 'bg-amber-500/10 text-amber-500'
                                              )}>{u.kyc_status}</span>
                                          </td>
                                          <td className="px-6 py-4 text-xs text-muted-foreground">
                                              {format(new Date(u.created_at), 'MMM dd, yyyy')}
                                          </td>
                                          <td className="px-6 py-4 text-right">
                                              <div className="flex items-center justify-end gap-2">
                                                  <button 
                                                    onClick={() => openUserDetail(u)}
                                                    className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                                                  >
                                                      <Eye className="h-4 w-4" />
                                                  </button>
                                                  <button 
                                                    onClick={(e) => { e.stopPropagation(); handleDeleteUser(u.id, u.email); }}
                                                    className="p-2 rounded-lg hover:bg-destructive/10 text-destructive transition-colors"
                                                  >
                                                      <Trash2 className="h-4 w-4" />
                                                  </button>
                                              </div>
                                          </td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      </div>
                  </motion.div>
              )}

               {activeTab === 'deposits' && (
                    <motion.div key="deposits" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                         {/* Mobile Card View */}
                         <div className="grid grid-cols-1 gap-4 md:hidden">
                             {deposits.map(d => (
                                 <div key={d.id} onClick={() => setSelectedDeposit(d)} className="bg-card border border-border p-4 rounded-3xl flex items-center justify-between group active:scale-[0.98] transition-all">
                                     <div className="flex flex-col gap-1">
                                         <div className="flex items-center gap-2">
                                             <span className="text-sm font-bold">${d.amount} {d.currency}</span>
                                             <span className={cn(
                                                 "px-2 py-0.5 rounded-full text-[8px] font-bold uppercase",
                                                 d.status === 'approved' ? 'bg-success/10 text-success' : 
                                                 d.status === 'rejected' ? 'bg-destructive/10 text-destructive' : 'bg-amber-500/10 text-amber-500'
                                             )}>{d.status}</span>
                                         </div>
                                         <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[200px]">{d.user_email}</span>
                                         <span className="text-[9px] text-muted-foreground">{format(new Date(d.created_at), 'MMM dd, HH:mm')}</span>
                                     </div>
                                     <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                                 </div>
                             ))}
                         </div>

                         {/* Desktop Table View */}
                         <div className="hidden md:block bg-card border border-border rounded-3xl overflow-hidden">
                             <table className="w-full text-left">
                                 <thead>
                                     <tr className="bg-muted/30 border-b border-border">
                                         <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">User</th>
                                         <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Amount</th>
                                         <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Currency</th>
                                         <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Status</th>
                                         <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Date</th>
                                         <th className="px-6 py-4 text-right"></th>
                                     </tr>
                                 </thead>
                                 <tbody className="divide-y divide-border">
                                     {deposits.map(d => (
                                         <tr key={d.id} className="hover:bg-muted/10 transition-colors cursor-pointer" onClick={() => setSelectedDeposit(d)}>
                                             <td className="px-6 py-4 text-[10px] font-mono">{d.user_email}</td>
                                             <td className="px-6 py-4 text-sm font-bold">${d.amount}</td>
                                             <td className="px-6 py-4 text-xs">{d.currency}</td>
                                             <td className="px-6 py-4">
                                                 <span className={cn(
                                                     "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase",
                                                     d.status === 'approved' ? 'bg-success/10 text-success' : 
                                                     d.status === 'rejected' ? 'bg-destructive/10 text-destructive' : 'bg-amber-500/10 text-amber-500'
                                                 )}>{d.status}</span>
                                             </td>
                                             <td className="px-6 py-4 text-[10px] text-muted-foreground">
                                                 {format(new Date(d.created_at), 'MMM dd, HH:mm')}
                                             </td>
                                             <td className="px-6 py-4 text-right">
                                                 <button className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
                                                     <ChevronRight className="h-4 w-4" />
                                                 </button>
                                             </td>
                                         </tr>
                                     ))}
                                 </tbody>
                             </table>
                         </div>
                    </motion.div>
               )}

               {activeTab === 'withdrawals' && (
                    <motion.div key="withdrawals" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                         {/* Mobile Card View */}
                         <div className="grid grid-cols-1 gap-4 md:hidden">
                             {withdrawals.map(w => (
                                 <div key={w.id} onClick={() => setSelectedWithdrawal(w)} className="bg-card border border-border p-4 rounded-3xl flex items-center justify-between group active:scale-[0.98] transition-all">
                                     <div className="flex flex-col gap-1">
                                         <div className="flex items-center gap-2">
                                             <span className="text-sm font-bold">${w.amount} {w.currency}</span>
                                             <span className={cn(
                                                 "px-2 py-0.5 rounded-full text-[8px] font-bold uppercase",
                                                 w.status === 'approved' ? 'bg-success/10 text-success' : 
                                                 w.status === 'rejected' ? 'bg-destructive/10 text-destructive' : 'bg-amber-500/10 text-amber-500'
                                             )}>{w.status}</span>
                                         </div>
                                         <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[200px]">{w.users?.email}</span>
                                         <span className="text-[9px] text-muted-foreground">{w.network} • {format(new Date(w.created_at), 'MMM dd, HH:mm')}</span>
                                     </div>
                                     <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                                 </div>
                             ))}
                         </div>

                         {/* Desktop Table View */}
                         <div className="hidden md:block bg-card border border-border rounded-3xl overflow-hidden">
                             <table className="w-full text-left">
                                 <thead>
                                     <tr className="bg-muted/30 border-b border-border">
                                         <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">User</th>
                                         <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Amount</th>
                                         <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Asset</th>
                                         <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Status</th>
                                         <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Date</th>
                                         <th className="px-6 py-4 text-right"></th>
                                     </tr>
                                 </thead>
                                 <tbody className="divide-y divide-border">
                                     {withdrawals.map(w => (
                                         <tr key={w.id} className="hover:bg-muted/10 transition-colors cursor-pointer" onClick={() => setSelectedWithdrawal(w)}>
                                             <td className="px-6 py-4">
                                               <div className="flex flex-col">
                                                 <span className="text-sm font-bold">{w.users?.name || 'User'}</span>
                                                 <span className="text-[10px] font-mono text-muted-foreground">{w.users?.email}</span>
                                               </div>
                                             </td>
                                             <td className="px-6 py-4 text-sm font-bold">${w.amount.toLocaleString()}</td>
                                             <td className="px-6 py-4">
                                               <div className="flex flex-col">
                                                 <span className="text-xs font-bold">{w.currency}</span>
                                                 <span className="text-[9px] text-muted-foreground">{w.network}</span>
                                               </div>
                                             </td>
                                             <td className="px-6 py-4">
                                                 <span className={cn(
                                                     "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase",
                                                     w.status === 'approved' ? 'bg-success/10 text-success' : 
                                                     w.status === 'rejected' ? 'bg-destructive/10 text-destructive' : 'bg-amber-500/10 text-amber-500'
                                                 )}>{w.status}</span>
                                             </td>
                                             <td className="px-6 py-4 text-[10px] text-muted-foreground">
                                                 {format(new Date(w.created_at), 'MMM dd, HH:mm')}
                                             </td>
                                             <td className="px-6 py-4 text-right">
                                                 <button className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
                                                     <ChevronRight className="h-4 w-4" />
                                                 </button>
                                             </td>
                                         </tr>
                                     ))}
                                 </tbody>
                             </table>
                         </div>
                    </motion.div>
               )}

               {activeTab === 'kyc' && (
                  <motion.div key="kyc" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                      {/* Mobile Card View */}
                      <div className="grid grid-cols-1 gap-4 md:hidden">
                          {kycSubmissions.map(s => (
                              <div key={s.id} onClick={() => setSelectedKYC(s)} className="bg-card border border-border p-4 rounded-3xl flex items-center justify-between group active:scale-[0.98] transition-all">
                                  <div className="flex flex-col gap-1">
                                      <span className="text-sm font-bold">{s.first_name} {s.last_name}</span>
                                      <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[200px]">{s.user_email}</span>
                                      <div className="flex gap-2 mt-1">
                                          <span className="text-[9px] font-bold uppercase text-muted-foreground">{s.id_type.replace(/_/g, ' ')}</span>
                                          <span className={cn(
                                              "px-2 py-0.5 rounded-full text-[8px] font-bold uppercase",
                                              s.status === 'approved' ? 'bg-success/10 text-success' : 
                                              s.status === 'rejected' ? 'bg-destructive/10 text-destructive' : 'bg-amber-500/10 text-amber-500'
                                          )}>{s.status}</span>
                                      </div>
                                  </div>
                                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                              </div>
                          ))}
                      </div>

                      {/* Desktop Table View */}
                      <div className="hidden md:block bg-card border border-border rounded-3xl overflow-hidden">
                          <table className="w-full text-left">
                              <thead>
                                  <tr className="bg-muted/30 border-b border-border">
                                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">User</th>
                                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">ID Type</th>
                                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Status</th>
                                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Submitted</th>
                                      <th className="px-6 py-4 text-right"></th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-border">
                                  {kycSubmissions.map(s => (
                                      <tr key={s.id} className="hover:bg-muted/10 transition-colors cursor-pointer" onClick={() => setSelectedKYC(s)}>
                                          <td className="px-6 py-4">
                                              <div className="flex flex-col">
                                                  <span className="text-sm font-bold">{s.first_name} {s.last_name}</span>
                                                  <span className="text-[10px] text-muted-foreground font-mono">{s.user_email}</span>
                                              </div>
                                          </td>
                                          <td className="px-6 py-4 text-xs capitalize">{s.id_type.replace(/_/g, ' ')}</td>
                                          <td className="px-6 py-4">
                                               <span className={cn(
                                                  "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase",
                                                  s.status === 'approved' ? 'bg-success/10 text-success' : 
                                                  s.status === 'rejected' ? 'bg-destructive/10 text-destructive' : 'bg-amber-500/10 text-amber-500'
                                              )}>{s.status}</span>
                                          </td>
                                          <td className="px-6 py-4 text-xs text-muted-foreground">
                                              {format(new Date(s.created_at), 'MMM dd, yyyy')}
                                          </td>
                                          <td className="px-6 py-4 text-right">
                                              <button className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
                                                  <Eye className="h-4 w-4" />
                                              </button>
                                          </td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      </div>
                  </motion.div>
              )}

              {activeTab === 'assets' && (
                  <motion.div key="assets" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                           <TrendingUp className="h-5 w-5 text-primary" />
                           <h3 className="font-bold text-lg">Market Assets</h3>
                        </div>
                        <div className="flex items-center gap-3">
                            <button 
                                onClick={handleSyncPrices}
                                disabled={syncing}
                                className="h-11 px-6 bg-primary text-primary-foreground font-bold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-all shadow-lg shadow-primary/20"
                            >
                                {syncing ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                                Sync Prices
                            </button>
                        </div>
                      </div>

                      {/* Mobile Card View */}
                      <div className="grid grid-cols-1 gap-4 md:hidden">
                          {assets.filter(a => a.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || a.name?.toLowerCase().includes(searchQuery.toLowerCase())).map(a => (
                              <div key={a.id} onClick={() => setEditingAsset(a)} className="bg-card border border-border p-4 rounded-3xl flex items-center justify-between group active:scale-[0.98] transition-all">
                                  <div className="flex items-center gap-4">
                                      <AssetIcon symbol={a.symbol} logoUrl={a.logo_url} size="md" className="rounded-xl" />
                                      <div className="flex flex-col">
                                          <div className="flex items-center gap-2">
                                              <span className="text-sm font-bold">{a.symbol}</span>
                                              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground uppercase font-bold">{a.type}</span>
                                          </div>
                                          <span className="text-xs text-muted-foreground">{a.name}</span>
                                      </div>
                                  </div>
                                  <div className="text-right flex flex-col items-end gap-1">
                                      <span className="text-sm font-bold">${a.price.toLocaleString()}</span>
                                      <span className={cn(
                                          "text-[10px] font-bold",
                                          a.change_percent >= 0 ? "text-success" : "text-destructive"
                                      )}>
                                          {a.change_percent >= 0 ? "+" : ""}{a.change_percent}%
                                      </span>
                                  </div>
                              </div>
                          ))}
                      </div>

                      {/* Desktop Table View */}
                      <div className="hidden md:block bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
                          <table className="w-full text-left">
                              <thead>
                                  <tr className="bg-muted/30 border-b border-border">
                                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Asset</th>
                                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Type</th>
                                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Price</th>
                                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">24h Change</th>
                                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Last Updated</th>
                                      <th className="px-6 py-4 text-right"></th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-border">
                                  {assets.filter(a => a.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || a.name?.toLowerCase().includes(searchQuery.toLowerCase())).map(a => (
                                      <tr key={a.id} className="hover:bg-muted/10 transition-colors">
                                          <td className="px-6 py-4">
                                              <div className="flex items-center gap-3">
                                                  <AssetIcon symbol={a.symbol} logoUrl={a.logo_url} size="sm" className="rounded-lg" />
                                                  <div className="flex flex-col">
                                                      <span className="text-sm font-bold">{a.symbol}</span>
                                                      <span className="text-[10px] text-muted-foreground">{a.name}</span>
                                                  </div>
                                              </div>
                                          </td>
                                          <td className="px-6 py-4">
                                              <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] font-bold uppercase">{a.type}</span>
                                          </td>
                                          <td className="px-6 py-4 text-sm font-bold">${a.price.toLocaleString()}</td>
                                          <td className="px-6 py-4">
                                              <span className={cn(
                                                  "px-2 py-0.5 rounded-full text-[10px] font-bold",
                                                  a.change_percent >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                                              )}>
                                                  {a.change_percent >= 0 ? "+" : ""}{a.change_percent}%
                                              </span>
                                          </td>
                                          <td className="px-6 py-4 text-[10px] text-muted-foreground">
                                              {a.updated_at ? format(new Date(a.updated_at), 'MMM dd, HH:mm') : 'Never'}
                                          </td>
                                          <td className="px-6 py-4 text-right">
                                              <button 
                                                onClick={() => setEditingAsset(a)}
                                                className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors group"
                                              >
                                                  <Settings className="h-4 w-4 group-hover:text-primary transition-colors" />
                                              </button>
                                          </td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      </div>
                  </motion.div>
               )}
               {activeTab === 'trades' && (
                <motion.div key="trades" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                  {/* Create Trade Form */}
                  <div className="bg-card border border-border rounded-3xl p-6 shadow-sm">
                    <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
                       <TrendingUp className="h-5 w-5 text-primary" /> Create New Managed Trade
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase px-1">Select Asset</label>
                        <select 
                          value={newTrade.asset_symbol}
                          onChange={(e) => setNewTrade({...newTrade, asset_symbol: e.target.value})}
                          className="w-full h-11 px-4 bg-muted border border-border rounded-xl text-sm focus:outline-none"
                        >
                          <option value="">Choose an asset...</option>
                          {assets.map(a => (
                            <option key={a.id} value={a.symbol}>{a.symbol} - {a.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase px-1">Profit Percentage (%)</label>
                        <input 
                          type="number"
                          placeholder="e.g. 35"
                          value={newTrade.profit_percent}
                          onChange={(e) => setNewTrade({...newTrade, profit_percent: parseFloat(e.target.value)})}
                          className="w-full h-11 px-4 bg-muted border border-border rounded-xl text-sm focus:outline-none"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase px-1">Minimum Amount ($)</label>
                        <input 
                          type="number"
                          placeholder="e.g. 10"
                          value={newTrade.min_amount}
                          onChange={(e) => setNewTrade({...newTrade, min_amount: parseFloat(e.target.value)})}
                          className="w-full h-11 px-4 bg-muted border border-border rounded-xl text-sm focus:outline-none"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase px-1">End Time (Local)</label>
                        <div className="flex gap-2">
                          <input 
                            type="datetime-local"
                            step="1"
                            value={newTrade.ends_at}
                            onChange={(e) => setNewTrade({...newTrade, ends_at: e.target.value})}
                            className="flex-1 h-11 px-4 bg-muted border border-border rounded-xl text-sm focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase px-1">Scope</label>
                        <select 
                          value={newTrade.scope}
                          onChange={(e) => setNewTrade({...newTrade, scope: e.target.value as any})}
                          className="w-full h-11 px-4 bg-muted border border-border rounded-xl text-sm focus:outline-none"
                        >
                          <option value="all">All Users</option>
                          <option value="user">Specific User</option>
                        </select>
                      </div>

                      {newTrade.scope === 'user' && (
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase px-1">Select User</label>
                          <select 
                            value={newTrade.target_user_id}
                            onChange={(e) => setNewTrade({...newTrade, target_user_id: e.target.value})}
                            className="w-full h-11 px-4 bg-muted border border-border rounded-xl text-sm focus:outline-none"
                          >
                            <option value="">Choose a user...</option>
                            {users.map(u => (
                              <option key={u.id} value={u.id}>{u.email}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase px-1">Signal Type</label>
                        <select 
                          value={newTrade.signal_type}
                          onChange={(e) => setNewTrade({...newTrade, signal_type: e.target.value as any})}
                          className="w-full h-11 px-4 bg-muted border border-border rounded-xl text-sm focus:outline-none"
                        >
                          <option value="call">CALL (Up)</option>
                          <option value="put">PUT (Down)</option>
                        </select>
                      </div>


                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase px-1">Duration</label>
                        <select 
                          value={newTrade.duration || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setNewTrade({...newTrade, duration: val});
                            if (val) calculateEndsAt(val);
                          }}
                          className="w-full h-11 px-4 bg-muted border border-border rounded-xl text-sm focus:outline-none"
                        >
                          <option value="">Select duration...</option>
                          <option value="30s">30 Seconds</option>
                          <option value="1m">1 Minute</option>
                          <option value="2m">2 Minutes</option>
                          <option value="5m">5 Minutes</option>
                          <option value="15m">15 Minutes</option>
                          <option value="30m">30 Minutes</option>
                          <option value="1h">1 Hour</option>
                          <option value="2h">2 Hours</option>
                          <option value="4h">4 Hours</option>
                          <option value="8h">8 Hours</option>
                          <option value="12h">12 Hours</option>
                          <option value="1d">1 Day</option>
                          <option value="2d">2 Days</option>
                          <option value="3d">3 Days</option>
                          <option value="1w">1 Week</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase px-1">Target Outcome</label>
                        <select 
                          value={newTrade.outcome}
                          onChange={(e) => setNewTrade({...newTrade, outcome: e.target.value as any})}
                          className="w-full h-11 px-4 bg-muted border border-border rounded-xl text-sm focus:outline-none"
                        >
                          <option value="win">Win (Trade + Profit)</option>
                          <option value="loss">Loss (Trade Lost)</option>
                        </select>
                      </div>

                      <div className="flex items-end">
                        <button 
                          onClick={handleCreateTrade}
                          disabled={processing}
                          className="w-full h-11 bg-primary text-primary-foreground font-bold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-all shadow-lg shadow-primary/20"
                        >
                          {processing ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />}
                          Create Trade
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Active Trades List */}
                  <div className="space-y-4">
                    <h3 className="font-bold text-lg px-1">Active Managed Trades</h3>
                    <div className="grid grid-cols-1 gap-4">
                      {managedTrades.length === 0 ? (
                        <div className="bg-card border border-border rounded-3xl p-12 text-center text-muted-foreground">
                          No managed trades found
                        </div>
                      ) : managedTrades.map(t => (
                        <div key={t.id} className="bg-card border border-border p-6 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-6">
                          <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center font-bold text-primary">
                              {t.asset_symbol.slice(0, 1)}
                            </div>
                            <div>
                              <h4 className="font-bold flex items-center gap-2">
                                {t.asset_symbol} 
                                <span className="px-2 py-0.5 rounded-full bg-success/10 text-success text-[10px] font-bold">+{t.profit_percent}%</span>
                              </h4>
                              <p className="text-xs text-muted-foreground">
                                {t.asset_name} • Min: ${t.min_amount} • 
                                <span className={cn("ml-1 font-bold italic uppercase", t.signal_type === 'call' ? 'text-primary' : 'text-destructive')}>
                                  {t.signal_type} @ ${t.entry_price}
                                </span>
                              </p>
                              <p className="text-[10px] text-muted-foreground uppercase font-bold mt-1">
                                Duration: {t.duration} • Outcome: <span className={t.outcome === 'win' ? 'text-success' : 'text-destructive'}>{t.outcome}</span>
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-8">
                            <div>
                              <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Ends At</p>
                              <p className="text-xs font-medium">{format(new Date(t.ends_at), 'MMM dd, HH:mm')}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Scope</p>
                              <p className="text-xs font-medium capitalize">{t.scope}{t.scope === 'user' ? ' (targeted)' : ''}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Status</p>
                              <span className={cn(
                                "px-2 py-0.5 rounded-full text-[10px] font-bold capitalize",
                                t.status === 'active' ? 'bg-primary/10 text-primary' : 
                                t.status === 'completed' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
                              )}>{t.status}</span>
                            </div>
                          </div>
                          {t.status === 'active' && (
                            <button
                              onClick={() => handleCompleteTrade(t.id)}
                              disabled={processing}
                              className="px-6 h-11 bg-success text-success-foreground font-bold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-all shadow-lg shadow-success/10"
                            >
                              {processing ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                              Complete & Payout
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
              {activeTab === 'support' && (
                <SupportAdminPanel />
              )}

               {activeTab === 'settings' && (
                 <motion.div key="settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                     <div className="bg-card border border-border rounded-3xl p-6 shadow-sm">
                        <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
                           <Settings className="h-5 w-5 text-primary" /> Platform Settings
                        </h3>
                        <div className="space-y-8">
                           {/* Deposit Methods */}
                           <div className="space-y-4">
                              <h4 className="text-sm font-bold border-l-4 border-primary pl-3">Deposit Wallet Addresses</h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                 {settings.find(s => s.key === 'deposit_methods')?.value?.map((method: any, idx: number) => (
                                    <div key={method.id} className="p-4 rounded-2xl bg-muted/30 border border-border space-y-4">
                                       <div className="flex items-center justify-between">
                                          <span className="font-bold text-sm">{method.name} ({method.symbol})</span>
                                          <span className="text-[10px] text-muted-foreground uppercase font-bold">{method.network}</span>
                                       </div>
                                       <div className="space-y-2">
                                          <label className="text-[10px] font-bold text-muted-foreground uppercase">Wallet Address</label>
                                          <input 
                                             type="text" 
                                             value={method.address}
                                             onChange={(e) => {
                                                const methodSetting = settings.find(s => s.key === "deposit_methods"); if (!methodSetting) return; const newMethods = [...methodSetting.value];
                                                newMethods[idx] = { ...newMethods[idx], address: e.target.value, qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${e.target.value}` };
                                                // We don't update state here yet, we'll save on button click or similar
                                                // Actually for simplicity in this large file, let's just make it updateable locally first
                                                setSettings(prev => prev.map(s => s.key === 'deposit_methods' ? { ...s, value: newMethods } : s));
                                             }}
                                             className="w-full h-10 px-3 bg-card border border-border rounded-xl text-xs font-mono"
                                          />
                                       </div>
                                    </div>
                                 ))}
                              </div>
                              <button 
                                  onClick={() => { const methodSetting = settings.find(s => s.key === "deposit_methods"); if (methodSetting) handleUpdateSetting("deposit_methods", methodSetting.value); }}
                                 disabled={processing}
                                 className="h-11 px-8 bg-primary text-primary-foreground font-bold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-all shadow-lg shadow-primary/20"
                              >
                                 <Save className="h-4 w-4" /> Save Deposit Settings
                              </button>
                           </div>
                        </div>
                     </div>
                 </motion.div>
               )}

               {activeTab === 'notifications' && (
                 <motion.div key="notifications" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                     <div className="bg-card border border-border rounded-3xl p-6 shadow-sm">
                        <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
                           <Mail className="h-5 w-5 text-primary" /> Send Push Notifications
                        </h3>
                        <div className="max-w-2xl space-y-6">
                           <div className="space-y-2">
                              <label className="text-[10px] font-bold text-muted-foreground uppercase px-1">Recipient</label>
                              <select 
                                 value={notificationForm.target}
                                 onChange={(e) => setNotificationForm({...notificationForm, target: e.target.value})}
                                 className="w-full h-11 px-4 bg-muted border border-border rounded-xl text-sm focus:outline-none"
                              >
                                 <option value="all">All Subscribed Users</option>
                                 {users.map(u => (
                                    <option key={u.id} value={u.id}>{u.email} ({u.name || 'Anonymous'})</option>
                                 ))}
                              </select>
                           </div>

                           <div className="space-y-2">
                              <label className="text-[10px] font-bold text-muted-foreground uppercase px-1">Title</label>
                              <input 
                                 type="text"
                                 placeholder="e.g. Market Update"
                                 value={notificationForm.title}
                                 onChange={(e) => setNotificationForm({...notificationForm, title: e.target.value})}
                                 className="w-full h-11 px-4 bg-muted border border-border rounded-xl text-sm focus:outline-none"
                              />
                           </div>

                           <div className="space-y-2">
                              <label className="text-[10px] font-bold text-muted-foreground uppercase px-1">Message Body</label>
                              <textarea 
                                 placeholder="Type your message here..."
                                 value={notificationForm.body}
                                 onChange={(e) => setNotificationForm({...notificationForm, body: e.target.value})}
                                 className="w-full h-32 p-4 bg-muted border border-border rounded-xl text-sm focus:outline-none resize-none"
                              />
                           </div>

                           <button 
                              onClick={handleSendNotification}
                              disabled={processing || !notificationForm.title || !notificationForm.body}
                              className="w-full h-12 bg-primary text-primary-foreground font-bold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-all shadow-lg shadow-primary/20"
                           >
                              <Send className="h-4 w-4" /> Send Notification
                           </button>
                        </div>
                     </div>
                 </motion.div>
               )}

               {activeTab === 'email' && (
                 <motion.div key="email" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                      <div className="bg-card border border-border rounded-3xl p-6 shadow-sm">
                         <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
                            <Mail className="h-5 w-5 text-primary" /> Email Platform Users
                         </h3>
                         
                         <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                            {/* Column 1: Compose Email */}
                            <div className="lg:col-span-6 space-y-6">
                               <div className="space-y-2">
                                  <div className="flex justify-between items-center px-1">
                                     <label className="text-[10px] font-bold text-muted-foreground uppercase">Recipient</label>
                                     <div className="flex items-center gap-2">
                                        <button 
                                           type="button"
                                           onClick={() => {
                                              setRecipientType('platform');
                                              setEmailForm({...emailForm, target: 'all'});
                                           }}
                                           className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-all ${recipientType === 'platform' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                                        >
                                           Platform User
                                        </button>
                                        <button 
                                           type="button"
                                           onClick={() => {
                                              setRecipientType('external');
                                              setEmailForm({...emailForm, target: ''});
                                           }}
                                           className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-all ${recipientType === 'external' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                                        >
                                           External Email
                                        </button>
                                     </div>
                                  </div>
                                  
                                  {recipientType === 'platform' ? (
                                     <select 
                                        value={emailForm.target}
                                        onChange={(e) => setEmailForm({...emailForm, target: e.target.value})}
                                        className="w-full h-11 px-4 bg-muted border border-border rounded-xl text-sm focus:outline-none"
                                     >
                                        <option value="all">All Users (Send to everyone)</option>
                                        {users.map(u => (
                                           <option key={u.id} value={u.id}>{u.email} ({u.name || 'Anonymous'})</option>
                                        ))}
                                     </select>
                                  ) : (
                                     <input 
                                        type="email"
                                        placeholder="Enter recipient email (e.g. john@example.com)"
                                        value={emailForm.target}
                                        onChange={(e) => setEmailForm({...emailForm, target: e.target.value})}
                                        className="w-full h-11 px-4 bg-muted border border-border rounded-xl text-sm focus:outline-none"
                                     />
                                  )}
                               </div>

                               <div className="space-y-2">
                                  <label className="text-[10px] font-bold text-muted-foreground uppercase px-1">Recipient Name (Optional)</label>
                                  <input 
                                     type="text"
                                     placeholder="e.g. Daniel (falls back to username/email if left blank)"
                                     value={emailForm.name}
                                     onChange={(e) => setEmailForm({...emailForm, name: e.target.value})}
                                     className="w-full h-11 px-4 bg-muted border border-border rounded-xl text-sm focus:outline-none"
                                  />
                               </div>

                               <div className="space-y-2">
                                  <label className="text-[10px] font-bold text-muted-foreground uppercase px-1">Subject</label>
                                  <input 
                                     type="text"
                                     placeholder="e.g. Account Verification Completed"
                                     value={emailForm.subject}
                                     onChange={(e) => setEmailForm({...emailForm, subject: e.target.value})}
                                     className="w-full h-11 px-4 bg-muted border border-border rounded-xl text-sm focus:outline-none"
                                  />
                                </div>

                               <div className="space-y-2">
                                  <label className="text-[10px] font-bold text-muted-foreground uppercase px-1">Message Body (Markdown Supported)</label>
                                  <textarea 
                                     placeholder="Type your message using Markdown...&#10;&#10;e.g.&#10;### Welcome to the Platform&#10;We are **glad** to have you here!"
                                     value={emailForm.body}
                                     onChange={(e) => setEmailForm({...emailForm, body: e.target.value})}
                                     className="w-full h-64 p-4 bg-muted border border-border rounded-xl text-sm font-mono focus:outline-none resize-y"
                                  />
                               </div>

                               {/* Markdown Guide */}
                               <div className="p-4 rounded-2xl bg-muted/40 border border-border/80 space-y-3">
                                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Markdown Formatting Guide</p>
                                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                                     <div>
                                        <p className="font-semibold text-foreground">Headers:</p>
                                        <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono"># Heading 1</code><br/>
                                        <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">### Heading 3</code>
                                     </div>
                                     <div>
                                        <p className="font-semibold text-foreground">Lists:</p>
                                        <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">* Item 1</code><br/>
                                        <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">- Item 2</code>
                                     </div>
                                     <div>
                                        <p className="font-semibold text-foreground">Text Styling:</p>
                                        <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">**Bold text**</code><br/>
                                        <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">*Italic text*</code>
                                     </div>
                                     <div>
                                        <p className="font-semibold text-foreground">Links & Rules:</p>
                                        <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">[Label](url)</code><br/>
                                        <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">--- (Divider)</code>
                                     </div>
                                  </div>
                               </div>

                               <button 
                                  onClick={handleSendEmail}
                                  disabled={processing || !emailForm.subject || !emailForm.body}
                                  className="w-full h-12 bg-primary text-primary-foreground font-bold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-all shadow-lg shadow-primary/20 cursor-pointer"
                               >
                                  {processing ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                  {processing ? 'Sending...' : 'Send Email'}
                               </button>
                            </div>

                            {/* Column 2: Live Preview (BloFin styled) */}
                            <div className="lg:col-span-6 space-y-3">
                               <p className="text-[10px] font-bold text-muted-foreground uppercase px-1">Live Email Preview (BloFin style)</p>
                               <div className="border border-border rounded-2xl overflow-hidden bg-muted/20 p-4 flex justify-center">
                                  {/* BloFin layout simulation */}
                                  <div className="w-full max-w-[500px] bg-white text-gray-800 rounded-lg shadow-sm border border-gray-200 overflow-hidden text-left" style={{ fontFamily: 'Arial, sans-serif' }}>
                                     {/* Header */}
                                     <div className="p-4 flex justify-between items-center" style={{ backgroundColor: '#0f0c1b', borderBottom: '3px solid #7047EB' }}>
                                        <div className="flex items-center">
                                           <img src="/logo-left.png" alt="Crypto.com" style={{ height: '34px', objectFit: 'contain' }} />
                                        </div>
                                        
                                        {/* Right Logo (Image 3) */}
                                        <div className="flex items-center">
                                           <img src="/logo-right.png" alt="Crypto.com Emblem" style={{ height: '28px', objectFit: 'contain' }} />
                                        </div>
                                     </div>
                                     
                                     {/* Content */}
                                     <div className="p-6">
                                        <p className="text-gray-900 font-bold text-sm mb-4">
                                           Hi {emailForm.name || (recipientType === 'external' 
                                               ? (emailForm.target ? emailForm.target.split('@')[0] : 'User')
                                               : (emailForm.target === 'all' 
                                                  ? "[User's Name]" 
                                                  : (users.find(u => u.id === emailForm.target)?.name || users.find(u => u.id === emailForm.target)?.email?.split('@')[0] || 'User')))},
                                        </p>
                                        <div className="text-gray-700 text-sm space-y-3 min-h-[120px] break-words" dangerouslySetInnerHTML={{ __html: parseMarkdownForPreview(emailForm.body) }} />
                                        
                                        <p className="mt-8 text-gray-600 text-sm">
                                           Regards,<br/>
                                           <strong className="text-gray-900">Kali team</strong>
                                        </p>
                                     </div>

                                     {/* Footer */}
                                     <div className="px-6 pb-6 pt-4 border-t border-gray-100 bg-white">
                                        <p className="text-[9px] text-gray-400 text-center leading-normal mb-3">
                                           Kali strives to safeguard your account and transactions to protect you from scams. Thank you for choosing Kali.
                                        </p>
                                        <p className="text-xs text-center font-bold">
                                           <span style={{ color: '#7047EB' }}>support@kali.com</span>
                                        </p>
                                     </div>
                                  </div>
                               </div>
                            </div>
                         </div>
                      </div>
                 </motion.div>
               )}
           </AnimatePresence>
      </main>

      {/* ── MODALS (USER DETAIL, DEPOSIT DETAIL, KYC DETAIL, ASSET EDIT) ── */}
      <AnimatePresence>
          {editingAsset && (
              <DetailModal title={`Update ${editingAsset.symbol}`} onClose={() => setEditingAsset(null)}>
                  <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase px-1">Price (USD)</label>
                                <input 
                                    type="number"
                                    value={editingAsset.price}
                                    onChange={(e) => setEditingAsset({...editingAsset, price: Number(e.target.value)})}
                                    className="w-full h-11 px-4 bg-muted border border-border rounded-xl text-sm focus:outline-none"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase px-1">24h Change (%)</label>
                                <input 
                                    type="number"
                                    value={editingAsset.change_percent}
                                    onChange={(e) => setEditingAsset({...editingAsset, change_percent: Number(e.target.value)})}
                                    className="w-full h-11 px-4 bg-muted border border-border rounded-xl text-sm focus:outline-none"
                                />
                            </div>
                        </div>
                        <button 
                            onClick={handleUpdateAsset}
                            disabled={processing}
                            className="w-full h-14 bg-primary text-primary-foreground font-bold rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                        >
                            {processing ? <RefreshCcw className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                            Save Changes
                        </button>
                  </div>
              </DetailModal>
          )}

          {selectedKYC && (
              <DetailModal title="Review Identity" onClose={() => setSelectedKYC(null)}>
                  <div className="space-y-8">
                     <div className="grid grid-cols-2 gap-6">
                        <InfoItem label="First Name" value={selectedKYC.first_name} />
                        <InfoItem label="Last Name" value={selectedKYC.last_name} />
                        <InfoItem label="Date of Birth" value={selectedKYC.date_of_birth} />
                        <InfoItem label="Phone" value={selectedKYC.phone} />
                        <div className="col-span-2">
                          <InfoItem label="Address" value={`${selectedKYC.address}, ${selectedKYC.city}, ${selectedKYC.state}, ${selectedKYC.country}`} />
                        </div>
                     </div>

                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <DocumentImage label="ID Front" url={selectedKYC.id_front_image} />
                         <DocumentImage label="ID Back" url={selectedKYC.id_back_image} />
                         <DocumentImage label="Liveness Selfie" url={selectedKYC.selfie_image} />
                     </div>

                     {selectedKYC.status === 'pending' ? (
                          <div className="space-y-4 pt-6 border-t border-border">
                              <textarea 
                                placeholder="Rejection reason..."
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                className="w-full p-4 bg-muted/50 border border-border rounded-2xl text-sm min-h-[80px]"
                              />
                              <div className="grid grid-cols-2 gap-4">
                                  <button
                                    onClick={() => handleUpdateKYC(selectedKYC.user_id, 'approved')}
                                    disabled={processing}
                                    className="h-12 bg-primary text-primary-foreground font-bold rounded-2xl flex items-center justify-center gap-2 disabled:opacity-60 hover:opacity-90 transition-all active:scale-95"
                                  >
                                    {processing ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => handleUpdateKYC(selectedKYC.user_id, 'rejected')}
                                    disabled={processing}
                                    className="h-12 bg-destructive text-destructive-foreground font-bold rounded-2xl flex items-center justify-center gap-2 disabled:opacity-60 hover:opacity-90 transition-all active:scale-95"
                                  >
                                    {processing ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                                    Reject
                                  </button>
                              </div>
                          </div>
                      ) : (
                          <div className={cn("p-4 rounded-2xl text-center font-bold", selectedKYC.status === 'approved' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive')}>
                              KYC {selectedKYC.status.toUpperCase()}
                          </div>
                      )}
                  </div>
              </DetailModal>
          )}
          {selectedUser && (
              <DetailModal title="User Detail" onClose={() => { setSelectedUser(null); setUserDetail(null); }}>
                  {/* Tab nav */}
                  <div className="flex gap-1 p-1 bg-muted rounded-2xl mb-6">
                      {(['overview','balances','holdings','edit'] as const).map(tab => (
                          <button key={tab} onClick={() => setUserTab(tab)}
                              className={cn('flex-1 py-2 rounded-xl text-xs font-bold capitalize transition-all',
                                  userTab === tab ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
                              )}>{tab}</button>
                      ))}
                  </div>

                  {userDetailLoading && (
                      <div className="flex justify-center py-8"><RefreshCcw className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                  )}

                  {!userDetailLoading && userTab === 'overview' && (
                      <div className="space-y-5">
                          <div className="flex items-center gap-4 p-4 rounded-2xl bg-muted/30 border border-border">
                              <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-xl font-bold text-primary">
                                  {(selectedUser.name || selectedUser.email)?.[0]?.toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                  <p className="font-bold truncate">{selectedUser.name || 'Anonymous'}</p>
                                  <p className="text-xs text-muted-foreground truncate">{selectedUser.email}</p>
                                  <p className="text-[10px] text-muted-foreground mt-0.5">Joined {format(new Date(selectedUser.created_at), 'MMM dd, yyyy')}</p>
                              </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                              <div className="p-3 rounded-2xl bg-muted/30 border border-border">
                                  <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Role</p>
                                  <p className="text-sm font-bold capitalize">{selectedUser.role}</p>
                              </div>
                              <div className="p-3 rounded-2xl bg-muted/30 border border-border">
                                  <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Status</p>
                                  <p className={cn('text-sm font-bold capitalize', selectedUser.status === 'active' ? 'text-success' : 'text-destructive')}>{selectedUser.status || 'active'}</p>
                              </div>
                              <div className="p-3 rounded-2xl bg-muted/30 border border-border">
                                  <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">KYC Status</p>
                                  <p className={cn('text-sm font-bold capitalize', selectedUser.kyc_status === 'approved' ? 'text-success' : selectedUser.kyc_status === 'rejected' ? 'text-destructive' : 'text-amber-500')}>{selectedUser.kyc_status || 'not_started'}</p>
                              </div>
                              <div className="p-3 rounded-2xl bg-muted/30 border border-border">
                                  <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">User ID</p>
                                  <p className="text-[10px] font-mono text-muted-foreground truncate">{selectedUser.id}</p>
                              </div>
                              <div className="col-span-2 p-3 rounded-2xl bg-muted/30 border border-border flex items-center justify-between">
                                  <div>
                                      <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Password</p>
                                      {userDetail?.plain_password === "GOOGLE_OAUTH" ? (
                                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-500 border border-blue-500/20">
                                            <svg className="h-3 w-3" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                                            Signs in with Google
                                        </span>
                                      ) : userDetail?.plain_password ? (
                                        <p className="text-sm font-bold font-mono">
                                            {showPassword ? userDetail.plain_password : "••••••••"}
                                        </p>
                                      ) : (
                                        <p className="text-sm font-medium text-muted-foreground italic">
                                            Not recorded
                                        </p>
                                      )}
                                  </div>
                                  {userDetail?.plain_password && userDetail.plain_password !== "GOOGLE_OAUTH" && (
                                    <button 
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="p-2 hover:bg-muted rounded-lg text-muted-foreground transition-colors"
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                  )}
                              </div>
                          </div>
                          {userDetail?.kyc && (
                              <div className="space-y-2">
                                  <p className="text-[10px] font-bold text-muted-foreground uppercase">KYC Info</p>
                                  <div className="grid grid-cols-2 gap-2">
                                      <InfoItem label="Full Name" value={`${userDetail.kyc.first_name} ${userDetail.kyc.last_name}`} />
                                      <InfoItem label="Phone" value={userDetail.kyc.phone} />
                                      <div className="col-span-2"><InfoItem label="Address" value={`${userDetail.kyc.address}, ${userDetail.kyc.city}, ${userDetail.kyc.country}`} /></div>
                                  </div>
                              </div>
                          )}
                      </div>
                  )}

                  {!userDetailLoading && userTab === 'balances' && (
                      <div className="space-y-4">
                          {(userDetail?.wallets?.length ?? 0) === 0 ? (
                              <p className="text-sm text-muted-foreground text-center py-6">No wallets found</p>
                          ) : userDetail?.wallets?.map((w: any) => (
                              <div key={w.id} className="p-4 rounded-2xl bg-muted/30 border border-border flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                          <Wallet className="h-5 w-5 text-primary" />
                                      </div>
                                      <div>
                                          <p className="text-sm font-bold capitalize">{w.currency} Wallet</p>
                                          <p className="text-[10px] text-muted-foreground">Available: ${Number(w.available_balance).toLocaleString('en-US', {minimumFractionDigits:2})}</p>
                                      </div>
                                  </div>
                                  <p className="text-lg font-bold">${Number(w.main_balance).toLocaleString('en-US', {minimumFractionDigits:2})}</p>
                              </div>
                          ))}
                          <div className="pt-4 border-t border-border space-y-3">
                              <div className="flex items-center justify-between">
                                  <p className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-2">
                                      <Wallet className="h-3.5 w-3.5" /> Adjust Balance
                                  </p>
                                  <div className="flex gap-1 p-0.5 bg-muted rounded-lg">
                                      {(['holding', 'trading'] as const).map(type => (
                                          <button
                                              key={type}
                                              onClick={() => setAdjustWalletType(type)}
                                              className={cn(
                                                  "px-3 py-1 text-[9px] font-bold uppercase rounded-md transition-all",
                                                  adjustWalletType === type ? "bg-background shadow-sm text-primary" : "text-muted-foreground"
                                              )}
                                          >
                                              {type}
                                          </button>
                                      ))}
                                  </div>
                              </div>
                              <input type="number" placeholder={`Amount to ${adjustWalletType} balance (USD)`} value={balanceAdjust} onChange={(e) => setBalanceAdjust(e.target.value)}
                                  className="w-full h-11 px-4 bg-muted border border-border rounded-xl text-sm focus:outline-none" />
                              <div className="grid grid-cols-2 gap-3">
                                  <button onClick={() => handleAdjustBalance(selectedUser.id, 'add')} disabled={processing || !balanceAdjust}
                                      className="h-11 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 hover:opacity-90 transition-all">
                                      {processing ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />} Add
                                  </button>
                                  <button onClick={() => handleAdjustBalance(selectedUser.id, 'remove')} disabled={processing || !balanceAdjust}
                                      className="h-11 rounded-xl bg-destructive text-destructive-foreground font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 hover:opacity-90 transition-all">
                                      {processing ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <ArrowDownRight className="h-4 w-4" />} Remove
                                  </button>
                              </div>
                          </div>
                      </div>
                  )}

                  {!userDetailLoading && userTab === 'holdings' && (
                      <div className="space-y-3">
                          {(userDetail?.holdings?.length ?? 0) === 0 ? (
                              <div className="text-center py-8">
                                  <TrendingUp className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                                  <p className="text-sm text-muted-foreground">No holdings yet</p>
                              </div>
                          ) : userDetail?.holdings?.map((h: any) => {
                              const asset = assets.find((a: any) => a.symbol === h.asset_symbol);
                              const currentPrice = asset?.price || h.avg_buy_price;
                              const currentValue = h.quantity * currentPrice;
                              const pnl = currentValue - h.total_invested;
                              const pnlPct = h.total_invested > 0 ? (pnl / h.total_invested) * 100 : 0;
                              const adj = holdingAdjust[h.id] || { amount: '', loading: false };
                              return (
                                  <div key={h.id} className="rounded-2xl bg-muted/30 border border-border overflow-hidden">
                                      {/* Holding summary row */}
                                      <div className="p-4">
                                          <div className="flex items-center justify-between mb-2">
                                              <div className="flex items-center gap-3">
                                                  <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center font-bold text-primary text-sm">{h.asset_symbol.slice(0,2)}</div>
                                                  <div>
                                                      <p className="text-sm font-bold">{h.asset_symbol}</p>
                                                      <p className="text-[10px] text-muted-foreground">{Number(h.quantity).toFixed(6)} units</p>
                                                  </div>
                                              </div>
                                              <div className="text-right">
                                                  <p className="text-sm font-bold">${currentValue.toLocaleString('en-US', {minimumFractionDigits:2})}</p>
                                                  <p className={cn('text-[10px] font-bold', pnl >= 0 ? 'text-success' : 'text-destructive')}>{pnl >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%</p>
                                              </div>
                                          </div>
                                          <div className="flex justify-between text-[10px] text-muted-foreground">
                                              <span>Avg buy: ${Number(h.avg_buy_price).toFixed(2)}</span>
                                              <span>Invested: ${Number(h.total_invested).toLocaleString('en-US', {minimumFractionDigits:2})}</span>
                                          </div>
                                      </div>

                                      {/* Admin adjust controls */}
                                      <div className="border-t border-border px-4 py-3 bg-muted/10">
                                          <p className="text-[10px] font-bold text-muted-foreground uppercase mb-2">Admin Adjust (USD)</p>
                                          <div className="flex gap-2">
                                              <div className="relative flex-1">
                                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">$</span>
                                                  <input
                                                      type="number"
                                                      min="0"
                                                      step="0.01"
                                                      placeholder="0.00"
                                                      value={adj.amount}
                                                      onChange={e => setHoldingAdjust(prev => ({ ...prev, [h.id]: { ...prev[h.id], amount: e.target.value } }))}
                                                      className="w-full h-9 pl-7 pr-3 bg-muted border border-border rounded-xl text-sm font-bold focus:outline-none focus:ring-1 focus:ring-primary/30"
                                                  />
                                              </div>
                                              <button
                                                  onClick={() => handleAdjustHolding(h.id, 'add')}
                                                  disabled={adj.loading}
                                                  className="h-9 px-3 rounded-xl bg-success/10 text-success text-xs font-bold border border-success/20 hover:bg-success/20 disabled:opacity-50 transition-colors whitespace-nowrap"
                                              >
                                                  {adj.loading ? '...' : '+ Add (Profit)'}
                                              </button>
                                              <button
                                                  onClick={() => handleAdjustHolding(h.id, 'reduce')}
                                                  disabled={adj.loading}
                                                  className="h-9 px-3 rounded-xl bg-destructive/10 text-destructive text-xs font-bold border border-destructive/20 hover:bg-destructive/20 disabled:opacity-50 transition-colors whitespace-nowrap"
                                              >
                                                  {adj.loading ? '...' : '− Reduce (Loss)'}
                                              </button>
                                          </div>
                                      </div>
                                  </div>
                              );
                          })}
                      </div>
                  )}

                  {!userDetailLoading && userTab === 'edit' && (
                      <div className="space-y-5">
                          <div className="space-y-2">
                              <label className="text-[10px] font-bold text-muted-foreground uppercase px-1">Full Name</label>
                              <input value={editForm.name} onChange={(e) => setEditForm(f => ({...f, name: e.target.value}))}
                                  className="w-full h-11 px-4 bg-muted border border-border rounded-xl text-sm focus:outline-none" placeholder="Full name" />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                  <label className="text-[10px] font-bold text-muted-foreground uppercase px-1">Role</label>
                                  <select value={editForm.role} onChange={(e) => setEditForm(f => ({...f, role: e.target.value}))}
                                      className="w-full h-11 px-4 bg-muted border border-border rounded-xl text-sm focus:outline-none">
                                      <option value="buyer">Buyer</option>
                                      <option value="admin">Admin</option>
                                  </select>
                              </div>
                              <div className="space-y-2">
                                  <label className="text-[10px] font-bold text-muted-foreground uppercase px-1">Status</label>
                                  <select value={editForm.status} onChange={(e) => setEditForm(f => ({...f, status: e.target.value}))}
                                      className="w-full h-11 px-4 bg-muted border border-border rounded-xl text-sm focus:outline-none">
                                      <option value="active">Active</option>
                                      <option value="suspended">Suspended</option>
                                  </select>
                              </div>
                          </div>
                          <button
                              onClick={() => handleUpdateUser(selectedUser.id, { name: editForm.name, role: editForm.role, status: editForm.status })}
                              disabled={processing}
                              className="w-full h-12 bg-primary text-primary-foreground font-bold rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50 hover:opacity-90 transition-all"
                          >
                              {processing ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Changes
                          </button>
                          <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20">
                              <p className="text-xs font-bold text-amber-500 flex items-center gap-2 mb-1"><AlertCircle className="h-4 w-4" /> Warning</p>
                              <p className="text-[10px] text-muted-foreground">Changes take immediate effect and may log the user out.</p>
                          </div>
                      </div>
                  )}
              </DetailModal>
          )}


          {selectedWithdrawal && (
              <DetailModal title="Process Withdrawal" onClose={() => setSelectedWithdrawal(null)}>
                  <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                          <InfoItem label="Amount" value={`$${selectedWithdrawal.amount.toLocaleString()}`} />
                          <InfoItem label="Asset" value={`${selectedWithdrawal.currency} (${selectedWithdrawal.network})`} />
                      </div>

                      <div className="space-y-2">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase px-1">Recipient Address</label>
                          <div className="flex items-center gap-2">
                              <code className="flex-1 p-3 bg-muted border border-border rounded-xl text-xs font-mono break-all leading-relaxed">
                                  {selectedWithdrawal.address}
                              </code>
                              <button 
                                onClick={() => { navigator.clipboard.writeText(selectedWithdrawal.address); toast.success("Address copied"); }}
                                className="p-3 bg-muted hover:bg-muted/80 border border-border rounded-xl transition-colors shrink-0"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </button>
                          </div>
                      </div>

                      <div className="space-y-2">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase px-1">User Information</label>
                          <div className="p-4 rounded-2xl bg-muted/30 border border-border flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary italic">
                                  {selectedWithdrawal.users?.name?.charAt(0) || 'U'}
                              </div>
                              <div className="min-w-0">
                                  <p className="text-sm font-bold truncate">{selectedWithdrawal.users?.name || 'Unknown User'}</p>
                                  <p className="text-[10px] text-muted-foreground truncate">{selectedWithdrawal.users?.email}</p>
                              </div>
                          </div>
                      </div>

                      {selectedWithdrawal.status === 'pending' ? (
                          <div className="space-y-4 pt-2">
                            <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl mb-4">
                                <p className="text-xs font-bold text-amber-500 flex items-center gap-2 mb-1">
                                    <AlertCircle className="h-4 w-4" /> Warning: Potential Trade Wash
                                </p>
                                <p className="text-[10px] text-muted-foreground">This user has high trading activity. Verify trades before approving.</p>
                            </div>
                              <div className="space-y-2">
                                  <label className="text-[10px] font-bold text-muted-foreground uppercase px-1">Admin Feedback / Notes</label>
                                  <textarea
                                      placeholder="Add rejection reason or approval notes..."
                                      value={rejectReason}
                                      onChange={(e) => setRejectReason(e.target.value)}
                                      className="w-full h-24 p-4 bg-muted/50 border border-border rounded-2xl text-sm focus:outline-none transition-all focus:ring-2 focus:ring-primary/20"
                                  />
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                  <button
                                      onClick={() => handleUpdateWithdrawal(selectedWithdrawal.id, 'rejected')}
                                      disabled={processing}
                                      className="h-12 border border-destructive/50 text-destructive font-bold rounded-2xl hover:bg-destructive/10 transition-colors disabled:opacity-50"
                                  >
                                      Reject Request
                                  </button>
                                  <button
                                      onClick={() => handleUpdateWithdrawal(selectedWithdrawal.id, 'approved')}
                                      disabled={processing}
                                      className="h-12 bg-primary text-primary-foreground font-bold rounded-2xl hover:opacity-90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
                                  >
                                      Approve & Finalize
                                  </button>
                              </div>
                          </div>
                      ) : (
                          <div className={cn(
                              "p-4 rounded-2xl border flex items-center gap-3",
                              selectedWithdrawal.status === 'approved' ? 'bg-success/10 border-success/50 text-success' : 'bg-destructive/10 border-destructive/50 text-destructive'
                          )}>
                              {selectedWithdrawal.status === 'approved' ? <CheckCircle className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                              <div>
                                  <p className="text-xs font-bold uppercase tracking-wide">This withdrawal was {selectedWithdrawal.status}</p>
                                  {selectedWithdrawal.admin_feedback && <p className="text-[10px] opacity-80 mt-1 leading-relaxed">{selectedWithdrawal.admin_feedback}</p>}
                                  <p className="text-[9px] opacity-60 mt-1 uppercase font-bold">{format(new Date(selectedWithdrawal.created_at), 'MMM dd, yyyy HH:mm')}</p>
                              </div>
                          </div>
                      )}
                  </div>
              </DetailModal>
          )}


          {selectedDeposit && (
              <DetailModal title="Review Deposit" onClose={() => setSelectedDeposit(null)}>
                  <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                          <InfoItem label="Amount" value={`$${selectedDeposit.amount}`} />
                          <InfoItem label="Currency" value={selectedDeposit.currency} />
                          <div className="col-span-2">
                            <InfoItem label="TX Hash" value={selectedDeposit.tx_hash || 'N/A'} />
                          </div>
                      </div>

                      <div className="space-y-2">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase px-1">Transaction Receipt</label>
                          <div className="aspect-video rounded-2xl bg-muted border border-border overflow-hidden relative">
                              {selectedDeposit.receipt_url ? (
                                  <>
                                    <img src={selectedDeposit.receipt_url} alt="Receipt" className="w-full h-full object-contain" />
                                    <a href={selectedDeposit.receipt_url} target="_blank" className="absolute top-2 right-2 p-2 bg-background/50 backdrop-blur-sm rounded-lg hover:bg-background/80 transition-all">
                                        <ExternalLink className="h-4 w-4" />
                                    </a>
                                  </>
                              ) : (
                                  <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
                                      <FileText className="h-8 w-8 opacity-20" />
                                      <p className="text-xs">No receipt uploaded</p>
                                  </div>
                              )}
                          </div>
                      </div>

                      {selectedDeposit.status === 'pending' ? (
                          <div className="space-y-4">
                              <textarea 
                                placeholder="Rejection reason..."
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                className="w-full p-4 bg-muted/50 border border-border rounded-2xl text-sm min-h-[80px]"
                              />
                              <div className="grid grid-cols-2 gap-4">
                                  <button onClick={() => handleUpdateDeposit(selectedDeposit.id, 'approved')} disabled={processing} className="h-12 bg-primary text-primary-foreground font-bold rounded-2xl">Approve</button>
                                  <button onClick={() => handleUpdateDeposit(selectedDeposit.id, 'rejected')} disabled={processing} className="h-12 bg-destructive text-destructive-foreground font-bold rounded-2xl">Reject</button>
                              </div>
                          </div>
                      ) : (
                          <div className={cn("p-4 rounded-2xl text-center font-bold", selectedDeposit.status === 'approved' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive')}>
                              DEPOSIT {selectedDeposit.status.toUpperCase()}
                          </div>
                      )}
                  </div>
              </DetailModal>
          )}
      </AnimatePresence>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any, label: string, value: number, color: string }) {
    const colors = {
        primary: "bg-primary/10 text-primary",
        amber: "bg-amber-500/10 text-amber-500",
        success: "bg-success/10 text-success",
        blue: "bg-blue-500/10 text-blue-500"
    };
    return (
        <div className="bg-card border border-border p-4 md:p-6 rounded-3xl">
            <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center mb-3 md:mb-4 transition-transform group-hover:scale-110", colors[color as keyof typeof colors])}>
                <Icon className="h-5 w-5" />
            </div>
            <p className="text-[10px] text-muted-foreground tracking-wide uppercase font-bold mb-1">{label}</p>
            <h3 className="text-2xl md:text-3xl font-bold tracking-tight">{value}</h3>
        </div>
    );
}

function DetailModal({ title, children, onClose }: { title: string, children: React.ReactNode, onClose: () => void }) {
    return (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, y: 100 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 100 }} className="relative w-full max-w-2xl bg-card border-x border-t md:border border-border shadow-2xl rounded-t-[2.5rem] md:rounded-[2.5rem] overflow-hidden flex flex-col max-h-[92vh]">
                <div className="px-6 py-4 md:px-8 md:py-6 border-b border-border flex items-center justify-between">
                    <h2 className="text-lg md:text-xl font-bold">{title}</h2>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted"><XCircle className="h-6 w-6 text-muted-foreground" /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 md:p-8">{children}</div>
            </motion.div>
        </div>
    );
}

function InfoItem({ label, value }: { label: string, value: string }) {
    return (
      <div className="bg-muted/30 px-4 py-3 rounded-2xl border border-border/50">
        <p className="text-[10px] text-muted-foreground mb-0.5 uppercase tracking-wide font-bold">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    );
}

function DocumentImage({ label, url }: { label: string, url: string }) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground">{label}</span>
          {url && (
              <a href={url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary font-bold flex items-center gap-1 hover:underline">
                  <ExternalLink className="h-2.5 w-2.5" /> VIEW FULL SIZE
              </a>
          )}
        </div>
        <div className="aspect-4/3 rounded-2xl bg-muted border border-border overflow-hidden group relative flex items-center justify-center">
          {url ? (
            <img src={url} alt={label} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground/30">
              <Shield className="h-10 w-10" />
              <span className="text-[10px] font-bold">MISSING</span>
            </div>
          )}
        </div>
      </div>
    );
}

function parseMarkdownForPreview(markdown: string): string {
  if (!markdown) return "<p style='color: #9ca3af;'>Type content to preview...</p>";
  
  let html = markdown
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Bold
  html = html.replace(/(\*\*|__)(.*?)\1/g, "<strong>$2</strong>");

  // Italic
  html = html.replace(/(\*|_)(.*?)\1/g, "<em>$2</em>");

  // Headers
  html = html.replace(/^### (.*?)$/gm, '<h3 style="margin-top: 16px; margin-bottom: 8px; font-size: 16px; font-weight: bold; color: #111827; font-family: Arial, sans-serif;">$1</h3>');
  html = html.replace(/^## (.*?)$/gm, '<h2 style="margin-top: 18px; margin-bottom: 8px; font-size: 18px; font-weight: bold; color: #111827; font-family: Arial, sans-serif;">$1</h2>');
  html = html.replace(/^# (.*?)$/gm, '<h1 style="margin-top: 20px; margin-bottom: 8px; font-size: 20px; font-weight: bold; color: #111827; font-family: Arial, sans-serif;">$1</h1>');

  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 16px 0;" />');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color: #f97316; text-decoration: underline; font-weight: 600;">$1</a>');

  // Bullet lists
  html = html.replace(/^\s*[-*+]\s+(.*?)$/gm, '<li style="margin-bottom: 4px; color: #4b5563; font-size: 14px; font-family: Arial, sans-serif;">$1</li>');
  html = html.replace(/(<li.*?>.*?<\/li>\n?)+/g, (match) => {
    return `<ul style="margin-top: 6px; margin-bottom: 12px; padding-left: 20px; list-style-type: disc;">${match}</ul>`;
  });

  // Paragraphs
  const blocks = html.split(/\n\n+/);
  const formattedBlocks = blocks.map(block => {
    const trimmed = block.trim();
    if (!trimmed) return "";
    if (trimmed.startsWith("<h") || trimmed.startsWith("<ul") || trimmed.startsWith("<hr") || trimmed.startsWith("<li")) {
      return trimmed.replace(/\n/g, "<br />");
    }
    const withBrs = trimmed.replace(/\n/g, "<br />");
    return `<p style="margin: 0 0 12px; line-height: 1.5; color: #4b5563; font-size: 14px; font-family: Arial, sans-serif;">${withBrs}</p>`;
  });

  return formattedBlocks.filter(b => b !== "").join("\n");
}
