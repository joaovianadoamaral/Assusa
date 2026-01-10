import { RequestAction } from '../../domain/entities/request.js';
import { WhatsAppPort, WhatsAppMessage } from '../../domain/ports/whatsapp-port.js';
import { GerarSegundaViaUseCase } from '../../domain/use-cases/gerar-segunda-via-use-case.js';
import { ExcluirDadosUseCase } from '../../domain/use-cases/excluir-dados-use-case.js';
import { StoragePort } from '../../domain/ports/storage-port.js';
import { Logger } from '../../domain/ports/logger-port.js';
import { CpfHandler } from '../../infrastructure/security/cpf-handler.js';

export interface WhatsAppMenuOption {
  text: string;
  action: RequestAction;
}

export class WhatsAppService {
  constructor(
    private whatsapp: WhatsAppPort,
    private storage: StoragePort,
    private gerarSegundaViaUseCase: GerarSegundaViaUseCase,
    private excluirDadosUseCase: ExcluirDadosUseCase,
    private logger: Logger
  ) {}

  async handleMessage(message: WhatsAppMessage, requestId: string): Promise<void> {
    const { from: whatsappId, message: text } = message;

    try {
      // Verificar se é um comando de menu
      const menuOption = this.parseMenuOption(text);
      
      if (menuOption) {
        await this.handleMenuOption(whatsappId, menuOption, requestId);
        return;
      }

      // Verificar se está em um fluxo (aguardando CPF)
      const flow = await this.getCurrentFlow(whatsappId, requestId);
      
      if (flow === 'AGUARDANDO_CPF') {
        await this.handleCpfInput(whatsappId, text, requestId);
        return;
      }
      
      if (flow === 'AGUARDANDO_CPF_EXCLUSAO') {
        await this.handleCpfInputExclusao(whatsappId, text, requestId);
        return;
      }

      // Mensagem não reconhecida - mostrar menu
      await this.showMenu(whatsappId, requestId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro inesperado';
      this.logger.error({ requestId, whatsappId, error: errorMessage }, 'Erro ao processar mensagem');
      
      await this.whatsapp.sendTextMessage(
        whatsappId,
        '❌ Ocorreu um erro ao processar sua mensagem. Por favor, tente novamente.',
        requestId
      );
    }
  }

  private async showMenu(whatsappId: string, requestId: string): Promise<void> {
    const menuText = `👋 Olá! Bem-vindo ao Assusa!\n\n` +
      `Por favor, escolha uma opção:\n\n` +
      `1️⃣ - Gerar 2ª via de boleto\n` +
      `2️⃣ - Fale com a gente\n` +
      `3️⃣ - Acessar nosso site\n` +
      `4️⃣ - Excluir meus dados (LGPD)\n\n` +
      `Digite o número ou emoji da opção desejada.`;

    await this.whatsapp.sendTextMessage(whatsappId, menuText, requestId);
  }

  private parseMenuOption(text: string): RequestAction | null {
    const normalized = text.trim().toLowerCase();
    
    if (normalized === '1' || normalized.includes('2via') || normalized.includes('segunda via') || normalized.includes('boleto')) {
      return 'GERAR_2VIA';
    }
    if (normalized === '2' || normalized.includes('fale') || normalized.includes('contato') || normalized.includes('atendimento')) {
      return 'FALE_CONOSCO';
    }
    if (normalized === '3' || normalized.includes('site') || normalized.includes('website')) {
      return 'ACESSAR_SITE';
    }
    if (normalized === '4' || normalized.includes('excluir') || normalized.includes('deletar') || normalized.includes('lgpd')) {
      return 'EXCLUIR_DADOS';
    }

    return null;
  }

  private async handleMenuOption(whatsappId: string, action: RequestAction, requestId: string): Promise<void> {
    switch (action) {
      case 'GERAR_2VIA':
        await this.initGerarSegundaVia(whatsappId, requestId);
        break;
      case 'FALE_CONOSCO':
        await this.handleFaleConosco(whatsappId, requestId);
        break;
      case 'ACESSAR_SITE':
        await this.handleAcessarSite(whatsappId, requestId);
        break;
      case 'EXCLUIR_DADOS':
        await this.initExcluirDados(whatsappId, requestId);
        break;
    }
  }

  private async initGerarSegundaVia(whatsappId: string, requestId: string): Promise<void> {
    const lgpdText = `📋 *Gerar 2ª Via de Boleto*\n\n` +
      `⚠️ *Aviso LGPD:*\n` +
      `Seus dados pessoais serão tratados conforme a Lei Geral de Proteção de Dados (LGPD). ` +
      `Coletaremos apenas o CPF necessário para localizar seus boletos. ` +
      `O CPF será armazenado de forma segura usando criptografia hash.\n\n` +
      `Por favor, digite seu CPF (apenas números ou com formatação):`;

    await this.whatsapp.sendTextMessage(whatsappId, lgpdText, requestId);
    await this.setCurrentFlow(whatsappId, 'AGUARDANDO_CPF', requestId);
  }

  private async handleCpfInput(whatsappId: string, cpfInput: string, requestId: string): Promise<void> {
    // Validar CPF
    if (!CpfHandler.isValidCpf(cpfInput)) {
      await this.whatsapp.sendTextMessage(
        whatsappId,
        '❌ CPF inválido. Por favor, digite um CPF válido (apenas números ou com formatação):',
        requestId
      );
      return;
    }

    // Processar CPF
    const cpfNormalized = CpfHandler.normalizeCpf(cpfInput);
    const cpfHash = CpfHandler.hashCpf(cpfNormalized);
    const cpfMasked = CpfHandler.maskCpf(cpfNormalized);

    this.logger.info({ requestId, whatsappId, cpfMasked }, 'CPF recebido e processado');

    // Limpar fluxo
    await this.clearCurrentFlow(whatsappId, requestId);

    // Gerar 2ª via
    await this.gerarSegundaViaUseCase.execute({
      whatsappId,
      cpfHash,
      cpfMasked,
      requestId,
    });
  }

  private async initExcluirDados(whatsappId: string, requestId: string): Promise<void> {
    const confirmText = `🗑️ *Excluir Meus Dados*\n\n` +
      `Você está prestes a solicitar a exclusão de todos os seus dados pessoais conforme a LGPD.\n\n` +
      `⚠️ Esta ação é *IRREVERSÍVEL*.\n\n` +
      `Para confirmar, por favor, digite seu CPF (apenas números ou com formatação):`;

    await this.whatsapp.sendTextMessage(whatsappId, confirmText, requestId);
    await this.setCurrentFlow(whatsappId, 'AGUARDANDO_CPF_EXCLUSAO', requestId);
  }

  private async handleCpfInputExclusao(whatsappId: string, cpfInput: string, requestId: string): Promise<void> {
    // Validar CPF
    if (!CpfHandler.isValidCpf(cpfInput)) {
      await this.whatsapp.sendTextMessage(
        whatsappId,
        '❌ CPF inválido. Por favor, digite um CPF válido (apenas números ou com formatação):',
        requestId
      );
      return;
    }

    // Processar CPF
    const cpfNormalized = CpfHandler.normalizeCpf(cpfInput);
    const cpfHash = CpfHandler.hashCpf(cpfNormalized);
    const cpfMasked = CpfHandler.maskCpf(cpfNormalized);

    this.logger.info({ requestId, whatsappId, cpfMasked }, 'CPF recebido para exclusão');

    // Limpar fluxo
    await this.clearCurrentFlow(whatsappId, requestId);

    // Executar exclusão
    await this.excluirDadosUseCase.execute({
      whatsappId,
      cpfHash,
      cpfMasked,
      requestId,
    });
  }

  private async handleFaleConosco(whatsappId: string, requestId: string): Promise<void> {
    const text = `📞 *Fale com a gente*\n\n` +
      `Entre em contato conosco através dos seguintes canais:\n\n` +
      `📧 Email: contato@assusa.com.br\n` +
      `📱 Telefone: (00) 0000-0000\n` +
      `💬 WhatsApp: (00) 0 0000-0000\n\n` +
      `Horário de atendimento: Segunda a Sexta, das 8h às 18h.`;

    await this.whatsapp.sendTextMessage(whatsappId, text, requestId);
    await this.showMenu(whatsappId, requestId);
  }

  private async handleAcessarSite(whatsappId: string, requestId: string): Promise<void> {
    const text = `🌐 *Acessar nosso site*\n\n` +
      `Visite nosso site: https://www.assusa.com.br\n\n` +
      `Lá você encontrará mais informações sobre nossos produtos e serviços.`;

    await this.whatsapp.sendTextMessage(whatsappId, text, requestId);
    await this.showMenu(whatsappId, requestId);
  }

  private async getCurrentFlow(whatsappId: string, requestId: string): Promise<string | null> {
    const key = `flow:${whatsappId}`;
    return await this.storage.get(key, requestId);
  }

  private async setCurrentFlow(whatsappId: string, flow: string, requestId: string): Promise<void> {
    const key = `flow:${whatsappId}`;
    await this.storage.set(key, flow, 3600, requestId); // 1 hora de TTL
  }

  private async clearCurrentFlow(whatsappId: string, requestId: string): Promise<void> {
    const key = `flow:${whatsappId}`;
    await this.storage.delete(key, requestId);
  }
}
