/**
 * Holds the current JWT outside React state, so fetch helpers that aren't components
 * (e.g. httpRepository.ts) can read it synchronously without needing a context.
 * AuthContext is the only writer; everything else only reads.
 */
let token: string | null = null;

export function getAuthToken(): string | null {
  return token;
}

export function setAuthToken(next: string | null): void {
  token = next;
}

/**
 * What to do when the server says the session is over.
 *
 * The fetch helpers are plain functions with no access to React, and they are the only code that
 * ever sees a 401. Without this the doctor stayed inside the application looking at a toast that
 * said "request failed (401)" on every screen, with no way to understand that they had simply been
 * logged out. AuthContext registers the handler; nothing else writes here.
 */
let sessionExpired: (() => void) | null = null;

export function setSessionExpiredHandler(handler: (() => void) | null): void {
  sessionExpired = handler;
}

/** Called from the fetch helpers on a 401. Fires once: the first 401 already ends the session. */
export function reportSessionExpired(): void {
  if (!token) return;
  token = null;
  sessionExpired?.();
}
