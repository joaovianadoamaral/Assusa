import { TitleRepository } from '../../application/ports/driven/title-repository.port.js';
import { SicoobPort } from '../../application/ports/driven/sicoob-port.js';
import { BradescoPort } from '../../application/ports/driven/bradesco-port.js';
import { SheetLogger } from '../../application/ports/driven/sheet-logger.port.js';
import { Title } from '../../domain/entities/title.js';
import { Logger } from '../../application/ports/driven/logger-port.js';
import { EventType } from '../../domain/enums/event-type.js';
import { CpfHandler } from '../../infrastructure/security/cpf-handler.js';
import crypto from 'crypto';

/**
 * Título com informação do banco de origem
 */
interface TitleWithBank extends Title {
  bank: 'SICOOB' | 'BRADESCO';
  nossoNumero: string;
  valor?: number;
  vencimento?: Date;
}

/**
 * Adapter: Repositório de Títulos Agregado
 * 
 * Busca títulos em Sicoob e Bradesco, detecta duplicidades e registra no Sheets.
 * 
 * Fluxo:
 * 1. Buscar boletos em aberto no Sicoob
 * 2. Buscar boletos em aberto no Bradesco
 * 3. Se ambos vazios → retornar vazio
 * 4. Unir listas mantendo info do banco de origem
 * 5. Detectar duplicidades (mesmo mês e valor) e registrar no Sheets
 */
export class AggregatedTitleRepositoryAdapter implements TitleRepository {
  constructor(
    private sicoobPort: SicoobPort,
    private bradescoPort: BradescoPort,
    private sheetLogger: SheetLogger,
    private logger: Logger
  ) {}

  async findOpenTitlesByCpfHash(cpf: string, cpfHash: string): Promise<Title[]> {
    try {
      const requestId = crypto.randomUUID();
      
      // 1. Buscar boletos em aberto no Sicoob
      let sicoobBoletos: TitleWithBank[] = [];
      try {
        const boletosSicoob = await this.sicoobPort.buscarBoletosPorCPF(cpf, requestId);
        sicoobBoletos = boletosSicoob
          .filter(boleto => boleto.situacao === 'Aberto' || boleto.situacao === 'ABERTO')
          .map(boleto => ({
            id: crypto.randomUUID(),
            nossoNumero: boleto.nossoNumero,
            valor: boleto.valor,
            vencimento: boleto.vencimento ? new Date(boleto.vencimento) : undefined,
            status: boleto.situacao,
            bank: 'SICOOB' as const,
          }));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erro ao buscar no Sicoob';
        this.logger.warn({ cpfHash: cpfHash.slice(0, 8) + '...', error: errorMessage }, 'Erro ao buscar boletos no Sicoob');
        // Continuar mesmo se Sicoob falhar
      }

      // 2. Buscar boletos em aberto no Bradesco
      let bradescoBoletos: TitleWithBank[] = [];
      try {
        const boletosBradesco = await this.bradescoPort.buscarBoletosPorCPF(cpf, requestId);
        bradescoBoletos = boletosBradesco
          .filter(boleto => boleto.situacao === 'Aberto' || boleto.situacao === 'ABERTO' || boleto.situacao === 'Pendente')
          .map(boleto => ({
            id: crypto.randomUUID(),
            nossoNumero: boleto.nossoNumero,
            valor: boleto.valor,
            vencimento: boleto.vencimento ? new Date(boleto.vencimento) : undefined,
            status: boleto.situacao,
            bank: 'BRADESCO' as const,
          }));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erro ao buscar no Bradesco';
        this.logger.warn({ cpfHash: cpfHash.slice(0, 8) + '...', error: errorMessage }, 'Erro ao buscar boletos no Bradesco');
        // Continuar mesmo se Bradesco falhar
      }

      // 3. Se ambos vazios → retornar vazio
      if (sicoobBoletos.length === 0 && bradescoBoletos.length === 0) {
        this.logger.debug({ cpfHash: cpfHash.slice(0, 8) + '...', count: 0 }, 'Nenhum boleto em aberto encontrado');
        return [];
      }

      // 4. Unir listas mantendo info do banco de origem
      const allBoletos: TitleWithBank[] = [...sicoobBoletos, ...bradescoBoletos];

      // 5. Detectar duplicidades (mesmo mês e valor) e registrar no Sheets
      await this.detectAndLogDuplicates(allBoletos, cpf, cpfHash, requestId);

      // Converter para Title[] (manter campo bank)
      const titles: Title[] = allBoletos.map(boleto => ({
        id: boleto.id,
        nossoNumero: boleto.nossoNumero,
        valor: boleto.valor,
        vencimento: boleto.vencimento,
        status: boleto.status,
        bank: boleto.bank, // Manter informação do banco
      }));

      this.logger.debug({ 
        cpfHash: cpfHash.slice(0, 8) + '...', 
        count: titles.length,
        sicoobCount: sicoobBoletos.length,
        bradescoCount: bradescoBoletos.length
      }, 'Títulos encontrados e agregados');

      return titles;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao buscar títulos';
      this.logger.error({ cpfHash: cpfHash.slice(0, 8) + '...', error: errorMessage }, 'Erro ao buscar títulos agregados');
      throw new Error(`Falha ao buscar títulos: ${errorMessage}`);
    }
  }

  /**
   * Detecta duplicidades entre bancos diferentes
   * 
   * Definição de "igual": mesmo mês (YYYY-MM extraído de vencimento) E mesmo valor (arredondado para 2 casas)
   */
  private async detectAndLogDuplicates(
    boletos: TitleWithBank[],
    cpf: string,
    cpfHash: string,
    requestId: string
  ): Promise<void> {
    try {
      // Agrupar por mês e valor
      const groups = new Map<string, TitleWithBank[]>();

      for (const boleto of boletos) {
        if (!boleto.vencimento || !boleto.valor) {
          continue;
        }

        // Extrair YYYY-MM do vencimento
        const month = boleto.vencimento.toISOString().slice(0, 7); // YYYY-MM
        const valorArredondado = Math.round(boleto.valor * 100) / 100; // 2 casas decimais

        // Chave: YYYY-MM|valor
        const key = `${month}|${valorArredondado}`;

        if (!groups.has(key)) {
          groups.set(key, []);
        }
        groups.get(key)!.push(boleto);
      }

      // Verificar se há grupos com boletos de bancos diferentes
      for (const [key, grupoBoletos] of groups.entries()) {
        if (grupoBoletos.length < 2) {
          continue; // Precisa de pelo menos 2 boletos para ser duplicidade
        }

        // Verificar se há boletos de bancos diferentes
        const bancos = new Set(grupoBoletos.map(b => b.bank));
        if (bancos.size < 2) {
          continue; // Todos do mesmo banco, não é duplicidade entre bancos
        }

        // Encontrou duplicidade entre bancos diferentes
        const [month, valorStr] = key.split('|');
        const valor = parseFloat(valorStr);

        // Extrair IDs/chaves dos títulos (sem vazar dados sensíveis)
        const titulosIds = grupoBoletos.map(b => ({
          nossoNumero: b.nossoNumero,
          bank: b.bank,
        }));

        // Registrar no Sheets
        await this.sheetLogger.appendEvent(EventType.DUPLICATE_BANK_TITLE, {
          cpfHash,
          cpfMasked: CpfHandler.maskCpf(cpf),
          banks: Array.from(bancos).join(','),
          month,
          amount: valor,
          meta: JSON.stringify({
            titulos: titulosIds,
            count: grupoBoletos.length,
          }),
          requestId,
          timestamp: new Date().toISOString(),
        });

        this.logger.warn({
          cpfHash: cpfHash.slice(0, 8) + '...',
          month,
          valor,
          banks: Array.from(bancos).join(','),
          count: grupoBoletos.length,
        }, 'Duplicidade detectada entre bancos diferentes');
      }
    } catch (error) {
      // Não quebrar o fluxo principal se falhar ao detectar/logar duplicidade
      const errorMessage = error instanceof Error ? error.message : 'Erro ao detectar duplicidades';
      this.logger.error({ cpfHash: cpfHash.slice(0, 8) + '...', error: errorMessage }, 'Erro ao detectar/logar duplicidades');
    }
  }
}
