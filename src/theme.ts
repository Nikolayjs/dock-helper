import { createTheme, type MantineColorsTuple } from '@mantine/core';

const brand: MantineColorsTuple = [
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
];

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
