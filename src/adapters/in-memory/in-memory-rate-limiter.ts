import { RateLimiter, RateLimitResult } from '../../application/ports/driven/rate-limiter.js';
import { Logger } from '../../application/ports/driven/logger-port.js';

/**
 * Implementação em memória do RateLimiter
 * Utilizada como fallback em desenvolvimento quando Redis não está disponível
 * 
 * Usa Map sincronizado para evitar race conditions em ambientes multi-threaded
 * (Node.js é single-threaded, mas operações assíncronas podem causar race conditions)
 */
export class InMemoryRateLimiter implements RateLimiter {
  private storage: Map<string, { count: number; resetAt: number; windowSeconds: number }> = new Map();
  // Mutex simples usando Promise para garantir operações atômicas
  private locks: Map<string, Promise<void>> = new Map();

  constructor(private logger: Logger) {
    this.logger.info({}, 'InMemoryRateLimiter inicializado');
  }

  async hit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    // Garantir que apenas uma operação por key execute por vez
    const lock = this.acquireLock(key);
    try {
      await lock;
      return this.hitInternal(key, limit, windowSeconds);
    } finally {
      this.releaseLock(key);
    }
  }

  private async hitInternal(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
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
        const currentItem = this.storage.get(key);
        if (currentItem && Date.now() > currentItem.resetAt) {
          this.storage.delete(key);
        }
      }, windowMs);

      return {
        allowed: true,
        remaining: limit - 1,
        resetAt: new Date(resetAt),
      };
    }

    // Incrementar contador (agora thread-safe)
    item.count++;
    const remaining = Math.max(0, limit - item.count);
    const allowed = item.count <= limit;

    return {
      allowed,
      remaining,
      resetAt: new Date(item.resetAt),
    };
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
