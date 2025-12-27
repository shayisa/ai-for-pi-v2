/**
 * IndexToKBButton Component
 *
 * A button for indexing sources to the RAG Knowledge Base.
 * Shows different states:
 * - Default: Database+ icon, "Add to KB" on hover
 * - Indexing: Spinner animation
 * - Indexed: Checkmark with green color
 *
 * Used in InspirationSourcesPanel and DiscoverTopicsPage.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { DatabasePlusIcon, CheckIcon, LoaderIcon } from './IconComponents';

interface IndexToKBButtonProps {
  /** Whether the source is already indexed */
  isIndexed: boolean;
  /** Whether the source is currently being indexed */
  isIndexing: boolean;
  /** Called when the button is clicked */
  onIndex: () => void;
  /** Optional size variant */
  size?: 'sm' | 'md';
  /** Optional tooltip text override */
  tooltip?: string;
  /** Optional additional className */
  className?: string;
}

export const IndexToKBButton: React.FC<IndexToKBButtonProps> = ({
  isIndexed,
  isIndexing,
  onIndex,
  size = 'sm',
  tooltip,
  className = '',
}) => {
  // Determine button state
  const isDisabled = isIndexed || isIndexing;

  // Size classes
  const sizeClasses = {
    sm: 'w-7 h-7 p-1.5',
    md: 'w-9 h-9 p-2',
  };

  const iconSize = size === 'sm' ? 14 : 18;

  // Get tooltip text
  const getTooltip = (): string => {
    if (tooltip) return tooltip;
    if (isIndexing) return 'Indexing...';
    if (isIndexed) return 'Already in Knowledge Base';
    return 'Add to Knowledge Base';
  };

  return (
    <motion.button
      onClick={(e) => {
        e.stopPropagation();
        if (!isDisabled) {
          onIndex();
        }
      }}
      disabled={isDisabled}
      title={getTooltip()}
      className={`
        ${sizeClasses[size]}
        rounded-md flex items-center justify-center
        transition-all duration-150
        ${isIndexed
          ? 'text-emerald-600 bg-emerald-50 cursor-default'
          : isIndexing
            ? 'text-blue-500 bg-blue-50 cursor-wait'
            : 'text-slate hover:text-ink hover:bg-pearl'
        }
        ${className}
      `}
      whileHover={!isDisabled ? { scale: 1.1 } : undefined}
      whileTap={!isDisabled ? { scale: 0.95 } : undefined}
    >
      {isIndexing ? (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <LoaderIcon width={iconSize} height={iconSize} />
        </motion.div>
      ) : isIndexed ? (
        <CheckIcon width={iconSize} height={iconSize} />
      ) : (
        <DatabasePlusIcon width={iconSize} height={iconSize} />
      )}
    </motion.button>
  );
};

/**
 * IndexAllToKBButton Component
 *
 * A button for bulk indexing all sources in a section.
 * Shows progress during batch indexing.
 */
interface IndexAllToKBButtonProps {
  /** Number of sources available to index */
  availableCount: number;
  /** Number of sources already indexed */
  indexedCount: number;
  /** Whether a batch operation is in progress */
  isIndexing: boolean;
  /** Current progress (0-1) during batch indexing */
  progress?: number;
  /** Called when the button is clicked */
  onIndexAll: () => void;
  /** Optional additional className */
  className?: string;
}

export const IndexAllToKBButton: React.FC<IndexAllToKBButtonProps> = ({
  availableCount,
  indexedCount,
  isIndexing,
  progress = 0,
  onIndexAll,
  className = '',
}) => {
  const newCount = availableCount - indexedCount;
  const allIndexed = newCount === 0;

  // Button label based on state
  const getLabel = (): string => {
    if (isIndexing) {
      const percent = Math.round(progress * 100);
      return `Indexing... ${percent}%`;
    }
    if (allIndexed) {
      return `All ${indexedCount} in KB`;
    }
    if (indexedCount > 0) {
      return `Index ${newCount} New`;
    }
    return `Index All (${availableCount})`;
  };

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        if (!isIndexing && !allIndexed) {
          onIndexAll();
        }
      }}
      disabled={isIndexing || allIndexed}
      className={`
        relative inline-flex items-center gap-1.5 px-3 py-1.5
        text-caption font-medium rounded-md
        transition-all duration-150 overflow-hidden
        ${allIndexed
          ? 'text-emerald-600 bg-emerald-50 cursor-default'
          : isIndexing
            ? 'text-blue-600 bg-blue-50 cursor-wait'
            : 'text-charcoal hover:text-ink bg-pearl hover:bg-white border border-border-subtle'
        }
        ${className}
      `}
    >
      {/* Progress bar background during indexing */}
      {isIndexing && (
        <motion.div
          className="absolute inset-0 bg-blue-100"
          initial={{ width: 0 }}
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: 0.2 }}
        />
      )}

      {/* Icon */}
      <span className="relative z-10">
        {isIndexing ? (
          <motion.span
            className="inline-block"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          >
            <LoaderIcon className="w-3.5 h-3.5" />
          </motion.span>
        ) : allIndexed ? (
          <CheckIcon className="w-3.5 h-3.5" />
        ) : (
          <DatabasePlusIcon className="w-3.5 h-3.5" />
        )}
      </span>

      {/* Label */}
      <span className="relative z-10">{getLabel()}</span>
    </button>
  );
};

export default IndexToKBButton;
