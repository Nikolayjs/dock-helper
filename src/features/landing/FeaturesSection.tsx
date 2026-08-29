import { Box, Card, Container, SimpleGrid, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import {
  IconBellRinging,
  IconBooks,
  IconCalculator,
  IconFileText,
  IconTestPipe,
  IconUsers,
} from '@tabler/icons-react';

import { HEADER_OFFSET, LANDING_SECTIONS } from './sections';

const FEATURES = [
  {
    icon: IconUsers,
    title: 'Пациенты и диспансерный учёт',
    text: 'Картотека с импортом из Excel, визиты, карты Д-учёта с датами контроля. Статистика по диагнозам и исходам — чтобы видеть, кого пора вызвать.',
  },
  {
    icon: IconTestPipe,
    title: 'Анализы с референсами',
    text: 'Значения сравниваются с нормой по полу и возрасту. Бланк лаборатории читается из PDF и Excel, а свой анализатор собирается в конструкторе.',
  },
  {
    icon: IconFileText,
    title: 'Печатные документы',
    text: 'Бланки с подстановками, шапка клиники и подпись врача. Отсканированную форму можно разметить и печатать поверх неё.',
  },
  {
    icon: IconCalculator,
    title: 'Калькуляторы и опросники',
    text: 'Готовые шкалы и свои: формулы, пороги и интерпретации задаются в конструкторе, без программирования.',
  },
  {
    icon: IconBooks,
    title: 'База знаний и библиотека',
    text: 'Клинические рекомендации по восемнадцати специальностям, свои статьи и заметки, справочник препаратов. Читалка PDF, DOCX, FB2 и DjVu.',
  },
  {
    icon: IconBellRinging,
    title: 'Напоминания и планер',
    text: 'Календарь заметок и напоминаний, доски задач с колонками. Просроченный Д-контроль виден на дашборде первым.',
  },
];

export function FeaturesSection() {
  return (
    <Box component="section" id={LANDING_SECTIONS.features} py={{ base: 40, sm: 64 }} style={{ scrollMarginTop: HEADER_OFFSET }}>
      <Container size="lg">
        <Stack gap="xl">
          <Stack gap="xs" maw={640}>
            <Title order={2}>Что внутри</Title>
            <Text c="dimmed">
              Разделы, которые чаще всего заменяют собой стопку бумаг и полдюжины вкладок в браузере.
            </Text>
          </Stack>

          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <Card key={title} withBorder padding="lg" radius="lg">
                <Stack gap="sm">
                  <ThemeIcon size={40} radius="md" variant="light" color="brand">
                    <Icon size={22} />
                  </ThemeIcon>
                  <Title order={3} fz="lg">
                    {title}
                  </Title>
                  <Text size="sm" c="dimmed">
                    {text}
                  </Text>
                </Stack>
              </Card>
            ))}
          </SimpleGrid>
        </Stack>
      </Container>
    </Box>
  );
}
