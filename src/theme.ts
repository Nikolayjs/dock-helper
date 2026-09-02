import type { CSSVariablesResolver } from '@mantine/core';
import { createTheme, type MantineColorsTuple } from '@mantine/core';

/**
 * Фирменная палитра — и заодно профиль, по которому строится палитра под обои.
 *
 * `accent.ts` берёт отсюда светлоту и насыщенность каждой ступени и меняет только тон: всё, что
 * сегодня читается и нажимается, обязано читаться и нажиматься в перекрашенном виде.
 */
export const BRAND_STEPS = [
  '#eef1ff',
  '#dce3ff',
  '#b9c8ff',
  '#93a9ff',
  '#728fff',
  '#5a7aff',
  '#4c6fff',
  '#3e5ce0',
  '#3049c2',
  '#1f35a0',
] as const;

const brand: MantineColorsTuple = [...BRAND_STEPS] as unknown as MantineColorsTuple;

const mint: MantineColorsTuple = [
  '#e8fbf5',
  '#d1f6e9',
  '#a3ecd4',
  '#71e1be',
  '#49d7ab',
  '#2fd09f',
  '#1ecd98',
  '#0bb684',
  '#00a173',
  '#008a63',
];

export const theme = createTheme({
  primaryColor: 'brand',
  primaryShade: 6,
  colors: {
    brand,
    mint,
  },
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
  /*
   * `xs` — 13 px, а не заводские 12.
   *
   * Этим размером набрано больше трёхсот мест, и в большинстве из них он идёт вместе с `c="dimmed"`:
   * подписи под числами, даты, единицы измерения. Двенадцать пикселей приглушённым серым читаются
   * плохо на любом экране, а на телефоне — особенно; лишний пиксель не ломает ни одну раскладку
   * (это подпись, а не колонка), а вместе со ступенью контраста у `dimmed` возвращает такой текст
   * в область читаемого. Остальные ступени заводские.
   */
  fontSizes: {
    xs: '0.8125rem',
  },
  fontFamilyMonospace: 'ui-monospace, SFMono-Regular, monospace',
  headings: {
    fontFamily: 'Lexend, Inter, -apple-system, sans-serif',
    fontWeight: '600',
  },
  defaultRadius: 'lg',
  radius: {
    xs: '8px',
    sm: '10px',
    md: '14px',
    lg: '18px',
    xl: '24px',
  },
  shadows: {
    xs: '0 1px 2px rgba(23, 34, 68, 0.06)',
    sm: '0 2px 8px rgba(23, 34, 68, 0.06)',
    md: '0 8px 24px rgba(23, 34, 68, 0.08)',
    lg: '0 16px 40px rgba(23, 34, 68, 0.10)',
    xl: '0 24px 56px rgba(23, 34, 68, 0.12)',
  },
  components: {
    Card: {
      defaultProps: {
        radius: 'lg',
        shadow: 'sm',
      },
    },
    Paper: {
      defaultProps: {
        radius: 'lg',
      },
    },
    Button: {
      defaultProps: {
        radius: 'md',
      },
    },
    Badge: {
      defaultProps: {
        radius: 'sm',
      },
    },
  },
});

/**
 * Приглушённый текст — на ступень контрастнее заводского.
 *
 * Заводской `dimmed` — `gray.6` (#868e96): на белой карточке это 3,3:1, а набран им обычно
 * `size="xs"`, то есть мелкий текст, которому AA требует 4,5:1. Таких мест в интерфейсе больше
 * полутора сотен — подписи под числами, даты, единицы измерения, пояснения в формах.
 *
 * **Задавать это правилом в `index.css` нельзя, и это проверенная ошибка.** Mantine печатает свои
 * переменные не в файле стилей, а в `<style data-mantine-styles>` **в голове документа, во время
 * работы**, — то есть позже любого нашего файла, с той же специфичностью, и выигрывает она. Замер:
 * при объявленном в `:root` `gray.7` браузер отдавал `--mantine-color-dimmed` = `#868e96`.
 * Resolver — то самое место, куда Mantine и предлагает класть такие правки.
 *
 * Значение то же, что уже выбрано и измерено для случая с обоями (`AppLayout.module.css`), поэтому
 * особый случай там теперь просто совпадает с общим.
 */
export const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {},
  light: { '--mantine-color-dimmed': 'var(--mantine-color-gray-7)' },
  dark: { '--mantine-color-dimmed': 'var(--mantine-color-dark-1)' },
});
