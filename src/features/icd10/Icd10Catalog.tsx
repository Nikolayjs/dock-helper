import { useMemo, useState } from 'react';
import { Alert, Card, Group, Select, Stack, Switch, Text, TextInput, ThemeIcon } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconInfoCircle, IconListSearch, IconSearch, IconX } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';

import { QueryState } from '../../components/common/QueryState';
import { sortRows, useTableSort } from '../../lib/tableSort';
import { ICD10_SORT_KEYS, Icd10Table, icd10SortValue, type Icd10SortKey } from './Icd10Table';
import { Icd10List } from './Icd10List';
import { countTotal, flattenIcd10 } from './flatten';
import type { Icd10Row } from './types';
import { Icd10Unavailable, useIcd10Chapters, useIcd10List } from './useIcd10';

const ALL_CHAPTERS = '__all__';

/**
 * Оглавление МКБ-10.
 *
 * Показываются 2054 трёхзначные рубрики — столько же строк, сколько в справочнике препаратов.
 * Подрубрик ещё 12 587, и все они видны на карточке своей рубрики: они отличаются локализацией или
 * уточнением, а не сутью, и плоский список из четырнадцати тысяч строк не оглавление, а свалка.
 *
 * Поиск идёт по коду и наименованию **среди рубрик**. Найти конкретную подрубрику можно строкой
 * поиска в шапке приложения — она спрашивает сервер и ищет по всем кодам.
 */
export function Icd10Catalog() {
  const navigate = useNavigate();
  const { rows, isLoading, error, refetch } = useIcd10List();
  const { chapters } = useIcd10Chapters();

  const [search, setSearch] = useState('');
  const [chapter, setChapter] = useState<string>(ALL_CHAPTERS);
  const [onlyWithNote, setOnlyWithNote] = useState(false);
  // Подрубрики показаны сразу: диагноз ставится именно ими, а оглавление из одних рубрик —
  // это половина справочника. Свернуть их можно, когда нужен обзор классов.
  const [showChildren, setShowChildren] = useState(true);

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
    () => sortRows(rows, sort, (row, key) => icd10SortValue({ ...row, depth: 0, children: row.children.length }, key)),
    [rows, sort],
  );

  const sorted = useMemo(
    () =>
      flattenIcd10(sortedRubrics, {
        query: search,
        chapter: chapter === ALL_CHAPTERS ? null : chapter,
        onlyWithNote,
        showChildren,
      }),
    [sortedRubrics, search, chapter, onlyWithNote, showChildren],
  );

  const open = (row: Icd10Row) => navigate(`/icd10/${encodeURIComponent(row.code)}`);
  const total = useMemo(() => countTotal(rows), [rows]);
  const withNote = useMemo(
    () => rows.reduce((sum, row) => sum + (row.hasNote ? 1 : 0), 0),
    [rows],
  );

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
        Международная классификация болезней 10-го пересмотра целиком: {total || '14 641'} код —
        {' '}{rows.length || '2054'} трёхзначные рубрики и их подрубрики. Справка по кодированию
        написана у {withNote || 300} рубрик и достаётся их подрубрикам; у остальных карточка
        показывает место кода в классификации и соседние коды.
      </Alert>

      <Card withBorder padding="md">
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
            checked={showChildren}
            onChange={(e) => setShowChildren(e.currentTarget.checked)}
            label="Подрубрики"
          />
          <Switch
            mb={8}
            checked={onlyWithNote}
            onChange={(e) => setOnlyWithNote(e.currentTarget.checked)}
            label="Только со справкой"
          />
        </Group>
      </Card>

      <QueryState isLoading={isLoading} error={error} onRetry={refetch} what="справочник МКБ-10">
        <>
          <Group gap={8}>
            <ThemeIcon variant="light" color="gray" size={22} radius="sm">
              <IconListSearch size={13} />
            </ThemeIcon>
            <Text size="sm" c="dimmed">
              {sorted.length === total
                ? `Кодов: ${total}`
                : `Показано кодов: ${sorted.length} из ${total}`}
            </Text>
          </Group>

          {/* Таблица лежит на сплошной подложке, как справочник препаратов: под обоями строки без
              неё читаются прямо по фотографии. `padding={0}` — таблица сама держит свои отступы. */}
          {sorted.length === 0 ? (
            <Card withBorder padding="xl">
              <Stack align="center" gap="sm" py="xl">
                <ThemeIcon size={48} radius="xl" variant="light" color="gray">
                  <IconX size={24} />
                </ThemeIcon>
                <Text fw={600}>Ничего не найдено</Text>
                <Text size="sm" c="dimmed" ta="center" maw={420}>
                  Под выбранные условия не подходит ни один код. Попробуйте изменить запрос, снять
                  фильтр по классу или включить подрубрики.
                </Text>
              </Stack>
            </Card>
          ) : (
            <Card withBorder padding={0}>
              {isNarrow ? (
                <Icd10List rows={sorted} onOpen={open} />
              ) : (
                <Icd10Table rows={sorted} sort={sort} onSort={toggle} onOpen={open} />
              )}
            </Card>
          )}
        </>
      </QueryState>
    </Stack>
  );
}
