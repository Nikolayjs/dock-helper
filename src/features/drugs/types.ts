export interface Drug {
  id: string;
  /** МНН — the canonical name every interaction rule is written in. */
  inn: string;
  /** Trade names. The bridge between what the patient says and what the rules know. */
  brandNames: string[];
  /** Раздел справочника — короткий список, по нему и фильтруют. */
  category: string;
  pharmGroup: string;
  atcCode: string;
  forms: string[];
  indications: string;
  dosing: string;
  contraindications: string;
  sideEffects: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type DrugInput = Omit<Drug, 'id' | 'createdAt' | 'updatedAt'>;

export const EMPTY_DRUG: DrugInput = {
  inn: '',
  brandNames: [],
  category: '',
  pharmGroup: '',
  atcCode: '',
  forms: [],
  indications: '',
  dosing: '',
  contraindications: '',
  sideEffects: '',
  notes: '',
};

/** The long text fields, in the order they are shown on a card and in the editor. */
export const DRUG_TEXT_FIELDS: { key: keyof DrugInput & string; label: string; placeholder: string }[] = [
  { key: 'indications', label: 'Показания', placeholder: 'При каких состояниях назначается' },
  { key: 'dosing', label: 'Дозирование', placeholder: 'Обычная доза у взрослых, кратность, связь с едой' },
  { key: 'contraindications', label: 'Противопоказания', placeholder: 'Когда назначать нельзя' },
  { key: 'sideEffects', label: 'Побочные эффекты', placeholder: 'Что чаще всего беспокоит пациента' },
  { key: 'notes', label: 'Особые указания', placeholder: 'Беременность, дети, почки и печень, контроль показателей' },
];

/**
 * Разделы справочника.
 *
 * Умышленно короткий список: `pharmGroup` точна и принимает почти две сотни разных значений, а
 * фильтр из двухсот пунктов — это не фильтр. Значения совпадают с DRUG_CATEGORIES на бэкенде.
 */
export const DRUG_CATEGORIES = [
  'Сердце и сосуды',
  'Кровь и антикоагулянты',
  'Антибиотики и противомикробные',
  'ЛОР',
  'Дыхательная система',
  'Аллергия и гормоны',
  'Пищеварение',
  'Эндокринология',
  'Неврология и психиатрия',
  'Боль и воспаление',
  'Прочее',
];
