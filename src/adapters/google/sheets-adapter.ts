import { google } from 'googleapis';
import { SheetsPort } from '../../domain/ports/sheets-port.js';
import { RequestLog } from '../../domain/entities/request.js';
import { Logger } from '../../domain/ports/logger-port.js';
import { Config } from '../../infrastructure/config/config.js';

export class GoogleSheetsAdapter implements SheetsPort {
  private sheets: ReturnType<typeof google.sheets>;
  private spreadsheetId: string;
  private worksheetName: string;

  constructor(config: Config, private logger: Logger) {
    this.spreadsheetId = config.googleSheetsSpreadsheetId;
    this.worksheetName = config.googleSheetsWorksheetName;

    const auth = new google.auth.JWT({
      email: config.googleClientEmail,
      key: config.googlePrivateKey.replace(/\\n/g, '\n'),
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
      ],
    });

    this.sheets = google.sheets({
      version: 'v4',
      auth,
    });

    // Garantir que o cabeçalho existe
    this.ensureHeaders().catch(err => {
      this.logger.error({ error: err }, 'Erro ao garantir cabeçalhos do Sheets');
    });
  }

  private async ensureHeaders(): Promise<void> {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${this.worksheetName}!A1:J1`,
      });

      if (!response.data.values || response.data.values.length === 0) {
        // Criar cabeçalhos
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: `${this.worksheetName}!A1:J1`,
          valueInputOption: 'RAW',
          requestBody: {
            values: [[
              'ID',
              'WhatsApp ID',
              'CPF Hash',
              'CPF Mascarado',
              'Ação',
              'Status',
              'Boleto ID',
              'Mensagem de Erro',
              'Request ID',
              'Data/Hora',
            ]],
          },
        });
      }
    } catch (error) {
      this.logger.error({ error }, 'Erro ao verificar/criar cabeçalhos do Sheets');
    }
  }

  async logRequest(request: RequestLog, requestId: string): Promise<void> {
    try {
      const row = [
        request.id,
        request.whatsappId,
        request.cpfHash,
        request.cpfMasked,
        request.action,
        request.status,
        request.boletoId || '',
        request.errorMessage || '',
        request.requestId,
        request.createdAt.toISOString(),
      ];

      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: `${this.worksheetName}!A:J`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [row],
        },
      }, {
        headers: {
          'X-Request-ID': requestId,
        },
      });

      this.logger.debug({ requestId, requestIdLog: request.id }, 'Requisição registrada no Sheets');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao registrar no Sheets';
      this.logger.error({ requestId, error: errorMessage }, 'Erro ao registrar requisição no Sheets');
      // Não lançar erro para não quebrar o fluxo principal
    }
  }

  async findRequestsByCpfHash(cpfHash: string, requestId: string): Promise<RequestLog[]> {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${this.worksheetName}!A:J`,
      });

      if (!response.data.values || response.data.values.length < 2) {
        return [];
      }

      const rows = response.data.values.slice(1); // Pular cabeçalho
      const requests: RequestLog[] = [];

      for (const row of rows) {
        if (row[2] === cpfHash) { // CPF Hash está na coluna C (índice 2)
          requests.push({
            id: row[0] as string,
            whatsappId: row[1] as string,
            cpfHash: row[2] as string,
            cpfMasked: row[3] as string,
            action: row[4] as RequestLog['action'],
            status: row[5] as RequestLog['status'],
            boletoId: (row[6] as string) || undefined,
            errorMessage: (row[7] as string) || undefined,
            requestId: row[8] as string,
            createdAt: new Date(row[9] as string),
          });
        }
      }

      this.logger.debug({ requestId, cpfHash, count: requests.length }, 'Requisições encontradas no Sheets');

      return requests;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao buscar no Sheets';
      this.logger.error({ requestId, cpfHash, error: errorMessage }, 'Erro ao buscar requisições no Sheets');
      return [];
    }
  }

  async deleteRequestsByCpfHash(cpfHash: string, requestId: string): Promise<void> {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${this.worksheetName}!A:J`,
      });

      if (!response.data.values || response.data.values.length < 2) {
        return;
      }

      const rows = response.data.values;
      const rowsToDelete: number[] = [];

      // Encontrar linhas para deletar (considerar que a primeira linha é cabeçalho, então índice baseado em 2)
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][2] === cpfHash) { // CPF Hash na coluna C
          rowsToDelete.push(i + 1); // +1 porque Sheets usa índice baseado em 1
        }
      }

      if (rowsToDelete.length === 0) {
        return;
      }

      // Deletar linhas de trás para frente para não alterar índices
      for (let i = rowsToDelete.length - 1; i >= 0; i--) {
        await this.sheets.spreadsheets.batchUpdate({
          spreadsheetId: this.spreadsheetId,
          requestBody: {
            requests: [
              {
                deleteDimension: {
                  range: {
                    sheetId: 0, // Assumindo primeira aba - pode precisar ajustar
                    dimension: 'ROWS',
                    startIndex: rowsToDelete[i] - 1,
                    endIndex: rowsToDelete[i],
                  },
                },
              },
            ],
          },
        });
      }

      this.logger.info({ requestId, cpfHash, deletedCount: rowsToDelete.length }, 'Requisições deletadas do Sheets');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao deletar do Sheets';
      this.logger.error({ requestId, cpfHash, error: errorMessage }, 'Erro ao deletar requisições do Sheets');
      throw new Error(`Falha ao deletar requisições: ${errorMessage}`);
    }
  }
}
