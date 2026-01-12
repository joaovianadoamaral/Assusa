import { ApplicationService } from './application-service.js';
import { ConversationStateStore } from '../ports/driven/conversation-state-store.js';
import { normalizeText } from '../../infrastructure/utils/text-normalizer.js';

/**
 * WhatsappRouter
 * Normaliza texto e roteia mensagens para os use cases apropriados
 */
export class WhatsappRouter {
  constructor(
    private applicationService: ApplicationService,
    private conversationState: ConversationStateStore
  ) {}

  /**
   * Processa mensagem recebida do WhatsApp
   */
  async handleIncomingMessage(from: string, text: string, requestId: string): Promise<void> {
    const normalizedText = normalizeText(text);

    // Verificar estado atual da conversa
    const state = await this.conversationState.get(from);

    if (state) {
      // Processar baseado no estado atual
      switch (state.step) {
        case 'WAITING_CPF':
          await this.applicationService.receiveCpfAndProcess(from, text, requestId);
          return;

        case 'WAITING_SELECTION':
          const selectionIndex = parseInt(text, 10);
          if (!isNaN(selectionIndex) && selectionIndex > 0) {
            await this.applicationService.selectTitleAndProcess(from, selectionIndex, requestId);
          } else {
            await this.applicationService.showMenu(from, requestId);
          }
          return;

        case 'WAITING_FORMAT_SELECTION':
          await this.applicationService.processFormatSelection(from, text, requestId);
          return;

        case 'WAITING_MESSAGE':
          await this.applicationService.receiveTalkToUsMessage(from, text, requestId);
          return;
      }
    }

    // Processar comandos (quando não está em um estado específico)
    await this.handleCommand(from, normalizedText, requestId);
  }

  /**
   * Processa comandos baseado no texto normalizado
   */
  private async handleCommand(from: string, normalizedText: string, requestId: string): Promise<void> {
    // Comandos de menu
    if (normalizedText === 'menu' || normalizedText === 'ajuda' || normalizedText === 'voltar') {
      await this.applicationService.showMenu(from, requestId);
      return;
    }

    // Comandos de segunda via
    if (
      normalizedText === '1' ||
      normalizedText.includes('segunda via') ||
      normalizedText.includes('2 via')
    ) {
      await this.applicationService.startSecondCopyFlow(from, requestId);
      return;
    }

    // Comandos de fale conosco
    if (normalizedText === '2' || normalizedText.includes('fale com a gente')) {
      await this.applicationService.startTalkToUs(from, requestId);
      return;
    }

    // Comandos de site
    if (normalizedText === '3' || normalizedText.includes('site') || normalizedText.includes('acessar site')) {
      await this.applicationService.openSite(from, requestId);
      return;
    }

    // Comandos de exclusão
    if (normalizedText === '4' || normalizedText.includes('excluir dados')) {
      await this.applicationService.deleteData(from, requestId);
      return;
    }

    // Comando não reconhecido - mostrar menu
    await this.applicationService.showMenu(from, requestId);
  }
}
