import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Drawer,
  Group,
  SegmentedControl,
  Select,
  Slider,
  Stack,
  Switch,
  Text,
  Textarea,
  Tooltip,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { useFormActionsHeight } from '../../../components/common/formActionsSlot';
import { IconAlertTriangle, IconMinus, IconPlus, IconTrash, IconZoomIn } from '@tabler/icons-react';

import { SCROLL_ROOT_ID } from '../../../components/layout/scrollRoot';

import { PLACEHOLDERS } from './templateTypes';
import { LayoutDocument } from './LayoutDocument';
import classes from './layoutEditor.module.css';
import { LOW_CONFIDENCE_THRESHOLD, PAGE_PRESETS, clampBlock, createLayoutBlock } from './layoutTypes';
import type { TemplateLayout, TemplateLayoutBlock } from './layoutTypes';

/**
 * Editing a recognised form: blocks positioned over a faded copy of the original.
 *
 * Text is corrected in the side panel rather than in place on the canvas. Recognition errors tend
 * to be whole mangled lines rather than single characters, and a textarea showing the entire string
 * is easier to fix — and far less code — than a contenteditable overlay that has to survive
 * dragging, resizing and selection at the same time.
 */

type DragMode = 'move' | 'resize';

/** Кратности увеличения холста. Целые — чтобы «в один лист» читалось однозначно. */
/**
 * Пределы увеличения холста.
 *
 * Увеличение существует ради **попадания пальцем**: строка распознанного бланка на телефоне выходит
 * высотой 9 px, разглядеть её можно, а попасть — нет. Отсюда и потолок: вчетверо от ширины экрана
 * строка становится примерно в 36 px, то есть впору пальцу. Дальше растягивать незачем — читать
 * бланк всё равно удобнее целиком.
 */
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.5;

const clampZoom = (value: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));

/** «2,5×» — кратность, а не проценты: на бумагу увеличение не влияет никак. */
const zoomLabel = (zoom: number) => `${zoom.toFixed(1).replace('.0', '').replace('.', ',')}×`;

interface LayoutEditorProps {
  layout: TemplateLayout;
  onChange: (layout: TemplateLayout) => void;
}

/**
 * Доля экрана под шторку свойств блока.
 *
 * Было 62 %, и от бланка оставалась полоса в 256 px из 844: правка блока шла в замочную скважину.
 * Половина — это столько, сколько нужно самим полям (текст, подстановки, кегль, выравнивание), и
 * ровно столько же остаётся холсту. Число одно на оба места: и шторка, и высота холста считаются
 * от него, иначе они разъедутся и снова начнут перекрывать друг друга.
 */
const DRAWER_FRACTION = 0.5;

export function LayoutEditor({ layout, onChange }: LayoutEditorProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /**
   * Блоки, в которых текст не помещается в свою рамку.
   *
   * У блока жёсткая высота и `overflow: hidden`, поэтому длинный текст теряет хвост молча — на
   * экране ровно то же, что на бумаге. Здесь это ещё можно поправить: раздвинуть рамку или
   * уменьшить кегль, — поэтому пометка стоит и на самом блоке, и в его свойствах.
   */
  const [overflowing, setOverflowing] = useState<string[]>([]);
  const [backdropOpacity, setBackdropOpacity] = useState(0.35);
  const [zoom, setZoom] = useState(1);
  const dragRef = useRef<{ mode: DragMode; startX: number; startY: number; start: TemplateLayoutBlock } | null>(null);

  const selected = layout.blocks.find((b) => b.id === selectedId) ?? null;

  /**
   * На узком экране свойства блока живут в нижней шторке, а не в панели под холстом.
   *
   * Порог тот же, что у раскладки в `layoutEditor.module.css`: выше него холст и панель стоят в
   * ряд и видны одновременно, ниже — панель уезжает под холст. Замер на телефоне: страница
   * редактора 1893 px при окне 844, то есть панель свойств лежит экраном ниже холста. Правка
   * блока превращалась в «коснулся — прокрутил вниз — правишь вслепую — прокрутил обратно».
   *
   * Шторка выбрана не ради красоты: вкладка или обычное модальное окно закрыли бы холст целиком, а
   * блок правят, **глядя на него**. Поэтому у шторки нет ни затемнения, ни блокировки прокрутки —
   * это панель, а не модальное окно: холст над ней остаётся видимым и рабочим.
   */
  const sideBySide = useMediaQuery('(min-width: 62em)', true, { getInitialValueInEffect: false });

  /*
   * Пока шторка открыта, страница длиннее ровно на её высоту.
   *
   * Шторка занимает нижнюю половину экрана, и без этого запаса нижняя половина бланка недостижима
   * **никакой** прокруткой: страница кончается, а под шторкой остаётся то, что уже не поднять.
   * Замер на 390×844 до правки: холст 65..740 при шторке 321..844 — от бланка оставалась полоса в
   * 256 px. С запасом любая его часть поднимается над шторкой обычным движением пальца.
   *
   * Высоту холста при этом не трогаем, и это осознанно. Считать её «сколько осталось до низа
   * окна» нельзя: страница подкручивается сама, когда шторка открывается, а замер места **в
   * документе** от прокрутки не зависит — рамка снова уезжала под шторку (проверено: холст
   * 65..423 при шторке с 301).
   */
  /*
   * Щипок двумя пальцами — то, чем на телефоне увеличивают что угодно.
   *
   * Кнопки остаются: щипок хорош, когда бланк уже перед глазами, а «во весь экран» проще нажать.
   * Точка между пальцами при этом стоит на месте — иначе увеличение уводит бланк неизвестно куда и
   * его приходится искать заново. Держится она пересчётом прокрутки рамки после смены ширины:
   * увеличение задаётся шириной холста, а не трансформацией, поэтому после перерисовки достаточно
   * вернуть ту же долю содержимого под те же пальцы.
   */
  const frameRef = useRef<HTMLDivElement>(null);
  const pinchRef = useRef<{ distance: number; zoom: number; fx: number; fy: number; clientX: number; clientY: number } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  /** Куда вернуть прокрутку рамки после того, как холст сменил ширину. */
  const keepFocus = useRef<{ fx: number; fy: number; clientX: number; clientY: number } | null>(null);

  const actionsHeight = useFormActionsHeight();
  const drawerOpen = !sideBySide && selected !== null;
  const drawerHeight = typeof window === 'undefined' ? 0 : Math.round(window.innerHeight * DRAWER_FRACTION);

  const updateBlock = useCallback(
    (id: string, patch: Partial<TemplateLayoutBlock>) => {
      onChange({
        ...layout,
        blocks: layout.blocks.map((b) => (b.id === id ? clampBlock({ ...b, ...patch }) : b)),
      });
    },
    [layout, onChange],
  );

  /**
   * Палец **выбирает** блок, а двигает только уже выбранный. Мышь — как была.
   *
   * Это то, из-за чего бланк на телефоне был неработоспособен: блоки покрывают его почти целиком, и
   * любое движение пальцем начиналось на блоке — то есть **таскало блок** вместо того, чтобы вести
   * бланк. Увеличить бланк было можно, а добраться до нужного места — нет, и заодно блоки уезжали
   * от каждой попытки прокрутить.
   *
   * Поэтому касание невыбранного блока его только выбирает и **не отменяет прокрутку**: браузер
   * ведёт бланк пальцем сам. Выбранный блок двигается сразу — он один, промахнуться уже не по чему.
   * Тот же порядок «сначала выбрать, потом двигать», что у уголка изменения размера: он и появляется
   * только у выбранного.
   */
  const beginDrag = (block: TemplateLayoutBlock, mode: DragMode) => (event: React.PointerEvent) => {
    if (event.pointerType === 'touch' && mode === 'move' && block.id !== selectedId) {
      // Всплытие останавливаем (иначе холст снимет выделение), но действие браузера — нет.
      event.stopPropagation();
      setSelectedId(block.id);
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    setSelectedId(block.id);
    dragRef.current = { mode, startX: event.clientX, startY: event.clientY, start: block };
  };

  const handleMove = useCallback(
    (event: PointerEvent) => {
      const drag = dragRef.current;
      const canvas = canvasRef.current;
      if (!drag || !canvas) return;

      const bounds = canvas.getBoundingClientRect();
      const dxPct = ((event.clientX - drag.startX) / bounds.width) * 100;
      const dyPct = ((event.clientY - drag.startY) / bounds.height) * 100;

      updateBlock(
        drag.start.id,
        drag.mode === 'move'
          ? { xPct: drag.start.xPct + dxPct, yPct: drag.start.yPct + dyPct }
          : { widthPct: drag.start.widthPct + dxPct, heightPct: drag.start.heightPct + dyPct },
      );
    },
    [updateBlock],
  );

  const endDrag = useCallback(() => {
    dragRef.current = null;
  }, []);

  /** Отменяет начатое перетаскивание блока и возвращает его туда, где он был. */
  const cancelDrag = useCallback(() => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    updateBlock(drag.start.id, drag.start);
  }, [updateBlock]);

  /** Кнопки увеличивают от центра рамки — там, куда врач и смотрит. */
  const zoomBy = (delta: number) => {
    const frame = frameRef.current;
    const canvas = canvasRef.current;
    if (frame && canvas) {
      const frameBox = frame.getBoundingClientRect();
      const box = canvas.getBoundingClientRect();
      const clientX = frameBox.left + frameBox.width / 2;
      const clientY = frameBox.top + frameBox.height / 2;
      keepFocus.current = { fx: (clientX - box.left) / box.width, fy: (clientY - box.top) / box.height, clientX, clientY };
    }
    setZoom((current) => clampZoom(current + delta));
  };

  const handleFramePointerDown = (event: React.PointerEvent) => {
    if (event.pointerType !== 'touch') return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size !== 2) return;

    // Второй палец означает щипок, а не перетаскивание блока: начатое первым пальцем отменяется.
    cancelDrag();
    const [a, b] = [...pointers.current.values()];
    const frame = frameRef.current;
    const canvas = canvasRef.current;
    if (!frame || !canvas) return;
    const clientX = (a.x + b.x) / 2;
    const clientY = (a.y + b.y) / 2;
    const box = canvas.getBoundingClientRect();
    pinchRef.current = {
      distance: Math.hypot(a.x - b.x, a.y - b.y),
      zoom,
      // Доля содержимого под пальцами — то, что обязано остаться на месте.
      fx: (clientX - box.left) / box.width,
      fy: (clientY - box.top) / box.height,
      clientX,
      clientY,
    };
  };

  const handleFramePointerMove = (event: React.PointerEvent) => {
    if (event.pointerType !== 'touch' || !pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const pinch = pinchRef.current;
    if (!pinch || pointers.current.size !== 2) return;
    event.preventDefault();
    const [a, b] = [...pointers.current.values()];
    const distance = Math.hypot(a.x - b.x, a.y - b.y);
    if (distance < 20 || pinch.distance < 20) return;
    const next = clampZoom(pinch.zoom * (distance / pinch.distance));
    keepFocus.current = { fx: pinch.fx, fy: pinch.fy, clientX: pinch.clientX, clientY: pinch.clientY };
    setZoom(next);
  };

  const handleFramePointerUp = (event: React.PointerEvent) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinchRef.current = null;
  };

  /*
   * После смены ширины холста прокрутка рамки возвращает под пальцы ту же долю содержимого.
   *
   * Считается в `useLayoutEffect` — до отрисовки: сделай мы это обычным эффектом, врач успел бы
   * увидеть кадр, в котором бланк прыгнул, и только потом вернулся.
   */
  useLayoutEffect(() => {
    const focus = keepFocus.current;
    keepFocus.current = null;
    const frame = frameRef.current;
    const canvas = canvasRef.current;
    if (!focus || !frame || !canvas) return;
    const frameBox = frame.getBoundingClientRect();
    frame.scrollLeft = focus.fx * canvas.offsetWidth - (focus.clientX - frameBox.left);
    frame.scrollTop = focus.fy * canvas.offsetHeight - (focus.clientY - frameBox.top);
  }, [zoom]);


  useEffect(() => {
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', endDrag);
      window.removeEventListener('pointercancel', endDrag);
    };
  }, [handleMove, endDrag]);

  const addBlock = () => {
    const block = createLayoutBlock({ yPct: 45 });
    onChange({ ...layout, blocks: [...layout.blocks, block] });
    setSelectedId(block.id);
  };

  const removeSelected = () => {
    if (!selected) return;
    onChange({ ...layout, blocks: layout.blocks.filter((b) => b.id !== selected.id) });
    setSelectedId(null);
  };

  /** Inserts a token at the caret, so it lands where the doctor is actually looking. */
  /**
   * Открывая шторку, подводим выбранный блок к верхней четверти экрана.
   *
   * Иначе блок, выбранный в нижней половине бланка, оказывается ровно под шторкой — то есть правка
   * снова идёт вслепую, только теперь без прокрутки. Считается один раз на смену выбора, а не на
   * прокрутке: тут нечего слушать.
   */
  useEffect(() => {
    if (sideBySide || !selectedId) return;
    const hit = document.querySelector<HTMLElement>(`[data-layout-block="${selectedId}"]`);
    const root = document.getElementById(SCROLL_ROOT_ID);
    if (!hit || !root) return;
    const offset = hit.getBoundingClientRect().top - window.innerHeight * 0.22;
    if (Math.abs(offset) > 24) root.scrollBy({ top: offset, behavior: 'smooth' });
  }, [selectedId, sideBySide]);

  const insertToken = (token: string) => {
    if (!selected) return;
    const field = textareaRef.current;
    const at = field ? field.selectionStart : selected.text.length;
    const text = `${selected.text.slice(0, at)}${token}${selected.text.slice(field ? field.selectionEnd : at)}`;
    updateBlock(selected.id, { text });
  };

  const lowConfidence = layout.blocks.filter(
    (b) => b.confidence !== null && b.confidence < LOW_CONFIDENCE_THRESHOLD,
  ).length;

  return (
    <div className={classes.editor} style={{ paddingBottom: drawerOpen ? drawerHeight : undefined }}>
      <Stack gap="sm" className={classes.canvas}>
        <Group justify="space-between" wrap="wrap" gap="sm">
          <Select
            size="xs"
            w={190}
            label="Формат бумаги"
            data={PAGE_PRESETS.map((p) => ({ value: p.label, label: p.label }))}
            value={
              PAGE_PRESETS.find((p) => p.widthMm === layout.pageWidthMm && p.heightMm === layout.pageHeightMm)?.label ??
              null
            }
            onChange={(value) => {
              const preset = PAGE_PRESETS.find((p) => p.label === value);
              if (preset) onChange({ ...layout, pageWidthMm: preset.widthMm, pageHeightMm: preset.heightMm });
            }}
          />
          {layout.backdropDataUrl && (
            <Box w={200}>
              <Text size="xs" fw={500} mb={4}>
                Подложка
              </Text>
              <Slider
                size="sm"
                min={0}
                max={0.8}
                step={0.05}
                value={backdropOpacity}
                onChange={setBackdropOpacity}
                label={null}
              />
            </Box>
          )}
        </Group>

        <Card withBorder padding={0} onPointerDown={() => setSelectedId(null)}>
          {/* Увеличение меняет ширину холста, а не масштабирует его трансформацией: перетаскивание
              считает проценты от прямоугольника холста, поэтому при изменении ширины арифметика
              остаётся верной без единой правки. */}
          <div
            ref={frameRef}
            className={classes.canvasFrame}
            onPointerDown={handleFramePointerDown}
            onPointerMove={handleFramePointerMove}
            onPointerUp={handleFramePointerUp}
            onPointerCancel={handleFramePointerUp}
          >
          <div className={classes.canvasZoom} style={{ width: `${zoom * 100}%` }}>
          {/* The ref sits on a wrapper that shares the page's exact box rather than on the Card,
              whose 1px border would offset every drag calculation by a fraction of a percent. */}
          <div ref={canvasRef} style={{ position: 'relative' }}>
          <LayoutDocument layout={layout} backdropOpacity={backdropOpacity} onOverflow={setOverflowing}>
            {layout.blocks.map((block) => {
              const isSelected = block.id === selectedId;
              const isSuspect = block.confidence !== null && block.confidence < LOW_CONFIDENCE_THRESHOLD;
              const isClipped = overflowing.includes(block.id);
              return (
                <div
                  key={`hit-${block.id}`}
                  data-layout-block={block.id}
                  onPointerDown={beginDrag(block, 'move')}
                  style={{
                    position: 'absolute',
                    left: `${block.xPct}%`,
                    top: `${block.yPct}%`,
                    width: `${block.widthPct}%`,
                    height: `${block.heightPct}%`,
                    cursor: 'move',
                    // Невыбранный блок не перехватывает жест: по нему ведут бланк.
                    touchAction: isSelected ? 'none' : 'auto',
                    outline: isSelected
                      ? '2px solid var(--mantine-color-brand-6)'
                      : isClipped
                        ? '2px solid var(--mantine-color-red-6)'
                        : isSuspect
                          ? '1px dashed var(--mantine-color-orange-6)'
                          : '1px solid rgba(0,0,0,0.12)',
                    // Tinting what recognition was unsure about puts attention where it is needed,
                    // instead of spreading it evenly over lines that came back perfectly.
                    background: isClipped
                      ? 'rgba(255, 0, 0, 0.08)'
                      : isSuspect
                        ? 'rgba(255, 170, 0, 0.10)'
                        : 'transparent',
                  }}
                >
                  {isSelected && (
                    <div
                      onPointerDown={beginDrag(block, 'resize')}
                      style={{
                        position: 'absolute',
                        right: -6,
                        bottom: -6,
                        width: 12,
                        height: 12,
                        background: 'var(--mantine-color-brand-6)',
                        borderRadius: 2,
                        cursor: 'nwse-resize',
                        touchAction: 'none',
                      }}
                    />
                  )}
                </div>
              );
            })}
          </LayoutDocument>
          </div>
          </div>
          </div>
        </Card>

        <Group gap="xs" wrap="wrap">
          <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} onClick={addBlock}>
            Добавить блок
          </Button>
          {/* Увеличение существует ради попадания пальцем, поэтому подписано кратностью, а не
              процентами: на бумагу оно не влияет никак. Кнопки остались рядом со щипком — «во весь
              экран» нажать проще, чем свести пальцы точно. */}
          <Group gap={4} wrap="nowrap">
            <ActionIcon
              size="sm"
              variant="light"
              aria-label="Уменьшить"
              disabled={zoom <= MIN_ZOOM}
              onClick={() => zoomBy(-ZOOM_STEP)}
            >
              <IconMinus size={14} />
            </ActionIcon>
            <Text size="xs" w={38} ta="center" aria-live="polite">
              {zoomLabel(zoom)}
            </Text>
            <ActionIcon
              size="sm"
              variant="light"
              aria-label="Увеличить"
              disabled={zoom >= MAX_ZOOM}
              onClick={() => zoomBy(ZOOM_STEP)}
            >
              <IconZoomIn size={14} />
            </ActionIcon>
          </Group>
          <Text size="xs" c="dimmed">
            блоков: {layout.blocks.length}
            {lowConfidence > 0 && `, сомнительных: ${lowConfidence}`}
            {overflowing.length > 0 && `, текст не помещается: ${overflowing.length}`}
          </Text>
        </Group>
      </Stack>

      {sideBySide ? (
        <Card withBorder padding="md" className={classes.panel}>
          <BlockInspector
            selected={selected}
            clipped={selected !== null && overflowing.includes(selected.id)}
            textareaRef={textareaRef}
            onUpdate={updateBlock}
            onRemove={removeSelected}
            onInsertToken={insertToken}
          />
        </Card>
      ) : (
        <Drawer
          opened={selected !== null}
          onClose={() => setSelectedId(null)}
          position="bottom"
          size={`${Math.round(DRAWER_FRACTION * 100)}%`}
          title="Свойства блока"
          padding="md"
          // Ни затемнения, ни захвата фокуса, ни блокировки прокрутки: холст над шторкой должен
          // остаться видимым и рабочим — ради этого шторка и выбрана вместо модального окна.
          withOverlay={false}
          trapFocus={false}
          lockScroll={false}
          closeOnClickOutside={false}
          /*
           * Шторка садится **над** панелью действий, а не поверх неё: иначе «Сохранить» оказывается
           * под ней, и врач, поправивший блок, не видит, чем это записать. Высоту панель сообщает
           * сама — тем же механизмом, которым её обходит кнопка «наверх».
           */
          styles={{
            content: {
              boxShadow: 'var(--mantine-shadow-xl)',
              marginBottom: actionsHeight,
              display: 'flex',
              flexDirection: 'column',
            },
            /*
             * Свойства прокручиваются внутри шторки, и без `min-height: 0` этого не происходит.
             *
             * Тело — элемент flex-колонки, а такой элемент не даёт себя сжать ниже собственного
             * содержимого: замер на 390×844 — тело 532 px внутри шторки 422, и всё, что ниже
             * подстановок (кегль, выравнивание, полужирный, удаление), было **обрезано** и
             * недостижимо ничем. Та же ловушка, из-за которой читалке Word понадобился `miw={0}`.
             */
            body: { flex: 1, minHeight: 0, overflowY: 'auto' },
          }}
        >
          <BlockInspector
            selected={selected}
            clipped={selected !== null && overflowing.includes(selected.id)}
            textareaRef={textareaRef}
            onUpdate={updateBlock}
            onRemove={removeSelected}
            onInsertToken={insertToken}
            withHeading={false}
          />
        </Drawer>
      )}
    </div>
  );
}

interface BlockInspectorProps {
  selected: TemplateLayoutBlock | null;
  /** Текст выбранного блока не помещается в его рамку и будет обрезан — и на экране, и на бумаге. */
  clipped?: boolean;
  /** У шторки заголовок свой, и второе слово «Блок» под ним было бы повтором. */
  withHeading?: boolean;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onUpdate: (id: string, patch: Partial<TemplateLayoutBlock>) => void;
  onRemove: () => void;
  onInsertToken: (token: string) => void;
}

/**
 * Свойства блока — один набор полей на оба места: панель под холстом на широком экране и нижняя
 * шторка на узком. Правка бланка не должна зависеть от того, с чего врач открыл страницу, поэтому
 * урезанного варианта для телефона нет.
 */
function BlockInspector({ selected, clipped, textareaRef, onUpdate, onRemove, onInsertToken, withHeading = true }: BlockInspectorProps) {
  return !selected ? (
          <Stack gap="xs" py="lg">
            <Text fw={600} size="sm">
              Блок не выбран
            </Text>
            <Text size="sm" c="dimmed">
              Нажмите на блок, чтобы поправить текст, размер и положение. Оранжевым отмечено то, в
              чём распознавание не уверено — начните с него.
            </Text>
          </Stack>
        ) : (
          <Stack gap="md">
            <Group justify="space-between">
              {withHeading ? (
                <Text fw={600} size="sm">
                  Блок
                </Text>
              ) : (
                <div />
              )}
              <Group gap={6}>
                {selected.confidence !== null && (
                  <Tooltip label="Уверенность распознавания">
                    <Badge
                      size="sm"
                      variant="light"
                      color={selected.confidence < LOW_CONFIDENCE_THRESHOLD ? 'orange' : 'teal'}
                    >
                      {Math.round(selected.confidence)}
                    </Badge>
                  </Tooltip>
                )}
                <ActionIcon variant="subtle" color="red" onClick={onRemove} aria-label="Удалить блок">
                  <IconTrash size={16} />
                </ActionIcon>
              </Group>
            </Group>

            {clipped && (
              <Alert color="red" variant="light" icon={<IconAlertTriangle size={16} />} p="xs">
                <Text size="xs">
                  Текст не помещается в рамку и будет обрезан — на бумаге тоже. Раздвиньте блок или
                  уменьшите кегль.
                </Text>
              </Alert>
            )}

            <Textarea
              ref={textareaRef}
              label="Текст"
              autosize
              minRows={2}
              maxRows={8}
              value={selected.text}
              onChange={(e) => onUpdate(selected.id, { text: e.currentTarget.value })}
            />

            <div>
              <Text size="xs" fw={500} mb={6}>
                Вставить поле
              </Text>
              <Group gap={4}>
                {PLACEHOLDERS.map((placeholder) => (
                  <Badge
                    key={placeholder.token}
                    size="sm"
                    variant="light"
                    color="gray"
                    style={{ cursor: 'pointer' }}
                    onClick={() => onInsertToken(placeholder.token)}
                  >
                    {placeholder.label}
                  </Badge>
                ))}
              </Group>
            </div>

            <div>
              <Text size="xs" fw={500} mb={4}>
                Размер шрифта
              </Text>
              <Slider
                min={1}
                max={12}
                step={0.1}
                value={selected.fontSizePct}
                onChange={(v) => onUpdate(selected.id, { fontSizePct: v })}
                label={(v) => v.toFixed(1)}
              />
            </div>

            <SegmentedControl
              size="xs"
              fullWidth
              data={[
                { value: 'left', label: 'Слева' },
                { value: 'center', label: 'По центру' },
                { value: 'right', label: 'Справа' },
              ]}
              value={selected.align}
              onChange={(v) => onUpdate(selected.id, { align: v as TemplateLayoutBlock['align'] })}
            />

            <Switch
              size="sm"
              label="Полужирный"
              checked={selected.bold}
              onChange={(e) => onUpdate(selected.id, { bold: e.currentTarget.checked })}
            />
    </Stack>
  );
}

