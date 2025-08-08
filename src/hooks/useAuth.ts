'use client';

import { useState, useEffect } from 'react';

interface User {
  id: string;
  email: string;
  username: string;
  firstName?: string;
  lastName?: string;
  profileImage?: string;
  isActive: boolean;
  isVerified: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export const useAuth = (): AuthState => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    token: null,
    isLoading: true,
    isAuthenticated: false
  });

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Get session token from cookie
        const sessionToken = document.cookie
          .split('; ')
          .find(row => row.startsWith('session_token='))
          ?.split('=')[1];

        if (!sessionToken) {
          setAuthState({
            user: null,
            token: null,
            isLoading: false,
            isAuthenticated: false
          });
          return;
        }

        // Validate session with API
        const response = await fetch('/api/auth/me', {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const userData = await response.json();
          setAuthState({
            user: userData.user,
            token: sessionToken,
            isLoading: false,
            isAuthenticated: true
          });
        } else {
          // Session is invalid, clear it
          document.cookie = 'session_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
          setAuthState({
            user: null,
            token: null,
            isLoading: false,
            isAuthenticated: false
          });
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        setAuthState({
          user: null,
          token: null,
          isLoading: false,
          isAuthenticated: false
        });
      }
    };

    checkAuth();

    // Listen for auth changes (e.g., login/logout in other tabs)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'auth_changed') {
        checkAuth();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  return authState;
};

// Helper function to trigger auth state refresh across tabs
export const triggerAuthRefresh = () => {
  localStorage.setItem('auth_changed', Date.now().toString());
  localStorage.removeItem('auth_changed');
};

// Helper function to logout
export const logout = async () => {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include'
    });
  } catch (error) {
    console.error('Logout failed:', error);
  } finally {
    // Clear session cookie
    document.cookie = 'session_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    triggerAuthRefresh();
  }
};