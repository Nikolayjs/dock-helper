import { Box, Container, Text, Title } from '@mantine/core';

import { LandingFooter } from '../features/landing/LandingFooter';
import { LandingHeader } from '../features/landing/LandingHeader';
import { PricingSection } from '../features/landing/PricingSection';

/**
 * The same pricing block on its own address.
 *
 * It exists because a price list is what people send each other a link to, and because the
 * prerender step needs `/pricing` as a separate document. The block itself is shared with the
 * landing — two copies of a price list is exactly how one of them goes stale.
 */
export function PricingPage() {
  return (
    <>
      <LandingHeader />
      <main>
        <Box pt={{ base: 32, sm: 48 }}>
          <Container size="lg">
            <Title order={1}>Тарифы MedAssist</Title>
            <Text c="dimmed" mt="sm" maw={640}>
              Рабочее место врача в браузере: пациенты, диспансерный учёт, печатные формы, анализы и
              справочники. Цены сейчас уточняются — напишите нам, и мы скажем точно.
            </Text>
          </Container>
        </Box>
        <PricingSection withHeading={false} />
      </main>
      <LandingFooter />
    </>
  );
}
