import { setAuthToken } from '../../lib/tokenStore';

/**
 * The stored session token.
 *
 * The key is part of the contract with every browser that already has a doctor logged in —
 * renaming it would log everyone out on deploy — so it lives in one place and is never rebuilt
 * from parts. Reading and writing it always goes together with the in-memory token that the fetch
 * helpers read, hence these three functions rather than bare `localStorage` calls.
 */
const TOKEN_STORAGE_KEY = 'medassist:auth-token';

export function readStoredToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function storeToken(token: string): void {
  setAuthToken(token);
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearStoredToken(): void {
  setAuthToken(null);
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}
