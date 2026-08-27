import { Image } from '@tiptap/extension-image';
import { TextAlign } from '@tiptap/extension-text-align';

/**
 * Картинка, которой можно задать размер и выравнивание.
 *
 * Обычная `Image` из Tiptap умеет ровно одно: вставить снимок в натуральную величину. В документе
 * врача этого мало — печать бланка, скан подписи и фотография рентгенограммы нужны разного размера
 * и не всегда у левого поля. Поэтому у узла два своих свойства, и оба уходят в `.docx`: ширина
 * (высота считается по ней, чтобы снимок не растянуло) и выравнивание абзаца с картинкой.
 *
 * Ширина хранится числом пикселей в обычном атрибуте `width`, а не в `style`: это тот же атрибут,
 * который понимает любой браузер и который читает наш писатель Word. Пусто — значит натуральная
 * величина, как было раньше: у документов, написанных до этого, ничего не меняется.
 */

/** Уже этого картинка перестаёт быть картинкой — дальше тянуть незачем. */
const MIN_WIDTH = 60;

export type ImageAlign = 'left' | 'center' | 'right';

export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element) => {
          const attribute = Number.parseInt(element.getAttribute('width') ?? '', 10);
          if (Number.isFinite(attribute) && attribute > 0) return attribute;
          // Из чужого HTML ширина приходит и стилем — из Word, из почты, из буфера обмена.
          const style = Number.parseInt((element as HTMLElement).style.width, 10);
          return Number.isFinite(style) && style > 0 ? style : null;
        },
        renderHTML: (attributes) => (attributes.width ? { width: String(attributes.width) } : {}),
      },
      /**
       * Называется как у абзаца (`textAlign`) не для красоты: кнопки выравнивания на общей панели
       * показывают нажатой ту, что совпадает с `textAlign` текущего узла. Своё имя оставило бы их
       * ненажатыми на картинке, выровненной по центру, — кнопка работала бы, но врала о состоянии.
       */
      textAlign: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-align'),
        renderHTML: (attributes) => (attributes.textAlign ? { 'data-align': attributes.textAlign } : {}),
      },
    };
  },

  /**
   * Своё представление — ради уголка, за который картинку тянут.
   *
   * Разметка, которая сохраняется, от этого не меняется: наружу по-прежнему уходит один `<img>` со
   * своими атрибутами (`renderHTML` выше), а обёртка с уголком живёт только внутри редактора.
   */
  addNodeView() {
    return ({ node, editor, getPos }) => {
      let current = node;

      const dom = document.createElement('div');
      dom.className = 'rti-figure';
      const image = document.createElement('img');
      const handle = document.createElement('span');
      handle.className = 'rti-figure__handle';
      handle.title = 'Потяните, чтобы изменить размер';
      dom.append(image, handle);

      const apply = () => {
        const attrs = current.attrs as { src?: string; alt?: string; title?: string; width?: number; textAlign?: string };
        image.src = attrs.src ?? '';
        if (attrs.alt) image.alt = attrs.alt;
        else image.removeAttribute('alt');
        if (attrs.title) image.title = attrs.title;
        else image.removeAttribute('title');
        image.style.width = attrs.width ? `${attrs.width}px` : '';
        dom.dataset.align = attrs.textAlign ?? 'left';
      };
      apply();

      handle.addEventListener('pointerdown', (event) => {
        // Иначе ProseMirror примет нажатие за начало выделения и потащит текст.
        event.preventDefault();
        event.stopPropagation();

        const startX = event.clientX;
        const startWidth = image.getBoundingClientRect().width;
        let width = Math.round(startWidth);

        const move = (moved: PointerEvent) => {
          width = Math.max(MIN_WIDTH, Math.round(startWidth + (moved.clientX - startX)));
          image.style.width = `${width}px`;
        };

        const up = () => {
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', up);
          window.removeEventListener('pointercancel', up);
          const position = typeof getPos === 'function' ? getPos() : null;
          // В документ ширина попадает один раз, на отпускании: писать её на каждый кадр значило бы
          // засыпать историю правок сотней шагов, из которых отменять пришлось бы каждый.
          if (position !== null && position !== undefined) {
            editor.view.dispatch(editor.view.state.tr.setNodeAttribute(position, 'width', width));
          }
        };

        // Слушает окно, а не сам уголок: палец или мышь во время растягивания уходят с него, и с
        // захватом указателя внутри contenteditable на это полагаться нельзя.
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
        window.addEventListener('pointercancel', up);
      });

      return {
        dom,
        update: (updated) => {
          if (updated.type.name !== current.type.name) return false;
          current = updated;
          apply();
          return true;
        },
        // Разметку внутри обёртки правим мы сами; читать её обратно редактору не нужно.
        ignoreMutation: () => true,
        stopEvent: (event) => event.target === handle,
      };
    };
  },
});

/**
 * Выравнивание с общей панели работает и на картинке.
 *
 * `TextAlign` двигает абзацы и заголовки, а картинка — узел со своим свойством, и кнопки «по левому
 * краю / по центру / по правому» на неё не действовали вовсе. Врач, выделивший картинку и нажавший
 * «по центру», ждёт, что она встанет по центру, а не что кнопка промолчит: панель одна, и обещание
 * у кнопки одно. Поэтому команда перехватывается, когда выделена картинка.
 *
 * Своя панель у картинки при этом остаётся — в ней ширина, которой на общей панели нет.
 */
export const ImageAwareTextAlign = TextAlign.extend({
  addCommands() {
    const parent = this.parent?.();

    return {
      ...parent,
      setTextAlign:
        (alignment: string) =>
        (props) => {
          if (!props.editor.isActive('image')) return parent?.setTextAlign?.(alignment)(props) ?? false;
          // «По ширине» у картинки смысла не имеет: растягивать её до полей — не то, чего просят.
          const align = alignment === 'justify' ? 'left' : alignment;
          return props.commands.updateAttributes('image', { textAlign: align });
        },
      unsetTextAlign:
        () =>
        (props) => {
          if (!props.editor.isActive('image')) return parent?.unsetTextAlign?.()(props) ?? false;
          return props.commands.updateAttributes('image', { textAlign: null });
        },
    };
  },
});
