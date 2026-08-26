import { Box, Group, Stack, Text } from '@mantine/core';

export interface BarItem {
  label: string;
  value: number;
  /** Shown after the label in muted ink — an ICD code, or nothing. */
  code?: string;
}

/**
 * A ranked list of named quantities, drawn as bars.
 *
 * One series, so one hue: identity is carried by the labels beside each bar, never by colour. That
 * is what lets this stay readable in both themes and under any colour vision — there is no pair of
 * hues for a reader to tell apart.
 *
 * Drawn as elements rather than through a chart library because every rule that matters here is
 * about the label, not the plot: a diagnosis is a long phrase, it must sit beside its bar rather
 * than under it, and the value has to stay legible when the bar is a sliver.
 */

interface RankedBarListProps {
  items: BarItem[];
  /** Beyond this the tail becomes a single summary row: a chart of forty bars ranks nothing. */
  limit?: number;
  /** What to say when everything is zero. */
  emptyMessage: string;
  /** Label for the folded tail; absent means never fold. */
  tailLabel?: (count: number) => string;
}

const DEFAULT_LIMIT = 8;

/** brand.6 — validated at >= 3:1 on both the light and the dark chart surface. */
const BAR_COLOR = 'var(--mantine-color-brand-6)';

export function RankedBarList({ items, limit = DEFAULT_LIMIT, emptyMessage, tailLabel }: RankedBarListProps) {
  const ranked = items.filter((item) => item.value > 0);
  if (ranked.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        {emptyMessage}
      </Text>
    );
  }

  const foldedTail = tailLabel && ranked.length > limit ? ranked.slice(limit) : [];
  const bars: BarItem[] =
    foldedTail.length > 0 && tailLabel
      ? [
          ...ranked.slice(0, limit),
          { label: tailLabel(foldedTail.length), value: foldedTail.reduce((sum, item) => sum + item.value, 0) },
        ]
      : ranked;

  // Scaled to the largest bar, not to the total: this compares diseases with each other.
  const max = Math.max(...bars.map((bar) => bar.value));

  return (
    <Stack gap="xs">
      {bars.map((bar) => (
        <div key={bar.label}>
          <Group justify="space-between" gap="sm" wrap="nowrap" mb={4}>
            <Text size="sm" lineClamp={1}>
              {bar.label}
              {bar.code && (
                <Text span size="xs" c="dimmed">
                  {' '}
                  · {bar.code}
                </Text>
              )}
            </Text>
            {/* The count wears text ink, not the bar's colour. */}
            <Text size="sm" fw={600} style={{ flexShrink: 0 }}>
              {bar.value}
            </Text>
          </Group>
          <Box
            role="img"
            aria-label={`${bar.label}: ${bar.value}`}
            style={{
              height: 10,
              width: `${Math.max((bar.value / max) * 100, 2)}%`,
              background: BAR_COLOR,
              // Rounded only at the free end; the baseline end stays square against the axis.
              borderRadius: '2px 4px 4px 2px',
            }}
          />
        </div>
      ))}
    </Stack>
  );
}
