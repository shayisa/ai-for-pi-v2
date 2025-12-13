/**
 * Error Boundary Components
 *
 * React error boundaries catch JavaScript errors anywhere in their
 * child component tree, log those errors, and display a fallback UI.
 */

import React, { Component, ReactNode } from 'react';

// =============================================================================
// TYPES
// =============================================================================

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// =============================================================================
// GENERIC ERROR BOUNDARY
// =============================================================================

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <DefaultErrorFallback
          error={this.state.error}
          onReset={this.handleReset}
        />
      );
    }

    return this.props.children;
  }
}

// =============================================================================
// DEFAULT ERROR FALLBACK
// =============================================================================

interface DefaultErrorFallbackProps {
  error: Error | null;
  onReset?: () => void;
}

export const DefaultErrorFallback: React.FC<DefaultErrorFallbackProps> = ({
  error,
  onReset,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 bg-red-50 rounded-lg border border-red-200">
      <div className="text-red-600 mb-4">
        <svg
          className="w-12 h-12"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>

      <h2 className="text-xl font-semibold text-red-800 mb-2">
        Something went wrong
      </h2>

      <p className="text-red-600 text-center mb-4 max-w-md">
        {error?.message || 'An unexpected error occurred'}
      </p>

      {onReset && (
        <button
          onClick={onReset}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Try again
        </button>
      )}
    </div>
  );
};

// =============================================================================
// SPECIALIZED ERROR BOUNDARIES
// =============================================================================

/**
 * Error boundary for image generation errors
 */
export const ImageGenerationBoundary: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  return (
    <ErrorBoundary
      fallback={
        <div className="flex items-center justify-center h-48 bg-gray-100 rounded-lg">
          <div className="text-center text-gray-500">
            <svg
              className="w-8 h-8 mx-auto mb-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p className="text-sm">Image unavailable</p>
          </div>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
};

/**
 * Error boundary for newsletter generation errors
 */
interface NewsletterGenerationBoundaryProps {
  children: ReactNode;
  onRetry?: () => void;
}

export const NewsletterGenerationBoundary: React.FC<NewsletterGenerationBoundaryProps> = ({
  children,
  onRetry,
}) => {
  return (
    <ErrorBoundary
      onReset={onRetry}
      fallback={
        <div className="flex flex-col items-center justify-center p-8 bg-amber-50 rounded-lg border border-amber-200">
          <div className="text-amber-600 mb-4">
            <svg
              className="w-12 h-12"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>

          <h2 className="text-xl font-semibold text-amber-800 mb-2">
            Newsletter Generation Error
          </h2>

          <p className="text-amber-600 text-center mb-4">
            There was a problem generating your newsletter.
            Please try again or modify your topics.
          </p>

          {onRetry && (
            <button
              onClick={onRetry}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
            >
              Try again
            </button>
          )}
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
};

/**
 * Error boundary for Google Workspace operations
 */
export const GoogleWorkspaceBoundary: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  return (
    <ErrorBoundary
      fallback={
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-blue-600">
            Google Workspace operation failed. Please check your connection and try again.
          </p>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
};
