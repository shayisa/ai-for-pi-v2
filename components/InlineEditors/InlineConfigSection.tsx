/**
 * InlineConfigSection Component
 *
 * Phase 10b: Base component for collapsible inline configuration sections.
 * Provides expand/collapse functionality with consistent styling.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDownIcon } from '../IconComponents';

interface InlineConfigSectionProps {
  label: string;
  value: string;
  isRequired?: boolean;
  isEditable?: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export const InlineConfigSection: React.FC<InlineConfigSectionProps> = ({
  label,
  value,
  isRequired = false,
  isEditable = true,
  isExpanded,
  onToggle,
  children,
}) => (
  <div className="border-l-2 border-border-subtle">
    <button
      type="button"
      onClick={isEditable ? onToggle : undefined}
      className={`w-full flex items-center gap-2 pl-3 py-2 text-left transition-colors ${
        isEditable ? 'cursor-pointer hover:bg-pearl' : 'cursor-default'
      }`}
    >
      <dt className="text-caption text-slate uppercase tracking-wider font-sans min-w-[70px] flex-shrink-0">
        {label}
      </dt>
      <dd className="font-sans text-ui text-ink flex-1 truncate">
        {value || (
          <span className={isRequired ? 'text-editorial-red' : 'text-silver'}>
            {isRequired ? 'Required' : 'None'}
          </span>
        )}
      </dd>
      {isEditable && (
        <ChevronDownIcon
          className={`h-4 w-4 text-slate transition-transform flex-shrink-0 ${
            isExpanded ? 'rotate-180' : ''
          }`}
        />
      )}
    </button>
    <AnimatePresence>
      {isExpanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >
          <div className="pl-3 pr-2 py-3 border-t border-border-subtle bg-pearl">
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

export default InlineConfigSection;
