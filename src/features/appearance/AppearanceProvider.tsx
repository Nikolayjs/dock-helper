import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { MantineColorsTuple, MantineThemeOverride } from '@mantine/core';

import { derivePalette } from './accent';
import {
  accentOf,
  imageOf,
  readAppearance,
  writeAppearance,
  type AppearanceSettings,
  type Wallpaper,
} from './wallpaper';
import { theme as baseTheme } from '../../theme';

/**
 * Обои и палитра, которую они задают, — на всё приложение.
 *
 * Провайдер стоит **снаружи** `MantineProvider`, и иначе нельзя: тема, которую Mantine получает
 * пропсом, должна быть посчитана до него. Сам он только меняет `colors.brand`; всё остальное в теме
 * — радиусы, тени, шрифты — общее и от обоев не зависит.
 *
 * Обои приезжают в разметку двумя переменными на `<html>`, а не стилями на элементе: рисует их
 * `AppLayout.module.css`, и там же лежит правило, по которому подложка меняет цвет вместе с темой.
 */

interface AppearanceContextValue {
  settings: AppearanceSettings;
  setWallpaper: (wallpaper: Wallpaper) => void;
  setVeil: (veil: number) => void;
  setTint: (tint: boolean) => void;
  /** Тема для `MantineProvider`: фирменная, либо перекрашенная под обои. */
  theme: MantineThemeOverride;
  /** Цвет, который приложение взяло у обоев, — `null`, если не взяло. */
  accent: string | null;
}

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppearanceSettings>(() => readAppearance());

  // Запись идёт до `setSettings`, а не внутри него: `localStorage` умеет отказать (место кончилось),
  // и отказ должен долететь до того, кто выбирал обои, а не потеряться внутри обновления состояния.
  const update = useCallback(
    (patch: Partial<AppearanceSettings>) => {
      const next = { ...settings, ...patch };
      writeAppearance(next);
      setSettings(next);
    },
    [settings],
  );

  const accent = settings.tint ? accentOf(settings.wallpaper) : null;

  const theme = useMemo<MantineThemeOverride>(() => {
    if (!accent) return baseTheme;
    const brand = derivePalette(accent) as unknown as MantineColorsTuple;
    return { ...baseTheme, colors: { ...baseTheme.colors, brand } };
  }, [accent]);

  // Стили лежат в разметке до первой отрисовки: иначе фон успевает мигнуть серым.
  useLayoutEffect(() => {
    const root = document.documentElement;
    const image = imageOf(settings.wallpaper);
    if (image) {
      /*
       * Значение различает два состояния переключателя «Подстраивать цвета под обои», а не просто
       * отмечает наличие обоев. От него зависит, берут ли сплошные поверхности примесь цвета:
       * при выключенном переключателе — и на чёрно-белой фотографии, где брать нечего, —
       * `--mantine-color-brand-6` остаётся фирменным, и подкрашивать им шапку поверх, скажем,
       * розовых обоев значило бы красить в цвет, которого на картинке нет. Замер: «Рассвет» с
       * выключенным переключателем давал поверхность rgb(242,245,255), голубую при тёплых обоях.
       *
       * Правилам, которым важно только наличие обоев (сама картинка, прозрачный `.main`), значение
       * не нужно — они цепляются за атрибут и работают в обоих случаях.
       */
      root.dataset.wallpaper = accent ? 'tinted' : 'plain';
      root.style.setProperty('--wallpaper-image', image);
      root.style.setProperty('--wallpaper-veil-alpha', String(settings.veil));
    } else {
      delete root.dataset.wallpaper;
      root.style.removeProperty('--wallpaper-image');
      root.style.removeProperty('--wallpaper-veil-alpha');
    }
  }, [settings.wallpaper, settings.veil, accent]);

  const value = useMemo<AppearanceContextValue>(
    () => ({
      settings,
      setWallpaper: (wallpaper) => update({ wallpaper }),
      setVeil: (veil) => update({ veil }),
      setTint: (tint) => update({ tint }),
      theme,
      accent,
    }),
    [settings, update, theme, accent],
  );

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance(): AppearanceContextValue {
  const value = useContext(AppearanceContext);
  if (!value) throw new Error('useAppearance вызван вне AppearanceProvider');
  return value;
}
