/**
 * InlineAudienceEditor Component
 *
 * Phase 10b: Multi-select checkbox editor for audience selection.
 */

import React from 'react';

interface InlineAudienceEditorProps {
  selectedAudience: Record<string, boolean>;
  audienceOptions: Record<string, { label: string; description: string }>;
  onChange: (key: string) => void;
}

export const InlineAudienceEditor: React.FC<InlineAudienceEditorProps> = ({
  selectedAudience,
  audienceOptions,
  onChange,
}) => (
  <div className="space-y-2">
    {Object.entries(audienceOptions).map(([key, { label, description }]) => (
      <label
        key={key}
        className={`flex items-start gap-2 cursor-pointer p-2 transition-colors rounded ${
          selectedAudience[key] ? 'bg-paper' : 'hover:bg-paper'
        }`}
      >
        <input
          type="checkbox"
          checked={!!selectedAudience[key]}
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

export default InlineAudienceEditor;
