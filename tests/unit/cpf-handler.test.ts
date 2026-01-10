import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CpfHandler } from '../../src/infrastructure/security/cpf-handler.js';

describe('CpfHandler', () => {
  const originalPepper = process.env.CPF_PEPPER;
  
  beforeEach(() => {
    // Pepper deve ter pelo menos 32 caracteres conforme validação em lgpd-helpers
    process.env.CPF_PEPPER = 'test-pepper-key-for-hashing-cpf-security-min-32-char';
  });

  afterEach(() => {
    process.env.CPF_PEPPER = originalPepper;
  });

  describe('normalizeCpf', () => {
    it('deve remover caracteres especiais do CPF', () => {
      expect(CpfHandler.normalizeCpf('123.456.789-00')).toBe('12345678900');
      expect(CpfHandler.normalizeCpf('12345678900')).toBe('12345678900');
      expect(CpfHandler.normalizeCpf('  123  .  456  .  789  -  00  ')).toBe('12345678900');
    });
  });

  describe('isValidFormat', () => {
    it('deve validar formato correto de CPF', () => {
      expect(CpfHandler.isValidFormat('12345678900')).toBe(true);
      expect(CpfHandler.isValidFormat('123.456.789-00')).toBe(true);
      expect(CpfHandler.isValidFormat('1234567890')).toBe(false);
      expect(CpfHandler.isValidFormat('123456789001')).toBe(false);
      expect(CpfHandler.isValidFormat('abc12345678')).toBe(false);
    });
  });

  describe('isValidCpf', () => {
    it('deve validar CPF válido', () => {
      // CPFs válidos para teste
      expect(CpfHandler.isValidCpf('11144477735')).toBe(true);
      expect(CpfHandler.isValidCpf('111.444.777-35')).toBe(true);
    });

    it('deve rejeitar CPF inválido', () => {
      expect(CpfHandler.isValidCpf('12345678900')).toBe(false);
      expect(CpfHandler.isValidCpf('00000000000')).toBe(false);
      expect(CpfHandler.isValidCpf('11111111111')).toBe(false);
      expect(CpfHandler.isValidCpf('123')).toBe(false);
    });
  });

  describe('maskCpf', () => {
    it('deve mascarar CPF corretamente', () => {
      expect(CpfHandler.maskCpf('12345678900')).toBe('123.456.789-00');
      expect(CpfHandler.maskCpf('123.456.789-00')).toBe('123.456.789-00');
    });

    it('deve retornar original se CPF não tiver 11 dígitos', () => {
      expect(CpfHandler.maskCpf('123')).toBe('123');
      expect(CpfHandler.maskCpf('123456789')).toBe('123456789');
    });
  });

  describe('hashCpf', () => {
    it('deve gerar hash SHA256 do CPF com pepper', () => {
      const cpf = '12345678900';
      const hash1 = CpfHandler.hashCpf(cpf);
      const hash2 = CpfHandler.hashCpf(cpf);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA256 produz 64 caracteres hexadecimais
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });

    it('deve gerar hash diferente para CPFs diferentes', () => {
      const hash1 = CpfHandler.hashCpf('12345678900');
      const hash2 = CpfHandler.hashCpf('98765432100');
      
      expect(hash1).not.toBe(hash2);
    });

    it('deve lançar erro se pepper não estiver configurado', () => {
      process.env.CPF_PEPPER = '';
      
      expect(() => {
        CpfHandler.hashCpf('12345678900');
      }).toThrow('CPF_PEPPER não configurado');
    });
  });

  describe('sanitizeForLog', () => {
    it('deve mascarar CPFs válidos em strings (formatados ou não)', () => {
      // CPF formatado válido deve ser mascarado
      expect(CpfHandler.sanitizeForLog('CPF: 111.444.777-35')).toBe('CPF: ***.***.***-35');
      // CPF sem formatação válido também deve ser mascarado (alinhado com sanitizeForLogs)
      expect(CpfHandler.sanitizeForLog('CPF: 11144477735')).toBe('CPF: ***.***.***-35');
      // CPF inválido não deve ser mascarado
      expect(CpfHandler.sanitizeForLog('CPF: 12345678900')).toBe('CPF: 12345678900');
    });
  });

  describe('generateSafeFilename', () => {
    beforeEach(() => {
      process.env.ALLOW_RAW_CPF_IN_FILENAME = 'false';
    });

    it('deve gerar nome de arquivo sem CPF quando não permitido', () => {
      const filename = CpfHandler.generateSafeFilename('boleto', '123456', '12345678900');
      expect(filename).not.toContain('12345678900');
      expect(filename).toContain('boleto');
      expect(filename).toContain('123456');
    });

    it('deve gerar nome de arquivo com CPF quando permitido', () => {
      process.env.ALLOW_RAW_CPF_IN_FILENAME = 'true';
      const filename = CpfHandler.generateSafeFilename('boleto', '123456', '12345678900');
      expect(filename).toContain('12345678900');
      expect(filename).toContain('boleto');
      expect(filename).toContain('123456');
    });
  });
});
