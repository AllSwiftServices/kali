"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  User, Shield, Moon, Sun, ChevronRight, LogOut,
  CheckCircle, Clock, X, Lock, Bell, HelpCircle, FileText, Mail, MessageCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { useNavigate } from '@/lib/react-router-shim';
import { createPageUrl } from '@/utils';
import { useTheme } from '@/components/ui/ThemeProvider';
import { Switch } from '@/components/ui/switch';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { useAuth } from '@/lib/AuthContext';
import { showToast } from '@/lib/toast';
import { NotificationDrawer } from '@/components/notifications/NotificationDrawer';

const ProfileMenuItem = React.memo(({ item, isLast }: { item: any, isLast: boolean }) => {
  return (
    <div
      onClick={() => item.action()}
      className={cn(
        'w-full flex items-center justify-between p-4 px-6 transition-all',
        'hover:bg-muted/30 cursor-pointer active:scale-[0.99]',
        !isLast && 'border-b border-border'
      )}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          item.action();
        }
      }}
    >
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-2xl bg-muted/50 flex items-center justify-center">
          <item.icon className="h-5 w-5 text-muted-foreground" />
        </div>
        <span className="font-semibold text-sm">{item.label}</span>
      </div>
      <div className="flex items-center gap-3">
        {item.badge && (
          <span className={cn('text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider', item.badgeColor)}>
            {item.badge}
          </span>
        )}
        {item.toggle ? (
          <div onClick={(e) => e.stopPropagation()}>
            <Switch 
              checked={item.checked} 
              onCheckedChange={item.action} 
            />
          </div>
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground opacity-50" />
        )}
      </div>
    </div>
  );
});

ProfileMenuItem.displayName = 'ProfileMenuItem';

export default function ProfilePage() {
  const { user, logout, isLoadingAuth, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<any>({ name: '' });
  const [kycRecord, setKycRecord] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);

  const { isSubscribed, subscribeToPush, unsubscribeFromPush, isSupported } = usePushNotifications();

  useEffect(() => {
    setMounted(true);
    // Fetch unread support message count
    const fetchUnreads = async () => {
      try {
        const supportRes = await fetch('/api/support/unread');
        const supportJson = await supportRes.json();
        setUnreadCount(supportJson.count || 0);

        const notifRes = await fetch('/api/notifications');
        const notifJson = await notifRes.json();
        const unreadNotifs = notifJson.filter((n: any) => !n.is_read).length;
        setNotificationUnreadCount(unreadNotifs);
      } catch { /* ignore */ }
    };
    fetchUnreads();
    const interval = setInterval(fetchUnreads, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isLoadingAuth && !user) {
      navigate(createPageUrl('Home'));
    } else if (user && !isEditing) {
      const currentName = user.name || user.user_metadata?.full_name || '';
      if (formData.name !== currentName) {
        setFormData({
          name: currentName,
          email: user.email || '',
        });
      }
      
      if (!kycRecord) {
        loadKyc();
      }
    }
  }, [user, isLoadingAuth, navigate, kycRecord, isEditing, formData.name]);

  const loadKyc = React.useCallback(async () => {
    try {
      if (!user) return;
      const { data } = await api.get(`/kyc/${user.id}`);
      if (data) setKycRecord(data);
    } catch (error) {
      console.error('Error loading KYC:', error);
    }
  }, [user]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    try {
      const { error } = await api.put(`/users/${user.id}`, {
        name: formData.name,
      });
      if (error) throw error;

      await refreshUser();
      setIsEditing(false);
      showToast.success('Profile updated successfully');
    } catch (error: any) {
      showToast.error(error.message || 'Failed to update profile');
      console.error('Error updating profile:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    const toastId = showToast.loading('Logging out...');
    try {
      await logout();
      showToast.dismiss(toastId);
      showToast.success('Logged out');
    } catch (error) {
      showToast.dismiss(toastId);
      showToast.error('Logout failed');
    }
  };

  const comingSoon = React.useCallback(() => showToast.info('This feature is coming soon!'), []);

  const handleNotificationToggle = async () => {
    try {
      if (isSubscribed) {
        await unsubscribeFromPush();
        showToast.success('Notifications disabled');
      } else {
        const toastId = showToast.loading('Enabling notifications...');
        await subscribeToPush();
        showToast.success('Notifications enabled', { id: toastId });
      }
    } catch (error: any) {
      showToast.error(error.message || 'Failed to update notification settings');
    }
  };

  interface MenuItem {
    icon: any;
    label: string;
    action: () => void;
    badge?: string;
    badgeColor?: string;
    toggle?: boolean;
    checked?: boolean;
  }

  interface MenuSection {
    title: string;
    items: MenuItem[];
  }

  const menuItems = React.useMemo<MenuSection[]>(() => [
    {
      title: 'Account',
      items: [
        { icon: User, label: 'Personal Information', action: () => navigate('/profile/personal-info') },
        {
          icon: Shield,
          label: 'KYC Verification',
          badge: kycRecord?.status === 'approved' ? '✔ Verified' : kycRecord?.status === 'pending' ? '⏳ Pending' : kycRecord?.status === 'rejected' ? '✖ Failed' : 'Not Started',
          badgeColor: kycRecord?.status === 'approved' ? 'text-primary bg-primary/10' : kycRecord?.status === 'rejected' ? 'text-destructive bg-destructive/10' : 'text-muted-foreground bg-muted',
          action: () => navigate(createPageUrl('verify-identity'))
        },
        { icon: Lock, label: 'Security Settings', action: () => navigate('/profile/security') },
      ]
    },
    {
      title: 'Preferences',
      items: [
        {
          icon: !mounted ? Moon : (theme === 'dark' ? Moon : Sun),
          label: 'Dark Mode',
          toggle: true,
          checked: mounted && theme === 'dark',
          action: toggleTheme
        },
        {
          icon: Bell, 
          label: 'Notification History', 
          badge: notificationUnreadCount > 0 ? `${notificationUnreadCount} new` : undefined,
          badgeColor: 'text-white bg-destructive',
          action: () => setIsNotificationsOpen(true)
        },
        {
          icon: Shield, 
          label: 'Push Notifications', 
          toggle: true,
          checked: isSubscribed,
          action: isSupported ? handleNotificationToggle : () => showToast.error('Push notifications are not supported on this browser.')
        },
      ]
    },
    {
      title: 'Support',
      items: [
        { icon: HelpCircle, label: 'Help Center', action: () => navigate('/help-center') },
        { icon: MessageCircle, label: 'Live Chat',
          badge: unreadCount > 0 ? `${unreadCount} new` : 'Online',
          badgeColor: unreadCount > 0 ? 'text-black bg-primary' : 'text-success bg-success/10',
          action: () => navigate('/profile/chat') },
        { icon: FileText, label: 'Terms & Privacy', action: comingSoon },
      ]
    }
  ], [mounted, theme, kycRecord, navigate, toggleTheme, comingSoon, isSubscribed, isSupported, notificationUnreadCount]);

  return (
    <div className="min-h-screen pb-32 md:pb-8 bg-background text-foreground">
      {/* Drawer */}
      <NotificationDrawer 
        open={isNotificationsOpen} 
        onOpenChange={setIsNotificationsOpen} 
      />
      {/* Header */}
      <header className="sticky top-0 z-30 backdrop-blur-xl border-b bg-background/95 border-border">
        <div className="px-4 py-4 flex items-center justify-between">
          <h1 className="font-bold text-2xl">Profile</h1>
          {/* {!isEditing && (
            <button 
              onClick={() => setIsEditing(true)}
              className="px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-colors"
            >
              Edit
            </button>
          )} */}
        </div>
      </header>

      <div className="px-4 py-4 space-y-6">
        {/* User Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 rounded-3xl bg-card border border-border shadow-sm"
        >
          {isEditing ? (
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider ml-1">Full Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-muted/50 border border-border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                  placeholder="Enter your name"
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="flex-1 py-3 rounded-2xl border border-border font-bold text-sm hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3 rounded-2xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition-all disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          ) : (
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-3xl flex items-center justify-center font-bold text-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                {user?.user_metadata?.full_name?.charAt(0) || user?.email?.charAt(0) || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold truncate">{user?.user_metadata?.name || 'User'}</h2>
                <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                  {kycRecord?.status === 'approved' && <div className="flex items-center gap-1"><CheckCircle className="h-4 w-4 text-primary" /><span className="text-[10px] font-bold text-primary uppercase tracking-wider">Verified</span></div>}
                  {kycRecord?.status === 'pending' && <div className="flex items-center gap-1"><Clock className="h-4 w-4 text-amber-500" /><span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Pending</span></div>}
                  {kycRecord?.status === 'rejected' && <div className="flex items-center gap-1"><X className="h-4 w-4 text-destructive" /><span className="text-[10px] font-bold text-destructive uppercase tracking-wider">Failed</span></div>}
                </div>
              </div>
            </div>
          )}
        </motion.div>

        {/* Menu Sections */}
        {menuItems.map((section, sectionIndex) => (
          <motion.div
            key={section.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: (sectionIndex + 1) * 0.1 }}
          >
            <h3 className="text-sm font-medium text-muted-foreground mb-2 px-1">
              {section.title}
            </h3>
            <div className="rounded-3xl bg-card border border-border overflow-hidden">
              {section.items.map((item, itemIndex) => (
                <ProfileMenuItem 
                  key={item.label} 
                  item={item} 
                  isLast={itemIndex === section.items.length - 1} 
                />
              ))}
            </div>
          </motion.div>
        ))}

        {/* Logout Button */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          onClick={handleLogout}
          className={cn(
            'w-full flex items-center justify-center gap-2 p-4',
            'rounded-2xl bg-destructive/10 text-destructive',
            'font-bold hover:bg-destructive/20 transition-colors'
          )}
        >
          <LogOut className="h-5 w-5" />
          Log Out
        </motion.button>

        {/* Version */}
        <p className="text-center text-xs text-muted-foreground">
          Crypto.com v1.0.0
        </p>
      </div>
    </div>
  );
}