"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, User, Mail, Save, RefreshCcw } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useNavigate } from '@/lib/react-router-shim';
import { createPageUrl } from '@/utils';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function PersonalInfoPage() {
  const { user, isLoadingAuth, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isLoadingAuth && !user) navigate(createPageUrl('Home'));
  }, [user, isLoadingAuth, navigate]);

  useEffect(() => {
    if (user) {
      setName(user.name || user.user_metadata?.full_name || '');
    }
  }, [user]);

  const email = user?.email || '';
  const hasChanged = name.trim() !== (user?.name || user?.user_metadata?.full_name || '');

  const handleSave = async () => {
    if (!user || !name.trim()) return;
    setSaving(true);
    try {
      const { error } = await api.put(`/users/${user.id}`, { name: name.trim() });
      if (error) throw error;
      await refreshUser();
      toast.success('Profile updated successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen pb-32 md:pb-8 bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-30 backdrop-blur-xl border-b bg-background/95 border-border">
        <div className="px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-muted transition-colors">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="font-bold text-xl">Personal Information</h1>
        </div>
      </header>

      <div className="px-4 py-6 space-y-6 max-w-lg mx-auto">
        {/* Avatar + Email */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl bg-card border border-border p-6 flex flex-col items-center text-center"
        >
          <div className="h-20 w-20 rounded-full bg-primary flex items-center justify-center shadow-xl shadow-primary/20 mb-4">
            <span className="text-2xl font-black text-black">
              {(name || email).charAt(0).toUpperCase()}
            </span>
          </div>
          <p className="font-bold text-lg">{name || 'Your Name'}</p>
          <p className="text-sm text-muted-foreground mt-0.5">{email}</p>
        </motion.div>

        {/* Edit Form */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-3xl bg-card border border-border overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-bold text-sm">Edit Profile</h2>
          </div>

          <div className="p-5 space-y-4">
            {/* Name */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Full Name</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Enter your full name"
                  className="w-full h-12 pl-11 pr-4 rounded-2xl bg-muted/50 border border-border text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
            </div>

            {/* Email (read-only) */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  readOnly
                  className="w-full h-12 pl-11 pr-4 rounded-2xl bg-muted/30 border border-border text-sm text-muted-foreground cursor-not-allowed"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">Email cannot be changed</p>
            </div>
          </div>

          {/* Save Button */}
          <div className="px-5 pb-5">
            <button
              onClick={handleSave}
              disabled={!hasChanged || saving || !name.trim()}
              className={cn(
                "w-full h-14 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all",
                hasChanged && name.trim() && !saving
                  ? "bg-primary text-white shadow-xl shadow-primary/20 hover:opacity-90 active:scale-[0.98]"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              {saving ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
