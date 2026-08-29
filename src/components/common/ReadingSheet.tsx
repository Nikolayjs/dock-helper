import type { CSSProperties, ReactNode } from 'react';

import classes from './ReadingSheet.module.css';

/**
 * Сплошная подложка под длинный текст: статья, рекомендация, документ, книга.
 *
 * Почему она нужна и почему на телефоне во всю ширину — в `ReadingSheet.module.css`.
 */
export function ReadingSheet({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={className ? `${classes.sheet} ${className}` : classes.sheet} style={style}>
      {children}
    </div>
  );
}
