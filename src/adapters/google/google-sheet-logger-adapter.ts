import { google } from 'googleapis';
import { SheetLogger } from '../../application/ports/driven/sheet-logger.port.js';
import { EventType } from '../../domain/enums/event-type.js';
import { EventPayload } from '../../application/ports/driven/sheet-logger.port.js';
import { Logger } from '../../application/ports/driven/logger-port.js';
import { Config } from '../../infrastructure/config/config.js';
import { GoogleAuth } from '../../infrastructure/utils/google-auth.js';
import { maskWhatsAppNumber } from '../../domain/helpers/lgpd-helpers.js';
import { sanitizeForLogs } from '../../domain/helpers/lgpd-helpers.js';

/**
 * Schema de colunas do evento estruturado (ordem fixa)
 */
const EVENT_COLUMNS = [
  'timestamp',
  'event_type',
  'from_masked',
  'cpf_hash',
  'cpf_masked',
  'status',
  'drive_file_id',
  'error_code',
  'extra_json',
] as const;

/**
 * Status possíveis para eventos
 */
type EventStatus = 'SUCCESS' | 'ERROR' | 'NO_TITLES' | 'SENT' | 'DELETED' | 'RECEIVED';

/**
 * Campos proibidos no payload (nunca devem ser armazenados)
 */
const FORBIDDEN_FIELDS = [
  'cpf',
  'cpf_limpo',
  'cpf_raw',
  'cpf_plain',
  'cpf_clean',
  'token',
  'access_token',
  'refresh_token',
  'authorization',
  'secret',
  'password',
  'senha',
  'api_key',
  'api_secret',
  'private_key',
  'client_secret',
  'pepper',
] as const;

/**
 * Adapter: Logger de Planilha usando Google Sheets API v4 diretamente
 * 
 * Implementa schema de eventos estruturado com LGPD:
 * - timestamp ISO
 * - event_type
 * - from_masked (número WhatsApp mascarado)
 * - cpf_hash (se existir)
 * - cpf_masked (se existir)
 * - status (SUCCESS/ERROR/NO_TITLES/SENT/DELETED)
 * - drive_file_id (se existir)
 * - error_code (se existir)
 * - extra_json (JSON com campos não sensíveis)
 * 
 * Regras:
 * - Nunca armazena CPF puro ou tokens
 * - Cria aba automaticamente se não existir
 * - Garante ordem de colunas fixa
 */
export class GoogleSheetLoggerAdapter implements SheetLogger {
  private sheets: ReturnType<typeof google.sheets>;
  private spreadsheetId: string;
  private worksheetName: string;
  private headersInitialized = false;

  constructor(config: Config, private logger: Logger) {
    this.spreadsheetId = config.googleSheetsSpreadsheetId;
    this.worksheetName = config.googleSheetsWorksheetName;

    // Inicializar GoogleAuth com Service Account JSON base64
    const googleAuth = GoogleAuth.getInstance();
    googleAuth.initialize(config.googleServiceAccountJsonBase64, [
      'https://www.googleapis.com/auth/spreadsheets',
    ]);

    // Criar cliente Sheets usando o auth do GoogleAuth
    this.sheets = google.sheets({
      version: 'v4',
      auth: googleAuth.getAuthClient(),
    });

    // Garantir que a aba e cabeçalhos existem (assíncrono, não bloqueia)
    this.ensureTabAndHeaders().catch(err => {
      this.logger.error({ error: err }, 'Erro ao garantir aba e cabeçalhos do Sheets');
    });
  }

  /**
   * Garante que a aba existe e cria se necessário
   */
  private async createTabIfMissing(): Promise<void> {
    try {
      // Buscar informações da planilha
      const spreadsheet = await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
      });

      const sheets = spreadsheet.data.sheets || [];
      const tabExists = sheets.some(
        sheet => sheet.properties?.title === this.worksheetName
      );

      if (!tabExists) {
        // Criar nova aba
        await this.sheets.spreadsheets.batchUpdate({
          spreadsheetId: this.spreadsheetId,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title: this.worksheetName,
                  },
                },
              },
            ],
          },
        });

        this.logger.info({ worksheetName: this.worksheetName }, 'Aba criada no Sheets');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao criar aba';
      this.logger.error({ error: errorMessage, worksheetName: this.worksheetName }, 'Erro ao verificar/criar aba do Sheets');
      throw new Error(`Falha ao criar aba: ${errorMessage}`);
    }
  }

  /**
   * Garante que os cabeçalhos existem na aba
   */
  private async ensureHeaders(): Promise<void> {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${this.worksheetName}!A1:${String.fromCharCode(64 + EVENT_COLUMNS.length)}1`,
      });

      if (!response.data.values || response.data.values.length === 0) {
        // Criar cabeçalhos
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: `${this.worksheetName}!A1:${String.fromCharCode(64 + EVENT_COLUMNS.length)}1`,
          valueInputOption: 'RAW',
          requestBody: {
            values: [EVENT_COLUMNS.map(col => col.toUpperCase())],
          },
        });

        this.logger.debug({ worksheetName: this.worksheetName }, 'Cabeçalhos criados no Sheets');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao criar cabeçalhos';
      this.logger.error({ error: errorMessage }, 'Erro ao verificar/criar cabeçalhos do Sheets');
      throw new Error(`Falha ao criar cabeçalhos: ${errorMessage}`);
    }
  }

  /**
   * Garante que a aba e os cabeçalhos existem
   */
  private async ensureTabAndHeaders(): Promise<void> {
    if (this.headersInitialized) {
      return;
    }

    await this.createTabIfMissing();
    await this.ensureHeaders();
    this.headersInitialized = true;
  }

  /**
   * Valida que o payload não contém campos proibidos
   */
  private validatePayload(payload: EventPayload): void {
    const forbiddenFound: string[] = [];

    for (const [key, value] of Object.entries(payload)) {
      const lowerKey = key.toLowerCase();

      // Verifica se o campo é proibido
      if (FORBIDDEN_FIELDS.some(forbidden => lowerKey === forbidden.toLowerCase())) {
        forbiddenFound.push(key);
        continue;
      }

      // Verifica se o valor contém CPF puro (11 dígitos)
      if (typeof value === 'string') {
        const cpfPattern = /\b\d{11}\b/;
        if (cpfPattern.test(value)) {
          // Verifica se não é um hash (hash tem 64 caracteres hexadecimais)
          const isHash = /^[a-f0-9]{64}$/i.test(value);
          if (!isHash) {
            forbiddenFound.push(`${key} (contém possível CPF puro)`);
          }
        }
      }

      // Verifica objetos aninhados
      if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        this.validatePayload(value as EventPayload);
      }
    }

    if (forbiddenFound.length > 0) {
      throw new Error(`Payload contém campos proibidos: ${forbiddenFound.join(', ')}`);
    }
  }

  /**
   * Extrai campos não sensíveis do payload para extra_json
   */
  private extractExtraJson(payload: EventPayload): string {
    // Campos que já estão no schema principal (não incluir em extra_json)
    const schemaFields = [
      'from',
      'cpfHash',
      'cpf_hash',
      'existingCpfHash',
      'cpfMasked',
      'cpf_masked',
      'status',
      'drive_file_id',
      'fileId',
      'boletoId',
      'error_code',
      'errorCode',
      'errorMessage',
      'error_message',
      'eventType',
      'event_type',
      'timestamp',
      'requestId',
      'request_id',
    ];

    // Sanitizar payload removendo campos sensíveis
    const sanitized = sanitizeForLogs(payload);

    // Remover campos que já estão no schema principal
    const extra: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(sanitized)) {
      const lowerKey = key.toLowerCase();
      if (!schemaFields.some(field => lowerKey === field.toLowerCase())) {
        extra[key] = value;
      }
    }

    // Retornar JSON vazio se não houver campos extras
    if (Object.keys(extra).length === 0) {
      return '';
    }

    return JSON.stringify(extra);
  }

  /**
   * Converte EventType para string
   */
  private eventTypeToString(eventType: EventType): string {
    return eventType;
  }

  /**
   * Determina o status do evento baseado no payload
   */
  private determineStatus(payload: EventPayload): EventStatus {
    // Se o payload já tem status, usar ele
    if (payload.status) {
      const status = String(payload.status).toUpperCase();
      if (['SUCCESS', 'ERROR', 'NO_TITLES', 'SENT', 'DELETED', 'RECEIVED'].includes(status)) {
        return status as EventStatus;
      }
    }

    // Se tem erro, é ERROR
    if (payload.errorMessage || payload.error_message || payload.errorCode || payload.error_code) {
      return 'ERROR';
    }

    // Se tem fileId mas não tem erro, é SENT
    if (payload.fileId || payload.drive_file_id || payload.boletoId) {
      return 'SENT';
    }

    // Default é SUCCESS
    return 'SUCCESS';
  }

  async appendEvent(eventType: EventType, payload: EventPayload): Promise<void> {
    try {
      // Validar payload antes de processar
      this.validatePayload(payload);

      // Garantir que aba e cabeçalhos existem
      await this.ensureTabAndHeaders();

      // Extrair dados do payload
      const from = (payload.from as string) || '';
      const fromMasked = from ? maskWhatsAppNumber(from) : '';
      const cpfHash = (payload.existingCpfHash as string) || (payload.cpfHash as string) || (payload.cpf_hash as string) || '';
      const cpfMasked = (payload.cpfMasked as string) || (payload.cpf_masked as string) || '';
      const driveFileId = (payload.drive_file_id as string) || (payload.fileId as string) || (payload.boletoId as string) || '';
      const errorCode = (payload.error_code as string) || (payload.errorCode as string) || '';
      const status = this.determineStatus(payload);
      const timestamp = payload.timestamp 
        ? new Date(payload.timestamp as string).toISOString()
        : new Date().toISOString();
      const extraJson = this.extractExtraJson(payload);

      // Criar linha com ordem fixa de colunas
      const row = [
        timestamp,
        this.eventTypeToString(eventType),
        fromMasked,
        cpfHash,
        cpfMasked,
        status,
        driveFileId,
        errorCode,
        extraJson,
      ];

      // Adicionar linha à planilha
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: `${this.worksheetName}!A:${String.fromCharCode(64 + EVENT_COLUMNS.length)}`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [row],
        },
      });

      this.logger.debug({ eventType, status, fromMasked }, 'Evento registrado no Sheets');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao registrar evento';
      this.logger.error({ eventType, error: errorMessage }, 'Erro ao registrar evento no Sheets');
      // Não lançar erro para não quebrar o fluxo principal
    }
  }
}
