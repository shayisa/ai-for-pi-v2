/**
 * InlineFlavorEditor Component
 *
 * Phase 10b: Multi-select checkbox editor for stylistic flavors.
 */

import React from 'react';

interface InlineFlavorEditorProps {
  selectedFlavors: Record<string, boolean>;
  flavorOptions: Record<string, { label: string; description: string }>;
  onChange: (key: string) => void;
}

export const InlineFlavorEditor: React.FC<InlineFlavorEditorProps> = ({
  selectedFlavors,
  flavorOptions,
  onChange,
}) => (
  <div className="space-y-2 max-h-64 overflow-y-auto">
    {Object.entries(flavorOptions).map(([key, { label, description }]) => (
      <label
        key={key}
        className={`flex items-start gap-2 cursor-pointer p-2 transition-colors rounded ${
          selectedFlavors[key] ? 'bg-paper' : 'hover:bg-paper'
        }`}
      >
        <input
          type="checkbox"
          checked={!!selectedFlavors[key]}
          onChange={() => onChange(key)}
          className="mt-0.5 h-4 w-4 border-charcoal bg-paper text-ink focus:ring-ink rounded"
        />
        <div className="min-w-0">
          <span className="font-sans text-ui font-medium text-ink">{label}</span>
          <p className="font-sans text-caption text-slate">{description}</p>
        </div>
      </label>
    ))}
  </div>
);

export default InlineFlavorEditor;
