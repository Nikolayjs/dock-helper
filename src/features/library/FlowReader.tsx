import { useEffect, useRef, useState } from 'react';
import { ActionIcon, Group, Stack } from '@mantine/core';
import { IconMinus, IconPlus } from '@tabler/icons-react';

import './flowReader.css';
import { READER_FONT_SCALE_MAX, READER_FONT_SCALE_MIN, getReaderFontScale, setReaderFontScale } from './readerPrefs';

const BASE_FONT_SIZE = 16;

interface FlowReaderProps {
  bodyHtml: string;
  /** Format-specific styling layered over the shared `.flow-reader` typography. */
  contentClassName?: string;
  initialProgress?: number;
  /** Hides the font-size toolbar, for distraction-free reading on small screens. */
  immersive?: boolean;
  onProgressChange?: (fraction: number) => void;
}

/**
 * The reader for formats that reflow: FB2 and DOCX. Neither has pages of its own — the text is a
 * single stream that the window's width decides the shape of — so position is a scroll fraction
 * rather than a page number, and the only control that means anything is type size. PDF and DjVu
 * are the opposite (fixed pages, a zoom level) and have their own readers.
 */
export function FlowReader({
  bodyHtml,
  contentClassName,
  initialProgress = 0,
  immersive,
  onProgressChange,
}: FlowReaderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const restoredRef = useRef(false);
  const [fontScale, setFontScale] = useState(() => getReaderFontScale());

  useEffect(() => {
    const el = containerRef.current;
    if (!el || restoredRef.current) return;
    restoredRef.current = true;
    requestAnimationFrame(() => {
      const max = el.scrollHeight - el.clientHeight;
      if (max > 0) el.scrollTop = max * initialProgress;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodyHtml]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let frame = 0;
    const handleScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const max = el.scrollHeight - el.clientHeight;
        const fraction = max > 0 ? el.scrollTop / max : 0;
        onProgressChange?.(fraction);
      });
    };
    el.addEventListener('scroll', handleScroll);
    return () => {
      el.removeEventListener('scroll', handleScroll);
      cancelAnimationFrame(frame);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const adjustFontScale = (delta: number) => {
    setFontScale((prev) => {
      const next = Math.min(
        READER_FONT_SCALE_MAX,
        Math.max(READER_FONT_SCALE_MIN, Math.round((prev + delta) * 100) / 100),
      );
      setReaderFontScale(next);
      return next;
    });
  };

  return (
    <Stack align="center" gap="md" w="100%">
      {!immersive && (
        <Group>
          <ActionIcon variant="subtle" color="gray" onClick={() => adjustFontScale(-0.1)} title="Мельче">
            <IconMinus size={16} />
          </ActionIcon>
          <ActionIcon variant="subtle" color="gray" onClick={() => adjustFontScale(0.1)} title="Крупнее">
            <IconPlus size={16} />
          </ActionIcon>
        </Group>
      )}
      <div
        ref={containerRef}
        className={contentClassName ? `flow-reader ${contentClassName}` : 'flow-reader'}
        style={{
          maxHeight: immersive ? '92vh' : '75vh',
          overflowY: 'auto',
          padding: '0 8px',
          width: '100%',
          fontSize: BASE_FONT_SIZE * fontScale,
        }}
      >
        <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
      </div>
    </Stack>
  );
}
