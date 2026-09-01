"use client";

import { AuthProvider } from '@/lib/AuthContext';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { ThemeProvider } from '@/components/ui/ThemeProvider';
import { Toaster as UIProvider } from "@/components/ui/toaster";
import { Toaster as SonnerProvider } from 'sonner';

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <QueryClientProvider client={queryClientInstance}>
                <ThemeProvider>
                    {children}
                    <UIProvider />
                    <SonnerProvider position="top-center" richColors />
                </ThemeProvider>
            </QueryClientProvider>
        </AuthProvider>
    );
}
