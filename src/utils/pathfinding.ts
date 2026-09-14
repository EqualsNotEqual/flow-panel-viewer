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

// Every node/edge reachable forward from a starting node, following edges
// only in their stored direction (same rule as findAllPaths). Used for
// hover-to-preview: unlike path-finding between two picked nodes, this has
// no second endpoint and no path enumeration -- just one BFS/DFS sweep
// marking everything downstream, so it's cheap even on a large graph.
export function findDownstream(edges: Edge[], fromId: string): { nodeIds: Set<string>; edgeIds: Set<string> } {
  const adjacency = new Map<string, Array<{ neighborId: string; edgeId: string }>>();
  for (const e of edges) {
    if (!adjacency.has(e.source)) adjacency.set(e.source, []);
    adjacency.get(e.source)!.push({ neighborId: e.target, edgeId: e.id });
  }

  const nodeIds = new Set<string>([fromId]);
  const edgeIds = new Set<string>();
  const stack = [fromId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const { neighborId, edgeId } of adjacency.get(current) || []) {
      edgeIds.add(edgeId);
      if (!nodeIds.has(neighborId)) {
        nodeIds.add(neighborId);
        stack.push(neighborId);
      }
    }
  }
  return { nodeIds, edgeIds };
}
