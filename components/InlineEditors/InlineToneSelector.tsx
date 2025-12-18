/**
 * InlineToneSelector Component
 *
 * Phase 10b: Single-select radio buttons for tone selection.
 */

import React from 'react';

interface InlineToneSelectorProps {
  selectedTone: string;
  toneOptions: Record<string, { label: string; description: string }>;
  onChange: (tone: string) => void;
}

export const InlineToneSelector: React.FC<InlineToneSelectorProps> = ({
  selectedTone,
  toneOptions,
  onChange,
}) => (
  <div className="space-y-1 max-h-64 overflow-y-auto">
    {Object.entries(toneOptions).map(([key, { label, description }]) => (
      <label
        key={key}
        className={`flex items-start gap-2 cursor-pointer p-2 transition-colors rounded ${
          selectedTone === key ? 'bg-ink text-paper' : 'bg-paper hover:bg-border-subtle'
        }`}
      >
        <input
          type="radio"
          name="inline-tone"
          value={key}
          checked={selectedTone === key}
          onChange={() => onChange(key)}
          className="sr-only"
        />
        <div className="min-w-0">
          <span className="font-sans text-ui font-medium">{label}</span>
          <p className={`font-sans text-caption ${
            selectedTone === key ? 'text-silver' : 'text-slate'
          }`}>
            {description}
          </p>
        </div>
      </label>
    ))}
  </div>
);

export default InlineToneSelector;
