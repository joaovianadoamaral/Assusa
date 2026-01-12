import { SheetLogger } from '../../application/ports/driven/sheet-logger.port.js';
import { SheetsPort } from '../../application/ports/driven/sheets-port.js';
import { EventType } from '../../domain/enums/event-type.js';
import { EventPayload } from '../../application/ports/driven/sheet-logger.port.js';
import { Logger } from '../../application/ports/driven/logger-port.js';
import { RequestLog } from '../../domain/entities/request.js';
import crypto from 'crypto';

/**
 * Adapter: Logger de Planilha usando GoogleSheetsAdapter
 * Wrapper para SheetsPort que adapta para a interface SheetLogger
 * Converte EventType + EventPayload em RequestLog
 */
export class GoogleSheetLoggerAdapter implements SheetLogger {
  constructor(
    private sheetsPort: SheetsPort,
    private logger: Logger
  ) {}

  async appendEvent(eventType: EventType, payload: EventPayload): Promise<void> {
    try {
      const requestId = (payload.requestId as string) || crypto.randomUUID();
      const from = payload.from as string;
      const cpfHash = (payload.existingCpfHash as string) || (payload.cpfHash as string) || '';
      const cpfMasked = (payload.cpfMasked as string) || '***.***.***-**';

      // Converter EventType para RequestAction
      let action: RequestLog['action'];
      switch (eventType) {
        case EventType.SECOND_COPY_REQUEST:
          action = 'GERAR_2VIA';
          break;
        case EventType.CONTACT_REQUEST:
          action = 'FALE_CONOSCO';
          break;
        case EventType.OPEN_SITE:
          action = 'ACESSAR_SITE';
          break;
        case EventType.DELETE_DATA:
          action = 'EXCLUIR_DADOS';
          break;
        default:
          action = 'GERAR_2VIA'; // Default
      }

      // Criar RequestLog a partir do payload
      const requestLog: RequestLog = {
        id: crypto.randomUUID(),
        whatsappId: from,
        cpfHash,
        cpfMasked,
        action,
        status: 'SUCCESS',
        boletoId: (payload.boletoId as string) || (payload.fileId as string) || undefined,
        errorMessage: (payload.errorMessage as string) || undefined,
        requestId,
        createdAt: payload.timestamp ? new Date(payload.timestamp as string) : new Date(),
      };

      await this.sheetsPort.logRequest(requestLog, requestId);

      this.logger.debug({ requestId, eventType, action }, 'Evento registrado no Sheets');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao registrar evento';
      this.logger.error({ eventType, error: errorMessage }, 'Erro ao registrar evento no Sheets');
      // Não lançar erro para não quebrar o fluxo principal
    }
  }
}
