import { describe, expect, it } from 'vitest';

import { interpretCulture } from './cultureEngine';
import type { CultureReport, MicrobiologyReference } from './types';

/**
 * Справочник здесь **свой, маленький**, а не настоящий, и это осознанно.
 *
 * Тест проверяет механику движка: как считается значимость, как порог зависит от жалоб, как
 * фенотип отменяет строки бланка. Настоящий справочник для этого слишком велик, и тест, привязанный
 * к его содержимому, ломался бы при каждой правке текста заметки.
 *
 * Правильность самих таблиц — вопрос другой проверки: `npm run check:microbiology` в бэкенде
 * прогоняет этот же движок по настоящим данным.
 */
const REF: MicrobiologyReference = {
  version: 'test',
  organisms: [
    { key: 'e-coli', name: 'Escherichia coli', ru: 'Кишечная палочка', group: 'enterobacterales', aliases: [], note: '' },
    { key: 'ent', name: 'Enterococcus faecalis', ru: 'Энтерококк', group: 'enterococcus', aliases: [], note: '' },
    { key: 'sa', name: 'Staphylococcus aureus', ru: 'Золотистый стафилококк', group: 'staphylococcus', aliases: [], note: '' },
    { key: 'viridans', name: 'Streptococcus viridans', ru: 'Зеленящий стрептококк', group: 'streptococcus', aliases: [], note: '' },
    { key: 'salm', name: 'Salmonella spp.', ru: 'Сальмонелла', group: 'enterobacterales', aliases: [], note: '' },
  ],
  antibiotics: [
    { key: 'amox', name: 'Амоксициллин', klass: 'aminopenicillin', aliases: [], routes: ['oral'] },
    { key: 'cefazolin', name: 'Цефазолин', klass: 'cephalosporin-1', aliases: [], routes: ['parenteral'] },
    { key: 'ceftriaxone', name: 'Цефтриаксон', klass: 'cephalosporin-3', aliases: [], routes: ['parenteral'] },
    { key: 'oxacillin', name: 'Оксациллин', klass: 'penicillin', aliases: [], routes: ['parenteral'] },
    { key: 'vanco', name: 'Ванкомицин', klass: 'glycopeptide', aliases: [], routes: ['parenteral'] },
    {
      key: 'nitro',
      name: 'Нитрофурантоин',
      klass: 'nitrofuran',
      aliases: [],
      routes: ['oral'],
      onlyFor: { loci: ['urine'], why: 'концентрации создаются только в моче' },
    },
  ],
  loci: [
    {
      key: 'urine',
      label: 'Моча',
      short: 'Моча',
      flora: [],
      contaminants: ['viridans'],
      threshold: 5,
      contextThresholds: [{ when: 'symptomatic', lg: 2, why: 'при остром цистите значимы уже 10²' }],
      samplingNote: '',
      note: '',
    },
    { key: 'throat', label: 'Зев', short: 'Зев', flora: ['viridans'], samplingNote: '', note: '' },
    { key: 'stool', label: 'Кал', short: 'Кал', flora: ['e-coli'], pathogens: ['salm'], samplingNote: '', note: '' },
    { key: 'blood', label: 'Кровь', short: 'Кровь', flora: [], contaminants: ['viridans'], sterile: true, samplingNote: '', note: '' },
    { key: 'wound', label: 'Рана', short: 'Рана', flora: [], threshold: 5, samplingNote: '', note: '' },
  ],
  intrinsic: [
    {
      id: 'ent-vs-ceph',
      groups: ['enterococcus'],
      classes: ['cephalosporin-1', 'cephalosporin-3'],
      why: 'у энтерококка нет мишени для цефалоспорина',
    },
  ],
  phenotypes: [
    {
      id: 'mrsa',
      title: 'MRSA',
      groups: ['staphylococcus'],
      when: [{ antibiotics: ['oxacillin'], is: 'R', mode: 'any' }],
      severity: 'critical',
      meaning: 'все бета-лактамы негодны',
      invalidates: { classes: ['aminopenicillin', 'cephalosporin-1', 'cephalosporin-3', 'penicillin'], why: 'PBP2a' },
    },
  ],
  clinical: [
    {
      id: 'asb',
      title: 'Бессимптомная бактериурия',
      severity: 'critical',
      text: 'не лечить',
      scope: 'isolate',
      loci: ['urine'],
      significance: ['significant', 'pathogen'],
      forbidContext: ['symptomatic', 'pregnant'],
    },
    {
      id: 'polymicrobial',
      title: 'Загрязнение',
      severity: 'warning',
      text: 'пересдать',
      scope: 'report',
      loci: ['urine'],
      report: { minIsolates: 3 },
    },
    { id: 'no-growth', title: 'Роста нет', severity: 'info', text: '', scope: 'report', report: { noGrowth: true } },
  ],
};

function report(over: Partial<CultureReport> = {}): CultureReport {
  return { locusKey: 'urine', noGrowth: false, context: [], isolates: [], ...over };
}

function isolate(organismKey: string, over: Partial<CultureReport['isolates'][number]> = {}) {
  return { uid: 'a', organismKey, susceptibility: [], ...over };
}

describe('значимость роста', () => {
  it('порог опускается, когда есть жалобы', () => {
    const scanty = [isolate('e-coli', { lgCfu: 3 })];
    expect(interpretCulture(REF, report({ isolates: scanty })).isolates[0].significance).toBe('below-threshold');
    expect(
      interpretCulture(REF, report({ isolates: scanty, context: ['symptomatic'] })).isolates[0].significance,
    ).toBe('significant');
  });

  it('нормальная флора локуса значимой не становится ни при каком счёте', () => {
    const verdict = interpretCulture(REF, report({ locusKey: 'throat', isolates: [isolate('viridans', { lgCfu: 7 })] }));
    expect(verdict.isolates[0].significance).toBe('flora');
    expect(verdict.anySignificant).toBe(false);
  });

  it('безусловный патоген значим при скудном росте', () => {
    const verdict = interpretCulture(REF, report({ locusKey: 'stool', isolates: [isolate('salm', { growthDegree: 1 })] }));
    expect(verdict.isolates[0].significance).toBe('pathogen');
  });

  it('в стерильном материале кожная флора — занос, а не возбудитель', () => {
    const verdict = interpretCulture(REF, report({ locusKey: 'blood', isolates: [isolate('viridans')] }));
    expect(verdict.isolates[0].significance).toBe('contaminant');
  });

  it('без счёта и без степени роста ответа нет, а не «значимо»', () => {
    const verdict = interpretCulture(REF, report({ locusKey: 'wound', isolates: [isolate('e-coli')] }));
    expect(verdict.isolates[0].significance).toBe('unknown');
  });

  it('неопознанный возбудитель не толкуется молча', () => {
    const verdict = interpretCulture(
      REF,
      report({ isolates: [{ uid: 'a', organismLabel: 'Что-то неведомое', lgCfu: 7, susceptibility: [] }] }),
    );
    expect(verdict.isolates[0].significance).toBe('unknown');
    expect(verdict.isolates[0].label).toBe('Что-то неведомое');
  });
});

describe('бланк, который врёт', () => {
  it('«чувствителен» вопреки природной устойчивости попадает в расхождения и в негодные', () => {
    const verdict = interpretCulture(
      REF,
      report({
        isolates: [
          isolate('ent', { lgCfu: 6, susceptibility: [{ antibioticKey: 'ceftriaxone', result: 'S' }] }),
        ],
      }),
    );
    const found = verdict.isolates[0];
    expect(found.conflicts).toHaveLength(1);
    expect(found.conflicts[0].ruleId).toBe('ent-vs-ceph');
    expect(found.options).toHaveLength(0);
    expect(found.suppressed[0].suppressedBy?.kind).toBe('intrinsic');
  });

  it('MRSA отменяет бета-лактамы, у которых в бланке стоит «чувствителен»', () => {
    const verdict = interpretCulture(
      REF,
      report({
        locusKey: 'wound',
        isolates: [
          isolate('sa', {
            lgCfu: 6,
            susceptibility: [
              { antibioticKey: 'oxacillin', result: 'R' },
              { antibioticKey: 'cefazolin', result: 'S' },
              { antibioticKey: 'vanco', result: 'S' },
            ],
          }),
        ],
      }),
    );
    const found = verdict.isolates[0];
    expect(found.phenotypes.map((p) => p.id)).toEqual(['mrsa']);
    expect(found.options.map((o) => o.entry.antibioticKey)).toEqual(['vanco']);
    expect(found.suppressed.map((s) => s.entry.antibioticKey)).toEqual(['cefazolin']);
  });

  it('фенотип не выводится из строки, которой в бланке нет', () => {
    const verdict = interpretCulture(
      REF,
      report({
        locusKey: 'wound',
        isolates: [isolate('sa', { lgCfu: 6, susceptibility: [{ antibioticKey: 'vanco', result: 'S' }] })],
      }),
    );
    expect(verdict.isolates[0].phenotypes).toHaveLength(0);
  });

  it('препарат, не доходящий до материала, в годные не попадает', () => {
    const inUrine = interpretCulture(
      REF,
      report({ isolates: [isolate('e-coli', { lgCfu: 6, susceptibility: [{ antibioticKey: 'nitro', result: 'S' }] })] }),
    );
    expect(inUrine.isolates[0].options.map((o) => o.entry.antibioticKey)).toEqual(['nitro']);

    const inWound = interpretCulture(
      REF,
      report({
        locusKey: 'wound',
        isolates: [isolate('e-coli', { lgCfu: 6, susceptibility: [{ antibioticKey: 'nitro', result: 'S' }] })],
      }),
    );
    expect(inWound.isolates[0].options).toHaveLength(0);
    expect(inWound.isolates[0].suppressed[0].suppressedBy?.kind).toBe('locus');
  });

  it('бесспорно чувствительные идут прежде тех, кому нужна увеличенная доза', () => {
    const verdict = interpretCulture(
      REF,
      report({
        isolates: [
          isolate('e-coli', {
            lgCfu: 6,
            susceptibility: [
              { antibioticKey: 'ceftriaxone', result: 'I' },
              { antibioticKey: 'amox', result: 'S' },
            ],
          }),
        ],
      }),
    );
    expect(verdict.isolates[0].options.map((o) => o.entry.antibioticKey)).toEqual(['amox', 'ceftriaxone']);
    expect(verdict.isolates[0].options[1].caution).toContain('увеличенной экспозиции');
  });
});

describe('лечить ли вообще', () => {
  it('значимый рост без жалоб — бессимптомная бактериурия', () => {
    const verdict = interpretCulture(REF, report({ isolates: [isolate('e-coli', { lgCfu: 6 })] }));
    expect(verdict.isolates[0].notes.map((n) => n.id)).toContain('asb');
  });

  it('при жалобах то же правило не срабатывает', () => {
    const verdict = interpretCulture(
      REF,
      report({ isolates: [isolate('e-coli', { lgCfu: 6 })], context: ['symptomatic'] }),
    );
    expect(verdict.isolates[0].notes.map((n) => n.id)).not.toContain('asb');
  });

  it('у беременной бессимптомная бактериурия не объявляется поводом не лечить', () => {
    const verdict = interpretCulture(
      REF,
      report({ isolates: [isolate('e-coli', { lgCfu: 6 })], context: ['pregnant'] }),
    );
    expect(verdict.isolates[0].notes.map((n) => n.id)).not.toContain('asb');
  });

  it('три возбудителя в моче — правило про загрязнение', () => {
    const three = ['e-coli', 'ent', 'sa'].map((key, i) => ({ ...isolate(key, { lgCfu: 5 }), uid: `u${i}` }));
    const verdict = interpretCulture(REF, report({ isolates: three }));
    expect(verdict.notes.map((n) => n.id)).toContain('polymicrobial');
  });

  it('«роста нет» — это ответ, а не пустой бланк', () => {
    const verdict = interpretCulture(REF, report({ noGrowth: true, isolates: [isolate('e-coli', { lgCfu: 9 })] }));
    expect(verdict.isolates).toHaveLength(0);
    expect(verdict.notes.map((n) => n.id)).toContain('no-growth');
  });
});
