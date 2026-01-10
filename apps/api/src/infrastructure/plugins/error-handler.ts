import { FastifyInstance, FastifyError } from 'fastify';
import { getEnv } from '../../config/env.js';
import { AppError } from '../../shared/errors/app-error.js';
import { getLogger } from '../../config/logger.js';

export async function errorHandlerPlugin(fastify: FastifyInstance) {
  fastify.setErrorHandler((error: FastifyError, request, reply) => {
    const logger = getLogger();
    const env = getEnv();
    const requestId = request.id as string;

    // Log do erro
    const errorContext = {
      requestId,
      method: request.method,
      url: request.url,
      statusCode: error.statusCode || 500,
      code: error.code,
    };

    if (error instanceof AppError) {
      logger.error(
        {
          ...errorContext,
          error: {
            name: error.name,
            message: error.message,
            code: error.code,
            cause: error.cause?.message,
          },
        },
        'Application error'
      );
    } else {
      logger.error(
        {
          ...errorContext,
          error: {
            name: error.name,
            message: error.message,
            stack: env.NODE_ENV === 'development' ? error.stack : undefined,
          },
        },
        'Unhandled error'
      );
    }

    // Resposta ao cliente
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: {
          code: error.code || 'APP_ERROR',
          message: error.message,
          requestId,
        },
      });
    }

    // Erro não tratado
    const statusCode = error.statusCode || 500;
    const message =
      env.NODE_ENV === 'production'
        ? 'Internal server error'
        : error.message;

    return reply.status(statusCode).send({
      error: {
        code: error.code || 'INTERNAL_ERROR',
        message,
        requestId,
        ...(env.NODE_ENV === 'development' && { stack: error.stack }),
      },
    });
  });
}
