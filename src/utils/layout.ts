import dagre from 'dagre';
import { Node, Edge } from 'reactflow';

const NODE_WIDTH = 150;
const NODE_HEIGHT = 52; // taller to fit the two-line name/type card

// React Flow has no built-in auto-arrange (unlike Graphviz's DOT engine) —
// dagre computes a left-to-right layered position for each node, same
// rankdir=LR idea as the earlier DOT query.
//
// groupByLabel (opt-in, see TopologyPanelOptions) uses dagre's own compound-
// graph support (graphlib's setParent/compound:true, verified directly in
// dagre's source -- a first-class feature, not a workaround) to cluster
// nodes sharing the same groupLabel (see graphData.ts) together as a unit,
// with a synthetic cluster node per distinct label that's never rendered --
// only ids already present in `nodes` get mapped back below, so the
// synthetic ones are naturally dropped.
export function layout(nodes: Node[], edges: Edge[], groupByLabel = false): Node[] {
  const g = new dagre.graphlib.Graph({ compound: groupByLabel });
  g.setDefaultEdgeLabel(() => ({}));
  // ranksep wider than the node dimensions alone would need — the edge
  // label pills sitting on each connector need real room, or they collide
  // with the neighboring node cards.
  g.setGraph({ rankdir: 'LR', nodesep: 60, ranksep: 170 });

  nodes.forEach((n) => g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT }));
  edges.forEach((e) => g.setEdge(e.source, e.target));

  if (groupByLabel) {
    const clusterIds = new Set<string>();
    nodes.forEach((n) => {
      const groupLabel = (n.data as { groupLabel?: string } | undefined)?.groupLabel;
      if (!groupLabel) return;
      const clusterId = `__cluster_${groupLabel}`;
      if (!clusterIds.has(clusterId)) {
        clusterIds.add(clusterId);
        g.setNode(clusterId, {});
      }
      g.setParent(n.id, clusterId);
    });
  }

  dagre.layout(g);

  return nodes.map((n) => {
    const pos = g.node(n.id);
    return {
      ...n,
      position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 },
    };
  });
}
