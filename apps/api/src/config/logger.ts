import pino from 'pino';
import { getEnv } from './env.js';
import { sanitizeForLogs } from '../../../src/domain/helpers/lgpd-helpers.js';

let logger: pino.Logger | null = null;

export function createLogger(): pino.Logger {
  if (logger) {
    return logger;
  }

  const env = getEnv();
  
  logger = pino({
    level: env.LOG_LEVEL,
    name: env.SERVICE_NAME,
    transport:
      env.NODE_ENV === 'development'
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss Z',
              ignore: 'pid,hostname',
              singleLine: false,
            },
          }
        : undefined,
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

  return logger;
}

export function getLogger(): pino.Logger {
  if (!logger) {
    return createLogger();
  }
  return logger;
}
