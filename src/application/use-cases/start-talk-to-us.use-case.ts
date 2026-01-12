import { FlowType } from '../../domain/enums/flow-type.js';
import { ConversationStateStore } from '../../application/ports/driven/conversation-state-store.js';
import { WhatsAppPort } from '../../application/ports/driven/whatsapp-port.js';
import { Logger } from '../../application/ports/driven/logger-port.js';

/**
 * Use Case: Iniciar fluxo "Fale com a gente"
 * step=WAITING_MESSAGE
 * pede mensagem curta
 */
export class StartTalkToUsUseCase {
  constructor(
    private conversationState: ConversationStateStore,
    private whatsapp: WhatsAppPort,
    private logger: Logger
  ) {}

  async execute(from: string, requestId: string): Promise<void> {
    const messageText = `📞 *Fale com a gente*\n\n` +
      `Por favor, envie uma mensagem curta descrevendo como podemos ajudá-lo:\n\n` +
      `(Máximo de 500 caracteres)`;

    await this.whatsapp.sendText(from, messageText, requestId);

    // Salvar estado: step=WAITING_MESSAGE
    await this.conversationState.set(from, {
      activeFlow: FlowType.TALK_TO_US,
      step: 'WAITING_MESSAGE',
      data: {},
      updatedAt: new Date(),
    });

    this.logger.info({ requestId, from }, 'Fluxo "Fale com a gente" iniciado');
  }
}
