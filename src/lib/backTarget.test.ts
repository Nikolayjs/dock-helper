import { describe, expect, it } from 'vitest';

import { labelForPath, readFrom } from './backTarget';

describe('labelForPath', () => {
  it('называет раздел по его корню', () => {
    expect(labelForPath('/dashboard')).toBe('На дашборд');
    expect(labelForPath('/calculators')).toBe('К калькуляторам');
  });

  it('узнаёт раздел и по вложенному адресу', () => {
    expect(labelForPath('/patients/abc-123')).toBe('К пациентам');
    expect(labelForPath('/library/42/read')).toBe('К библиотеке');
  });

  it('предпочитает более длинный префикс родительскому', () => {
    // Иначе «К бланкам» и «К отчёту» проигрывали бы «К пациентам» — они лежат внутри /patients.
    expect(labelForPath('/patients/documents')).toBe('К бланкам');
    expect(labelForPath('/patients/dispensary/stats')).toBe('К отчёту');
  });

  it('различает раздел и просто общее начало строки', () => {
    // /newsletter — не /news, и подставлять «К новостям» здесь было бы враньём.
    expect(labelForPath('/newsletter')).toBeNull();
    expect(labelForPath('/news')).toBe('К новостям');
    expect(labelForPath('/news/read?url=x')).toBe('К новостям');
  });

  it('возвращает null для неизвестного адреса', () => {
    expect(labelForPath('/nowhere')).toBeNull();
  });
});

describe('readFrom', () => {
  it('читает происхождение из состояния перехода', () => {
    expect(readFrom({ from: '/dashboard' })).toBe('/dashboard');
  });

  it('игнорирует всё, что не похоже на путь', () => {
    // Состояние приходит из истории браузера и переживает перезагрузку — доверять ему нельзя.
    expect(readFrom(null)).toBeUndefined();
    expect(readFrom({})).toBeUndefined();
    expect(readFrom({ from: 42 })).toBeUndefined();
    expect(readFrom({ from: 'https://example.org' })).toBeUndefined();
    expect(readFrom('строка')).toBeUndefined();
  });
});
