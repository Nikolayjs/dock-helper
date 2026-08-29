import { useEffect } from 'react';
import { Button, Container, Loader, Stack, Text, Title } from '@mantine/core';
import { Link, useLocation } from 'react-router-dom';

import { APP_BASE } from '../lib/appBase';

/**
 * Top-level sections the application used to live at, back when it owned the whole site.
 *
 * Every doctor with a bookmark to `/patients` or a printed link to `/documents` would otherwise
 * land on a 404 the day the landing page ships. The list is explicit rather than "anything that
 * isn't public": sending every typo into the application would bounce an anonymous visitor through
 * the login screen instead of telling them the page does not exist.
 */
const MOVED_TO_APP = new Set([
  'dashboard',
  'analyzer',
  'interactions',
  'drugs',
  'planner',
  'doctor',
  'calculators',
  'notes',
  'calendar',
  'news',
  'knowledge',
  'guidelines',
  'diagnostics',
  'articles',
  'library',
  'documents',
  'patients',
  'schedule',
  'messages',
]);

/**
 * The public site's 404 — and the place where the old addresses are honoured.
 *
 * The application has its own 404 inside the shell (`NotFoundPage`); this one is for visitors,
 * where there is no sidebar to return to.
 */
export function PublicNotFoundPage() {
  const location = useLocation();
  const firstSegment = location.pathname.split('/')[1] ?? '';
  const moved = MOVED_TO_APP.has(firstSegment);

  useEffect(() => {
    if (!moved) return;
    // A page load, not a navigation: the application is a different router.
    window.location.replace(`${APP_BASE}${location.pathname}${location.search}`);
  }, [moved, location.pathname, location.search]);

  if (moved) {
    return (
      <Stack align="center" justify="center" mih="100vh">
        <Loader />
      </Stack>
    );
  }

  return (
    <Container size="sm" py={100}>
      <Stack align="center" gap="md">
        <Title order={1}>404</Title>
        <Text c="dimmed" ta="center">
          Такой страницы не существует.
        </Text>
        <Button component={Link} to="/">
          На главную
        </Button>
      </Stack>
    </Container>
  );
}
