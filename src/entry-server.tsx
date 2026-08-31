import { renderToString } from 'react-dom/server';
import { MantineProvider } from '@mantine/core';
import { Route, Routes, StaticRouter } from 'react-router-dom';

import { DemoPage } from './pages/DemoPage';
import { LandingPage } from './pages/LandingPage';
import { LegalPage } from './pages/legal/LegalPage';
import { PricingPage } from './pages/PricingPage';
import { theme } from './theme';

/** Where the site lives — for canonical and Open Graph addresses, which must be absolute. */
export const SITE_ORIGIN = 'https://medhelpmate.ru';

/**
 * The pages rendered to HTML at build time, with the text a search engine and a messenger show.
 *
 * Only the public site is here. The application under `/app` is behind a login and has nothing to
 * show a crawler; prerendering it would mean shipping an empty shell of every screen.
 */
export const PUBLIC_PAGES = [
  {
    path: '/',
    title: 'MedAssist — рабочее место врача: пациенты, диспансерный учёт, печатные формы',
    description:
      'Картотека пациентов и визитов, напоминания о просроченном Д-контроле, печатные бланки с подписью врача, справочник препаратов, анализы с референсами и калькуляторы. В браузере, без установки.',
  },
  {
    path: '/pricing',
    title: 'Тарифы MedAssist',
    description: 'Бесплатный, Pro и «Клиника»: что входит в каждый тариф MedAssist.',
  },
  {
    path: '/demo',
    title: 'Демо MedAssist — посмотреть без регистрации',
    description: 'Демо-режим MedAssist: посмотреть разделы на вымышленных пациентах, без регистрации.',
  },
  {
    path: '/legal/offer',
    title: 'Условия использования — MedAssist',
    description: 'Условия использования MedAssist.',
  },
  {
    path: '/legal/privacy',
    title: 'Политика обработки персональных данных — MedAssist',
    description: 'Как MedAssist обращается с персональными данными: что собирается, где хранится и кому не передаётся.',
  },
] as const;

/**
 * The route table for prerendering, kept apart from `publicRouter.tsx` on purpose.
 *
 * The browser's router loads each page lazily — which is the point of the split — and a lazy
 * component renders as its loading fallback under `renderToString`, so prerendering through it
 * would bake a spinner into every page. Here the pages are imported eagerly; the build script
 * checks that what came out actually contains the page's own text, so a route added in one place
 * and forgotten in the other does not pass silently.
 */
export function render(path: string): string {
  return renderToString(
    <MantineProvider theme={theme} defaultColorScheme="light">
      <StaticRouter location={path}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/demo" element={<DemoPage />} />
          <Route path="/legal/offer" element={<LegalPage kind="offer" />} />
          <Route path="/legal/privacy" element={<LegalPage kind="privacy" />} />
        </Routes>
      </StaticRouter>
    </MantineProvider>,
  );
}
