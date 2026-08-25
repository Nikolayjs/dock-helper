import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Button, Group, Stack, Text } from '@mantine/core';

import type { CropRect } from './scanImage';

/**
 * Lets the doctor draw the form's boundary on the photograph before it goes to recognition.
 *
 * Doing this by hand rather than detecting the document automatically is deliberate. Contour
 * detection on a phone photo — glare, shadow, a white form on a pale desk — is a research problem
 * with a long tail of failures, and every one of those failures is silent: the crop is simply
 * wrong and the result is mysteriously bad. The doctor can see where the form is, and dragging a
 * rectangle takes three seconds.
 */

type DragMode = 'move' | 'nw' | 'ne' | 'sw' | 'se';

const MIN_SIZE = 0.05;
const HANDLE_SIZE = 18;

interface ScanCropStepProps {
  image: HTMLImageElement;
  onConfirm: (rect: CropRect) => void;
  onCancel: () => void;
  isBusy?: boolean;
}

export function ScanCropStep({ image, onConfirm, onCancel, isBusy }: ScanCropStepProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Starts as a generous inset rather than the whole frame: a crop covering everything is exactly
  // the case that produced poor recognition, so the initial state should not be the bad one.
  const [rect, setRect] = useState<CropRect>({ x: 0.08, y: 0.08, width: 0.84, height: 0.84 });
  const dragRef = useRef<{ mode: DragMode; startX: number; startY: number; start: CropRect } | null>(null);

  const beginDrag = (mode: DragMode) => (event: React.PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = { mode, startX: event.clientX, startY: event.clientY, start: rect };
  };

  const handleMove = useCallback((event: PointerEvent) => {
    const drag = dragRef.current;
    const container = containerRef.current;
    if (!drag || !container) return;

    const bounds = container.getBoundingClientRect();
    const dx = (event.clientX - drag.startX) / bounds.width;
    const dy = (event.clientY - drag.startY) / bounds.height;
    const s = drag.start;

    setRect(() => {
      if (drag.mode === 'move') {
        return {
          ...s,
          x: Math.min(1 - s.width, Math.max(0, s.x + dx)),
          y: Math.min(1 - s.height, Math.max(0, s.y + dy)),
        };
      }

      // Corner handles move the two edges they touch and leave the opposite corner pinned.
      let { x, y, width, height } = s;
      if (drag.mode === 'nw' || drag.mode === 'sw') {
        const nx = Math.max(0, Math.min(s.x + s.width - MIN_SIZE, s.x + dx));
        width = s.x + s.width - nx;
        x = nx;
      } else {
        width = Math.max(MIN_SIZE, Math.min(1 - s.x, s.width + dx));
      }
      if (drag.mode === 'nw' || drag.mode === 'ne') {
        const ny = Math.max(0, Math.min(s.y + s.height - MIN_SIZE, s.y + dy));
        height = s.y + s.height - ny;
        y = ny;
      } else {
        height = Math.max(MIN_SIZE, Math.min(1 - s.y, s.height + dy));
      }
      return { x, y, width, height };
    });
  }, []);

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

  const pct = (v: number) => `${v * 100}%`;

  const handleStyle = (corner: DragMode, position: React.CSSProperties): React.CSSProperties => ({
    position: 'absolute',
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
    background: 'var(--mantine-color-body)',
    border: '2px solid var(--mantine-color-brand-6)',
    borderRadius: 4,
    cursor: corner === 'nw' || corner === 'se' ? 'nwse-resize' : 'nesw-resize',
    touchAction: 'none',
    ...position,
  });

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        Обведите бланк, отсекая стол и поля. Чем плотнее рамка, тем лучше распознавание — на
        измерениях обрезка дала больше, чем любые фильтры.
      </Text>

      <Box
        ref={containerRef}
        style={{
          position: 'relative',
          userSelect: 'none',
          touchAction: 'none',
          lineHeight: 0,
          background: 'var(--mantine-color-dark-8)',
          borderRadius: 'var(--mantine-radius-md)',
          overflow: 'hidden',
        }}
      >
        <img src={image.src} alt="Загруженный бланк" style={{ width: '100%', display: 'block' }} draggable={false} />

        {/* Everything outside the crop is dimmed by a single element with a huge shadow — cheaper
            and crisper than four separate overlay rectangles. */}
        <div
          onPointerDown={beginDrag('move')}
          style={{
            position: 'absolute',
            left: pct(rect.x),
            top: pct(rect.y),
            width: pct(rect.width),
            height: pct(rect.height),
            border: '2px solid var(--mantine-color-brand-6)',
            boxShadow: '0 0 0 100vmax rgba(0, 0, 0, 0.55)',
            cursor: 'move',
            touchAction: 'none',
          }}
        >
          <div onPointerDown={beginDrag('nw')} style={handleStyle('nw', { left: -HANDLE_SIZE / 2, top: -HANDLE_SIZE / 2 })} />
          <div onPointerDown={beginDrag('ne')} style={handleStyle('ne', { right: -HANDLE_SIZE / 2, top: -HANDLE_SIZE / 2 })} />
          <div onPointerDown={beginDrag('sw')} style={handleStyle('sw', { left: -HANDLE_SIZE / 2, bottom: -HANDLE_SIZE / 2 })} />
          <div onPointerDown={beginDrag('se')} style={handleStyle('se', { right: -HANDLE_SIZE / 2, bottom: -HANDLE_SIZE / 2 })} />
        </div>
      </Box>

      <Group justify="space-between">
        <Button variant="default" onClick={onCancel} disabled={isBusy}>
          Выбрать другой файл
        </Button>
        <Button onClick={() => onConfirm(rect)} loading={isBusy}>
          Распознать
        </Button>
      </Group>
    </Stack>
  );
}
