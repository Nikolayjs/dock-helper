import { Box, Button, Card, Container, Divider, List, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { IconCheck } from '@tabler/icons-react';
import { Link } from 'react-router-dom';

import { HEADER_OFFSET, LANDING_SECTIONS } from './sections';

/**
 * TODO: подставить настоящие цены и лимиты. До этого в колонках стоит «уточняется» — число,
 * придуманное для вида, продержалось бы ровно до первого вопроса «а сколько на самом деле».
 */
const PLANS = [
  {
    name: 'Бесплатно',
    price: 'уточняется',
    note: 'Чтобы попробовать на своих пациентах',
    features: ['Картотека и визиты', 'Календарь и заметки', 'Справочник препаратов', 'Клинические рекомендации'],
    cta: { label: 'Начать', to: '/login' },
    highlight: false,
  },
  {
    name: 'Pro',
    price: 'уточняется',
    note: 'Для повседневной работы',
    features: [
      'Всё из бесплатного',
      'Диспансерный учёт и статистика',
      'Печатные бланки и сканы форм',
      'Свои анализаторы, калькуляторы и опросники',
      'Библиотека и загрузка файлов',
    ],
    cta: { label: 'Попробовать демо', to: '/demo' },
    highlight: true,
  },
  {
    name: 'Клиника',
    price: 'уточняется',
    note: 'Для отделения или частного кабинета',
    features: ['Всё из Pro', 'Общие бланки и шапка клиники', 'Несколько врачей в одном пространстве', 'Помощь с переносом картотеки'],
    cta: { label: 'Написать нам', to: '/legal/offer' },
    highlight: false,
  },
];

/** `withHeading` — для страницы `/pricing`, где заголовок уже стоит выше и вторым был бы повтором. */
export function PricingSection({ withHeading = true }: { withHeading?: boolean }) {
  return (
    <Box component="section" id={LANDING_SECTIONS.pricing} py={{ base: 40, sm: 64 }} style={{ scrollMarginTop: HEADER_OFFSET }}>
      <Container size="lg">
        <Stack gap="xl">
          {withHeading && (
            <Stack gap="xs" maw={640}>
              <Title order={2}>Тарифы</Title>
              <Text c="dimmed">Цены сейчас уточняются — напишите нам, и мы скажем точно.</Text>
            </Stack>
          )}

          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
            {PLANS.map((plan) => (
              <Card
                key={plan.name}
                withBorder
                padding="lg"
                radius="lg"
                style={plan.highlight ? { borderColor: 'var(--mantine-color-brand-6)' } : undefined}
              >
                <Stack gap="sm" h="100%">
                  <Title order={3} fz="lg">
                    {plan.name}
                  </Title>
                  <Text fz={26} fw={700} lh={1.2}>
                    {plan.price}
                  </Text>
                  <Text size="sm" c="dimmed">
                    {plan.note}
                  </Text>
                  <Divider my="xs" />
                  <List spacing="xs" size="sm" icon={<IconCheck size={16} />}>
                    {plan.features.map((feature) => (
                      <List.Item key={feature}>{feature}</List.Item>
                    ))}
                  </List>
                  <Button
                    component={Link}
                    to={plan.cta.to}
                    mt="auto"
                    variant={plan.highlight ? 'filled' : 'default'}
                  >
                    {plan.cta.label}
                  </Button>
                </Stack>
              </Card>
            ))}
          </SimpleGrid>
        </Stack>
      </Container>
    </Box>
  );
}
