import { useMemo, useState, type ReactNode } from 'react';
import { Badge, Group, Stack, Text, TextInput } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';

import { CatalogPanel } from '../../components/common/CatalogPanel';
import { DataTable } from '../../components/common/DataTable';
import { sortRows, useTableSort } from '../../lib/tableSort';
import type { MicrobiologyReference, Organism } from './types';

/**
 * Справочник возбудителей — вторая половина раздела.
 *
 * Она нужна и без бланка: врач читает чужую выписку и хочет знать, что такое стенотрофомонас и
 * почему он устойчив к карбапенемам. Ровно ради этого раздел и стал разделом, а не вкладкой на
 * странице анализов: разбор бланка — инструмент, а это — то, что читают.
 *
 * Показывается здесь не биология, а **роль**: где микроб живёт в норме и к чему устойчив от
 * природы. «Грамотрицательная палочка семейства Enterobacteriaceae» не меняет ни одного решения.
 */
type SortKey = 'name' | 'group' | 'flora';

const GROUP_LABEL: Record<string, string> = {
  enterobacterales: 'Энтеробактерии',
  nonfermenter: 'Неферментирующие',
  staphylococcus: 'Стафилококки',
  streptococcus: 'Стрептококки',
  enterococcus: 'Энтерококки',
  haemophilus: 'Гемофилы',
  moraxella: 'Моракселлы',
  neisseria: 'Нейссерии',
  corynebacterium: 'Коринебактерии',
  listeria: 'Листерии',
  anaerobe: 'Анаэробы',
  mycoplasma: 'Микоплазмы',
  chlamydia: 'Хламидии',
  yeast: 'Дрожжевые грибы',
  mold: 'Плесневые грибы',
  lactobacillus: 'Лактобактерии',
  gardnerella: 'Гарднереллы',
  other: 'Прочие',
};

export function OrganismCatalog({ reference, tabs }: { reference: MicrobiologyReference; tabs: ReactNode }) {
  const [query, setQuery] = useState('');
  const sortState = useTableSort<SortKey>(
    { key: 'name', direction: 'asc' },
    { storageKey: 'medassist:sort:microbiology', keys: ['name', 'group', 'flora'] },
  );

  /** Где этот микроб — нормальный обитатель. Считается один раз: локусы называют флору, а не наоборот. */
  const floraOf = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const locus of reference.loci) {
      for (const key of locus.flora) map.set(key, [...(map.get(key) ?? []), locus.short]);
    }
    return map;
  }, [reference.loci]);

  /** Сколько правил природной устойчивости относится к возбудителю — этим и ценен справочник. */
  const intrinsicOf = useMemo(() => {
    const map = new Map<string, number>();
    for (const organism of reference.organisms) {
      const count = reference.intrinsic.filter(
        (rule) =>
          !rule.exceptOrganisms?.includes(organism.key) &&
          ((rule.groups?.includes(organism.group) ?? false) || (rule.organisms?.includes(organism.key) ?? false)),
      ).length;
      map.set(organism.key, count);
    }
    return map;
  }, [reference.organisms, reference.intrinsic]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return reference.organisms;
    return reference.organisms.filter((organism) =>
      [organism.ru, organism.name, ...organism.aliases].some((value) => value.toLowerCase().includes(q)),
    );
  }, [reference.organisms, query]);

  const rows = useMemo(
    () =>
      sortRows(filtered as Organism[], sortState.sort, (organism, key) =>
        key === 'name'
          ? organism.ru
          : key === 'group'
            ? GROUP_LABEL[organism.group] ?? organism.group
            : (floraOf.get(organism.key) ?? []).join(', '),
      ),
    [filtered, sortState.sort, floraOf],
  );

  return (
    <CatalogPanel
      tabs={tabs}
      header={
        <Group justify="space-between" wrap="wrap">
          <Text size="sm" c="dimmed">
            {query.trim()
              ? `Найдено: ${rows.length} из ${reference.organisms.length}`
              : `Возбудителей: ${reference.organisms.length}`}
          </Text>
          <TextInput
            placeholder="Название или сокращение из бланка"
            leftSection={<IconSearch size={16} />}
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            w={{ base: '100%', sm: 320 }}
          />
        </Group>
      }
    >
      <DataTable
        rows={rows}
        rowKey={(organism) => organism.key}
        sort={sortState.sort}
        onSort={sortState.toggle}
        minWidth={760}
        columns={[
          {
            key: 'name',
            header: 'Возбудитель',
            miw: 340,
            compact: true,
            render: (organism) => (
              <Stack gap={2}>
                <Text fw={600} size="sm">
                  {organism.ru}
                </Text>
                <Text size="xs" c="dimmed" fs="italic">
                  {organism.name}
                </Text>
                <Text size="xs" c="dimmed" lineClamp={2}>
                  {organism.note}
                </Text>
              </Stack>
            ),
          },
          {
            key: 'group',
            header: 'Группа',
            w: 190,
            render: (organism) => (
              <Stack gap={4}>
                <Badge variant="light" color="gray">
                  {GROUP_LABEL[organism.group] ?? organism.group}
                </Badge>
                {organism.gram && (
                  <Text size="xs" c="dimmed">
                    {organism.gram === 'positive' ? 'Грам +' : 'Грам −'}
                  </Text>
                )}
              </Stack>
            ),
          },
          {
            key: 'flora',
            header: 'Где норма',
            w: 200,
            render: (organism) => {
              const flora = floraOf.get(organism.key) ?? [];
              return flora.length === 0 ? (
                <Text size="xs" c="dimmed">
                  Нигде — всегда находка
                </Text>
              ) : (
                <Text size="xs">{flora.join(', ')}</Text>
              );
            },
          },
          {
            header: 'Природная устойчивость',
            w: 190,
            render: (organism) => {
              const count = intrinsicOf.get(organism.key) ?? 0;
              return count === 0 ? (
                <Text size="xs" c="dimmed">
                  Правил нет
                </Text>
              ) : (
                <Text size="xs">
                  {count} {count === 1 ? 'правило' : count < 5 ? 'правила' : 'правил'} — учитываются при разборе
                </Text>
              );
            },
          },
        ]}
      />
    </CatalogPanel>
  );
}
