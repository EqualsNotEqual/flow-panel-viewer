import { Node, Edge, MarkerType } from 'reactflow';
import { DataFrame } from '@grafana/data';

export interface RawNode {
  id: string;
  labels: string[];
  properties: Record<string, any>;
}

export interface RawRelationship {
  id: string;
  type: string;
  properties: Record<string, any>;
  sourceId: string;
  targetId: string;
}

// Parses whatever the kniepdennis-neo4j-datasource plugin's "Table" format
// hands the panel via the normal Grafana query pipeline (Queries tab, any
// Cypher, no api/ involved). Verified directly against a live query rather
// than assumed: each RETURN'd variable becomes one string-typed field, and
// every cell is a JSON-encoded node or relationship, PascalCase, e.g.
// node:  {"Id":57,"ElementId":"57","Labels":["Circuit"],"Props":{...}}
// edge:  {"Id":55,"ElementId":"55","StartElementId":"57","EndElementId":"4404","Type":"IN","Props":{}}
// Deliberately tolerant of anything else in the result (plain scalar
// columns, nulls, unparseable strings) — those are just skipped, not errors,
// since a query is free to RETURN extra non-graph values alongside a, r, b.
export function fromDataFrames(series: DataFrame[]): { nodes: RawNode[]; relationships: RawRelationship[] } {
  const nodesById = new Map<string, RawNode>();
  const relsById = new Map<string, RawRelationship>();

  for (const frame of series) {
    const rowCount = frame.length ?? frame.fields[0]?.values.length ?? 0;
    for (const field of frame.fields) {
      for (let i = 0; i < rowCount; i++) {
        const raw = (field.values as any)[i];
        if (typeof raw !== 'string') continue;
        let parsed: any;
        try {
          parsed = JSON.parse(raw);
        } catch {
          continue; // not JSON — a plain scalar column, ignore
        }
        if (!parsed || typeof parsed !== 'object' || !parsed.ElementId) continue;

        if (Array.isArray(parsed.Labels)) {
          nodesById.set(parsed.ElementId, {
            id: parsed.ElementId,
            labels: parsed.Labels,
            properties: parsed.Props || {},
          });
        } else if (typeof parsed.Type === 'string' && parsed.StartElementId && parsed.EndElementId) {
          relsById.set(parsed.ElementId, {
            id: parsed.ElementId,
            type: parsed.Type,
            properties: parsed.Props || {},
            sourceId: parsed.StartElementId,
            targetId: parsed.EndElementId,
          });
        }
      }
    }
  }

  return { nodes: [...nodesById.values()], relationships: [...relsById.values()] };
}

const LINE_DASH_ARRAYS: Record<string, string> = {
  dashed: '5 4',
  dotted: '1 4',
};

// Shared by TopologyNode/FilterNode/TopologyEdge for rendering a
// user-picked property (via right-click "show this attribute") as
// "key: value" text -- arrays join with commas rather than showing as
// ["a","b"].
export function formatPropValue(value: any): string {
  return Array.isArray(value) ? value.join(', ') : String(value);
}

// A node/edge's own `displayAttribute` property (set like any other
// property, e.g. through the Regulator panel) names which of its attributes
// should always render visibly -- a shared, data-driven default, unlike the
// viewer's local right-click picks which only affect the browser session
// that made them. Normalizes a single string or a real Cypher list into a
// plain string array either way.
function normalizeDisplayAttribute(value: any): string[] {
  if (value == null) return [];
  return Array.isArray(value) ? value.map(String) : [String(value)];
}

export interface EdgeStyleConfig {
  color: string;
  lineStyle?: 'solid' | 'dashed' | 'dotted';
}

// Generic label->style lookup, same idea as node type colors -- no
// relationship type gets special-cased in code. Unmapped types fall back to
// the blue/solid line that used to be the hardcoded default.
function resolveEdgeStyle(
  type: string,
  edgeStyles: Record<string, EdgeStyleConfig>
): { stroke: string; strokeDasharray?: string } {
  const config = edgeStyles[type];
  return { stroke: config?.color || '#3b82f6', strokeDasharray: config?.lineStyle ? LINE_DASH_ARRAYS[config.lineStyle] : undefined };
}

// The full label — used as a hover tooltip, where there's no space
// constraint and every detail (type, product/protocol, desks, condition)
// is worth showing.
function buildEdgeFullLabel(type: string, props: Record<string, any>): string {
  const bits = [type];
  if (props.product) bits.push(props.product);
  if (props.protocol) bits.push(props.protocol);
  let label = bits.join(': ');
  if (Array.isArray(props.desks) && props.desks.length > 0) {
    label += ` [${props.desks.join(', ')}]`;
  }
  if (props.conditionKey) {
    label += ` (if ${props.conditionKey} = ${props.conditionValue})`;
  }
  return label;
}

// The on-canvas pill — deliberately terser than the full label, since a
// packed diagram has no room for "TYPE: value [desks] (if condition)" on
// every edge without labels colliding with each other and with node cards.
// Keeps exactly the two things that actually disambiguate one edge from a
// visually-similar neighbor: what's flowing (product/protocol) and whose
// it is (desks) — drops the relationship type (already conveyed by color/
// dash) and the condition text (available on hover instead).
function buildEdgeShortLabel(type: string, props: Record<string, any>): string {
  const bits: string[] = [];
  if (props.product) bits.push(props.product);
  else if (props.protocol) bits.push(props.protocol);
  if (Array.isArray(props.desks) && props.desks.length > 0) {
    bits.push(`[${props.desks.join(', ')}]`);
  }
  return bits.length > 0 ? bits.join(' ') : type;
}

export function toFlowElements(
  rawNodes: RawNode[],
  rawRels: RawRelationship[],
  labelColors: Record<string, string>,
  labelIcons: Record<string, string>,
  edgeStyles: Record<string, EdgeStyleConfig>
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = rawNodes.map((n) => {
    const colorLabel = n.labels.find((l) => labelColors[l]);
    const color = (colorLabel && labelColors[colorLabel]) || '#888';
    const baseStyle = { transition: 'opacity 120ms ease, box-shadow 120ms ease' };

    // Filter gates render as a diamond via a separate node type -- a
    // decision/gate point, not a system/venue card -- with a deliberately
    // minimal data shape (just a label + color), since the real detail
    // (the condition) lives on the :FILTERS edge leaving it, not on the
    // gate node itself.
    if (n.labels.includes('Filter')) {
      return {
        id: n.id,
        type: 'filter',
        position: { x: 0, y: 0 },
        style: baseStyle,
        data: {
          label: `${n.properties.name ?? n.id}`,
          color,
          condition: n.properties.condition,
          properties: n.properties,
          showKeys: normalizeDisplayAttribute(n.properties.displayAttribute),
        },
      };
    }

    const sublabel = n.labels.join(', ') || 'Node';
    const iconLabel = n.labels.find((l) => labelIcons[l]);
    const icon = iconLabel ? labelIcons[iconLabel] : undefined;
    return {
      id: n.id,
      type: 'topology',
      position: { x: 0, y: 0 }, // overwritten by the dagre layout pass
      // Base transition so the opacity/box-shadow changes driven by hover,
      // search, and path-selection fade in/out instead of cutting instantly
      // -- an instant cut is what read as "flicker" once hover made these
      // toggles frequent (moving the mouse across the canvas, not just a
      // deliberate search or two-click path pick).
      style: baseStyle,
      data: {
        label: `${n.properties.name ?? n.id}`,
        sublabel,
        color,
        icon,
        url: n.properties.url,
        properties: n.properties,
        showKeys: normalizeDisplayAttribute(n.properties.displayAttribute),
      },
    };
  });

  const edges: Edge[] = rawRels.map((r) => {
    const { stroke, strokeDasharray } = resolveEdgeStyle(r.type, edgeStyles);
    const props = r.properties || {};
    return {
      id: r.id,
      type: 'topology',
      source: r.sourceId,
      target: r.targetId,
      style: { transition: 'opacity 120ms ease' },
      data: {
        label: buildEdgeShortLabel(r.type, props),
        fullLabel: buildEdgeFullLabel(r.type, props),
        stroke,
        strokeDasharray,
        url: props.url,
        properties: props,
        showKeys: normalizeDisplayAttribute(props.displayAttribute),
      },
      markerEnd: { type: MarkerType.ArrowClosed, color: stroke },
    };
  });

  return { nodes, edges };
}
