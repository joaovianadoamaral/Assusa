import { ShowMenuUseCase } from '../use-cases/show-menu.use-case.js';
import { StartSecondCopyFlowUseCase } from '../use-cases/start-second-copy-flow.use-case.js';
import { ReceiveCpfAndProcessUseCase } from '../use-cases/receive-cpf-and-process.use-case.js';
import { SelectTitleAndProcessUseCase } from '../use-cases/select-title-and-process.use-case.js';
import { GenerateSecondCopyUseCase, GenerateSecondCopyResult } from '../use-cases/generate-second-copy.use-case.js';
import { StartTalkToUsUseCase } from '../use-cases/start-talk-to-us.use-case.js';
import { ReceiveTalkToUsMessageUseCase } from '../use-cases/receive-talk-to-us-message.use-case.js';
import { OpenSiteUseCase } from '../use-cases/open-site.use-case.js';
import { DeleteDataUseCase } from '../use-cases/delete-data.use-case.js';
import { ConversationStateStore } from '../ports/driven/conversation-state-store.js';

/**
 * ApplicationService / Facade
 * Expõe funções para o Router chamar facilmente
 * Orquestra todos os use cases da camada application
 */
export class ApplicationService {
  constructor(
    private showMenuUseCase: ShowMenuUseCase,
    private startSecondCopyFlowUseCase: StartSecondCopyFlowUseCase,
    private receiveCpfAndProcessUseCase: ReceiveCpfAndProcessUseCase,
    private selectTitleAndProcessUseCase: SelectTitleAndProcessUseCase,
    private generateSecondCopyUseCase: GenerateSecondCopyUseCase,
    private startTalkToUsUseCase: StartTalkToUsUseCase,
    private receiveTalkToUsMessageUseCase: ReceiveTalkToUsMessageUseCase,
    private openSiteUseCase: OpenSiteUseCase,
    private deleteDataUseCase: DeleteDataUseCase,
    private conversationState: ConversationStateStore
  ) {}

  /**
   * 1) ShowMenu(from)
   * Retorna mensagem com opções do menu
   */
  async showMenu(from: string, requestId: string): Promise<void> {
    await this.showMenuUseCase.execute(from, requestId);
  }

  /**
   * 2) StartSecondCopyFlow(from)
   * Salva estado: activeFlow=SECOND_COPY, step=WAITING_CPF
   * Retorna aviso LGPD + pedido de CPF
   */
  async startSecondCopyFlow(from: string, requestId: string): Promise<void> {
    await this.startSecondCopyFlowUseCase.execute(from, requestId);
  }

  /**
   * 3) ReceiveCpfAndProcess(from, cpfInput)
   * Valida CPF, aplica rate-limit, busca títulos e processa
   */
  async receiveCpfAndProcess(from: string, cpfInput: string, requestId: string): Promise<void> {
    await this.receiveCpfAndProcessUseCase.execute(from, cpfInput, requestId);
  }

  /**
   * 4) SelectTitleAndProcess(from, selectionIndex)
   * Valida índice, pega title selecionado do estado, chama GenerateSecondCopy
   */
  async selectTitleAndProcess(from: string, selectionIndex: number, requestId: string): Promise<void> {
    await this.selectTitleAndProcessUseCase.execute(from, selectionIndex, requestId);
  }

  /**
   * 5) GenerateSecondCopy(from, cpfHash, cpfMasked, title)
   * Gera PDF, salva no Drive, registra evento e retorna resultado
   */
  async generateSecondCopy(
    from: string,
    cpfHash: string,
    cpfMasked: string,
    title: { id: string; nossoNumero: string; valor?: number; vencimento?: Date },
    requestId: string
  ): Promise<GenerateSecondCopyResult> {
    return await this.generateSecondCopyUseCase.execute(from, cpfHash, cpfMasked, title, requestId);
  }

  /**
   * 6) StartTalkToUs(from)
   * step=WAITING_MESSAGE, pede mensagem curta
   */
  async startTalkToUs(from: string, requestId: string): Promise<void> {
    await this.startTalkToUsUseCase.execute(from, requestId);
  }

  /**
   * 7) ReceiveTalkToUsMessage(from, message)
   * log em Sheets (CONTACT_REQUEST) e retorna confirmação
   */
  async receiveTalkToUsMessage(from: string, message: string, requestId: string): Promise<void> {
    await this.receiveTalkToUsMessageUseCase.execute(from, message, requestId);
  }

  /**
   * 8) OpenSite(from)
   * gera link com ou sem token via SiteLinkService
   * log OPEN_SITE e responde com URL
   * NÃO deve resetar o fluxo em andamento
   */
  async openSite(from: string, requestId: string): Promise<void> {
    await this.openSiteUseCase.execute(from, requestId);
  }

  /**
   * 9) DeleteData(from)
   * Executa exclusão: apaga PDFs, registra DELETE_DATA no Sheets
   * Limpa estado e mensagem final confirmando
   */
  async deleteData(from: string, requestId: string): Promise<void> {
    await this.deleteDataUseCase.execute(from, requestId);
  }

  /**
   * Método auxiliar: Obter estado atual da conversa
   */
  async getConversationState(from: string) {
    return await this.conversationState.get(from);
  }
}
