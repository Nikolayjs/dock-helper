import { useCallback, useMemo, useState } from 'react';
import { Alert, Box, Button, Group, Loader, Select, Stack, Switch, Text, TextInput, ThemeIcon } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconFold, IconFoldDown, IconInfoCircle, IconListSearch, IconSearch, IconX } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';

import { CatalogPanel } from '../../components/common/CatalogPanel';
import { QueryState } from '../../components/common/QueryState';
import { sortRows, useTableSort } from '../../lib/tableSort';
import { ICD10_SORT_KEYS, Icd10Table, icd10SortValue, type Icd10SortKey } from './Icd10Table';
import { Icd10List } from './Icd10List';
import { countTotal, flattenIcd10 } from './flatten';
import type { Icd10Row } from './types';
import { Icd10Unavailable, useIcd10Chapters, useIcd10Children, useIcd10List } from './useIcd10';
import { SpecialtyFilterNotice, SpecialtyFilterSwitch } from '../specialties/SpecialtyFilterControls';
import { useSpecialtyFilter } from '../specialties/useSpecialtyFilter';

const ALL_CHAPTERS = '__all__';

/**
 * Классификация МКБ-10.
 *
 * Страница рисуется оглавлением из 2054 трёхзначных рубрик — 41 КБ. Уточнений к ним ещё 12 587, и
 * они приезжают **вторым запросом**, когда рубрику раскрыли или начали искать: с ними ответ весит
 * 209 КБ, и платил бы их каждый, кто открыл раздел посмотреть один диагноз.
 *
 * **Рубрика раскрывается нажатием на саму строку**: список, внутри которого ещё есть данные,
 * обязан раскрываться нажатием на себя, а попадание в значок 20 px пальцем задачей врача не
 * является. Карточку кода открывает стрелка справа; у конечного кода раскрывать нечего, и нажатие
 * на строку ведёт прямо в карточку.
 */
export function Icd10Catalog() {
  const navigate = useNavigate();
  const { rows, isLoading, error, refetch } = useIcd10List();
  const { chapters } = useIcd10Chapters();

  const [search, setSearch] = useState('');
  const [chapter, setChapter] = useState<string>(ALL_CHAPTERS);
  const [onlyWithNote, setOnlyWithNote] = useState(false);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const specialtyFilter = useSpecialtyFilter('icd');

  /**
   * Уточнения запрашиваются, как только они кому-то понадобились, и дальше живут весь сеанс.
   *
   * Поиск считается такой надобностью наравне с раскрытием: диагноз ставится подрубрикой, и
   * справочник, отвечающий «не найдено» на «I21.4», бесполезен ровно там, где нужен.
   */
  const needChildren = expanded.size > 0 || search.trim() !== '' || onlyWithNote;
  const { children, isLoading: childrenLoading } = useIcd10Children(needChildren);

  // На телефоне таблица из пяти колонок требует бокового смахивания ради каждого поля,
  // кроме первого, — там вместо неё компактный список. Так же сделан справочник препаратов.
  const isNarrow = useMediaQuery('(max-width: 62em)');

  const { sort, toggle } = useTableSort<Icd10SortKey>(
    { key: 'code', direction: 'asc' },
    { storageKey: 'medassist:sort:icd10', keys: ICD10_SORT_KEYS },
  );

  const chapterOptions = useMemo(
    () => chapters.map((c) => ({ value: c.roman, label: `${c.roman}. ${c.name}` })),
    [chapters],
  );

  /**
   * Сортируются **рубрики**, а не строки таблицы, и только потом список разворачивается.
   *
   * Иначе подрубрика уезжает от своей рубрики: `I21.0` оказывается рядом с чужим кодом и читается
   * как самостоятельный диагноз, а не как уточнение инфаркта. Тот же принцип, что у формул в
   * таблице документа: уточнение обязано ехать вместе с тем, к чему оно относится.
   */
  const sortedRubrics = useMemo(
    () =>
      sortRows(rows, sort, (row, key) =>
        icd10SortValue({ ...row, depth: 0, children: row.childCount, expanded: false }, key),
      ),
    [rows, sort],
  );

  /**
   * Разворачивается дважды — со специальностью и без неё.
   *
   * Второй набор на экран не попадает: он нужен, чтобы сказать, сколько кодов отбор спрятал.
   * Классификация — единственное место, где цена молчания максимальна: спрятанных кодов здесь
   * двенадцать тысяч, и пустой ответ на «сахарный диабет» у кардиолога читается как «такого кода
   * нет», а не как следствие включённого тумблера.
   */
  const options = useMemo(
    () => ({
      query: search,
      chapter: chapter === ALL_CHAPTERS ? null : chapter,
      onlyWithNote,
      expanded,
    }),
    [search, chapter, onlyWithNote, expanded],
  );

  const withoutSpecialty = useMemo(
    () => flattenIcd10(sortedRubrics, children, { ...options, specialtyBlocks: null }),
    [sortedRubrics, children, options],
  );

  const sorted = useMemo(
    () =>
      specialtyFilter.active
        ? flattenIcd10(sortedRubrics, children, {
            ...options,
            specialtyBlocks: new Set(specialtyFilter.specialty?.icdBlocks ?? []),
          })
        : withoutSpecialty,
    [sortedRubrics, children, options, specialtyFilter, withoutSpecialty],
  );

  const open = (row: Icd10Row) => navigate(`/icd10/${encodeURIComponent(row.code)}`);

  const toggleExpanded = useCallback((code: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (!next.delete(code)) next.add(code);
      return next;
    });
  }, []);

  /**
   * Нажатие на строку раскрывает рубрику, а не открывает её карточку.
   *
   * Список, внутри которого ещё есть данные, обязан раскрываться нажатием на себя — этого ждут.
   * Карточка при этом никуда не делась: её открывает стрелка справа, и у конечного кода, которому
   * раскрывать нечего, нажатие на строку ведёт туда же.
   */
  const rowClick = (row: Icd10Row) => {
    if (row.depth === 0 && row.children > 0) toggleExpanded(row.code);
    else open(row);
  };

  const expandAll = () => setExpanded(new Set(rows.map((row) => row.code)));

  const total = useMemo(() => countTotal(rows), [rows]);
  const withNote = useMemo(() => rows.reduce((sum, row) => sum + (row.hasNote ? 1 : 0), 0), [rows]);

  // Пока отбирают, рубрики раскрывает сам отбор — кнопка «свернуть» в этот момент ничего бы не
  // свернула, а обещала бы обратное.
  const filtering = search.trim() !== '' || onlyWithNote;

  /**
   * В демо раздела нет — и это не поломка, а объявленное ограничение.
   *
   * Показывать здесь красную «не удалось загрузить» с кнопкой «Повторить» значило бы обещать, что
   * повтор поможет: он не поможет никогда. Пустая страница с одной честной строкой — то же, что
   * демо делает с распознаванием сканов и приглашением врача.
   */
  if (error instanceof Icd10Unavailable) {
    return (
      <Alert variant="light" color="gray" icon={<IconInfoCircle size={18} />}>
        <Text fw={600} mb={4}>
          В демо-режиме справочник МКБ-10 недоступен
        </Text>
        <Text size="sm">
          Классификация — это четырнадцать с половиной тысяч кодов на сервере, а демо работает без
          него. Поиск диагноза в карточке пациента при этом работает: его кормит короткий список
          ходовых кодов.
        </Text>
      </Alert>
    );
  }

  return (
    <Stack gap="lg">
      <Alert variant="light" color="gray" icon={<IconInfoCircle size={18} />}>
        Международная классификация болезней 10-го пересмотра целиком: {total || '14 641'} код —{' '}
        {rows.length || '2054'} трёхзначные рубрики и их подрубрики. Нажатие на рубрику раскрывает её,
        стрелка справа открывает карточку кода; поиск раскрывает рубрики сам. Справка по
        кодированию написана у {withNote || 300} рубрик и достаётся их подрубрикам; у остальных
        карточка показывает место кода в классификации и соседние коды.
      </Alert>

      <CatalogPanel
        header={
          <Group gap="sm" wrap="wrap" align="flex-end">
          <TextInput
            flex="1 1 260px"
            label="Поиск"
            placeholder="Код или наименование"
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
          />
          <Select
            w={320}
            label="Класс"
            placeholder="все классы"
            data={chapterOptions}
            value={chapter === ALL_CHAPTERS ? null : chapter}
            onChange={(value) => setChapter(value ?? ALL_CHAPTERS)}
            searchable
            clearable
          />
          <Switch
            mb={8}
            checked={onlyWithNote}
            onChange={(e) => setOnlyWithNote(e.currentTarget.checked)}
            label="Только со справкой"
          />
          <Group mb={8}>
            <SpecialtyFilterSwitch filter={specialtyFilter} />
          </Group>
          {!filtering &&
            (expanded.size > 0 ? (
              <Button
                mb={4}
                variant="default"
                leftSection={<IconFold size={16} />}
                onClick={() => setExpanded(new Set())}
              >
                Свернуть все
              </Button>
            ) : (
              <Button mb={4} variant="default" leftSection={<IconFoldDown size={16} />} onClick={expandAll}>
                Раскрыть все
              </Button>
            ))}
          </Group>
        }
      >
      <QueryState isLoading={isLoading} error={error} onRetry={refetch} what="справочник МКБ-10">
        <>
          {/* Счётчик внутри панели, а не в её шапке: он считает загруженное, и до прихода списка
              показывал бы «Кодов: 0» — верное число неверного набора. */}
          <Group gap={8} px="md" pt="sm" pb="xs">
            <ThemeIcon variant="light" color="gray" size={22} radius="sm">
              <IconListSearch size={13} />
            </ThemeIcon>
            <Text size="sm" c="dimmed">
              {sorted.length === total ? `Кодов: ${total}` : `Показано кодов: ${sorted.length} из ${total}`}
            </Text>
            <SpecialtyFilterNotice
              filter={specialtyFilter}
              hidden={withoutSpecialty.length - sorted.length}
              visible={sorted.length}
              unit={['код', 'кода', 'кодов']}
            />
            {/* Пока уточнения едут, отбор идёт по одним рубрикам — и об этом надо сказать. Список,
                молча показывающий половину справочника, читается как полный ответ. */}
            {childrenLoading && (
              <Group gap={6}>
                <Loader size={12} />
                <Text size="sm" c="dimmed">
                  подрубрики загружаются, пока показаны только рубрики
                </Text>
              </Group>
            )}
          </Group>

          {sorted.length === 0 ? (
            <Box p="xl">
              <Stack align="center" gap="sm" py="xl">
                <ThemeIcon size={48} radius="xl" variant="light" color="gray">
                  <IconX size={24} />
                </ThemeIcon>
                <Text fw={600}>Ничего не найдено</Text>
                <Text size="sm" c="dimmed" ta="center" maw={420}>
                  Под выбранные условия не подходит ни один код. Попробуйте изменить запрос или
                  снять фильтр по классу.
                </Text>
              </Stack>
            </Box>
          ) : (
            <>
              {isNarrow ? (
                <Icd10List rows={sorted} onOpen={open} onToggle={toggleExpanded} onRowClick={rowClick} />
              ) : (
                <Icd10Table
                  rows={sorted}
                  sort={sort}
                  onSort={toggle}
                  onOpen={open}
                  onToggle={toggleExpanded}
                  onRowClick={rowClick}
                />
              )}
            </>
          )}
        </>
      </QueryState>
      </CatalogPanel>
    </Stack>
  );
}
