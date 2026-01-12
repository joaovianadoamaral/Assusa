import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SimplePdfServiceAdapter } from '../../src/adapters/services/simple-pdf-service-adapter.js';
import { Logger } from '../../src/application/ports/driven/logger-port.js';
import { Buffer } from 'buffer';

describe('SimplePdfServiceAdapter', () => {
  let pdfService: SimplePdfServiceAdapter;
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };

    pdfService = new SimplePdfServiceAdapter(mockLogger);
  });

  describe('buildFromData', () => {
    it('deve gerar PDF válido com dados completos', async () => {
      const data = {
        nossoNumero: '123456789',
        linhaDigitavel: '12345.67890 12345.678901 12345.678901 1 23456789012',
        codigoBarras: '12345678901234567890123456789012345678901234',
        valor: 100.50,
        vencimento: new Date('2024-12-31'),
        beneficiario: 'Empresa Exemplo LTDA',
        pagador: 'João da Silva',
      };

      const result = await pdfService.buildFromData({ data });

      // Verificar que retorna Buffer
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);

      // Verificar que é um PDF válido (começa com "%PDF")
      const pdfHeader = result.slice(0, 4).toString();
      expect(pdfHeader).toBe('%PDF');

      // Verificar que o logger foi chamado
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          nossoNumero: data.nossoNumero,
          size: expect.any(Number),
        }),
        'PDF gerado a partir de dados'
      );
    });

    it('deve gerar PDF válido com dados mínimos', async () => {
      const data = {
        nossoNumero: '987654321',
        linhaDigitavel: '98765.43210 98765.432109 87654.321098 7 65432109876',
        valor: 50.00,
        vencimento: new Date('2024-06-15'),
      };

      const result = await pdfService.buildFromData({ data });

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);

      const pdfHeader = result.slice(0, 4).toString();
      expect(pdfHeader).toBe('%PDF');
    });

    it('deve gerar PDF válido sem campos opcionais', async () => {
      const data = {
        nossoNumero: '111222333',
        linhaDigitavel: '11111.22222 33333.444445 55555.666666 7 88888888888',
        valor: 0,
        vencimento: new Date(),
      };

      const result = await pdfService.buildFromData({ data });

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);

      const pdfHeader = result.slice(0, 4).toString();
      expect(pdfHeader).toBe('%PDF');
    });

    it('deve gerar PDF válido com código de barras', async () => {
      const data = {
        nossoNumero: '555666777',
        linhaDigitavel: '55555.66666 77777.888888 99999.000000 1 11111111111',
        codigoBarras: '555566667777888899990000111111111111',
        valor: 250.75,
        vencimento: new Date('2024-08-20'),
        beneficiario: 'Teste Beneficiário',
      };

      const result = await pdfService.buildFromData({ data });

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);

      const pdfHeader = result.slice(0, 4).toString();
      expect(pdfHeader).toBe('%PDF');
    });

    it('deve gerar PDFs diferentes para dados diferentes', async () => {
      const data1 = {
        nossoNumero: '111111111',
        linhaDigitavel: '11111.11111 11111.111111 11111.111111 1 11111111111',
        valor: 100.00,
        vencimento: new Date('2024-01-01'),
      };

      const data2 = {
        nossoNumero: '222222222',
        linhaDigitavel: '22222.22222 22222.222222 22222.222222 2 22222222222',
        valor: 200.00,
        vencimento: new Date('2024-02-02'),
      };

      const result1 = await pdfService.buildFromData({ data: data1 });
      const result2 = await pdfService.buildFromData({ data: data2 });

      // PDFs devem ser diferentes (tamanho ou conteúdo)
      expect(result1.length).not.toBe(result2.length);
    });
  });

  describe('buildFromBankPdf', () => {
    it('deve retornar o buffer do PDF do banco como está', async () => {
      const originalBuffer = Buffer.from('%PDF-1.4\n...conteúdo do PDF...');
      const params = {
        bankPdfBuffer: originalBuffer,
        filename: 'boleto-123.pdf',
      };

      const result = await pdfService.buildFromBankPdf(params);

      // Deve ser o mesmo buffer (referência)
      expect(result).toBe(originalBuffer);
      expect(result.toString()).toBe(originalBuffer.toString());

      // Verificar que o logger foi chamado
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          filename: params.filename,
        }),
        'PDF processado (buffer original do banco)'
      );
    });

    it('deve retornar buffer válido mesmo sem filename', async () => {
      const originalBuffer = Buffer.from('%PDF-1.4\ntest content');
      const params = {
        bankPdfBuffer: originalBuffer,
      };

      const result = await pdfService.buildFromBankPdf(params);

      expect(result).toBe(originalBuffer);
      expect(result.length).toBeGreaterThan(0);
    });

    it('deve tratar erro e lançar exceção se houver problema', async () => {
      // Forçar erro (não deveria acontecer em buildFromBankPdf, mas testamos tratamento)
      const invalidParams = null as any;

      await expect(pdfService.buildFromBankPdf(invalidParams)).rejects.toThrow();

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});
