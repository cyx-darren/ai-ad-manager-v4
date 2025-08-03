/**
 * Structured logging utility for MCP server
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: any;
  error?: Error;
  requestId?: string;
}

class Logger {
  private logLevel: LogLevel;
  private requestId?: string;

  constructor(level: LogLevel = LogLevel.INFO) {
    this.logLevel = level;
  }

  setRequestId(requestId: string): void {
    this.requestId = requestId;
  }

  clearRequestId(): void {
    this.requestId = undefined;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.logLevel;
  }

  private formatLogEntry(level: LogLevel, message: string, data?: any, error?: Error): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
      error,
      requestId: this.requestId,
    };
  }

  private writeLog(entry: LogEntry): void {
    const levelNames = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
    const levelName = levelNames[entry.level];
    
    let logMessage = `[${entry.timestamp}] ${levelName}`;
    
    if (entry.requestId) {
      logMessage += ` [${entry.requestId}]`;
    }
    
    logMessage += `: ${entry.message}`;

    // Write to stderr for MCP server (stdout is reserved for JSON-RPC)
    if (entry.level >= LogLevel.ERROR) {
      console.error(logMessage);
      if (entry.error) {
        console.error('Error details:', entry.error);
      }
    } else if (entry.level >= LogLevel.WARN) {
      console.error(`⚠️  ${logMessage}`);
    } else {
      console.error(logMessage);
    }

    if (entry.data) {
      console.error('Data:', JSON.stringify(entry.data, null, 2));
    }
  }

  debug(message: string, data?: any): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      this.writeLog(this.formatLogEntry(LogLevel.DEBUG, message, data));
    }
  }

  info(message: string, data?: any): void {
    if (this.shouldLog(LogLevel.INFO)) {
      this.writeLog(this.formatLogEntry(LogLevel.INFO, message, data));
    }
  }

  warn(message: string, data?: any): void {
    if (this.shouldLog(LogLevel.WARN)) {
      this.writeLog(this.formatLogEntry(LogLevel.WARN, message, data));
    }
  }

  error(message: string, error?: Error, data?: any): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      this.writeLog(this.formatLogEntry(LogLevel.ERROR, message, data, error));
    }
  }

  // Request lifecycle logging
  requestStart(method: string, params?: any): string {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.setRequestId(requestId);
    this.info(`Request started: ${method}`, { params });
    return requestId;
  }

  requestEnd(requestId: string, duration: number, success: boolean): void {
    this.info(`Request completed: ${success ? 'SUCCESS' : 'FAILURE'}`, { 
      requestId, 
      duration: `${duration}ms` 
    });
    this.clearRequestId();
  }
}

// Create global logger instance
export const logger = new Logger(
  process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO
);

// Request timing utility
export function createRequestTimer(): { end: () => number } {
  const startTime = Date.now();
  return {
    end: () => Date.now() - startTime,
  };
}