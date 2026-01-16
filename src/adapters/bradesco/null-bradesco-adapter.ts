import { BankProvider } from '../../application/ports/driven/bank-provider.port.js';
import { BradescoPort } from '../../application/ports/driven/bradesco-port.js';
import { Title } from '../../domain/entities/title.js';
import { BoletoBradesco, BuscarBoletosPorCPFParams } from '../../domain/entities/boleto.js';
import { BankPdfResult } from '../../application/dtos/bank-pdf-result.dto.js';
import { BankDataResult } from '../../application/dtos/bank-data-result.dto.js';

/**
 * Adapter Null Object para Bradesco quando não está configurado
 * 
 * Implementa as interfaces mas retorna valores vazios/null sem fazer chamadas reais.
 * Permite que o sistema funcione apenas com Sicoob sem erros.
 */
export class NullBradescoAdapter implements BankProvider, BradescoPort {
  async getSecondCopyPdf(_title: Title): Promise<BankPdfResult | null> {
    return null;
  }

  async getSecondCopyData(_title: Title): Promise<BankDataResult | null> {
    return null;
  }

  async buscarBoletosPorCPF(_cpf: string, _requestId: string, _params?: BuscarBoletosPorCPFParams): Promise<BoletoBradesco[]> {
    return [];
  }
}
