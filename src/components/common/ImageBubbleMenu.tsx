import { ActionIcon, Button, Divider, Group, NumberInput, Paper, Tooltip } from '@mantine/core';
import { IconAlignCenter, IconAlignLeft, IconAlignRight, IconRestore } from '@tabler/icons-react';
import type { Editor } from '@tiptap/react';
import { useEditorState } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';

import type { ImageAlign } from './resizableImage';

/**
 * Панель у выделенной картинки: ширина и выравнивание.
 *
 * Уголок на самой картинке даёт произвольный размер «на глаз» — этого хватает, пока не нужно
 * поставить рядом два снимка одной ширины. Поэтому здесь ещё и число: доли ширины страницы и поле,
 * в которое размер вводят точно.
 *
 * Нажатия не должны уводить выделение с картинки, иначе применять будет не к чему: у кнопок
 * `onMouseDown` с `preventDefault`, у поля ввода этого не нужно — выделение узла переживает потерю
 * фокуса, а `focus()` в цепочке возвращает его на место.
 */

const ALIGNMENTS: { value: ImageAlign; label: string; icon: typeof IconAlignLeft }[] = [
  { value: 'left', label: 'По левому краю', icon: IconAlignLeft },
  { value: 'center', label: 'По центру', icon: IconAlignCenter },
  { value: 'right', label: 'По правому краю', icon: IconAlignRight },
];

/** Доли ширины страницы — то, чем меряют картинку в документе: во всю ширину, в половину, в четверть. */
const FRACTIONS = [0.25, 0.5, 1];

export function ImageBubbleMenu({ editor }: { editor: Editor | null }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => {
      const attributes = current?.getAttributes('image') ?? {};
      return {
        width: typeof attributes.width === 'number' ? attributes.width : null,
        align: (attributes.textAlign as ImageAlign | null) ?? 'left',
      };
    },
  });

  if (!editor) return null;

  /** Ширина страницы в редакторе — от неё считаются доли. */
  const contentWidth = () => Math.max(120, Math.round(editor.view.dom.clientWidth));

  const setWidth = (width: number | null) => editor.chain().focus().updateAttributes('image', { width }).run();
  // Тем же путём, что и кнопки общей панели: одно действие — одна команда.
  const setAlign = (align: ImageAlign) => editor.chain().focus().setTextAlign(align).run();

  return (
    <BubbleMenu
      editor={editor}
      options={{ placement: 'top', offset: 8 }}
      shouldShow={({ editor: current }) => current.isActive('image')}
    >
      <Paper withBorder shadow="md" radius="md" p={4}>
        <Group gap={2} wrap="nowrap">
          {ALIGNMENTS.map(({ value, label, icon: Icon }) => (
            <Tooltip key={value} label={label} withArrow>
              <ActionIcon
                variant={state?.align === value ? 'light' : 'subtle'}
                color={state?.align === value ? 'brand' : 'gray'}
                aria-label={label}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setAlign(value)}
              >
                <Icon size={16} stroke={1.5} />
              </ActionIcon>
            </Tooltip>
          ))}

          <Divider orientation="vertical" mx={2} />

          {FRACTIONS.map((fraction) => (
            <Button
              key={fraction}
              size="compact-xs"
              variant="subtle"
              color="gray"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setWidth(Math.round(contentWidth() * fraction))}
            >
              {Math.round(fraction * 100)}%
            </Button>
          ))}

          <NumberInput
            size="xs"
            w={92}
            min={60}
            max={4000}
            step={20}
            suffix=" px"
            placeholder="как есть"
            aria-label="Ширина картинки"
            value={state?.width ?? ''}
            onChange={(value) => setWidth(typeof value === 'number' ? value : null)}
          />

          <Tooltip label="Натуральный размер" withArrow>
            <ActionIcon
              variant="subtle"
              color="gray"
              aria-label="Натуральный размер"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setWidth(null)}
            >
              <IconRestore size={16} stroke={1.5} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Paper>
    </BubbleMenu>
  );
}
