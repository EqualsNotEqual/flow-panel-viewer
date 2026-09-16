import React, { useCallback } from 'react';
import { StandardEditorProps } from '@grafana/data';
import { Button, ColorPicker, Combobox, ComboboxOption, Icon, IconButton, Input, getAvailableIcons, toIconName } from '@grafana/ui';
import { NodeTypeColor } from '../types';
import { LUCIDE_ICONS } from '../utils/lucideIcons';

// One row per known business node type — label + color. Deliberately a
// small explicit list (not a hash-derived auto-color), since the real
// application's node types are a finite, known enum, unlike the arbitrary
// datasets used for learning Cypher.
//
// The curated Lucide names come first -- distinctive pictograms (building,
// server, database...) worth surfacing over Grafana's larger but more
// generic dashboard-chrome icon set, which fills out the rest of the list.
const iconOptions: ComboboxOption[] = [
  ...Object.keys(LUCIDE_ICONS).map((name) => ({ label: `${name} (Lucide)`, value: name })),
  ...getAvailableIcons().map((name) => ({ label: name, value: name })),
];

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
      {rows.map((row, i) => {
        const LucidePreview = row.icon ? LUCIDE_ICONS[row.icon] : undefined;
        const iconName = !LucidePreview && row.icon ? toIconName(row.icon) : undefined;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <ColorPicker color={row.color} onChange={(color) => updateRow(i, { color })} />
            <Input
              value={row.label}
              placeholder="Node label, e.g. Desk"
              onChange={(e) => updateRow(i, { label: e.currentTarget.value })}
              width={18}
            />
            <Combobox
              options={iconOptions}
              value={row.icon || null}
              onChange={(opt) => updateRow(i, { icon: opt ? String(opt.value) : undefined })}
              placeholder="Icon (optional)"
              isClearable
              width={20}
            />
            {LucidePreview && <LucidePreview size={18} color={row.color} />}
            {iconName && <Icon name={iconName} />}
            <IconButton name="trash-alt" aria-label="Remove" onClick={() => removeRow(i)} />
          </div>
        );
      })}
      <Button icon="plus" size="sm" variant="secondary" onClick={addRow}>
        Add node type
      </Button>
    </div>
  );
};
