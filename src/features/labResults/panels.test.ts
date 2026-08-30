import { describe, expect, it } from 'vitest';

import type { LabTestDefinition } from '../analyzer/types';
import { panelValues } from './panels';

const test: LabTestDefinition = {
  id: 'cbc',
  title: 'Общий анализ крови',
  shortTitle: 'ОАК',
  description: '',
  parameters: [
    { key: 'hgb', label: 'Гемоглобин', unit: 'г/л', inputType: 'number', range: {} },
    { key: 'rbc', label: 'Эритроциты', inputType: 'number', range: {} },
    {
      key: 'mch',
      label: 'MCH',
      inputType: 'derived',
      range: {},
      derive: (values) => (values.hgb && values.rbc ? values.hgb / values.rbc : undefined),
    },
  ],
  patterns: [],
};

describe('что уходит в карту из панели', () => {
  it('берёт введённые показатели с названием и единицей', () => {
    expect(panelValues({ test, values: { hgb: 140, rbc: 4.5 } })).toEqual([
      { key: 'hgb', label: 'Гемоглобин', unit: 'г/л', value: 140 },
      { key: 'rbc', label: 'Эритроциты', unit: undefined, value: 4.5 },
    ]);
  });

  // Источник у производного один — формула анализатора; исправленная формула обязана дойти и до
  // уже сохранённых бланков.
  it('производные не сохраняются', () => {
    expect(panelValues({ test, values: { hgb: 140, rbc: 4 } }).map((v) => v.key)).not.toContain('mch');
  });

  it('пустые и нечисловые поля выпадают', () => {
    expect(panelValues({ test, values: { hgb: undefined, rbc: Number.NaN } })).toEqual([]);
  });
});
