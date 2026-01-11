/**
 * Exportações centralizadas dos ports driven (integrações externas)
 */
export { WhatsAppPort, WhatsAppMessage, WhatsAppResponse } from './whatsapp-port.js';
export { SicoobPort } from './sicoob-port.js';
export { DrivePort } from './drive-port.js';
export { SheetsPort } from './sheets-port.js';
export { StoragePort } from './storage-port.js';
export { RateLimiter, RateLimitResult } from './rate-limiter.js';
export { ConversationStateStore, ConversationState } from './conversation-state-store.js';
export { Logger, LogContext } from './logger-port.js';

// Novos ports do Bloco 4
export { TitleRepository } from './title-repository.port.js';
export { BankProvider } from './bank-provider.port.js';
export { PdfService } from './pdf-service.port.js';
export { DriveStorage } from './drive-storage.port.js';
export { SheetLogger, EventPayload } from './sheet-logger.port.js';
export { SiteLinkService } from './site-link-service.port.js';
