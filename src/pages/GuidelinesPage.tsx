import { Alert, Container, Group, Loader, Stack } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';

import { GuidelinesCatalog } from '../features/guidelines/GuidelinesCatalog';
import { useGuidelines } from '../features/guidelines/useGuidelines';

/**
 * Раздел «Клинические рекомендации» — зеркало рубрикатора Минздрава, а не наши заметки.
 *
 * До этого здесь лежали двести десять коротких справок, написанных нами: «что при этой болезни
 * обычно смотрят и чем ведут». Врач, открывающий раздел с таким названием, хочет видеть клинические
 * рекомендации, а не пересказ, — и теперь видит их, все семьсот с лишним, полным текстом.
 *
 * Кнопки «Добавить» здесь нет и быть не может: утверждённую рекомендацию не пишут и не правят. То,
 * что врач пишет сам, живёт в соседнем разделе — «Статьи».
 */
export function GuidelinesPage() {
  const navigate = useNavigate();
  const { guidelines, isLoading, error } = useGuidelines();

  return (
    <Container size="xl" px={0}>
      <Stack gap="md">
        {error ? (
          <Alert color="orange" icon={<IconInfoCircle size={18} />}>
            {error.message}
          </Alert>
        ) : isLoading ? (
          <Group justify="center" py="xl">
            <Loader size="sm" />
          </Group>
        ) : (
          <GuidelinesCatalog
            guidelines={guidelines}
            onOpen={(row) => navigate(`/guidelines/${row.codeVersion}`, { state: { from: '/guidelines' } })}
          />
        )}
      </Stack>
    </Container>
  );
}
