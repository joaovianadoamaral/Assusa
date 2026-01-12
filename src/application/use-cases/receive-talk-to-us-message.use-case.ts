import { ConversationStateStore } from '../../application/ports/driven/conversation-state-store.js';
import { WhatsAppPort } from '../../application/ports/driven/whatsapp-port.js';
import { SheetLogger } from '../../application/ports/driven/sheet-logger.port.js';
import { Logger } from '../../application/ports/driven/logger-port.js';
import { EventType } from '../../domain/enums/event-type.js';

/**
 * Use Case: Receber mensagem do fluxo "Fale com a gente"
 * - log em Sheets (CONTACT_REQUEST) e retorna confirmação
 */
export class ReceiveTalkToUsMessageUseCase {
  constructor(
    private conversationState: ConversationStateStore,
    private whatsapp: WhatsAppPort,
    private sheetLogger: SheetLogger,
    private logger: Logger
  ) {}

  async execute(from: string, message: string, requestId: string): Promise<void> {
    // Validar tamanho da mensagem
    if (message.length > 500) {
      await this.whatsapp.sendText(
        from,
        '❌ Mensagem muito longa. Por favor, envie uma mensagem com no máximo 500 caracteres:',
        requestId
      );
      return;
    }

    // Registrar no Sheets
    await this.sheetLogger.appendEvent(EventType.CONTACT_REQUEST, {
      from,
      message,
      requestId,
      timestamp: new Date().toISOString(),
    });

    // Enviar confirmação
    const confirmationText = `✅ Mensagem recebida com sucesso!\n\n` +
      `Nossa equipe entrará em contato em breve.\n\n` +
      `Obrigado por entrar em contato conosco!`;

    await this.whatsapp.sendText(from, confirmationText, requestId);

    // Limpar estado
    await this.conversationState.clear(from);

    this.logger.info({ requestId, from, messageLength: message.length }, 'Mensagem de contato registrada');
  }
}
