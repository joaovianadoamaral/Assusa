import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { WhatsappRouter } from '../../src/application/services/whatsapp-router.js';
import { ApplicationService } from '../../src/application/services/application-service.js';
import { ConversationStateStore } from '../../src/application/ports/driven/conversation-state-store.js';
import { WhatsAppPort } from '../../src/application/ports/driven/whatsapp-port.js';
import { Logger } from '../../src/application/ports/driven/logger-port.js';
import { Config } from '../../src/infrastructure/config/config.js';
import { InMemoryConversationStateStore } from '../../src/adapters/in-memory/in-memory-conversation-state-store.js';
import { devtoolsFlowTesterRoutes } from '../../src/adapters/http/routes/devtools/flow-tester.routes.js';
import { FlowType } from '../../src/domain/enums/flow-type.js';

describe('DevTools Flow Tester', () => {
  let app: FastifyInstance;
  let mockWhatsappAdapter: WhatsAppPort;
  let conversationStateStore: ConversationStateStore;
  let whatsappRouter: WhatsappRouter;
  let mockLogger: Logger;
  let config: Config;

  beforeEach(async () => {
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };

    conversationStateStore = new InMemoryConversationStateStore(mockLogger);

    // Mock WhatsApp adapter
    mockWhatsappAdapter = {
      sendText: vi.fn().mockResolvedValue({ success: true, messageId: 'test-123' }),
      uploadMedia: vi.fn().mockResolvedValue('media-123'),
      sendDocument: vi.fn().mockResolvedValue({ success: true, messageId: 'doc-123' }),
      handleWebhook: vi.fn().mockResolvedValue(null),
      validateWebhook: vi.fn().mockReturnValue(null),
      validateSignature: vi.fn().mockReturnValue(true),
    };

    // Criar ApplicationService mock mínimo
    const mockApplicationService = {
      showMenu: vi.fn().mockResolvedValue(undefined),
      startSecondCopyFlow: vi.fn().mockResolvedValue(undefined),
      receiveCpfAndProcess: vi.fn().mockResolvedValue(undefined),
      selectTitleAndProcess: vi.fn().mockResolvedValue(undefined),
      processFormatSelection: vi.fn().mockResolvedValue(undefined),
      generateSecondCopy: vi.fn().mockResolvedValue({ success: true }),
      startTalkToUs: vi.fn().mockResolvedValue(undefined),
      receiveTalkToUsMessage: vi.fn().mockResolvedValue(undefined),
      openSite: vi.fn().mockResolvedValue(undefined),
      deleteData: vi.fn().mockResolvedValue(undefined),
      getConversationState: vi.fn().mockResolvedValue(null),
    } as unknown as ApplicationService;

    whatsappRouter = new WhatsappRouter(mockApplicationService, conversationStateStore, mockLogger);

    // Config com DevTools habilitado
    config = {
      nodeEnv: 'test',
      port: 3000,
      host: '0.0.0.0',
      whatsappApiToken: 'test-token',
      whatsappPhoneNumberId: 'test-phone',
      whatsappVerifyToken: 'test-verify',
      whatsappAppSecret: 'test-secret',
      sicoobClientId: 'test',
      sicoobClientSecret: 'test',
      sicoobBaseUrl: 'https://test.com',
      sicoobAuthTokenUrl: 'https://test.com/auth',
      sicoobNumeroCliente: 'test',
      sicoobCodigoModalidade: 'test',
      googleServiceAccountJsonBase64: 'test',
      googleDriveFolderId: 'test',
      googleSheetsSpreadsheetId: 'test',
      redisEnabled: false,
      cpfPepper: 'a'.repeat(32),
      logLevel: 'info',
      serviceName: 'test',
      rateLimitMaxRequests: 100,
      rateLimitWindowMs: 60000,
      conversationStateTtlSeconds: 900,
      devToolsEnabled: true,
      devToolsToken: undefined,
    } as Config;

    app = Fastify();
    await app.register(devtoolsFlowTesterRoutes, {
      whatsappRouter,
      conversationState: conversationStateStore,
      whatsappAdapter: mockWhatsappAdapter,
      config,
      logger: mockLogger,
    });
  });

  describe('Segurança', () => {
    it('deve bloquear DevTools em produção', async () => {
      const prodConfig = { ...config, nodeEnv: 'production' as const, devToolsEnabled: false };
      const prodApp = Fastify();
      
      await prodApp.register(devtoolsFlowTesterRoutes, {
        whatsappRouter,
        conversationState: conversationStateStore,
        whatsappAdapter: mockWhatsappAdapter,
        config: prodConfig,
        logger: mockLogger,
      });

      const response = await prodApp.inject({
        method: 'GET',
        url: '/devtools/flow-tester',
      });

      expect(response.statusCode).toBe(404);
    });

    it('deve validar token quando configurado', async () => {
      const tokenConfig = { ...config, devToolsToken: 'secret-token' };
      const tokenApp = Fastify();
      
      await tokenApp.register(devtoolsFlowTesterRoutes, {
        whatsappRouter,
        conversationState: conversationStateStore,
        whatsappAdapter: mockWhatsappAdapter,
        config: tokenConfig,
        logger: mockLogger,
      });

      // Sem token
      const response1 = await tokenApp.inject({
        method: 'GET',
        url: '/devtools/flow-tester',
      });
      expect(response1.statusCode).toBe(403);

      // Com token correto
      const response2 = await tokenApp.inject({
        method: 'GET',
        url: '/devtools/flow-tester',
        headers: {
          'x-dev-tools-token': 'secret-token',
        },
      });
      expect(response2.statusCode).toBe(200);
    });
  });

  describe('GET /devtools/flow-tester', () => {
    it('deve retornar HTML', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/devtools/flow-tester',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/html');
      expect(response.body).toContain('Assusa Flow Tester');
    });
  });

  describe('POST /devtools/flow-tester/run', () => {
    it('deve executar fluxo com estado inicial', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/devtools/flow-tester/run',
        payload: {
          from: '5511999999999',
          input: {
            type: 'text',
            text: 'menu',
          },
          startAt: 'MENU',
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data).toHaveProperty('requestId');
      expect(data).toHaveProperty('stateAfter');
    });

    it('deve validar payload', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/devtools/flow-tester/run',
        payload: {
          // from faltando
          input: {
            type: 'text',
            text: 'menu',
          },
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /devtools/flow-tester/reset', () => {
    it('deve resetar estado da conversa', async () => {
      // Criar estado primeiro
      await conversationStateStore.set('5511999999999', {
        activeFlow: FlowType.SECOND_COPY,
        step: 'WAITING_CPF',
        data: {},
        updatedAt: new Date(),
      });

      // Verificar que estado existe
      const stateBefore = await conversationStateStore.get('5511999999999');
      expect(stateBefore).not.toBeNull();

      // Resetar
      const response = await app.inject({
        method: 'POST',
        url: '/devtools/flow-tester/reset',
        payload: {
          from: '5511999999999',
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.success).toBe(true);

      // Verificar que estado foi removido
      const stateAfter = await conversationStateStore.get('5511999999999');
      expect(stateAfter).toBeNull();
    });
  });

  describe('GET /devtools/flow-tester/state', () => {
    it('deve retornar estado atual', async () => {
      // Criar estado
      await conversationStateStore.set('5511999999999', {
        activeFlow: FlowType.SECOND_COPY,
        step: 'WAITING_CPF',
        data: { test: 'data' },
        updatedAt: new Date(),
      });

      const response = await app.inject({
        method: 'GET',
        url: '/devtools/flow-tester/state?from=5511999999999',
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data).toHaveProperty('from');
      expect(data).toHaveProperty('state');
      expect(data.state.step).toBe('WAITING_CPF');
    });

    it('deve retornar null quando não há estado', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/devtools/flow-tester/state?from=5511888888888',
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.state).toBeNull();
    });

    it('deve validar parâmetro from', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/devtools/flow-tester/state',
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
