import { FlowType } from '../../domain/enums/flow-type.js';
import { ConversationStateStore } from '../../application/ports/driven/conversation-state-store.js';
import { WhatsAppPort } from '../../application/ports/driven/whatsapp-port.js';
import { Logger } from '../../application/ports/driven/logger-port.js';

/**
 * Use Case: Iniciar fluxo de segunda via
 * Salva estado: activeFlow=SECOND_COPY, step=WAITING_CPF
 * Retorna aviso LGPD + pedido de CPF
 */
export class StartSecondCopyFlowUseCase {
  constructor(
    private conversationState: ConversationStateStore,
    private whatsapp: WhatsAppPort,
    private logger: Logger
  ) {}

  async execute(from: string, requestId: string): Promise<void> {
    const lgpdText = `📋 *Gerar 2ª Via de Boleto*\n\n` +
      `⚠️ *Aviso LGPD:*\n` +
      `Seus dados pessoais serão tratados conforme a Lei Geral de Proteção de Dados (LGPD). ` +
      `Coletaremos apenas o CPF necessário para localizar seus boletos. ` +
      `O CPF será armazenado de forma segura usando criptografia hash.\n\n` +
      `Por favor, digite seu CPF (apenas números ou com formatação):`;

    await this.whatsapp.sendTextMessage(from, lgpdText, requestId);

    // Salvar estado: activeFlow=SECOND_COPY, step=WAITING_CPF
    await this.conversationState.set(from, {
      activeFlow: FlowType.SECOND_COPY,
      step: 'WAITING_CPF',
      data: {},
      updatedAt: new Date(),
    });

    this.logger.info({ requestId, from }, 'Fluxo de segunda via iniciado');
  }
}
