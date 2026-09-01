import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { showToast } from '@/lib/toast';

export interface User {
  id: string;
  email: string;
  name?: string;
  role?: string;
  email_verified?: boolean;
  kyc_status?: 'not_started' | 'pending' | 'approved' | 'rejected';
  user_metadata?: any;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoadingAuth: boolean;
  authError: string | null;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const router = useRouter();

  const refreshUser = useCallback(async () => {
    try {
      const { data, error } = await api.get<{ user: User | null }>('/auth/session');
      if (error) throw error;
      
      setUser(data?.user || null);
    } catch (error: any) {
      console.error('Error checking auth session:', error);
      setAuthError(error.message);
      setUser(null);
    } finally {
      setIsLoadingAuth(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
    
    // We remove the onAuthStateChange listener as we no longer have the supabase client here.
    // Auth state is now managed via cookies and server routes.
  }, [refreshUser]);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout', {});
      setUser(null);
      showToast.dismiss();
      router.push('/');
      router.refresh();
    } catch (error: any) {
      console.error('Error logging out:', error);
      setUser(null);
      showToast.dismiss();
      router.push('/');
    }
  }, [router]);

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      isLoadingAuth,
      authError,
      logout,
      refreshUser
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
