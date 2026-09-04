import { Alert, Container, Group, Loader, Stack } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';
import { useParams } from 'react-router-dom';

import { RecordToolbar } from '../components/common/RecordToolbar';
import { GuidelineReader } from '../features/guidelines/GuidelineReader';
import { useGuideline, useGuidelineText } from '../features/guidelines/useGuidelines';

/**
 * Одна клиническая рекомендация целиком.
 *
 * Кнопок «Изменить» и «Удалить» здесь нет: документ утверждён Минздравом, и права править его у
 * приложения нет — ни у врача, ни у нас. Осталось то, что относится к чтению: вернуться и
 * напечатать.
 */
export function GuidelineViewPage() {
  const { id } = useParams<{ id: string }>();
  const { guideline, isLoading, error } = useGuideline(id);
  const { sections, isLoading: textLoading } = useGuidelineText(id);

  return (
    <Container size="xl" px={0}>
      <Stack gap="md">
        <RecordToolbar fallback={{ to: '/guidelines', label: 'К клиническим рекомендациям' }} />
        {error ? (
          <Alert color="orange" icon={<IconInfoCircle size={18} />}>
            {error.message}
          </Alert>
        ) : isLoading || !guideline ? (
          <Group justify="center" py="xl">
            <Loader size="sm" />
          </Group>
        ) : (
          /*
           * Подложку рисует сама читалка, и только под текстом: оглавление — навигация по
           * документу, а не его часть. Общая подложка вокруг обоих делала бы оглавление куском
           * листа, тогда как оно прилипает к экрану и на бумагу не идёт вовсе.
           */
          <GuidelineReader guideline={guideline} sections={sections} loading={textLoading} />
        )}
      </Stack>
    </Container>
  );
}
