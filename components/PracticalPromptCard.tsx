/**
 * Practical Prompt Card Component
 *
 * Displays a ready-to-use prompt with scenario, prompt text, and copy button.
 */

import React from 'react';
import type { PracticalPrompt } from '../types';

interface PracticalPromptCardProps {
  prompt: PracticalPrompt;
  onCopy: () => void;
  isCopied: boolean;
}

export const PracticalPromptCard: React.FC<PracticalPromptCardProps> = ({
  prompt,
  onCopy,
  isCopied,
}) => {
  if (!prompt.prompt) return null;

  return (
    <div className="bg-pearl border border-border-subtle p-6 my-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-overline text-slate uppercase tracking-widest font-sans">
            Practical Prompt
          </span>
          {prompt.isToolSpecific && (
            <span className="px-2 py-0.5 bg-editorial-red/10 text-editorial-red text-xs font-sans">
              Tool-Specific
            </span>
          )}
        </div>
      </div>

      {/* Scenario */}
      {prompt.scenario && (
        <div className="mb-4">
          <p className="text-xs uppercase tracking-wider text-slate mb-1">Scenario</p>
          <p className="font-serif text-ui text-charcoal">{prompt.scenario}</p>
        </div>
      )}

      {/* Prompt Text */}
      <div className="relative">
        <pre className="bg-ink text-pearl p-4 overflow-x-auto font-mono text-sm leading-relaxed whitespace-pre-wrap">
          {prompt.prompt}
        </pre>

        {/* Copy Button */}
        <button
          onClick={onCopy}
          className="absolute top-2 right-2 flex items-center gap-1.5 bg-charcoal hover:bg-slate text-paper text-xs font-sans py-1.5 px-3 transition-colors"
        >
          {isCopied ? (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              Copy
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default PracticalPromptCard;
