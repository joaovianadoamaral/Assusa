import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InMemoryConversationStateStore } from '../../src/adapters/in-memory/in-memory-conversation-state-store.js';
import { ConversationStateStore } from '../../src/application/ports/driven/conversation-state-store.js';
import { FlowType } from '../../src/domain/enums/flow-type.js';
import { Logger } from '../../src/application/ports/driven/logger-port.js';

describe('ConversationStateStore', () => {
  let store: ConversationStateStore;
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };

    store = new InMemoryConversationStateStore(mockLogger);
  });

  describe('get', () => {
    it('deve retornar null quando não há estado armazenado', async () => {
      const result = await store.get('user123');
      expect(result).toBeNull();
    });

    it('deve retornar o estado armazenado', async () => {
      const state = {
        activeFlow: FlowType.SECOND_COPY,
        step: 'AGUARDANDO_CPF',
        data: { cpf: '12345678900' },
        updatedAt: new Date(),
      };

      await store.set('user123', state);
      const result = await store.get('user123');

      expect(result).not.toBeNull();
      expect(result?.activeFlow).toBe(FlowType.SECOND_COPY);
      expect(result?.step).toBe('AGUARDANDO_CPF');
      expect(result?.data).toEqual({ cpf: '12345678900' });
      expect(result?.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('set', () => {
    it('deve armazenar o estado com TTL padrão (15 minutos)', async () => {
      const state = {
        activeFlow: FlowType.SECOND_COPY,
        step: 'AGUARDANDO_CPF',
        data: {},
        updatedAt: new Date(),
      };

      await store.set('user123', state);
      const result = await store.get('user123');

      expect(result).not.toBeNull();
      expect(result?.activeFlow).toBe(FlowType.SECOND_COPY);
    });

    it('deve armazenar o estado com TTL customizado', async () => {
      const state = {
        activeFlow: FlowType.DELETE_DATA,
        step: 'AGUARDANDO_CPF',
        data: {},
        updatedAt: new Date(),
      };

      // TTL de 1 segundo para teste
      await store.set('user123', state, 1);
      const result1 = await store.get('user123');
      expect(result1).not.toBeNull();

      // Aguardar 1.1 segundos para expirar
      await new Promise((resolve) => setTimeout(resolve, 1100));
      const result2 = await store.get('user123');
      expect(result2).toBeNull();
    });

    it('deve atualizar estado existente', async () => {
      const state1 = {
        activeFlow: FlowType.SECOND_COPY,
        step: 'AGUARDANDO_CPF',
        data: { step1: 'data' },
        updatedAt: new Date(),
      };

      await store.set('user123', state1);

      const state2 = {
        activeFlow: FlowType.SECOND_COPY,
        step: 'PROCESSANDO',
        data: { step2: 'data' },
        updatedAt: new Date(),
      };

      await store.set('user123', state2);
      const result = await store.get('user123');

      expect(result?.step).toBe('PROCESSANDO');
      expect(result?.data).toEqual({ step2: 'data' });
    });
  });

  describe('clear', () => {
    it('deve remover o estado armazenado', async () => {
      const state = {
        activeFlow: FlowType.OPEN_SITE,
        step: 'INITIAL',
        data: {},
        updatedAt: new Date(),
      };

      await store.set('user123', state);
      await store.clear('user123');
      const result = await store.get('user123');

      expect(result).toBeNull();
    });

    it('deve ser idempotente (não deve falhar ao limpar estado inexistente)', async () => {
      await expect(store.clear('user123')).resolves.not.toThrow();
    });
  });

  describe('transições de fluxo', () => {
    it('deve suportar transição de SECOND_COPY', async () => {
      const state = {
        activeFlow: FlowType.SECOND_COPY,
        step: 'AGUARDANDO_CPF',
        data: {},
        updatedAt: new Date(),
      };

      await store.set('user123', state);
      const result = await store.get('user123');

      expect(result?.activeFlow).toBe(FlowType.SECOND_COPY);
      expect(result?.step).toBe('AGUARDANDO_CPF');
    });

    it('deve suportar transição de TALK_TO_US', async () => {
      const state = {
        activeFlow: FlowType.TALK_TO_US,
        step: 'SHOWING_CONTACT',
        data: {},
        updatedAt: new Date(),
      };

      await store.set('user123', state);
      const result = await store.get('user123');

      expect(result?.activeFlow).toBe(FlowType.TALK_TO_US);
    });

    it('deve suportar transição de OPEN_SITE', async () => {
      const state = {
        activeFlow: FlowType.OPEN_SITE,
        step: 'SHOWING_LINK',
        data: {},
        updatedAt: new Date(),
      };

      await store.set('user123', state);
      const result = await store.get('user123');

      expect(result?.activeFlow).toBe(FlowType.OPEN_SITE);
    });

    it('deve suportar transição de DELETE_DATA', async () => {
      const state = {
        activeFlow: FlowType.DELETE_DATA,
        step: 'AGUARDANDO_CPF_EXCLUSAO',
        data: {},
        updatedAt: new Date(),
      };

      await store.set('user123', state);
      const result = await store.get('user123');

      expect(result?.activeFlow).toBe(FlowType.DELETE_DATA);
      expect(result?.step).toBe('AGUARDANDO_CPF_EXCLUSAO');
    });

    it('deve permitir múltiplos passos no mesmo fluxo', async () => {
      // Passo 1
      const state1 = {
        activeFlow: FlowType.SECOND_COPY,
        step: 'AGUARDANDO_CPF',
        data: {},
        updatedAt: new Date(),
      };
      await store.set('user123', state1);

      // Passo 2
      const state2 = {
        activeFlow: FlowType.SECOND_COPY,
        step: 'PROCESSANDO',
        data: { cpf: 'hashed' },
        updatedAt: new Date(),
      };
      await store.set('user123', state2);

      // Passo 3
      const state3 = {
        activeFlow: FlowType.SECOND_COPY,
        step: 'FINALIZADO',
        data: { cpf: 'hashed', boletoId: '123' },
        updatedAt: new Date(),
      };
      await store.set('user123', state3);

      const result = await store.get('user123');
      expect(result?.activeFlow).toBe(FlowType.SECOND_COPY);
      expect(result?.step).toBe('FINALIZADO');
      expect(result?.data).toEqual({ cpf: 'hashed', boletoId: '123' });
    });
  });

  describe('TTL', () => {
    it('deve expirar estado após TTL padrão (mock)', async () => {
      const state = {
        activeFlow: FlowType.SECOND_COPY,
        step: 'AGUARDANDO_CPF',
        data: {},
        updatedAt: new Date(),
      };

      // Usar TTL de 100ms para teste rápido
      await store.set('user123', state, 0.1);
      
      // Estado deve existir imediatamente
      const result1 = await store.get('user123');
      expect(result1).not.toBeNull();

      // Aguardar TTL + margem
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Estado deve ter expirado
      const result2 = await store.get('user123');
      expect(result2).toBeNull();
    });

    it('deve manter estado dentro do TTL', async () => {
      const state = {
        activeFlow: FlowType.DELETE_DATA,
        step: 'AGUARDANDO_CPF_EXCLUSAO',
        data: {},
        updatedAt: new Date(),
      };

      // TTL de 500ms
      await store.set('user123', state, 0.5);
      
      // Aguardar menos que TTL
      await new Promise((resolve) => setTimeout(resolve, 200));

      const result = await store.get('user123');
      expect(result).not.toBeNull();
    });
  });
});
