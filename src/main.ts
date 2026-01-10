import { loadConfig } from './infrastructure/config/config.js';
import { PinoLogger } from './infrastructure/logging/pino-logger.js';
import { WhatsAppCloudApiAdapter } from './adapters/whatsapp/whatsapp-cloud-api-adapter.js';
import { SicoobApiAdapter } from './adapters/sicoob/sicoob-api-adapter.js';
import { GoogleDriveAdapter } from './adapters/google/drive-adapter.js';
import { GoogleSheetsAdapter } from './adapters/google/sheets-adapter.js';
import { RedisAdapter } from './adapters/redis/redis-adapter.js';
import { GerarSegundaViaUseCase } from './domain/use-cases/gerar-segunda-via-use-case.js';
import { ExcluirDadosUseCase } from './domain/use-cases/excluir-dados-use-case.js';
import { WhatsAppService } from './application/services/whatsapp-service.js';
import { FastifyServer, AppDependencies } from './adapters/http/fastify-server.js';

async function bootstrap() {
  // Carregar configuração
  const config = loadConfig();
  const logger = new PinoLogger(config.logLevel, config.serviceName);

  logger.info({ nodeEnv: config.nodeEnv }, 'Inicializando aplicação');

  try {
    // Inicializar adapters
    const whatsappAdapter = new WhatsAppCloudApiAdapter(config, logger);
    const sicoobAdapter = new SicoobApiAdapter(config, logger);
    const driveAdapter = new GoogleDriveAdapter(config, logger);
    const sheetsAdapter = new GoogleSheetsAdapter(config, logger);
    const storageAdapter = new RedisAdapter(config, logger);

    // Inicializar use cases
    const gerarSegundaViaUseCase = new GerarSegundaViaUseCase(
      whatsappAdapter,
      sicoobAdapter,
      driveAdapter,
      sheetsAdapter,
      logger
    );

    const excluirDadosUseCase = new ExcluirDadosUseCase(
      whatsappAdapter,
      sheetsAdapter,
      driveAdapter,
      storageAdapter,
      logger
    );

    // Inicializar serviços
    const whatsappService = new WhatsAppService(
      whatsappAdapter,
      storageAdapter,
      gerarSegundaViaUseCase,
      excluirDadosUseCase,
      logger
    );

    // Inicializar servidor HTTP
    const dependencies: AppDependencies = {
      whatsappService,
      whatsappAdapter,
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
