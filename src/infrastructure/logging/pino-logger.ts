import pino from 'pino';
import { Logger, LogContext } from '../../application/ports/driven/logger-port.js';
import { sanitizeForLogs } from '../../domain/helpers/lgpd-helpers.js';

export class PinoLogger implements Logger {
  private logger: pino.Logger;

  constructor(level: string = 'info', serviceName: string = 'assusa') {
    this.logger = pino({
      level,
      name: serviceName,
      transport: process.env.NODE_ENV === 'development' ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      } : undefined,
      serializers: {
        // Sanitizar dados sensíveis usando função centralizada
        req: (req: unknown) => {
          if (typeof req === 'object' && req !== null) {
            return sanitizeForLogs(req as Record<string, unknown>);
          }
          return req;
        },
        err: pino.stdSerializers.err,
      },
    });
  }

  info(context: LogContext, message: string): void {
    this.logger.info(this.sanitizeContext(context), message);
  }

  error(context: LogContext, message: string): void {
    this.logger.error(this.sanitizeContext(context), message);
  }

  warn(context: LogContext, message: string): void {
    this.logger.warn(this.sanitizeContext(context), message);
  }

  debug(context: LogContext, message: string): void {
    this.logger.debug(this.sanitizeContext(context), message);
  }

  private sanitizeContext(context: LogContext): LogContext {
    // Usa função centralizada sanitizeForLogs para garantir consistência
    return sanitizeForLogs(context) as LogContext;
  }

  getPinoLogger(): pino.Logger {
    return this.logger;
  }
}
