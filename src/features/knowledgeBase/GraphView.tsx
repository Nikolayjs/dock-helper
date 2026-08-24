import { useEffect, useMemo, useRef, useState } from 'react';
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from 'd3-force';
import { Box, Text } from '@mantine/core';

import type { GraphEdge, GraphEdgeKind, GraphNode } from './knowledgeGraph';
import type { KnowledgeKind } from './types';

interface SimNode extends GraphNode, SimulationNodeDatum {}

interface SimLink extends SimulationLinkDatum<SimNode> {
  kind: GraphEdgeKind;
  weight: number;
}

const KIND_COLOR: Record<KnowledgeKind, string> = {
  guideline: 'var(--mantine-color-brand-6)',
  article: 'var(--mantine-color-mint-6)',
};

const MIN_RADIUS = 9;

function nodeRadius(node: Pick<GraphNode, 'connectionCount'>): number {
  return MIN_RADIUS + Math.min(node.connectionCount, 10) * 1.5;
}

function asNode(value: string | number | SimNode | undefined): SimNode | undefined {
  return typeof value === 'object' ? value : undefined;
}

function labelFor(title: string): string {
  return title.length > 28 ? `${title.slice(0, 27)}…` : title;
}

let measureCtx: CanvasRenderingContext2D | null | undefined;
function measureTextWidth(text: string, fontSize = 11): number {
  if (measureCtx === undefined) measureCtx = document.createElement('canvas').getContext('2d');
  if (!measureCtx) return text.length * fontSize * 0.55;
  measureCtx.font = `${fontSize}px sans-serif`;
  return measureCtx.measureText(text).width;
}

interface LabelBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Greedily keeps a node's label only if it doesn't overlap an already-placed, higher-priority (more
 * connected) label — dense clusters end up with most circles unlabeled rather than an unreadable pile
 * of overlapping text. Hovering a node always reveals its own label and its neighbors' regardless. */
function pickVisibleLabels(nodes: SimNode[]): Set<string> {
  const visible = new Set<string>();
  const placed: LabelBox[] = [];
  const byPriority = [...nodes].sort((a, b) => b.connectionCount - a.connectionCount);

  for (const node of byPriority) {
    if (node.x == null || node.y == null) continue;
    const radius = nodeRadius(node);
    const width = measureTextWidth(labelFor(node.title));
    const box: LabelBox = { x1: node.x + radius + 5, y1: node.y - 8, x2: node.x + radius + 5 + width, y2: node.y + 8 };
    const overlaps = placed.some((b) => box.x1 < b.x2 + 6 && box.x2 + 6 > b.x1 && box.y1 < b.y2 && box.y2 > b.y1);
    if (!overlaps) {
      placed.push(box);
      visible.add(node.id);
    }
  }
  return visible;
}

interface GraphViewProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onOpen: (node: GraphNode) => void;
}

export function GraphView({ nodes, edges, onOpen }: GraphViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<Simulation<SimNode, SimLink> | null>(null);

  const [size, setSize] = useState({ width: 800, height: 560 });
  const [simNodes, setSimNodes] = useState<SimNode[]>([]);
  const [simLinks, setSimLinks] = useState<SimLink[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });

  const dragRef = useRef<{ id: string; moved: boolean } | null>(null);
  const panRef = useRef<{ startX: number; startY: number; origin: { x: number; y: number } } | null>(null);
  const sizeRef = useRef(size);
  sizeRef.current = size;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setSize({ width: entry.contentRect.width, height: Math.max(420, entry.contentRect.height) });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const nodesCopy: SimNode[] = nodes.map((n) => ({ ...n }));
    const linksCopy: SimLink[] = edges.map((e) => ({ source: e.source, target: e.target, kind: e.kind, weight: e.weight }));

    const simulation = forceSimulation(nodesCopy)
      .force(
        'link',
        forceLink<SimNode, SimLink>(linksCopy)
          .id((d) => d.id)
          .distance((l) => (l.kind === 'link' ? 100 : 150))
          .strength((l) => (l.kind === 'link' ? 0.5 : 0.12)),
      )
      .force('charge', forceManyBody().strength(-260))
      .force('center', forceCenter(size.width / 2, size.height / 2))
      .force('collide', forceCollide<SimNode>().radius((d) => nodeRadius(d) + 8))
      .on('tick', () => {
        const padding = 24;
        // Labels only ever extend rightward from their node — reserve extra room on that side so a
        // node parked near the right edge doesn't get its own label clipped by the container.
        const labelMargin = 140;
        const bounds = sizeRef.current;
        for (const node of nodesCopy) {
          const radius = nodeRadius(node);
          if (node.x != null) node.x = Math.max(radius + padding, Math.min(bounds.width - radius - padding - labelMargin, node.x));
          if (node.y != null) node.y = Math.max(radius + padding, Math.min(bounds.height - radius - padding, node.y));
        }
        setSimNodes([...nodesCopy]);
        setSimLinks([...linksCopy]);
      });

    simulationRef.current = simulation;
    return () => {
      simulation.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges]);

  useEffect(() => {
    const sim = simulationRef.current;
    if (!sim) return;
    const centerForce = sim.force<ReturnType<typeof forceCenter>>('center');
    centerForce?.x(size.width / 2).y(size.height / 2);
    sim.alpha(0.3).restart();
  }, [size.width, size.height]);

  const connectedIds = useMemo(() => {
    if (!hoveredId) return null;
    const set = new Set<string>([hoveredId]);
    for (const link of simLinks) {
      const source = asNode(link.source)?.id ?? (typeof link.source === 'string' ? link.source : undefined);
      const target = asNode(link.target)?.id ?? (typeof link.target === 'string' ? link.target : undefined);
      if (source === hoveredId && target) set.add(target);
      if (target === hoveredId && source) set.add(source);
    }
    return set;
  }, [hoveredId, simLinks]);

  const visibleLabelIds = useMemo(() => pickVisibleLabels(simNodes), [simNodes]);

  const toSvgPoint = (clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: (clientX - rect.left - transform.x) / transform.k, y: (clientY - rect.top - transform.y) / transform.k };
  };

  const handleNodePointerDown = (node: SimNode, event: React.PointerEvent) => {
    event.stopPropagation();
    (event.target as Element).setPointerCapture(event.pointerId);
    dragRef.current = { id: node.id, moved: false };
    simulationRef.current?.alphaTarget(0.3).restart();
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    if (dragRef.current) {
      const node = simNodes.find((n) => n.id === dragRef.current?.id);
      if (node) {
        const point = toSvgPoint(event.clientX, event.clientY);
        node.fx = point.x;
        node.fy = point.y;
        dragRef.current.moved = true;
      }
      return;
    }
    if (panRef.current) {
      // Read the ref's value into locals now, synchronously — setTransform's updater can run
      // after this tick (React may defer/batch it), and panRef.current is a live, mutable value
      // that a concurrent pointercancel/pointerup can null out in between (touch gestures on
      // mobile fire these in quick, overlapping succession). Closing over `origin` here instead
      // of re-reading `panRef.current!.origin` inside the updater avoids that race.
      const { startX, startY, origin } = panRef.current;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      setTransform((prev) => ({ ...prev, x: origin.x + dx, y: origin.y + dy }));
    }
  };

  /** Releases in-progress drag/pan state. Used both by the normal pointerup path (which may also
   * trigger onOpen for a plain click) and by the cancel/safety-net paths below, which must never
   * navigate — only a clean pointerup counts as a click. */
  const releaseDrag = (open: boolean) => {
    if (dragRef.current) {
      const { id, moved } = dragRef.current;
      const node = simNodes.find((n) => n.id === id);
      if (node) {
        node.fx = null;
        node.fy = null;
      }
      simulationRef.current?.alphaTarget(0);
      dragRef.current = null;
      if (open && !moved) {
        const graphNode = nodes.find((n) => n.id === id);
        if (graphNode) onOpen(graphNode);
      }
    }
    panRef.current = null;
  };

  const handlePointerUp = (event: React.PointerEvent) => {
    releaseDrag(true);
    (event.target as Element).releasePointerCapture?.(event.pointerId);
  };

  // The browser can cancel a captured pointer without ever delivering pointerup — e.g. the mouse
  // button is released outside the window, the OS interrupts the gesture (alt-tab, a system
  // gesture), or focus otherwise leaves the page mid-drag. Without this, dragRef/panRef stay set
  // forever and the still-captured element keeps hijacking every later click on the page, since
  // pointer capture is never released — the app looks frozen until a full reload.
  const handlePointerCancel = (event: React.PointerEvent) => {
    releaseDrag(false);
    (event.target as Element).releasePointerCapture?.(event.pointerId);
  };

  const releaseDragRef = useRef(releaseDrag);
  releaseDragRef.current = releaseDrag;

  useEffect(() => {
    const releaseStuckDrag = () => {
      if (dragRef.current || panRef.current) releaseDragRef.current(false);
    };
    window.addEventListener('pointerup', releaseStuckDrag);
    window.addEventListener('pointercancel', releaseStuckDrag);
    window.addEventListener('blur', releaseStuckDrag);
    return () => {
      window.removeEventListener('pointerup', releaseStuckDrag);
      window.removeEventListener('pointercancel', releaseStuckDrag);
      window.removeEventListener('blur', releaseStuckDrag);
    };
  }, []);

  const handleBackgroundPointerDown = (event: React.PointerEvent) => {
    panRef.current = { startX: event.clientX, startY: event.clientY, origin: { x: transform.x, y: transform.y } };
  };

  // React attaches onWheel as a passive listener, so preventDefault() there is a no-op (and warns).
  // A native listener registered with { passive: false } is required to stop page scroll while zooming.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = svg.getBoundingClientRect();
      const pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1;
      setTransform((prev) => {
        const nextK = Math.min(3, Math.max(0.3, prev.k * factor));
        const scaleRatio = nextK / prev.k;
        return {
          k: nextK,
          x: pointer.x - (pointer.x - prev.x) * scaleRatio,
          y: pointer.y - (pointer.y - prev.y) * scaleRatio,
        };
      });
    };

    svg.addEventListener('wheel', handleWheel, { passive: false });
    return () => svg.removeEventListener('wheel', handleWheel);
  }, []);

  return (
    <Box
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        minHeight: 420,
        position: 'relative',
        overflow: 'hidden',
        cursor: panRef.current ? 'grabbing' : 'grab',
        touchAction: 'none',
      }}
    >
      <svg
        ref={svgRef}
        id="knowledge-graph-svg"
        width="100%"
        height="100%"
        style={{ display: 'block' }}
        onPointerDown={handleBackgroundPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.k})`}>
          {simLinks.map((link, i) => {
            const source = asNode(link.source);
            const target = asNode(link.target);
            if (!source || !target) return null;
            const dimmed = connectedIds ? !(connectedIds.has(source.id) && connectedIds.has(target.id)) : false;
            return (
              <line
                key={i}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                stroke={link.kind === 'link' ? 'var(--mantine-color-brand-5)' : 'var(--mantine-color-gray-5)'}
                strokeWidth={link.kind === 'link' ? Math.min(1 + link.weight * 0.6, 4) : 1}
                strokeDasharray={link.kind === 'tag' ? '3 3' : undefined}
                opacity={dimmed ? 0.08 : link.kind === 'link' ? 0.55 : 0.2}
              />
            );
          })}

          {simNodes.map((node) => {
            const dimmed = connectedIds ? !connectedIds.has(node.id) : false;
            const radius = nodeRadius(node);
            const showLabel = visibleLabelIds.has(node.id) || hoveredId === node.id || (connectedIds?.has(node.id) ?? false);
            return (
              <g
                key={node.id}
                transform={`translate(${node.x ?? 0}, ${node.y ?? 0})`}
                opacity={dimmed ? 0.25 : 1}
                style={{ cursor: 'pointer' }}
                onPointerDown={(e) => handleNodePointerDown(node, e)}
                onMouseEnter={() => setHoveredId(node.id)}
                onMouseLeave={() => setHoveredId((current) => (current === node.id ? null : current))}
              >
                <circle
                  r={radius}
                  fill={KIND_COLOR[node.kind]}
                  stroke={hoveredId === node.id ? 'var(--mantine-color-dark-9)' : 'transparent'}
                  strokeWidth={2}
                />
                {showLabel && (
                  <text
                    x={radius + 5}
                    y={4}
                    fontSize={11}
                    fontWeight={hoveredId === node.id ? 600 : 400}
                    fill="var(--mantine-color-text)"
                    stroke="var(--mantine-color-body)"
                    strokeWidth={3}
                    paintOrder="stroke"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {labelFor(node.title)}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {nodes.length === 0 && (
        <Box
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text size="sm" c="dimmed">
            Пока нет заметок для графа.
          </Text>
        </Box>
      )}
    </Box>
  );
}
