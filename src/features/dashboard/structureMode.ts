/** Which cut «Структура пациентов» is showing. Kept apart from the component so the widget
 *  catalogue can validate a stored choice without importing a React module. */
export type StructureMode = 'diagnoses' | 'age' | 'sex' | 'all';

export const STRUCTURE_MODES: { value: StructureMode; label: string }[] = [
  { value: 'diagnoses', label: 'Диагнозы' },
  { value: 'age', label: 'Возраст' },
  { value: 'sex', label: 'Пол' },
  { value: 'all', label: 'Всё' },
];

export function isStructureMode(value: string): value is StructureMode {
  return STRUCTURE_MODES.some((mode) => mode.value === value);
}
