import React, { useCallback, useMemo, useState } from 'react';
import { PanelProps } from '@grafana/data';
import ReactFlow, { Background, Controls, Node, Edge, NodeChange } from 'reactflow';
import 'reactflow/dist/style.css';
import { TopologyPanelOptions } from '../types';
import { fromDataFrames, filterBySalesInvolved, toFlowElements } from '../utils/graphData';
import { layout } from '../utils/layout';
import { findAllPaths } from '../utils/pathfinding';
import { TopologyNode } from './TopologyNode';
import { TopologyEdge } from './TopologyEdge';

interface Props extends PanelProps<TopologyPanelOptions> {}

// Defined outside the component — React Flow requires nodeTypes/edgeTypes
// to be referentially stable across renders, or it re-warns/re-inits every render.
const nodeTypes = { topology: TopologyNode };
const edgeTypes = { topology: TopologyEdge };

// Read-only viewer. Data comes from Grafana's own query pipeline — whatever
// Cypher is configured in the "Queries" tab below, via the kniepdennis-
// neo4j-datasource plugin set to Format: Table — not from api/. Writes
// (create/delete nodes and relationships) live in the separate
// tradeflow-maintenance-panel, still going through api/.
export const TopologyPanel: React.FC<Props> = ({ width, height, data, options }) => {
  const style = useMemo(() => ({ width, height }), [width, height]);

  // Click a node to start a selection; Ctrl/Cmd-click a second node to see
  // what connects them. Clicking blank canvas clears the selection.
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Dagre only supplies the *initial* layout — React Flow's own drag
  // interaction only sticks if we complete the controlled-component
  // contract ourselves: without onNodesChange feeding dragged positions
  // back in here, a drag renders live for a moment and then snaps back on
  // the next re-render, since `nodes` below is otherwise always freshly
  // recomputed from data.series and never reflects the drag.
  const [draggedPositions, setDraggedPositions] = useState<Record<string, { x: number; y: number }>>({});

  const labelColors = useMemo(
    () => Object.fromEntries(options.nodeTypeColors.map((c) => [c.label, c.color])),
    [options.nodeTypeColors]
  );

  const { nodes, edges } = useMemo(() => {
    const { nodes: rawNodes, relationships: rawRels } = fromDataFrames(data.series);
    const filteredRels = filterBySalesInvolved(rawRels, options.salesInvolvedFilter);
    const { nodes: flowNodes, edges: flowEdges } = toFlowElements(rawNodes, filteredRels, labelColors);
    const laidOut = layout(flowNodes, flowEdges);
    const withDrags = laidOut.map((n) => (draggedPositions[n.id] ? { ...n, position: draggedPositions[n.id] } : n));
    return { nodes: withDrags, edges: flowEdges };
  }, [data.series, options.salesInvolvedFilter, labelColors, draggedPositions]);

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    // We only care about persisting drags — selection/dimension changes
    // are transient UI state React Flow already handles on its own.
    const moved = changes.filter(
      (c): c is Extract<NodeChange, { type: 'position' }> => c.type === 'position' && !!c.position
    );
    if (moved.length === 0) return;
    setDraggedPositions((prev) => {
      const next = { ...prev };
      for (const c of moved) next[c.id] = c.position!;
      return next;
    });
  }, []);

  const handleNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedIds((prev) => {
      if (event.ctrlKey || event.metaKey) {
        if (prev.includes(node.id)) return prev;
        return [...prev, node.id].slice(-2); // keep at most the last 2 picked
      }
      return [node.id]; // plain click starts a fresh selection
    });
  }, []);

  const handlePaneClick = useCallback(() => setSelectedIds([]), []);

  const paths = useMemo(() => {
    if (selectedIds.length !== 2) return [];
    return findAllPaths(edges, selectedIds[0], selectedIds[1]);
  }, [edges, selectedIds]);

  const { displayNodes, displayEdges } = useMemo(() => {
    if (selectedIds.length !== 2) {
      return { displayNodes: nodes, displayEdges: edges };
    }

    const pathEdgeIds = new Set(paths.flat());
    const pathNodeIds = new Set<string>(selectedIds);
    edges.forEach((e) => {
      if (pathEdgeIds.has(e.id)) {
        pathNodeIds.add(e.source);
        pathNodeIds.add(e.target);
      }
    });

    const dNodes = nodes.map((n) => ({
      ...n,
      style: {
        ...n.style,
        opacity: pathNodeIds.has(n.id) ? 1 : 0.2,
        boxShadow: selectedIds.includes(n.id) ? '0 0 0 3px #2563eb' : undefined,
      },
    }));
    const dEdges = edges.map((e) => ({
      ...e,
      style: { ...e.style, opacity: pathEdgeIds.has(e.id) ? 1 : 0.12, strokeWidth: pathEdgeIds.has(e.id) ? 3 : 1 },
      animated: pathEdgeIds.has(e.id),
    }));

    return { displayNodes: dNodes, displayEdges: dEdges };
  }, [nodes, edges, selectedIds, paths]);

  if (data.series.length === 0) {
    return (
      <div style={{ ...style, padding: 12, color: '#94a3b8', fontFamily: 'monospace', fontSize: 12 }}>
        No data. Set a Cypher query in the Queries tab below (data source: kniepdennis-neo4j-datasource, Format:
        Table) — e.g. MATCH (a)-[r]-&gt;(b) RETURN a, r, b
      </div>
    );
  }

  const selectionLabel =
    selectedIds.length === 2
      ? paths.length > 0
        ? `${paths.length} path${paths.length > 1 ? 's' : ''} found`
        : 'no path found within 6 hops'
      : selectedIds.length === 1
      ? 'Ctrl/Cmd-click a second node…'
      : null;

  return (
    <div style={{ ...style, position: 'relative' }}>
      {selectionLabel && (
        <div
          style={{
            position: 'absolute',
            top: 4,
            left: 4,
            zIndex: 5,
            fontSize: 11,
            padding: '2px 8px',
            borderRadius: 4,
            background: 'rgba(0,0,0,0.6)',
            color: '#fff',
          }}
        >
          {selectionLabel}
        </div>
      )}
      <ReactFlow
        nodes={displayNodes}
        edges={displayEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        style={{ background: '#0b1120' }}
        onNodesChange={handleNodesChange}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
};
