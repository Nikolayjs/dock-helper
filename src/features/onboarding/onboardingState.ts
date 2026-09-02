import { readSetting, writeSetting } from '../../lib/settingsStore';

/**
 * Прошёл ли врач первые шаги после регистрации.
 *
 * Ключ синхронизируется вместе с остальными настройками: «я это уже настраивал» — про человека, а
 * не про браузер, и встречать его вопросами о специальности на втором устройстве незачем.
 *
 * Отметка ставится **при регистрации**, а не отсутствием значения: иначе первые шаги показались бы
 * каждому, кто уже работает, — у них ключа тоже нет.
 */
export const ONBOARDING_KEY = 'medassist:onboarding';

export function markOnboardingPending(): void {
  try {
    writeSetting(ONBOARDING_KEY, 'pending');
  } catch {
    // Приватное окно или переполненное хранилище: без первых шагов приложение работает как прежде.
  }
}

export function isOnboardingPending(): boolean {
  try {
    return readSetting(ONBOARDING_KEY) === 'pending';
  } catch {
    return false;
  }
}

export function finishOnboarding(): void {
  try {
    writeSetting(ONBOARDING_KEY, 'done');
  } catch {
    // См. выше: пропущенный шаг — не повод падать.
  }
}
