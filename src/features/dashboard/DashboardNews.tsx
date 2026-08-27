import { Group, Loader, Stack, Text, UnstyledButton } from '@mantine/core';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';

import type { NewsFeedItem } from '../newsFeed/types';
import { useNewsFeedItems } from '../newsFeed/useNewsFeedItems';
import { useNewsFeedSources } from '../newsFeed/useNewsFeedSources';
import linkClasses from './dashboardLinks.module.css';

/**
 * Свежие новости, одним списком поверх всех подключённых лент.
 *
 * Данные тянет сам, а не получает из общего контекста дашборда, как остальные карточки. У тех
 * причина общая — один список пациентов кормит восемь виджетов, и считать его восемь раз незачем.
 * Здесь наоборот: это единственный виджет, который ходит **в сеть**, за шесть RSS-лент. Загрузка
 * внутри компонента означает, что скрытая карточка не стоит ни одного запроса.
 *
 * Кеш общий со страницей новостей (`staleTime` 15 минут), так что открытая следом лента не
 * перезагружается.
 */
interface DashboardNewsProps {
  /** Сколько новостей показать. Больше пятнадцати карточка перестаёт быть сводкой. */
  limit?: number;
}

function whenLabel(item: NewsFeedItem): string | null {
  if (!item.pubDate) return null;
  const date = dayjs(item.pubDate);
  if (!date.isValid()) return null;

  const hoursAgo = dayjs().diff(date, 'hour');
  if (hoursAgo < 1) return 'только что';
  if (hoursAgo < 24) return `${hoursAgo} ч назад`;
  if (date.isSame(dayjs().subtract(1, 'day'), 'day')) return 'вчера';
  return date.format('D MMMM');
}

export function DashboardNews({ limit = 12 }: DashboardNewsProps) {
  const navigate = useNavigate();
  const { sources } = useNewsFeedSources();
  const { allItems, isLoading } = useNewsFeedItems(sources);

  const open = (item: NewsFeedItem) => {
    const params = new URLSearchParams({ url: item.link, title: item.title, source: item.sourceTitle });
    navigate(`/news/read?${params.toString()}`, { state: { from: '/dashboard' } });
  };

  if (isLoading && allItems.length === 0) {
    return (
      <Group justify="center" py="lg">
        <Loader size="sm" />
      </Group>
    );
  }

  if (allItems.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        Ленты пока молчат. Источники настраиваются в разделе «Новости медицины».
      </Text>
    );
  }

  return (
    <Stack gap="sm">
      {allItems.slice(0, limit).map((item) => {
        const when = whenLabel(item);
        return (
          // Подсветка на всей строке, а не на одном заголовке: подпись с источником и временем —
          // часть той же ссылки, и нажатие по ней должно открывать новость.
          <UnstyledButton key={item.id} className={linkClasses.row} onClick={() => open(item)} ta="left">
            <Text size="sm" fw={500} lineClamp={2}>
              {item.title}
            </Text>
            <Text size="xs" c="dimmed">
              {item.sourceTitle}
              {when ? ` · ${when}` : ''}
            </Text>
          </UnstyledButton>
        );
      })}
    </Stack>
  );
}
