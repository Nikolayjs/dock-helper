import { useEffect, useState } from 'react';
import { Anchor, Group, Text } from '@mantine/core';

/**
 * The toast body for a deletion that has not been sent yet.
 *
 * The countdown is the point: «Отменить» with no number attached leaves the doctor guessing whether
 * they still have time to click it, and guessing wrong is the case this whole mechanism exists for.
 */
export function UndoNotice({ text, seconds, onUndo }: { text: string; seconds: number; onUndo: () => void }) {
  const [left, setLeft] = useState(seconds);

  useEffect(() => {
    const tick = setInterval(() => setLeft((value) => (value > 0 ? value - 1 : 0)), 1000);
    return () => clearInterval(tick);
  }, []);

  return (
    <Group justify="space-between" wrap="nowrap" gap="sm">
      <Text size="sm">{text}</Text>
      <Anchor component="button" type="button" size="sm" fw={600} onClick={onUndo} style={{ whiteSpace: 'nowrap' }}>
        Отменить{left > 0 ? ` (${left})` : ''}
      </Anchor>
    </Group>
  );
}
