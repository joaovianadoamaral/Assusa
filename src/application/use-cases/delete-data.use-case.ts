import { ConversationStateStore } from '../../application/ports/driven/conversation-state-store.js';
import { WhatsAppPort } from '../../application/ports/driven/whatsapp-port.js';
import { DriveStorage } from '../../application/ports/driven/drive-storage.port.js';
import { SheetLogger } from '../../application/ports/driven/sheet-logger.port.js';
import { Logger } from '../../application/ports/driven/logger-port.js';
import { EventType } from '../../domain/enums/event-type.js';

/**
 * Use Case: Excluir dados
 * - Executa exclusão: apaga PDFs (se houver no histórico recente no estado), registra DELETE_DATA no Sheets
 * - Limpa estado
 * - Mensagem final confirmando
 */
export class DeleteDataUseCase {
  constructor(
    private conversationState: ConversationStateStore,
    private whatsapp: WhatsAppPort,
    private driveStorage: DriveStorage,
    private sheetLogger: SheetLogger,
    private logger: Logger
  ) {}

  async execute(from: string, requestId: string): Promise<void> {
    // Obter estado atual para verificar se há PDFs no histórico
    const state = await this.conversationState.get(from);
    
    const driveFileIds = state?.data?.driveFileIds as string[] | undefined;
    
    // Excluir PDFs se houver no histórico
    if (driveFileIds && Array.isArray(driveFileIds) && driveFileIds.length > 0) {
      const deletePromises = driveFileIds.map(async (fileId) => {
        try {
          await this.driveStorage.deleteFile(fileId);
          this.logger.info({ requestId, from, fileId }, 'PDF excluído do Drive');
        } catch (error) {
          this.logger.error({ requestId, from, fileId, error }, 'Erro ao excluir PDF do Drive');
        }
      });
      
      await Promise.all(deletePromises);
    }

    // Registrar evento no Sheets
    await this.sheetLogger.appendEvent(EventType.DELETE_DATA, {
      from,
      deletedFilesCount: driveFileIds?.length || 0,
      requestId,
      timestamp: new Date().toISOString(),
    });

    // Limpar estado
    await this.conversationState.clear(from);

    // Mensagem final confirmando
    const confirmationText = `✅ *Exclusão de Dados Concluída*\n\n` +
      `Todos os seus dados pessoais foram excluídos conforme solicitado.\n\n` +
      `Esta ação foi registrada em nosso sistema para fins de auditoria e conformidade com a LGPD.\n\n` +
      `Obrigado por utilizar nossos serviços!`;

    await this.whatsapp.sendText(from, confirmationText, requestId);

    this.logger.info({ requestId, from, deletedFilesCount: driveFileIds?.length || 0 }, 'Exclusão de dados concluída');
  }
}
