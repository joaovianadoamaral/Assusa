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
      
      await this.client.setex(key, ttlSeconds, value);
    } catch (error) {
      this.logger.warn({ from, error }, 'Erro ao salvar estado no Redis. Usando fallback.');
      this.setInMemory(from, state, ttlSeconds);
    }
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
