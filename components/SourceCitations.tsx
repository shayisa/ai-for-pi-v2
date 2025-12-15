/**
 * Source Citations Component
 *
 * Displays a list of source links with titles.
 */

import React from 'react';
import type { SourceCitation } from '../types';

interface SourceCitationsProps {
  sources: SourceCitation[];
}

/**
 * Extract domain from URL for display
 */
const getDomain = (url: string): string => {
  try {
    const domain = new URL(url).hostname.replace('www.', '');
    return domain;
  } catch {
    return url;
  }
};

/**
 * Get favicon URL for a domain
 */
const getFaviconUrl = (url: string): string => {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;
  } catch {
    return '';
  }
};

export const SourceCitations: React.FC<SourceCitationsProps> = ({ sources }) => {
  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-6 pt-4 border-t border-border-subtle">
      <p className="text-overline text-slate uppercase tracking-widest font-sans mb-3">
        Sources
      </p>
      <ul className="space-y-2">
        {sources.map((source, index) => (
          <li key={`${source.url}-${index}`} className="flex items-start gap-2">
            <img
              src={getFaviconUrl(source.url)}
              alt=""
              className="w-4 h-4 mt-0.5 flex-shrink-0"
              onError={(e) => {
                // Hide broken favicon images
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-sans text-ui text-charcoal hover:text-editorial-red transition-colors"
            >
              <span className="underline underline-offset-2">{source.title}</span>
              <span className="text-slate text-xs ml-2">({getDomain(source.url)})</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default SourceCitations;
