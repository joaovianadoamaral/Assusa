import { ConversationStateStore, ConversationState } from '../../application/ports/driven/conversation-state-store.js';
import { Logger } from '../../application/ports/driven/logger-port.js';

const DEFAULT_TTL_SECONDS = 15 * 60; // 15 minutos

/**
 * Implementação em memória do ConversationStateStore
 * Utilizada como fallback em desenvolvimento quando Redis não está disponível
 * 
 * Usa locks por chave para evitar race conditions em operações get/set concorrentes
 */
export class InMemoryConversationStateStore implements ConversationStateStore {
  private storage: Map<string, { state: ConversationState; expiresAt: number }> = new Map();
  // Mutex simples usando Promise para garantir operações atômicas por chave
  private locks: Map<string, Promise<void>> = new Map();

  constructor(private logger: Logger) {
    this.logger.info({}, 'InMemoryConversationStateStore inicializado');
  }

  async get(from: string): Promise<ConversationState | null> {
    const lock = this.acquireLock(from);
    try {
      await lock;
      return this.getInternal(from);
    } finally {
      this.releaseLock(from);
    }
  }

  private getInternal(from: string): ConversationState | null {
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
    const lock = this.acquireLock(from);
    try {
      await lock;
      this.setInternal(from, state, ttlSeconds);
    } finally {
      this.releaseLock(from);
    }
  }

  private setInternal(from: string, state: ConversationState, ttlSeconds: number): void {
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
    const lock = this.acquireLock(from);
    try {
      await lock;
      this.storage.delete(from);
    } finally {
      this.releaseLock(from);
    }
  }

  private acquireLock(key: string): Promise<void> {
    const existingLock = this.locks.get(key);
    if (existingLock) {
      return existingLock.then(() => this.acquireLock(key));
    }

    const lock = Promise.resolve();
    this.locks.set(key, lock);
    return lock;
  }

  private releaseLock(key: string): void {
    this.locks.delete(key);
  }
}
