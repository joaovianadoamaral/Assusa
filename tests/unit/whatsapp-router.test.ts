import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WhatsappRouter } from '../../src/application/services/whatsapp-router.js';
import { ApplicationService } from '../../src/application/services/application-service.js';
import { ConversationStateStore } from '../../src/application/ports/driven/conversation-state-store.js';
import { Logger } from '../../src/application/ports/driven/logger-port.js';
import { FlowType } from '../../src/domain/enums/flow-type.js';

describe('WhatsappRouter', () => {
  let router: WhatsappRouter;
  let mockApplicationService: ApplicationService;
  let mockConversationState: ConversationStateStore;
  let mockLogger: Logger;

  beforeEach(() => {
    mockApplicationService = {
      showMenu: vi.fn(),
      startSecondCopyFlow: vi.fn(),
      receiveCpfAndProcess: vi.fn(),
      selectTitleAndProcess: vi.fn(),
      generateSecondCopy: vi.fn(),
      startTalkToUs: vi.fn(),
      receiveTalkToUsMessage: vi.fn(),
      openSite: vi.fn(),
      deleteData: vi.fn(),
      getConversationState: vi.fn(),
    } as unknown as ApplicationService;

    mockConversationState = {
      get: vi.fn(),
      set: vi.fn(),
      clear: vi.fn(),
    } as unknown as ConversationStateStore;

    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as unknown as Logger;

    router = new WhatsappRouter(mockApplicationService, mockConversationState, mockLogger);
  });

  describe('handleIncomingMessage - estados de conversação', () => {
    it('deve processar CPF quando step=WAITING_CPF', async () => {
      const from = 'whatsapp-id-123';
      const text = '12345678900';
      const requestId = 'req-123';

      vi.mocked(mockConversationState.get).mockResolvedValue({
        activeFlow: FlowType.SECOND_COPY,
        step: 'WAITING_CPF',
        data: {},
        updatedAt: new Date(),
      });

      await router.handleIncomingMessage(from, text, requestId);

      expect(mockApplicationService.receiveCpfAndProcess).toHaveBeenCalledWith(from, text, requestId);
    });

    it('deve processar seleção quando step=WAITING_SELECTION e texto é número válido', async () => {
      const from = 'whatsapp-id-123';
      const text = '1';
      const requestId = 'req-123';

      vi.mocked(mockConversationState.get).mockResolvedValue({
        activeFlow: FlowType.SECOND_COPY,
        step: 'WAITING_SELECTION',
        data: {},
        updatedAt: new Date(),
      });

      await router.handleIncomingMessage(from, text, requestId);

      expect(mockApplicationService.selectTitleAndProcess).toHaveBeenCalledWith(from, 1, requestId);
    });

    it('deve mostrar menu quando step=WAITING_SELECTION e texto não é número válido', async () => {
      const from = 'whatsapp-id-123';
      const text = 'texto inválido';
      const requestId = 'req-123';

      vi.mocked(mockConversationState.get).mockResolvedValue({
        activeFlow: FlowType.SECOND_COPY,
        step: 'WAITING_SELECTION',
        data: {},
        updatedAt: new Date(),
      });

      await router.handleIncomingMessage(from, text, requestId);

      expect(mockApplicationService.showMenu).toHaveBeenCalledWith(from, requestId);
    });

    it('deve processar mensagem quando step=WAITING_MESSAGE', async () => {
      const from = 'whatsapp-id-123';
      const text = 'Mensagem de contato';
      const requestId = 'req-123';

      vi.mocked(mockConversationState.get).mockResolvedValue({
        activeFlow: FlowType.TALK_TO_US,
        step: 'WAITING_MESSAGE',
        data: {},
        updatedAt: new Date(),
      });

      await router.handleIncomingMessage(from, text, requestId);

      expect(mockApplicationService.receiveTalkToUsMessage).toHaveBeenCalledWith(from, text, requestId);
    });
  });

  describe('handleIncomingMessage - comandos', () => {
    beforeEach(() => {
      vi.mocked(mockConversationState.get).mockResolvedValue(null);
    });

    it('deve processar comando "menu"', async () => {
      await router.handleIncomingMessage('whatsapp-id-123', 'menu', 'req-123');
      expect(mockApplicationService.showMenu).toHaveBeenCalled();
    });

    it('deve processar comando "ajuda"', async () => {
      await router.handleIncomingMessage('whatsapp-id-123', 'ajuda', 'req-123');
      expect(mockApplicationService.showMenu).toHaveBeenCalled();
    });

    it('deve processar comando "voltar"', async () => {
      await router.handleIncomingMessage('whatsapp-id-123', 'voltar', 'req-123');
      expect(mockApplicationService.showMenu).toHaveBeenCalled();
    });

    it('deve processar comando "1" para segunda via', async () => {
      await router.handleIncomingMessage('whatsapp-id-123', '1', 'req-123');
      expect(mockApplicationService.startSecondCopyFlow).toHaveBeenCalled();
    });

    it('deve processar comando "segunda via" (normalizado)', async () => {
      await router.handleIncomingMessage('whatsapp-id-123', 'Segunda Via', 'req-123');
      expect(mockApplicationService.startSecondCopyFlow).toHaveBeenCalled();
    });

    it('deve processar comando "2 via" (normalizado)', async () => {
      await router.handleIncomingMessage('whatsapp-id-123', '2 VIA', 'req-123');
      expect(mockApplicationService.startSecondCopyFlow).toHaveBeenCalled();
    });

    it('deve processar comando "2" para fale conosco', async () => {
      await router.handleIncomingMessage('whatsapp-id-123', '2', 'req-123');
      expect(mockApplicationService.startTalkToUs).toHaveBeenCalled();
    });

    it('deve processar comando "fale com a gente" (normalizado)', async () => {
      await router.handleIncomingMessage('whatsapp-id-123', 'Fale Com A Gente', 'req-123');
      expect(mockApplicationService.startTalkToUs).toHaveBeenCalled();
    });

    it('deve processar comando "3" para site', async () => {
      await router.handleIncomingMessage('whatsapp-id-123', '3', 'req-123');
      expect(mockApplicationService.openSite).toHaveBeenCalled();
    });

    it('deve processar comando "site" (normalizado)', async () => {
      await router.handleIncomingMessage('whatsapp-id-123', 'SITE', 'req-123');
      expect(mockApplicationService.openSite).toHaveBeenCalled();
    });

    it('deve processar comando "4" para excluir dados', async () => {
      await router.handleIncomingMessage('whatsapp-id-123', '4', 'req-123');
      expect(mockApplicationService.deleteData).toHaveBeenCalled();
    });

    it('deve processar comando "excluir dados" (normalizado)', async () => {
      await router.handleIncomingMessage('whatsapp-id-123', 'Excluir Dados', 'req-123');
      expect(mockApplicationService.deleteData).toHaveBeenCalled();
    });

    it('deve mostrar menu quando comando não é reconhecido', async () => {
      await router.handleIncomingMessage('whatsapp-id-123', 'comando desconhecido', 'req-123');
      expect(mockApplicationService.showMenu).toHaveBeenCalled();
    });
  });

  describe('normalização de texto', () => {
    beforeEach(() => {
      vi.mocked(mockConversationState.get).mockResolvedValue(null);
    });

    it('deve normalizar texto removendo acentos', async () => {
      await router.handleIncomingMessage('whatsapp-id-123', 'Segunda Via', 'req-123');
      expect(mockApplicationService.startSecondCopyFlow).toHaveBeenCalled();
    });

    it('deve normalizar texto para lowercase', async () => {
      await router.handleIncomingMessage('whatsapp-id-123', 'MENU', 'req-123');
      expect(mockApplicationService.showMenu).toHaveBeenCalled();
    });
  });
});
