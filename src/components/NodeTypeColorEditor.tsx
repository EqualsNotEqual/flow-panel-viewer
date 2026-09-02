import React, { useCallback } from 'react';
import { StandardEditorProps } from '@grafana/data';
import { Button, ColorPicker, IconButton, Input } from '@grafana/ui';
import { NodeTypeColor } from '../types';

// One row per known business node type — label + color. Deliberately a
// small explicit list (not a hash-derived auto-color), since the real
// application's node types are a finite, known enum, unlike the arbitrary
// datasets used for learning Cypher.
export const NodeTypeColorEditor: React.FC<StandardEditorProps<NodeTypeColor[]>> = ({ value, onChange }) => {
  const rows = value ?? [];

  const updateRow = useCallback(
    (index: number, patch: Partial<NodeTypeColor>) => {
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
    onChange([...rows, { label: '', color: '#888888' }]);
  }, [rows, onChange]);

  return (
    <div>
      {rows.map((row, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <ColorPicker color={row.color} onChange={(color) => updateRow(i, { color })} />
          <Input
            value={row.label}
            placeholder="Node label, e.g. Desk"
            onChange={(e) => updateRow(i, { label: e.currentTarget.value })}
            width={22}
          />
          <IconButton name="trash-alt" aria-label="Remove" onClick={() => removeRow(i)} />
        </div>
      ))}
      <Button icon="plus" size="sm" variant="secondary" onClick={addRow}>
        Add node type
      </Button>
    </div>
  );
};
