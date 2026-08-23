import { useMemo, useState } from 'react';
import { Alert, Button, Card, Container, Group, SimpleGrid, Stack, Text, TextInput, ThemeIcon } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconInfoCircle, IconPlus, IconSearch, IconStethoscope, IconX } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';

import { QuestionnaireCard } from '../features/diagnostics/QuestionnaireCard';
import type { Questionnaire } from '../features/diagnostics/types';
import { useQuestionnaires } from '../features/diagnostics/useQuestionnaires';

export function QuestionnairesPage() {
  const navigate = useNavigate();
  const { questionnaires, deleteQuestionnaire } = useQuestionnaires();
  const [search, setSearch] = useState('');

  const handleDelete = (q: Questionnaire) => {
    deleteQuestionnaire(q.id);
    notifications.show({ message: 'Анкета удалена', color: 'gray' });
  };

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return questionnaires;
    return questionnaires.filter(
      (q) => q.title.toLowerCase().includes(query) || q.description.toLowerCase().includes(query),
    );
  }, [questionnaires, search]);

  return (
    <Container size="xl" px={0}>
      <Stack gap="lg">
        <Alert variant="light" color="brand" icon={<IconInfoCircle size={18} />} title="Как это работает">
          Заведите анкету: перечислите симптомы и заболевания-кандидаты, укажите, насколько типичен каждый симптом
          для каждого заболевания. При запуске приложение само выбирает наиболее информативный следующий вопрос —
          как в «Акинаторе», только по дифференциальной диагностике.
        </Alert>

        <Group justify="space-between" align="flex-end" wrap="wrap">
          <Text c="dimmed" size="sm">
            {questionnaires.length === 0 ? 'Пока нет анкет' : `${questionnaires.length} анкет создано`}
          </Text>
          <Group gap="sm" wrap="wrap">
            <TextInput
              placeholder="Поиск анкеты…"
              leftSection={<IconSearch size={16} />}
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
              w={260}
            />
            <Button leftSection={<IconPlus size={18} />} onClick={() => navigate('/diagnostics/new')}>
              Создать анкету
            </Button>
          </Group>
        </Group>

        {filtered.length === 0 ? (
          <Card withBorder padding="xl">
            <Stack align="center" gap="sm" py="xl">
              <ThemeIcon size={48} radius="xl" variant="light" color="gray">
                {search.trim() ? <IconX size={24} /> : <IconStethoscope size={24} />}
              </ThemeIcon>
              <Text fw={600}>{search.trim() ? 'Ничего не найдено' : 'Пока нет анкет'}</Text>
              <Text size="sm" c="dimmed" ta="center" maw={360}>
                {search.trim()
                  ? 'Попробуйте изменить запрос.'
                  : 'Создайте первую анкету дифференциальной диагностики — особенно полезно для редких заболеваний, которые легко упустить.'}
              </Text>
            </Stack>
          </Card>
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
            {filtered.map((q) => (
              <QuestionnaireCard
                key={q.id}
                questionnaire={q}
                onOpen={() => navigate(`/diagnostics/${q.id}`)}
                onEdit={() => navigate(`/diagnostics/${q.id}/edit`)}
                onDelete={() => handleDelete(q)}
              />
            ))}
          </SimpleGrid>
        )}
      </Stack>
    </Container>
  );
}
