import { useEffect, useRef, useState } from 'react';
import { ActionIcon, Button, Center, Container, Group, Loader, Stack, Text, Title } from '@mantine/core';
import { IconArrowLeft, IconArrowsMaximize, IconArrowsMinimize } from '@tabler/icons-react';
import { Link, useParams } from 'react-router-dom';

import { DjvuReader } from '../features/library/DjvuReader';
import { Fb2Reader } from '../features/library/Fb2Reader';
import { decodeFb2Text, parseFb2, type Fb2Content } from '../features/library/fb2';
import { PdfReader } from '../features/library/PdfReader';
import { loadBookFile, useBook } from '../features/library/useLibrary';

const SAVE_DEBOUNCE_MS = 800;

export function BookReaderPage() {
  const { id } = useParams();
  const { book, updateProgress } = useBook(id);
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null);
  const [djvuData, setDjvuData] = useState<ArrayBuffer | null>(null);
  const [fb2Content, setFb2Content] = useState<Fb2Content | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [immersive, setImmersive] = useState(false);

  const progressRef = useRef<number | null>(null);
  const saveTimeoutRef = useRef<number | undefined>(undefined);
  const pageRef = useRef<HTMLDivElement>(null);

  // Fullscreen (not just "hide the reader's own toolbar") takes the whole app shell — sidebar,
  // topbar — off screen too, the same way F11 does for the browser itself: the Fullscreen API only
  // shows the requested element, so putting the whole page (not just the reader) into it is enough.
  useEffect(() => {
    const handleFullscreenChange = () => setImmersive(document.fullscreenElement === pageRef.current);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void pageRef.current?.requestFullscreen();
    }
  };

  useEffect(() => {
    if (!book) return;
    let cancelled = false;
    setError(null);
    setPdfData(null);
    setDjvuData(null);
    setFb2Content(null);

    loadBookFile(book.id)
      .then(async (blob) => {
        if (cancelled) return;
        if (!blob) {
          setError('Файл книги не найден. Возможно, он был удалён из хранилища браузера.');
          return;
        }
        const buffer = await blob.arrayBuffer();
        if (cancelled) return;
        if (book.format === 'pdf') {
          setPdfData(buffer);
        } else if (book.format === 'djvu') {
          setDjvuData(buffer);
        } else {
          setFb2Content(parseFb2(decodeFb2Text(buffer)));
        }
      })
      .catch(() => {
        if (!cancelled) setError('Не удалось открыть файл книги');
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book?.id, book?.format]);

  useEffect(() => {
    return () => {
      window.clearTimeout(saveTimeoutRef.current);
      if (book && progressRef.current !== null) {
        updateProgress(book.id, progressRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book?.id]);

  const handleProgress = (location: number) => {
    progressRef.current = location;
    if (!book) return;
    window.clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = window.setTimeout(() => {
      updateProgress(book.id, location);
    }, SAVE_DEBOUNCE_MS);
  };

  if (!book) {
    return (
      <Container size="md" px={0}>
        <Stack align="center" gap="sm" py={100}>
          <Text fw={600}>Книга не найдена</Text>
          <Button component={Link} to="/library" mt="md">
            К библиотеке
          </Button>
        </Stack>
      </Container>
    );
  }

  return (
    <Stack
      ref={pageRef}
      gap="md"
      style={immersive ? { background: 'var(--mantine-color-body)', minHeight: '100vh', padding: 'var(--mantine-spacing-lg)' } : undefined}
    >
      <Group justify="space-between" wrap="wrap" gap="sm">
        <Button component={Link} to={`/library/${book.id}`} variant="subtle" leftSection={<IconArrowLeft size={16} />} pl={8}>
          Назад к книге
        </Button>
        <Title order={4} lineClamp={1} style={{ maxWidth: 420, textAlign: 'center' }}>
          {book.title}
        </Title>
        <ActionIcon
          variant="subtle"
          color="gray"
          onClick={toggleFullscreen}
          title={immersive ? 'Выйти из полноэкранного режима' : 'На весь экран'}
        >
          {immersive ? <IconArrowsMinimize size={18} /> : <IconArrowsMaximize size={18} />}
        </ActionIcon>
      </Group>

      {error && (
        <Center py={80}>
          <Text c="red">{error}</Text>
        </Center>
      )}

      {!error && book.format === 'pdf' &&
        (pdfData ? (
          <PdfReader
            data={pdfData}
            initialPage={book.progress?.location ?? 1}
            immersive={immersive}
            onPageChange={(page) => handleProgress(page)}
          />
        ) : (
          <Center py={100}>
            <Loader />
          </Center>
        ))}

      {!error && book.format === 'djvu' &&
        (djvuData ? (
          <DjvuReader
            data={djvuData}
            initialPage={book.progress?.location ?? 1}
            immersive={immersive}
            onPageChange={(page) => handleProgress(page)}
          />
        ) : (
          <Center py={100}>
            <Loader />
          </Center>
        ))}

      {!error && book.format === 'fb2' &&
        (fb2Content ? (
          <Container size="md" px={0}>
            <Fb2Reader
              bodyHtml={fb2Content.bodyHtml}
              initialProgress={book.progress?.location ?? 0}
              immersive={immersive}
              onProgressChange={(fraction) => handleProgress(fraction)}
            />
          </Container>
        ) : (
          <Center py={100}>
            <Loader />
          </Center>
        ))}
    </Stack>
  );
}
