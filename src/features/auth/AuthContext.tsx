import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Loader, Stack } from '@mantine/core';

import { setAuthToken } from '../../lib/tokenStore';
import { loadClinicSettings } from '../patients/clinicSettings';
import { LoginPage } from '../../pages/LoginPage';
import { me } from './authApi';
import type { AuthUser } from './types';

const AuthContext = createContext<AuthUser | null>(null);
const AuthUpdaterContext = createContext<((user: AuthUser) => void) | null>(null);
const LogoutContext = createContext<(() => void) | null>(null);

const TOKEN_STORAGE_KEY = 'medassist:auth-token';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  // Distinguishes "still checking a stored token" (show a loader) from "checked, none valid"
  // (show the login screen) — both start out looking like "no user yet".
  const [checkingStoredToken, setCheckingStoredToken] = useState(true);

  /** Common tail of both "stored token turned out valid" and "just logged in": wire the token
   * into the fetch helpers, persist it, load clinic settings, then reveal the app. */
  const finishLogin = async (token: string, user: AuthUser) => {
    setAuthToken(token);
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    await loadClinicSettings();
    setUser(user);
  };

  useEffect(() => {
    let cancelled = false;
    const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!stored) {
      setCheckingStoredToken(false);
      return;
    }

    me(stored)
      .then((user) => {
        if (!cancelled) return finishLogin(stored, user);
      })
      .catch(() => {
        // Stored token expired/invalid — fall through to the login screen.
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      })
      .finally(() => {
        if (!cancelled) setCheckingStoredToken(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = () => {
    setAuthToken(null);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setUser(null);
  };

  if (checkingStoredToken) {
    return (
      <Stack align="center" justify="center" mih="100vh">
        <Loader />
      </Stack>
    );
  }

  if (!user) {
    return <LoginPage onLoggedIn={finishLogin} />;
  }

  return (
    <AuthContext.Provider value={user}>
      <AuthUpdaterContext.Provider value={setUser}>
        <LogoutContext.Provider value={handleLogout}>{children}</LogoutContext.Provider>
      </AuthUpdaterContext.Provider>
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthUser {
  const user = useContext(AuthContext);
  if (!user) throw new Error('useAuth must be used within an AuthProvider');
  return user;
}

/** Lets a successful profile save (name/role/avatar/signature) update the cached user everywhere `useAuth()` reads from. */
export function useUpdateAuthUser(): (user: AuthUser) => void {
  const setUser = useContext(AuthUpdaterContext);
  if (!setUser) throw new Error('useUpdateAuthUser must be used within an AuthProvider');
  return setUser;
}

/** Clears the session and returns to the login screen. */
export function useLogout(): () => void {
  const logout = useContext(LogoutContext);
  if (!logout) throw new Error('useLogout must be used within an AuthProvider');
  return logout;
}
