import { FlowType } from '../../domain/enums/flow-type.js';
import { ConversationStateStore } from '../../application/ports/driven/conversation-state-store.js';
import { WhatsAppPort } from '../../application/ports/driven/whatsapp-port.js';
import { Logger } from '../../application/ports/driven/logger-port.js';

/**
 * Use Case: Selecionar título e mostrar menu de formato
 * - Valida índice, pega title selecionado do estado
 * - Mostra menu para escolher formato (PDF, código de barras, linha digitável)
 * - Atualiza estado para WAITING_FORMAT_SELECTION
 */
export class SelectTitleAndProcessUseCase {
  constructor(
    private conversationState: ConversationStateStore,
    private whatsapp: WhatsAppPort,
    private logger: Logger
  ) {}

  async execute(from: string, selectionIndex: number, requestId: string): Promise<void> {
    // Obter estado atual
    const state = await this.conversationState.get(from);

    if (!state || state.step !== 'WAITING_SELECTION') {
      await this.whatsapp.sendText(
        from,
        '❌ Erro: Estado da conversa inválido. Por favor, inicie novamente o fluxo de segunda via.',
        requestId
      );
      return;
    }

    const titles = state.data.titles as Array<{
      id: string;
      nossoNumero: string;
      valor?: number;
      vencimento?: string;
    }>;

    if (!titles || !Array.isArray(titles)) {
      await this.whatsapp.sendText(
        from,
        '❌ Erro: Dados de títulos não encontrados. Por favor, inicie novamente o fluxo.',
        requestId
      );
      await this.conversationState.clear(from);
      return;
    }

    // Validar índice (1-based para o usuário, 0-based internamente)
    const index = selectionIndex - 1;
    if (index < 0 || index >= titles.length) {
      await this.whatsapp.sendText(
        from,
        `❌ Opção inválida. Por favor, escolha um número entre 1 e ${titles.length}:`,
        requestId
      );
      return;
    }

    const selectedTitleData = titles[index];
    const cpfHash = state.data.cpfHash as string;
    const cpfMasked = state.data.cpfMasked as string;

    this.logger.info({ 
      requestId, 
      from, 
      cpfMasked, 
      nossoNumero: selectedTitleData.nossoNumero 
    }, 'Título selecionado, mostrando menu de formato');

    // Mostrar menu de formato
    const formatMenu = `📋 *Escolha o formato da 2ª via:*\n\n` +
      `[1] 📄 PDF\n` +
      `[2] 📊 Código de barras\n` +
      `[3] 🔢 Linha digitável\n` +
      `[0] ⬅️ Voltar\n\n` +
      `Digite o número da opção desejada:`;

    await this.whatsapp.sendText(from, formatMenu, requestId);

    // Atualizar estado: step=WAITING_FORMAT_SELECTION, salvar título selecionado e manter títulos para voltar
    await this.conversationState.set(from, {
      activeFlow: FlowType.SECOND_COPY,
      step: 'WAITING_FORMAT_SELECTION',
      data: {
        cpfHash,
        cpfMasked,
        titles, // Manter títulos para permitir voltar
        selectedTitle: {
          id: selectedTitleData.id,
          nossoNumero: selectedTitleData.nossoNumero,
          valor: selectedTitleData.valor,
          vencimento: selectedTitleData.vencimento,
        },
      },
      updatedAt: new Date(),
    });
  }
}
