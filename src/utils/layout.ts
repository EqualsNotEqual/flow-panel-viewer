import dagre from 'dagre';
import { Node, Edge } from 'reactflow';

const NODE_WIDTH = 150;
const NODE_HEIGHT = 52; // taller to fit the two-line name/type card

// React Flow has no built-in auto-arrange (unlike Graphviz's DOT engine) —
// dagre computes a left-to-right layered position for each node, same
// rankdir=LR idea as the earlier DOT query.
export function layout(nodes: Node[], edges: Edge[]): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  // ranksep wider than the node dimensions alone would need — the edge
  // label pills sitting on each connector need real room, or they collide
  // with the neighboring node cards.
  g.setGraph({ rankdir: 'LR', nodesep: 60, ranksep: 170 });

  nodes.forEach((n) => g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT }));
  edges.forEach((e) => g.setEdge(e.source, e.target));

  dagre.layout(g);

  return nodes.map((n) => {
    const pos = g.node(n.id);
    return {
      ...n,
      position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 },
    };
  });
}
