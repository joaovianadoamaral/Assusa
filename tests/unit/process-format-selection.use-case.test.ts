import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProcessFormatSelectionUseCase } from '../../src/application/use-cases/process-format-selection.use-case.js';
import { ConversationStateStore } from '../../src/application/ports/driven/conversation-state-store.js';
import { WhatsAppPort } from '../../src/application/ports/driven/whatsapp-port.js';
import { Logger } from '../../src/application/ports/driven/logger-port.js';
import { BankProvider } from '../../src/application/ports/driven/bank-provider.port.js';
import { DriveStorage } from '../../src/application/ports/driven/drive-storage.port.js';
import { SheetLogger } from '../../src/application/ports/driven/sheet-logger.port.js';
import { FlowType } from '../../src/domain/enums/flow-type.js';
import { Title } from '../../src/domain/entities/title.js';

describe('ProcessFormatSelectionUseCase', () => {
  let useCase: ProcessFormatSelectionUseCase;
  let mockConversationState: ConversationStateStore;
  let mockWhatsapp: WhatsAppPort;
  let mockBankProvider: BankProvider;
  let mockDriveStorage: DriveStorage;
  let mockSheetLogger: SheetLogger;
  let mockLogger: Logger;

  const mockTitle: Title = {
    id: 'title-123',
    nossoNumero: '123456',
    valor: 100.50,
    vencimento: new Date('2024-12-31'),
  };

  beforeEach(() => {
    mockConversationState = {
      get: vi.fn(),
      set: vi.fn(),
      clear: vi.fn(),
    };

    mockWhatsapp = {
      sendText: vi.fn(),
      sendTextMessage: vi.fn(),
      uploadMedia: vi.fn(),
      sendDocument: vi.fn(),
      sendDocumentMessage: vi.fn(),
      handleWebhook: vi.fn(),
      validateWebhook: vi.fn(),
      validateSignature: vi.fn(),
    };

    mockBankProvider = {
      getSecondCopyPdf: vi.fn(),
      getSecondCopyData: vi.fn(),
    };

    mockDriveStorage = {
      savePrivatePdf: vi.fn(),
      deleteFile: vi.fn(),
    };

    mockSheetLogger = {
      appendEvent: vi.fn(),
    };

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };

    useCase = new ProcessFormatSelectionUseCase(
      mockConversationState,
      mockWhatsapp,
      mockBankProvider,
      mockDriveStorage,
      mockSheetLogger,
      mockLogger
    );
  });

  describe('execute - PDF', () => {
    it('deve processar formato PDF com sucesso', async () => {
      const from = '5511999999999';
      const requestId = 'req-123';

      const mockState = {
        activeFlow: FlowType.SECOND_COPY,
        step: 'WAITING_FORMAT_SELECTION',
        data: {
          cpfHash: 'hash123',
          cpfMasked: '***.***.***-99',
          selectedTitle: {
            id: mockTitle.id,
            nossoNumero: mockTitle.nossoNumero,
            valor: mockTitle.valor,
            vencimento: mockTitle.vencimento?.toISOString(),
          },
        },
        updatedAt: new Date(),
      };

      const pdfBuffer = Buffer.from('%PDF-test-content');
      const mockPdfResult = {
        buffer: pdfBuffer,
        mime: 'application/pdf',
        filename: 'boleto-123456.pdf',
      };

      const mockDriveResult = {
        fileId: 'drive-file-123',
        filename: 'boleto-123456.pdf',
      };

      vi.mocked(mockConversationState.get).mockResolvedValue(mockState);
      vi.mocked(mockBankProvider.getSecondCopyPdf).mockResolvedValue(mockPdfResult);
      vi.mocked(mockDriveStorage.savePrivatePdf).mockResolvedValue(mockDriveResult);
      vi.mocked(mockWhatsapp.uploadMedia).mockResolvedValue('media-id-123');
      vi.mocked(mockWhatsapp.sendDocument).mockResolvedValue({ success: true });
      vi.mocked(mockWhatsapp.sendTextMessage).mockResolvedValue({ success: true });
      vi.mocked(mockSheetLogger.appendEvent).mockResolvedValue();

      await useCase.execute(from, '1', requestId);

      expect(mockBankProvider.getSecondCopyPdf).toHaveBeenCalledWith(mockTitle);
      expect(mockDriveStorage.savePrivatePdf).toHaveBeenCalled();
      expect(mockWhatsapp.uploadMedia).toHaveBeenCalledWith(
        pdfBuffer,
        'application/pdf',
        expect.stringContaining('.pdf'),
        requestId
      );
      expect(mockWhatsapp.sendDocument).toHaveBeenCalled();
      expect(mockSheetLogger.appendEvent).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          tipoSolicitacao: 'segunda_via_pdf',
        })
      );
      expect(mockConversationState.clear).toHaveBeenCalledWith(from);
    });

    it('deve tratar erro quando PDF não está disponível', async () => {
      const from = '5511999999999';
      const requestId = 'req-123';

      const mockState = {
        activeFlow: FlowType.SECOND_COPY,
        step: 'WAITING_FORMAT_SELECTION',
        data: {
          cpfHash: 'hash123',
          cpfMasked: '***.***.***-99',
          selectedTitle: {
            id: mockTitle.id,
            nossoNumero: mockTitle.nossoNumero,
            valor: mockTitle.valor,
            vencimento: mockTitle.vencimento?.toISOString(),
          },
        },
        updatedAt: new Date(),
      };

      vi.mocked(mockConversationState.get).mockResolvedValue(mockState);
      vi.mocked(mockBankProvider.getSecondCopyPdf).mockResolvedValue(null);
      vi.mocked(mockBankProvider.getSecondCopyData).mockResolvedValue(null);
      vi.mocked(mockWhatsapp.sendTextMessage).mockResolvedValue({ success: true });

      await useCase.execute(from, '1', requestId);

      expect(mockWhatsapp.sendTextMessage).toHaveBeenCalledWith(
        from,
        expect.stringContaining('Não foi possível gerar o PDF'),
        requestId
      );
      expect(mockConversationState.clear).toHaveBeenCalledWith(from);
    });
  });

  describe('execute - Código de barras', () => {
    it('deve processar formato código de barras com sucesso', async () => {
      const from = '5511999999999';
      const requestId = 'req-123';

      const mockState = {
        activeFlow: FlowType.SECOND_COPY,
        step: 'WAITING_FORMAT_SELECTION',
        data: {
          cpfHash: 'hash123',
          cpfMasked: '***.***.***-99',
          selectedTitle: {
            id: mockTitle.id,
            nossoNumero: mockTitle.nossoNumero,
            valor: mockTitle.valor,
            vencimento: mockTitle.vencimento?.toISOString(),
          },
        },
        updatedAt: new Date(),
      };

      const mockDataResult = {
        nossoNumero: '123456',
        linhaDigitavel: '12345.67890 12345.678901 12345.678901 1 23456789012345',
        codigoBarras: '12345678901234567890123456789012345678901234',
        valor: 100.50,
        vencimento: new Date('2024-12-31'),
      };

      vi.mocked(mockConversationState.get).mockResolvedValue(mockState);
      vi.mocked(mockBankProvider.getSecondCopyData).mockResolvedValue(mockDataResult);
      vi.mocked(mockWhatsapp.sendTextMessage).mockResolvedValue({ success: true });
      vi.mocked(mockSheetLogger.appendEvent).mockResolvedValue();

      await useCase.execute(from, '2', requestId);

      expect(mockBankProvider.getSecondCopyData).toHaveBeenCalledWith(mockTitle);
      expect(mockWhatsapp.sendTextMessage).toHaveBeenCalledWith(
        from,
        expect.stringContaining('Código de barras'),
        requestId
      );
      expect(mockSheetLogger.appendEvent).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          tipoSolicitacao: 'segunda_via_codigo_barras',
        })
      );
      expect(mockConversationState.clear).toHaveBeenCalledWith(from);
    });

    it('deve tratar erro quando código de barras não está disponível', async () => {
      const from = '5511999999999';
      const requestId = 'req-123';

      const mockState = {
        activeFlow: FlowType.SECOND_COPY,
        step: 'WAITING_FORMAT_SELECTION',
        data: {
          cpfHash: 'hash123',
          cpfMasked: '***.***.***-99',
          selectedTitle: {
            id: mockTitle.id,
            nossoNumero: mockTitle.nossoNumero,
            valor: mockTitle.valor,
            vencimento: mockTitle.vencimento?.toISOString(),
          },
        },
        updatedAt: new Date(),
      };

      const mockDataResult = {
        nossoNumero: '123456',
        linhaDigitavel: '12345.67890 12345.678901 12345.678901 1 23456789012345',
        // codigoBarras ausente
        valor: 100.50,
        vencimento: new Date('2024-12-31'),
      };

      vi.mocked(mockConversationState.get).mockResolvedValue(mockState);
      vi.mocked(mockBankProvider.getSecondCopyData).mockResolvedValue(mockDataResult);
      vi.mocked(mockWhatsapp.sendTextMessage).mockResolvedValue({ success: true });

      await useCase.execute(from, '2', requestId);

      expect(mockWhatsapp.sendTextMessage).toHaveBeenCalledWith(
        from,
        expect.stringContaining('Código de barras não disponível'),
        requestId
      );
    });
  });

  describe('execute - Linha digitável', () => {
    it('deve processar formato linha digitável com sucesso', async () => {
      const from = '5511999999999';
      const requestId = 'req-123';

      const mockState = {
        activeFlow: FlowType.SECOND_COPY,
        step: 'WAITING_FORMAT_SELECTION',
        data: {
          cpfHash: 'hash123',
          cpfMasked: '***.***.***-99',
          selectedTitle: {
            id: mockTitle.id,
            nossoNumero: mockTitle.nossoNumero,
            valor: mockTitle.valor,
            vencimento: mockTitle.vencimento?.toISOString(),
          },
        },
        updatedAt: new Date(),
      };

      const mockDataResult = {
        nossoNumero: '123456',
        linhaDigitavel: '12345.67890 12345.678901 12345.678901 1 23456789012345',
        valor: 100.50,
        vencimento: new Date('2024-12-31'),
      };

      vi.mocked(mockConversationState.get).mockResolvedValue(mockState);
      vi.mocked(mockBankProvider.getSecondCopyData).mockResolvedValue(mockDataResult);
      vi.mocked(mockWhatsapp.sendTextMessage).mockResolvedValue({ success: true });
      vi.mocked(mockSheetLogger.appendEvent).mockResolvedValue();

      await useCase.execute(from, '3', requestId);

      expect(mockBankProvider.getSecondCopyData).toHaveBeenCalledWith(mockTitle);
      expect(mockWhatsapp.sendTextMessage).toHaveBeenCalledWith(
        from,
        expect.stringContaining('Linha digitável'),
        requestId
      );
      expect(mockSheetLogger.appendEvent).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          tipoSolicitacao: 'segunda_via_linha_digitavel',
        })
      );
      expect(mockConversationState.clear).toHaveBeenCalledWith(from);
    });
  });

  describe('execute - Voltar', () => {
    it('deve voltar para seleção de título quando escolher 0', async () => {
      const from = '5511999999999';
      const requestId = 'req-123';

      const mockTitles = [
        {
          id: 'title-1',
          nossoNumero: '123456',
          valor: 100.50,
          vencimento: '2024-12-31',
        },
        {
          id: 'title-2',
          nossoNumero: '123457',
          valor: 200.75,
          vencimento: '2024-11-30',
        },
      ];

      const mockState = {
        activeFlow: FlowType.SECOND_COPY,
        step: 'WAITING_FORMAT_SELECTION',
        data: {
          cpfHash: 'hash123',
          cpfMasked: '***.***.***-99',
          titles: mockTitles,
          selectedTitle: {
            id: mockTitle.id,
            nossoNumero: mockTitle.nossoNumero,
            valor: mockTitle.valor,
            vencimento: mockTitle.vencimento?.toISOString(),
          },
        },
        updatedAt: new Date(),
      };

      vi.mocked(mockConversationState.get).mockResolvedValue(mockState);
      vi.mocked(mockWhatsapp.sendTextMessage).mockResolvedValue({ success: true });
      vi.mocked(mockConversationState.set).mockResolvedValue();

      await useCase.execute(from, '0', requestId);

      expect(mockWhatsapp.sendTextMessage).toHaveBeenCalledWith(
        from,
        expect.stringContaining('Encontrei 2 boletos'),
        requestId
      );
      expect(mockConversationState.set).toHaveBeenCalledWith(
        from,
        expect.objectContaining({
          step: 'WAITING_SELECTION',
          activeFlow: FlowType.SECOND_COPY,
          data: expect.objectContaining({
            cpfHash: 'hash123',
            cpfMasked: '***.***.***-99',
            titles: expect.any(Array),
          }),
          updatedAt: expect.any(Date),
        })
      );
    });
  });

  describe('execute - Validações', () => {
    it('deve retornar erro quando estado é inválido', async () => {
      const from = '5511999999999';
      const requestId = 'req-123';

      vi.mocked(mockConversationState.get).mockResolvedValue(null);
      vi.mocked(mockWhatsapp.sendTextMessage).mockResolvedValue({ success: true });

      await useCase.execute(from, '1', requestId);

      expect(mockWhatsapp.sendTextMessage).toHaveBeenCalledWith(
        from,
        expect.stringContaining('Estado da conversa inválido'),
        requestId
      );
    });

    it('deve retornar erro quando opção é inválida', async () => {
      const from = '5511999999999';
      const requestId = 'req-123';

      const mockState = {
        activeFlow: FlowType.SECOND_COPY,
        step: 'WAITING_FORMAT_SELECTION',
        data: {
          cpfHash: 'hash123',
          cpfMasked: '***.***.***-99',
          selectedTitle: {
            id: mockTitle.id,
            nossoNumero: mockTitle.nossoNumero,
            valor: mockTitle.valor,
            vencimento: mockTitle.vencimento?.toISOString(),
          },
        },
        updatedAt: new Date(),
      };

      vi.mocked(mockConversationState.get).mockResolvedValue(mockState);
      vi.mocked(mockWhatsapp.sendTextMessage).mockResolvedValue({ success: true });

      await useCase.execute(from, '99', requestId);

      expect(mockWhatsapp.sendTextMessage).toHaveBeenCalledWith(
        from,
        expect.stringContaining('Opção inválida'),
        requestId
      );
    });
  });
});
