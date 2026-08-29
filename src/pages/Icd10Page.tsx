import { Container, Stack, Title } from '@mantine/core';

import { Icd10Catalog } from '../features/icd10/Icd10Catalog';

export function Icd10Page() {
  return (
    <Container size="xl" px={0}>
      <Stack gap="lg">
        <Title order={3}>Справочник МКБ-10</Title>
        <Icd10Catalog />
      </Stack>
    </Container>
  );
}
