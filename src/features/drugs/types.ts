/**
 * Препарат в том объёме, в каком его отдаёт список.
 *
 * Ровно те поля, по которым ищут, фильтруют и сопоставляют торговое название с правилом
 * взаимодействия. Длинные тексты сюда не входят: на них приходится две трети ответа, а показываются
 * они только на карточке, которая запрашивается отдельно по id.
 */
export interface DrugSummary {
  id: string;
  /** МНН — the canonical name every interaction rule is written in. */
  inn: string;
  /** Trade names. The bridge between what the patient says and what the rules know. */
  brandNames: string[];
  /** Раздел справочника — короткий список, по нему и фильтруют. */
  category: string;
  pharmGroup: string;
  atcCode: string;
  createdAt: string;
  updatedAt: string;
}

/** Полная карточка: приходит только с `GET /drugs/:id`. */
export interface Drug extends DrugSummary {
  forms: string[];
  indications: string;
  dosing: string;
  contraindications: string;
  sideEffects: string;
  notes: string;
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
