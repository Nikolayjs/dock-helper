import { useMemo, useState } from 'react';
import { useDebouncedValue } from '@mantine/hooks';
import { IconArticle, IconBook2, IconCalculator, IconListSearch, IconNotes, IconPill, IconUsers } from '@tabler/icons-react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useCalculators } from '../../features/calculators/useCalculators';
import { useDrugSearch } from '../../features/drugs/useDrugSearch';
import { useIcd10Search } from '../../features/patients/useIcd10Search';
import { useDocuments } from '../../features/knowledgeBase/useDocuments';
import { useNotes } from '../../features/notes/useNotes';
import { stripHtml } from '../../features/notes/textPreview';
import { usePatients } from '../../features/patients/usePatients';
import { lastVisitOf } from '../../features/patients/utils';

/**
 * Поиск в шапке: состояние, источники и сборка результатов — без единой строки разметки.
 *
 * Оболочек у поиска две — поле с выпадающим списком на широком экране и полноэкранное окно на
 * телефоне, — и держать в каждой свою копию шести источников значило бы развести их на первой же
 * правке: добавили группу в одну, забыли в другой, и поиск отвечает по-разному в зависимости от
 * ширины окна.
 *
 * **Хук монтирует данные.** `usePatients()` и соседи — это запросы, поэтому мобильная оболочка
 * обязана вызывать его только при открытом окне: иначе шапка, стоящая на каждой странице, тянула
 * бы весь список пациентов вместе с визитами при каждом заходе в любой раздел.
 */

const SEARCH_DEBOUNCE_MS = 300;
export const MAX_RESULTS_PER_GROUP = 4;

export interface SearchResult {
  id: string;
  title: string;
  description: string;
  path: string;
  icon: typeof IconCalculator;
  group: string;
}

export interface SearchGroup {
  group: string;
  items: SearchResult[];
}

function matches(query: string, ...fields: Array<string | undefined>) {
  return fields.some((field) => field?.toLowerCase().includes(query));
}

export function useHeaderSearch() {
  const navigate = useNavigate();
  const location = useLocation();
  const { calculators } = useCalculators();
  const { documents: guidelines } = useDocuments('guideline');
  const { documents: articles } = useDocuments('article');
  const { notes } = useNotes();
  const { patients } = usePatients();

  const [query, setQuery] = useState('');
  const [debouncedQuery] = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);
  // Препараты ищет сервер: их полторы тысячи, а строка поиска стоит на каждой странице.
  const { drugs, isFetching: drugsFetching } = useDrugSearch(query, MAX_RESULTS_PER_GROUP);
  // Коды МКБ ищет тот же сервер: их 14 641, и подрубрику иначе пришлось бы искать через рубрику.
  const { results: icd10, isSearching: icdFetching } = useIcd10Search(query);

  const trimmedQuery = query.trim();
  const trimmedDebouncedQuery = debouncedQuery.trim();
  const isSearching = trimmedQuery.length > 0 && (trimmedDebouncedQuery !== trimmedQuery || drugsFetching || icdFetching);

  const groupedResults = useMemo<SearchGroup[]>(() => {
    const q = trimmedDebouncedQuery.toLowerCase();
    if (!q) return [];

    const groups: SearchGroup[] = [
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

  /**
   * Переход к находке.
   *
   * `state: { from }` — поиск такой же переход между разделами, как ссылка с дашборда: кнопка
   * «назад» на найденной странице обязана вернуть туда, где искали, а не в раздел находки.
   */
  const select = (path: string) => {
    setQuery('');
    navigate(path, { state: { from: location.pathname + location.search } });
  };

  return { query, setQuery, trimmedQuery, isSearching, groupedResults, totalResults, select };
}
