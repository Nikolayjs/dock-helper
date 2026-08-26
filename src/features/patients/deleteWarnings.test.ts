import { describe, expect, it } from 'vitest';

import { observationsWarning, visitsWarning } from './deleteWarnings';

describe('visitsWarning', () => {
  it('says nothing when the patient has no visits to lose', () => {
    expect(visitsWarning(0)).toBeUndefined();
  });

  it('declines the count', () => {
    expect(visitsWarning(1)).toBe('Вместе с пациентом удалятся 1 визит.');
    expect(visitsWarning(3)).toBe('Вместе с пациентом удалятся 3 визита.');
    expect(visitsWarning(7)).toBe('Вместе с пациентом удалятся 7 визитов.');
  });

  // The teens are the case a naive `count % 10` rule gets wrong, and they are common enough in a
  // year-long history to be seen.
  it('gets the teens right', () => {
    expect(visitsWarning(11)).toBe('Вместе с пациентом удалятся 11 визитов.');
    expect(visitsWarning(12)).toBe('Вместе с пациентом удалятся 12 визитов.');
    expect(visitsWarning(14)).toBe('Вместе с пациентом удалятся 14 визитов.');
    expect(visitsWarning(21)).toBe('Вместе с пациентом удалятся 21 визит.');
    expect(visitsWarning(22)).toBe('Вместе с пациентом удалятся 22 визита.');
    expect(visitsWarning(111)).toBe('Вместе с пациентом удалятся 111 визитов.');
  });
});

describe('observationsWarning', () => {
  it('says nothing for an empty card', () => {
    expect(observationsWarning(0)).toBeUndefined();
  });

  it('declines the count', () => {
    expect(observationsWarning(1)).toBe('Вместе с картой удалятся 1 осмотр.');
    expect(observationsWarning(2)).toBe('Вместе с картой удалятся 2 осмотра.');
    expect(observationsWarning(5)).toBe('Вместе с картой удалятся 5 осмотров.');
    expect(observationsWarning(13)).toBe('Вместе с картой удалятся 13 осмотров.');
  });
});
