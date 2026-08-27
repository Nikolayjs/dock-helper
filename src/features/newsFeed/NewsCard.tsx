import { Anchor, Badge, Card, Group, Image, Stack, Text } from '@mantine/core';
import { IconArrowRight } from '@tabler/icons-react';
import dayjs from 'dayjs';

import type { NewsFeedItem } from './types';

interface NewsCardProps {
  item: NewsFeedItem;
  onOpen: () => void;
}

export function NewsCard({ item, onOpen }: NewsCardProps) {
  const date = item.pubDate && dayjs(item.pubDate).isValid() ? dayjs(item.pubDate) : null;

  return (
    <Card
      component="button"
      type="button"
      onClick={onOpen}
      withBorder
      padding="md"
      h="100%"
      style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', cursor: 'pointer' }}
    >
      {item.thumbnail && (
        <Card.Section mb="sm">
          <Image src={item.thumbnail} h={140} fit="cover" fallbackSrc="" alt="" loading="lazy" />
        </Card.Section>
      )}

      <Stack gap={6} style={{ flex: 1 }}>
        {/* Ужимается название ленты, а не дата. Имя источника бывает длиной в строку —
            «CYBERSPORT.RU — новости киберспорта и компьютерных игр», — и с несжимаемым бейджем
            дата уезжала за край карточки. Дата коротка и постоянна, название и в обрезанном виде
            узнаётся по началу; целиком его показывает подсказка. */}
        <Group gap={6} justify="space-between" wrap="nowrap">
          <Badge size="xs" variant="light" color="brand" title={item.sourceTitle} style={{ minWidth: 0, flexShrink: 1 }}>
            {item.sourceTitle}
          </Badge>
          {date && (
            <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
              {date.format('D MMMM')}
            </Text>
          )}
        </Group>

        <Text fw={600} size="sm" lineClamp={3}>
          {item.title}
        </Text>

        {item.excerpt && (
          <Text size="xs" c="dimmed" lineClamp={3}>
            {item.excerpt}
          </Text>
        )}

        <Anchor component="span" size="xs" c="brand" mt="auto" pt={4}>
          <Group gap={4} wrap="nowrap">
            Открыть статью
            <IconArrowRight size={12} />
          </Group>
        </Anchor>
      </Stack>
    </Card>
  );
}
