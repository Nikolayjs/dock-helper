import { Card, Group, Progress, Stack, Text, UnstyledButton } from '@mantine/core';

import type { Candidate } from './diagnosticEngine';

const RANK_COLORS = ['brand', 'grape', 'blue', 'mint', 'gray'];

interface DifferentialListProps {
  ranked: Candidate[];
  /** Сколько версий показывать; остальные сворачиваются в счётчик. */
  limit?: number;
  onSelect?: (candidate: Candidate) => void;
  selectedId?: string;
}

/**
 * Дифференциальный ряд — один на оба режима.
 *
 * Опрос и выбор симптомов рисуют его одинаково намеренно: один и тот же случай не может
 * упорядочиваться двумя разными способами, а две копии этой разметки разошлись бы на первой правке
 * — и врач, перешедший со вкладки на вкладку, увидел бы тот же расчёт в другом виде и решил бы, что
 * это другой расчёт.
 */
export function DifferentialList({ ranked, limit = 5, onSelect, selectedId }: DifferentialListProps) {
  const shown = ranked.slice(0, limit);
  const hidden = ranked.length - shown.length;

  return (
    <Card withBorder padding="lg">
      <Text fw={600} size="sm" mb="md">
        Дифференциальный ряд
      </Text>
      <Stack gap="sm">
        {shown.map((candidate, index) => {
          const selected = candidate.disease.id === selectedId;
          const row = (
            <>
              <Group justify="space-between" wrap="nowrap" gap="sm" mb={4}>
                <Text size="sm" fw={selected && onSelect ? 600 : 400} lineClamp={2}>
                  {candidate.disease.name}
                </Text>
                <Text size="sm" c="dimmed">
                  {Math.round(candidate.probability * 100)}%
                </Text>
              </Group>
              <Progress
                value={candidate.probability * 100}
                color={RANK_COLORS[index] ?? 'gray'}
                radius="xl"
                size="sm"
              />
            </>
          );

          // Выбор версии — настоящая кнопка, а не `div` с обработчиком: до `div` не добраться
          // табуляцией, и разбор соседней версии остался бы недоступен без мыши вовсе. Там, где
          // выбирать нечего (опрос), строка кнопкой и не притворяется.
          return onSelect ? (
            <UnstyledButton
              key={candidate.disease.id}
              onClick={() => onSelect(candidate)}
              aria-pressed={selected}
              aria-label={`Разбор версии «${candidate.disease.name}»`}
            >
              {row}
            </UnstyledButton>
          ) : (
            <div key={candidate.disease.id}>{row}</div>
          );
        })}
      </Stack>
      {hidden > 0 && (
        <Text size="xs" c="dimmed" mt="sm">
          Ещё {hidden} в списке — с меньшей вероятностью.
        </Text>
      )}
    </Card>
  );
}
