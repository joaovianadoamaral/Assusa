import { WhatsAppPort } from '../../application/ports/driven/whatsapp-port.js';
import { Logger } from '../../application/ports/driven/logger-port.js';

/**
 * Use Case: Exibir menu de opções
 */
export class ShowMenuUseCase {
  constructor(
    private whatsapp: WhatsAppPort,
    private logger: Logger
  ) {}

  async execute(from: string, requestId: string): Promise<void> {
    const menuText = `👋 Olá! Bem-vindo ao Assusa!\n\n` +
      `Por favor, escolha uma opção:\n\n` +
      `1️⃣ - Segunda via do boleto\n` +
      `2️⃣ - Fale com a gente\n` +
      `3️⃣ - Acessar nosso site\n` +
      `4️⃣ - Excluir meus dados\n` +
      `5️⃣ - Ajuda/Menu\n\n` +
      `Digite o número ou emoji da opção desejada.`;

    await this.whatsapp.sendText(from, menuText, requestId);
    
    this.logger.info({ requestId, from }, 'Menu exibido');
  }
}
