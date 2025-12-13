# Error Handling Strategy

> **Purpose**: Standardize error handling to prevent silent failures and enable proper recovery

## Error Type Hierarchy

```
Error
├── RecoverableError (user can retry)
│   ├── NetworkError (connection issues)
│   ├── RateLimitError (API throttling)
│   └── TimeoutError (request timeout)
├── FatalError (cannot recover, requires user action)
│   ├── AuthenticationError (invalid credentials)
│   ├── ValidationError (invalid input)
│   └── ConfigurationError (missing setup)
└── UnexpectedError (bugs, should not happen)
```

## Error Classes (src/types/errors.ts)

```typescript
// Base recoverable error - user can retry
export class RecoverableError extends Error {
  constructor(
    message: string,
    public retryFn?: () => Promise<void>,
    public retryDelay?: number
  ) {
    super(message);
    this.name = 'RecoverableError';
  }
}

// Network-related errors
export class NetworkError extends RecoverableError {
  constructor(message: string, retryFn?: () => Promise<void>) {
    super(message, retryFn, 1000);
    this.name = 'NetworkError';
  }
}

// Rate limiting errors
export class RateLimitError extends RecoverableError {
  constructor(
    message: string,
    public retryAfter: number,
    retryFn?: () => Promise<void>
  ) {
    super(message, retryFn, retryAfter);
    this.name = 'RateLimitError';
  }
}

// Timeout errors
export class TimeoutError extends RecoverableError {
  constructor(message: string, retryFn?: () => Promise<void>) {
    super(message, retryFn, 0);
    this.name = 'TimeoutError';
  }
}

// Fatal errors - cannot recover automatically
export class FatalError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'FatalError';
  }
}

// Authentication errors
export class AuthenticationError extends FatalError {
  constructor(message: string) {
    super(message, 'AUTH_ERROR');
    this.name = 'AuthenticationError';
  }
}

// Validation errors
export class ValidationError extends FatalError {
  constructor(message: string, public fields?: string[]) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

// Configuration errors
export class ConfigurationError extends FatalError {
  constructor(message: string, public missingConfig: string) {
    super(message, 'CONFIG_ERROR');
    this.name = 'ConfigurationError';
  }
}
```

---

## Error Handling Patterns

### Pattern 1: API Call with Retry

```typescript
import { NetworkError, RateLimitError, TimeoutError } from '@/types/errors';

async function callApi<T>(
  fn: () => Promise<T>,
  retryFn?: () => Promise<T>
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof Response) {
      if (error.status === 429) {
        const retryAfter = parseInt(error.headers.get('Retry-After') || '60') * 1000;
        throw new RateLimitError(
          'Rate limit exceeded. Please wait before retrying.',
          retryAfter,
          retryFn
        );
      }
      if (error.status === 401 || error.status === 403) {
        throw new AuthenticationError('Invalid API key. Please check your settings.');
      }
      if (error.status >= 500) {
        throw new NetworkError('Server error. Please try again.', retryFn);
      }
    }

    if (error.name === 'AbortError') {
      throw new TimeoutError('Request timed out. Please try again.', retryFn);
    }

    throw error;
  }
}
```

### Pattern 2: Hook Error State

```typescript
function useNewsletterGeneration() {
  const [error, setError] = useState<ErrorState | null>(null);

  const generate = useCallback(async (request: GenerateRequest) => {
    setError(null);

    try {
      const result = await generateNewsletter(request);
      return result;
    } catch (e) {
      const errorState = createErrorState(e, () => generate(request));
      setError(errorState);
      throw e;
    }
  }, []);

  return { error, generate, clearError: () => setError(null) };
}

function createErrorState(error: unknown, retryFn: () => Promise<void>): ErrorState {
  if (error instanceof RecoverableError) {
    return {
      message: error.message,
      onRetry: error.retryFn || retryFn,
      code: error.name,
      recoverable: true
    };
  }

  if (error instanceof FatalError) {
    return {
      message: error.message,
      code: error.code,
      recoverable: false
    };
  }

  // Unknown error
  return {
    message: 'An unexpected error occurred. Please try again.',
    onRetry: retryFn,
    recoverable: true
  };
}
```

### Pattern 3: Error Boundary Component

```typescript
interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, { hasError: boolean; error: Error | null }> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="error-fallback">
          <h2>Something went wrong</h2>
          <p>{this.state.error?.message}</p>
          <button onClick={() => this.setState({ hasError: false, error: null })}>
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

---

## Error Display Guidelines

### User-Friendly Messages

| Error Type | Technical | User-Friendly |
|------------|-----------|---------------|
| NetworkError | ECONNREFUSED | Unable to connect. Please check your internet connection. |
| RateLimitError | 429 Too Many Requests | Too many requests. Please wait a moment and try again. |
| AuthenticationError | 401 Unauthorized | Your API key is invalid. Please update it in Settings. |
| ValidationError | Required field missing | Please fill in all required fields. |
| TimeoutError | AbortError | The request took too long. Please try again. |

### Error Display Component

```typescript
function ErrorDisplay({ error, onRetry, onDismiss }: {
  error: ErrorState;
  onRetry?: () => void;
  onDismiss?: () => void;
}) {
  return (
    <div className={cn(
      "error-display",
      error.recoverable ? "warning" : "critical"
    )}>
      <p>{error.message}</p>

      <div className="error-actions">
        {error.recoverable && error.onRetry && (
          <button onClick={error.onRetry || onRetry}>
            Retry
          </button>
        )}

        {!error.recoverable && (
          <button onClick={() => window.location.href = '/settings'}>
            Go to Settings
          </button>
        )}

        {onDismiss && (
          <button onClick={onDismiss}>
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}
```

---

## Backend Error Handling

### Express Error Middleware

```typescript
// server/middleware/errorHandler.ts
import { Request, Response, NextFunction } from 'express';

interface ApiError extends Error {
  statusCode?: number;
  code?: string;
}

export function errorHandler(
  err: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error(`[${new Date().toISOString()}] Error:`, {
    message: err.message,
    code: err.code,
    path: req.path,
    method: req.method
  });

  const statusCode = err.statusCode || 500;

  res.status(statusCode).json({
    error: err.message,
    code: err.code || 'INTERNAL_ERROR',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
}
```

### Route Error Wrapping

```typescript
// Wrap async routes to catch errors
function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Usage:
app.post('/api/generateNewsletter', asyncHandler(async (req, res) => {
  const result = await generateNewsletter(req.body);
  res.json(result);
}));
```

---

## Error Recovery Strategies

### Strategy 1: Automatic Retry (for transient errors)

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  initialDelay = 1000
): Promise<T> {
  let lastError: Error;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Don't retry non-recoverable errors
      if (error instanceof FatalError) {
        throw error;
      }

      // Wait before retry with exponential backoff
      const delay = initialDelay * Math.pow(2, i);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}
```

### Strategy 2: Graceful Degradation (for optional features)

```typescript
async function generateWithImages(newsletter: Newsletter): Promise<Newsletter> {
  const sectionsWithImages = await Promise.all(
    newsletter.sections.map(async (section) => {
      try {
        const imageUrl = await generateImage(section.imagePrompt);
        return { ...section, imageUrl };
      } catch (error) {
        // Image generation failed - use placeholder instead of failing entirely
        console.warn('Image generation failed:', error);
        return { ...section, imageUrl: PLACEHOLDER_IMAGE };
      }
    })
  );

  return { ...newsletter, sections: sectionsWithImages };
}
```

### Strategy 3: Circuit Breaker (for repeatedly failing services)

```typescript
class CircuitBreaker {
  private failures = 0;
  private lastFailure: number | null = null;
  private readonly threshold = 5;
  private readonly resetTimeout = 60000; // 1 minute

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.isOpen()) {
      throw new Error('Circuit breaker is open. Service temporarily unavailable.');
    }

    try {
      const result = await fn();
      this.reset();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  private isOpen(): boolean {
    if (this.failures >= this.threshold) {
      if (this.lastFailure && Date.now() - this.lastFailure > this.resetTimeout) {
        this.reset();
        return false;
      }
      return true;
    }
    return false;
  }

  private recordFailure(): void {
    this.failures++;
    this.lastFailure = Date.now();
  }

  private reset(): void {
    this.failures = 0;
    this.lastFailure = null;
  }
}
```

---

## Logging Best Practices

### What to Log

| Level | When | Example |
|-------|------|---------|
| ERROR | Unrecoverable errors | `AuthenticationError: Invalid API key` |
| WARN | Recoverable errors | `RateLimitError: Retrying in 60s` |
| INFO | Important events | `Newsletter generated successfully` |
| DEBUG | Development only | `API response: {...}` |

### Log Format

```typescript
function logError(error: Error, context: Record<string, unknown> = {}) {
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'ERROR',
    name: error.name,
    message: error.message,
    stack: error.stack,
    ...context
  }));
}
```
