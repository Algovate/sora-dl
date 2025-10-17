import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
  duration?: number;
  metadata?: Record<string, any>;
}

export class Logger {
  private logLevel: LogLevel;
  private logToFile: boolean;
  private logFilePath: string | null = null;
  private startTimes: Map<string, number> = new Map();

  constructor(
    logLevel: LogLevel = LogLevel.INFO,
    logToFile: boolean = false,
    logDir?: string
  ) {
    this.logLevel = logLevel;
    this.logToFile = logToFile;

    if (logToFile) {
      const logDirPath = logDir || path.join(os.homedir(), '.sora-dl', 'logs');
      if (!fs.existsSync(logDirPath)) {
        fs.mkdirSync(logDirPath, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      this.logFilePath = path.join(logDirPath, `sora-dl-${timestamp}.log`);
    }
  }

  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  getLogLevel(): LogLevel {
    return this.logLevel;
  }

  setLogToFile(enabled: boolean, logDir?: string): void {
    this.logToFile = enabled;

    if (enabled && !this.logFilePath) {
      const logDirPath = logDir || path.join(os.homedir(), '.sora-dl', 'logs');
      if (!fs.existsSync(logDirPath)) {
        fs.mkdirSync(logDirPath, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      this.logFilePath = path.join(logDirPath, `sora-dl-${timestamp}.log`);
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.logLevel;
  }

  private formatMessage(level: LogLevel, message: string, context?: Record<string, any>): string {
    const levelNames = ['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE'];
    const timestamp = new Date().toISOString();
    const levelName = levelNames[level];

    let formatted = `[${timestamp}] [${levelName}] ${message}`;

    if (context && Object.keys(context).length > 0) {
      formatted += ` | Context: ${JSON.stringify(context, null, 2)}`;
    }

    return formatted;
  }

  private writeToFile(entry: LogEntry): void {
    if (!this.logToFile || !this.logFilePath) return;

    try {
      const logLine = JSON.stringify(entry) + '\n';
      fs.appendFileSync(this.logFilePath, logLine);
    } catch (error) {
      // Fallback to console if file writing fails
      console.error('Failed to write to log file:', error);
    }
  }

  error(message: string, context?: Record<string, any>, error?: Error): void {
    if (!this.shouldLog(LogLevel.ERROR)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.ERROR,
      message,
      context,
      error: error ? {
        message: error.message,
        stack: error.stack,
        code: (error as any).code
      } : undefined
    };

    console.error(this.formatMessage(LogLevel.ERROR, message, context));
    if (error) {
      console.error('Error details:', error);
    }

    this.writeToFile(entry);
  }

  warn(message: string, context?: Record<string, any>): void {
    if (!this.shouldLog(LogLevel.WARN)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.WARN,
      message,
      context
    };

    console.warn(this.formatMessage(LogLevel.WARN, message, context));
    this.writeToFile(entry);
  }

  info(message: string, context?: Record<string, any>): void {
    if (!this.shouldLog(LogLevel.INFO)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.INFO,
      message,
      context
    };

    console.log(this.formatMessage(LogLevel.INFO, message, context));
    this.writeToFile(entry);
  }

  debug(message: string, context?: Record<string, any>): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.DEBUG,
      message,
      context
    };

    console.log(this.formatMessage(LogLevel.DEBUG, message, context));
    this.writeToFile(entry);
  }

  trace(message: string, context?: Record<string, any>): void {
    if (!this.shouldLog(LogLevel.TRACE)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.TRACE,
      message,
      context
    };

    console.log(this.formatMessage(LogLevel.TRACE, message, context));
    this.writeToFile(entry);
  }

  // Timing utilities
  startTimer(operation: string): void {
    this.startTimes.set(operation, Date.now());
    this.debug(`Starting operation: ${operation}`);
  }

  endTimer(operation: string, context?: Record<string, any>): void {
    const startTime = this.startTimes.get(operation);
    if (!startTime) {
      this.warn(`Timer not found for operation: ${operation}`);
      return;
    }

    const duration = Date.now() - startTime;
    this.startTimes.delete(operation);

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.DEBUG,
      message: `Completed operation: ${operation}`,
      context,
      duration
    };

    this.debug(`Completed operation: ${operation} (${duration}ms)`, { ...context, duration });
    this.writeToFile(entry);
  }

  // Request/Response logging
  logRequest(method: string, url: string, headers?: Record<string, string>, data?: any): void {
    this.debug(`HTTP Request: ${method} ${url}`, {
      method,
      url,
      headers: this.sanitizeHeaders(headers),
      dataSize: data ? JSON.stringify(data).length : 0
    });
  }

  logResponse(method: string, url: string, status: number, headers?: Record<string, string>, dataSize?: number): void {
    this.debug(`HTTP Response: ${method} ${url} - ${status}`, {
      method,
      url,
      status,
      headers: this.sanitizeHeaders(headers),
      dataSize
    });
  }

  logRetry(operation: string, attempt: number, maxAttempts: number, error: Error): void {
    this.warn(`Retry attempt ${attempt}/${maxAttempts} for: ${operation}`, {
      operation,
      attempt,
      maxAttempts,
      error: error.message
    });
  }

  // File operation logging
  logFileOperation(operation: 'read' | 'write' | 'create' | 'delete', filePath: string, success: boolean, error?: Error): void {
    const level = success ? LogLevel.DEBUG : LogLevel.ERROR;
    const message = `File ${operation}: ${filePath} ${success ? 'successful' : 'failed'}`;

    if (success) {
      this.debug(message, { operation, filePath });
    } else {
      this.error(message, { operation, filePath }, error);
    }
  }

  private sanitizeHeaders(headers?: Record<string, string>): Record<string, string> {
    if (!headers) return {};

    const sanitized: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      if (typeof value === 'string') {
        sanitized[key] = value;
      }
    }

    // Remove sensitive headers
    delete sanitized['authorization'];
    delete sanitized['cookie'];
    delete sanitized['x-api-key'];

    return sanitized;
  }

  // Progress tracking
  logProgress(operation: string, current: number, total: number, context?: Record<string, any>): void {
    const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
    this.debug(`Progress: ${operation} - ${current}/${total} (${percentage}%)`, {
      operation,
      current,
      total,
      percentage,
      ...context
    });
  }

  // Batch operation logging
  logBatchStart(operation: string, batchSize: number, totalItems: number): void {
    this.info(`Starting batch operation: ${operation}`, {
      operation,
      batchSize,
      totalItems,
      totalBatches: Math.ceil(totalItems / batchSize)
    });
  }

  logBatchComplete(operation: string, batchIndex: number, totalBatches: number, successCount: number, failureCount: number): void {
    this.info(`Batch ${batchIndex + 1}/${totalBatches} completed: ${operation}`, {
      operation,
      batchIndex: batchIndex + 1,
      totalBatches,
      successCount,
      failureCount
    });
  }

  // Performance monitoring
  logPerformance(operation: string, metrics: Record<string, number>, context?: Record<string, any>): void {
    this.info(`Performance metrics: ${operation}`, {
      operation,
      metrics,
      ...context
    });
  }

  // Get log file path
  getLogFilePath(): string | null {
    return this.logFilePath || null;
  }

  // Clean up old log files
  cleanupOldLogs(keepDays: number = 7): void {
    if (!this.logToFile || !this.logFilePath) return;

    const logDir = path.dirname(this.logFilePath);
    if (!fs.existsSync(logDir)) return;

    const files = fs.readdirSync(logDir);
    const cutoffTime = Date.now() - (keepDays * 24 * 60 * 60 * 1000);

    files.forEach(file => {
      if (file.startsWith('sora-dl-') && file.endsWith('.log')) {
        const filePath = path.join(logDir, file);
        const stats = fs.statSync(filePath);

        if (stats.mtime.getTime() < cutoffTime) {
          try {
            fs.unlinkSync(filePath);
            this.debug(`Cleaned up old log file: ${file}`);
          } catch (error) {
            this.warn(`Failed to clean up log file: ${file}`, { error: (error as Error).message });
          }
        }
      }
    });
  }
}

// Global logger instance - only show errors and warnings by default
export const logger = new Logger(LogLevel.ERROR);

// Helper functions for easy access
export const log = {
  error: (message: string, context?: Record<string, any>, error?: Error) => logger.error(message, context, error),
  warn: (message: string, context?: Record<string, any>) => logger.warn(message, context),
  info: (message: string, context?: Record<string, any>) => logger.info(message, context),
  debug: (message: string, context?: Record<string, any>) => logger.debug(message, context),
  trace: (message: string, context?: Record<string, any>) => logger.trace(message, context),
  startTimer: (operation: string) => logger.startTimer(operation),
  endTimer: (operation: string, context?: Record<string, any>) => logger.endTimer(operation, context),
  logRequest: (method: string, url: string, headers?: Record<string, string>, data?: any) =>
    logger.logRequest(method, url, headers, data),
  logResponse: (method: string, url: string, status: number, headers?: Record<string, string>, dataSize?: number) =>
    logger.logResponse(method, url, status, headers, dataSize),
  logRetry: (operation: string, attempt: number, maxAttempts: number, error: Error) =>
    logger.logRetry(operation, attempt, maxAttempts, error),
  logFileOperation: (operation: 'read' | 'write' | 'create' | 'delete', filePath: string, success: boolean, error?: Error) =>
    logger.logFileOperation(operation, filePath, success, error),
  logProgress: (operation: string, current: number, total: number, context?: Record<string, any>) =>
    logger.logProgress(operation, current, total, context),
  logBatchStart: (operation: string, batchSize: number, totalItems: number) =>
    logger.logBatchStart(operation, batchSize, totalItems),
  logBatchComplete: (operation: string, batchIndex: number, totalBatches: number, successCount: number, failureCount: number) =>
    logger.logBatchComplete(operation, batchIndex, totalBatches, successCount, failureCount),
  logPerformance: (operation: string, metrics: Record<string, number>, context?: Record<string, any>) =>
    logger.logPerformance(operation, metrics, context)
};
