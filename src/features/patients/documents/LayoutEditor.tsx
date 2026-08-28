import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Group,
  SegmentedControl,
  Select,
  Slider,
  Stack,
  Switch,
  Text,
  Textarea,
  Tooltip,
} from '@mantine/core';
import { IconPlus, IconTrash } from '@tabler/icons-react';

import { PLACEHOLDERS } from './templateTypes';
import { LayoutDocument } from './LayoutDocument';
import classes from './layoutEditor.module.css';
import { LOW_CONFIDENCE_THRESHOLD, PAGE_PRESETS, clampBlock, createLayoutBlock } from './layoutTypes';
import type { TemplateLayout, TemplateLayoutBlock } from './layoutTypes';

/**
 * Editing a recognised form: blocks positioned over a faded copy of the original.
 *
 * Text is corrected in the side panel rather than in place on the canvas. Recognition errors tend
 * to be whole mangled lines rather than single characters, and a textarea showing the entire string
 * is easier to fix — and far less code — than a contenteditable overlay that has to survive
 * dragging, resizing and selection at the same time.
 */

type DragMode = 'move' | 'resize';

/** Кратности увеличения холста. Целые — чтобы «в один лист» читалось однозначно. */
const CANVAS_ZOOMS = [1, 2, 3];

interface LayoutEditorProps {
  layout: TemplateLayout;
  onChange: (layout: TemplateLayout) => void;
}

export function LayoutEditor({ layout, onChange }: LayoutEditorProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [backdropOpacity, setBackdropOpacity] = useState(0.35);
  const [zoom, setZoom] = useState(1);
  const dragRef = useRef<{ mode: DragMode; startX: number; startY: number; start: TemplateLayoutBlock } | null>(null);

  const selected = layout.blocks.find((b) => b.id === selectedId) ?? null;

  const updateBlock = useCallback(
    (id: string, patch: Partial<TemplateLayoutBlock>) => {
      onChange({
        ...layout,
        blocks: layout.blocks.map((b) => (b.id === id ? clampBlock({ ...b, ...patch }) : b)),
      });
    },
    [layout, onChange],
  );

  const beginDrag = (block: TemplateLayoutBlock, mode: DragMode) => (event: React.PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedId(block.id);
    dragRef.current = { mode, startX: event.clientX, startY: event.clientY, start: block };
  };

  const handleMove = useCallback(
    (event: PointerEvent) => {
      const drag = dragRef.current;
      const canvas = canvasRef.current;
      if (!drag || !canvas) return;

      const bounds = canvas.getBoundingClientRect();
      const dxPct = ((event.clientX - drag.startX) / bounds.width) * 100;
      const dyPct = ((event.clientY - drag.startY) / bounds.height) * 100;

      updateBlock(
        drag.start.id,
        drag.mode === 'move'
          ? { xPct: drag.start.xPct + dxPct, yPct: drag.start.yPct + dyPct }
          : { widthPct: drag.start.widthPct + dxPct, heightPct: drag.start.heightPct + dyPct },
      );
    },
    [updateBlock],
  );

  const endDrag = useCallback(() => {
    dragRef.current = null;
  }, []);

  useEffect(() => {
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', endDrag);
      window.removeEventListener('pointercancel', endDrag);
    };
  }, [handleMove, endDrag]);

  const addBlock = () => {
    const block = createLayoutBlock({ yPct: 45 });
    onChange({ ...layout, blocks: [...layout.blocks, block] });
    setSelectedId(block.id);
  };

  const removeSelected = () => {
    if (!selected) return;
    onChange({ ...layout, blocks: layout.blocks.filter((b) => b.id !== selected.id) });
    setSelectedId(null);
  };

  /** Inserts a token at the caret, so it lands where the doctor is actually looking. */
  const insertToken = (token: string) => {
    if (!selected) return;
    const field = textareaRef.current;
    const at = field ? field.selectionStart : selected.text.length;
    const text = `${selected.text.slice(0, at)}${token}${selected.text.slice(field ? field.selectionEnd : at)}`;
    updateBlock(selected.id, { text });
  };

  const lowConfidence = layout.blocks.filter(
    (b) => b.confidence !== null && b.confidence < LOW_CONFIDENCE_THRESHOLD,
  ).length;

  return (
    <div className={classes.editor}>
      <Stack gap="sm" className={classes.canvas}>
        <Group justify="space-between" wrap="wrap" gap="sm">
          <Select
            size="xs"
            w={190}
            label="Формат бумаги"
            data={PAGE_PRESETS.map((p) => ({ value: p.label, label: p.label }))}
            value={
              PAGE_PRESETS.find((p) => p.widthMm === layout.pageWidthMm && p.heightMm === layout.pageHeightMm)?.label ??
              null
            }
            onChange={(value) => {
              const preset = PAGE_PRESETS.find((p) => p.label === value);
              if (preset) onChange({ ...layout, pageWidthMm: preset.widthMm, pageHeightMm: preset.heightMm });
            }}
          />
          {layout.backdropDataUrl && (
            <Box w={200}>
              <Text size="xs" fw={500} mb={4}>
                Подложка
              </Text>
              <Slider
                size="sm"
                min={0}
                max={0.8}
                step={0.05}
                value={backdropOpacity}
                onChange={setBackdropOpacity}
                label={null}
              />
            </Box>
          )}
        </Group>

        <Card withBorder padding={0} onPointerDown={() => setSelectedId(null)}>
          {/* Увеличение меняет ширину холста, а не масштабирует его трансформацией: перетаскивание
              считает проценты от прямоугольника холста, поэтому при изменении ширины арифметика
              остаётся верной без единой правки. */}
          <div className={classes.canvasFrame}>
          <div className={classes.canvasZoom} style={{ width: `${zoom * 100}%` }}>
          {/* The ref sits on a wrapper that shares the page's exact box rather than on the Card,
              whose 1px border would offset every drag calculation by a fraction of a percent. */}
          <div ref={canvasRef} style={{ position: 'relative' }}>
          <LayoutDocument layout={layout} backdropOpacity={backdropOpacity}>
            {layout.blocks.map((block) => {
              const isSelected = block.id === selectedId;
              const isSuspect = block.confidence !== null && block.confidence < LOW_CONFIDENCE_THRESHOLD;
              return (
                <div
                  key={`hit-${block.id}`}
                  onPointerDown={beginDrag(block, 'move')}
                  style={{
                    position: 'absolute',
                    left: `${block.xPct}%`,
                    top: `${block.yPct}%`,
                    width: `${block.widthPct}%`,
                    height: `${block.heightPct}%`,
                    cursor: 'move',
                    touchAction: 'none',
                    outline: isSelected
                      ? '2px solid var(--mantine-color-brand-6)'
                      : isSuspect
                        ? '1px dashed var(--mantine-color-orange-6)'
                        : '1px solid rgba(0,0,0,0.12)',
                    // Tinting what recognition was unsure about puts attention where it is needed,
                    // instead of spreading it evenly over lines that came back perfectly.
                    background: isSuspect ? 'rgba(255, 170, 0, 0.10)' : 'transparent',
                  }}
                >
                  {isSelected && (
                    <div
                      onPointerDown={beginDrag(block, 'resize')}
                      style={{
                        position: 'absolute',
                        right: -6,
                        bottom: -6,
                        width: 12,
                        height: 12,
                        background: 'var(--mantine-color-brand-6)',
                        borderRadius: 2,
                        cursor: 'nwse-resize',
                        touchAction: 'none',
                      }}
                    />
                  )}
                </div>
              );
            })}
          </LayoutDocument>
          </div>
          </div>
          </div>
        </Card>

        <Group gap="xs" wrap="wrap">
          <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} onClick={addBlock}>
            Добавить блок
          </Button>
          {/* Строка бланка на телефоне выходит высотой 9 px: разглядеть можно, попасть пальцем —
              нет. Увеличение существует ради попадания, поэтому подписано кратностью, а не
              процентами: на бумагу оно не влияет никак. */}
          <SegmentedControl
            size="xs"
            aria-label="Увеличение холста"
            value={String(zoom)}
            onChange={(value) => setZoom(Number(value))}
            data={CANVAS_ZOOMS.map((z) => ({ value: String(z), label: `${z}×` }))}
          />
          <Text size="xs" c="dimmed">
            блоков: {layout.blocks.length}
            {lowConfidence > 0 && `, сомнительных: ${lowConfidence}`}
          </Text>
        </Group>
      </Stack>

      <Card withBorder padding="md" className={classes.panel}>
        {!selected ? (
          <Stack gap="xs" py="lg">
            <Text fw={600} size="sm">
              Блок не выбран
            </Text>
            <Text size="sm" c="dimmed">
              Нажмите на блок, чтобы поправить текст, размер и положение. Оранжевым отмечено то, в
              чём распознавание не уверено — начните с него.
            </Text>
          </Stack>
        ) : (
          <Stack gap="md">
            <Group justify="space-between">
              <Text fw={600} size="sm">
                Блок
              </Text>
              <Group gap={6}>
                {selected.confidence !== null && (
                  <Tooltip label="Уверенность распознавания">
                    <Badge
                      size="sm"
                      variant="light"
                      color={selected.confidence < LOW_CONFIDENCE_THRESHOLD ? 'orange' : 'teal'}
                    >
                      {Math.round(selected.confidence)}
                    </Badge>
                  </Tooltip>
                )}
                <ActionIcon variant="subtle" color="red" onClick={removeSelected} aria-label="Удалить блок">
                  <IconTrash size={16} />
                </ActionIcon>
              </Group>
            </Group>

            <Textarea
              ref={textareaRef}
              label="Текст"
              autosize
              minRows={2}
              maxRows={8}
              value={selected.text}
              onChange={(e) => updateBlock(selected.id, { text: e.currentTarget.value })}
            />

            <div>
              <Text size="xs" fw={500} mb={6}>
                Вставить поле
              </Text>
              <Group gap={4}>
                {PLACEHOLDERS.map((placeholder) => (
                  <Badge
                    key={placeholder.token}
                    size="sm"
                    variant="light"
                    color="gray"
                    style={{ cursor: 'pointer' }}
                    onClick={() => insertToken(placeholder.token)}
                  >
                    {placeholder.label}
                  </Badge>
                ))}
              </Group>
            </div>

            <div>
              <Text size="xs" fw={500} mb={4}>
                Размер шрифта
              </Text>
              <Slider
                min={1}
                max={12}
                step={0.1}
                value={selected.fontSizePct}
                onChange={(v) => updateBlock(selected.id, { fontSizePct: v })}
                label={(v) => v.toFixed(1)}
              />
            </div>

            <SegmentedControl
              size="xs"
              fullWidth
              data={[
                { value: 'left', label: 'Слева' },
                { value: 'center', label: 'По центру' },
                { value: 'right', label: 'Справа' },
              ]}
              value={selected.align}
              onChange={(v) => updateBlock(selected.id, { align: v as TemplateLayoutBlock['align'] })}
            />

            <Switch
              size="sm"
              label="Полужирный"
              checked={selected.bold}
              onChange={(e) => updateBlock(selected.id, { bold: e.currentTarget.checked })}
            />
          </Stack>
        )}
      </Card>
    </div>
  );
}
