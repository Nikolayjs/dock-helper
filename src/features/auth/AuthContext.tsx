import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import { setSessionExpiredHandler } from '../../lib/tokenStore';
import { loadClinicSettings } from '../patients/clinicSettings';
import { me } from './authApi';
import { clearStoredToken, readStoredToken, storeToken } from './session';
import type { AuthUser } from './types';

const AuthContext = createContext<AuthUser | null>(null);
const AuthUpdaterContext = createContext<((user: AuthUser) => void) | null>(null);
const LogoutContext = createContext<(() => void) | null>(null);

export interface AuthState {
  user: AuthUser | null;
  /** Distinguishes "still checking a stored token" from "checked, none valid". */
  checkingStoredToken: boolean;
}

const AuthStateContext = createContext<AuthState | null>(null);

/** Leaves for the login screen, remembering where the doctor was heading. */
function goToLogin(): void {
  const from = `${window.location.pathname}${window.location.search}`;
  window.location.replace(`/login?from=${encodeURIComponent(from)}`);
}

/**
 * Holds the session; it no longer decides what the browser shows.
 *
 * It used to render `<LoginPage />` in place of its children, which meant no URL outside the
 * application could ever render — a public landing page was impossible while this component was
 * the gatekeeper. Now it only reports state, and `RequireAuth` (a route element, so it can
 * navigate) decides. This provider is mounted only under the application, so the token check
 * never fires on a public page.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checkingStoredToken, setCheckingStoredToken] = useState(true);

  /** Common tail of both "stored token turned out valid" and "just logged in": wire the token
   * into the fetch helpers, persist it, load clinic settings, then reveal the app.
   *
   * Clinic settings are awaited *before* the user is published on purpose: components that print
   * a letterhead read them synchronously during render (`DocumentLetterhead`,
   * `DocumentSignature`, `TemplateDocument`), so they must be in place before anything mounts. */
  const finishLogin = async (token: string, user: AuthUser) => {
    storeToken(token);
    await loadClinicSettings();
    setUser(user);
  };

  useEffect(() => {
    let cancelled = false;
    const stored = readStoredToken();
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
        clearStoredToken();
      })
      .finally(() => {
        if (!cancelled) setCheckingStoredToken(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A token that expires mid-session used to surface as a toast on every screen while the doctor
  // stayed sitting inside the application. The fetch helpers report the first 401 here.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      clearStoredToken();
      setUser(null);
      goToLogin();
    });
    return () => setSessionExpiredHandler(null);
  }, []);

  const handleLogout = () => {
    clearStoredToken();
    setUser(null);
    // The public site and the application are two routers; crossing between them is a page load.
    window.location.assign('/login');
  };

  return (
    <AuthStateContext.Provider value={{ user, checkingStoredToken }}>
      <AuthContext.Provider value={user}>
        <AuthUpdaterContext.Provider value={setUser}>
          <LogoutContext.Provider value={handleLogout}>{children}</LogoutContext.Provider>
        </AuthUpdaterContext.Provider>
      </AuthContext.Provider>
    </AuthStateContext.Provider>
  );
}

/** The signed-in doctor. Only valid under `RequireAuth`, which is where every screen using it lives. */
export function useAuth(): AuthUser {
  const user = useContext(AuthContext);
  if (!user) throw new Error('useAuth must be used within an AuthProvider');
  return user;
}

/** Session state including "not signed in" — for the gate itself, which has to render before there is a user. */
export function useAuthState(): AuthState {
  const state = useContext(AuthStateContext);
  if (!state) throw new Error('useAuthState must be used within an AuthProvider');
  return state;
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
