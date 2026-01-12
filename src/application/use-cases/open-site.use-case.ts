import { ConversationStateStore } from '../../application/ports/driven/conversation-state-store.js';
import { WhatsAppPort } from '../../application/ports/driven/whatsapp-port.js';
import { SiteLinkService } from '../../application/ports/driven/site-link-service.port.js';
import { SheetLogger } from '../../application/ports/driven/sheet-logger.port.js';
import { Logger } from '../../application/ports/driven/logger-port.js';
import { EventType } from '../../domain/enums/event-type.js';

/**
 * Use Case: Abrir site
 * - gera link com ou sem token via SiteLinkService
 * - log OPEN_SITE e responde com URL
 * - NÃO deve resetar o fluxo em andamento (se usuário estava no WAITING_CPF, mantém estado)
 */
export class OpenSiteUseCase {
  constructor(
    private conversationState: ConversationStateStore,
    private whatsapp: WhatsAppPort,
    private siteLinkService: SiteLinkService,
    private sheetLogger: SheetLogger,
    private logger: Logger
  ) {}

  async execute(from: string, requestId: string): Promise<void> {
    // Obter estado atual (para verificar se há CPF hash existente)
    const state = await this.conversationState.get(from);
    const existingCpfHash = state?.data?.cpfHash as string | undefined;

    // Gerar link
    const linkResult = await this.siteLinkService.generateLink(from, existingCpfHash);

    // Registrar evento no Sheets
    await this.sheetLogger.appendEvent(EventType.OPEN_SITE, {
      from,
      url: linkResult.url,
      tokenUsed: linkResult.tokenUsed,
      existingCpfHash: existingCpfHash || null,
      requestId,
      timestamp: new Date().toISOString(),
    });

    // Responder com URL
    const responseText = `🌐 *Acessar nosso site*\n\n` +
      `Clique no link abaixo para acessar:\n\n` +
      `${linkResult.url}\n\n` +
      `Lá você encontrará mais informações sobre nossos produtos e serviços.`;

    await this.whatsapp.sendText(from, responseText, requestId);

    // NÃO limpar estado - manter fluxo em andamento se existir
    this.logger.info({ 
      requestId, 
      from, 
      url: linkResult.url, 
      tokenUsed: linkResult.tokenUsed 
    }, 'Link do site gerado e enviado');
  }
}
