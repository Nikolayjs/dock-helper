import { Box, Button, Container, Group, Image, Stack, Text, Title } from '@mantine/core';
import { Link } from 'react-router-dom';

/**
 * Until the real screenshot is dropped into `public/landing/`, the page shows a labelled grey
 * frame of the right proportions rather than a broken image icon: the layout below it has to be
 * judged at the size the picture will actually take.
 */
const SCREENSHOT_PLACEHOLDER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900">
       <rect width="1600" height="900" fill="#eef1ff"/>
       <text x="800" y="460" text-anchor="middle" font-family="sans-serif" font-size="42" fill="#93a9ff">
         Скриншот дашборда
       </text>
     </svg>`,
  );

/**
 * The first screen: what the product is, in one sentence a doctor can check against their own day.
 *
 * One `h1` on the page, and it is this one.
 */
export function HeroSection() {
  return (
    <Box component="section" py={{ base: 48, sm: 72 }}>
      <Container size="lg">
        <Stack gap="xl">
          <Stack gap="md" maw={760}>
            <Title order={1} fz={{ base: 30, sm: 44 }} lh={1.15}>
              Пациенты, диспансерный учёт и печатные формы — в одном месте
            </Title>
            <Text size="lg" c="dimmed">
              MedAssist — рабочее место врача в браузере: картотека и визиты, напоминания о просроченном
              Д-контроле, бланки с шапкой клиники и подписью, справочник препаратов с проверкой
              взаимодействий, анализы с референсами и калькуляторы. Без МИС и без бумаги.
            </Text>
            <Group gap="sm" mt="xs">
              {/* Демо-режим — шаг 5 задачи; до него кнопка ведёт на страницу-заглушку. */}
              <Button component={Link} to="/demo" size="md">
                Попробовать демо
              </Button>
              <Button component={Link} to="/login" size="md" variant="default">
                Войти
              </Button>
            </Group>
            <Text size="sm" c="dimmed">
              Без установки: открывается в браузере на компьютере и на телефоне.
            </Text>
          </Stack>

          {/* TODO: положить настоящий снимок дашборда в public/landing/dashboard.png. */}
          <Image
            src="/landing/dashboard.png"
            fallbackSrc={SCREENSHOT_PLACEHOLDER}
            alt="Дашборд MedAssist: карточки с очередью диспансерного контроля, календарём и избранными калькуляторами"
            radius="lg"
            style={{ border: '1px solid var(--mantine-color-default-border)', boxShadow: 'var(--mantine-shadow-md)' }}
          />
        </Stack>
      </Container>
    </Box>
  );
}
