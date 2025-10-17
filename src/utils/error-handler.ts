import { log } from '../logger';
import { ERROR_MESSAGES } from '../config/constants';

export class AppError extends Error {
  public readonly code: string;
  public readonly context?: Record<string, any>;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    code: string = 'UNKNOWN_ERROR',
    context?: Record<string, any>,
    isOperational: boolean = true
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.context = context;
    this.isOperational = isOperational;

    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, AppError);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'VALIDATION_ERROR', context);
    this.name = 'ValidationError';
  }
}

export class NetworkError extends AppError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'NETWORK_ERROR', context);
    this.name = 'NetworkError';
  }
}

export class FileSystemError extends AppError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'FILE_SYSTEM_ERROR', context);
    this.name = 'FileSystemError';
  }
}

export class APIError extends AppError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'API_ERROR', context);
    this.name = 'APIError';
  }
}

export function handleError(error: unknown, context?: string): never {
  if (error instanceof AppError) {
    log.error(`Application error${context ? ` in ${context}` : ''}`, error.context, error);
    throw error;
  }

  if (error instanceof Error) {
    log.error(`Unexpected error${context ? ` in ${context}` : ''}`, {}, error);
    throw new AppError(
      error.message,
      'UNEXPECTED_ERROR',
      { originalError: error.name, stack: error.stack },
      false
    );
  }

  const errorMessage = typeof error === 'string' ? error : 'Unknown error occurred';
  log.error(`Unknown error${context ? ` in ${context}` : ''}`, { error });
  throw new AppError(errorMessage, 'UNKNOWN_ERROR', { originalError: error });
}

export function isRetriableError(error: unknown): boolean {
  if (error instanceof NetworkError) {
    return true;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('econnreset') ||
      message.includes('socket hang up') ||
      message.includes('etimedout') ||
      message.includes('enetunreach') ||
      message.includes('eai_again') ||
      message.includes('timeout')
    );
  }

  return false;
}

export function createValidationError(message: string, context?: Record<string, any>): ValidationError {
  return new ValidationError(message, context);
}

export function createNetworkError(message: string, context?: Record<string, any>): NetworkError {
  return new NetworkError(message, context);
}

export function createFileSystemError(message: string, context?: Record<string, any>): FileSystemError {
  return new FileSystemError(message, context);
}

export function createAPIError(message: string, context?: Record<string, any>): APIError {
  return new APIError(message, context);
}
