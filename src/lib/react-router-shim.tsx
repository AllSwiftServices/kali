"use client";

import { useCallback, useMemo } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

export const useNavigate = () => {
  const router = useRouter();
  
  return useCallback((to: string | number) => {
    if (typeof to === 'number') {
      if (to === -1) {
        router.back();
      } else if (to === 1) {
        router.forward();
      }
    } else {
      router.push(to as string);
    }
  }, [router]);
};

export const useLocation = () => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  return useMemo(() => ({
    pathname,
    search: searchParams.toString(),
    hash: '',
    state: null,
    key: 'default',
  }), [pathname, searchParams]);
};

export const useParams = () => {
  // Simple shim, Next.js params are usually passed to the page
  return {};
};

export const Link = ({ to, children, ...props }: any) => {
  return <a href={to} {...props}>{children}</a>;
};

export const BrowserRouter = ({ children }: any) => <>{children}</>;
export const Routes = ({ children }: any) => <>{children}</>;
export const Route = ({ children }: any) => <>{children}</>;
