import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ActionIcon, Button, Center, Container, Group, Loader, Stack, Text, Title } from '@mantine/core';
import { IconArrowsMaximize, IconArrowsMinimize } from '@tabler/icons-react';
import { Link, useParams } from 'react-router-dom';

import { DjvuReader } from '../features/library/DjvuReader';
import { ReaderBar } from '../features/library/ReaderBar';
import { AppErrorBoundary } from '../components/common/AppErrorBoundary';
import { FlowReader } from '../features/library/FlowReader';
import { ReadingSheet } from '../components/common/ReadingSheet';
import { decodeFb2Text, parseFb2 } from '../features/library/fb2';
import { PdfReader } from '../features/library/PdfReader';
import { loadBookFile, useBook } from '../features/library/useLibrary';
import { readDocx } from '../lib/docx/readDocx';
import { BackButton } from '../components/common/BackButton';
import { STICKY_TOP } from '../layouts/shellMetrics';
import { SCROLL_ROOT_ID } from '../components/layout/scrollRoot';
import { useScrollDirection } from '../components/layout/useScrollDirection';

const SAVE_DEBOUNCE_MS = 800;
/** Ниже этого читать нечем: на невысоком экране «до низа окна» вырождается в полоску. */
const MIN_STAGE_HEIGHT = 320;

export function BookReaderPage() {
  const { id } = useParams();
  const { book, updateProgress } = useBook(id);
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null);
  const [djvuData, setDjvuData] = useState<ArrayBuffer | null>(null);
  // FB2 and DOCX both end up as one HTML stream for FlowReader; only the converter differs.
  const [flowHtml, setFlowHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [immersive, setImmersive] = useState(false);
  // PDF и DjVu — постраничные: страница стоит на месте, листается рамка читалки. Поэтому и
  // направление у них считается по рамке, а не по корню оболочки.
  const paged = book?.format === 'pdf' || book?.format === 'djvu';
  const [pagedFrame, setPagedFrame] = useState<HTMLDivElement | null>(null);
  const [stage, setStage] = useState<HTMLDivElement | null>(null);
  const [bar, setBar] = useState<HTMLDivElement | null>(null);
  const [barHeight, setBarHeight] = useState(0);

  // Панель уезжает по тому же правилу, что шапка приложения: вниз — читают, вверх — понадобилась.
  // В полноэкранном режиме страница не прокручивается вовсе, и убирать панель нечему и незачем:
  // выход из него — кнопка на ней же.
  const { visible: chromeVisible } = useScrollDirection(paged ? pagedFrame : undefined);

  // Рамка постраничной читалки занимает всё, что осталось до низа окна. Прежние 75 % высоты
  // оставляли под ней пустую полосу, а панель, лежащая на листе, отдаёт ему и своё место.
  //
  // Меряется по элементу из состояния, а не по ссылке: рамка появляется не в первом рендере —
  // сначала грузится книга, — а об изменении `ref.current` React не знает и эффект не повторит.
  // Общий `useFittedHeight` из редактора таблиц именно на этом здесь и молчал: замер шёл один раз,
  // до появления рамки, и высота оставалась незаданной (замер: рамка 675 px вместо 804).
  const [stageHeight, setStageHeight] = useState<number | null>(null);
  useEffect(() => {
    if (!stage) return;
    const measure = () => {
      const root = document.getElementById(SCROLL_ROOT_ID);
      if (!root) return;
      // «Сколько осталось до низа окна» считается от места рамки **в документе**, а не на экране:
      // экранная координата зависит от прокрутки, и стоит странице сдвинуться, как замер вырастет,
      // от этого вырастет рамка, а от неё — прокрутка. Позиция в документе от высоты рамки не
      // зависит вовсе, поэтому замер сходится с первого раза.
      //
      // Снизу вычитается не придуманное число, а собственный отступ области содержимого (у Mantine
      // это 20 px): с числом «на глаз» страница оставалась прокручиваемой на два десятка пикселей.
      // Считать «хвостом», как у рабочего места таблицы, здесь нельзя: там содержимое всегда длиннее
      // окна, а тут — короче, и `scrollHeight` равен высоте окна. Хвост тогда включает в себя пустое
      // место под рамкой, и формула превращается в тождество: любая высота оказывается «правильной».
      const main = document.querySelector('main');
      const bottomPad = main ? parseFloat(getComputedStyle(main).paddingBottom) || 0 : 0;
      const top = stage.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop;
      const next = Math.max(MIN_STAGE_HEIGHT, Math.round(root.clientHeight - top - bottomPad));
      setStageHeight((current) => (current !== null && Math.abs(current - next) <= 2 ? current : next));
    };
    // Оценка сходится не всегда до пикселя: на странице есть и то, чего в этом расчёте нет
    // (у оболочки Mantine остаётся несколько своих пикселей — замер: 12 на 1400 и 44 на 390).
    // Поэтому следующим кадром высота подрезается ровно на то, что фактически не поместилось.
    // Подрезка сходится за один шаг: как только страница перестала прокручиваться, вычитать нечего.
    //
    // **Следить за размером области прокрутки при этом нельзя, и это была настоящая ошибка.**
    // Пока высота не подрезана, страница переполнена — значит у неё есть полоса прокрутки, а полоса
    // сужает область на свою ширину. `ResizeObserver` на этой области будил замер, замер возвращал
    // высоту к неподрезанной оценке, переполнение появлялось снова — и так каждый кадр: дрожало всё,
    // включая шапку, потому что прокрутка страницы прыгала между нулём и переполнением. В headless
    // этого не видно вовсе: там полоса накладная и ширины не отнимает (о том же предупреждает
    // раздел про жёлоб полосы в `CLAUDE.md`). Поэтому замер повторяется только по `resize`.
    const trim = () => {
      const root = document.getElementById(SCROLL_ROOT_ID);
      if (!root) return;
      const overflow = root.scrollHeight - root.clientHeight;
      if (overflow <= 0) return;
      setStageHeight((current) => (current === null ? current : Math.max(MIN_STAGE_HEIGHT, current - overflow)));
    };

    let frame = 0;
    const remeasure = () => {
      measure();
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(trim);
    };

    remeasure();
    window.addEventListener('resize', remeasure);
    return () => {
      window.removeEventListener('resize', remeasure);
      cancelAnimationFrame(frame);
    };
  }, [stage, barHeight]);

  // Панель лежит на листе, и на её высоту документ отступает сверху. Высота своя у каждого
  // формата и меняется с шириной окна: у PDF в панели пять кнопок и номер страницы.
  useEffect(() => {
    if (!bar) return;
    const measure = () => setBarHeight(Math.round(bar.getBoundingClientRect().height));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    return () => observer.disconnect();
  }, [bar]);
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

  // Обработчик отдаётся мемоизированной читалке и потому обязан быть постоянным; всё, что в нём
  // меняется от рендера к рендеру, читается из ссылки. Ссылка обновляется в `useLayoutEffect`, а не
  // в рендере: рендер в React 19 может быть отброшен.
  const progressHandlerRef = useRef(handleProgress);
  useLayoutEffect(() => {
    progressHandlerRef.current = handleProgress;
  });
  const handleFlowProgress = useCallback((fraction: number) => {
    progressHandlerRef.current(fraction);
    setPositionLabel(`Прочитано ${Math.round(fraction * 100)} %`);
  }, []);

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

  const readerBar = (
    <ReaderBar
      rootRef={setBar}
      slotRef={setToolbarSlot}
      top={immersive ? 0 : STICKY_TOP}
      overlay={paged && !immersive}
      hidden={!immersive && !chromeVisible}
    >
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
  );

  // У постраничных читалок панель лежит на листе, поэтому она внутри рамки, а не над ней.
  const pagedProps = {
    immersive,
    toolbarSlot,
    maxHeight: stageHeight ? `${stageHeight}px` : undefined,
    topInset: barHeight,
    onFrame: setPagedFrame,
    onPageChange: (page: number) => handleProgress(page),
  };

  return (
    <Stack
      ref={pageRef}
      gap="md"
      style={immersive ? { background: 'var(--mantine-color-body)', minHeight: '100vh', padding: 'var(--mantine-spacing-lg)' } : undefined}
    >
      {!paged && readerBar}

      {error && (
        <Center py={80}>
          <Text c="red">{error}</Text>
        </Center>
      )}

      {/* Читалки разбирают чужие файлы — PDF, DjVu поверх вендорного `djvu.js`, Word через
          mammoth — и падают на битом файле. Панель с кнопкой «Назад» обязана пережить это падение:
          иначе из сломавшейся книги нельзя выйти иначе как перезагрузкой. */}
      {!error && paged && (
        <div ref={setStage} style={{ position: 'relative' }}>
          {readerBar}
          {book.format === 'pdf' ? (
            pdfData ? (
              <AppErrorBoundary what="Читалка PDF" compact>
                <PdfReader data={pdfData} initialPage={book.progress?.location ?? 1} {...pagedProps} />
              </AppErrorBoundary>
            ) : (
              <Center py={100}>
                <Loader />
              </Center>
            )
          ) : djvuData ? (
            <AppErrorBoundary what="Читалка DjVu" compact>
              <DjvuReader data={djvuData} initialPage={book.progress?.location ?? 1} {...pagedProps} />
            </AppErrorBoundary>
          ) : (
            <Center py={100}>
              <Loader />
            </Center>
          )}
        </div>
      )}

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
              <AppErrorBoundary what="Читалка" compact>
                <FlowReader
                  bodyHtml={flowHtml}
                  contentClassName={book.format === 'docx' ? 'docx-content' : 'fb2-content'}
                  initialProgress={book.progress?.location ?? 0}
                  immersive={immersive}
                  toolbarSlot={toolbarSlot}
                  onProgressChange={handleFlowProgress}
                />
              </AppErrorBoundary>
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
