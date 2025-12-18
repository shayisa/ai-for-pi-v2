/**
 * InlineTopicEditor Component
 *
 * Phase 10b: Tag input with add/remove for topic management.
 */

import React, { useState } from 'react';
import { PlusIcon, XIcon } from '../IconComponents';

interface InlineTopicEditorProps {
  topics: string[];
  onAdd: (topic: string) => void;
  onRemove: (index: number) => void;
}

export const InlineTopicEditor: React.FC<InlineTopicEditorProps> = ({
  topics,
  onAdd,
  onRemove,
}) => {
  const [input, setInput] = useState('');

  const handleAdd = () => {
    if (input.trim()) {
      onAdd(input.trim());
      setInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className="space-y-3">
      {/* Selected Topics */}
      {topics.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {topics.map((topic, index) => (
            <span
              key={index}
              className="inline-flex items-center gap-1 bg-ink text-paper font-sans text-caption px-2 py-0.5"
            >
              <span className="truncate max-w-[150px]">{topic}</span>
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="text-silver hover:text-paper transition-colors flex-shrink-0"
              >
                <XIcon className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Add Topic Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add topic..."
          className="flex-1 px-2 py-1.5 bg-paper border border-border-subtle font-sans text-ui focus:outline-none focus:border-ink"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!input.trim()}
          className="px-2 py-1.5 bg-ink text-paper hover:bg-charcoal disabled:bg-silver disabled:cursor-not-allowed transition-colors"
        >
          <PlusIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default InlineTopicEditor;
