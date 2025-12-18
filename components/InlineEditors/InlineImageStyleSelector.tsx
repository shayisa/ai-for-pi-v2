/**
 * InlineImageStyleSelector Component
 *
 * Phase 10b: Single-select radio buttons for image style selection.
 */

import React from 'react';

interface InlineImageStyleSelectorProps {
  selectedImageStyle: string;
  imageStyleOptions: Record<string, { label: string; description: string }>;
  onChange: (style: string) => void;
}

export const InlineImageStyleSelector: React.FC<InlineImageStyleSelectorProps> = ({
  selectedImageStyle,
  imageStyleOptions,
  onChange,
}) => (
  <div className="space-y-1 max-h-64 overflow-y-auto">
    {Object.entries(imageStyleOptions).map(([key, { label, description }]) => (
      <label
        key={key}
        className={`flex items-start gap-2 cursor-pointer p-2 transition-colors rounded ${
          selectedImageStyle === key ? 'bg-ink text-paper' : 'bg-paper hover:bg-border-subtle'
        }`}
      >
        <input
          type="radio"
          name="inline-image-style"
          value={key}
          checked={selectedImageStyle === key}
          onChange={() => onChange(key)}
          className="sr-only"
        />
        <div className="min-w-0">
          <span className="font-sans text-ui font-medium">{label}</span>
          <p className={`font-sans text-caption ${
            selectedImageStyle === key ? 'text-silver' : 'text-slate'
          }`}>
            {description}
          </p>
        </div>
      </label>
    ))}
  </div>
);

export default InlineImageStyleSelector;
