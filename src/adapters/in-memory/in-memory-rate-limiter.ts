import { RateLimiter, RateLimitResult } from '../../application/ports/driven/rate-limiter.js';
import { Logger } from '../../application/ports/driven/logger-port.js';

/**
 * Implementação em memória do RateLimiter
 * Utilizada como fallback em desenvolvimento quando Redis não está disponível
 */
export class InMemoryRateLimiter implements RateLimiter {
  private storage: Map<string, { count: number; resetAt: number; windowSeconds: number }> = new Map();

  constructor(private logger: Logger) {
    this.logger.info({}, 'InMemoryRateLimiter inicializado');
  }

  async hit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const item = this.storage.get(key);

    // Se não existe ou já expirou, criar novo
    if (!item || now > item.resetAt) {
      const resetAt = now + windowMs;
      this.storage.set(key, {
        count: 1,
        resetAt,
        windowSeconds,
      });

      // Limpar após expiração
      setTimeout(() => {
        this.storage.delete(key);
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
}
