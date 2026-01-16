import { BankProvider } from '../../application/ports/driven/bank-provider.port.js';
import { Title } from '../../domain/entities/title.js';
import { BankPdfResult } from '../../application/dtos/bank-pdf-result.dto.js';
import { BankDataResult } from '../../application/dtos/bank-data-result.dto.js';
import { Logger } from '../../application/ports/driven/logger-port.js';

/**
 * Adapter: Provedor de Banco Agregado
 * 
 * Roteia requisições entre Sicoob e Bradesco baseado no campo `bank` do Title.
 * Se não houver informação do banco, tenta Sicoob primeiro, depois Bradesco.
 */
export class AggregatedBankProviderAdapter implements BankProvider {
  constructor(
    private sicoobProvider: BankProvider,
    private bradescoProvider: BankProvider,
    private logger: Logger
  ) {}

  /**
   * Obtém o PDF da segunda via de um título
   * Roteia para o banco correto baseado no campo `bank` do Title
   */
  async getSecondCopyPdf(title: Title): Promise<BankPdfResult | null> {
    // Se o título tem informação do banco, usar diretamente
    if (title.bank === 'SICOOB') {
      return this.sicoobProvider.getSecondCopyPdf(title);
    }
    
    if (title.bank === 'BRADESCO') {
      return this.bradescoProvider.getSecondCopyPdf(title);
    }

    // Se não tem informação do banco, tentar Sicoob primeiro
    this.logger.debug({ nossoNumero: title.nossoNumero }, 'Título sem informação de banco, tentando Sicoob primeiro');
    
    try {
      const result = await this.sicoobProvider.getSecondCopyPdf(title);
      if (result) {
        return result;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao buscar no Sicoob';
      this.logger.debug({ nossoNumero: title.nossoNumero, error: errorMessage }, 'Sicoob não retornou PDF, tentando Bradesco');
    }

    // Se Sicoob não retornou, tentar Bradesco
    return this.bradescoProvider.getSecondCopyPdf(title);
  }

  /**
   * Obtém os dados de um título para geração de PDF
   * Roteia para o banco correto baseado no campo `bank` do Title
   */
  async getSecondCopyData(title: Title): Promise<BankDataResult | null> {
    // Se o título tem informação do banco, usar diretamente
    if (title.bank === 'SICOOB') {
      return this.sicoobProvider.getSecondCopyData(title);
    }
    
    if (title.bank === 'BRADESCO') {
      return this.bradescoProvider.getSecondCopyData(title);
    }

    // Se não tem informação do banco, tentar Sicoob primeiro
    this.logger.debug({ nossoNumero: title.nossoNumero }, 'Título sem informação de banco, tentando Sicoob primeiro');
    
    try {
      const result = await this.sicoobProvider.getSecondCopyData(title);
      if (result) {
        return result;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao buscar no Sicoob';
      this.logger.debug({ nossoNumero: title.nossoNumero, error: errorMessage }, 'Sicoob não retornou dados, tentando Bradesco');
    }

    // Se Sicoob não retornou, tentar Bradesco
    return this.bradescoProvider.getSecondCopyData(title);
  }
}
