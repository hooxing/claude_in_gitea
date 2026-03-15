import * as core from "./action-io";

export type RetryOptions = {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffFactor?: number;
};

export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelayMs = 5000,
    maxDelayMs = 20000,
    backoffFactor = 2,
  } = options;

  let delayMs = initialDelayMs;
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      core.debug(`Attempt ${attempt} of ${maxAttempts}...`);
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      core.warning(`Attempt ${attempt} failed: ${lastError.message}`);

      if (attempt < maxAttempts) {
        core.info(`Retrying in ${delayMs / 1000} seconds...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        delayMs = Math.min(delayMs * backoffFactor, maxDelayMs);
      }
    }
  }

  // lastError is always defined here because the loop runs at least once
  // and every catch block assigns it.  The fallback keeps TypeScript happy
  // since it cannot prove that invariant statically.
  throw lastError ?? new Error(`Operation failed after ${maxAttempts} attempts`);
}

