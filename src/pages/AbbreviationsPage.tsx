import { Alert, Container, Stack, Text } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';

import { AbbreviationsCatalog } from '../features/abbreviations/AbbreviationsCatalog';

/**
 * Справочник → Аббревиатуры.
 *
 * Первый раздел «Справочника» — того, куда со временем уедут и другие короткие вспомогательные
 * списки. Адрес поэтому `/reference/abbreviations`, а не `/abbreviations`: второй раздел не должен
 * потребовать переезда первого.
 */
export function AbbreviationsPage() {
  return (
    <Container size="xl" px={0}>
      <Stack gap="lg">
        <Alert variant="light" color="gray" icon={<IconInfoCircle size={18} />}>
          <Text size="sm">
            Сокращения из выписок, направлений и бланков анализов. Одно и то же сокращение может
            значить разное — «ОА» это и остеоартроз, и общий анализ, — поэтому каждое значение стоит
            отдельной строкой, а у многозначных есть отметка. Своё сокращение можно добавить: такая
            запись остаётся в вашем рабочем пространстве и обновлениями справочника не затирается.
          </Text>
        </Alert>
        <AbbreviationsCatalog />
      </Stack>
    </Container>
  );
}
