import { Box, Container, List, Stack, Text, Title } from '@mantine/core';

import { LandingFooter } from '../../features/landing/LandingFooter';
import { LandingHeader } from '../../features/landing/LandingHeader';
import { EXTENSION_PRIVACY, PRIVACY, TERMS } from './legalDocs';
import type { LegalDoc } from './legalDocs';

/**
 * Юридические страницы.
 *
 * Адрес `/legal/offer` остался прежним, хотя документ теперь называется «Условия использования», а
 * не «Публичная оферта»: оферта — это договор о продаже, а сервис бесплатный и платежей не
 * принимает, так что называться так документ не может. Менять же адрес значило бы оборвать ссылки,
 * карту сайта и канонические адреса ради слова в пути.
 */
const DOCS: Record<'offer' | 'privacy' | 'extension', LegalDoc> = {
  offer: TERMS,
  privacy: PRIVACY,
  // Своя политика у расширения: магазин требует отдельный адрес и сверяет её с разрешениями.
  extension: EXTENSION_PRIVACY,
};

export function LegalPage({ kind }: { kind: keyof typeof DOCS }) {
  const doc = DOCS[kind];

  return (
    <>
      <LandingHeader />
      <main>
        <Box py={{ base: 40, sm: 64 }}>
          <Container size="md">
            <Stack gap="xl">
              <Stack gap="xs">
                <Title order={1}>{doc.title}</Title>
                <Text c="dimmed">{doc.intro}</Text>
                {/* Дата редакции стоит вверху, а не в подвале: читающий должен видеть, насколько
                    документ свеж, до того как начнёт его читать. */}
                <Text size="sm" c="dimmed">
                  Редакция от {doc.updated}
                </Text>
              </Stack>

              {doc.sections.map((section) => (
                <Stack key={section.heading} gap="sm">
                  <Title order={2} size="h4">
                    {section.heading}
                  </Title>
                  {section.paragraphs?.map((paragraph) => (
                    <Text key={paragraph}>{paragraph}</Text>
                  ))}
                  {section.list && (
                    <List spacing="xs">
                      {section.list.map((item) => (
                        <List.Item key={item}>{item}</List.Item>
                      ))}
                    </List>
                  )}
                </Stack>
              ))}
            </Stack>
          </Container>
        </Box>
      </main>
      <LandingFooter />
    </>
  );
}
