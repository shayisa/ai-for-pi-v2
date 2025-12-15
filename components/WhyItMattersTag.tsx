/**
 * Why It Matters Tag Component
 *
 * Displays the "Why It Matters" context for an audience section.
 */

import React from 'react';

interface WhyItMattersTagProps {
  text: string;
}

export const WhyItMattersTag: React.FC<WhyItMattersTagProps> = ({ text }) => {
  if (!text) return null;

  return (
    <div className="mb-6 flex items-start gap-3">
      <span className="flex-shrink-0 px-2 py-1 bg-editorial-red text-paper text-xs font-sans uppercase tracking-wider">
        Why It Matters
      </span>
      <p className="font-serif text-ui text-charcoal leading-relaxed italic">
        {text}
      </p>
    </div>
  );
};

export default WhyItMattersTag;
