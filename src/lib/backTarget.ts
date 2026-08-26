import { useLocation } from 'react-router-dom';

/**
 * Куда возвращает кнопка «назад» и как она при этом называется.
 *
 * Раньше каждая страница знала только свой раздел: калькулятор, открытый с дашборда, уводил в
 * список калькуляторов, статья из графа знаний — в список статей. Теперь ссылка может сказать,
 * откуда пришли (`state={{ from }}`), а страница возвращает именно туда.
 *
 * Механизм намеренно **явный**, а не «предыдущий адрес из истории». История знает и промежуточные
 * шаги: после «статья → правка → сохранение» предыдущим адресом будет редактор, и кнопка «назад»
 * вернёт в него же. Ссылка, которая сама сообщает происхождение, ошибается только там, где её
 * забыли проставить, — и тогда работает прежнее поведение, то есть возврат в свой раздел.
 */
export interface BackTarget {
  to: string;
  label: string;
}

/**
 * Разделы, из которых можно прийти. Порядок важен: первый совпавший префикс выигрывает, поэтому
 * более длинные пути идут раньше своих родителей.
 */
const SECTION_LABELS: { prefix: string; label: string }[] = [
  { prefix: '/dashboard', label: 'На дашборд' },
  { prefix: '/calendar', label: 'К календарю' },
  { prefix: '/doctor', label: 'В профиль' },
  { prefix: '/patients/dispensary/stats', label: 'К отчёту' },
  { prefix: '/patients/documents', label: 'К бланкам' },
  { prefix: '/patients', label: 'К пациентам' },
  { prefix: '/calculators', label: 'К калькуляторам' },
  { prefix: '/questionnaires', label: 'К анкетам' },
  { prefix: '/analyzer', label: 'К анализам' },
  { prefix: '/drugs', label: 'К справочнику' },
  { prefix: '/interactions', label: 'К взаимодействиям' },
  { prefix: '/planner', label: 'К планеру' },
  { prefix: '/notes', label: 'К заметкам' },
  { prefix: '/library', label: 'К библиотеке' },
  { prefix: '/news', label: 'К новостям' },
  { prefix: '/guidelines', label: 'К рекомендациям' },
  { prefix: '/articles', label: 'К статьям' },
  { prefix: '/knowledge', label: 'К базе знаний' },
];

/** Название возврата по адресу; `null`, если раздел неизвестен. */
export function labelForPath(path: string): string | null {
  return SECTION_LABELS.find((section) => path === section.prefix || path.startsWith(`${section.prefix}?`) || path.startsWith(`${section.prefix}/`))?.label ?? null;
}

/** Читает происхождение из состояния перехода; вернёт `undefined`, если ссылка его не проставила. */
export function readFrom(state: unknown): string | undefined {
  const from = (state as { from?: unknown } | null)?.from;
  return typeof from === 'string' && from.startsWith('/') ? from : undefined;
}

/**
 * Куда вести кнопку «назад»: туда, откуда пришли, иначе — в раздел страницы.
 *
 * Подпись берётся из карты разделов: возврат на дашборд должен называться «На дашборд», а не
 * «К списку калькуляторов», иначе кнопка обещает одно, а делает другое.
 */
export function useBackTarget(fallback: BackTarget): BackTarget {
  const { state } = useLocation();
  const from = readFrom(state);
  if (!from) return fallback;
  return { to: from, label: labelForPath(from) ?? fallback.label };
}

/** Происхождение, которое страница должна передать дальше — в свой редактор, например. */
export function useFrom(): string | undefined {
  return readFrom(useLocation().state);
}
