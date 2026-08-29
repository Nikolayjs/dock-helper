import { createBrowserRouter, createRoutesFromElements, Route, RouterProvider } from 'react-router-dom';

import { LandingPage } from './pages/LandingPage';
import { LegalPage } from './pages/legal/LegalPage';
import { LoginPage } from './pages/LoginPage';
import { PricingPage } from './pages/PricingPage';
import { PublicNotFoundPage } from './pages/PublicNotFoundPage';

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
    <Route>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
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
