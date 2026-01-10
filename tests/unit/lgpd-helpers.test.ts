import { describe, it, expect } from 'vitest';
import { hashCpf, maskCpf, sanitizeForLogs } from '../../src/domain/helpers/lgpd-helpers.js';

describe('LGPD Helpers', () => {
  const TEST_PEPPER = 'test-pepper-key-for-hashing-cpf-security-min-32-char';

  describe('hashCpf', () => {
    it('deve gerar hash SHA256 determinístico do CPF com pepper', () => {
      const cpfLimpo = '11144477735';
      const hash1 = hashCpf(cpfLimpo, TEST_PEPPER);
      const hash2 = hashCpf(cpfLimpo, TEST_PEPPER);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA256 produz 64 caracteres hexadecimais
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });

    it('deve gerar hash diferente para CPFs diferentes', () => {
      const hash1 = hashCpf('11144477735', TEST_PEPPER);
      const hash2 = hashCpf('98765432100', TEST_PEPPER);

      expect(hash1).not.toBe(hash2);
    });

    it('deve gerar hash diferente para o mesmo CPF com peppers diferentes', () => {
      const cpfLimpo = '11144477735';
      const pepper1 = 'pepper-one-for-testing-minimum-32-characters';
      const pepper2 = 'pepper-two-for-testing-minimum-32-characters';

      const hash1 = hashCpf(cpfLimpo, pepper1);
      const hash2 = hashCpf(cpfLimpo, pepper2);

      expect(hash1).not.toBe(hash2);
    });

    it('deve normalizar CPF antes de fazer hash', () => {
      const hash1 = hashCpf('111.444.777-35', TEST_PEPPER);
      const hash2 = hashCpf('11144477735', TEST_PEPPER);

      expect(hash1).toBe(hash2);
    });

    it('deve lançar erro se pepper tiver menos de 32 caracteres', () => {
      expect(() => {
        hashCpf('11144477735', 'short-pepper');
      }).toThrow('Pepper deve ter pelo menos 32 caracteres');
    });

    it('deve lançar erro se CPF não tiver 11 dígitos', () => {
      expect(() => {
        hashCpf('123', TEST_PEPPER);
      }).toThrow('CPF limpo deve ter 11 dígitos');
    });

    it('deve lançar erro se pepper estiver vazio', () => {
      expect(() => {
        hashCpf('11144477735', '');
      }).toThrow('Pepper deve ter pelo menos 32 caracteres');
    });
  });

  describe('maskCpf', () => {
    it('deve mascarar CPF no formato ***.***.***-XX mostrando apenas últimos 2 dígitos', () => {
      expect(maskCpf('11144477735')).toBe('***.***.***-35');
      expect(maskCpf('98765432100')).toBe('***.***.***-00');
    });

    it('deve normalizar CPF antes de mascarar', () => {
      expect(maskCpf('111.444.777-35')).toBe('***.***.***-35');
    });

    it('deve retornar original se CPF não tiver 11 dígitos', () => {
      expect(maskCpf('123')).toBe('123');
      expect(maskCpf('123456789')).toBe('123456789');
    });
  });

  describe('sanitizeForLogs', () => {
    it('deve remover campos sensíveis do objeto', () => {
      const obj = {
        id: '123',
        cpf: '11144477735',
        cpfLimpo: '11144477735',
        token: 'secret-token',
        message: 'teste',
      };

      const sanitized = sanitizeForLogs(obj);

      expect(sanitized).not.toHaveProperty('cpf');
      expect(sanitized).not.toHaveProperty('cpfLimpo');
      expect(sanitized).not.toHaveProperty('token');
      expect(sanitized).toHaveProperty('id', '123');
      expect(sanitized).toHaveProperty('message', 'teste');
    });

    it('deve mascarar CPF válido encontrado em strings', () => {
      const obj = {
        message: 'CPF: 111.444.777-35',
        description: 'Usuário com CPF 11144477735', // CPF válido sem formatação
        invalid: 'CPF: 00000000000', // CPF inválido não deve ser mascarado
      };

      const sanitized = sanitizeForLogs(obj);

      expect(sanitized.message).toBe('CPF: ***.***.***-35');
      expect(sanitized.description).toBe('Usuário com CPF ***.***.***-35'); // CPF válido sem formatação também é mascarado
      expect(sanitized.invalid).toBe('CPF: 00000000000'); // CPF inválido não é mascarado
    });

    it('deve remover múltiplos campos sensíveis', () => {
      const obj = {
        cpf: '11144477735',
        password: 'secret123',
        apiKey: 'key-123',
        clientSecret: 'secret-456',
        safeField: 'safe-value',
      };

      const sanitized = sanitizeForLogs(obj);

      expect(sanitized).not.toHaveProperty('cpf');
      expect(sanitized).not.toHaveProperty('password');
      expect(sanitized).not.toHaveProperty('apiKey');
      expect(sanitized).not.toHaveProperty('clientSecret');
      expect(sanitized).toHaveProperty('safeField', 'safe-value');
    });

    it('deve sanitizar objetos aninhados', () => {
      const obj = {
        id: '123',
        user: {
          cpf: '11144477735',
          name: 'João',
          token: 'secret-token',
        },
        metadata: {
          safe: 'data',
        },
      };

      const sanitized = sanitizeForLogs(obj);

      expect(sanitized.id).toBe('123');
      expect(sanitized.user).not.toHaveProperty('cpf');
      expect(sanitized.user).not.toHaveProperty('token');
      expect(sanitized.user).toHaveProperty('name', 'João');
      expect(sanitized.metadata).toHaveProperty('safe', 'data');
    });

    it('deve sanitizar arrays', () => {
      const obj = {
        items: [
          { id: '1', cpf: '11144477735' },
          { id: '2', name: 'Test' },
        ],
      };

      const sanitized = sanitizeForLogs(obj);

      expect(sanitized.items).toHaveLength(2);
      expect(sanitized.items[0]).not.toHaveProperty('cpf');
      expect(sanitized.items[0]).toHaveProperty('id', '1');
      expect(sanitized.items[1]).toHaveProperty('name', 'Test');
    });

    it('deve preservar tipos não sensíveis', () => {
      const obj = {
        id: '123',
        count: 42,
        active: true,
        createdAt: new Date('2024-01-01'),
        tags: ['tag1', 'tag2'],
      };

      const sanitized = sanitizeForLogs(obj);

      expect(sanitized.id).toBe('123');
      expect(sanitized.count).toBe(42);
      expect(sanitized.active).toBe(true);
      expect(sanitized.createdAt).toBeInstanceOf(Date);
      expect(sanitized.tags).toEqual(['tag1', 'tag2']);
    });

    it('deve lidar com campos case-insensitive', () => {
      const obj = {
        CPF: '11144477735',
        AccessToken: 'token-123',
        api_secret: 'secret-456',
      };

      const sanitized = sanitizeForLogs(obj);

      expect(sanitized).not.toHaveProperty('CPF');
      expect(sanitized).not.toHaveProperty('AccessToken');
      expect(sanitized).not.toHaveProperty('api_secret');
    });

    it('deve lidar com objetos vazios', () => {
      const obj = {};
      const sanitized = sanitizeForLogs(obj);
      expect(sanitized).toEqual({});
    });

    it('deve lidar com null e undefined', () => {
      const obj = {
        value: null,
        optional: undefined,
        safe: 'data',
      };

      const sanitized = sanitizeForLogs(obj);

      expect(sanitized.value).toBeNull();
      expect(sanitized.optional).toBeUndefined();
      expect(sanitized.safe).toBe('data');
    });

    it('não deve mutar o objeto original', () => {
      const obj = {
        id: '123',
        cpf: '11144477735',
        message: 'CPF: 111.444.777-35',
        token: 'secret-token',
      };

      const originalCpf = obj.cpf;
      const originalMessage = obj.message;
      const originalToken = obj.token;

      const sanitized = sanitizeForLogs(obj);

      // Objeto original não deve ser alterado
      expect(obj.cpf).toBe(originalCpf);
      expect(obj.message).toBe(originalMessage);
      expect(obj.token).toBe(originalToken);

      // Objeto sanitizado deve estar diferente
      expect(sanitized).not.toHaveProperty('cpf');
      expect(sanitized).not.toHaveProperty('token');
      expect(sanitized.message).not.toBe(originalMessage);
    });

    it('não deve mascarar CPF inválido dentro de strings', () => {
      const obj = {
        message: 'CPF inválido: 00000000000',
        description: 'Todos os dígitos iguais: 11111111111',
        text: 'CPF formatado inválido: 123.456.789-00',
        validCpf: 'CPF válido: 111.444.777-35',
      };

      const sanitized = sanitizeForLogs(obj);

      // CPFs inválidos não devem ser mascarados
      expect(sanitized.message).toBe('CPF inválido: 00000000000');
      expect(sanitized.description).toBe('Todos os dígitos iguais: 11111111111');
      expect(sanitized.text).toBe('CPF formatado inválido: 123.456.789-00');

      // CPF válido deve ser mascarado
      expect(sanitized.validCpf).toBe('CPF válido: ***.***.***-35');
    });

    it('deve mascarar CPF válido em arrays de strings', () => {
      const obj = {
        messages: [
          'CPF: 111.444.777-35',
          'Outro CPF: 98765432100',
          'CPF inválido: 00000000000',
        ],
      };

      const sanitized = sanitizeForLogs(obj);

      expect(sanitized.messages).toHaveLength(3);
      expect(sanitized.messages[0]).toBe('CPF: ***.***.***-35');
      expect(sanitized.messages[1]).toBe('Outro CPF: ***.***.***-00');
      expect(sanitized.messages[2]).toBe('CPF inválido: 00000000000'); // CPF inválido não é mascarado
    });
  });
});
