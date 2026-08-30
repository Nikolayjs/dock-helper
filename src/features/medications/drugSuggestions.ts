import type { DrugSummary } from '../drugs/types';

export interface DrugOption {
  /** Что подставится в поле и уйдёт в проверку взаимодействий. */
  value: string;
  /**
   * МНН — когда оно отличается от самого имени.
   *
   * Показывается **рядом** с вариантом, но в поле не попадает, и это исправленная ошибка. У
   * `Autocomplete` из Mantine нет пары «значение — подпись»: выбранный вариант вставляется своей
   * **подписью**. Со строкой «Кардиомагнил · Ацетилсалициловая кислота» в подписи в карту попадало
   * ровно это, и проверка отвечала «нет в справочнике» — то есть подсказка ломала ровно то, ради
   * чего список и заводится. Поймано прогоном, а не типами: типы здесь довольны обоими вариантами.
   */
  inn?: string;
}

/**
 * Подсказка названий для списка постоянной терапии.
 *
 * **МНН предлагается всегда, даже когда врач набрал торговое**, и это главное здесь: правила
 * взаимодействий написаны на МНН, и записанный «Конкор» разрешается в «Бисопролол» только пока
 * это торговое название стоит в формуляре. Имя, выбранное из подсказки как МНН, разрешается
 * всегда — поэтому оно и предлагается рядом.
 *
 * Найденное по началу слова идёт первым: набрав «конк», врач ждёт «Конкор», а не препарат, у
 * которого эти буквы стоят в середине.
 */
export function drugOptions(drugs: DrugSummary[], query: string, limit = 8): DrugOption[] {
  const needle = query.trim().toLowerCase();
  const options: DrugOption[] = [];
  const taken = new Set<string>();

  for (const drug of drugs) {
    const names = [drug.inn, ...drug.brandNames];
    const matching = needle ? names.filter((name) => name.toLowerCase().includes(needle)) : names;
    // Препарат мог найтись не по имени вовсе (сервер ищет шире) — тогда предлагается его МНН.
    const chosen = matching.length > 0 ? [...matching] : [drug.inn];
    if (!chosen.includes(drug.inn)) chosen.push(drug.inn);

    for (const name of chosen) {
      const key = name.toLowerCase();
      // Одно торговое название у двух МНН — известная неоднозначность формуляра; в поле уходит одна
      // и та же строка, а разрешать её будет проверка, поэтому здесь остаётся первая.
      if (taken.has(key)) continue;
      taken.add(key);
      options.push(name === drug.inn ? { value: name } : { value: name, inn: drug.inn });
    }
  }

  const startsWith = (option: DrugOption) => (needle && option.value.toLowerCase().startsWith(needle) ? 0 : 1);
  return options.sort((a, b) => startsWith(a) - startsWith(b)).slice(0, limit);
}
