
export const withRetry = <T extends (...args: any[]) => Promise<any>>(
  fn: T,
  retries = 3,
  initialDelay = 1000
): T => {
  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    let lastError: Error | undefined;
    for (let i = 0; i < retries; i++) {
      try {
        return await fn(...args);
      } catch (error) {
        lastError = error as Error;
        if (i < retries - 1) {
          const delay = initialDelay * Math.pow(2, i);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    throw lastError;
  }) as T;
};
