import { Node, Edge, MarkerType } from 'reactflow';
import { DataFrame } from '@grafana/data';
import { SalesInvolvedFilter } from '../types';

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

function edgeStyle(type: string, protocol?: string): { stroke: string; dashed: boolean } {
  if (type === 'TRADES_ON') return { stroke: '#64748b', dashed: true }; // slate-500
  if (protocol === 'FIX') return { stroke: '#10b981', dashed: false }; // emerald-500
  if (protocol === 'MQ') return { stroke: '#f59e0b', dashed: false }; // amber-500
  return { stroke: '#3b82f6', dashed: false }; // blue-500, matches the reference's default line color
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

// Edges with no conditionKey always pass through — they're unconditional
// for whichever desk(s) they belong to (e.g. MBS's ION->BBG leg). Edges
// that do carry one are only shown when the filter matches, or when the
// filter is 'any'.
export function filterBySalesInvolved(rawRels: RawRelationship[], filter: SalesInvolvedFilter): RawRelationship[] {
  if (filter === 'any') return rawRels;
  const wantValue = filter === 'yes';
  return rawRels.filter((r) => {
    if (r.properties?.conditionKey !== 'salesInvolved') return true;
    return r.properties?.conditionValue === wantValue;
  });
}

export function toFlowElements(
  rawNodes: RawNode[],
  rawRels: RawRelationship[],
  labelColors: Record<string, string>
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = rawNodes.map((n) => {
    const label = n.labels[0] || 'Node';
    const color = labelColors[label] || '#888';
    return {
      id: n.id,
      type: 'topology',
      position: { x: 0, y: 0 }, // overwritten by the dagre layout pass
      data: { label: `${n.properties.name ?? n.id}`, sublabel: label, color },
    };
  });

  const edges: Edge[] = rawRels.map((r) => {
    const protocol = r.properties?.protocol;
    const { stroke, dashed } = edgeStyle(r.type, protocol);
    const props = r.properties || {};
    return {
      id: r.id,
      type: 'topology',
      source: r.sourceId,
      target: r.targetId,
      data: {
        label: buildEdgeShortLabel(r.type, props),
        fullLabel: buildEdgeFullLabel(r.type, props),
        stroke,
        dashed,
      },
      markerEnd: { type: MarkerType.ArrowClosed, color: stroke },
    };
  });

  return { nodes, edges };
}
