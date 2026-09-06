import type { OrganismGroup } from './types';

/**
 * Названия групп возбудителей по-русски.
 *
 * Живут отдельным файлом, а не в компоненте, потому что их читают двое: список справочника и
 * карточка возбудителя. Вторая копия разошлась бы с первой на первом же переименовании, и врач
 * увидел бы одну и ту же группу под двумя именами на соседних экранах.
 */
export const GROUP_LABEL: Record<OrganismGroup, string> = {
  enterobacterales: 'Энтеробактерии',
  nonfermenter: 'Неферментирующие',
  staphylococcus: 'Стафилококки',
  streptococcus: 'Стрептококки',
  enterococcus: 'Энтерококки',
  haemophilus: 'Гемофилы',
  moraxella: 'Моракселлы',
  neisseria: 'Нейссерии',
  corynebacterium: 'Коринебактерии',
  listeria: 'Листерии',
  anaerobe: 'Анаэробы',
  mycoplasma: 'Микоплазмы',
  chlamydia: 'Хламидии',
  yeast: 'Дрожжевые грибы',
  mold: 'Плесневые грибы',
  lactobacillus: 'Лактобактерии',
  gardnerella: 'Гарднереллы',
  other: 'Прочие',
};

export const groupLabel = (group: OrganismGroup): string => GROUP_LABEL[group] ?? group;
