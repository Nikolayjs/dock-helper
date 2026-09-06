import { memo, useMemo } from 'react';
import {
  ActionIcon,
  Badge,
  Card,
  Group,
  NumberInput,
  SegmentedControl,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';

import { InlineBold } from '../../components/common/InlineBold';

import type { Antibiotic, GrowthDegree, Isolate, Organism, SusceptibilityResult } from './types';
import { sup } from './cultureEngine';

/**
 * Один возбудитель бланка: кто, сколько и что показала антибиотикограмма.
 *
 * Карточка мемоизирована, а обработчики приходят постоянными: бланк на трёх изолятах с двумя
 * десятками препаратов у каждого — это шестьдесят переключателей, и без этого каждое нажатие
 * перерисовывало бы весь список. Та же причина, что у строк конструктора анализатора.
 */
interface IsolateCardProps {
  isolate: Isolate;
  index: number;
  organisms: Organism[];
  antibiotics: Antibiotic[];
  onChange: (uid: string, patch: Partial<Isolate>) => void;
  onRemove: (uid: string) => void;
}

const RESULT_DATA = [
  { value: 'S', label: 'S' },
  { value: 'I', label: 'I' },
  { value: 'R', label: 'R' },
];

const DEGREE_DATA = [
  { value: '', label: 'Не указана' },
  { value: '1', label: 'I скудный' },
  { value: '2', label: 'II умеренный' },
  { value: '3', label: 'III обильный' },
  { value: '4', label: 'IV массивный' },
];

/**
 * Поиск ищет и по латыни, и по сокращению из бланка.
 *
 * Врач переписывает из бумаги, где напечатано `E. coli`, а не «кишечная палочка»; отбор только по
 * подписи не нашёл бы её вовсе. Собственный фильтр нужен ровно поэтому — та же правка, что у поиска
 * препаратов в постоянной терапии.
 */
function matches(haystack: string[], query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return haystack.some((value) => value.toLowerCase().includes(q));
}

export const IsolateCard = memo(function IsolateCard({
  isolate,
  index,
  organisms,
  antibiotics,
  onChange,
  onRemove,
}: IsolateCardProps) {
  const organismData = useMemo(
    () => organisms.map((o) => ({ value: o.key, label: o.ru, latin: o.name, aliases: o.aliases })),
    [organisms],
  );
  const usedKeys = useMemo(() => new Set(isolate.susceptibility.map((e) => e.antibioticKey)), [isolate.susceptibility]);
  const antibioticData = useMemo(
    () =>
      antibiotics
        .filter((a) => !usedKeys.has(a.key))
        .map((a) => ({ value: a.key, label: a.name, aliases: a.aliases })),
    [antibiotics, usedKeys],
  );
  const antibioticByKey = useMemo(() => new Map(antibiotics.map((a) => [a.key, a])), [antibiotics]);

  const organism = isolate.organismKey ? organisms.find((o) => o.key === isolate.organismKey) : undefined;

  return (
    <Card withBorder padding="md">
      <Stack gap="sm">
        <Group justify="space-between" wrap="nowrap" align="flex-start">
          <Text fw={600} size="sm">
            Возбудитель {index + 1}
          </Text>
          <Tooltip label="Убрать возбудителя">
            <ActionIcon variant="subtle" color="red" aria-label="Убрать возбудителя" onClick={() => onRemove(isolate.uid)}>
              <IconTrash size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>

        <Select
          label="Кто вырос"
          placeholder="Начните вводить название или сокращение из бланка"
          searchable
          clearable
          data={organismData}
          value={isolate.organismKey ?? null}
          onChange={(value) => onChange(isolate.uid, { organismKey: value ?? undefined })}
          filter={({ options, search }) =>
            options.filter((option) => {
              const item = option as unknown as { label: string; latin?: string; aliases?: string[] };
              return matches([item.label, item.latin ?? '', ...(item.aliases ?? [])], search);
            })
          }
          renderOption={({ option }) => {
            const item = option as unknown as { label: string; latin?: string };
            return (
              <div>
                <Text size="sm">{item.label}</Text>
                <Text size="xs" c="dimmed" fs="italic">
                  {item.latin}
                </Text>
              </div>
            );
          }}
        />

        {/* Возбудителя нет в справочнике — записываем, как напечатано: толковать его движок не
            станет и скажет об этом прямо, но из бланка он не пропадёт. */}
        {!isolate.organismKey && (
          <TextInput
            label="Нет в списке — как напечатано в бланке"
            placeholder="Например: Enterobacter aerogenes"
            value={isolate.organismLabel ?? ''}
            onChange={(event) => onChange(isolate.uid, { organismLabel: event.currentTarget.value })}
          />
        )}

        {organism && (
          <Text size="xs" c="dimmed">
            <InlineBold text={organism.note} />
          </Text>
        )}

        <Group grow align="flex-start">
          <NumberInput
            label="Счёт, lg КОЕ/мл"
            description={isolate.lgCfu !== undefined ? `10${sup(isolate.lgCfu)} КОЕ/мл` : 'Степень 10, как в бланке'}
            placeholder="5"
            min={0}
            max={12}
            allowDecimal={false}
            hideControls
            value={isolate.lgCfu ?? ''}
            onChange={(value) =>
              onChange(isolate.uid, { lgCfu: value === '' || value === null ? undefined : Number(value) })
            }
          />
          <Select
            label="Или степень роста"
            description="Когда КОЕ лаборатория не считала"
            data={DEGREE_DATA}
            value={isolate.growthDegree ? String(isolate.growthDegree) : ''}
            onChange={(value) =>
              onChange(isolate.uid, { growthDegree: value ? (Number(value) as GrowthDegree) : undefined })
            }
          />
        </Group>

        <Stack gap="xs">
          <Text size="sm" fw={500}>
            Антибиотикограмма
          </Text>
          {isolate.susceptibility.length > 0 && (
            <Table verticalSpacing={4} withRowBorders={false}>
              <Table.Tbody>
                {isolate.susceptibility.map((entry) => (
                  <Table.Tr key={entry.antibioticKey}>
                    <Table.Td>
                      <Text size="sm">{antibioticByKey.get(entry.antibioticKey)?.name ?? entry.label ?? entry.antibioticKey}</Text>
                    </Table.Td>
                    <Table.Td w={170}>
                      <SegmentedControl
                        size="xs"
                        fullWidth
                        data={RESULT_DATA}
                        value={entry.result}
                        onChange={(value) =>
                          onChange(isolate.uid, {
                            susceptibility: isolate.susceptibility.map((e) =>
                              e.antibioticKey === entry.antibioticKey
                                ? { ...e, result: value as SusceptibilityResult }
                                : e,
                            ),
                          })
                        }
                      />
                    </Table.Td>
                    <Table.Td w={36}>
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        aria-label={`Убрать ${antibioticByKey.get(entry.antibioticKey)?.name ?? 'препарат'}`}
                        onClick={() =>
                          onChange(isolate.uid, {
                            susceptibility: isolate.susceptibility.filter((e) => e.antibioticKey !== entry.antibioticKey),
                          })
                        }
                      >
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
          <Select
            placeholder="Добавить препарат из бланка"
            searchable
            // Значение не держится: поле — это способ добавить строку, а не состояние выбора.
            value={null}
            data={antibioticData}
            nothingFoundMessage="Такого препарата нет в справочнике"
            filter={({ options, search }) =>
              options.filter((option) => {
                const item = option as unknown as { label: string; aliases?: string[] };
                return matches([item.label, ...(item.aliases ?? [])], search);
              })
            }
            onChange={(value) => {
              if (!value) return;
              onChange(isolate.uid, {
                susceptibility: [...isolate.susceptibility, { antibioticKey: value, result: 'S' }],
              });
            }}
          />
          {isolate.susceptibility.length === 0 && (
            <Text size="xs" c="dimmed">
              Без антибиотикограммы разбор всё равно ответит на главный вопрос — значим ли рост.
            </Text>
          )}
        </Stack>

        {organism && (
          <Group gap={6}>
            <Badge size="xs" variant="light" color="gray">
              {organism.name}
            </Badge>
            {organism.gram && (
              <Badge size="xs" variant="light" color={organism.gram === 'positive' ? 'violet' : 'pink'}>
                {organism.gram === 'positive' ? 'Грам +' : 'Грам −'}
              </Badge>
            )}
          </Group>
        )}
      </Stack>
    </Card>
  );
});
