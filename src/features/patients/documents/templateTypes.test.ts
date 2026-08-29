import { describe, expect, it } from 'vitest';

import {
  SAMPLE_PATIENT,
  SAMPLE_VISIT,
  substitutePlaceholdersHtml,
  substitutePlaceholdersText,
} from './templateTypes';
import type { TemplateContext } from './templateTypes';

/**
 * Подстановки в бланк.
 *
 * Значения приходят из полей, которые заполняет врач: фамилия пациента, диагноз, название клиники.
 * В бланке-тексте результат уходит в разметку страницы, и символ `<` в фамилии ломал печатную
 * справку молча — часть документа переставала печататься, а увидеть причину можно было только в
 * исходном коде страницы.
 */

const context = (overrides: Partial<TemplateContext> = {}): TemplateContext => ({
  patient: { ...SAMPLE_PATIENT, fullName: 'Иванов <b>Иван</b> Иванович' },
  visit: SAMPLE_VISIT,
  doctorName: 'Петров П. П.',
  clinicSettings: {
    clinicName: 'Клиника «Здоровье» & Ко',
    clinicAddress: '',
    specialty: '',
    licenseNumber: '',
    ...(overrides.clinicSettings ?? {}),
  } as TemplateContext['clinicSettings'],
  ...overrides,
});

describe('подстановка в разметку', () => {
  it('фамилия с угловыми скобками не становится разметкой', () => {
    const html = substitutePlaceholdersHtml('<p>Пациент: {{patientName}}</p>', context());
    expect(html).toContain('Иванов &lt;b&gt;Иван&lt;/b&gt; Иванович');
    expect(html).not.toContain('<b>Иван</b>');
  });

  it('амперсанд и кавычки в названии клиники экранируются', () => {
    const html = substitutePlaceholdersHtml('<p>{{clinicName}}</p>', context());
    expect(html).toContain('&amp;');
    expect(html).not.toContain('«Здоровье» & Ко');
  });

  it('сама разметка бланка не трогается', () => {
    const html = substitutePlaceholdersHtml('<h1>Справка</h1><p><strong>{{doctorName}}</strong></p>', context());
    expect(html).toContain('<h1>Справка</h1>');
    expect(html).toContain('<strong>Петров П. П.</strong>');
  });

  it('незаполненное поле становится прочерком, а не пустотой', () => {
    const html = substitutePlaceholdersHtml('<p>{{referralDestination}}</p>', {
      ...context(),
      visit: { ...SAMPLE_VISIT, referralDestination: '' },
    });
    expect(html).toBe('<p>—</p>');
  });
});

describe('подстановка в текст', () => {
  it('не экранирует: результат рисуется как строка, а не как разметка', () => {
    // Блоки бланка-скана печатаются React'ом обычным текстом. Экранирование вывело бы на бумагу
    // буквальные `&lt;`.
    expect(substitutePlaceholdersText('{{patientName}}', context())).toBe('Иванов <b>Иван</b> Иванович');
  });

  it('подставляет столько же полей, сколько и разметочная', () => {
    const template = '{{patientName}} / {{doctorName}} / {{clinicName}}';
    const text = substitutePlaceholdersText(template, context());
    expect(text).not.toContain('{{');
  });
});
