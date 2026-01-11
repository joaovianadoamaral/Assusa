import { PdfBuildFromBankPdfParams, PdfBuildFromDataParams } from '../../dtos/pdf-build-params.dto.js';

/**
 * Port: Serviço de PDF
 * 
 * Responsável por construir PDFs a partir de diferentes fontes
 */
export interface PdfService {
  /**
   * Constrói um PDF a partir de um PDF do banco
   * @param params Parâmetros contendo o buffer do PDF do banco e nome do arquivo (opcional)
   * @returns Buffer do PDF processado
   */
  buildFromBankPdf(params: PdfBuildFromBankPdfParams): Promise<Buffer>;
  
  /**
   * Constrói um PDF a partir de dados estruturados
   * @param params Parâmetros contendo os dados do título e nome do arquivo (opcional)
   * @returns Buffer do PDF gerado
   */
  buildFromData(params: PdfBuildFromDataParams): Promise<Buffer>;
}
