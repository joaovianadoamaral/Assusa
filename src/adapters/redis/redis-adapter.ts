import Redis from 'ioredis';
import { StoragePort } from '../../application/ports/driven/storage-port.js';
import { Logger } from '../../application/ports/driven/logger-port.js';
import { Config } from '../../infrastructure/config/config.js';

export class RedisAdapter implements StoragePort {
  private client?: Redis;
  private inMemoryFallback: Map<string, { value: string; expiresAt?: number }> = new Map();
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
              return null; // Para retry
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

        this.logger.info({}, 'Redis conectado com sucesso');
      } catch (error) {
        this.logger.warn({ error }, 'Erro ao conectar ao Redis. Usando fallback em memória.');
        this.isFallback = true;
      }
    } else {
      this.logger.info({}, 'Redis desabilitado. Usando fallback em memória.');
      this.isFallback = true;
    }
  }

  async get(key: string, requestId: string): Promise<string | null> {
    try {
      if (this.isFallback || !this.client) {
        return this.getFromMemory(key);
      }

      const value = await this.client.get(key);
      return value;
    } catch (error) {
      this.logger.warn({ requestId, key, error }, 'Erro ao buscar do Redis. Usando fallback.');
      return this.getFromMemory(key);
    }
  }

  async set(key: string, value: string, ttlSeconds?: number, requestId?: string): Promise<void> {
    try {
      if (this.isFallback || !this.client) {
        this.setInMemory(key, value, ttlSeconds);
        return;
      }

      if (ttlSeconds) {
        await this.client.setex(key, ttlSeconds, value);
      } else {
        await this.client.set(key, value);
      }
    } catch (error) {
      this.logger.warn({ requestId, key, error }, 'Erro ao salvar no Redis. Usando fallback.');
      this.setInMemory(key, value, ttlSeconds);
    }
  }

  async delete(key: string, requestId: string): Promise<void> {
    try {
      if (this.isFallback || !this.client) {
        this.deleteFromMemory(key);
        return;
      }

      await this.client.del(key);
    } catch (error) {
      this.logger.warn({ requestId, key, error }, 'Erro ao deletar do Redis. Usando fallback.');
      this.deleteFromMemory(key);
    }
  }

  async increment(key: string, requestId: string): Promise<number> {
    try {
      if (this.isFallback || !this.client) {
        return this.incrementInMemory(key);
      }

      return await this.client.incr(key);
    } catch (error) {
      this.logger.warn({ requestId, key, error }, 'Erro ao incrementar no Redis. Usando fallback.');
      return this.incrementInMemory(key);
    }
  }

  async expire(key: string, ttlSeconds: number, requestId: string): Promise<void> {
    try {
      if (this.isFallback || !this.client) {
        const existing = this.inMemoryFallback.get(key);
        if (existing) {
          existing.expiresAt = Date.now() + ttlSeconds * 1000;
        }
        return;
      }

      await this.client.expire(key, ttlSeconds);
    } catch (error) {
      this.logger.warn({ requestId, key, error }, 'Erro ao definir expiração no Redis. Usando fallback.');
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
    }
  }

  // Métodos de fallback em memória
  private getFromMemory(key: string): string | null {
    const item = this.inMemoryFallback.get(key);
    if (!item) {
      return null;
    }

    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.inMemoryFallback.delete(key);
      return null;
    }

    return item.value;
  }

  private setInMemory(key: string, value: string, ttlSeconds?: number): void {
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined;
    this.inMemoryFallback.set(key, { value, expiresAt });

    // Limpar expirados periodicamente (simplificado)
    if (expiresAt && ttlSeconds) {
      setTimeout(() => {
        this.inMemoryFallback.delete(key);
      }, ttlSeconds * 1000);
    }
  }

  private deleteFromMemory(key: string): void {
    this.inMemoryFallback.delete(key);
  }

  private incrementInMemory(key: string): number {
    const existing = this.getFromMemory(key);
    const newValue = existing ? parseInt(existing, 10) + 1 : 1;
    this.setInMemory(key, newValue.toString());
    return newValue;
  }
}
