import type { CustomAgeBand } from '../customTypes';

/**
 * Что не так с набором возрастных полос — словами, рядом с самими полосами.
 *
 * Полосы задаются двумя свободными числами, а движок берёт **первую подходящую**. Отсюда две
 * ошибки, которых не видно ни по одному признаку:
 *
 * - **Перекрытие.** Полосы `0–14` и `12–18` дают тринадцатилетнему всегда первую — то есть вторая
 *   норма не работает вовсе, а какая из них верна, решает порядок в списке.
 * - **Разрыв.** Между `0–12` и `14–18` нет полосы для тринадцати лет; движок возьмёт ближайшую по
 *   границе и честно пометит результат «нормы взяты приблизительно» — то есть симптом виден, а
 *   причина нет.
 *
 * **Обе границы полосы включающие** (`minAge <= age <= maxAge`), и от этого зависит вся арифметика
 * ниже. Пара `0–14` и `14–18` — это **перекрытие**: четырнадцатилетний попадает в обе, и берётся
 * та, что стоит в списке первой. Раньше сравнение было строгим (`previous.maxAge > current.minAge`),
 * и такая пара проходила молча — самый частый способ записать полосы, и самый тихий способ ошибиться.
 * Соседние без пропуска — это `0–14` и `15–18`; разрывом считается только настоящая дыра
 * (`current.minAge > previous.maxAge + 1`).
 *
 * Это предупреждения, а не запрет: набор полос бывает и заведомо неполным — норма, известная только
 * для детей, — и запрещать сохранение значило бы требовать выдумать остальные.
 */
export function ageBandWarnings(bands: CustomAgeBand[]): string[] {
  const warnings: string[] = [];
  const name = (band: CustomAgeBand) => {
    if (band.minAge === undefined && band.maxAge === undefined) return 'полоса без границ';
    if (band.minAge === undefined) return `до ${band.maxAge} включительно`;
    if (band.maxAge === undefined) return `${band.minAge} и старше`;
    return `${band.minAge}–${band.maxAge}`;
  };

  const usable = bands.filter((band) => !(band.minAge !== undefined && band.maxAge !== undefined && band.minAge > band.maxAge));
  if (usable.length > 1 && usable.some((band) => band.minAge === undefined && band.maxAge === undefined)) {
    warnings.push('Полоса без границ принимает любой возраст: полосы после неё не сработают никогда.');
  }

  const sorted = [...usable].sort((a, b) => (a.minAge ?? 0) - (b.minAge ?? 0));
  for (let i = 1; i < sorted.length; i++) {
    const previous = sorted[i - 1];
    const current = sorted[i];
    if (previous.maxAge === undefined) {
      warnings.push(`Полоса «${name(previous)}» не имеет верхней границы: «${name(current)}» не сработает никогда.`);
      continue;
    }
    if (current.minAge === undefined) continue;
    // `>=`, а не `>`: границы включающие, и на 14 годах полосы «0–14» и «14–18» перекрываются.
    if (previous.maxAge >= current.minAge) {
      const overlap =
        current.minAge === previous.maxAge
          ? `на ${previous.maxAge} годах`
          : `на ${current.minAge}–${previous.maxAge} лет`;
      warnings.push(
        `Полосы «${name(previous)}» и «${name(current)}» перекрываются ${overlap}: ` +
          'возьмётся та, что стоит в списке первой.',
      );
    } else if (current.minAge > previous.maxAge + 1) {
      // Дыра — это пропущенные годы между полосами. `0–14` и `15–18` идут стык-в-стык.
      const from = previous.maxAge + 1;
      const to = current.minAge - 1;
      warnings.push(
        `Между «${name(previous)}» и «${name(current)}» нет полосы для ${from === to ? `${from} лет` : `${from}–${to} лет`}: ` +
          'нормы для этого возраста будут взяты приблизительно, по ближайшей полосе.',
      );
    }
  }

  return warnings;
}
