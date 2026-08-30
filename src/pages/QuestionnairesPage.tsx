import { useMemo, useState } from 'react';
import { Alert, Button, Box, Container, Group, Stack, Text, TextInput, ThemeIcon } from '@mantine/core';
import { IconInfoCircle, IconPlus, IconSearch, IconStethoscope, IconX } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';

import { CatalogPanel } from '../components/common/CatalogPanel';
import { QUESTIONNAIRE_SORT_KEYS, QuestionnaireTable, questionnaireSortValue, type QuestionnaireSortKey } from '../features/diagnostics/QuestionnaireTable';
import { sortRows, useTableSort } from '../lib/tableSort';
import type { Questionnaire } from '../features/diagnostics/types';
import { QUERY_KEY as QUESTIONNAIRES_KEY, useQuestionnaires } from '../features/diagnostics/useQuestionnaires';
import { useDeleteWithConfirm } from '../features/deletion/deleteConfirmContext';

export function QuestionnairesPage() {
  const navigate = useNavigate();
  const { questionnaires, deleteQuestionnaire } = useQuestionnaires();
  const confirmDelete = useDeleteWithConfirm();
  const [search, setSearch] = useState('');
  const { sort, toggle } = useTableSort<QuestionnaireSortKey>(
    { key: 'title', direction: 'asc' },
    { storageKey: 'medassist:sort:diagnostics', keys: QUESTIONNAIRE_SORT_KEYS },
  );

  const handleDelete = (q: Questionnaire) =>
    confirmDelete({
      what: 'анкету',
      name: q.title,
      notice: 'Анкета удалена',
      queryKey: QUESTIONNAIRES_KEY,
      id: q.id,
      perform: () => deleteQuestionnaire(q.id),
    });

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return questionnaires;
    return questionnaires.filter(
      (q) => q.title.toLowerCase().includes(query) || q.description.toLowerCase().includes(query),
    );
  }, [questionnaires, search]);

  const sorted = useMemo(() => sortRows(filtered, sort, questionnaireSortValue), [filtered, sort]);

  return (
    <Container size="xl" px={0}>
      <Stack gap="lg">
        <Alert variant="light" color="brand" icon={<IconInfoCircle size={18} />} title="Как это работает">
          Заведите анкету: перечислите симптомы и заболевания-кандидаты, укажите, насколько типичен каждый симптом
          для каждого заболевания. При запуске приложение само выбирает наиболее информативный следующий вопрос —
          как в «Акинаторе», только по дифференциальной диагностике.
        </Alert>

        <CatalogPanel
          header={
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
          }
        >
        {filtered.length === 0 ? (
          <Box p="xl">
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
          </Box>
        ) : (
          <QuestionnaireTable
            questionnaires={sorted}
            sort={sort}
            onSort={toggle}
            onOpen={(q) => navigate(`/diagnostics/${q.id}`)}
            onEdit={(q) => navigate(`/diagnostics/${q.id}/edit`)}
            onDelete={handleDelete}
          />
        )}
        </CatalogPanel>
      </Stack>
    </Container>
  );
}
