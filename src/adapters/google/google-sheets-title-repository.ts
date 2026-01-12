import { google } from 'googleapis';
import { TitleRepository } from '../../application/ports/driven/title-repository.port.js';
import { Title } from '../../domain/entities/title.js';
import { Logger } from '../../application/ports/driven/logger-port.js';
import { Config } from '../../infrastructure/config/config.js';
import { GoogleAuth } from '../../infrastructure/utils/google-auth.js';
import crypto from 'crypto';

/**
 * Cache simples em memória para reduzir custos de API do Google Sheets
 */
interface CacheEntry {
  titles: Title[];
  expiresAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

/**
 * Adapter: Repositório de Títulos usando Google Sheets
 * 
 * Lê uma aba "titles" com colunas:
 * - cpf_hash: Hash do CPF (SHA256 + pepper)
 * - nosso_numero: Número do título
 * - contrato: Número do contrato (opcional)
 * - codigo_beneficiario: Código do beneficiário (opcional)
 * - valor: Valor do título (opcional)
 * - vencimento: Data de vencimento no formato ISO (opcional)
 * - status: Status do título (OPEN, CLOSED, etc.)
 * 
 * Filtra apenas títulos com status=OPEN
 */
export class GoogleSheetsTitleRepository implements TitleRepository {
  private sheets: ReturnType<typeof google.sheets>;
  private spreadsheetId: string;
  private worksheetName: string;
  private cache: Map<string, CacheEntry> = new Map();

  constructor(config: Config, private logger: Logger) {
    this.spreadsheetId = config.googleSheetsSpreadsheetId;
    // Usar variável de ambiente ou padrão "titles"
    this.worksheetName = process.env.GOOGLE_SHEETS_TITLES_WORKSHEET_NAME || 'titles';

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

    this.logger.info({ spreadsheetId: this.spreadsheetId, worksheetName: this.worksheetName }, 
      'GoogleSheetsTitleRepository inicializado');
  }

  /**
   * Busca títulos em aberto por hash do CPF
   * @param _cpf CPF original (ignorado - Google Sheets usa apenas hash)
   * @param cpfHash Hash do CPF (SHA256 + pepper)
   * @returns Lista de títulos em aberto (status === 'OPEN')
   */
  async findOpenTitlesByCpfHash(_cpf: string, cpfHash: string): Promise<Title[]> {
    try {
      // Verificar cache
      const cached = this.cache.get(cpfHash);
      if (cached && Date.now() < cached.expiresAt) {
        this.logger.debug({ cpfHash: cpfHash.slice(0, 8) + '...', count: cached.titles.length }, 'Títulos retornados do cache');
        return cached.titles;
      }

      // Buscar na planilha
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${this.worksheetName}!A:G`, // Colunas A até G
      });

      if (!response.data.values || response.data.values.length < 2) {
        // Sem cabeçalho ou sem dados
        this.logger.debug({ cpfHash: cpfHash.slice(0, 8) + '...' }, 'Nenhum dado encontrado na planilha');
        this.updateCache(cpfHash, []);
        return [];
      }

      const rows = response.data.values.slice(1); // Pular cabeçalho
      const titles: Title[] = [];

      // Mapear colunas (assumindo ordem: cpf_hash, nosso_numero, contrato, codigo_beneficiario, valor, vencimento, status)
      for (const row of rows) {
        const rowCpfHash = (row[0] as string)?.trim();
        const nossoNumero = (row[1] as string)?.trim();
        const contrato = (row[2] as string)?.trim() || undefined;
        const codigoBeneficiario = (row[3] as string)?.trim() || undefined;
        const valorStr = (row[4] as string)?.trim();
        const vencimentoStr = (row[5] as string)?.trim();
        const status = (row[6] as string)?.trim()?.toUpperCase();

        // Filtrar por CPF hash e status OPEN
        if (rowCpfHash === cpfHash && status === 'OPEN' && nossoNumero) {
          const valor = valorStr ? parseFloat(valorStr) : undefined;
          const vencimento = vencimentoStr ? new Date(vencimentoStr) : undefined;

          titles.push({
            id: crypto.randomUUID(),
            nossoNumero,
            contrato,
            codigoBeneficiario,
            valor: isNaN(valor || 0) ? undefined : valor,
            vencimento: vencimento && !isNaN(vencimento.getTime()) ? vencimento : undefined,
            status,
          });
        }
      }

      // Atualizar cache
      this.updateCache(cpfHash, titles);

      this.logger.debug(
        { cpfHash: cpfHash.slice(0, 8) + '...', count: titles.length },
        'Títulos encontrados no Google Sheets'
      );

      return titles;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao buscar títulos';
      this.logger.error({ cpfHash: cpfHash.slice(0, 8) + '...', error: errorMessage }, 'Erro ao buscar títulos no Google Sheets');
      
      // Em caso de erro, tentar retornar do cache se disponível
      const cached = this.cache.get(cpfHash);
      if (cached && Date.now() < cached.expiresAt) {
        this.logger.warn({ cpfHash: cpfHash.slice(0, 8) + '...' }, 'Erro ao buscar na planilha, retornando dados do cache');
        return cached.titles;
      }
      
      throw new Error(`Falha ao buscar títulos: ${errorMessage}`);
    }
  }

  /**
   * Atualiza o cache com os títulos encontrados
   */
  private updateCache(cpfHash: string, titles: Title[]): void {
    this.cache.set(cpfHash, {
      titles,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
  }

  /**
   * Limpa o cache (útil para testes ou quando necessário forçar atualização)
   */
  clearCache(): void {
    this.cache.clear();
    this.logger.debug({}, 'Cache do GoogleSheetsTitleRepository limpo');
  }
}
