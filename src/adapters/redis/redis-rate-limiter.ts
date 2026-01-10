import Redis from 'ioredis';
import { RateLimiter, RateLimitResult } from '../../domain/ports/rate-limiter.js';
import { Logger } from '../../domain/ports/logger-port.js';
import { Config } from '../../infrastructure/config/config.js';

export class RedisRateLimiter implements RateLimiter {
  private client?: Redis;
  private inMemoryFallback: Map<string, { count: number; resetAt: number; windowSeconds: number }> = new Map();
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

        this.logger.info({}, 'RedisRateLimiter conectado com sucesso');
      } catch (error) {
        this.logger.warn({ error }, 'Erro ao conectar ao Redis. Usando fallback em memória.');
        this.isFallback = true;
      }
    } else {
      this.logger.info({}, 'Redis desabilitado. Usando fallback em memória.');
      this.isFallback = true;
    }
  }

  async hit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    try {
      if (this.isFallback || !this.client) {
        return this.hitInMemory(key, limit, windowSeconds);
      }

      return await this.hitRedis(key, limit, windowSeconds);
    } catch (error) {
      this.logger.warn({ key, error }, 'Erro ao verificar rate limit no Redis. Usando fallback.');
      return this.hitInMemory(key, limit, windowSeconds);
    }
  }

  private async hitRedis(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const rateLimitKey = this.getKey(key);
    const now = Date.now();
    const windowMs = windowSeconds * 1000;

    // Incrementar contador
    const count = await this.client!.incr(rateLimitKey);

    // Se for a primeira vez (count === 1), definir TTL
    if (count === 1) {
      await this.client!.expire(rateLimitKey, windowSeconds);
    }

    // Obter TTL restante para calcular resetAt
    const ttl = await this.client!.ttl(rateLimitKey);
    const resetAt = ttl > 0 ? new Date(now + (ttl * 1000)) : new Date(now + windowMs);

    const remaining = Math.max(0, limit - count);
    const allowed = count <= limit;

    return {
      allowed,
      remaining,
      resetAt,
    };
  }

  private hitInMemory(key: string, limit: number, windowSeconds: number): RateLimitResult {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const item = this.inMemoryFallback.get(key);

    // Se não existe ou já expirou, criar novo
    if (!item || now > item.resetAt) {
      const resetAt = now + windowMs;
      this.inMemoryFallback.set(key, {
        count: 1,
        resetAt,
        windowSeconds,
      });

      // Limpar após expiração
      setTimeout(() => {
        this.inMemoryFallback.delete(key);
      }, windowMs);

      return {
        allowed: true,
        remaining: limit - 1,
        resetAt: new Date(resetAt),
      };
    }

    // Incrementar contador
    item.count++;
    const remaining = Math.max(0, limit - item.count);
    const allowed = item.count <= limit;

    return {
      allowed,
      remaining,
      resetAt: new Date(item.resetAt),
    };
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
    }
  }

  private getKey(key: string): string {
    return `ratelimit:${key}`;
  }
}
