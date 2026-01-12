import { TitleRepository } from '../../application/ports/driven/title-repository.port.js';
import { SicoobPort } from '../../application/ports/driven/sicoob-port.js';
import { Title } from '../../domain/entities/title.js';
import { Logger } from '../../application/ports/driven/logger-port.js';
import crypto from 'crypto';

/**
 * Adapter: Repositório de Títulos usando Sicoob
 * Converte BoletoSicoob[] em Title[]
 */
export class SicoobTitleRepositoryAdapter implements TitleRepository {
  constructor(
    private sicoobPort: SicoobPort,
    private logger: Logger
  ) {}

  async findOpenTitlesByCpfHash(cpfHash: string): Promise<Title[]> {
    try {
      // Buscar boletos do Sicoob
      const boletos = await this.sicoobPort.buscarBoletosPorCPF(cpfHash, crypto.randomUUID());

      // Filtrar apenas boletos em aberto (situacao === 'Aberto' ou similar)
      const boletosAbertos = boletos.filter(
        boleto => boleto.situacao === 'Aberto' || boleto.situacao === 'ABERTO'
      );

      // Converter BoletoSicoob[] para Title[]
      const titles: Title[] = boletosAbertos.map(boleto => ({
        id: crypto.randomUUID(),
        nossoNumero: boleto.nossoNumero,
        valor: boleto.valor,
        vencimento: boleto.vencimento ? new Date(boleto.vencimento) : undefined,
        status: boleto.situacao,
      }));

      this.logger.debug({ cpfHash, count: titles.length }, 'Títulos encontrados no Sicoob');

      return titles;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao buscar títulos';
      this.logger.error({ cpfHash, error: errorMessage }, 'Erro ao buscar títulos no Sicoob');
      throw new Error(`Falha ao buscar títulos: ${errorMessage}`);
    }
  }
}
