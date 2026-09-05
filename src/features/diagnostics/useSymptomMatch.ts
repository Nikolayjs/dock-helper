import { useDebouncedValue } from '@mantine/hooks';
import { useQuery } from '@tanstack/react-query';

import { request } from '../../lib/httpRepository';
import type { SymptomFrequency } from './types';

const DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 2;

export interface SymptomSuggestion {
  label: string;
  diseaseCount: number;
}

export interface TermMatch {
  term: string;
  /** Формулировка признака в панели этой болезни — та, по которой он нашёлся. */
  label: string | null;
  frequency: SymptomFrequency | null;
  strength: number;
}

export interface MatchPanel {
  id: string;
  title: string;
}

export interface DiseaseMatch {
  diseaseId: string;
  name: string;
  description: string;
  panels: MatchPanel[];
  score: number;
  covered: number;
  terms: TermMatch[];
}

export interface TermSummary {
  term: string;
  diseaseCount: number;
}

export interface MatchResult {
  panelCount: number;
  terms: TermSummary[];
  /** Сколько подошло всего: `matches` обрезан потолком сервера. */
  total: number;
  matches: DiseaseMatch[];
}

/**
 * Подсказка формулировок признака — с сервера, как поиск препаратов и поиск по МКБ-10.
 *
 * Замер, из-за которого это не считается в браузере: `GET /questionnaires` со всеми 68
 * установленными панелями — **3,07 МБ, 427 КБ в сжатом виде**, больше всего дашборда. Возить
 * корпус целиком ради строки поиска нельзя; ответ подсказки — меньше килобайта.
 */
export function useSymptomSuggestions(query: string) {
  const [debounced] = useDebouncedValue(query.trim(), DEBOUNCE_MS);
  const enabled = debounced.length >= MIN_QUERY_LENGTH;

  const { data, isFetching } = useQuery({
    queryKey: ['symptom-suggestions', debounced],
    queryFn: () => request<SymptomSuggestion[]>(`/questionnaires/symptoms?q=${encodeURIComponent(debounced)}`),
    enabled,
    // Панели меняются редко: повторный набор того же слова не должен идти в сеть.
    staleTime: 5 * 60_000,
  });

  return { suggestions: enabled ? (data ?? []) : [], isFetching: enabled && isFetching };
}

/**
 * Подбор заболеваний по набранным признакам.
 *
 * POST, хотя ничего не меняет: признаков бывает десяток, каждый — фраза с запятыми и скобками, и в
 * строке запроса это вышло бы полотно, которое вдобавок попадает в лог. Через этот раздел ходят
 * жалобы пациента.
 */
export function useSymptomMatch(terms: string[]) {
  const cleaned = terms.map((t) => t.trim()).filter(Boolean);

  const { data, isFetching, error } = useQuery({
    queryKey: ['symptom-match', cleaned],
    queryFn: () =>
      request<MatchResult>('/questionnaires/match', { method: 'POST', body: JSON.stringify({ terms: cleaned }) }),
    enabled: cleaned.length > 0,
    staleTime: 5 * 60_000,
  });

  return { result: cleaned.length > 0 ? (data ?? null) : null, isFetching: cleaned.length > 0 && isFetching, error };
}
