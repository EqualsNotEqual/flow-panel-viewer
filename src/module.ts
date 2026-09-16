import { PanelPlugin } from '@grafana/data';
import { TopologyPanelOptions, defaultTopologyPanelOptions } from './types';
import { TopologyPanel } from './components/TopologyPanel';
import { NodeTypeColorEditor } from './components/NodeTypeColorEditor';
import { EdgeTypeColorEditor } from './components/EdgeTypeColorEditor';

export const plugin = new PanelPlugin<TopologyPanelOptions>(TopologyPanel).setPanelOptions((builder) => {
  return builder
    .addCustomEditor({
      id: 'nodeTypeColors',
      path: 'nodeTypeColors',
      name: 'Node type colors',
      description:
        'Maps each node label (e.g. Desk, Venue) to the color -- and optionally icon -- it renders with. Add a row for any new label.',
      defaultValue: defaultTopologyPanelOptions.nodeTypeColors,
      category: ['Flow Options'],
      editor: NodeTypeColorEditor,
    })
    .addCustomEditor({
      id: 'edgeTypeColors',
      path: 'edgeTypeColors',
      name: 'Edge type colors',
      description:
        'Maps each relationship type (e.g. SENDS_TRADE_TO) to the color and line style its edge renders with. Unmapped types default to a solid blue line.',
      defaultValue: defaultTopologyPanelOptions.edgeTypeColors,
      category: ['Flow Options'],
      editor: EdgeTypeColorEditor,
    })
    .addBooleanSwitch({
      path: 'groupByLabel',
      name: 'Group by first label',
      description:
        'Clusters nodes sharing the same first assigned label together during layout (e.g. all Venue-first nodes ' +
        'sit near each other), reusing the same first-label-wins ordering that already drives node color/icon. ' +
        'Off by default -- a real change to layout shape, not just decoration.',
      defaultValue: defaultTopologyPanelOptions.groupByLabel,
      category: ['Flow Options'],
    })
    .addBooleanSwitch({
      path: 'allowDragging',
      name: 'Allow manual repositioning',
      description:
        'Lets a viewer drag nodes to nudge the layout, with a right-click "Reset layout" to undo it. Off by ' +
        'default -- a clean auto-layout rarely needs manual adjustment, and dragging is the only way this panel ' +
        'ever gets into a tangled state in the first place.',
      defaultValue: defaultTopologyPanelOptions.allowDragging,
      category: ['Flow Options'],
    });
});
