import Redis from 'ioredis';
import { ConversationStateStore, ConversationState } from '../../application/ports/driven/conversation-state-store.js';
import { Logger } from '../../application/ports/driven/logger-port.js';
import { Config } from '../../infrastructure/config/config.js';

const DEFAULT_TTL_SECONDS = 15 * 60; // 15 minutos

export class RedisConversationStateStore implements ConversationStateStore {
  private client?: Redis;
  private inMemoryFallback: Map<string, { state: ConversationState; expiresAt: number }> = new Map();
  private isFallback: boolean = false;

  constructor(config: Config, private logger: Logger) {
    if (config.redisEnabled && config.redisUrl) {
      try {
        this.client = new Redis(config.redisUrl, {
          maxRetriesPerRequest: 3,
          retryStrategy: (times) => {
            if (times > 3) {
              this.logger.warn({}, 'Muitas tentativas de conexão ao Redis. Usando fallback em memória.');
              this.isFallback = true;
              return null;
            }
            return Math.min(times * 50, 2000);
          },
          reconnectOnError: (err) => {
            const targetError = 'READONLY';
            if (err.message.includes(targetError)) {
              return true;
            }
            return false;
          },
        });

        this.client.on('error', (err) => {
          if (!this.isFallback) {
            this.logger.warn({ error: err.message }, 'Erro no Redis. Usando fallback em memória.');
            this.isFallback = true;
          }
        });

        this.client.on('connect', () => {
          if (this.isFallback) {
            this.logger.info({}, 'Conexão com Redis restaurada.');
            this.isFallback = false;
          }
        });

        this.logger.info({}, 'RedisConversationStateStore conectado com sucesso');
      } catch (error) {
        this.logger.warn({ error }, 'Erro ao conectar ao Redis. Usando fallback em memória.');
        this.isFallback = true;
      }
    } else {
      this.logger.info({}, 'Redis desabilitado. Usando fallback em memória.');
      this.isFallback = true;
    }
  }

  async get(from: string): Promise<ConversationState | null> {
    try {
      if (this.isFallback || !this.client) {
        return this.getFromMemory(from);
      }

      const key = this.getKey(from);
      const value = await this.client.get(key);
      
      if (!value) {
        return null;
      }

      const state = JSON.parse(value) as ConversationState;
      // Converter updatedAt de string para Date
      return {
        ...state,
        updatedAt: new Date(state.updatedAt),
      };
    } catch (error) {
      this.logger.warn({ from, error }, 'Erro ao buscar estado do Redis. Usando fallback.');
      return this.getFromMemory(from);
    }
  }

  async set(from: string, state: ConversationState, ttlSeconds: number = DEFAULT_TTL_SECONDS): Promise<void> {
    try {
      if (this.isFallback || !this.client) {
        this.setInMemory(from, state, ttlSeconds);
        return;
      }

      const key = this.getKey(from);
      const value = JSON.stringify(state);
      
      // SETEX é atômico, então não há race condition aqui
      // Mas para operações read-modify-write, precisamos de lock distribuído
      await this.client.setex(key, ttlSeconds, value);
    } catch (error) {
      this.logger.warn({ from, error }, 'Erro ao salvar estado no Redis. Usando fallback.');
      this.setInMemory(from, state, ttlSeconds);
    }
  }

  /**
   * Obtém e atualiza o estado de forma atômica usando lock distribuído
   * Isso previne race conditions em operações read-modify-write
   */
  async getAndUpdate(
    from: string,
    updateFn: (currentState: ConversationState | null) => ConversationState,
    ttlSeconds: number = DEFAULT_TTL_SECONDS
  ): Promise<ConversationState> {
    const lockKey = `${this.getKey(from)}:lock`;
    const lockTtl = 5; // 5 segundos para o lock
    const maxRetries = 10;
    const retryDelay = 100; // 100ms

    if (this.isFallback || !this.client) {
      // Fallback: usar lock simples em memória
      return this.getAndUpdateInMemory(from, updateFn, ttlSeconds);
    }

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Tentar adquirir lock distribuído usando SETNX
        const lockAcquired = await this.client.set(lockKey, '1', 'EX', lockTtl, 'NX');
        
        if (lockAcquired === 'OK') {
          try {
            // Lock adquirido, executar operação read-modify-write
            const currentState = await this.get(from);
            const newState = updateFn(currentState);
            await this.set(from, newState, ttlSeconds);
            return newState;
          } finally {
            // Sempre liberar o lock
            await this.client.del(lockKey);
          }
        } else {
          // Lock não disponível, aguardar e tentar novamente
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      } catch (error) {
        this.logger.warn({ from, attempt, error }, 'Erro ao obter/atualizar estado com lock. Tentando fallback.');
        // Em caso de erro, tentar fallback em memória
        return this.getAndUpdateInMemory(from, updateFn, ttlSeconds);
      }
    }

    // Se não conseguiu adquirir lock após várias tentativas, usar fallback
    this.logger.warn({ from }, 'Não foi possível adquirir lock após várias tentativas. Usando fallback.');
    return this.getAndUpdateInMemory(from, updateFn, ttlSeconds);
  }

  private async getAndUpdateInMemory(
    from: string,
    updateFn: (currentState: ConversationState | null) => ConversationState,
    ttlSeconds: number
  ): Promise<ConversationState> {
    const currentState = this.getFromMemory(from);
    const newState = updateFn(currentState);
    this.setInMemory(from, newState, ttlSeconds);
    return newState;
  }

  async clear(from: string): Promise<void> {
    try {
      if (this.isFallback || !this.client) {
        this.deleteFromMemory(from);
        return;
      }

      const key = this.getKey(from);
      await this.client.del(key);
    } catch (error) {
      this.logger.warn({ from, error }, 'Erro ao limpar estado do Redis. Usando fallback.');
      this.deleteFromMemory(from);
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
    }
  }

  private getKey(from: string): string {
    return `conversation:${from}`;
  }

  private getFromMemory(from: string): ConversationState | null {
    const item = this.inMemoryFallback.get(from);
    if (!item) {
      return null;
    }

    if (Date.now() > item.expiresAt) {
      this.inMemoryFallback.delete(from);
      return null;
    }

    return item.state;
  }

  private setInMemory(from: string, state: ConversationState, ttlSeconds: number): void {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.inMemoryFallback.set(from, { state, expiresAt });

    // Limpar expirado após TTL
    setTimeout(() => {
      this.inMemoryFallback.delete(from);
    }, ttlSeconds * 1000);
  }

  private deleteFromMemory(from: string): void {
    this.inMemoryFallback.delete(from);
  }
}
