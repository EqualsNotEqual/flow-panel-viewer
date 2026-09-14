import { Edge } from 'reactflow';

// Enumerates every simple path (no repeated nodes) between two node ids,
// following edges only in their stored direction (source -> target). Chains
// like SENDS_TRADE_TO represent a real, one-way trade flow -- treating them
// as undirected let path-selection "cheat" backwards through a shared
// downstream node (e.g. hopping through Impact in reverse to connect two
// otherwise-unrelated nodes), surfacing paths no trade would ever actually
// take. Returns one array of edge ids per distinct path found.
export function findAllPaths(edges: Edge[], fromId: string, toId: string, maxHops = 10): string[][] {
  const adjacency = new Map<string, Array<{ neighborId: string; edgeId: string }>>();
  for (const e of edges) {
    if (!adjacency.has(e.source)) adjacency.set(e.source, []);
    adjacency.get(e.source)!.push({ neighborId: e.target, edgeId: e.id });
  }

  const results: string[][] = [];
  const visited = new Set<string>([fromId]);
  const currentPath: string[] = [];

  function dfs(currentId: string, depth: number) {
    if (currentId === toId) {
      results.push([...currentPath]);
      return;
    }
    if (depth >= maxHops) return;
    for (const { neighborId, edgeId } of adjacency.get(currentId) || []) {
      if (visited.has(neighborId)) continue;
      visited.add(neighborId);
      currentPath.push(edgeId);
      dfs(neighborId, depth + 1);
      currentPath.pop();
      visited.delete(neighborId);
    }
  }

  dfs(fromId, 0);
  return results;
}

export interface Neighbors {
  incomingNodeIds: Set<string>;
  incomingEdgeIds: Set<string>;
  outgoingNodeIds: Set<string>;
  outgoingEdgeIds: Set<string>;
}

// Every node/edge exactly one hop from a given node, split by direction.
// Used for hover-to-preview: an "ego view" centered on the hovered node --
// its direct predecessors and successors only, not the full forward chain
// (which on a dense, many-hop graph like the ION routing pipeline dims
// almost nothing and isn't actually more informative than just looking at
// the whole diagram).
export function findNeighbors(edges: Edge[], nodeId: string): Neighbors {
  const incomingNodeIds = new Set<string>();
  const incomingEdgeIds = new Set<string>();
  const outgoingNodeIds = new Set<string>();
  const outgoingEdgeIds = new Set<string>();
  for (const e of edges) {
    if (e.target === nodeId) {
      incomingNodeIds.add(e.source);
      incomingEdgeIds.add(e.id);
    }
    if (e.source === nodeId) {
      outgoingNodeIds.add(e.target);
      outgoingEdgeIds.add(e.id);
    }
  }
  return { incomingNodeIds, incomingEdgeIds, outgoingNodeIds, outgoingEdgeIds };
}
