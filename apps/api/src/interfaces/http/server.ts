import Fastify, { FastifyInstance } from 'fastify';
import fastifyRequestContext from '@fastify/request-context';
import fastifyRequestId from '@fastify/request-id';
import { loadEnv } from '../../config/env.js';
import { createLogger } from '../../config/logger.js';
import { errorHandlerPlugin } from '../../infrastructure/plugins/error-handler.js';
import { healthRoutes } from './routes/health.js';

export async function createServer(): Promise<FastifyInstance> {
  const env = loadEnv();
  const logger = createLogger();

  const server = Fastify({
    logger,
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
    genReqId: () => crypto.randomUUID(),
    disableRequestLogging: false,
  });

  // Register plugins
  await server.register(fastifyRequestContext);
  await server.register(fastifyRequestId, {
    requestIdHeader: 'x-request-id',
    generateRequestId: () => crypto.randomUUID(),
  });

  // Error handler (deve ser registrado antes das rotas)
  await server.register(errorHandlerPlugin);

  // Request context middleware
  server.addHook('onRequest', async (request) => {
    const requestId = request.id as string;
    request.requestContext.set('requestId', requestId);
    request.requestContext.set('logger', logger.child({ requestId }));
  });

  // Logging middleware
  server.addHook('onResponse', async (request, reply) => {
    const requestId = request.id as string;
    const logger = request.requestContext.get<ReturnType<typeof logger.child>>('logger');
    
    if (logger) {
      logger.info(
        {
          method: request.method,
          url: request.url,
          statusCode: reply.statusCode,
          responseTime: reply.getResponseTime(),
        },
        'Request completed'
      );
    }
  });

  // Register routes
  await server.register(healthRoutes);

  // Root route
  server.get('/', async () => {
    return {
      message: 'Assusa API',
      version: '1.0.0',
      documentation: '/health',
    };
  });

  return server;
}

export async function startServer(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger();

  try {
    const server = await createServer();

    await server.listen({
      port: env.PORT,
      host: env.HOST,
    });

    logger.info(
      {
        port: env.PORT,
        host: env.HOST,
        nodeEnv: env.NODE_ENV,
      },
      '🚀 Server started'
    );

    // Graceful shutdown
    const shutdown = async () => {
      logger.info({}, 'Shutting down server...');
      await server.close();
      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    logger.fatal({ error }, 'Failed to start server');
    process.exit(1);
  }
}
