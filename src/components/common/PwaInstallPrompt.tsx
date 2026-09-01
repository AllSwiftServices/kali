"use client";

import React, { useEffect, useState } from 'react';
import { Share, X, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export function PwaInstallPrompt() {
    const [installPrompt, setInstallPrompt] = useState<any>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [isIOS, setIsIOS] = useState(false);

    useEffect(() => {
        // Check if iOS
        const userAgent = window.navigator.userAgent.toLowerCase();
        const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
        setIsIOS(isIosDevice);

        // Check standalone (already installed)
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;

        if (isStandalone) return;

        // Android / Desktop Chrome handling
        const handleBeforeInstallPrompt = (e: any) => {
            e.preventDefault();
            setInstallPrompt(e);
            // Show prompt after a delay
            setTimeout(() => setIsVisible(true), 3000);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        // iOS detection - showing prompt if not standalone
        if (isIosDevice && !isStandalone) {
            // Only show once per session or use local storage
            const hasDismissed = localStorage.getItem('pwa_prompt_dismissed');
            if (!hasDismissed) {
                setTimeout(() => setIsVisible(true), 3000);
            }
        }

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    const handleInstall = async () => {
        if (installPrompt) {
            installPrompt.prompt();
            const { outcome } = await installPrompt.userChoice;
            if (outcome === 'accepted') {
                setInstallPrompt(null);
                setIsVisible(false);
            }
        }
    };

    const handleDismiss = () => {
        setIsVisible(false);
        localStorage.setItem('pwa_prompt_dismissed', 'true');
    };

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div 
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 50 }}
                    className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50"
                >
                    <div className="bg-card/95 backdrop-blur-xl border border-primary/20 rounded-2xl p-4 shadow-2xl flex flex-col gap-3">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                    <Download className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-foreground">Install App</h3>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        {isIOS
                                            ? "Install Kali App for a better experience."
                                            : "Install our app for faster access and better performance."}
                                    </p>
                                </div>
                            </div>
                            <button onClick={handleDismiss} className="text-muted-foreground hover:text-foreground transition-colors p-1">
                                <X size={18} />
                            </button>
                        </div>

                        {isIOS ? (
                            <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-xl flex items-center justify-center">
                                Tap <Share className="inline w-4 h-4 mx-1.5" /> then "Add to Home Screen"
                            </div>
                        ) : (
                            <button
                                onClick={handleInstall}
                                className="w-full bg-primary hover:opacity-90 text-primary-foreground font-bold py-2.5 rounded-xl transition-all shadow-lg shadow-primary/20 active:scale-95"
                            >
                                Install Now
                            </button>
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
