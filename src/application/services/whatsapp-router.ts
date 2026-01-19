import { ApplicationService } from './application-service.js';
import { ConversationStateStore } from '../ports/driven/conversation-state-store.js';
import { normalizeText } from '../../infrastructure/utils/text-normalizer.js';
import { Logger } from '../ports/driven/logger-port.js';

/**
 * WhatsappRouter
 * Normaliza texto e roteia mensagens para os use cases apropriados
 * 
 * Implementa fila por usuário para garantir processamento sequencial
 * e evitar race conditions em mensagens concorrentes do mesmo usuário
 */
export class WhatsappRouter {
  // Fila de processamento por usuário (from)
  // Garante que mensagens do mesmo usuário sejam processadas sequencialmente
  private processingQueues: Map<string, Promise<void>> = new Map();

  constructor(
    private applicationService: ApplicationService,
    private conversationState: ConversationStateStore,
    private logger: Logger
  ) {}

  /**
   * Processa mensagem recebida do WhatsApp
   * Garante processamento sequencial por usuário para evitar race conditions
   */
  async handleIncomingMessage(from: string, text: string, requestId: string): Promise<void> {
    // Obter a fila atual do usuário (ou criar uma nova)
    const previousPromise = this.processingQueues.get(from) || Promise.resolve();
    
    // Criar nova promise que aguarda a anterior e processa a mensagem atual
    const currentPromise = previousPromise
      .then(() => this.processMessage(from, text, requestId))
      .catch((error) => {
        this.logger.error({ from, requestId, error }, 'Erro ao processar mensagem');
        throw error;
      })
      .finally(() => {
        // Remover da fila quando terminar
        if (this.processingQueues.get(from) === currentPromise) {
          this.processingQueues.delete(from);
        }
      });

    // Atualizar a fila com a nova promise
    this.processingQueues.set(from, currentPromise);

    // Aguardar processamento
    await currentPromise;
  }

  /**
   * Processa a mensagem internamente
   */
  private async processMessage(from: string, text: string, requestId: string): Promise<void> {
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
