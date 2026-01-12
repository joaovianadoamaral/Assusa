import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GoogleSheetLoggerAdapter } from '../../src/adapters/google/google-sheet-logger-adapter.js';
import { SheetsPort } from '../../src/application/ports/driven/sheets-port.js';
import { Logger } from '../../src/application/ports/driven/logger-port.js';
import { EventType } from '../../src/domain/enums/event-type.js';

describe('GoogleSheetLoggerAdapter', () => {
  let adapter: GoogleSheetLoggerAdapter;
  let mockSheetsPort: SheetsPort;
  let mockLogger: Logger;

  beforeEach(() => {
    mockSheetsPort = {
      logRequest: vi.fn(),
      findRequestsByCpfHash: vi.fn(),
      deleteRequestsByCpfHash: vi.fn(),
    };

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };

    adapter = new GoogleSheetLoggerAdapter(mockSheetsPort, mockLogger);
  });

  it('deve converter EventType.SECOND_COPY_REQUEST em RequestLog com action GERAR_2VIA', async () => {
    const payload = {
      from: 'whatsapp-id-123',
      cpfHash: 'hash123',
      cpfMasked: '***.***.***-12',
      requestId: 'req-123',
      timestamp: new Date().toISOString(),
    };

    await adapter.appendEvent(EventType.SECOND_COPY_REQUEST, payload);

    expect(mockSheetsPort.logRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        whatsappId: 'whatsapp-id-123',
        cpfHash: 'hash123',
        cpfMasked: '***.***.***-12',
        action: 'GERAR_2VIA',
        status: 'SUCCESS',
      }),
      'req-123'
    );
  });

  it('deve converter EventType.CONTACT_REQUEST em RequestLog com action FALE_CONOSCO', async () => {
    const payload = {
      from: 'whatsapp-id-123',
      message: 'Mensagem de contato',
      requestId: 'req-123',
      timestamp: new Date().toISOString(),
    };

    await adapter.appendEvent(EventType.CONTACT_REQUEST, payload);

    expect(mockSheetsPort.logRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'FALE_CONOSCO',
        status: 'SUCCESS',
      }),
      'req-123'
    );
  });

  it('deve converter EventType.OPEN_SITE em RequestLog com action ACESSAR_SITE', async () => {
    const payload = {
      from: 'whatsapp-id-123',
      url: 'https://example.com',
      tokenUsed: true,
      requestId: 'req-123',
      timestamp: new Date().toISOString(),
    };

    await adapter.appendEvent(EventType.OPEN_SITE, payload);

    expect(mockSheetsPort.logRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ACESSAR_SITE',
        status: 'SUCCESS',
      }),
      'req-123'
    );
  });

  it('deve converter EventType.DELETE_DATA em RequestLog com action EXCLUIR_DADOS', async () => {
    const payload = {
      from: 'whatsapp-id-123',
      deletedFilesCount: 3,
      requestId: 'req-123',
      timestamp: new Date().toISOString(),
    };

    await adapter.appendEvent(EventType.DELETE_DATA, payload);

    expect(mockSheetsPort.logRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'EXCLUIR_DADOS',
        status: 'SUCCESS',
      }),
      'req-123'
    );
  });

  it('deve usar cpfMasked padrão quando não fornecido', async () => {
    const payload = {
      from: 'whatsapp-id-123',
      requestId: 'req-123',
      timestamp: new Date().toISOString(),
    };

    await adapter.appendEvent(EventType.SECOND_COPY_REQUEST, payload);

    expect(mockSheetsPort.logRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        cpfMasked: '***.***.***-**',
      }),
      'req-123'
    );
  });

  it('deve gerar requestId quando não fornecido', async () => {
    const payload = {
      from: 'whatsapp-id-123',
      timestamp: new Date().toISOString(),
    };

    await adapter.appendEvent(EventType.SECOND_COPY_REQUEST, payload);

    expect(mockSheetsPort.logRequest).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(String)
    );
  });

  it('deve não lançar erro quando SheetsPort falha (não quebra fluxo principal)', async () => {
    const payload = {
      from: 'whatsapp-id-123',
      requestId: 'req-123',
      timestamp: new Date().toISOString(),
    };

    vi.mocked(mockSheetsPort.logRequest).mockRejectedValue(new Error('Erro no Sheets'));

    // Não deve lançar erro
    await expect(adapter.appendEvent(EventType.SECOND_COPY_REQUEST, payload)).resolves.not.toThrow();
    expect(mockLogger.error).toHaveBeenCalled();
  });
});
