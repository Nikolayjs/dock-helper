import { useState } from 'react';
import { ActionIcon, Badge, Card, Center, Group, Text, ThemeIcon } from '@mantine/core';
import { IconEdit, IconTrash } from '@tabler/icons-react';
import dayjs from 'dayjs';

import type { KnowledgeDocumentSummary } from './types';

interface DocumentCardProps {
  doc: KnowledgeDocumentSummary;
  icon: typeof IconEdit;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTagClick?: (tag: string) => void;
}

/**
 * Карточка статьи — единственный вид списка, которому оставлены плитки, и обложка это ровно то, чем
 * плитка оправдана: превью с картинкой. Всё, у чего в превью только текст, давно стало строками.
 *
 * **Карточки одной высоты, и это исправленное решение.** Раньше карточка была ростом со своё
 * содержимое, а место под обложку появлялось только у тех, у кого обложка есть. Замер на живом
 * списке: в одном ряду соседствовали карточки 333 и 130 px, и сетка расползалась дырами — статья
 * без картинки читалась как обрезанная. Теперь место под обложку постоянно: там, где картинки нет,
 * стоит спокойная подложка со знаком раздела, а заголовок и описание обрезаны по строкам. Пустого
 * прямоугольника, обещающего картинку, при этом не появилось — подложка нарисована, а не пуста.
 */
export function DocumentCard({ doc, icon: Icon, onOpen, onEdit, onDelete, onTagClick }: DocumentCardProps) {
  /**
   * Обложка новостной статьи — ссылка на чужой сайт, и она может перестать открываться: сайт
   * переложил картинку, лента убрала. Битый значок картинки на карточке выглядит поломкой
   * приложения, поэтому неоткрывшаяся обложка просто исчезает — как в читалке новостей.
   */
  const [coverBroken, setCoverBroken] = useState(false);
  const cover = coverBroken ? null : doc.coverDataUrl;

  return (
    <Card
      withBorder
      padding="md"
      h="100%"
      style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column' }}
      onClick={onOpen}
    >
      <Card.Section mb="md">
        {cover ? (
          <img
            src={cover}
            alt=""
            onError={() => setCoverBroken(true)}
            style={{ display: 'block', width: '100%', height: 160, objectFit: 'cover' }}
          />
        ) : (
          /* Место под обложку занято всегда — иначе ряд карточек расползается по высоте. Здесь не
             пустой прямоугольник, а подложка со знаком раздела: она ничего не обещает. */
          <Center h={160} bg="var(--app-stripe-bg)">
            <ThemeIcon variant="light" color="brand" size={44} radius="md">
              <Icon size={22} />
            </ThemeIcon>
          </Center>
        )}
      </Card.Section>
      <Group justify="space-between" align="flex-start" mb="xs" wrap="nowrap">
        <Group gap={8} wrap="nowrap" style={{ minWidth: 0 }}>
          <ThemeIcon variant="light" color="brand" size={32} radius="md">
            <Icon size={17} />
          </ThemeIcon>
          {/* Две строки, а не многоточие в одну: длинные названия статей — норма, и обрезанное на
              середине слова название хуже читается, чем перенесённое. */}
          <Text fw={600} size="sm" lineClamp={2}>
            {doc.title}
          </Text>
        </Group>
        <Group gap={2} wrap="nowrap" onClick={(e) => e.stopPropagation()}>
          <ActionIcon variant="subtle" color="gray" size="sm" onClick={onEdit}>
            <IconEdit size={14} />
          </ActionIcon>
          <ActionIcon variant="subtle" color="red" size="sm" onClick={onDelete}>
            <IconTrash size={14} />
          </ActionIcon>
        </Group>
      </Group>

      <Text size="sm" c="dimmed" lineClamp={2} mb="sm">
        {doc.summary}
      </Text>

      {doc.tags.length > 0 && (
        <Group gap={6} mb="sm" wrap="nowrap" style={{ overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
          {doc.tags.map((tag) => (
            <Badge
              key={tag}
              size="xs"
              variant="light"
              color="gray"
              style={onTagClick ? { cursor: 'pointer' } : undefined}
              onClick={() => onTagClick?.(tag)}
            >
              {tag}
            </Badge>
          ))}
        </Group>
      )}

      <Group justify="space-between" mt="auto">
        <Text size="xs" c="dimmed" truncate style={{ maxWidth: '55%' }}>
          {doc.author}
        </Text>
        <Text size="xs" c="dimmed">
          {dayjs(doc.updatedAt).format('D MMMM YYYY')}
        </Text>
      </Group>
    </Card>
  );
}
