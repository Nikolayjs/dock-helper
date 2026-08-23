import { useCallback, useEffect, useRef, useState } from 'react';
import { ActionIcon, Center, Group, Loader, Stack, Text } from '@mantine/core';
import { IconChevronLeft, IconChevronRight, IconMinus, IconPlus } from '@tabler/icons-react';

import { loadPdfDocument } from './pdfMeta';
import { getPdfZoom, PDF_ZOOM_MAX, PDF_ZOOM_MIN, setPdfZoom } from './readerPrefs';

interface PdfReaderProps {
  data: ArrayBuffer;
  initialPage?: number;
  /** Hides the page-navigation and zoom toolbar, for distraction-free reading on small screens. */
  immersive?: boolean;
  onPageChange?: (page: number, pageCount: number) => void;
}

type PdfDocumentProxy = Awaited<ReturnType<typeof loadPdfDocument>>;
type PageSize = { width: number; height: number };

/** How far outside the viewport a page's canvas starts rendering, so scrolling never shows a blank page. */
const RENDER_MARGIN = '1000px 0px';
const FALLBACK_SIZE: PageSize = { width: 600, height: 800 };

interface PdfPageProps {
  doc: PdfDocumentProxy;
  pageNumber: number;
  scale: number;
  estimatedSize: PageSize | null;
  registerVisibility: (pageNumber: number, ratio: number) => void;
}

function PdfPage({ doc, pageNumber, scale, estimatedSize, registerVisibility }: PdfPageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [shouldRender, setShouldRender] = useState(false);
  const [renderedSize, setRenderedSize] = useState<PageSize | null>(null);

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
    if (!shouldRender) return;
    let cancelled = false;
    doc.getPage(pageNumber).then((pdfPage) => {
      const canvas = canvasRef.current;
      if (cancelled || !canvas) return;
      const viewport = pdfPage.getViewport({ scale });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      setRenderedSize({ width: viewport.width, height: viewport.height });
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      pdfPage.render({ canvasContext: ctx, viewport }).promise.catch(() => {});
    });
    return () => {
      cancelled = true;
    };
  }, [shouldRender, doc, pageNumber, scale]);

  const size = renderedSize ?? estimatedSize ?? FALLBACK_SIZE;

  return (
    <div
      ref={containerRef}
      data-page={pageNumber}
      style={{
        width: size.width,
        height: size.height,
        background: 'white',
        boxShadow: 'var(--mantine-shadow-md)',
        marginBottom: 20,
        flexShrink: 0,
      }}
    >
      {shouldRender && <canvas ref={canvasRef} style={{ display: 'block' }} />}
    </div>
  );
}

export function PdfReader({ data, initialPage = 1, immersive, onPageChange }: PdfReaderProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<PdfDocumentProxy | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [scale, setScale] = useState(() => getPdfZoom());
  const [loading, setLoading] = useState(true);
  const [estimatedSize, setEstimatedSize] = useState<PageSize | null>(null);
  const [currentPage, setCurrentPage] = useState(initialPage);

  const currentPageRef = useRef(initialPage);
  const pageCountRef = useRef(0);
  const onPageChangeRef = useRef(onPageChange);
  const visibilityRef = useRef<Map<number, number>>(new Map());
  const rafRef = useRef(0);
  const pendingScrollTarget = useRef<number | null>(initialPage);

  useEffect(() => {
    onPageChangeRef.current = onPageChange;
  });

  useEffect(() => {
    pageCountRef.current = pageCount;
  }, [pageCount]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadPdfDocument(data).then((doc) => {
      if (cancelled) {
        doc.destroy();
        return;
      }
      docRef.current = doc;
      setPageCount(doc.numPages);
      setLoading(false);
    });
    return () => {
      cancelled = true;
      docRef.current?.destroy();
      docRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // First page's size stands in for pages that haven't rendered yet, so the scrollbar
  // reflects the document's true length instead of collapsing until each page loads.
  useEffect(() => {
    const doc = docRef.current;
    if (loading || !doc) return;
    let cancelled = false;
    doc.getPage(1).then((page) => {
      if (cancelled) return;
      const viewport = page.getViewport({ scale });
      setEstimatedSize({ width: viewport.width, height: viewport.height });
    });
    return () => {
      cancelled = true;
    };
  }, [loading, scale]);

  // Resume at the saved reading position once page sizes are known.
  useEffect(() => {
    if (loading || pageCount === 0 || !estimatedSize) return;
    const target = pendingScrollTarget.current;
    if (target === null) return;
    pendingScrollTarget.current = null;
    requestAnimationFrame(() => {
      const el = scrollRef.current?.querySelector(`[data-page="${target}"]`);
      el?.scrollIntoView({ block: 'start' });
    });
  }, [loading, pageCount, estimatedSize]);

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

  const adjustZoom = (delta: number) => {
    setScale((prev) => {
      const next = Math.min(PDF_ZOOM_MAX, Math.max(PDF_ZOOM_MIN, Math.round((prev + delta) * 100) / 100));
      setPdfZoom(next);
      return next;
    });
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

  if (loading) {
    return (
      <Center py={100}>
        <Loader />
      </Center>
    );
  }

  const doc = docRef.current;
  if (!doc) return null;

  return (
    <Stack align="center" gap="md" w="100%">
      {!immersive && (
        <Group>
          <ActionIcon variant="light" onClick={() => jumpToPage(currentPage - 1)} disabled={currentPage <= 1}>
            <IconChevronLeft size={18} />
          </ActionIcon>
          <Text size="sm">
            Стр. {currentPage} из {pageCount}
          </Text>
          <ActionIcon variant="light" onClick={() => jumpToPage(currentPage + 1)} disabled={currentPage >= pageCount}>
            <IconChevronRight size={18} />
          </ActionIcon>
          <ActionIcon variant="subtle" color="gray" onClick={() => adjustZoom(-0.2)} ml="md">
            <IconMinus size={16} />
          </ActionIcon>
          <ActionIcon variant="subtle" color="gray" onClick={() => adjustZoom(0.2)}>
            <IconPlus size={16} />
          </ActionIcon>
        </Group>
      )}
      <div
        ref={scrollRef}
        style={{
          maxHeight: immersive ? '92vh' : '75vh',
          overflowY: 'auto',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '4px 0',
        }}
      >
        {Array.from({ length: pageCount }, (_, i) => i + 1).map((pageNumber) => (
          <PdfPage
            key={pageNumber}
            doc={doc}
            pageNumber={pageNumber}
            scale={scale}
            estimatedSize={estimatedSize}
            registerVisibility={registerVisibility}
          />
        ))}
      </div>
    </Stack>
  );
}
