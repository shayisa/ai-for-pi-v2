/**
 * ActionButton Component
 *
 * A reusable button with visual feedback for:
 * - Idle state (default)
 * - Loading state (spinner + loading text)
 * - Success state (checkmark + success text, auto-reverts)
 * - Error state (error styling)
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckIcon } from './IconComponents';

type ButtonState = 'idle' | 'loading' | 'success' | 'error';

interface ActionButtonProps {
  onClick: () => Promise<void>;
  idleText: string;
  loadingText: string;
  successText: string;
  IdleIcon?: React.FC<{ className?: string }>;
  variant?: 'primary' | 'secondary';
  successDuration?: number;  // ms (default 2000)
  disabled?: boolean;
  className?: string;
}

const Spinner: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    className={`animate-spin ${className}`}
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);

export const ActionButton: React.FC<ActionButtonProps> = ({
  onClick,
  idleText,
  loadingText,
  successText,
  IdleIcon,
  variant = 'primary',
  successDuration = 2000,
  disabled = false,
  className = '',
}) => {
  const [state, setState] = useState<ButtonState>('idle');

  const handleClick = useCallback(async () => {
    if (state !== 'idle' || disabled) return;

    setState('loading');
    try {
      await onClick();
      setState('success');
      setTimeout(() => setState('idle'), successDuration);
    } catch (error) {
      setState('error');
      setTimeout(() => setState('idle'), successDuration);
    }
  }, [onClick, state, disabled, successDuration]);

  const isDisabled = disabled || state === 'loading';

  // Base styles
  const baseStyles = 'flex items-center justify-center gap-2 font-sans text-ui font-medium py-3 px-6 transition-all duration-200';

  // Variant styles
  const variantStyles = {
    primary: {
      idle: 'bg-ink text-paper hover:bg-charcoal',
      loading: 'bg-charcoal text-paper cursor-wait',
      success: 'bg-green-600 text-paper',
      error: 'bg-editorial-red text-paper',
    },
    secondary: {
      idle: 'border border-border-subtle bg-paper text-ink hover:bg-pearl',
      loading: 'border border-border-subtle bg-pearl text-slate cursor-wait',
      success: 'border border-green-600 bg-green-50 text-green-700',
      error: 'border border-editorial-red bg-red-50 text-editorial-red',
    },
  };

  const currentVariantStyles = variantStyles[variant][state];
  const disabledStyles = isDisabled ? 'opacity-50 cursor-not-allowed' : '';

  // Get current text and icon
  const getText = () => {
    switch (state) {
      case 'loading':
        return loadingText;
      case 'success':
        return successText;
      case 'error':
        return 'Error';
      default:
        return idleText;
    }
  };

  const getIcon = () => {
    switch (state) {
      case 'loading':
        return <Spinner className="h-4 w-4" />;
      case 'success':
        return <CheckIcon className="h-5 w-5" />;
      case 'error':
        return null;
      default:
        return IdleIcon ? <IdleIcon className="h-5 w-5" /> : null;
    }
  };

  return (
    <motion.button
      onClick={handleClick}
      disabled={isDisabled}
      className={`${baseStyles} ${currentVariantStyles} ${disabledStyles} ${className}`}
      whileTap={!isDisabled ? { scale: 0.98 } : undefined}
    >
      <AnimatePresence mode="wait">
        <motion.span
          key={state}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          transition={{ duration: 0.15 }}
          className="flex items-center gap-2"
        >
          {getIcon()}
          <span>{getText()}</span>
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
};

export default ActionButton;
