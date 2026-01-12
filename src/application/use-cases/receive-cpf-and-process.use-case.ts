import { FlowType } from '../../domain/enums/flow-type.js';
import { ConversationStateStore } from '../../application/ports/driven/conversation-state-store.js';
import { WhatsAppPort } from '../../application/ports/driven/whatsapp-port.js';
import { TitleRepository } from '../../application/ports/driven/title-repository.port.js';
import { RateLimiter } from '../../application/ports/driven/rate-limiter.js';
import { Logger } from '../../application/ports/driven/logger-port.js';
import { CpfHandler } from '../../infrastructure/security/cpf-handler.js';
import { Config } from '../../infrastructure/config/config.js';

/**
 * Use Case: Receber CPF e processar
 * - Valida CPF
 * - Aplica rate-limit
 * - Calcula cpfHash + cpfMasked
 * - Busca títulos (TitleRepository.findOpenTitlesByCpfHash)
 * - Se 0: log NO_TITLES e retorna mensagem
 * - Se 1: processa GenerateSecondCopy(title)
 * - Se >1: muda step=WAITING_SELECTION e lista opções com índice (sem vazar dados)
 */
export class ReceiveCpfAndProcessUseCase {
  constructor(
    private conversationState: ConversationStateStore,
    private whatsapp: WhatsAppPort,
    private titleRepository: TitleRepository,
    private rateLimiter: RateLimiter,
    private logger: Logger,
    private config: Config
  ) {}

  async execute(from: string, cpfInput: string, requestId: string): Promise<void> {
    // Validar CPF
    if (!CpfHandler.isValidCpf(cpfInput)) {
      await this.whatsapp.sendText(
        from,
        '❌ CPF inválido. Por favor, digite um CPF válido (apenas números ou com formatação):',
        requestId
      );
      return;
    }

    // Normalizar e processar CPF
    const cpfNormalized = CpfHandler.normalizeCpf(cpfInput);
    const cpfHash = CpfHandler.hashCpf(cpfNormalized);
    const cpfMasked = CpfHandler.maskCpf(cpfNormalized);

    this.logger.info({ requestId, from, cpfMasked }, 'CPF recebido e processado');

    // Aplicar rate-limit
    const rateLimitResult = await this.rateLimiter.hit(
      from,
      this.config.rateLimitMaxRequests,
      this.config.rateLimitWindowMs / 1000
    );

    if (!rateLimitResult.allowed) {
      await this.whatsapp.sendText(
        from,
        '⏱️ Você excedeu o limite de requisições. Por favor, tente novamente mais tarde.',
        requestId
      );
      this.logger.warn({ requestId, from, cpfMasked }, 'Rate limit excedido');
      return;
    }

    // Buscar títulos usando CPF original (armazenado temporariamente apenas durante o fluxo)
    const titles = await this.titleRepository.findOpenTitlesByCpfHash(cpfNormalized, cpfHash);

    if (titles.length === 0) {
      this.logger.info({ requestId, from, cpfMasked }, 'NO_TITLES: Nenhum título encontrado');
      await this.whatsapp.sendText(
        from,
        '❌ Nenhum boleto em aberto encontrado para este CPF. Verifique o CPF informado e tente novamente.',
        requestId
      );
      // Limpar estado
      await this.conversationState.clear(from);
      return;
    }

    // Sempre mostrar menu de formato (mesmo com 1 título)
    // Se houver apenas 1 título, mostrar menu de formato diretamente
    if (titles.length === 1) {
      const title = titles[0];
      
      // Mostrar menu de formato
      const formatMenu = `📋 *Escolha o formato da 2ª via:*\n\n` +
        `[1] 📄 PDF\n` +
        `[2] 📊 Código de barras\n` +
        `[3] 🔢 Linha digitável\n\n` +
        `Digite o número da opção desejada:`;

      await this.whatsapp.sendText(from, formatMenu, requestId);

      // Atualizar estado: step=WAITING_FORMAT_SELECTION, salvar título selecionado
      await this.conversationState.set(from, {
        activeFlow: FlowType.SECOND_COPY,
        step: 'WAITING_FORMAT_SELECTION',
        data: {
          cpfHash,
          cpfMasked,
          titles: titles.map(t => ({
            id: t.id,
            nossoNumero: t.nossoNumero,
            valor: t.valor,
            vencimento: t.vencimento?.toISOString(),
          })),
          selectedTitle: {
            id: title.id,
            nossoNumero: title.nossoNumero,
            valor: title.valor,
            vencimento: title.vencimento?.toISOString(),
          },
        },
        updatedAt: new Date(),
      });

      this.logger.info({ requestId, from, cpfMasked, nossoNumero: title.nossoNumero }, 'Título único encontrado, mostrando menu de formato');
      return;
    }

    // Se >1: mudar step=WAITING_SELECTION e listar opções
    const optionsText = `📋 Encontrei ${titles.length} boletos em aberto. Por favor, escolha qual deseja gerar a 2ª via:\n\n` +
      titles.map((title, index) => {
        // Não vazar dados sensíveis - apenas índice e informações básicas
        const displayIndex = index + 1;
        const valor = title.valor ? `R$ ${title.valor.toFixed(2)}` : 'Valor não informado';
        const vencimento = title.vencimento 
          ? title.vencimento.toLocaleDateString('pt-BR') 
          : 'Vencimento não informado';
        return `${displayIndex} - Valor: ${valor} | Vencimento: ${vencimento}`;
      }).join('\n') +
      `\n\nDigite o número da opção desejada:`;

    await this.whatsapp.sendText(from, optionsText, requestId);

    // Atualizar estado: step=WAITING_SELECTION, salvar títulos no estado
    await this.conversationState.set(from, {
      activeFlow: FlowType.SECOND_COPY,
      step: 'WAITING_SELECTION',
      data: {
        cpfHash,
        cpfMasked,
        titles: titles.map(t => ({
          id: t.id,
          nossoNumero: t.nossoNumero,
          valor: t.valor,
          vencimento: t.vencimento?.toISOString(),
        })),
      },
      updatedAt: new Date(),
    });

    this.logger.info({ requestId, from, cpfMasked, titlesCount: titles.length }, 'Aguardando seleção de título');
  }
}
