import { ConversationStateStore, ConversationState } from '../../application/ports/driven/conversation-state-store.js';
import { Logger } from '../../application/ports/driven/logger-port.js';

const DEFAULT_TTL_SECONDS = 15 * 60; // 15 minutos

/**
 * Implementação em memória do ConversationStateStore
 * Utilizada como fallback em desenvolvimento quando Redis não está disponível
 */
export class InMemoryConversationStateStore implements ConversationStateStore {
  private storage: Map<string, { state: ConversationState; expiresAt: number }> = new Map();

  constructor(private logger: Logger) {
    this.logger.info({}, 'InMemoryConversationStateStore inicializado');
  }

  async get(from: string): Promise<ConversationState | null> {
    const item = this.storage.get(from);
    if (!item) {
      return null;
    }

    if (Date.now() > item.expiresAt) {
      this.storage.delete(from);
      return null;
    }

    return item.state;
  }

  async set(from: string, state: ConversationState, ttlSeconds: number = DEFAULT_TTL_SECONDS): Promise<void> {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.storage.set(from, { state, expiresAt });

    // Limpar expirado após TTL
    setTimeout(() => {
      const currentItem = this.storage.get(from);
      if (currentItem && Date.now() > currentItem.expiresAt) {
        this.storage.delete(from);
      }
    }, ttlSeconds * 1000);
  }

  async clear(from: string): Promise<void> {
    this.storage.delete(from);
  }
}
