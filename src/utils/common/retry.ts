import { log } from '../../logger';
import { APP_CONFIG } from '../../config/constants';
import { isRetriableError, handleError } from './error-handler';

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  operation?: string;
}

export class RetryManager {
  private static defaultOptions: Required<RetryOptions> = {
    maxAttempts: APP_CONFIG.MAX_RETRY_ATTEMPTS,
    baseDelayMs: APP_CONFIG.RETRY_BASE_DELAY_MS,
    maxDelayMs: 30000, // 30 seconds
    backoffMultiplier: 2,
    operation: 'operation'
  };

  static async execute<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const opts = { ...this.defaultOptions, ...options };
    
    for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
      try {
        log.debug(`Attempting ${opts.operation}`, { attempt, maxAttempts: opts.maxAttempts });
        const result = await operation();
        log.debug(`${opts.operation} succeeded`, { attempt });
        return result;
      } catch (error) {
        const isRetriable = isRetriableError(error);
        
        log.logRetry(opts.operation, attempt, opts.maxAttempts, error as Error);

        if (attempt < opts.maxAttempts && isRetriable) {
          const delay = Math.min(
            opts.baseDelayMs * Math.pow(opts.backoffMultiplier, attempt - 1),
            opts.maxDelayMs
          );
          
          log.debug(`Retrying ${opts.operation} after delay`, { 
            attempt, 
            delay, 
            retriable: true 
          });
          
          await this.delay(delay);
          continue;
        }
        
        log.error(`${opts.operation} failed after all attempts`, {
          attempt,
          maxAttempts: opts.maxAttempts,
          retriable: isRetriable,
          errorCode: (error as any)?.code
        }, error as Error);
        
        handleError(error, opts.operation);
      }
    }
    
    throw new Error('Max retry attempts reached');
  }

  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  return RetryManager.execute(operation, options);
}
