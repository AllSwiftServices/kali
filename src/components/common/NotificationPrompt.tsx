"use client";

import React, { useEffect, useState } from 'react';
import { Bell, BellRing, X } from 'lucide-react';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { motion, AnimatePresence } from 'framer-motion';

export function NotificationPrompt() {
    const { isSubscribed, subscribeToPush, permission, isSupported } = usePushNotifications();
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Don't show if not supported, already subscribed, or fundamentally denied natively
        if (!isSupported || isSubscribed || permission === 'denied') return;

        // Ensure we don't bombard them immediately
        const hasDismissed = localStorage.getItem('notification_prompt_dismissed');
        if (!hasDismissed) {
            // Wait a bit before asking, maybe 5 seconds
            const timer = setTimeout(() => setIsVisible(true), 5000);
            return () => clearTimeout(timer);
        }
    }, [isSupported, isSubscribed, permission]);

    const handleSubscribe = async () => {
        try {
            await subscribeToPush();
            setIsVisible(false);
        } catch (error) {
            console.error("User denied or internal error occurred", error);
        }
    };

    const handleDismiss = () => {
        setIsVisible(false);
        localStorage.setItem('notification_prompt_dismissed', 'true');
    };

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div 
                    initial={{ opacity: 0, y: -50 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -50 }}
                    className="fixed top-20 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50"
                >
                    <div className="bg-card/95 backdrop-blur-xl border border-primary/20 rounded-2xl p-4 shadow-2xl flex flex-col gap-3">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                    <BellRing className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-foreground">Turn on Notifications</h3>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        Stay updated on your deposits, trades, and portfolio performance in real-time.
                                    </p>
                                </div>
                            </div>
                            <button onClick={handleDismiss} className="text-muted-foreground hover:text-foreground transition-colors p-1">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="flex gap-2 mt-1">
                            <button
                                onClick={handleDismiss}
                                className="flex-1 bg-muted hover:bg-muted/80 text-foreground font-semibold py-2 rounded-xl transition-colors text-sm"
                            >
                                Not Now
                            </button>
                            <button
                                onClick={handleSubscribe}
                                className="flex-1 bg-primary hover:opacity-90 text-primary-foreground font-bold py-2 rounded-xl transition-all shadow-lg shadow-primary/20 active:scale-95 text-sm"
                            >
                                Enable
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
