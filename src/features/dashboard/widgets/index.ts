import type { DashboardWidget } from './types';
import { QUEUE_WIDGETS } from './queue';
import { WORK_WIDGETS } from './work';
import { PRACTICE_WIDGETS } from './practice';
import { QUICK_ACCESS_WIDGETS } from './quickAccess';
import { TODO_WIDGETS } from './todo';

export type { DashboardWidget } from './types';

/**
 * Всё, что дашборд умеет показать, одним списком.
 *
 * Страница рисует то, что названо в раскладке врача, и в том порядке, — поэтому виджет объявляется
 * здесь один раз и правок страницы не требует. `span` — ширина на широком экране из двенадцати;
 * ниже `md` всё во всю ширину: плитка со счётчиком, ужатая до четверти телефона, не читается.
 *
 * **Порядок в этом массиве — порядок по умолчанию**, и он же решает, куда встанет новая карточка у
 * врача, который дашборд уже настроил: `orderWidgets` дописывает незнакомое в конец.
 */
export const DASHBOARD_WIDGETS: DashboardWidget[] = [
  ...QUEUE_WIDGETS,
  ...WORK_WIDGETS,
  ...PRACTICE_WIDGETS,
  ...QUICK_ACCESS_WIDGETS,
  ...TODO_WIDGETS,
];
