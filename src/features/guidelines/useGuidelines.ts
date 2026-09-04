import { useQuery } from '@tanstack/react-query';

import { request } from '../../lib/httpRepository';
import { isDemoSession } from '../demo/demoSession';
import type { GuidelineDetails, GuidelineLink, GuidelineSection, GuidelineSummary } from './types';

/**
 * Клинические рекомендации — зеркало рубрикатора Минздрава, и живёт оно на сервере.
 *
 * Их семьсот с лишним, а текста в них двести сорок мегабайт: в браузер такое не положишь ни целиком,
 * ни выборочно. Поэтому три запроса — список, сведения с оглавлением и текст, — и каждый отвечает
 * на свой вопрос.
 *
 * **В демо-режиме раздел недоступен**, как справочник МКБ-10 и по той же причине: демо работает без
 * сервера, а зеркало живёт на нём.
 */
export class GuidelinesUnavailable extends Error {}

function guard(): void {
  if (isDemoSession()) {
    throw new GuidelinesUnavailable(
      'В демо-режиме клинические рекомендации недоступны: их семьсот с лишним, они живут на сервере, а демо работает без него.',
    );
  }
}

/**
 * Список.
 *
 * Кэшируется на весь сеанс: он меняется раз в сутки, когда синхронизация привозит новую
 * рекомендацию, а перезапрашивать полторы сотни килобайт на каждый заход в раздел незачем.
 */
export function useGuidelines() {
  const query = useQuery({
    queryKey: ['clinical-guidelines'],
    queryFn: async () => {
      guard();
      return request<GuidelineSummary[]>('/clinical-guidelines');
    },
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });
  return { guidelines: query.data ?? [], isLoading: query.isPending, error: query.error as Error | null };
}

export function useGuideline(codeVersion: string | undefined) {
  const query = useQuery({
    queryKey: ['clinical-guideline', codeVersion],
    queryFn: async () => {
      guard();
      return request<GuidelineDetails>(`/clinical-guidelines/${codeVersion}`);
    },
    enabled: Boolean(codeVersion),
    staleTime: Infinity,
    retry: false,
  });
  return { guideline: query.data ?? null, isLoading: query.isPending, error: query.error as Error | null };
}

/**
 * Текст рекомендации.
 *
 * Отдельным запросом от сведений, и это не мелочь: оглавление рисуется сразу, а текст бывает и в
 * шестьсот килобайт. Ответ приезжает сжатым — браузер разжимает его сам, `Content-Encoding` для
 * того и придуман.
 */
export function useGuidelineText(codeVersion: string | undefined) {
  const query = useQuery({
    queryKey: ['clinical-guideline-text', codeVersion],
    queryFn: async () => {
      guard();
      return request<GuidelineSection[]>(`/clinical-guidelines/${codeVersion}/text`);
    },
    enabled: Boolean(codeVersion),
    staleTime: Infinity,
    retry: false,
  });
  return { sections: query.data ?? null, isLoading: query.isPending, error: query.error as Error | null };
}

/**
 * Рекомендации, относящиеся к коду МКБ-10.
 *
 * Спрашивают о них карточка болезни и карточка кода — **и это то, что заменило прежнюю ссылку на
 * нашу карточку-справку**. Та связь хранилась полем и держалась на совпадении названий; здесь она
 * считается по кодам, которые у обеих сторон и так есть, и поэтому не устаревает.
 *
 * Отдельным запросом, а не отбором по загруженному списку: сводить рубрику с подрубрикой умеет
 * сервер, и правило там общее с заболеваниями — второе, написанное в браузере, разошлось бы с ним.
 */
export function useGuidelinesByCode(code: string | undefined) {
  const query = useQuery({
    queryKey: ['clinical-guidelines-by-code', code],
    queryFn: async () => {
      guard();
      return request<GuidelineLink[]>(`/clinical-guidelines/by-code/${encodeURIComponent(code!)}`);
    },
    enabled: Boolean(code),
    staleTime: Infinity,
    retry: false,
  });
  return { guidelines: query.data ?? [], isLoading: query.isPending };
}
