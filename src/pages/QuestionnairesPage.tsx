import { useMemo, useState } from 'react';
import { Alert, Button, Box, Container, Group, Stack, Tabs, Text, TextInput, ThemeIcon } from '@mantine/core';
import { IconBuildingStore, IconInfoCircle, IconLayoutGrid, IconPlus, IconSearch, IconStethoscope, IconX } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { CatalogPanel } from '../components/common/CatalogPanel';
import { PageToolbar } from '../components/common/PageToolbar';
import { SymptomMatchPanel } from '../features/diagnostics/SymptomMatchPanel';
import { QUESTIONNAIRE_SORT_KEYS, QuestionnaireTable, questionnaireSortValue, type QuestionnaireSortKey } from '../features/diagnostics/QuestionnaireTable';
import { sortRows, useTableSort } from '../lib/tableSort';
import type { Questionnaire } from '../features/diagnostics/types';
import { QUERY_KEY as QUESTIONNAIRES_KEY, useQuestionnaires } from '../features/diagnostics/useQuestionnaires';
import { useDeleteWithConfirm } from '../features/deletion/deleteConfirmContext';

const TABS = ['match', 'panels'] as const;
type DiagnosticsTab = (typeof TABS)[number];

export function QuestionnairesPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { questionnaires, addQuestionnaire, deleteQuestionnaire } = useQuestionnaires();
  const confirmDelete = useDeleteWithConfirm();
  const [search, setSearch] = useState('');

  /**
   * Копия панели — с пометкой в названии и сразу в редакторе.
   *
   * Панель — это сорок заболеваний, полторы сотни симптомов и матрица частот между ними; вариант
   * «то же, но для детского приёма» иначе собирается только заново. Открывается копия в редакторе,
   * потому что её первым делом и правят.
   */
  const handleDuplicate = async (questionnaire: Questionnaire) => {
    const created = await addQuestionnaire({ ...questionnaire, title: `${questionnaire.title} — копия` });
    notifications.show({ message: 'Создана копия', color: 'teal' });
    navigate(`/diagnostics/${created.id}/edit`);
  };
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

  const raw = params.get('tab');
  const tab: DiagnosticsTab = TABS.includes(raw as DiagnosticsTab) ? (raw as DiagnosticsTab) : 'match';

  // Вкладка живёт в адресе, как в «Документах» и «Справочнике». По умолчанию открыт подбор: это
  // то, ради чего в раздел заходят на приёме, а список панелей — библиотека за ним.
  const setTab = (next: string | null) => {
    const value = TABS.includes(next as DiagnosticsTab) ? (next as DiagnosticsTab) : 'match';
    setParams(value === 'match' ? {} : { tab: value }, { replace: true });
  };

  return (
    <Container size="xl" px={0}>
      <Tabs variant="pills" value={tab} onChange={setTab} keepMounted={false}>
        <Stack gap="lg">
          <PageToolbar
            tabs={
              <Tabs.List>
                <Tabs.Tab value="match" leftSection={<IconStethoscope size={16} />}>
                  Подбор по симптомам
                </Tabs.Tab>
                <Tabs.Tab value="panels" leftSection={<IconLayoutGrid size={16} />}>
                  Панели
                </Tabs.Tab>
              </Tabs.List>
            }
          />

          <Tabs.Panel value="match">
            <SymptomMatchPanel />
          </Tabs.Panel>

          <Tabs.Panel value="panels">
            <Stack gap="lg">
        <Alert variant="light" color="brand" icon={<IconInfoCircle size={18} />} title="Как это работает">
          Заведите анкету: перечислите симптомы и заболевания-кандидаты, укажите, насколько типичен каждый
          симптом для каждого заболевания. Дальше у панели два режима: «Опрос» — приложение само выбирает
          наиболее информативный следующий вопрос, как в «Акинаторе», только по дифференциальной диагностике;
          «Выбор симптомов» — вы отмечаете то, что уже нашли, а приложение говорит, каким заболеваниям это
          подходит и чем.
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
            {/* Заводских панелей четыре десятка, а ставится сразу пять самых частых: остальное надо
                где-то показать, иначе врач о нём не узнает. */}
            <Button
              variant="subtle"
              leftSection={<IconBuildingStore size={18} />}
              onClick={() => navigate('/store?tab=questionnaire')}
            >
              Ещё в магазине
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
              {!search.trim() && (
                <Group gap="sm" mt="xs">
                  <Button leftSection={<IconPlus size={16} />} onClick={() => navigate('/diagnostics/new')}>
                    Создать анкету
                  </Button>
                  <Button variant="light" component={Link} to="/store?tab=questionnaire">
                    Взять готовую в магазине
                  </Button>
                </Group>
              )}
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
            onDuplicate={handleDuplicate}
          />
        )}
        </CatalogPanel>
            </Stack>
          </Tabs.Panel>
        </Stack>
      </Tabs>
    </Container>
  );
}
