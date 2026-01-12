import { BankProvider } from '../../application/ports/driven/bank-provider.port.js';
import { SicoobPort } from '../../application/ports/driven/sicoob-port.js';
import { Title } from '../../domain/entities/title.js';
import { BankPdfResult } from '../../application/dtos/bank-pdf-result.dto.js';
import { BankDataResult } from '../../application/dtos/bank-data-result.dto.js';
import { Logger } from '../../application/ports/driven/logger-port.js';
import crypto from 'crypto';

/**
 * Adapter: Provedor de Banco usando Sicoob
 * Wrapper para SicoobPort que adapta para a interface BankProvider
 */
export class SicoobBankProviderAdapter implements BankProvider {
  constructor(
    private sicoobPort: SicoobPort,
    private logger: Logger
  ) {}

  async getSecondCopyPdf(title: Title): Promise<BankPdfResult | null> {
    try {
      const requestId = crypto.randomUUID();
      
      // Tentar obter PDF do Sicoob
      // Nota: SicoobPort.gerarSegundaVia requer cpfHash, mas não temos aqui
      // Vamos usar uma string vazia ou null - isso pode precisar ser ajustado
      const pdfBuffer = await this.sicoobPort.gerarSegundaVia(title.nossoNumero, '', requestId);

      this.logger.debug({ requestId, nossoNumero: title.nossoNumero }, 'PDF obtido do Sicoob');

      return {
        buffer: pdfBuffer,
        mime: 'application/pdf',
        filename: `boleto-${title.nossoNumero}.pdf`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao obter PDF';
      this.logger.warn({ nossoNumero: title.nossoNumero, error: errorMessage }, 'PDF não disponível do Sicoob');
      // Retornar null se não conseguir obter PDF (não é erro fatal)
      return null;
    }
  }

  async getSecondCopyData(title: Title): Promise<BankDataResult | null> {
    try {
      const requestId = crypto.randomUUID();

      // Buscar boletos para obter dados
      // Nota: Precisamos do cpfHash para buscar, mas não temos aqui
      // Por enquanto, vamos retornar null - isso pode precisar ser ajustado
      // ou a implementação pode buscar por nossoNumero diretamente
      this.logger.warn({ requestId, nossoNumero: title.nossoNumero }, 'getSecondCopyData não implementado completamente');

      // Retornar dados básicos do title
      if (!title.valor || !title.vencimento) {
        return null;
      }

      return {
        nossoNumero: title.nossoNumero,
        linhaDigitavel: '', // Precisa ser obtido da API do Sicoob
        valor: title.valor,
        vencimento: title.vencimento,
        beneficiario: undefined,
        pagador: undefined,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao obter dados';
      this.logger.error({ nossoNumero: title.nossoNumero, error: errorMessage }, 'Erro ao obter dados do Sicoob');
      return null;
    }
  }
}
