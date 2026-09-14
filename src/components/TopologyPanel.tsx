import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanelProps } from '@grafana/data';
import { Icon, Input } from '@grafana/ui';
import ReactFlow, { Background, Controls, MarkerType, Node, Edge, NodeChange, ReactFlowInstance } from 'reactflow';
import 'reactflow/dist/style.css';
import { TopologyPanelOptions } from '../types';
import { fromDataFrames, toFlowElements } from '../utils/graphData';
import { layout } from '../utils/layout';
import { findAllPaths, findNeighbors } from '../utils/pathfinding';
import { TopologyNode } from './TopologyNode';
import { FilterNode } from './FilterNode';
import { TopologyEdge } from './TopologyEdge';

interface Props extends PanelProps<TopologyPanelOptions> {}

// Only ever navigate to plain http(s) links -- a node/edge's `url` property
// comes from graph data (Cypher run by whoever has write access), not from
// this viewer's own user input, but guarding the scheme costs nothing and
// rules out something like a stray `javascript:` value ever being opened.
function openSafeUrl(url: string): void {
  if (/^https?:\/\//i.test(url)) {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

// Defined outside the component — React Flow requires nodeTypes/edgeTypes
// to be referentially stable across renders, or it re-warns/re-inits every render.
const nodeTypes = { topology: TopologyNode, filter: FilterNode };
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

  // The `fitView` prop only auto-fits once, on React Flow's own initial
  // mount -- it doesn't refit when `nodes` changes later (new query
  // results, a bigger dataset, etc.), which is exactly when a fresh fit is
  // needed most. Capturing the instance and refitting imperatively in an
  // effect keyed on `nodes` covers every data change, not just the first.
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);

  // Free-text only, deliberately not Cypher -- this panel is read-only for
  // viewers and shares its datasource connection with the Regulator panel's
  // writes, so a live query box here would turn a read-only viewer into an
  // arbitrary-query surface. Matches against the already-loaded name/labels,
  // client-side, no new request sent.
  const [searchText, setSearchText] = useState('');

  // Hover-to-preview: mousing over a node centers an "ego view" on it --
  // direct predecessors highlighted blue, direct successors green,
  // everything beyond one hop dimmed. Only active when neither search nor
  // a click-selected path is already showing something more deliberate --
  // those take precedence.
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const hoverClearTimeoutRef = useRef<number | null>(null);

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

  const labelIcons = useMemo(
    () =>
      Object.fromEntries(
        options.nodeTypeColors.filter((c) => c.icon).map((c) => [c.label, c.icon as string])
      ),
    [options.nodeTypeColors]
  );

  const edgeStyles = useMemo(
    () =>
      Object.fromEntries(options.edgeTypeColors.map((c) => [c.label, { color: c.color, lineStyle: c.lineStyle }])),
    [options.edgeTypeColors]
  );

  const { nodes, edges } = useMemo(() => {
    const { nodes: rawNodes, relationships: rawRels } = fromDataFrames(data.series);
    const { nodes: flowNodes, edges: flowEdges } = toFlowElements(
      rawNodes,
      rawRels,
      labelColors,
      labelIcons,
      edgeStyles
    );
    const laidOut = layout(flowNodes, flowEdges);
    const withDrags = laidOut.map((n) => (draggedPositions[n.id] ? { ...n, position: draggedPositions[n.id] } : n));
    return { nodes: withDrags, edges: flowEdges };
  }, [data.series, labelColors, labelIcons, edgeStyles, draggedPositions]);

  // Keyed on data.series (not `nodes`) so a manual drag -- which also
  // changes `nodes` via draggedPositions -- doesn't fight the user by
  // resetting their pan/zoom. Only a genuinely new/changed query result
  // triggers a refit.
  useEffect(() => {
    if (!rfInstance) return;
    rfInstance.fitView({ padding: 0.15, minZoom: 0.05 });
  }, [rfInstance, data.series]);

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
    const url = (node.data as { url?: string }).url;
    if (!event.ctrlKey && !event.metaKey && url) {
      openSafeUrl(url);
      return;
    }
    setSelectedIds((prev) => {
      if (event.ctrlKey || event.metaKey) {
        if (prev.includes(node.id)) return prev;
        return [...prev, node.id].slice(-2); // keep at most the last 2 picked
      }
      return [node.id]; // plain click starts a fresh selection
    });
  }, []);

  const handleEdgeClick = useCallback((_event: React.MouseEvent, edge: Edge) => {
    const url = (edge.data as { url?: string } | undefined)?.url;
    if (url) openSafeUrl(url);
  }, []);

  const handlePaneClick = useCallback(() => setSelectedIds([]), []);

  // Moving the mouse directly from one node onto an adjacent one fires
  // "leave" (old node) then "enter" (new node) as two separate events --
  // clearing the highlight immediately on leave produces a one-frame flash
  // of "nothing highlighted" in between, which reads as a flicker. Delaying
  // the clear briefly, and cancelling it if a new node is entered first,
  // makes that transition read as one smooth handoff instead.
  const handleNodeMouseEnter = useCallback((_event: React.MouseEvent, node: Node) => {
    if (hoverClearTimeoutRef.current !== null) {
      window.clearTimeout(hoverClearTimeoutRef.current);
      hoverClearTimeoutRef.current = null;
    }
    setHoveredNodeId(node.id);
  }, []);
  const handleNodeMouseLeave = useCallback(() => {
    hoverClearTimeoutRef.current = window.setTimeout(() => {
      setHoveredNodeId(null);
      hoverClearTimeoutRef.current = null;
    }, 60);
  }, []);

  useEffect(() => {
    return () => {
      if (hoverClearTimeoutRef.current !== null) window.clearTimeout(hoverClearTimeoutRef.current);
    };
  }, []);

  const hasActiveSearch = searchText.trim().length > 0;

  const searchMatchIds = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return new Set<string>();
    return new Set(
      nodes
        .filter((n) => {
          const label = String((n.data as { label?: string }).label ?? '').toLowerCase();
          const sublabel = String((n.data as { sublabel?: string }).sublabel ?? '').toLowerCase();
          return label.includes(q) || sublabel.includes(q);
        })
        .map((n) => n.id)
    );
  }, [nodes, searchText]);

  const paths = useMemo(() => {
    if (selectedIds.length !== 2) return [];
    return findAllPaths(edges, selectedIds[0], selectedIds[1]);
  }, [edges, selectedIds]);

  const neighbors = useMemo(
    () => (hoveredNodeId ? findNeighbors(edges, hoveredNodeId) : null),
    [edges, hoveredNodeId]
  );

  const { displayNodes, displayEdges } = useMemo(() => {
    if (hasActiveSearch) {
      const dNodes = nodes.map((n) => ({
        ...n,
        style: {
          ...n.style,
          opacity: searchMatchIds.has(n.id) ? 1 : 0.15,
          boxShadow: searchMatchIds.has(n.id) ? '0 0 14px 4px rgba(250, 204, 21, 0.85)' : undefined,
        },
      }));
      const dEdges = edges.map((e) => ({
        ...e,
        style: {
          ...e.style,
          opacity: searchMatchIds.has(e.source) || searchMatchIds.has(e.target) ? 0.6 : 0.08,
        },
      }));
      return { displayNodes: dNodes, displayEdges: dEdges };
    }

    if (selectedIds.length !== 2) {
      if (neighbors && hoveredNodeId) {
        const INCOMING_COLOR = '#3b82f6'; // blue
        const OUTGOING_COLOR = '#22c55e'; // green
        const visibleNodeIds = new Set([hoveredNodeId, ...neighbors.incomingNodeIds, ...neighbors.outgoingNodeIds]);

        const dNodes = nodes.map((n) => {
          const isIncoming = neighbors.incomingNodeIds.has(n.id);
          const isOutgoing = neighbors.outgoingNodeIds.has(n.id);
          const overrideColor = isIncoming ? INCOMING_COLOR : isOutgoing ? OUTGOING_COLOR : undefined;
          return {
            ...n,
            data: overrideColor ? { ...n.data, color: overrideColor } : n.data,
            style: {
              ...n.style,
              opacity: visibleNodeIds.has(n.id) ? 1 : 0.15,
              boxShadow: n.id === hoveredNodeId ? '0 0 0 3px #f8fafc' : undefined,
            },
          };
        });
        const dEdges = edges.map((e) => {
          const isIncoming = neighbors.incomingEdgeIds.has(e.id);
          const isOutgoing = neighbors.outgoingEdgeIds.has(e.id);
          const overrideColor = isIncoming ? INCOMING_COLOR : isOutgoing ? OUTGOING_COLOR : undefined;
          return {
            ...e,
            data: overrideColor ? { ...e.data, stroke: overrideColor } : e.data,
            style: { ...e.style, opacity: isIncoming || isOutgoing ? 1 : 0.08 },
            markerEnd: overrideColor ? { type: MarkerType.ArrowClosed, color: overrideColor } : e.markerEnd,
            animated: isIncoming || isOutgoing,
          };
        });
        return { displayNodes: dNodes, displayEdges: dEdges };
      }
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
  }, [nodes, edges, selectedIds, paths, hasActiveSearch, searchMatchIds, neighbors, hoveredNodeId]);

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
        : 'no path found within 10 hops'
      : selectedIds.length === 1
      ? 'Ctrl/Cmd-click a second node…'
      : null;

  return (
    <div style={{ ...style, position: 'relative' }}>
      <div style={{ position: 'absolute', top: 4, right: 4, zIndex: 5, width: 200 }}>
        <Input
          prefix={<Icon name="search" />}
          placeholder="Search nodes…"
          value={searchText}
          onChange={(e) => setSearchText(e.currentTarget.value)}
          size="sm"
        />
        {hasActiveSearch && (
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2, textAlign: 'right' }}>
            {searchMatchIds.size} match{searchMatchIds.size === 1 ? '' : 'es'}
          </div>
        )}
      </div>
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
        onEdgeClick={handleEdgeClick}
        onPaneClick={handlePaneClick}
        onNodeMouseEnter={handleNodeMouseEnter}
        onNodeMouseLeave={handleNodeMouseLeave}
        onInit={setRfInstance}
        minZoom={0.05}
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
};
