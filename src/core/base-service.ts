import { log } from '../logger';
import { withRetry, RetryOptions } from '../utils/retry';
import { handleError } from '../utils/error-handler';

export abstract class BaseService {
  protected serviceName: string;

  constructor(serviceName: string) {
    this.serviceName = serviceName;
    log.debug(`${serviceName} service initialized`);
  }

  protected async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    retryOptions?: RetryOptions
  ): Promise<T> {
    return withRetry(operation, {
      operation: `${this.serviceName}.${operationName}`,
      ...retryOptions
    });
  }

  protected logOperation(operationName: string, context?: Record<string, any>): void {
    log.debug(`${this.serviceName}.${operationName}`, context);
  }

  protected logOperationStart(operationName: string, context?: Record<string, any>): void {
    log.startTimer(`${this.serviceName}.${operationName}`);
    this.logOperation(operationName, { ...context, status: 'started' });
  }

  protected logOperationEnd(operationName: string, context?: Record<string, any>): void {
    log.endTimer(`${this.serviceName}.${operationName}`, context);
    this.logOperation(operationName, { ...context, status: 'completed' });
  }

  protected handleServiceError(error: unknown, operationName: string, context?: Record<string, any>): never {
    log.error(`${this.serviceName}.${operationName} failed`, context, error as Error);
    handleError(error, `${this.serviceName}.${operationName}`);
  }

  protected validateRequired<T>(value: T | undefined | null, fieldName: string): T {
    if (value === undefined || value === null) {
      throw new Error(`${fieldName} is required`);
    }
    return value;
  }

  protected validateString(value: any, fieldName: string): string {
    if (typeof value !== 'string') {
      throw new Error(`${fieldName} must be a string`);
    }
    return value;
  }

  protected validateNumber(value: any, fieldName: string): number {
    const num = Number(value);
    if (isNaN(num)) {
      throw new Error(`${fieldName} must be a valid number`);
    }
    return num;
  }
}
