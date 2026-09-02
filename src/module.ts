import { PanelPlugin } from '@grafana/data';
import { TopologyPanelOptions, defaultTopologyPanelOptions } from './types';
import { TopologyPanel } from './components/TopologyPanel';
import { NodeTypeColorEditor } from './components/NodeTypeColorEditor';

export const plugin = new PanelPlugin<TopologyPanelOptions>(TopologyPanel).setPanelOptions((builder) => {
  return builder
    .addCustomEditor({
      id: 'nodeTypeColors',
      path: 'nodeTypeColors',
      name: 'Node type colors',
      description: 'Maps each node label (e.g. Desk, Venue) to the color it renders with. Add a row for any new label.',
      defaultValue: defaultTopologyPanelOptions.nodeTypeColors,
      category: ['TradeFlow'],
      editor: NodeTypeColorEditor,
    });
});
