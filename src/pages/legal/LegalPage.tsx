import { Box, Container, List, Stack, Text, Title } from '@mantine/core';

import { LandingFooter } from '../../features/landing/LandingFooter';
import { LandingHeader } from '../../features/landing/LandingHeader';

/**
 * TODO: заменить на настоящие тексты оферты и политики обработки ПДн — их пишет и утверждает
 * человек, а не разработчик. Здесь пока каркас: адрес, заголовок и перечень того, что документ
 * обязан покрыть, чтобы страница не выглядела пустой и её нечаянно не забыли заполнить.
 */
const DOCS = {
  offer: {
    title: 'Публичная оферта',
    intro: 'Условия использования MedAssist. Документ готовится.',
    points: [
      'предмет договора и что именно предоставляется',
      'порядок оплаты, продления и возврата',
      'ответственность сторон и ограничения',
      'порядок изменения условий и уведомления',
    ],
  },
  privacy: {
    title: 'Политика обработки персональных данных',
    intro: 'Как MedAssist обращается с данными. Документ готовится.',
    points: [
      'какие данные собираются и зачем',
      'где и сколько они хранятся',
      'кому передаются — и почему не передаются третьим лицам',
      'как удалить учётную запись и выгрузить свои записи',
    ],
  },
} as const;

export function LegalPage({ kind }: { kind: keyof typeof DOCS }) {
  const doc = DOCS[kind];

  return (
    <>
      <LandingHeader />
      <main>
        <Box py={{ base: 40, sm: 64 }}>
          <Container size="md">
            <Stack gap="md">
              <Title order={1}>{doc.title}</Title>
              <Text c="dimmed">{doc.intro}</Text>
              <Text size="sm" c="dimmed">
                Документ будет покрывать:
              </Text>
              <List size="sm" c="dimmed">
                {doc.points.map((point) => (
                  <List.Item key={point}>{point}</List.Item>
                ))}
              </List>
            </Stack>
          </Container>
        </Box>
      </main>
      <LandingFooter />
    </>
  );
}
