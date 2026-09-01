"use client";

import React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Bell, Check, Clock, Trash2, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

interface Notification {
  id: string;
  title: string;
  body: string;
  url?: string;
  is_read: boolean;
  created_at: string;
}

interface NotificationDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NotificationDrawer({ open, onOpenChange }: NotificationDrawerProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { user } = useAuth();

  const { data: notifications, isLoading } = useQuery<Notification[]>({
    queryKey: ["notifications"],
    queryFn: async () => {
      const { data, error } = await api.get<Notification[]>("/notifications");
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await api.post("/notifications", { ids });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) {
      markAsReadMutation.mutate([notification.id]);
    }
    if (notification.url) {
      let targetUrl = notification.url;
      if (targetUrl.startsWith("/admin") || targetUrl.startsWith("/admin-kyc")) {
        const lowercaseUrl = targetUrl.toLowerCase();
        if (lowercaseUrl.includes("support") || lowercaseUrl.includes("chat")) {
          targetUrl = "/profile/chat";
        } else if (lowercaseUrl.includes("deposit") || lowercaseUrl.includes("withdrawal") || lowercaseUrl.includes("wallet") || lowercaseUrl.includes("transaction")) {
          targetUrl = "/wallet";
        } else if (lowercaseUrl.includes("trade")) {
          targetUrl = "/trade";
        } else {
          targetUrl = "/dashboard";
        }
      }
      router.push(targetUrl);
      onOpenChange(false);
    }
  };

  const markAllAsRead = () => {
    if (!notifications) return;
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (unreadIds.length > 0) {
      markAsReadMutation.mutate(unreadIds);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col gap-0 border-l border-border bg-background">
        <SheetHeader className="p-6 border-b border-border bg-card">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2 text-xl font-bold">
              <Bell className="h-5 w-5 text-primary" />
              Notifications
            </SheetTitle>
            {notifications && notifications.some(n => !n.is_read) && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={markAllAsRead}
                className="text-xs text-primary hover:text-primary/80 hover:bg-primary/5"
              >
                Mark all as read
              </Button>
            )}
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-4 animate-pulse">
                  <div className="w-10 h-10 rounded-full bg-muted shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-1/3" />
                    <div className="h-3 bg-muted rounded w-full" />
                    <div className="h-2 bg-muted rounded w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : notifications?.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center p-6">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Bell className="h-8 w-8 text-muted-foreground opacity-20" />
              </div>
              <p className="text-muted-foreground font-medium">No notifications yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">We'll notify you when something important happens.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              <AnimatePresence mode="popLayout">
                {notifications?.map((notification) => (
                  <motion.div
                    key={notification.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    onClick={() => handleNotificationClick(notification)}
                    className={cn(
                      "group p-6 cursor-pointer transition-all hover:bg-muted/50 relative overflow-hidden",
                      !notification.is_read && "bg-primary/5 dark:bg-primary/10"
                    )}
                  >
                    {!notification.is_read && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                    )}
                    
                    <div className="flex gap-4">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
                        notification.is_read ? "bg-muted text-muted-foreground" : "bg-primary text-white shadow-primary/20"
                      )}>
                        <Bell className="h-5 w-5" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h4 className={cn(
                            "text-sm font-semibold truncate leading-tight transition-colors",
                            notification.is_read ? "text-foreground/70" : "text-foreground",
                            "group-hover:text-primary"
                          )}>
                            {notification.title}
                          </h4>
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap flex items-center gap-1 font-medium bg-muted/50 px-2 py-0.5 rounded-full">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        <p className={cn(
                          "text-xs leading-relaxed line-clamp-2",
                          notification.is_read ? "text-muted-foreground/60" : "text-muted-foreground"
                        )}>
                          {notification.body}
                        </p>
                        
                        {notification.url && (
                          <div className="mt-3 flex items-center gap-1 text-[10px] font-bold text-primary uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">
                            View Details <ExternalLink className="h-3 w-3" />
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
