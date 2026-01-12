import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fastifyRequestContext from '@fastify/request-context';
import { WhatsappRouter } from '../../application/services/whatsapp-router.js';
import { WhatsAppCloudApiAdapter } from '../whatsapp/whatsapp-cloud-api-adapter.js';
import { Config } from '../../infrastructure/config/config.js';
import { Logger } from '../../domain/ports/logger-port.js';
import { PinoLogger } from '../../infrastructure/logging/pino-logger.js';

export interface AppDependencies {
  whatsappRouter: WhatsappRouter;
  whatsappAdapter: WhatsAppCloudApiAdapter;
  config: Config;
  logger: Logger;
}

export class FastifyServer {
  private app: FastifyInstance;
  private dependencies: AppDependencies;

  constructor(dependencies: AppDependencies) {
    this.dependencies = dependencies;
    const pinoLogger = (dependencies.logger as PinoLogger).getPinoLogger();
    this.app = Fastify({
      logger: pinoLogger as any,
      requestIdHeader: 'x-request-id',
      genReqId: () => crypto.randomUUID(),
    }) as FastifyInstance;

    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // Request Context
    this.app.register(fastifyRequestContext);

    // Request ID middleware
    this.app.addHook('onRequest', async (request: FastifyRequest) => {
      const requestId = request.id as string;
      (request.requestContext as any).set('requestId', requestId);
      (request.requestContext as any).set('logger', this.dependencies.logger);
    });

    // Rate limiting (básico)
    this.app.addHook('onRequest', async (request: FastifyRequest) => {
      // Implementação básica - em produção, usar plugin específico
      const requestId = request.id as string;
      const clientId = request.ip;
      
      // Simplificado - usar Redis adapter em produção
      // Por enquanto, apenas log
      this.dependencies.logger.debug({ requestId, clientId }, 'Request recebido');
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', async () => {
      return { status: 'ok', timestamp: new Date().toISOString() };
    });

    // Webhook do WhatsApp
    this.app.get('/webhooks/whatsapp', async (request: FastifyRequest, reply: FastifyReply) => {
      const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = request.query as {
        'hub.mode'?: string;
        'hub.verify_token'?: string;
        'hub.challenge'?: string;
      };

      const requestId = request.id as string;
      this.dependencies.logger.debug({ requestId, mode }, 'Webhook verification');

      if (mode && token && challenge) {
        const result = this.dependencies.whatsappAdapter.validateWebhook(mode, token, challenge);
        if (result) {
          return reply.send(challenge);
        }
      }

      return reply.code(403).send({ error: 'Forbidden' });
    });

    this.app.post('/webhooks/whatsapp', async (request: FastifyRequest, reply: FastifyReply) => {
      const requestId = request.id as string;
      const payload = request.body;

      try {
        this.dependencies.logger.debug({ requestId }, 'Webhook recebido');

        const message = await this.dependencies.whatsappAdapter.handleWebhook(payload, requestId);

        if (message) {
          await this.dependencies.whatsappService.handleMessage(message, requestId);
        }

        return reply.send({ success: true });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erro ao processar webhook';
        this.dependencies.logger.error({ requestId, error: errorMessage }, 'Erro ao processar webhook');
        return reply.code(500).send({ error: 'Internal Server Error' });
      }
    });
  }

  async listen(): Promise<void> {
    try {
      await this.app.listen({
        port: this.dependencies.config.port,
        host: this.dependencies.config.host,
      });
      this.dependencies.logger.info(
        { port: this.dependencies.config.port, host: this.dependencies.config.host },
        'Servidor HTTP iniciado'
      );
    } catch (error) {
      this.dependencies.logger.error({ error }, 'Erro ao iniciar servidor');
      process.exit(1);
    }
  }

  async close(): Promise<void> {
    await this.app.close();
  }
}
