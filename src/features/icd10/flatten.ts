import type { Icd10ListRow, Icd10Row } from './types';

/**
 * Отбор и разворачивание классификации в плоский список строк.
 *
 * Вынесено из компонента отдельной функцией, потому что здесь три правила, каждое из которых легко
 * нарушить незаметно, и все три проверяются тестом.
 *
 * 1. **Подрубрика всегда идёт следом за своей рубрикой.** Сортировка переставляет рубрики, а
 *    подрубрики едут вместе с ними: `I21.0`, оказавшийся рядом с чужим кодом, прочитается как
 *    самостоятельный диагноз, а не как уточнение инфаркта.
 * 2. **Совпадение в подрубрике показывает и её рубрику.** Иначе врач видит «I21.4 Острый
 *    субэндокардиальный инфаркт» без строки о том, что это инфаркт миокарда, — то есть код без
 *    места в классификации.
 * 3. **Совпадение в рубрике показывает все её подрубрики.** Найдя «инфаркт», врач выбирает из
 *    уточнений, а не получает одну строку, которую всё равно нельзя поставить в диагноз.
 */
export interface FlattenOptions {
  /** Поисковый запрос: пусто — показывается всё. */
  query: string;
  /** Римский номер класса или `null`. */
  chapter: string | null;
  /** Только рубрики и подрубрики с написанной справкой. */
  onlyWithNote: boolean;
  /** Показывать подрубрики. Выключено — остаётся оглавление из одних рубрик. */
  showChildren: boolean;
}

const matches = (query: string, code: string, name: string) =>
  code.toLowerCase().includes(query) || name.toLowerCase().includes(query);

export function flattenIcd10(rows: Icd10ListRow[], options: FlattenOptions): Icd10Row[] {
  const query = options.query.trim().toLowerCase();
  const result: Icd10Row[] = [];

  for (const rubric of rows) {
    if (options.chapter && rubric.chapter !== options.chapter) continue;

    const rubricMatchesQuery = !query || matches(query, rubric.code, rubric.name);
    const rubricPassesNote = !options.onlyWithNote || rubric.hasNote;

    // Подрубрики отбираются своими правилами: запрос может совпасть только с одной из них.
    const children = options.showChildren
      ? rubric.children.filter((child) => {
          if (options.onlyWithNote && !child.hasNote) return false;
          if (!query) return true;
          // Совпала сама рубрика — показываются все её уточнения: из них и выбирают.
          return rubricMatchesQuery || matches(query, child.code, child.name);
        })
      : [];

    // Рубрика остаётся в списке и тогда, когда совпала не она, а её подрубрика: без строки рубрики
    // код теряет место в классификации.
    const keepRubric = (rubricMatchesQuery && rubricPassesNote) || children.length > 0;
    if (!keepRubric) continue;

    result.push({
      code: rubric.code,
      name: rubric.name,
      chapter: rubric.chapter,
      blockRange: rubric.blockRange,
      blockName: rubric.blockName,
      hasNote: rubric.hasNote,
      depth: 0,
      children: rubric.children.length,
    });

    for (const child of children) {
      result.push({
        code: child.code,
        name: child.name,
        chapter: rubric.chapter,
        blockRange: rubric.blockRange,
        blockName: rubric.blockName,
        hasNote: child.hasNote,
        depth: 1,
        children: 0,
      });
    }
  }

  return result;
}

/** Сколько кодов показано: рубрики и подрубрики считаются вместе — это и есть длина списка. */
export function countTotal(rows: Icd10ListRow[]): number {
  return rows.reduce((sum, rubric) => sum + 1 + rubric.children.length, 0);
}
