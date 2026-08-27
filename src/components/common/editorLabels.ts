import type { RichTextEditorLabels } from '@mantine/tiptap';

/**
 * Подписи кнопок редактора по-русски.
 *
 * Mantine отдаёт свои английскими, и они видны там, где их читают: во всплывающей подсказке над
 * кнопкой и в озвучке экранного диктора. Приложение целиком русское, и «Blockquote» посреди панели
 * — единственное место, где это было не так.
 */
export const RUSSIAN_EDITOR_LABELS: Partial<RichTextEditorLabels> = {
  boldControlLabel: 'Полужирный',
  italicControlLabel: 'Курсив',
  underlineControlLabel: 'Подчёркнутый',
  strikeControlLabel: 'Зачёркнутый',
  subscriptControlLabel: 'Подстрочный индекс',
  superscriptControlLabel: 'Надстрочный индекс',
  codeControlLabel: 'Моноширинный',
  codeBlockControlLabel: 'Блок кода',
  clearFormattingControlLabel: 'Убрать форматирование',

  colorPickerControlLabel: 'Цвет текста',
  unsetColorControlLabel: 'Убрать цвет',
  highlightControlLabel: 'Маркер',
  colorControlLabel: (color) => `Цвет текста ${color}`,
  colorPickerColorLabel: (color) => `Цвет текста ${color}`,

  h1ControlLabel: 'Заголовок 1',
  h2ControlLabel: 'Заголовок 2',
  h3ControlLabel: 'Заголовок 3',
  h4ControlLabel: 'Заголовок 4',
  h5ControlLabel: 'Заголовок 5',
  h6ControlLabel: 'Заголовок 6',

  alignLeftControlLabel: 'По левому краю',
  alignCenterControlLabel: 'По центру',
  alignRightControlLabel: 'По правому краю',
  alignJustifyControlLabel: 'По ширине',

  bulletListControlLabel: 'Маркированный список',
  orderedListControlLabel: 'Нумерованный список',
  tasksControlLabel: 'Список задач',
  tasksSinkLabel: 'Вложить пункт',
  tasksLiftLabel: 'Поднять пункт',

  blockquoteControlLabel: 'Цитата',
  hrControlLabel: 'Горизонтальная черта',
  undoControlLabel: 'Отменить',
  redoControlLabel: 'Вернуть',
  sourceCodeControlLabel: 'Показать исходный код',

  linkControlLabel: 'Ссылка',
  unlinkControlLabel: 'Убрать ссылку',
  linkEditorInputLabel: 'Адрес ссылки',
  linkEditorInputPlaceholder: 'https://example.com/',
  linkEditorExternalLink: 'Открывать в новой вкладке',
  linkEditorInternalLink: 'Открывать в этой же вкладке',
  linkEditorSave: 'Сохранить',

  colorPickerCancel: 'Отмена',
  colorPickerClear: 'Убрать цвет',
  colorPickerColorPicker: 'Выбор цвета',
  colorPickerPalette: 'Палитра',
  colorPickerSave: 'Сохранить',
};
