import { describe, expect, it } from 'vitest';

import { buildDrugIndex, checkInteractions, findSharedComponents, interactionsForDrug, otherDrugIn } from './interactionEngine';
import { componentsOf, isLocalRoute } from './combinations';
import type { DrugSummary } from '../drugs/types';
import type { DrugInteraction } from './types';

const drug = (inn: string, brandNames: string[], atcCode: string): DrugSummary => ({
  id: inn,
  inn,
  brandNames,
  category: 'Боль и воспаление',
  pharmGroup: 'НПВС',
  atcCode,
  createdAt: '',
  updatedAt: '',
});

const DRUGS: DrugSummary[] = [
  drug('Ибупрофен', ['Нурофен'], 'M01AE01'),
  drug('Парацетамол', ['Панадол'], 'N02BE01'),
  drug('Варфарин', ['Мареван'], 'B01AA03'),
  drug('Ибупрофен/парацетамол', ['Ибуклин'], 'N02BE51'),
  drug('Парацетамол/фенилэфрин/фенирамин', ['Терафлю'], 'N02BE51'),
  drug('Преднизолон', ['Медопред'], 'H02AB06'),
  drug('Тернидазол/неомицин/нистатин/преднизолон', ['Тержинан'], 'G01AA51'),
  drug('Тимолол', ['Арутимол'], 'S01ED01'),
  drug('Дорзоламид/тимолол', ['Косопт'], 'S01ED51'),
  drug('Верапамил', ['Изоптин'], 'C08DA01'),
];

const rule = (id: string, drugA: string, drugB: string): DrugInteraction => ({
  id,
  drugA,
  drugB,
  severity: 'major',
  mechanism: 'механизм',
  recommendation: 'рекомендация',
});

const RULES: DrugInteraction[] = [
  rule('r1', 'Ибупрофен', 'Варфарин'),
  rule('r2', 'Преднизолон', 'Варфарин'),
  rule('r3', 'Тимолол', 'Верапамил'),
  rule('r4', 'Ибупрофен', 'Парацетамол'),
];

const index = buildDrugIndex(DRUGS);
const ids = (entered: string[]) => checkInteractions(entered, RULES, index).map((m) => m.interaction.id);

describe('состав комбинации', () => {
  it('читается из МНН, у монопрепарата пустой', () => {
    expect(componentsOf('Ибупрофен/парацетамол')).toEqual(['ибупрофен', 'парацетамол']);
    expect(componentsOf('Ибупрофен')).toEqual([]);
  });

  it('местную форму отличает код ATC, а средства от глаукомы — исключение', () => {
    expect(isLocalRoute('G01AA51')).toBe(true); // вагинальные суппозитории
    expect(isLocalRoute('D07XC01')).toBe(true); // наружные
    expect(isLocalRoute('S01CA01')).toBe(true); // глазные противовоспалительные
    expect(isLocalRoute('S01ED51')).toBe(false); // глазные бета-блокаторы всасываются
    expect(isLocalRoute('N02BE51')).toBe(false);
    expect(isLocalRoute('')).toBe(false);
  });
});

describe('проверка взаимодействий', () => {
  it('срабатывает на компонент комбинации, названной торговым именем', () => {
    expect(ids(['Ибуклин', 'Варфарин'])).toEqual(['r1']);
  });

  it('на монопрепарате работает как раньше', () => {
    expect(ids(['Нурофен', 'Варфарин'])).toEqual(['r1']);
  });

  it('не повторяет правило, совпавшее двумя путями сразу', () => {
    // Ибупрофен здесь назван дважды — «Нурофеном» и внутри «Ибуклина», — но правило одно.
    // r4 («Ибупрофен + Парацетамол») при этом срабатывает законно: это два разных препарата
    // из списка, а не два компонента одной таблетки.
    const matched = ids(['Ибуклин', 'Нурофен', 'Варфарин']);
    expect(matched.filter((id) => id === 'r1')).toHaveLength(1);
    expect(matched).toEqual(['r1', 'r4']);
  });

  it('называет компонент, по которому сработало, и только его', () => {
    const [match] = checkInteractions(['Ибуклин', 'Варфарин'], RULES, index);
    expect(match.viaA).toBe('Ибупрофен');
    expect(match.viaB).toBeUndefined();
  });

  it('молчит про взаимодействие двух компонентов одной таблетки', () => {
    // r4 — «Ибупрофен + Парацетамол», и оба они внутри «Ибуклина».
    expect(ids(['Ибуклин'])).toEqual([]);
  });

  it('не переносит системные правила на местную форму', () => {
    // «Тержинан» содержит преднизолон, но это вагинальные суппозитории.
    expect(ids(['Тержинан', 'Варфарин'])).toEqual([]);
    expect(ids(['Медопред', 'Варфарин'])).toEqual(['r2']);
  });

  it('оставляет системные правила глазным бета-блокаторам', () => {
    expect(ids(['Косопт', 'Верапамил'])).toEqual(['r3']);
  });
});

describe('одно вещество дважды', () => {
  it('находит парацетамол в двух разных препаратах', () => {
    const shared = findSharedComponents(['Ибуклин', 'Терафлю'], index);
    expect(shared).toHaveLength(1);
    expect(shared[0].component).toBe('Парацетамол');
    expect(shared[0].drugs.map((d) => d.entered)).toEqual(['Ибуклин', 'Терафлю']);
  });

  it('находит и пару «комбинация + монопрепарат»', () => {
    const shared = findSharedComponents(['Ибуклин', 'Нурофен'], index);
    expect(shared.map((s) => s.component)).toEqual(['Ибупрофен']);
  });

  it('молчит, когда общего вещества нет', () => {
    expect(findSharedComponents(['Ибуклин', 'Варфарин'], index)).toEqual([]);
  });

  it('не считает повтором один и тот же препарат под двумя именами', () => {
    expect(findSharedComponents(['Нурофен', 'Ибупрофен'], index)).toEqual([]);
  });
});

describe('карточка препарата', () => {
  it('показывает правила компонентов у комбинации', () => {
    const combo = DRUGS.find((d) => d.inn === 'Ибупрофен/парацетамол')!;
    expect(interactionsForDrug(combo, RULES, index).map((r) => r.id)).toEqual(['r1']);
  });

  it('называет вторым препаратом того, кто не входит в саму комбинацию', () => {
    const combo = DRUGS.find((d) => d.inn === 'Ибупрофен/парацетамол')!;
    expect(otherDrugIn(RULES[0], combo, index)).toBe('Варфарин');
  });

  it('не показывает местной форме правила её системного компонента', () => {
    const local = DRUGS.find((d) => d.inn === 'Тернидазол/неомицин/нистатин/преднизолон')!;
    expect(interactionsForDrug(local, RULES, index)).toEqual([]);
  });
});
