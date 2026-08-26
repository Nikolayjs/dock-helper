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
 *
 * `item` — название для возврата **внутрь** раздела, а не в его список. Ходят не только со списков:
 * из карточки пациента открывают его документ, из документа — карточку пациента. Без этого кнопка
 * обещала бы «К пациентам», а возвращала к одному конкретному — то есть ровно то враньё, ради
 * которого весь этот механизм и заведён. Раздел без `item` подписывается своим общим названием.
 */
const SECTION_LABELS: { prefix: string; label: string; item?: string }[] = [
  { prefix: '/dashboard', label: 'На дашборд' },
  { prefix: '/calendar', label: 'К календарю' },
  { prefix: '/doctor', label: 'В профиль' },
  { prefix: '/patients/dispensary/stats', label: 'К отчёту' },
  { prefix: '/documents', label: 'К документам', item: 'К документу' },
  { prefix: '/patients', label: 'К пациентам', item: 'К пациенту' },
  { prefix: '/calculators', label: 'К калькуляторам', item: 'К калькулятору' },
  { prefix: '/questionnaires', label: 'К анкетам', item: 'К анкете' },
  { prefix: '/analyzer', label: 'К анализам' },
  { prefix: '/drugs', label: 'К справочнику', item: 'К препарату' },
  { prefix: '/interactions', label: 'К взаимодействиям' },
  { prefix: '/planner', label: 'К планеру' },
  { prefix: '/notes', label: 'К заметкам', item: 'К заметке' },
  { prefix: '/library', label: 'К библиотеке', item: 'К книге' },
  { prefix: '/news', label: 'К новостям', item: 'К новости' },
  { prefix: '/guidelines', label: 'К рекомендациям', item: 'К рекомендации' },
  { prefix: '/articles', label: 'К статьям', item: 'К статье' },
  { prefix: '/knowledge', label: 'К базе знаний' },
];

/**
 * Название возврата по адресу; `null`, если раздел неизвестен.
 *
 * Сам раздел — это его адрес и он же со строкой запроса: `/documents?tab=templates` — всё ещё
 * список, а не документ. Всё, что глубже, — уже что-то одно внутри раздела.
 */
export function labelForPath(path: string): string | null {
  const section = SECTION_LABELS.find(
    (candidate) =>
      path === candidate.prefix || path.startsWith(`${candidate.prefix}?`) || path.startsWith(`${candidate.prefix}/`),
  );
  if (!section) return null;
  return path.startsWith(`${section.prefix}/`) ? (section.item ?? section.label) : section.label;
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
