import { useCallback, useEffect, useRef, useState } from 'react';
import { ActionIcon, Center, Group, Loader, Stack, Text, Tooltip } from '@mantine/core';
import { IconArrowAutofitWidth, IconChevronLeft, IconChevronRight, IconMinus, IconPlus } from '@tabler/icons-react';

import { loadDjvuDocument, type DjvuDocumentHandle, type DjvuPageSizeInfo } from './djvuMeta';
import { PageScroller } from './PageScroller';
import { ToolbarSlot } from './ReaderBar';
import { DJVU_ZOOM_MAX, DJVU_ZOOM_MIN, getDjvuZoom, setDjvuZoom } from './readerPrefs';
import { useElementWidth, useReaderZoom } from './readerZoom';

interface DjvuReaderProps {
  data: ArrayBuffer;
  initialPage?: number;
  /** Hides the page-navigation and zoom toolbar, for distraction-free reading on small screens. */
  immersive?: boolean;
  onPageChange?: (page: number, pageCount: number) => void;
  /** Место в панели читалки под её кнопки; без него они рисуются на месте, над рамкой. */
  toolbarSlot?: HTMLElement | null;
  /** Высота рамки. По умолчанию — три четверти окна, страница задаёт «до низа экрана». */
  maxHeight?: string;
  /** Сколько сверху занимает лежащая на листе панель. */
  topInset?: number;
  /** Прокручивается рамка, а не страница: наружу она нужна тому, кто следит за направлением. */
  onFrame?: (element: HTMLDivElement | null) => void;
}

/** How far outside the viewport a page's image starts rendering, so scrolling never shows a blank page. */
const RENDER_MARGIN = '1000px 0px';
/** The library's own convention for "100%": a page's real size is its pixels at this many dots per inch. */
const CSS_DPI = 96;

interface DjvuPageProps {
  handle: DjvuDocumentHandle;
  pageNumber: number;
  nativeSize: DjvuPageSizeInfo;
  scale: number;
  registerVisibility: (pageNumber: number, ratio: number) => void;
}

function DjvuPage({ handle, pageNumber, nativeSize, scale, registerVisibility }: DjvuPageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldRender, setShouldRender] = useState(false);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setShouldRender(true);
          registerVisibility(pageNumber, entry.intersectionRatio);
        }
      },
      { rootMargin: RENDER_MARGIN, threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [pageNumber, registerVisibility]);

  useEffect(() => {
    if (!shouldRender || urlRef.current) return;
    let cancelled = false;
    handle
      .renderPage(pageNumber)
      .then((png) => {
        if (cancelled) {
          URL.revokeObjectURL(png.url);
          return;
        }
        urlRef.current = png.url;
        setImgUrl(png.url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [shouldRender, handle, pageNumber]);

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  // Zoom is pure CSS scaling of the decoded image — no re-render/re-decode needed.
  const baseWidth = (nativeSize.width * CSS_DPI) / nativeSize.dpi;
  const baseHeight = (nativeSize.height * CSS_DPI) / nativeSize.dpi;

  return (
    <div
      ref={containerRef}
      data-page={pageNumber}
      style={{
        width: baseWidth * scale,
        height: baseHeight * scale,
        background: 'white',
        boxShadow: 'var(--mantine-shadow-md)',
        marginBottom: 20,
        flexShrink: 0,
      }}
    >
      {imgUrl && <img src={imgUrl} alt="" style={{ width: '100%', height: '100%', display: 'block' }} />}
    </div>
  );
}

export function DjvuReader({ data, initialPage = 1, immersive, onPageChange, toolbarSlot, maxHeight, topInset, onFrame }: DjvuReaderProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [frame, setFrame] = useState<HTMLDivElement | null>(null);
  const handleRef = useRef<DjvuDocumentHandle | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [pagesSizes, setPagesSizes] = useState<DjvuPageSizeInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(initialPage);

  const currentPageRef = useRef(initialPage);
  const pageCountRef = useRef(0);
  const onPageChangeRef = useRef(onPageChange);
  const visibilityRef = useRef<Map<number, number>>(new Map());
  const rafRef = useRef(0);
  const pendingScrollTarget = useRef<number | null>(initialPage);

  // Одна и та же рамка нужна и как ссылка (искать страницы), и как узел (мерить ширину).
  const attachFrame = useCallback(
    (element: HTMLDivElement | null) => {
      scrollRef.current = element;
      setFrame(element);
      onFrame?.(element);
    },
    [onFrame],
  );

  const containerWidth = useElementWidth(frame);
  const naturalWidth = pagesSizes[0] ? (pagesSizes[0].width * CSS_DPI) / pagesSizes[0].dpi : null;
  const { scale, isFit, adjust, fitWidth } = useReaderZoom({
    stored: getDjvuZoom(),
    save: setDjvuZoom,
    min: DJVU_ZOOM_MIN,
    max: DJVU_ZOOM_MAX,
    naturalWidth,
    containerWidth,
  });

  useEffect(() => {
    onPageChangeRef.current = onPageChange;
  });

  useEffect(() => {
    pageCountRef.current = pageCount;
  }, [pageCount]);

  useEffect(() => {
    let cancelled = false;
    let handle: DjvuDocumentHandle | null = null;
    setLoading(true);
    setError(null);
    loadDjvuDocument(data)
      .then((loaded) => {
        if (cancelled) {
          loaded.destroy();
          return;
        }
        handle = loaded;
        handleRef.current = loaded;
        setPageCount(loaded.pageCount);
        setPagesSizes(loaded.pagesSizes);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setError('Не удалось открыть файл DjVu');
      });
    return () => {
      cancelled = true;
      handle?.destroy();
      handleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // Resume at the saved reading position once page sizes are known.
  useEffect(() => {
    if (loading || pageCount === 0) return;
    const target = pendingScrollTarget.current;
    if (target === null) return;
    pendingScrollTarget.current = null;
    requestAnimationFrame(() => {
      const el = scrollRef.current?.querySelector(`[data-page="${target}"]`);
      el?.scrollIntoView({ block: 'start' });
    });
  }, [loading, pageCount]);

  const registerVisibility = useCallback((pageNumber: number, ratio: number) => {
    if (ratio <= 0) visibilityRef.current.delete(pageNumber);
    else visibilityRef.current.set(pageNumber, ratio);

    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      let best: number | null = null;
      let bestRatio = 0;
      visibilityRef.current.forEach((r, page) => {
        if (r > bestRatio) {
          bestRatio = r;
          best = page;
        }
      });
      if (best !== null && best !== currentPageRef.current) {
        currentPageRef.current = best;
        setCurrentPage(best);
        onPageChangeRef.current?.(best, pageCountRef.current);
      }
    });
  }, []);

  const jumpToPage = (page: number) => {
    const clamped = Math.min(pageCount, Math.max(1, page));
    const el = scrollRef.current?.querySelector(`[data-page="${clamped}"]`);
    el?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') jumpToPage(currentPageRef.current + 1);
      if (event.key === 'ArrowLeft') jumpToPage(currentPageRef.current - 1);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageCount]);

  if (error) {
    return (
      <Center py={100}>
        <Text c="red">{error}</Text>
      </Center>
    );
  }

  if (loading) {
    return (
      <Center py={100}>
        <Loader />
      </Center>
    );
  }

  const handle = handleRef.current;
  if (!handle) return null;

  return (
    <Stack align="center" gap="md" w="100%">
      {!immersive && (
        <ToolbarSlot target={toolbarSlot}>
          <Group>
            <ActionIcon aria-label="Предыдущая страница" variant="light" onClick={() => jumpToPage(currentPage - 1)} disabled={currentPage <= 1}>
              <IconChevronLeft size={18} />
            </ActionIcon>
            <Text size="sm">
              Стр. {currentPage} из {pageCount}
            </Text>
            <ActionIcon aria-label="Следующая страница" variant="light" onClick={() => jumpToPage(currentPage + 1)} disabled={currentPage >= pageCount}>
              <IconChevronRight size={18} />
            </ActionIcon>
            <ActionIcon variant="subtle" color="gray" onClick={() => adjust(-0.2)} ml="md" aria-label="Мельче">
              <IconMinus size={16} />
            </ActionIcon>
            <ActionIcon variant="subtle" color="gray" onClick={() => adjust(0.2)} aria-label="Крупнее">
              <IconPlus size={16} />
            </ActionIcon>
            <Tooltip label="По ширине экрана" withArrow>
              <ActionIcon
                variant={isFit ? 'light' : 'subtle'}
                color={isFit ? 'brand' : 'gray'}
                onClick={fitWidth}
                aria-label="По ширине экрана"
                aria-pressed={isFit}
              >
                <IconArrowAutofitWidth size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </ToolbarSlot>
      )}
      <PageScroller
        frameRef={attachFrame}
        maxHeight={immersive ? '92vh' : (maxHeight ?? '75vh')}
        topInset={immersive ? 0 : topInset}
      >
        {scale !== null &&
          pagesSizes.map((size, index) => (
            <DjvuPage
              key={index + 1}
              handle={handle}
              pageNumber={index + 1}
              nativeSize={size}
              scale={scale}
              registerVisibility={registerVisibility}
            />
          ))}
      </PageScroller>
    </Stack>
  );
}
