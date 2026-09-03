import { useIsMobile } from '../common/useIsMobile';
import { HeaderSearchInline } from './HeaderSearchInline';
import { HeaderSearchModal } from './HeaderSearchModal';

/**
 * Поиск в шапке — точка входа, которая выбирает оболочку по ширине экрана.
 *
 * Оболочек две, и это не косметика: поле фиксированной ширины в шапке телефона не помещается рядом
 * с бургером, заголовком раздела и колокольчиком — именно оно выталкивало шапку за край экрана.
 * Ниже `48em` от поиска остаётся иконка, открывающая полноэкранное окно.
 *
 * Порог один на всё приложение (`useIsMobile`): второго порога мобильности здесь заводить нельзя,
 * иначе оболочка и шапка разъедутся на промежуточной ширине.
 */
export function HeaderSearch() {
  return useIsMobile() ? <HeaderSearchModal /> : <HeaderSearchInline />;
}
