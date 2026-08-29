import { lazy, Suspense } from 'react';
import { Loader, Stack } from '@mantine/core';
import { createBrowserRouter, createRoutesFromElements, Outlet, Route, RouterProvider } from 'react-router-dom';

// Each public page in its own chunk: a visitor reading the landing should not download the login
// form's inputs, and someone following a link straight to /login should not download the landing.
const LandingPage = lazy(() => import('./pages/LandingPage').then((m) => ({ default: m.LandingPage })));
const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const DemoPage = lazy(() => import('./pages/DemoPage').then((m) => ({ default: m.DemoPage })));
const PricingPage = lazy(() => import('./pages/PricingPage').then((m) => ({ default: m.PricingPage })));
const LegalPage = lazy(() => import('./pages/legal/LegalPage').then((m) => ({ default: m.LegalPage })));
const PublicNotFoundPage = lazy(() => import('./pages/PublicNotFoundPage').then((m) => ({ default: m.PublicNotFoundPage })));

function PublicRoot() {
  return (
    <Suspense
      fallback={
        <Stack align="center" justify="center" mih="100vh">
          <Loader />
        </Stack>
      }
    >
      <Outlet />
    </Suspense>
  );
}

/**
 * The public site: everything a visitor can see without a session.
 *
 * Deliberately a separate router from the application's. The application declares `basename="/app"`
 * so that its hundred and fifty internal links keep working untouched — and a router with a
 * basename cannot resolve `/` at all. Which of the two is mounted is decided once, at boot, from
 * the address (`main.tsx`); crossing between them is a page load, which is what a login already is.
 *
 * Nothing here touches the API or reads a session: a visitor on the landing page must not cause a
 * single request.
 */
const router = createBrowserRouter(
  createRoutesFromElements(
    <Route element={<PublicRoot />}>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/demo" element={<DemoPage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/legal/offer" element={<LegalPage kind="offer" />} />
      <Route path="/legal/privacy" element={<LegalPage kind="privacy" />} />
      <Route path="*" element={<PublicNotFoundPage />} />
    </Route>,
  ),
);

export function PublicRouter() {
  return <RouterProvider router={router} />;
}
