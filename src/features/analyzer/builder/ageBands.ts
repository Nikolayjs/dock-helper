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
 * Это предупреждения, а не запрет: набор полос бывает и заведомо неполным — норма, известная только
 * для детей, — и запрещать сохранение значило бы требовать выдумать остальные.
 */
export function ageBandWarnings(bands: CustomAgeBand[]): string[] {
  const warnings: string[] = [];
  const name = (band: CustomAgeBand) => {
    if (band.minAge === undefined && band.maxAge === undefined) return 'полоса без границ';
    if (band.minAge === undefined) return `до ${band.maxAge}`;
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
    if (previous.maxAge > current.minAge) {
      warnings.push(
        `Полосы «${name(previous)}» и «${name(current)}» перекрываются на ${current.minAge}–${previous.maxAge} лет: ` +
          'возьмётся та, что стоит в списке первой.',
      );
    } else if (previous.maxAge < current.minAge) {
      warnings.push(
        `Между «${name(previous)}» и «${name(current)}» нет полосы для ${previous.maxAge}–${current.minAge} лет: ` +
          'нормы для этого возраста будут взяты приблизительно, по ближайшей полосе.',
      );
    }
  }

  return warnings;
}
