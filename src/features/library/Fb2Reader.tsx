import { useEffect, useRef, useState } from 'react';
import { ActionIcon, Group, Stack } from '@mantine/core';
import { IconMinus, IconPlus } from '@tabler/icons-react';

import './fb2Content.css';
import { FB2_FONT_SCALE_MAX, FB2_FONT_SCALE_MIN, getFb2FontScale, setFb2FontScale } from './readerPrefs';

const BASE_FONT_SIZE = 16;

interface Fb2ReaderProps {
  bodyHtml: string;
  initialProgress?: number;
  /** Hides the font-size toolbar, for distraction-free reading on small screens. */
  immersive?: boolean;
  onProgressChange?: (fraction: number) => void;
}

export function Fb2Reader({ bodyHtml, initialProgress = 0, immersive, onProgressChange }: Fb2ReaderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const restoredRef = useRef(false);
  const [fontScale, setFontScale] = useState(() => getFb2FontScale());

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
      const next = Math.min(FB2_FONT_SCALE_MAX, Math.max(FB2_FONT_SCALE_MIN, Math.round((prev + delta) * 100) / 100));
      setFb2FontScale(next);
      return next;
    });
  };

  return (
    <Stack align="center" gap="md" w="100%">
      {!immersive && (
        <Group>
          <ActionIcon variant="subtle" color="gray" onClick={() => adjustFontScale(-0.1)}>
            <IconMinus size={16} />
          </ActionIcon>
          <ActionIcon variant="subtle" color="gray" onClick={() => adjustFontScale(0.1)}>
            <IconPlus size={16} />
          </ActionIcon>
        </Group>
      )}
      <div
        ref={containerRef}
        className="fb2-reader"
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
