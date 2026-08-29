import { Badge, Button, Container, Group, Loader, Stack, Text, Title, Typography } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconDownload, IconEdit, IconTrash } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { Link, useNavigate, useParams } from 'react-router-dom';

import './editorContent.css';
import { downloadDocx } from '../../lib/docx/downloadDocx';
import type { KnowledgeKind } from './types';
import { useAllDocuments, useDocuments, useKnowledgeDocument } from './useDocuments';
import { renderWikiLinks } from './wikiLinks';
import { BackButton } from '../../components/common/BackButton';
import { ReadingSheet } from '../../components/common/ReadingSheet';

interface KnowledgeViewPageProps {
  kind: KnowledgeKind;
  basePath: string;
  notFoundText: string;
  backLabel: string;
  deletedMessage: string;
}

export function KnowledgeViewPage({ kind, basePath, notFoundText, backLabel, deletedMessage }: KnowledgeViewPageProps) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { documents, deleteDocument } = useDocuments(kind);
  const { documents: allDocuments } = useAllDocuments();
  // Список приходит без текстов, поэтому шапка (название, теги, дата) берётся из него и рисуется
  // сразу, а тело документа дочитывается отдельным запросом — страница не мигает пустотой.
  const doc = documents.find((d) => d.id === id);
  const { document: full, isLoading: contentLoading } = useKnowledgeDocument(doc?.id);

  if (!doc) {
    return (
      <Container size="md" px={0}>
        <Stack align="center" gap="sm" py={100}>
          <Text fw={600}>{notFoundText}</Text>
          <Button component={Link} to={basePath} mt="md">
            {backLabel}
          </Button>
        </Stack>
      </Container>
    );
  }

  const handleDelete = () => {
    deleteDocument(doc.id);
    notifications.show({ message: deletedMessage, color: 'gray' });
    navigate(basePath);
  };

  return (
    <Container size="md" px={0}>
      <Stack gap="lg">
        <Group justify="space-between" wrap="wrap">
          <BackButton fallback={{ to: basePath, label: backLabel }} />
          <Group gap="xs">
            <Button variant="subtle" color="red" leftSection={<IconTrash size={16} />} onClick={handleDelete}>
              Удалить
            </Button>
            <Button
              variant="subtle"
              leftSection={<IconDownload size={16} />}
              /* The stored HTML, not the rendered one: wiki links resolve to routes of this app,
                 which mean nothing in a file someone opens in Word. */
              onClick={() => full && void downloadDocx({ title: doc.title, author: doc.author, html: full.content })}
              disabled={!full}
            >
              Скачать .docx
            </Button>
            <Button variant="light" leftSection={<IconEdit size={16} />} onClick={() => navigate(`${basePath}/${doc.id}/edit`)}>
              Редактировать
            </Button>
          </Group>
        </Group>

        {/* Название, теги и дата — часть документа, поэтому лежат на той же подложке, что и текст:
            иначе заголовок оставался бы на обоях, то есть ровно там, где его хуже всего видно.
            Снаружи остаются только действия над документом — они относятся к странице, не к тексту. */}
        <ReadingSheet>
          <Title order={2}>{doc.title}</Title>
          {doc.tags.length > 0 && (
            <Group gap={6} mt={10}>
              {doc.tags.map((tag) => (
                <Badge
                  key={tag}
                  size="sm"
                  variant="light"
                  color="gray"
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/knowledge/tag/${encodeURIComponent(tag)}`)}
                >
                  {tag}
                </Badge>
              ))}
            </Group>
          )}
          <Text size="xs" c="dimmed" mt={8} mb="lg">
            {doc.author} · {dayjs(doc.updatedAt).format('D MMMM YYYY')}
          </Text>

          {contentLoading || !full ? (
            <Group justify="center" py="xl">
              <Loader size="sm" />
            </Group>
          ) : (
            <Typography>
              <div
                dangerouslySetInnerHTML={{ __html: renderWikiLinks(full.content, allDocuments) }}
                onClick={(e) => {
                  const link = (e.target as HTMLElement).closest('[data-doc-link]');
                  const href = link?.getAttribute('href');
                  if (href) {
                    e.preventDefault();
                    navigate(href);
                  }
                }}
              />
            </Typography>
          )}
        </ReadingSheet>
      </Stack>
    </Container>
  );
}
