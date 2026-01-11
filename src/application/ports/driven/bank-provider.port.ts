import { Title } from '../../../domain/entities/title.js';
import { BankPdfResult } from '../../dtos/bank-pdf-result.dto.js';
import { BankDataResult } from '../../dtos/bank-data-result.dto.js';

/**
 * Port: Provedor de Banco
 * 
 * Responsável por obter PDFs e dados de títulos do banco
 */
export interface BankProvider {
  /**
   * Obtém o PDF da segunda via de um título
   * @param title Título para obter a segunda via
   * @returns PDF buffer, mime type e nome do arquivo (opcional), ou null se não encontrado
   */
  getSecondCopyPdf(title: Title): Promise<BankPdfResult | null>;
  
  /**
   * Obtém os dados de um título para geração de PDF
   * @param title Título para obter os dados
   * @returns Dados do título (linha digitável, valor, vencimento, etc.), ou null se não encontrado
   */
  getSecondCopyData(title: Title): Promise<BankDataResult | null>;
}
