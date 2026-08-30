export type CalculatorFieldType = 'number' | 'select';

export interface CalculatorFieldOption {
  label: string;
  value: number;
}

export interface CalculatorField {
  key: string;
  label: string;
  type: CalculatorFieldType;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: number;
  options?: CalculatorFieldOption[];
}

export interface InterpretationRange {
  id: string;
  min?: number;
  max?: number;
  label: string;
  color: string;
}

export interface CalculatorPresetValue {
  fieldKey: string;
  value: number;
}

/** A named, user-defined shortcut that fills some of the fields at once — e.g. a specific drug and its dosing. */
export interface CalculatorPreset {
  id: string;
  label: string;
  values: CalculatorPresetValue[];
}

export interface CalculatorDefinition {
  id: string;
  title: string;
  description: string;
  category: string;
  fields: CalculatorField[];
  formula: string;
  resultLabel: string;
  resultUnit?: string;
  decimals: number;
  interpretation?: InterpretationRange[];
  presets?: CalculatorPreset[];
  /** Label for the presets select, e.g. "Препарат". Defaults to a generic label when presets are present. */
  presetsLabel?: string;
  /** Отмечен звёздочкой — выводится карточкой на дашборде. */
  favourite?: boolean;
  createdAt?: string;
}

export const CALCULATOR_CATEGORIES = [
  'Антропометрия',
  'Кардиология',
  'Нефрология',
  'Педиатрия',
  'Пульмонология',
  'Прочее',
] as const;


/**
 * Цвет раздела в списке калькуляторов.
 *
 * Лежит рядом с самим списком разделов, а не в компоненте: карточка калькулятора, где эта карта
 * жила раньше, больше не рисуется — список стал таблицей.
 */
export const CATEGORY_COLORS: Record<string, string> = {
  Антропометрия: 'brand',
  Кардиология: 'red',
  Нефрология: 'grape',
  Педиатрия: 'orange',
  Пульмонология: 'cyan',
  Прочее: 'gray',
};
