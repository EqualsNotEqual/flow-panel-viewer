import React, { useCallback } from 'react';
import { StandardEditorProps } from '@grafana/data';
import { Button, ColorPicker, Combobox, ComboboxOption, IconButton, Input } from '@grafana/ui';
import { EdgeTypeColor } from '../types';

const lineStyleOptions: Array<ComboboxOption<'solid' | 'dashed' | 'dotted'>> = [
  { label: 'Solid', value: 'solid' },
  { label: 'Dashed', value: 'dashed' },
  { label: 'Dotted', value: 'dotted' },
];

// One row per relationship type -- label + color, same pattern as
// NodeTypeColorEditor. Deliberately no icon field (edges are lines, not
// cards) and no presets in the default value: unlike node labels, there's
// no fixed enum of relationship types to pre-populate.
export const EdgeTypeColorEditor: React.FC<StandardEditorProps<EdgeTypeColor[]>> = ({ value, onChange }) => {
  const rows = value ?? [];

  const updateRow = useCallback(
    (index: number, patch: Partial<EdgeTypeColor>) => {
      const next = rows.slice();
      next[index] = { ...next[index], ...patch };
      onChange(next);
    },
    [rows, onChange]
  );

  const removeRow = useCallback(
    (index: number) => {
      onChange(rows.filter((_, i) => i !== index));
    },
    [rows, onChange]
  );

  const addRow = useCallback(() => {
    onChange([...rows, { label: '', color: '#3b82f6' }]);
  }, [rows, onChange]);

  return (
    <div>
      {rows.map((row, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <ColorPicker color={row.color} onChange={(color) => updateRow(i, { color })} />
          <Input
            value={row.label}
            placeholder="Relationship type, e.g. SENDS_TRADE_TO"
            onChange={(e) => updateRow(i, { label: e.currentTarget.value })}
            width={26}
          />
          <Combobox
            options={lineStyleOptions}
            value={row.lineStyle || 'solid'}
            onChange={(opt) => updateRow(i, { lineStyle: opt?.value })}
            width={16}
          />
          <IconButton name="trash-alt" aria-label="Remove" onClick={() => removeRow(i)} />
        </div>
      ))}
      <Button icon="plus" size="sm" variant="secondary" onClick={addRow}>
        Add relationship type
      </Button>
    </div>
  );
};
