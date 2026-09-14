import React, { useState } from 'react';
import { EdgeProps, EdgeLabelRenderer, getStraightPath, MarkerType, BaseEdge } from 'reactflow';
import { formatPropValue } from '../utils/graphData';
import { useZoomTier } from '../utils/zoom';

export interface TopologyEdgeData {
  label: string;
  fullLabel: string;
  stroke: string;
  strokeDasharray?: string;
  url?: string;
  properties?: Record<string, any>;
  showKeys?: string[];
}

// Nothing but the colored line is shown by default — a packed
// diagram has no room for permanent labels on every edge without them
// colliding with each other and with node cards. Hovering the line reveals
// the full detail (type, product/protocol, desks, condition) in a floating
// badge, rendered via EdgeLabelRenderer (a portal — needed since plain SVG
// <text> can't have a background/border/padding).
export const TopologyEdge: React.FC<EdgeProps<TopologyEdgeData>> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  style,
  markerEnd,
}) => {
  const [hovered, setHovered] = useState(false);
  const zoomTier = useZoomTier();
  const [edgePath, labelX, labelY] = getStraightPath({ sourceX, sourceY, targetX, targetY });

  const stroke = data?.stroke || '#3b82f6';

  return (
    <>
      <g onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} style={{ cursor: data?.url ? 'pointer' : undefined }}>
        <BaseEdge
          id={id}
          path={edgePath}
          markerEnd={markerEnd}
          style={{
            ...style,
            stroke,
            strokeWidth: style?.strokeWidth ?? 2,
            strokeDasharray: data?.strokeDasharray,
          }}
        />
      </g>
      {zoomTier === 'close' && data?.showKeys && data.showKeys.length > 0 && (
        // Right-click "show this attribute" picks -- always visible, unlike
        // the hover-only fullLabel below, since the whole point is not
        // needing to hover to see it. Nudged up slightly so it doesn't sit
        // exactly on top of the hover badge if both happen to be showing.
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY - 16}px)`,
              pointerEvents: 'none',
              background: '#1e293b',
              border: `1px solid ${stroke}`,
              borderRadius: 4,
              padding: '2px 7px',
              fontSize: 10,
              fontWeight: 600,
              fontFamily: "'IBM Plex Mono', 'Courier New', monospace",
              color: '#e2e8f0',
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
              zIndex: 19,
            }}
          >
            {data.showKeys.map((k) => `${k}: ${formatPropValue(data.properties?.[k])}`).join(' · ')}
          </div>
        </EdgeLabelRenderer>
      )}
      {hovered && (data?.fullLabel || data?.label) && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'none',
              background: '#1e293b',
              border: `1px solid ${stroke}`,
              borderRadius: 4,
              padding: '3px 9px',
              fontSize: 11,
              fontWeight: 600,
              fontFamily: "'IBM Plex Mono', 'Courier New', monospace",
              color: '#e2e8f0',
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
              zIndex: 20,
            }}
          >
            {data.fullLabel || data.label}
            {data.url ? ' ↗' : ''}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

export const topologyMarkerEnd = { type: MarkerType.ArrowClosed };
