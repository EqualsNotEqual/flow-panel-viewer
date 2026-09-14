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
      category: ['TradeFlow'],
      editor: NodeTypeColorEditor,
    })
    .addCustomEditor({
      id: 'edgeTypeColors',
      path: 'edgeTypeColors',
      name: 'Edge type colors',
      description:
        'Maps each relationship type (e.g. SENDS_TRADE_TO) to the color and line style its edge renders with. Unmapped types default to a solid blue line.',
      defaultValue: defaultTopologyPanelOptions.edgeTypeColors,
      category: ['TradeFlow'],
      editor: EdgeTypeColorEditor,
    });
});
