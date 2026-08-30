import type { LabTestDefinition } from '../analyzer/types';
import type { LabResultValue } from './types';

/** Заполненная панель: сам анализатор и то, что в него набрали на странице разбора. */
export interface FilledPanel {
  test: LabTestDefinition;
  values: Record<string, number | undefined>;
}

/**
 * Что уходит в карту из одной панели.
 *
 * Только введённые показатели: производные считаются формулой анализатора, и записать их значило бы
 * завести второй источник для числа, у которого источник один, — исправленная формула не дошла бы
 * до уже сохранённых бланков. Порядок — как в самой панели: бланк читается сверху вниз.
 */
export function panelValues(panel: FilledPanel): LabResultValue[] {
  const values: LabResultValue[] = [];
  for (const param of panel.test.parameters) {
    if (param.inputType === 'derived') continue;
    const value = panel.values[param.key];
    if (value === undefined || !Number.isFinite(value)) continue;
    values.push({ key: param.key, label: param.label, unit: param.unit, value });
  }
  return values;
}
