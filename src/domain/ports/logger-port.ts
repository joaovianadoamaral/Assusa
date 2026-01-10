export interface LogContext {
  [key: string]: unknown;
}

export interface Logger {
  info(context: LogContext, message: string): void;
  error(context: LogContext, message: string): void;
  warn(context: LogContext, message: string): void;
  debug(context: LogContext, message: string): void;
}
