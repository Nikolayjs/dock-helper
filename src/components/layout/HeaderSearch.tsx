import { useMemo, useState } from 'react';
import {
  ActionIcon,
  Group,
  Loader,
  Popover,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  UnstyledButton,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconArticle, IconBook2, IconCalculator, IconListSearch, IconNotes, IconPill, IconSearch, IconUsers, IconX } from '@tabler/icons-react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useCalculators } from '../../features/calculators/useCalculators';
import { useDrugSearch } from '../../features/drugs/useDrugSearch';
import { useIcd10Search } from '../../features/patients/useIcd10Search';
import { useDocuments } from '../../features/knowledgeBase/useDocuments';
import { useNotes } from '../../features/notes/useNotes';
import { stripHtml } from '../../features/notes/textPreview';
import { usePatients } from '../../features/patients/usePatients';
import { lastVisitOf } from '../../features/patients/utils';

const SEARCH_DEBOUNCE_MS = 300;
const MAX_RESULTS_PER_GROUP = 4;

interface SearchResult {
  id: string;
  title: string;
  description: string;
  path: string;
  icon: typeof IconCalculator;
  group: string;
}

function matches(query: string, ...fields: Array<string | undefined>) {
  return fields.some((field) => field?.toLowerCase().includes(query));
}

export function HeaderSearch() {
  const navigate = useNavigate();
  const location = useLocation();
  const { calculators } = useCalculators();
  const { documents: guidelines } = useDocuments('guideline');
  const { documents: articles } = useDocuments('article');
  const { notes } = useNotes();
  const { patients } = usePatients();

  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [debouncedQuery] = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);
  // Препараты ищет сервер: их полторы тысячи, а строка поиска стоит на каждой странице.
  const { drugs, isFetching: drugsFetching } = useDrugSearch(query, MAX_RESULTS_PER_GROUP);
  // Коды МКБ ищет тот же сервер: их 14 641, и подрубрику иначе пришлось бы искать через рубрику.
  const { results: icd10, isSearching: icdFetching } = useIcd10Search(query);

  const trimmedQuery = query.trim();
  const trimmedDebouncedQuery = debouncedQuery.trim();
  const isSearching = trimmedQuery.length > 0 && (trimmedDebouncedQuery !== trimmedQuery || drugsFetching || icdFetching);
  const opened = focused && trimmedQuery.length > 0;

  const groupedResults = useMemo(() => {
    const q = trimmedDebouncedQuery.toLowerCase();
    if (!q) return [];

    const groups: { group: string; items: SearchResult[] }[] = [
      {
        group: 'Калькуляторы',
        items: calculators
          .filter((calc) => matches(q, calc.title, calc.description, calc.category))
          .slice(0, MAX_RESULTS_PER_GROUP)
          .map((calc) => ({
            id: calc.id,
            title: calc.title,
            description: calc.description,
            path: `/calculators/${calc.id}`,
            icon: IconCalculator,
            group: 'Калькуляторы',
          })),
      },
      {
        group: 'Клинические рекомендации',
        items: guidelines
          .filter((doc) => matches(q, doc.title, doc.summary, ...doc.tags))
          .slice(0, MAX_RESULTS_PER_GROUP)
          .map((doc) => ({
            id: doc.id,
            title: doc.title,
            description: doc.summary,
            path: `/guidelines/${doc.id}`,
            icon: IconBook2,
            group: 'Клинические рекомендации',
          })),
      },
      {
        group: 'Статьи',
        items: articles
          .filter((doc) => matches(q, doc.title, doc.summary, ...doc.tags))
          .slice(0, MAX_RESULTS_PER_GROUP)
          .map((doc) => ({
            id: doc.id,
            title: doc.title,
            description: doc.summary,
            path: `/articles/${doc.id}`,
            icon: IconArticle,
            group: 'Статьи',
          })),
      },
      {
        group: 'Заметки',
        items: notes
          .map((note) => ({ note, plainContent: stripHtml(note.content) }))
          .filter(({ note, plainContent }) => matches(q, note.title, plainContent))
          .slice(0, MAX_RESULTS_PER_GROUP)
          .map(({ note, plainContent }) => ({
            id: note.id,
            title: note.title || 'Без названия',
            description: plainContent,
            path: `/notes/${note.id}`,
            icon: IconNotes,
            group: 'Заметки',
          })),
      },
      {
        group: 'Препараты',
        items: drugs.map((drug) => ({
          id: drug.id,
          title: drug.inn,
          // Торговые названия — то, по чему препарат и ищут: пациент называет именно их.
          description: drug.brandNames.join(', ') || drug.pharmGroup,
          path: `/drugs/${drug.id}`,
          icon: IconPill,
          group: 'Препараты',
        })),
      },
      {
        group: 'МКБ-10',
        items: icd10.slice(0, MAX_RESULTS_PER_GROUP).map((entry) => ({
          id: entry.code,
          title: entry.code,
          description: entry.name,
          path: `/icd10/${encodeURIComponent(entry.code)}`,
          icon: IconListSearch,
          group: 'МКБ-10',
        })),
      },
      {
        group: 'Пациенты',
        items: patients
          .filter((patient) => matches(q, patient.fullName, patient.phone, ...patient.visits.map((v) => v.diagnosis)))
          .slice(0, MAX_RESULTS_PER_GROUP)
          .map((patient) => ({
            id: patient.id,
            title: patient.fullName,
            description: lastVisitOf(patient)?.diagnosis ?? '',
            path: `/patients/${patient.id}`,
            icon: IconUsers,
            group: 'Пациенты',
          })),
      },
    ];

    return groups.filter((group) => group.items.length > 0);
  }, [trimmedDebouncedQuery, calculators, guidelines, articles, notes, patients, drugs, icd10]);

  const totalResults = groupedResults.reduce((sum, group) => sum + group.items.length, 0);

  const handleSelect = (path: string) => {
    setQuery('');
    setFocused(false);
    // Поиск — такой же переход между разделами, как ссылка с дашборда: кнопка «назад» на найденной
    // странице должна вернуть туда, где искали, а не в раздел находки.
    navigate(path, { state: { from: location.pathname + location.search } });
  };

  return (
    <Popover opened={opened} width={340} position="bottom-start" shadow="md" withinPortal>
      <Popover.Target>
        <TextInput
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') event.currentTarget.blur();
          }}
          placeholder="Поиск пациента, калькулятора…"
          radius="md"
          leftSection={<IconSearch size={16} />}
          rightSection={
            isSearching ? (
              <Loader size={14} />
            ) : query ? (
              <ActionIcon aria-label="Очистить поиск"
                variant="subtle"
                color="gray"
                size="sm"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setQuery('')}
              >
                <IconX size={14} />
              </ActionIcon>
            ) : null
          }
          // Поле сужается на промежуточной ширине окна: именно оно делает правую сторону шапки
          // шире левой, а от разницы съезжает заголовок между ними.
          w={{ base: 160, sm: 200, lg: 280 }}
        />
      </Popover.Target>
      <Popover.Dropdown p="xs" onMouseDown={(event) => event.preventDefault()}>
        <ScrollArea.Autosize mah={360} type="auto">
          {isSearching ? (
            <Group justify="center" py="md">
              <Loader size="sm" />
            </Group>
          ) : totalResults === 0 ? (
            <Text size="sm" c="dimmed" ta="center" py="md">
              Ничего не найдено по запросу «{trimmedQuery}»
            </Text>
          ) : (
            <Stack gap="sm">
              {groupedResults.map(({ group, items }) => (
                <Stack key={group} gap={2}>
                  <Text size="xs" fw={600} c="dimmed" tt="uppercase" px={6}>
                    {group}
                  </Text>
                  {items.map((item) => (
                    <UnstyledButton
                      key={`${item.group}-${item.id}`}
                      onClick={() => handleSelect(item.path)}
                      p={6}
                      style={{ borderRadius: 8 }}
                    >
                      <Group gap={10} wrap="nowrap">
                        <ThemeIcon variant="light" color="brand" size={30} radius="md">
                          <item.icon size={16} stroke={1.8} />
                        </ThemeIcon>
                        <div style={{ overflow: 'hidden' }}>
                          <Text size="sm" fw={500} truncate>
                            {item.title}
                          </Text>
                          {item.description && (
                            <Text size="xs" c="dimmed" truncate>
                              {item.description}
                            </Text>
                          )}
                        </div>
                      </Group>
                    </UnstyledButton>
                  ))}
                </Stack>
              ))}
            </Stack>
          )}
        </ScrollArea.Autosize>
      </Popover.Dropdown>
    </Popover>
  );
}
