import { useState } from 'react';
import { Alert, Anchor, Badge, Button, Card, Group, Loader, Stack, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconBookmark, IconBookmarkFilled, IconExternalLink, IconInfoCircle } from '@tabler/icons-react';
import { useSearchParams } from 'react-router-dom';

import { useDocuments } from '../features/knowledgeBase/useDocuments';
import { useArticleFullText } from '../features/newsFeed/useArticleFullText';
import './articleContent.css';
import { BackButton } from '../components/common/BackButton';
import { SafeHtml } from '../components/common/SafeHtml';

const SUMMARY_MAX_LENGTH = 200;

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trimEnd()}…`;
}

/** `publishedDate` is either an ISO timestamp or already human-readable text pulled from the page — format only the former. */
function formatPublishedDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function NewsReaderPage() {
  const [params] = useSearchParams();
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [showSourceFrame, setShowSourceFrame] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedUrl, setSavedUrl] = useState<string | null>(null);

  const url = params.get('url') ?? '';
  const title = params.get('title') ?? 'Статья';
  const source = params.get('source') ?? '';
  const isSaved = savedUrl === url;

  const { article, isLoading, isError, errorMessage } = useArticleFullText(url);
  const { addDocument } = useDocuments('article');

  const handleSaveAsArticle = async () => {
    setIsSaving(true);
    try {
      await addDocument({
        kind: 'article',
        title: article?.title || title,
        summary: article?.textContent ? truncate(article.textContent, SUMMARY_MAX_LENGTH) : '',
        content: article?.contentHtml || `<p><a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a></p>`,
        tags: source ? [source] : [],
        author: article?.byline || source || 'Новостная лента',
      });
      setSavedUrl(url);
      notifications.show({ message: 'Статья сохранена в базу знаний', color: 'teal' });
    } catch {
      notifications.show({ message: 'Не удалось сохранить статью', color: 'red' });
    } finally {
      setIsSaving(false);
    }
  };

  if (!url) {
    return (
      <Stack gap="lg">
        <Alert color="orange" icon={<IconInfoCircle size={18} />} title="Ссылка не указана">
          Вернитесь к списку новостей и откройте статью из карточки.
        </Alert>
        <BackButton fallback={{ to: '/news', label: 'К новостям' }} />
      </Stack>
    );
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between" wrap="wrap" gap="sm">
        <BackButton fallback={{ to: '/news', label: 'К новостям' }} />
        <Group gap="sm">
          <Button
            variant={isSaved ? 'light' : 'default'}
            color={isSaved ? 'teal' : undefined}
            leftSection={
              isSaving ? <Loader size={16} /> : isSaved ? <IconBookmarkFilled size={16} /> : <IconBookmark size={16} />
            }
            onClick={handleSaveAsArticle}
            disabled={isSaving || isSaved}
          >
            {isSaved ? 'Сохранено' : 'Сохранить как статью'}
          </Button>
          <Button component="a" href={url} target="_blank" rel="noopener noreferrer" variant="light" leftSection={<IconExternalLink size={16} />}>
            Открыть в источнике
          </Button>
        </Group>
      </Group>

      <Card withBorder padding="lg">
        <Group gap={8} mb={4}>
          {source && (
            <Badge variant="light" color="brand">
              {source}
            </Badge>
          )}
        </Group>
        <Title order={4} mb={4}>
          {article?.title || title}
        </Title>
        {(article?.byline || article?.publishedDate) && (
          <Text size="xs" c="dimmed" mb="md">
            {[article?.byline, formatPublishedDate(article?.publishedDate)].filter(Boolean).join(' · ')}
          </Text>
        )}

        {article?.leadImage && !showSourceFrame && (
          <img
            src={article.leadImage}
            alt=""
            onError={(event) => {
              event.currentTarget.style.display = 'none';
            }}
            style={{ width: '100%', maxHeight: 360, objectFit: 'cover', borderRadius: 8, marginBottom: 16 }}
          />
        )}

        {isLoading && (
          <Group gap="xs" py="xl" justify="center">
            <Loader size="sm" />
            <Text size="sm" c="dimmed">
              Извлекаем текст статьи…
            </Text>
          </Group>
        )}

        {!isLoading && article && !showSourceFrame && (
          <>
            <SafeHtml className="article-content" html={article.contentHtml} />
            <Button variant="subtle" color="gray" size="xs" mt="md" onClick={() => setShowSourceFrame(true)}>
              Показать оригинал страницы вместо извлечённого текста
            </Button>
          </>
        )}

        {!isLoading && (isError || showSourceFrame) && (
          <>
            {isError && (
              <Alert color="orange" variant="light" icon={<IconInfoCircle size={16} />} mb="md">
                {errorMessage ?? 'Не удалось извлечь текст статьи.'} Показана страница источника напрямую — если издание
                запрещает такой показ, она может остаться пустой.
              </Alert>
            )}
            <div style={{ position: 'relative', minHeight: 600 }}>
              {!iframeLoaded && (
                <Stack align="center" justify="center" gap="xs" style={{ position: 'absolute', inset: 0 }}>
                  <Text size="sm" c="dimmed">
                    Загрузка страницы источника…
                  </Text>
                </Stack>
              )}
              <iframe
                src={url}
                title={title}
                onLoad={() => setIframeLoaded(true)}
                referrerPolicy="no-referrer"
                sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-popups-to-escape-sandbox"
                style={{
                  width: '100%',
                  height: '80vh',
                  border: '1px solid var(--mantine-color-default-border)',
                  borderRadius: 12,
                  backgroundColor: 'var(--mantine-color-body)',
                }}
              />
            </div>
          </>
        )}

        <Text size="xs" c="dimmed" mt="md">
          Источник:{' '}
          <Anchor href={url} target="_blank" rel="noopener noreferrer" size="xs">
            {url}
          </Anchor>
        </Text>
      </Card>
    </Stack>
  );
}
