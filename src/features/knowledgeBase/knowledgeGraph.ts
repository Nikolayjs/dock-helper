import { extractWikiLinkTitles } from './wikiLinks';
import type { KnowledgeDocument, KnowledgeKind } from './types';

export interface GraphNode {
  id: string;
  title: string;
  kind: KnowledgeKind;
  tags: string[];
  connectionCount: number;
}

export type GraphEdgeKind = 'link' | 'tag';

export interface GraphEdge {
  source: string;
  target: string;
  kind: GraphEdgeKind;
  weight: number;
  label?: string;
}

export interface KnowledgeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export function buildKnowledgeGraph(documents: KnowledgeDocument[]): KnowledgeGraph {
  const byTitleLower = new Map(documents.map((doc) => [doc.title.trim().toLowerCase(), doc]));
  const edgeMap = new Map<string, GraphEdge>();

  const addEdge = (aId: string, bId: string, kind: GraphEdgeKind, weight: number, label?: string) => {
    if (aId === bId) return;
    const [source, target] = [aId, bId].sort();
    const key = `${source}|${target}|${kind}`;
    const existing = edgeMap.get(key);
    if (existing) {
      existing.weight += weight;
    } else {
      edgeMap.set(key, { source, target, kind, weight, label });
    }
  };

  for (const doc of documents) {
    for (const linkedTitle of extractWikiLinkTitles(doc.content)) {
      const target = byTitleLower.get(linkedTitle.trim().toLowerCase());
      if (target) addEdge(doc.id, target.id, 'link', 3);
    }
  }

  // Two docs sharing a single broad tag (e.g. every ENT doc tagged 'оториноларингология') is nearly
  // no signal — with enough of them it makes the tag graph a near-complete blob. Requiring 2+ shared
  // tags means an edge only forms when documents overlap on a specific sub-topic too, not just the
  // broad specialty everything in that section already carries.
  const MIN_SHARED_TAGS = 2;
  for (let i = 0; i < documents.length; i++) {
    for (let j = i + 1; j < documents.length; j++) {
      const shared = documents[i].tags.filter((tag) => documents[j].tags.includes(tag));
      if (shared.length >= MIN_SHARED_TAGS) addEdge(documents[i].id, documents[j].id, 'tag', shared.length, shared.join(', '));
    }
  }

  const edges = [...edgeMap.values()];

  const connectionCounts = new Map<string, number>();
  for (const edge of edges) {
    connectionCounts.set(edge.source, (connectionCounts.get(edge.source) ?? 0) + 1);
    connectionCounts.set(edge.target, (connectionCounts.get(edge.target) ?? 0) + 1);
  }

  const nodes: GraphNode[] = documents.map((doc) => ({
    id: doc.id,
    title: doc.title,
    kind: doc.kind,
    tags: doc.tags,
    connectionCount: connectionCounts.get(doc.id) ?? 0,
  }));

  return { nodes, edges };
}
