import { PanelPlugin } from '@grafana/data';
import { TopologyPanelOptions, defaultTopologyPanelOptions } from './types';
import { TopologyPanel } from './components/TopologyPanel';
import { NodeTypeColorEditor } from './components/NodeTypeColorEditor';

export const plugin = new PanelPlugin<TopologyPanelOptions>(TopologyPanel).setPanelOptions((builder) => {
  return builder
    .addRadio({
      path: 'salesInvolvedFilter',
      name: 'Sales involved',
      description:
        'Filters which conditional routing edges are shown (e.g. Rates only reaches ADP directly when sales ' +
        'is NOT involved, and only reaches it via BBG when sales IS involved). Edges with no condition ' +
        'attached always show regardless of this setting.',
      defaultValue: defaultTopologyPanelOptions.salesInvolvedFilter,
      category: ['TradeFlow'],
      settings: {
        options: [
          { value: 'any', label: 'Any' },
          { value: 'yes', label: 'Yes' },
          { value: 'no', label: 'No' },
        ],
      },
    })
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
