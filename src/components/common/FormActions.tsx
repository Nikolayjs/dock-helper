import type { ReactNode } from 'react';

import classes from './FormActions.module.css';

/**
 * Держит действия формы на виду, вместо того чтобы оставлять их в конце страницы.
 *
 * Содержимое передаётся как есть — у форм разный набор кнопок, и навязывать им одну раскладку
 * значило бы переписывать каждую. Панель отвечает только за то, чтобы они не уезжали за экран.
 */
export function FormActions({ children }: { children: ReactNode }) {
  // Метка нужна тем, кто считает, сколько места осталось до низа окна: панель прилипшая и
  // перекрывает нижнюю полосу экрана — см. `useFittedHeight`.
  return (
    <div className={classes.bar} data-form-actions>
      {children}
    </div>
  );
}
