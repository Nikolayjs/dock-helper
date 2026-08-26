import { describe, expect, it } from 'vitest';

import { labelForPath, readFrom } from './backTarget';

describe('labelForPath', () => {
  it('называет раздел по его корню', () => {
    expect(labelForPath('/dashboard')).toBe('На дашборд');
    expect(labelForPath('/calculators')).toBe('К калькуляторам');
  });

  it('различает список раздела и одну запись внутри него', () => {
    // Ходят не только со списков: из карточки пациента открывают его документ. Кнопка, ведущая
    // обратно в карточку, не должна называться «К пациентам» — она возвращает к одному конкретному.
    expect(labelForPath('/patients')).toBe('К пациентам');
    expect(labelForPath('/patients/abc-123')).toBe('К пациенту');
    expect(labelForPath('/library/42/read')).toBe('К книге');
  });

  it('строка запроса — это всё ещё список раздела', () => {
    expect(labelForPath('/documents')).toBe('К документам');
    expect(labelForPath('/documents?tab=templates')).toBe('К документам');
    expect(labelForPath('/documents/abc-123')).toBe('К документу');
  });

  it('раздел без отдельного названия для записи подписывается общим', () => {
    expect(labelForPath('/knowledge/tag/кардиология')).toBe('К базе знаний');
  });

  it('предпочитает более длинный префикс родительскому', () => {
    // Иначе «К отчёту» проигрывал бы «К пациентам» — он лежит внутри /patients.
    expect(labelForPath('/patients/dispensary/stats')).toBe('К отчёту');
  });

  it('различает раздел и просто общее начало строки', () => {
    // /newsletter — не /news, и подставлять «К новостям» здесь было бы враньём.
    expect(labelForPath('/newsletter')).toBeNull();
    expect(labelForPath('/news')).toBe('К новостям');
    expect(labelForPath('/news/read?url=x')).toBe('К новости');
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
