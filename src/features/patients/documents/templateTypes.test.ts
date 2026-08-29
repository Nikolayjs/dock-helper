import { describe, expect, it } from 'vitest';

import {
  PLACEHOLDERS,
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

describe('подстановки, добавленные позже', () => {
  it('возраст, пол и телефон', () => {
    const ctx = {
      ...context(),
      patient: { ...SAMPLE_PATIENT, birthDate: '1980-01-01', sex: 'female' as const, phone: '+7 900 000-00-00' },
    };
    expect(substitutePlaceholdersText('{{patientAge}}', ctx)).toMatch(/\d+ (год|года|лет)/);
    expect(substitutePlaceholdersText('{{patientSex}}', ctx)).toBe('женский');
    expect(substitutePlaceholdersText('{{patientPhone}}', ctx)).toBe('+7 900 000-00-00');
  });

  it('код диагноза отдельно от названия', () => {
    expect(substitutePlaceholdersText('{{diagnosisCode}}', context())).toBe('J20');
    expect(substitutePlaceholdersText('{{diagnosis}}', context())).toContain('Острый бронхит');
  });

  it('номер документа один и тот же при повторной печати', () => {
    // Номер, меняющийся между двумя экземплярами одной справки, делает их разными документами.
    const ctx = { ...context(), visit: { ...SAMPLE_VISIT, id: 'abcd1234', date: '2026-08-20' } };
    const first = substitutePlaceholdersText('{{documentNumber}}', ctx);
    expect(first).toBe('20260820-1234');
    expect(substitutePlaceholdersText('{{documentNumber}}', ctx)).toBe(first);
  });

  it('незаполненное поле даёт прочерк, а не пустоту', () => {
    const ctx = { ...context(), patient: { ...SAMPLE_PATIENT, birthDate: null, sex: null, phone: '' } };
    expect(substitutePlaceholdersText('{{patientAge}}/{{patientSex}}/{{patientPhone}}', ctx)).toBe('—/—/—');
  });

  it('все подстановки объявлены с непустой подписью — их видит врач в конструкторе', () => {
    for (const placeholder of PLACEHOLDERS) {
      expect(placeholder.label.trim().length).toBeGreaterThan(0);
      expect(placeholder.token).toMatch(/^\{\{[a-zA-Z]+\}\}$/);
    }
  });
});
