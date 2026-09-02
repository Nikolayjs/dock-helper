import { Box, Button, Container, Group, Image, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { Link } from 'react-router-dom';

/**
 * Снимки — настоящие, из демо-режима.
 *
 * До этого на первом экране стоял серый прямоугольник с надписью «Скриншот дашборда»: лендинг
 * обещал продукт и показывал заглушку. Сняты они с демо-сессии, то есть на **вымышленных** данных —
 * ни одной настоящей записи пациента на сайте быть не может; полоса «демо-режим» на снимке скрыта:
 * она про сессию, а не про продукт.
 *
 * WebP и 1700 px по ширине: три снимка в оригинале весили под мегабайт, а лендинг обязан
 * открываться быстро — это та же причина, по которой у публичной части свой набор стилей.
 * `loading="lazy"` у всех, кроме первого: остальные лежат ниже первого экрана.
 */
const SHOTS = [
  {
    src: '/landing/dashboard.webp',
    alt: 'Дашборд MedAssist: просроченный диспансерный контроль, нагрузка на приёме и карточки, которые врач расставляет сам',
    caption: 'Дашборд: то, из чего сегодня что-то следует',
  },
  {
    src: '/landing/patient.webp',
    alt: 'Карточка пациента: константы, визиты с диагнозами, постоянная терапия и сохранённые анализы',
    caption: 'Карточка пациента: визиты, терапия, анализы',
  },
  {
    src: '/landing/print.webp',
    alt: 'Печатный бланк справки с шапкой клиники, диагнозом и подписью врача',
    caption: 'Бланк с шапкой клиники — сразу на печать',
  },
];

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

          <Image
            src={SHOTS[0].src}
            alt={SHOTS[0].alt}
            radius="lg"
            style={{ border: '1px solid var(--mantine-color-default-border)', boxShadow: 'var(--mantine-shadow-md)' }}
          />

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
            {SHOTS.slice(1).map((shot) => (
              <Stack key={shot.src} gap={6}>
                <Image
                  src={shot.src}
                  alt={shot.alt}
                  loading="lazy"
                  radius="lg"
                  style={{ border: '1px solid var(--mantine-color-default-border)', boxShadow: 'var(--mantine-shadow-sm)' }}
                />
                <Text size="sm" c="dimmed">
                  {shot.caption}
                </Text>
              </Stack>
            ))}
          </SimpleGrid>

        </Stack>
      </Container>
    </Box>
  );
}
