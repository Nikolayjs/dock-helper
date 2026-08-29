/**
 * Where the private application lives in the URL.
 *
 * The public site (landing, login, pricing, legal) sits at the root; everything that needs a
 * doctor's session sits under this prefix. It is declared once and consumed in exactly four
 * places — the bootstrap that picks which router to mount, the app router's `basename`, the
 * redirect to the login screen, and the redirect back after a successful login — so moving the
 * application to another prefix stays a one-line change.
 *
 * In-app links are *not* prefixed by hand: the app router carries this as its `basename`, so
 * `to="/patients"` inside the application already resolves to `/app/patients`.
 */
export const APP_BASE = '/app';

/** True for URLs that belong to the application rather than to the public site. */
export function isAppPath(pathname: string): boolean {
  return pathname === APP_BASE || pathname.startsWith(`${APP_BASE}/`);
}

/**
 * Where to land after a successful login.
 *
 * `from` arrives in the query string, which anyone can write, so it is only honoured when it
 * points inside the application. An unchecked value here is an open redirect: a link to
 * `/login?from=https://evil.example` would send a doctor there right after they typed a password.
 */
export function loginTarget(from: string | null): string {
  if (from && isAppPath(from) && !from.startsWith('//')) return from;
  return `${APP_BASE}/dashboard`;
}
