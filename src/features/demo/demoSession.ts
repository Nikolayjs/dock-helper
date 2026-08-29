/**
 * The guest session: a whole application running on made-up data, with no account and no server.
 *
 * Kept in `sessionStorage`, not `localStorage`, and that is the honest place for it: the demo
 * promises that nothing is saved, and a tab that is closed takes it with it. A second tab starts a
 * fresh demo, which is also what a visitor showing the product to a colleague expects.
 */
const SESSION_KEY = 'medassist:demo';
/** Where the made-up data lives while the tab is open. Cleared together with the flag. */
export const DEMO_DATA_KEY = 'medassist:demo-data';

/** `sessionStorage` throws in a browser configured to block site data — a demo is not worth a crash. */
function safely<T>(read: () => T, fallback: T): T {
  try {
    return read();
  } catch {
    return fallback;
  }
}

export function isDemoSession(): boolean {
  return safely(() => sessionStorage.getItem(SESSION_KEY) === '1', false);
}

export function startDemoSession(): void {
  safely(() => {
    sessionStorage.setItem(SESSION_KEY, '1');
    sessionStorage.removeItem(DEMO_DATA_KEY);
  }, undefined);
}

export function endDemoSession(): void {
  safely(() => {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(DEMO_DATA_KEY);
  }, undefined);
}
