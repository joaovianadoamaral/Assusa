import { loadConfig } from './infrastructure/config/config.js';
import { PinoLogger } from './infrastructure/logging/pino-logger.js';
import { WhatsAppCloudApiAdapter } from './adapters/whatsapp/whatsapp-cloud-api-adapter.js';
import { GoogleDriveAdapter } from './adapters/google/drive-adapter.js';
import { RedisAdapter } from './adapters/redis/redis-adapter.js';
import { InMemoryConversationStateStore } from './adapters/in-memory/in-memory-conversation-state-store.js';
import { RedisConversationStateStore } from './adapters/redis/redis-conversation-state-store.js';
import { SicoobBankProviderAdapter } from './adapters/sicoob/sicoob-bank-provider-adapter.js';
import { BradescoBankProviderAdapter } from './adapters/bradesco/bradesco-bank-provider-adapter.js';
import { NullBradescoAdapter } from './adapters/bradesco/null-bradesco-adapter.js';
import { AggregatedTitleRepositoryAdapter } from './adapters/bradesco/aggregated-title-repository-adapter.js';
import { AggregatedBankProviderAdapter } from './adapters/bradesco/aggregated-bank-provider-adapter.js';
import { SimplePdfServiceAdapter } from './adapters/services/simple-pdf-service-adapter.js';
import { GoogleDriveStorageAdapter } from './adapters/google/google-drive-storage-adapter.js';
import { GoogleSheetLoggerAdapter } from './adapters/google/google-sheet-logger-adapter.js';
import { SiteLinkServiceAdapter } from './adapters/services/site-link-service-adapter.js';

// Use Cases da camada de aplicação
import { ShowMenuUseCase } from './application/use-cases/show-menu.use-case.js';
import { StartSecondCopyFlowUseCase } from './application/use-cases/start-second-copy-flow.use-case.js';
import { ReceiveCpfAndProcessUseCase } from './application/use-cases/receive-cpf-and-process.use-case.js';
import { SelectTitleAndProcessUseCase } from './application/use-cases/select-title-and-process.use-case.js';
import { ProcessFormatSelectionUseCase } from './application/use-cases/process-format-selection.use-case.js';
import { GenerateSecondCopyUseCase } from './application/use-cases/generate-second-copy.use-case.js';
import { StartTalkToUsUseCase } from './application/use-cases/start-talk-to-us.use-case.js';
import { ReceiveTalkToUsMessageUseCase } from './application/use-cases/receive-talk-to-us-message.use-case.js';
import { OpenSiteUseCase } from './application/use-cases/open-site.use-case.js';
import { DeleteDataUseCase } from './application/use-cases/delete-data.use-case.js';

// Services
import { ApplicationService } from './application/services/application-service.js';
import { WhatsappRouter } from './application/services/whatsapp-router.js';

import { FastifyServer, AppDependencies } from './adapters/http/fastify-server.js';

async function bootstrap() {
  // Carregar configuração
  const config = loadConfig();
  const logger = new PinoLogger(config.logLevel, config.serviceName);

  logger.info({ nodeEnv: config.nodeEnv }, 'Inicializando aplicação');

  try {
    // Inicializar adapters base
    const whatsappAdapter = new WhatsAppCloudApiAdapter(config, logger);
    const driveAdapter = new GoogleDriveAdapter(config, logger);
    const storageAdapter = new RedisAdapter(config, logger);

    // Inicializar adapters de conversação
    const conversationStateStore = config.redisEnabled && config.redisUrl
      ? new RedisConversationStateStore(config, logger)
      : new InMemoryConversationStateStore(logger);

    // Inicializar adapters de bancos
    const sicoobAdapter = new SicoobBankProviderAdapter(config, logger);
    
    // Verificar se Bradesco está configurado antes de inicializar
    const bradescoConfigurado = 
      config.bradescoClientId && 
      config.bradescoPrivateKeyPem && 
      config.bradescoBeneficiaryCnpj;
    
    const bradescoAdapter = bradescoConfigurado
      ? new BradescoBankProviderAdapter(config, logger)
      : new NullBradescoAdapter();
    
    if (!bradescoConfigurado) {
      logger.info({}, 'Bradesco não configurado - sistema funcionará apenas com Sicoob');
    } else {
      logger.info({}, 'Bradesco configurado - sistema funcionará com Sicoob e Bradesco');
    }
    
    // Inicializar sheetLogger (usado pelo AggregatedTitleRepositoryAdapter)
    const sheetLogger = new GoogleSheetLoggerAdapter(config, logger);
    
    // Inicializar adapters agregados
    const titleRepository = new AggregatedTitleRepositoryAdapter(
      sicoobAdapter,
      bradescoAdapter,
      sheetLogger,
      logger
    );
    const bankProvider = new AggregatedBankProviderAdapter(
      sicoobAdapter,
      bradescoAdapter,
      logger
    );
    const pdfService = new SimplePdfServiceAdapter(logger);
    const driveStorage = new GoogleDriveStorageAdapter(driveAdapter, logger);
    const siteLinkService = new SiteLinkServiceAdapter(config, logger, storageAdapter);

    // Inicializar rate limiter
    const { InMemoryRateLimiter } = await import('./adapters/in-memory/in-memory-rate-limiter.js');
    const rateLimiter = new InMemoryRateLimiter(logger);

    // Inicializar use cases da camada de aplicação
    const showMenuUseCase = new ShowMenuUseCase(whatsappAdapter, logger);
    const startSecondCopyFlowUseCase = new StartSecondCopyFlowUseCase(
      conversationStateStore,
      whatsappAdapter,
      logger
    );
    const generateSecondCopyUseCase = new GenerateSecondCopyUseCase(
      bankProvider,
      pdfService,
      driveStorage,
      sheetLogger,
      logger
    );
    const receiveCpfAndProcessUseCase = new ReceiveCpfAndProcessUseCase(
      conversationStateStore,
      whatsappAdapter,
      titleRepository,
      rateLimiter,
      logger,
      config
    );
    const selectTitleAndProcessUseCase = new SelectTitleAndProcessUseCase(
      conversationStateStore,
      whatsappAdapter,
      logger
    );
    const processFormatSelectionUseCase = new ProcessFormatSelectionUseCase(
      conversationStateStore,
      whatsappAdapter,
      bankProvider,
      driveStorage,
      sheetLogger,
      logger
    );
    const startTalkToUsUseCase = new StartTalkToUsUseCase(
      conversationStateStore,
      whatsappAdapter,
      logger
    );
    const receiveTalkToUsMessageUseCase = new ReceiveTalkToUsMessageUseCase(
      conversationStateStore,
      whatsappAdapter,
      sheetLogger,
      logger
    );
    const openSiteUseCase = new OpenSiteUseCase(
      conversationStateStore,
      whatsappAdapter,
      siteLinkService,
      sheetLogger,
      logger
    );
    const deleteDataUseCase = new DeleteDataUseCase(
      conversationStateStore,
      whatsappAdapter,
      driveStorage,
      sheetLogger,
      logger
    );

    // Inicializar ApplicationService
    const applicationService = new ApplicationService(
      showMenuUseCase,
      startSecondCopyFlowUseCase,
      receiveCpfAndProcessUseCase,
      selectTitleAndProcessUseCase,
      processFormatSelectionUseCase,
      generateSecondCopyUseCase,
      startTalkToUsUseCase,
      receiveTalkToUsMessageUseCase,
      openSiteUseCase,
      deleteDataUseCase,
      conversationStateStore
    );

    // Inicializar WhatsappRouter
    const whatsappRouter = new WhatsappRouter(applicationService, conversationStateStore, logger);

    // Inicializar servidor HTTP
    const dependencies: AppDependencies = {
      whatsappRouter,
      whatsappAdapter,
      conversationStateStore,
      config,
      logger,
    };

    const server = new FastifyServer(dependencies);

    // Graceful shutdown
    const shutdown = async () => {
      logger.info({}, 'Encerrando aplicação...');
      await server.close();
      if (storageAdapter instanceof RedisAdapter) {
        await storageAdapter.disconnect();
      }
      if (conversationStateStore instanceof RedisConversationStateStore) {
        await conversationStateStore.disconnect();
      }
      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

    // Iniciar servidor
    await server.listen();
  } catch (error) {
    logger.error({ error }, 'Erro fatal ao inicializar aplicação');
    process.exit(1);
  }
}

bootstrap();
