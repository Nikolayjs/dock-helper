import { Box, Card, Container, SimpleGrid, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { IconLock, IconServer, IconStethoscope } from '@tabler/icons-react';

import { HEADER_OFFSET, LANDING_SECTIONS } from './sections';

const POINTS = [
  {
    icon: IconServer,
    title: 'Где лежат данные',
    text: 'На сервере в России. Резервная копия снимается каждую ночь, вместе с загруженными файлами.',
  },
  {
    icon: IconStethoscope,
    title: 'Это не медицинская карта',
    // Дословно тот же текст, что видит врач в разделе «Пациенты»: обещание на витрине и
    // предупреждение внутри продукта обязаны совпадать слово в слово.
    text: 'MedAssist — личный помощник врача для быстрых заметок. Он не заменяет медицинскую информационную систему клиники и не предназначен для хранения полных медицинских данных пациентов.',
  },
  {
    icon: IconLock,
    title: 'Никому не передаём',
    text: 'Записи видны только вам. Мы не передаём их третьим лицам и не используем для рекламы.',
  },
];

export function TrustSection() {
  return (
    <Box component="section" id={LANDING_SECTIONS.trust} py={{ base: 40, sm: 64 }} style={{ scrollMarginTop: HEADER_OFFSET }}>
      <Container size="lg">
        <Stack gap="xl">
          <Title order={2}>Про данные — честно</Title>
          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
            {POINTS.map(({ icon: Icon, title, text }) => (
              <Card key={title} withBorder padding="lg" radius="lg">
                <Stack gap="sm">
                  <ThemeIcon size={40} radius="md" variant="light" color="mint">
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
