import { useEffect } from 'react';
import { Loader, Stack } from '@mantine/core';
import { Outlet, useLocation } from 'react-router-dom';

import { APP_BASE } from '../lib/appBase';
import { useAuthState, useLogout } from '../features/auth/AuthContext';
import { IdleLockScreen } from '../features/auth/IdleLockScreen';
import { useIdleLock } from '../features/auth/useIdleLock';
import { isDemoSession } from '../features/demo/demoSession';

function FullScreenLoader() {
  return (
    <Stack align="center" justify="center" mih="100vh">
      <Loader />
    </Stack>
  );
}

/**
 * Sends an unauthenticated visitor to the login screen, remembering where they were going.
 *
 * A plain `<Navigate to="/login" />` cannot be used: this router carries `basename="/app"`, so
 * every path it resolves gets that prefix and the doctor would land on `/app/login`. The login
 * screen lives on the public site, which is a different router — so crossing over is a page load,
 * and the destination travels in the query string rather than in router state, which would not
 * survive it.
 */
function RedirectToLogin() {
  const location = useLocation();
  // `location.pathname` here is already stripped of the basename, so it goes back on.
  const from = `${APP_BASE}${location.pathname}${location.search}`;

  useEffect(() => {
    window.location.replace(`/login?from=${encodeURIComponent(from)}`);
  }, [from]);

  return <FullScreenLoader />;
}

/** The gate on everything under `/app`. */
export function RequireAuth() {
  const { user, checkingStoredToken } = useAuthState();
  const logout = useLogout();
  // В демо блокировать нечего: пароля у гостя нет, и разблокировать было бы нечем.
  const { locked, unlock } = useIdleLock(Boolean(user) && !isDemoSession());

  if (checkingStoredToken) return <FullScreenLoader />;
  if (!user) return <RedirectToLogin />;
  return (
    <>
      <Outlet />
      {/* Поверх содержимого, а не вместо: страница с несохранённой формой остаётся смонтированной. */}
      {locked && <IdleLockScreen username={user.username} onUnlock={unlock} onLogout={logout} />}
    </>
  );
}
