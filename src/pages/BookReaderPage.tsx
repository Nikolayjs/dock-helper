import { useEffect, useRef, useState } from 'react';
import { ActionIcon, Button, Center, Container, Group, Loader, Stack, Text, Title } from '@mantine/core';
import { IconArrowsMaximize, IconArrowsMinimize } from '@tabler/icons-react';
import { Link, useParams } from 'react-router-dom';

import { DjvuReader } from '../features/library/DjvuReader';
import { ReaderBar } from '../features/library/ReaderBar';
import { FlowReader } from '../features/library/FlowReader';
import { ReadingSheet } from '../components/common/ReadingSheet';
import { decodeFb2Text, parseFb2 } from '../features/library/fb2';
import { PdfReader } from '../features/library/PdfReader';
import { loadBookFile, useBook } from '../features/library/useLibrary';
import { readDocx } from '../lib/docx/readDocx';
import { BackButton } from '../components/common/BackButton';
import { STICKY_TOP } from '../layouts/shellMetrics';
import { useScrollDirection } from '../components/layout/useScrollDirection';

const SAVE_DEBOUNCE_MS = 800;

export function BookReaderPage() {
  const { id } = useParams();
  const { book, updateProgress } = useBook(id);
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null);
  const [djvuData, setDjvuData] = useState<ArrayBuffer | null>(null);
  // FB2 and DOCX both end up as one HTML stream for FlowReader; only the converter differs.
  const [flowHtml, setFlowHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [immersive, setImmersive] = useState(false);
  // Панель уезжает по тому же правилу, что шапка приложения: вниз — читают, вверх — понадобилась.
  // В полноэкранном режиме страница не прокручивается вовсе, и убирать панель нечему и незачем:
  // выход из него — кнопка на ней же.
  const { visible: chromeVisible } = useScrollDirection();
  // Панель одна на все три формата, а кнопки у каждого свои — читалка кладёт их сюда порталом.
  const [toolbarSlot, setToolbarSlot] = useState<HTMLDivElement | null>(null);
  // Сколько прочитано — вместо полосы прокрутки: у потоковой читалки своей полосы больше нет
  // вовсе (страница прокручивается целиком), а сказать, где мы в книге, всё равно нужно.
  // Постраничные читалки этого не заполняют: у них номер страницы стоит в собственных кнопках,
  // между стрелками «назад» и «вперёд», и второй такой же в той же панели был бы повтором.
  const [positionLabel, setPositionLabel] = useState<string | null>(null);

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
    setFlowHtml(null);

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
        } else if (book.format === 'docx') {
          const parsed = await readDocx(new Uint8Array(buffer));
          if (!cancelled) setFlowHtml(parsed.html);
        } else {
          setFlowHtml(parseFb2(decodeFb2Text(buffer)).bodyHtml);
        }
      })
      .catch((cause) => {
        // A Word file carries its own diagnosis — "save it as .docx" is nothing the generic
        // message could say, and it is the one a doctor can act on.
        if (!cancelled) setError(cause instanceof Error && cause.message ? cause.message : 'Не удалось открыть файл книги');
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
      <ReaderBar slotRef={setToolbarSlot} top={immersive ? 0 : STICKY_TOP} hidden={!immersive && !chromeVisible}>
        <Group justify="space-between" wrap="nowrap" gap="sm">
          <BackButton fallback={{ to: `/library/${book.id}`, label: 'Назад к книге' }} />
          {/* На телефоне названия в панели нет намеренно. «Назад к книге», доля прочитанного и
              полный экран занимают ширину целиком, и названию остаётся полтора слова: замер на
              экране 390 дал «Ото…» — то есть строку, которая не называет ничего. Книгу только что
              открыли, и что это за книга, читатель знает. */}
          <Title order={5} lineClamp={1} visibleFrom="sm" style={{ textAlign: 'center', flex: 1, minWidth: 0 }}>
            {book.title}
          </Title>
          <Group gap="xs" wrap="nowrap">
            {positionLabel && (
              <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                {positionLabel}
              </Text>
            )}
            <ActionIcon
              variant="subtle"
              color="gray"
              onClick={toggleFullscreen}
              title={immersive ? 'Выйти из полноэкранного режима' : 'На весь экран'}
            >
              {immersive ? <IconArrowsMinimize size={18} /> : <IconArrowsMaximize size={18} />}
            </ActionIcon>
          </Group>
        </Group>
      </ReaderBar>

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
            toolbarSlot={toolbarSlot}
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
            toolbarSlot={toolbarSlot}
            onPageChange={(page) => handleProgress(page)}
          />
        ) : (
          <Center py={100}>
            <Loader />
          </Center>
        ))}

      {/* `miw={0}` у контейнера ниже — несущее, а не косметика. Контейнер здесь элемент
          flex-колонки, а у такого автоматический минимальный размер равен min-content: широкая
          таблица или снимок из Word поднимают его до собственного потолка контейнера, и коробка
          перестаёт помещаться в телефон. Замер на экране 390: рамка читалки 960, абзац 944, правый
          край 972 при `scrollWidth` страницы 390 — 582 px каждой строки не существовало ни при
          какой прокрутке. Та же ловушка, из-за которой у PDF появился PageScroller. */}
      {!error && (book.format === 'fb2' || book.format === 'docx') &&
        (flowHtml !== null ? (
          <Container size="md" px={0} w="100%" miw={0}>
            {/* Книга читается подряд — ей подложка нужна ровно так же, как статье. */}
            <ReadingSheet>
              <FlowReader
                bodyHtml={flowHtml}
                contentClassName={book.format === 'docx' ? 'docx-content' : 'fb2-content'}
                initialProgress={book.progress?.location ?? 0}
                immersive={immersive}
                toolbarSlot={toolbarSlot}
                onProgressChange={(fraction) => {
                  handleProgress(fraction);
                  setPositionLabel(`Прочитано ${Math.round(fraction * 100)} %`);
                }}
              />
            </ReadingSheet>
          </Container>
        ) : (
          <Center py={100}>
            <Loader />
          </Center>
        ))}
    </Stack>
  );
}
