import { Anchor, Box, Button, Container, Group, Text, ThemeIcon } from '@mantine/core';
import { IconStethoscope } from '@tabler/icons-react';
import { Link } from 'react-router-dom';

import { LANDING_SECTIONS } from './sections';

const NAV = [
  { href: `#${LANDING_SECTIONS.features}`, label: 'Возможности' },
  { href: `#${LANDING_SECTIONS.trust}`, label: 'Данные' },
  { href: `#${LANDING_SECTIONS.pricing}`, label: 'Тарифы' },
  { href: `#${LANDING_SECTIONS.faq}`, label: 'Вопросы' },
];

/**
 * The site header. The section links disappear below `sm` rather than collapsing into a burger:
 * the page is short enough to scroll, and a menu that exists only to jump four screens down is
 * more machinery than the visitor needs.
 */
export function LandingHeader() {
  return (
    <Box
      component="header"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        backgroundColor: 'var(--mantine-color-body)',
        borderBottom: '1px solid var(--mantine-color-default-border)',
      }}
    >
      <Container size="lg" py="sm">
        <Group justify="space-between" wrap="nowrap">
          <Group gap={10} wrap="nowrap">
            <ThemeIcon size={36} radius="md" variant="gradient" gradient={{ from: 'brand.6', to: 'brand.8', deg: 135 }}>
              <IconStethoscope size={20} />
            </ThemeIcon>
            <Text fw={700} size="lg" lh={1.1}>
              MedAssist
            </Text>
          </Group>

          <Group gap="lg" visibleFrom="sm">
            {NAV.map((item) => (
              <Anchor key={item.href} href={item.href} c="dimmed" size="sm" underline="never">
                {item.label}
              </Anchor>
            ))}
          </Group>

          <Button component={Link} to="/login" size="sm" variant="light">
            Войти
          </Button>
        </Group>
      </Container>
    </Box>
  );
}
