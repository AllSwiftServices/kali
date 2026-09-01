"use client";

import { Suspense } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from '@/components/navigation/Sidebar';
import BottomNav from '@/components/navigation/BottomNav';
import { PwaInstallPrompt } from '@/components/common/PwaInstallPrompt';
import { NotificationPrompt } from '@/components/common/NotificationPrompt';
import { createPageUrl } from '@/utils';
import { useAuth } from '@/lib/AuthContext';
import { useEffect } from 'react';

const authPages = ['/'];
const noNavPages = ['/verify-identity', '/admin-kyc', '/profile/chat'];

export default function AppContent({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const { user, isLoadingAuth } = useAuth();

    const isAuthPage = authPages.includes(pathname);
    const isNoNavPage = noNavPages.some(path => pathname.startsWith(path));
    const isPublicPath = isAuthPage || isNoNavPage;
    
    // Paths that are accessible even without approved KYC
    const isAllowedWithoutKyc = pathname.startsWith('/wallet') || pathname.startsWith('/profile');

    useEffect(() => {
        // Don't gate while auth is loading, on auth pages, or on no-nav pages
        if (isLoadingAuth || isPublicPath) return;

        if (user) {
            // Admins bypass KYC gate
            if (user.role === 'admin') return;

            // Allow access to wallet and profile without KYC
            if (isAllowedWithoutKyc) return;

            // If user is logged in, gate other pages if KYC is not approved AND not rejected 
            // (rejected means they can come to resubmit)
            if (user.kyc_status !== 'approved' && user.kyc_status !== 'rejected') {
                router.push('/verify-identity');
            }
        }
    }, [user, isLoadingAuth, pathname, isPublicPath, isAllowedWithoutKyc, router]);

    if (isAuthPage || isNoNavPage) {
        return (
            <div className="min-h-screen bg-background">
                <Suspense fallback={<div className="min-h-screen bg-background" />}>
                    {children}
                </Suspense>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            <Suspense fallback={null}>
                <Sidebar />
            </Suspense>
            <main className="md:ml-64">
                <Suspense fallback={<div className="p-8"><div className="h-32 w-full animate-pulse bg-muted rounded-3xl" /></div>}>
                    {children}
                </Suspense>
            </main>
            <Suspense fallback={null}>
                <BottomNav />
            </Suspense>
            <PwaInstallPrompt />
            <NotificationPrompt />
        </div>
    );
}
