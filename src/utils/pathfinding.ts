import { Edge } from 'reactflow';

// Enumerates every simple path (no repeated nodes) between two node ids,
// treating edges as undirected — mirrors the undirected variable-length
// traversal semantics already used server-side for the desk/product/
// destination intersection filter in api/src/routes/graph.js. Returns one
// array of edge ids per distinct path found.
export function findAllPaths(edges: Edge[], fromId: string, toId: string, maxHops = 6): string[][] {
  const adjacency = new Map<string, Array<{ neighborId: string; edgeId: string }>>();
  for (const e of edges) {
    if (!adjacency.has(e.source)) adjacency.set(e.source, []);
    if (!adjacency.has(e.target)) adjacency.set(e.target, []);
    adjacency.get(e.source)!.push({ neighborId: e.target, edgeId: e.id });
    adjacency.get(e.target)!.push({ neighborId: e.source, edgeId: e.id });
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
