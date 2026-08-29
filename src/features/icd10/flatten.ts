import type { Icd10ChildrenMap, Icd10ListRow, Icd10Row } from './types';

/**
 * Отбор и разворачивание классификации в плоский список строк.
 *
 * Вынесено из компонента отдельной функцией, потому что здесь четыре правила, каждое из которых
 * легко нарушить незаметно, и все четыре проверяются тестом.
 *
 * 1. **Подрубрика всегда идёт следом за своей рубрикой.** Сортировка переставляет рубрики, а
 *    подрубрики едут вместе с ними: `I21.0`, оказавшийся рядом с чужим кодом, прочитается как
 *    самостоятельный диагноз, а не как уточнение инфаркта.
 * 2. **Отбор раскрывает рубрику сам.** Запрос и «только со справкой» — это попытка что-то найти,
 *    и прятать найденное за нераскрытой рубрикой значило бы отвечать «ничего нет» на то, что есть.
 *    Раскрытие руками нужно, только когда не ищут, а смотрят.
 * 3. **Совпадение в подрубрике показывает и её рубрику.** Иначе врач видит «I21.4 Острый
 *    субэндокардиальный инфаркт» без строки о том, что это инфаркт миокарда, — то есть код без
 *    места в классификации.
 * 4. **Совпадение в рубрике показывает все её подрубрики.** Найдя «инфаркт», врач выбирает из
 *    уточнений, а не получает одну строку, которую всё равно нельзя поставить в диагноз.
 */
export interface FlattenOptions {
  /** Поисковый запрос: пусто — показывается всё. */
  query: string;
  /** Римский номер класса или `null`. */
  chapter: string | null;
  /** Только рубрики и подрубрики с написанной справкой. */
  onlyWithNote: boolean;
  /** Рубрики, раскрытые врачом вручную. */
  expanded: ReadonlySet<string>;
}

const matches = (query: string, code: string, name: string) =>
  code.toLowerCase().includes(query) || name.toLowerCase().includes(query);

/**
 * @param children Подрубрики всех рубрик или `null`, пока они не приехали. Пока их нет, список
 *   состоит из одних рубрик — это не пустой результат, а неполный, и страница говорит об этом
 *   отдельно: молча показать половину справочника хуже, чем показать её с оговоркой.
 */
export function flattenIcd10(
  rows: Icd10ListRow[],
  children: Icd10ChildrenMap | null,
  options: FlattenOptions,
): Icd10Row[] {
  const query = options.query.trim().toLowerCase();
  const filtering = query !== '' || options.onlyWithNote;
  const result: Icd10Row[] = [];

  for (const rubric of rows) {
    if (options.chapter && rubric.chapter !== options.chapter) continue;

    const rubricMatchesQuery = !query || matches(query, rubric.code, rubric.name);
    const rubricPassesNote = !options.onlyWithNote || rubric.hasNote;

    // Подрубрики отбираются своими правилами: запрос может совпасть только с одной из них.
    const pool = children?.[rubric.code.toUpperCase()] ?? [];
    const passing = pool.filter((child) => {
      if (options.onlyWithNote && !child.hasNote) return false;
      if (!query) return true;
      // Совпала сама рубрика — показываются все её уточнения: из них и выбирают.
      return rubricMatchesQuery || matches(query, child.code, child.name);
    });

    // Пока отбирают — раскрывает отбор; когда просто смотрят — раскрывает врач.
    const visible = filtering ? passing : options.expanded.has(rubric.code) ? passing : [];

    // Рубрика остаётся в списке и тогда, когда совпала не она, а её подрубрика: без строки рубрики
    // код теряет место в классификации.
    const keepRubric = (rubricMatchesQuery && rubricPassesNote) || visible.length > 0;
    if (!keepRubric) continue;

    result.push({
      code: rubric.code,
      name: rubric.name,
      chapter: rubric.chapter,
      blockRange: rubric.blockRange,
      blockName: rubric.blockName,
      hasNote: rubric.hasNote,
      depth: 0,
      children: rubric.childCount,
      expanded: visible.length > 0,
    });

    for (const child of visible) {
      result.push({
        code: child.code,
        name: child.name,
        chapter: rubric.chapter,
        blockRange: rubric.blockRange,
        blockName: rubric.blockName,
        hasNote: child.hasNote,
        depth: 1,
        children: 0,
        expanded: false,
      });
    }
  }

  return result;
}

/**
 * Сколько кодов в классификации всего.
 *
 * Считается по самим рубрикам, а не по загруженным подрубрикам: число уточнений известно каждой
 * рубрике с первого запроса, и «14 641» на странице не должно ждать второго.
 */
export function countTotal(rows: Icd10ListRow[]): number {
  return rows.reduce((sum, rubric) => sum + 1 + rubric.childCount, 0);
}
