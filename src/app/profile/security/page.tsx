"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, Lock, Eye, EyeOff, Shield, CheckCircle, RefreshCcw } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useNavigate } from '@/lib/react-router-shim';
import { createPageUrl } from '@/utils';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function SecuritySettingsPage() {
  const { user, isLoadingAuth } = useAuth();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isLoadingAuth && !user) navigate(createPageUrl('Home'));
  }, [user, isLoadingAuth, navigate]);

  const passwordStrength = React.useMemo(() => {
    if (!newPassword) return { score: 0, label: '', color: '' };
    let score = 0;
    if (newPassword.length >= 6) score++;
    if (newPassword.length >= 10) score++;
    if (/[A-Z]/.test(newPassword)) score++;
    if (/[0-9]/.test(newPassword)) score++;
    if (/[^A-Za-z0-9]/.test(newPassword)) score++;

    if (score <= 1) return { score, label: 'Weak', color: 'bg-destructive' };
    if (score <= 2) return { score, label: 'Fair', color: 'bg-amber-500' };
    if (score <= 3) return { score, label: 'Good', color: 'bg-primary' };
    return { score, label: 'Strong', color: 'bg-success' };
  }, [newPassword]);

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Failed to update password');
        return;
      }

      toast.success('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err.message || 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const passwordsMatch = newPassword && confirmPassword && newPassword === confirmPassword;
  const canSubmit = currentPassword && newPassword.length >= 6 && passwordsMatch;

  return (
    <div className="min-h-screen pb-32 md:pb-8 bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-30 backdrop-blur-xl border-b bg-background/95 border-border">
        <div className="px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-muted transition-colors">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="font-bold text-xl">Security Settings</h1>
        </div>
      </header>

      <div className="px-4 py-6 space-y-6 max-w-lg mx-auto">
        {/* Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl bg-card border border-border p-5 flex items-start gap-4"
        >
          <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-bold text-sm">Keep your account secure</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Use a strong password with at least 6 characters. We recommend mixing uppercase, lowercase, numbers, and symbols.
            </p>
          </div>
        </motion.div>

        {/* Password Form */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-3xl bg-card border border-border overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-bold text-sm">Change Password</h2>
            <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider">All fields required</p>
          </div>

          <div className="p-5 space-y-4">
            {/* Current Password */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Current Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full h-12 pl-11 pr-12 rounded-2xl bg-muted/50 border border-border text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">New Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full h-12 pl-11 pr-12 rounded-2xl bg-muted/50 border border-border text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {/* Strength Meter */}
              {newPassword && (
                <div className="space-y-1.5">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(i => (
                      <div
                        key={i}
                        className={cn(
                          'h-1 flex-1 rounded-full transition-colors',
                          i <= passwordStrength.score ? passwordStrength.color : 'bg-muted'
                        )}
                      />
                    ))}
                  </div>
                  <p className={cn('text-[10px] font-bold uppercase tracking-wider', passwordStrength.color.replace('bg-', 'text-'))}>
                    {passwordStrength.label}
                  </p>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Confirm New Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className={cn(
                    "w-full h-12 pl-11 pr-12 rounded-2xl bg-muted/50 border text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all",
                    confirmPassword && !passwordsMatch ? 'border-destructive' : 'border-border'
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {confirmPassword && !passwordsMatch && (
                <p className="text-[10px] font-bold text-destructive">Passwords do not match</p>
              )}
              {passwordsMatch && (
                <p className="text-[10px] font-bold text-success flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" /> Passwords match
                </p>
              )}
            </div>
          </div>

          {/* Submit */}
          <div className="px-5 pb-5">
            <button
              onClick={handleChangePassword}
              disabled={!canSubmit || saving}
              className={cn(
                "w-full h-14 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all",
                canSubmit && !saving
                  ? "bg-primary text-white shadow-xl shadow-primary/20 hover:opacity-90 active:scale-[0.98]"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              {saving ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
              {saving ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
