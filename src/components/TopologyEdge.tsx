import React, { useState } from 'react';
import { EdgeProps, EdgeLabelRenderer, getStraightPath, MarkerType, BaseEdge } from 'reactflow';

export interface TopologyEdgeData {
  label: string;
  fullLabel: string;
  stroke: string;
  dashed: boolean;
}

// Nothing but the colored/dashed line is shown by default — a packed
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
  const [edgePath, labelX, labelY] = getStraightPath({ sourceX, sourceY, targetX, targetY });

  const stroke = data?.stroke || '#3b82f6';

  return (
    <>
      <g onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
        <BaseEdge
          id={id}
          path={edgePath}
          markerEnd={markerEnd}
          style={{
            ...style,
            stroke,
            strokeWidth: style?.strokeWidth ?? 2,
            strokeDasharray: data?.dashed ? '5 4' : undefined,
          }}
        />
      </g>
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
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

export const topologyMarkerEnd = { type: MarkerType.ArrowClosed };
