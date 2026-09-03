import { Box, Button, Card, Container, Divider, List, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { IconCheck } from '@tabler/icons-react';
import { Link } from 'react-router-dom';

import { HEADER_OFFSET, LANDING_SECTIONS } from './sections';

/**
 * Что стоит на странице тарифов, пока цен нет.
 *
 * Стояло «уточняется» в каждой колонке — и это худший вариант из возможных: посетитель без цифры
 * не пишет письмо, он закрывает вкладку. Придуманное число было бы не лучше: оно продержалось бы
 * ровно до первого вопроса «а сколько на самом деле».
 *
 * Поэтому здесь сказано то, что **правда сегодня**: идёт ранний доступ, всё работает и ничего не
 * стоит; границы тарифов названы содержанием, а не числами, — по ним видно, за что вообще будут
 * брать деньги. Это ответ на вопрос «могу я начать прямо сейчас», а он и есть тот, ради которого
 * страницу открывают.
 *
 * **Ставя цены, поменяйте здесь `price` и уберите полосу раннего доступа.** Больше нигде числа не
 * лежат: `StoreEntry.price` пуст у всех позиций витрины, а `store_entitlements` пуста намеренно —
 * проверка на сервере стоит с первого дня, оплаты нет.
 */
const EARLY_ACCESS_NOTE =
  'Идёт ранний доступ: всё, что есть в приложении, сейчас доступно бесплатно и без ограничения по сроку. ' +
  'Когда появятся платные тарифы, мы предупредим заранее и не станем закрывать то, что уже написано и загружено.';

const PLANS = [
  {
    name: 'Бесплатно',
    price: 'Сейчас — всё',
    note: 'И останется бесплатным то, без чего приём не ведут',
    features: [
      'Картотека, визиты и диспансерный учёт',
      'Календарь, заметки и напоминания',
      'Справочники: препараты, взаимодействия, МКБ-10, заболевания',
      'Клинические рекомендации — 210 нозологий',
      'Печатные бланки и документы врача',
    ],
    cta: { label: 'Начать', to: '/login' },
    highlight: false,
  },
  {
    name: 'Pro',
    price: 'Цена будет позже',
    note: 'То, что экономит время на каждом приёме',
    features: [
      'Всё из бесплатного',
      'Разбор анализов с референсами по полу и возрасту',
      'Свои анализаторы, калькуляторы и опросники',
      'Отчёты по диспансерному учёту и выгрузка в Excel',
      'Библиотека книг и импорт картотеки',
    ],
    cta: { label: 'Попробовать демо', to: '/demo' },
    highlight: true,
  },
  {
    name: 'Клиника',
    price: 'По запросу',
    note: 'Для отделения или частного кабинета',
    features: [
      'Всё из Pro',
      'Несколько врачей в одном пространстве',
      'Общие бланки и шапка клиники на документах',
      'Помощь с переносом картотеки из вашей системы',
    ],
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
              <Text c="dimmed">{EARLY_ACCESS_NOTE}</Text>
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
