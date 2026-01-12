import { FlowType } from '../../domain/enums/flow-type.js';
import { ConversationStateStore } from '../../application/ports/driven/conversation-state-store.js';
import { WhatsAppPort } from '../../application/ports/driven/whatsapp-port.js';
import { Logger } from '../../application/ports/driven/logger-port.js';
import { Title } from '../../domain/entities/title.js';
import { BankProvider } from '../../application/ports/driven/bank-provider.port.js';
import { DriveStorage } from '../../application/ports/driven/drive-storage.port.js';
import { SheetLogger } from '../../application/ports/driven/sheet-logger.port.js';
import { EventType } from '../../domain/enums/event-type.js';

/**
 * Formatos disponíveis para segunda via
 */
export type SecondCopyFormat = 'PDF' | 'CODIGO_BARRAS' | 'LINHA_DIGITAVEL';

/**
 * Use Case: Processar escolha de formato da segunda via
 * - Valida escolha (1=PDF, 2=Código de barras, 3=Linha digitável, 0=Voltar)
 * - Para PDF: chama getSecondCopyPdf, salva no Drive, envia via WhatsApp
 * - Para código de barras: chama getSecondCopyData, envia código
 * - Para linha digitável: chama getSecondCopyData, envia linha digitável
 * - Registra no Sheets com tipoSolicitacao apropriado
 */
export class ProcessFormatSelectionUseCase {
  constructor(
    private conversationState: ConversationStateStore,
    private whatsapp: WhatsAppPort,
    private bankProvider: BankProvider,
    private driveStorage: DriveStorage,
    private sheetLogger: SheetLogger,
    private logger: Logger
  ) {}

  async execute(from: string, formatInput: string, requestId: string): Promise<void> {
    // Obter estado atual
    const state = await this.conversationState.get(from);

    if (!state || state.step !== 'WAITING_FORMAT_SELECTION') {
      await this.whatsapp.sendText(
        from,
        '❌ Erro: Estado da conversa inválido. Por favor, inicie novamente o fluxo de segunda via.',
        requestId
      );
      return;
    }

    // Verificar se é "voltar" (0)
    if (formatInput === '0' || formatInput.toLowerCase() === 'voltar') {
      // Voltar para seleção de título
      const titles = state.data.titles as Array<{
        id: string;
        nossoNumero: string;
        valor?: number;
        vencimento?: string;
      }>;

      if (titles && Array.isArray(titles)) {
        const optionsText = `📋 Encontrei ${titles.length} boletos em aberto. Por favor, escolha qual deseja gerar a 2ª via:\n\n` +
          titles.map((title, index) => {
            const displayIndex = index + 1;
            const valor = title.valor ? `R$ ${title.valor.toFixed(2)}` : 'Valor não informado';
            const vencimento = title.vencimento 
              ? new Date(title.vencimento).toLocaleDateString('pt-BR') 
              : 'Vencimento não informado';
            return `${displayIndex} - Valor: ${valor} | Vencimento: ${vencimento}`;
          }).join('\n') +
          `\n\nDigite o número da opção desejada:`;

        await this.whatsapp.sendText(from, optionsText, requestId);

        await this.conversationState.set(from, {
          activeFlow: FlowType.SECOND_COPY,
          step: 'WAITING_SELECTION',
          data: {
            cpfHash: state.data.cpfHash,
            cpfMasked: state.data.cpfMasked,
            titles,
          },
          updatedAt: new Date(),
        });
        return;
      }
    }

    // Validar formato
    const formatIndex = parseInt(formatInput, 10);
    let format: SecondCopyFormat | null = null;

    if (formatIndex === 1) {
      format = 'PDF';
    } else if (formatIndex === 2) {
      format = 'CODIGO_BARRAS';
    } else if (formatIndex === 3) {
      format = 'LINHA_DIGITAVEL';
    } else {
      await this.whatsapp.sendText(
        from,
        '❌ Opção inválida. Por favor, escolha 1 (PDF), 2 (Código de barras), 3 (Linha digitável) ou 0 (Voltar):',
        requestId
      );
      return;
    }

    const selectedTitleData = state.data.selectedTitle as {
      id: string;
      nossoNumero: string;
      valor?: number;
      vencimento?: string;
    };

    if (!selectedTitleData) {
      await this.whatsapp.sendText(
        from,
        '❌ Erro: Título não encontrado. Por favor, inicie novamente o fluxo.',
        requestId
      );
      await this.conversationState.clear(from);
      return;
    }

    const cpfHash = state.data.cpfHash as string;
    const cpfMasked = state.data.cpfMasked as string;

    // Reconstruir objeto Title
    const selectedTitle: Title = {
      id: selectedTitleData.id,
      nossoNumero: selectedTitleData.nossoNumero,
      valor: selectedTitleData.valor,
      vencimento: selectedTitleData.vencimento ? new Date(selectedTitleData.vencimento) : undefined,
    };

    this.logger.info({ 
      requestId, 
      from, 
      cpfMasked, 
      nossoNumero: selectedTitle.nossoNumero,
      format 
    }, 'Processando escolha de formato');

    try {
      if (format === 'PDF') {
        await this.processPdfFormat(from, cpfHash, cpfMasked, selectedTitle, requestId);
      } else if (format === 'CODIGO_BARRAS') {
        await this.processCodigoBarrasFormat(from, cpfHash, cpfMasked, selectedTitle, requestId);
      } else if (format === 'LINHA_DIGITAVEL') {
        await this.processLinhaDigitavelFormat(from, cpfHash, cpfMasked, selectedTitle, requestId);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao processar formato';
      this.logger.error({ 
        requestId, 
        from, 
        cpfMasked, 
        nossoNumero: selectedTitle.nossoNumero,
        format,
        error: errorMessage 
      }, 'Erro ao processar escolha de formato');

      await this.whatsapp.sendText(
        from,
        '❌ Erro ao processar sua solicitação. Por favor, tente novamente ou entre em contato conosco.',
        requestId
      );
    } finally {
      // Limpar estado após processamento
      await this.conversationState.clear(from);
    }
  }

  /**
   * Processa formato PDF
   */
  private async processPdfFormat(
    from: string,
    cpfHash: string,
    cpfMasked: string,
    title: Title,
    requestId: string
  ): Promise<void> {
    // Obter PDF do banco
    const bankPdfResult = await this.bankProvider.getSecondCopyPdf(title);

    if (!bankPdfResult || !bankPdfResult.buffer) {
      // Tentar obter dados e gerar PDF (fallback)
      const bankDataResult = await this.bankProvider.getSecondCopyData(title);
      
      if (!bankDataResult) {
        await this.whatsapp.sendText(
          from,
          '❌ Não foi possível gerar o PDF agora. Tente novamente ou escolha linha digitável/código de barras.',
          requestId
        );
        return;
      }

      // Se não tiver PDF, informar que precisa usar outro formato
      await this.whatsapp.sendText(
        from,
        '❌ Não foi possível gerar o PDF agora. Tente novamente ou escolha linha digitável/código de barras.',
        requestId
      );
      return;
    }

    // Gerar filename seguro
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const cpfNormalized = cpfMasked.replace(/\D/g, '');
    const cpfUlt4 = cpfNormalized.slice(-4);
    const hash8 = cpfHash.slice(0, 8);
    const filename = `${cpfUlt4}_${hash8}_H${hours}_D${day}-${month}-${year}.pdf`;

    // Salvar no Drive
    const driveResult = await this.driveStorage.savePrivatePdf(bankPdfResult.buffer, filename);

    // Enviar PDF via WhatsApp
    const mediaId = await this.whatsapp.uploadMedia(
      bankPdfResult.buffer,
      'application/pdf',
      filename,
      requestId
    );

    await this.whatsapp.sendDocument(
      from,
      mediaId,
      filename,
      `📄 2ª via do boleto ${title.nossoNumero}`,
      requestId
    );

    // Registrar evento no Sheets
    await this.sheetLogger.appendEvent(EventType.SECOND_COPY_REQUEST, {
      from,
      cpfHash,
      cpfMasked,
      titleId: title.id,
      nossoNumero: title.nossoNumero,
      driveFileId: driveResult.fileId,
      filename,
      requestId,
      timestamp: new Date().toISOString(),
      tipoSolicitacao: 'segunda_via_pdf',
    });

    await this.whatsapp.sendText(
      from,
      '✅ PDF da 2ª via enviado com sucesso!',
      requestId
    );
  }

  /**
   * Processa formato código de barras
   */
  private async processCodigoBarrasFormat(
    from: string,
    cpfHash: string,
    cpfMasked: string,
    title: Title,
    requestId: string
  ): Promise<void> {
    // Obter dados do banco
    const bankDataResult = await this.bankProvider.getSecondCopyData(title);

    if (!bankDataResult) {
      await this.whatsapp.sendText(
        from,
        '❌ Não foi possível obter os dados do boleto. Tente novamente.',
        requestId
      );
      return;
    }

    // Extrair código de barras
    // Se não tiver codigoBarras, informar que não está disponível
    const codigoBarras = bankDataResult.codigoBarras || '';

    if (!codigoBarras) {
      await this.whatsapp.sendText(
        from,
        '❌ Código de barras não disponível para este boleto. Tente escolher linha digitável.',
        requestId
      );
      return;
    }

    // Enviar código de barras (sem formatação que atrapalhe copiar)
    await this.whatsapp.sendText(
      from,
      `📊 *Código de barras do boleto:*\n\n\`\`\`\n${codigoBarras}\n\`\`\`\n\nCopie o código acima para pagar.`,
      requestId
    );

    // Registrar evento no Sheets
    await this.sheetLogger.appendEvent(EventType.SECOND_COPY_REQUEST, {
      from,
      cpfHash,
      cpfMasked,
      titleId: title.id,
      nossoNumero: title.nossoNumero,
      requestId,
      timestamp: new Date().toISOString(),
      tipoSolicitacao: 'segunda_via_codigo_barras',
    });
  }

  /**
   * Processa formato linha digitável
   */
  private async processLinhaDigitavelFormat(
    from: string,
    cpfHash: string,
    cpfMasked: string,
    title: Title,
    requestId: string
  ): Promise<void> {
    // Obter dados do banco
    const bankDataResult = await this.bankProvider.getSecondCopyData(title);

    if (!bankDataResult) {
      await this.whatsapp.sendText(
        from,
        '❌ Não foi possível obter os dados do boleto. Tente novamente.',
        requestId
      );
      return;
    }

    const linhaDigitavel = bankDataResult.linhaDigitavel || '';

    if (!linhaDigitavel) {
      await this.whatsapp.sendText(
        from,
        '❌ Linha digitável não disponível para este boleto.',
        requestId
      );
      return;
    }

    // Enviar linha digitável com instrução
    await this.whatsapp.sendText(
      from,
      `🔢 *Linha digitável do boleto:*\n\n\`\`\`\n${linhaDigitavel}\n\`\`\`\n\nCopie e cole no app do seu banco para pagar.`,
      requestId
    );

    // Registrar evento no Sheets
    await this.sheetLogger.appendEvent(EventType.SECOND_COPY_REQUEST, {
      from,
      cpfHash,
      cpfMasked,
      titleId: title.id,
      nossoNumero: title.nossoNumero,
      requestId,
      timestamp: new Date().toISOString(),
      tipoSolicitacao: 'segunda_via_linha_digitavel',
    });
  }
}
