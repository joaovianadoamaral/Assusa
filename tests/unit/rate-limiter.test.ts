import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InMemoryRateLimiter } from '../../src/adapters/in-memory/in-memory-rate-limiter.js';
import { RateLimiter } from '../../src/application/ports/driven/rate-limiter.js';
import { Logger } from '../../src/application/ports/driven/logger-port.js';

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };

    rateLimiter = new InMemoryRateLimiter(mockLogger);
  });

  describe('hit', () => {
    it('deve permitir primeira tentativa', async () => {
      const result = await rateLimiter.hit('user123', 5, 3600);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
      expect(result.resetAt).toBeInstanceOf(Date);
      expect(result.resetAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('deve permitir tentativas até o limite', async () => {
      const limit = 5;
      const windowSeconds = 3600;

      for (let i = 0; i < limit; i++) {
        const result = await rateLimiter.hit('user123', limit, windowSeconds);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(limit - i - 1);
      }
    });

    it('deve bloquear após exceder o limite', async () => {
      const limit = 5;
      const windowSeconds = 3600;

      // Executar até o limite
      for (let i = 0; i < limit; i++) {
        await rateLimiter.hit('user123', limit, windowSeconds);
      }

      // Próxima tentativa deve ser bloqueada
      const result = await rateLimiter.hit('user123', limit, windowSeconds);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('deve calcular remaining corretamente', async () => {
      const limit = 10;
      const windowSeconds = 3600;

      // 3 tentativas
      await rateLimiter.hit('user123', limit, windowSeconds);
      await rateLimiter.hit('user123', limit, windowSeconds);
      const result = await rateLimiter.hit('user123', limit, windowSeconds);

      expect(result.remaining).toBe(7); // 10 - 3 = 7
    });

    it('deve manter contador dentro da janela de tempo', async () => {
      const limit = 3;
      const windowSeconds = 1; // 1 segundo

      // 2 tentativas
      await rateLimiter.hit('user123', limit, windowSeconds);
      await rateLimiter.hit('user123', limit, windowSeconds);
      
      const result = await rateLimiter.hit('user123', limit, windowSeconds);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(0);
    });

    it('deve resetar contador após expirar janela (mock)', async () => {
      const limit = 2;
      const windowSeconds = 0.2; // 200ms para teste rápido

      // Esgotar limite
      await rateLimiter.hit('user123', limit, windowSeconds);
      await rateLimiter.hit('user123', limit, windowSeconds);
      
      const blocked = await rateLimiter.hit('user123', limit, windowSeconds);
      expect(blocked.allowed).toBe(false);

      // Aguardar janela expirar
      await new Promise((resolve) => setTimeout(resolve, 250));

      // Nova tentativa deve ser permitida (resetou)
      const allowed = await rateLimiter.hit('user123', limit, windowSeconds);
      expect(allowed.allowed).toBe(true);
      expect(allowed.remaining).toBe(limit - 1);
    });
  });

  describe('rate limit por CPF inválido (5/24h)', () => {
    it('deve permitir 5 tentativas de CPF inválido', async () => {
      const limit = 5;
      const windowSeconds = 24 * 60 * 60; // 24 horas
      const key = 'cpf_invalid:5511999999999';

      for (let i = 0; i < limit; i++) {
        const result = await rateLimiter.hit(key, limit, windowSeconds);
        expect(result.allowed).toBe(true);
      }

      const blocked = await rateLimiter.hit(key, limit, windowSeconds);
      expect(blocked.allowed).toBe(false);
    });
  });

  describe('rate limit por solicitações totais (10/24h)', () => {
    it('deve permitir 10 solicitações totais', async () => {
      const limit = 10;
      const windowSeconds = 24 * 60 * 60; // 24 horas
      const key = 'total_requests:5511999999999';

      for (let i = 0; i < limit; i++) {
        const result = await rateLimiter.hit(key, limit, windowSeconds);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(limit - i - 1);
      }

      const blocked = await rateLimiter.hit(key, limit, windowSeconds);
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
    });
  });

  describe('múltiplas chaves', () => {
    it('deve manter contadores separados por chave', async () => {
      const limit = 3;

      // Esgotar limite para user1
      await rateLimiter.hit('user1', limit, 3600);
      await rateLimiter.hit('user1', limit, 3600);
      await rateLimiter.hit('user1', limit, 3600);

      const user1Blocked = await rateLimiter.hit('user1', limit, 3600);
      expect(user1Blocked.allowed).toBe(false);

      // user2 ainda deve ter limite disponível
      const user2Allowed = await rateLimiter.hit('user2', limit, 3600);
      expect(user2Allowed.allowed).toBe(true);
      expect(user2Allowed.remaining).toBe(limit - 1);
    });
  });

  describe('resetAt', () => {
    it('deve retornar data de reset futura', async () => {
      const windowSeconds = 3600;
      const result = await rateLimiter.hit('user123', 5, windowSeconds);

      expect(result.resetAt.getTime()).toBeGreaterThan(Date.now());
      
      // Deve estar próximo de agora + windowSeconds (com margem de erro)
      const expectedTime = Date.now() + windowSeconds * 1000;
      const diff = Math.abs(result.resetAt.getTime() - expectedTime);
      expect(diff).toBeLessThan(1000); // Menos de 1 segundo de diferença
    });

    it('deve manter resetAt consistente durante a janela', async () => {
      const windowSeconds = 2;
      const limit = 5;

      const result1 = await rateLimiter.hit('user123', limit, windowSeconds);
      const result2 = await rateLimiter.hit('user123', limit, windowSeconds);
      const result3 = await rateLimiter.hit('user123', limit, windowSeconds);

      // Todas devem ter o mesmo resetAt (dentro da mesma janela)
      expect(result1.resetAt.getTime()).toBe(result2.resetAt.getTime());
      expect(result2.resetAt.getTime()).toBe(result3.resetAt.getTime());
    });
  });
});
