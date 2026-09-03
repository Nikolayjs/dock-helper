import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Anchor, Badge, Box, Button, Group, Stack, Text, TextInput, ThemeIcon } from '@mantine/core';
import { IconBrowserPlus, IconExternalLink, IconInbox, IconSearch } from '@tabler/icons-react';

import { CatalogPanel } from '../../components/common/CatalogPanel';
import { DataTable } from '../../components/common/DataTable';
import type { DataColumn } from '../../components/common/DataTable';
import { QueryState } from '../../components/common/QueryState';
import { sortRows, useTableSort } from '../../lib/tableSort';
import { useDeleteWithConfirm } from '../deletion/deleteConfirmContext';
import { CLIP_TARGET_LABELS, publishedHref, type Clip } from './types';
import { QUERY_KEY, useClips } from './useClips';

type SortKey = 'title' | 'target' | 'status' | 'saved';

const TARGET_COLORS: Record<Clip['target'], string> = {
  article: 'brand',
  disease: 'grape',
  drug: 'teal',
};

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * «Входящие»: то, что расширение принесло и что ещё не легло в справочник.
 *
 * Черновики и опубликованное лежат в одном списке, и опубликованное не прячется намеренно: клип —
 * это след «откуда взялась эта запись», и он единственный, кто помнит первоисточник после того, как
 * текст в справочнике поправили. Но черновики стоят выше при любой сортировке: список существует
 * ради того, что ещё требует решения.
 */
export function InboxPage() {
  const { clips, isLoading, error, refetch, deleteClip } = useClips();
  const confirmDelete = useDeleteWithConfirm();
  const [search, setSearch] = useState('');
  const { sort, toggle } = useTableSort<SortKey>({ key: 'saved', direction: 'desc' });

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return clips;
    return clips.filter(
      (clip) =>
        clip.title.toLowerCase().includes(needle) ||
        clip.excerpt.toLowerCase().includes(needle) ||
        clip.sourceUrl.toLowerCase().includes(needle),
    );
  }, [clips, search]);

  const sorted = useMemo(() => {
    const rows = sortRows(filtered, sort, (clip, key) => {
      if (key === 'title') return clip.title;
      if (key === 'target') return CLIP_TARGET_LABELS[clip.target];
      if (key === 'status') return clip.status;
      return clip.createdAt;
    });
    // Черновики впереди при любой сортировке — иначе разобранное вытесняет то, ради чего заходят.
    return [...rows].sort((a, b) => (a.status === b.status ? 0 : a.status === 'draft' ? -1 : 1));
  }, [filtered, sort]);

  const drafts = clips.filter((clip) => clip.status === 'draft').length;
  const isFiltering = search.trim().length > 0;

  const columns: DataColumn<Clip, SortKey>[] = [
    {
      key: 'title',
      header: 'Что сохранено',
      compact: true,
      miw: 260,
      render: (clip) => (
        <div style={{ minWidth: 0 }}>
          <Anchor component={Link} to={`/inbox/${clip.id}`} state={{ from: '/inbox' }} fw={500}>
            {clip.title}
          </Anchor>
          <Text size="xs" c="dimmed" lineClamp={1}>
            {clip.excerpt}
          </Text>
        </div>
      ),
    },
    {
      key: 'target',
      header: 'Куда',
      compact: true,
      w: 140,
      render: (clip) => (
        <Badge variant="light" color={TARGET_COLORS[clip.target]}>
          {CLIP_TARGET_LABELS[clip.target]}
        </Badge>
      ),
    },
    {
      header: 'Источник',
      miw: 160,
      stopClick: true,
      render: (clip) => (
        <Group gap={4} wrap="nowrap">
          <Text size="sm" c="dimmed" truncate>
            {clip.siteName || hostOf(clip.sourceUrl)}
          </Text>
          <Anchor href={clip.sourceUrl} target="_blank" rel="noopener noreferrer" aria-label="Открыть источник">
            <IconExternalLink size={14} />
          </Anchor>
        </Group>
      ),
    },
    {
      key: 'status',
      header: 'Состояние',
      w: 150,
      stopClick: true,
      render: (clip) =>
        clip.status === 'draft' ? (
          <Badge variant="light" color="gray">
            Черновик
          </Badge>
        ) : (
          <Anchor component={Link} to={publishedHref(clip)} size="sm">
            Опубликовано
          </Anchor>
        ),
    },
    {
      key: 'saved',
      header: 'Сохранено',
      w: 120,
      render: (clip) => (
        <Text size="sm" c="dimmed">
          {new Date(clip.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
        </Text>
      ),
    },
    {
      w: 110,
      stopClick: true,
      render: (clip) => (
        <Button
          variant="subtle"
          color="red"
          size="compact-sm"
          onClick={() =>
            confirmDelete({
              what: 'клип',
              name: clip.title,
              notice: 'Клип удалён',
              queryKey: QUERY_KEY,
              id: clip.id,
              perform: () => deleteClip(clip.id),
            })
          }
        >
          Удалить
        </Button>
      ),
    },
  ];

  return (
    <CatalogPanel
      header={
        <Group justify="space-between" align="flex-end" wrap="wrap">
          <Text c="dimmed" size="sm">
            {isFiltering
              ? `Найдено: ${sorted.length} из ${clips.length}`
              : drafts > 0
                ? `Ждут решения: ${drafts}`
                : `Сохранено: ${clips.length}`}
          </Text>
          <TextInput
            placeholder="Заголовок, текст, адрес"
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
            w={300}
          />
        </Group>
      }
    >
      <QueryState isLoading={isLoading} error={error} onRetry={refetch} what="сохранённые страницы">
        {clips.length === 0 ? (
          /*
            Пустое состояние объясняет, чего не хватает, а не сообщает о пустоте: «Входящие» пусты и
            у того, кто расширение ещё не подключил, и у того, кто всё разобрал, — а это разные
            новости, и первому нужна дорога, а не констатация.
          */
          <Box p="xl">
            <Stack align="center" gap="sm" py="xl">
              <ThemeIcon size={48} radius="xl" variant="light" color="gray">
                <IconInbox size={24} />
              </ThemeIcon>
              <Text fw={600}>Пока ничего не сохранено</Text>
              <Text size="sm" c="dimmed" ta="center" maw={460}>
                Расширение MedAssist Clipper сохраняет сюда статьи и страницы о болезнях и препаратах — в один
                щелчок, не покидая сайт. Отсюда вы решаете, куда их положить.
              </Text>
              <Button component={Link} to="/doctor" variant="light" leftSection={<IconBrowserPlus size={16} />} mt="xs">
                Подключить браузер
              </Button>
            </Stack>
          </Box>
        ) : sorted.length === 0 ? (
          <Box p="xl">
            <Stack align="center" gap="sm" py="xl">
              <Text fw={600}>Ничего не найдено</Text>
              <Text size="sm" c="dimmed">
                По запросу «{search.trim()}» среди сохранённого совпадений нет.
              </Text>
            </Stack>
          </Box>
        ) : (
          <DataTable
            rows={sorted}
            columns={columns}
            rowKey={(clip) => clip.id}
            sort={sort}
            onSort={toggle}
            minWidth={900}
          />
        )}
      </QueryState>
    </CatalogPanel>
  );
}
