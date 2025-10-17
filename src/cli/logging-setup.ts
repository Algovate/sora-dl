import { logger, LogLevel } from '../logger';

export interface LoggingContext {
  debug: boolean;
  logToFile: boolean;
  logLevel: string;
  verbose: boolean;
}

export function setupLogging(context: LoggingContext): void {
  // Set log level based on debug flags
  let logLevel = LogLevel.INFO;
  if (context.debug) {
    logLevel = LogLevel.DEBUG;
  } else if (context.verbose) {
    logLevel = LogLevel.INFO;
  }

  // Override with explicit log level if provided
  if (context.logLevel) {
    switch (context.logLevel.toLowerCase()) {
      case 'error': logLevel = LogLevel.ERROR; break;
      case 'warn': logLevel = LogLevel.WARN; break;
      case 'info': logLevel = LogLevel.INFO; break;
      case 'debug': logLevel = LogLevel.DEBUG; break;
      case 'trace': logLevel = LogLevel.TRACE; break;
    }
  }

  logger.setLogLevel(logLevel);
  logger.setLogToFile(context.logToFile);

  if (context.debug || context.verbose) {
    console.log(`🔧 Debug mode enabled (level: ${LogLevel[logLevel]})`);
    if (context.logToFile) {
      console.log(`📝 Logging to file: ${logger.getLogFilePath()}`);
    }
  }
}
