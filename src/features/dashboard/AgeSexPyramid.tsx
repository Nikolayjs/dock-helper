import { Box, Group, Stack, Text } from '@mantine/core';

import type { AgeBand } from './practice';

/**
 * The practice's population by age and sex, mirrored around the age labels.
 *
 * Two series, so two hues — and the pair was chosen by the validator, not by eye: brand.6 against
 * orange.8 separates at ΔE 32 under protanopia and clears 3:1 against both the light and the dark
 * chart surface, so it survives colour blindness and either theme unchanged. Because it is two
 * series, a legend is always present, and every bar carries its count in text ink beside it: nobody
 * has to read a number off a colour.
 *
 * Drawn by hand for the same reason as the ranked list — the mirrored axis, the centred labels and
 * counts that stay legible against a one-patient bar are all label problems, not plot problems.
 */

/** Validated pair — see the note above before changing either. */
const MALE_COLOR = 'var(--mantine-color-brand-6)';
const FEMALE_COLOR = 'var(--mantine-color-orange-8)';

interface AgeSexPyramidProps {
  bands: AgeBand[];
  /** Patients left out because they have no birth date; stated rather than silently dropped. */
  undatedCount?: number;
}

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <Group gap={6} wrap="nowrap">
      <Box w={10} h={10} style={{ borderRadius: 3, background: color, flexShrink: 0 }} />
      <Text size="xs" c="dimmed">
        {label}
      </Text>
    </Group>
  );
}

export function AgeSexPyramid({ bands, undatedCount = 0 }: AgeSexPyramidProps) {
  const total = bands.reduce((sum, band) => sum + band.male + band.female + band.unknownSex, 0);

  if (total === 0) {
    return (
      <Text size="sm" c="dimmed">
        Пока не у кого посчитать: ни у одного пациента не указана дата рождения.
      </Text>
    );
  }

  // Both wings share one scale, or the smaller sex would look as numerous as the larger one.
  const max = Math.max(1, ...bands.map((band) => Math.max(band.male, band.female)));
  const unknownSex = bands.reduce((sum, band) => sum + band.unknownSex, 0);

  return (
    <Stack gap="sm">
      <Group justify="center" gap="lg">
        <Swatch color={MALE_COLOR} label="Мужчины" />
        <Swatch color={FEMALE_COLOR} label="Женщины" />
      </Group>

      <Stack gap={6}>
        {bands.map((band) => (
          <Group key={band.label} gap={8} wrap="nowrap" align="center">
            <Group gap={6} justify="flex-end" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
              <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
                {band.male || ''}
              </Text>
              <Box
                role="img"
                aria-label={`${band.label} лет, мужчины: ${band.male}`}
                style={{
                  height: 14,
                  width: `${(band.male / max) * 100}%`,
                  background: MALE_COLOR,
                  borderRadius: '4px 2px 2px 4px',
                }}
              />
            </Group>

            <Text size="xs" fw={500} ta="center" style={{ width: 52, flexShrink: 0 }}>
              {band.label}
            </Text>

            <Group gap={6} wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
              <Box
                role="img"
                aria-label={`${band.label} лет, женщины: ${band.female}`}
                style={{
                  height: 14,
                  width: `${(band.female / max) * 100}%`,
                  background: FEMALE_COLOR,
                  borderRadius: '2px 4px 4px 2px',
                }}
              />
              <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
                {band.female || ''}
              </Text>
            </Group>
          </Group>
        ))}
      </Stack>

      {(undatedCount > 0 || unknownSex > 0) && (
        <Text size="xs" c="dimmed" ta="center">
          {[
            undatedCount > 0 ? `без даты рождения: ${undatedCount}` : null,
            unknownSex > 0 ? `без указания пола: ${unknownSex}` : null,
          ]
            .filter(Boolean)
            .join(' · ')}{' '}
          — в график не вошли
        </Text>
      )}
    </Stack>
  );
}
