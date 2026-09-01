import type { StoreItem } from '../store/useStore';

/**
 * Витрина магазина в демо-режиме.
 *
 * Показывается, а не прячется: магазин — это то, ради чего продукт открывают, и гостю честнее
 * увидеть, что в нём лежит. **Установка при этом недоступна и говорит об этом словами** — она
 * меняет набор рабочего пространства, а гостевая сессия обещает, что ничего не сохраняется. Прятать
 * кнопку было бы хуже: тогда непонятно, что магазин вообще умеет.
 *
 * Отмеченное установленным совпадает с тем, что в демо действительно лежит: показать «Установить»
 * там, где запись уже есть в разделе, значило бы соврать про собственную же фикстуру.
 */
const DEMO_STORE_ITEMS: Omit<StoreItem, 'installed' | 'installedId'>[] = [
  {
    kind: 'analyzer',
    key: 'cbc',
    title: 'Общий анализ крови',
    description: 'Гемоглобин, эритроциты, лейкоцитарная формула, тромбоциты, СОЭ.',
    specialties: [],
    price: 0,
  },
  {
    kind: 'analyzer',
    key: 'biochemistry',
    title: 'Биохимия крови',
    description: 'Печёночные пробы, почечные показатели, глюкоза, липиды, электролиты.',
    specialties: [],
    price: 0,
  },
  {
    kind: 'calculator',
    key: 'bmi',
    title: 'Индекс массы тела',
    description: 'ИМТ по росту и весу с интерпретацией по категориям ВОЗ.',
    specialties: [],
    price: 0,
  },
  {
    kind: 'calculator',
    key: 'phq-9',
    title: 'PHQ-9: скрининг депрессии',
    description:
      'Девять вопросов о состоянии за последние две недели. Положительный ответ на девятый пункт требует оценки суицидального риска независимо от суммы.',
    specialties: ['psychiatry', 'therapy', 'neurology'],
    price: 0,
  },
  {
    kind: 'calculator',
    key: 'mmrc',
    title: 'Шкала одышки mMRC',
    description: 'Пять градаций одышки при повседневной активности — используется при ХОБЛ.',
    specialties: ['pulmonology', 'therapy'],
    price: 0,
  },
  {
    kind: 'questionnaire',
    key: 'chest-pain',
    title: 'Боль в грудной клетке',
    description:
      'Дифференциальная диагностика боли в груди: сначала отделяется жизнеугрожающее — ОКС, ТЭЛА, расслоение аорты, пневмоторакс.',
    specialties: ['cardiology', 'therapy', 'pulmonology'],
    price: 0,
  },
  {
    kind: 'questionnaire',
    key: 'headache',
    title: 'Головная боль',
    description: 'Первичная или вторичная: красные флаги, мигрень, головная боль напряжения, кластерная.',
    specialties: ['neurology', 'therapy'],
    price: 0,
  },
  {
    kind: 'questionnaire',
    key: 'vertigo',
    title: 'Головокружение',
    description: 'Разграничение центрального и периферического — ошибка здесь означает пропущенный инсульт.',
    specialties: ['neurology', 'otorhinolaryngology', 'therapy'],
    price: 0,
  },
  {
    kind: 'template',
    key: 'certificate',
    title: 'Справка о посещении',
    description: 'Имя, дата рождения и дата визита подставляются из карточки пациента.',
    specialties: [],
    price: 0,
  },
  {
    kind: 'template',
    key: 'form-086u',
    title: 'Форма 086/у',
    description:
      'Медицинская справка поступающему в учебное заведение: заключения специалистов, прививки, вывод о профпригодности.',
    specialties: ['therapy', 'pediatrics'],
    price: 0,
  },
];

/** Раздел демо-хранилища, в котором лежат записи этого вида. */
const COLLECTION: Record<StoreItem['kind'], string> = {
  analyzer: '/custom-lab-tests',
  calculator: '/calculators',
  questionnaire: '/questionnaires',
  template: '/document-templates',
};

export function demoStoreItems(data: Record<string, Record<string, unknown>[]>): StoreItem[] {
  return DEMO_STORE_ITEMS.map((item) => {
    const rows = data[COLLECTION[item.kind]] ?? [];
    const installed = rows.find((row) => String(row.title ?? '') === item.title);
    return { ...item, installed: Boolean(installed), installedId: installed ? String(installed.id) : null };
  });
}
