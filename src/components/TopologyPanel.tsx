import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanelProps } from '@grafana/data';
import { Icon, Input } from '@grafana/ui';
import ReactFlow, { Background, Controls, MarkerType, Node, Edge, NodeChange, ReactFlowInstance } from 'reactflow';
import 'reactflow/dist/style.css';
import { TopologyPanelOptions } from '../types';
import { fromDataFrames, toFlowElements, normalizeDisplayAttribute } from '../utils/graphData';
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

  // Right-click a node/edge to pick which of its own attributes stay
  // permanently visible on it (not just in the hover tooltip) -- e.g.
  // "show product on this one edge". Per-element (keyed by id), not a
  // type-wide default; survives a data refresh the same way draggedPositions
  // does, since real Memgraph element ids are stable across refreshes.
  const [visibleProps, setVisibleProps] = useState<Record<string, string[]>>({});
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    elementId: string;
    properties: Record<string, any>;
    defaultShowKeys: string[];
  } | null>(null);

  // Right-click blank canvas -- separate from the node/edge attribute menu
  // above -- for "Reset layout": clearing draggedPositions falls back to a
  // fresh dagre pass for every node in one shot, the undo manual dragging
  // otherwise has no way to get back from (short of re-dragging everything
  // by hand).
  const [paneContextMenu, setPaneContextMenu] = useState<{ x: number; y: number } | null>(null);

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
    const laidOut = layout(flowNodes, flowEdges, options.groupByLabel);
    const withDrags = laidOut.map((n) => (draggedPositions[n.id] ? { ...n, position: draggedPositions[n.id] } : n));
    return { nodes: withDrags, edges: flowEdges };
  }, [data.series, labelColors, labelIcons, edgeStyles, options.groupByLabel, draggedPositions]);

  // Keyed on data.request?.requestId (not `nodes` or even data.series) so a
  // manual drag -- which also changes `nodes` via draggedPositions -- doesn't
  // fight the user by resetting their pan/zoom, while a genuine refresh
  // reliably refits even when the query returns identical data: Grafana
  // mints a new requestId on every execution regardless of whether the
  // result content (and thus data.series's own identity) actually changed.
  useEffect(() => {
    if (!rfInstance) return;
    rfInstance.fitView({ padding: 0.15, minZoom: 0.05 });
  }, [rfInstance, data.request?.requestId]);

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

  const handlePaneClick = useCallback(() => {
    setSelectedIds([]);
    setContextMenu(null);
    setPaneContextMenu(null);
  }, []);

  const handlePaneContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    setPaneContextMenu({ x: event.clientX, y: event.clientY });
  }, []);

  const handleResetLayout = useCallback(() => {
    setDraggedPositions({});
    setPaneContextMenu(null);
    // Deferred to the next paint -- fitView reads committed DOM positions,
    // and calling it synchronously here would race React's batched state
    // update, measuring the old (still-dragged) layout instead of the fresh
    // dagre one.
    requestAnimationFrame(() => rfInstance?.fitView({ padding: 0.15, minZoom: 0.05 }));
  }, [rfInstance]);

  const handleNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    const nodeData = node.data as { properties?: Record<string, any> };
    // name's already the card's own bold label; displayAttribute is
    // meta-configuration about what to show, not itself worth showing.
    const { name, displayAttribute, ...rest } = nodeData.properties || {};
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      elementId: node.id,
      properties: rest,
      // Computed straight from the raw property, never from node.data.showKeys
      // -- that field is already the union of this default with any local
      // right-click pick (see finalDisplayNodes), so reading it back here
      // would misclassify a previous local pick as a locked-in default on
      // the second right-click.
      defaultShowKeys: normalizeDisplayAttribute(displayAttribute),
    });
  }, []);

  const handleEdgeContextMenu = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.preventDefault();
    const edgeData = edge.data as { properties?: Record<string, any> } | undefined;
    const { displayAttribute, ...rest } = edgeData?.properties || {};
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      elementId: edge.id,
      properties: rest,
      defaultShowKeys: normalizeDisplayAttribute(displayAttribute),
    });
  }, []);

  const toggleVisibleProp = useCallback((elementId: string, key: string) => {
    setVisibleProps((prev) => {
      const current = prev[elementId] || [];
      const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
      return { ...prev, [elementId]: next };
    });
  }, []);

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

  // Layered on last, independent of which highlight branch above produced
  // displayNodes/displayEdges -- so right-click picks keep showing
  // regardless of whether search/hover/path-select is also active.
  const finalDisplayNodes = useMemo(
    () =>
      displayNodes.map((n) => {
        const override = visibleProps[n.id];
        if (!override || override.length === 0) return n;
        const existing = (n.data as { showKeys?: string[] }).showKeys || [];
        return { ...n, data: { ...n.data, showKeys: Array.from(new Set([...existing, ...override])) } };
      }),
    [displayNodes, visibleProps]
  );
  const finalDisplayEdges = useMemo(
    () =>
      displayEdges.map((e) => {
        const override = visibleProps[e.id];
        if (!override || override.length === 0) return e;
        const existing = (e.data as { showKeys?: string[] } | undefined)?.showKeys || [];
        return { ...e, data: { ...e.data, showKeys: Array.from(new Set([...existing, ...override])) } };
      }),
    [displayEdges, visibleProps]
  );

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
        nodes={finalDisplayNodes}
        edges={finalDisplayEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        style={{ background: '#0b1120' }}
        onNodesChange={handleNodesChange}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        onPaneClick={handlePaneClick}
        onNodeMouseEnter={handleNodeMouseEnter}
        onNodeMouseLeave={handleNodeMouseLeave}
        onNodeContextMenu={handleNodeContextMenu}
        onEdgeContextMenu={handleEdgeContextMenu}
        onPaneContextMenu={handlePaneContextMenu}
        onInit={setRfInstance}
        minZoom={0.05}
      >
        <Background />
        <Controls />
      </ReactFlow>
      {contextMenu && (
        <>
          <div
            onClick={() => setContextMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu(null);
            }}
            style={{ position: 'fixed', inset: 0, zIndex: 30 }}
          />
          <div
            style={{
              position: 'fixed',
              top: contextMenu.y,
              left: contextMenu.x,
              zIndex: 31,
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 6,
              padding: 6,
              minWidth: 170,
              boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
              fontSize: 12,
            }}
          >
            <div style={{ color: '#94a3b8', fontWeight: 600, padding: '2px 8px', marginBottom: 2 }}>
              Show attribute
            </div>
            {Object.keys(contextMenu.properties).length === 0 ? (
              <div style={{ color: '#64748b', padding: '4px 8px' }}>No attributes</div>
            ) : (
              Object.keys(contextMenu.properties).map((key) => {
                const isDefault = contextMenu.defaultShowKeys.includes(key);
                return (
                  <label
                    key={key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '4px 8px',
                      cursor: isDefault ? 'default' : 'pointer',
                      color: isDefault ? '#64748b' : '#e2e8f0',
                    }}
                    title={isDefault ? 'Shared default (set via displayAttribute) -- always shown for everyone' : undefined}
                  >
                    <input
                      type="checkbox"
                      checked={isDefault || (visibleProps[contextMenu.elementId] || []).includes(key)}
                      disabled={isDefault}
                      onChange={() => toggleVisibleProp(contextMenu.elementId, key)}
                    />
                    {key}
                    {isDefault && ' (default)'}
                  </label>
                );
              })
            )}
          </div>
        </>
      )}
      {paneContextMenu && (
        <>
          <div
            onClick={() => setPaneContextMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setPaneContextMenu(null);
            }}
            style={{ position: 'fixed', inset: 0, zIndex: 30 }}
          />
          <div
            style={{
              position: 'fixed',
              top: paneContextMenu.y,
              left: paneContextMenu.x,
              zIndex: 31,
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 6,
              padding: 6,
              minWidth: 150,
              boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
              fontSize: 12,
            }}
          >
            <button
              onClick={handleResetLayout}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '6px 8px',
                background: 'transparent',
                border: 'none',
                color: '#e2e8f0',
                cursor: 'pointer',
                fontSize: 12,
              }}
              title="Discards any manually dragged positions and re-runs the automatic layout"
            >
              Reset layout
            </button>
          </div>
        </>
      )}
    </div>
  );
};
