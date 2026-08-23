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
