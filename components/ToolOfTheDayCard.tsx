/**
 * Tool of the Day Card Component
 *
 * Displays the featured tool with name, URL, why now, and quick start guide.
 */

import React from 'react';
import type { ToolOfTheDay } from '../types';

interface ToolOfTheDayCardProps {
  tool: ToolOfTheDay;
}

export const ToolOfTheDayCard: React.FC<ToolOfTheDayCardProps> = ({ tool }) => {
  if (!tool.name) return null;

  return (
    <div className="bg-gradient-to-br from-ink to-charcoal text-paper p-8 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-editorial-red/20 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-editorial-red/10 rounded-full translate-y-1/2 -translate-x-1/2" />

      <div className="relative z-10">
        {/* Label */}
        <p className="text-overline text-pearl uppercase tracking-widest font-sans mb-4">
          Tool of the Day
        </p>

        {/* Tool Name */}
        <h3 className="font-display text-h2 mb-4">
          <a
            href={tool.url}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-pearl transition-colors underline decoration-editorial-red decoration-2 underline-offset-4"
          >
            {tool.name}
          </a>
        </h3>

        {/* Why Now */}
        {tool.whyNow && (
          <div className="mb-4">
            <p className="text-xs uppercase tracking-wider text-pearl/80 mb-1">Why Now</p>
            <p className="font-serif text-body leading-relaxed text-pearl/90">
              {tool.whyNow}
            </p>
          </div>
        )}

        {/* Quick Start */}
        {tool.quickStart && (
          <div className="mb-6">
            <p className="text-xs uppercase tracking-wider text-pearl/80 mb-1">Quick Start</p>
            <p className="font-serif text-ui leading-relaxed text-pearl/90">
              {tool.quickStart}
            </p>
          </div>
        )}

        {/* CTA */}
        <a
          href={tool.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-editorial-red text-paper font-sans text-ui font-medium py-2 px-6 hover:bg-red-700 transition-colors"
        >
          Check it out
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
        </a>
      </div>
    </div>
  );
};

export default ToolOfTheDayCard;
