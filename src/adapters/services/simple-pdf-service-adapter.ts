import { PdfService } from '../../application/ports/driven/pdf-service.port.js';
import { PdfBuildFromBankPdfParams, PdfBuildFromDataParams } from '../../application/dtos/pdf-build-params.dto.js';
import { Logger } from '../../application/ports/driven/logger-port.js';
import PDFDocument from 'pdfkit';
import { Buffer } from 'buffer';

/**
 * Adapter: Serviço de PDF simples
 * 
 * Para buildFromBankPdf: retorna o buffer como está (já convertido de base64)
 * Para buildFromData: cria um PDF básico usando pdfkit com os dados do boleto
 */
export class SimplePdfServiceAdapter implements PdfService {
  constructor(private logger: Logger) {}

  async buildFromBankPdf(params: PdfBuildFromBankPdfParams): Promise<Buffer> {
    try {
      // O PDF do banco já vem convertido de base64 para Buffer no adapter do Sicoob
      // Apenas retornar o buffer como está
      this.logger.debug({ filename: params.filename }, 'PDF processado (buffer original do banco)');
      
      return params.bankPdfBuffer;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao processar PDF';
      this.logger.error({ error: errorMessage }, 'Erro ao processar PDF do banco');
      throw new Error(`Falha ao processar PDF: ${errorMessage}`);
    }
  }

  async buildFromData(params: PdfBuildFromDataParams): Promise<Buffer> {
    try {
      const { data } = params;
      
      // Criar novo documento PDF
      const doc = new PDFDocument({
        size: 'A4',
        margins: {
          top: 50,
          bottom: 50,
          left: 50,
          right: 50,
        },
      });

      // Buffer para armazenar o PDF gerado
      const chunks: Buffer[] = [];
      
      // Registrar eventos ANTES de começar a escrever
      doc.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      // Promessa para aguardar finalização do PDF
      const pdfPromise = new Promise<void>((resolve, reject) => {
        doc.on('end', () => {
          resolve();
        });
        doc.on('error', (error: Error) => {
          reject(error);
        });
      });
        
      // Conteúdo do PDF
      doc.fontSize(20).text('2ª Via de Boleto', { align: 'center' });
      doc.moveDown(2);

      // Informações do boleto
      doc.fontSize(12);
      doc.text(`Nosso Número: ${data.nossoNumero}`);
      doc.moveDown();
      
      if (data.valor) {
        const valorFormatado = new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        }).format(data.valor);
        doc.text(`Valor: ${valorFormatado}`);
        doc.moveDown();
      }

      if (data.vencimento) {
        const vencimentoFormatado = data.vencimento.toLocaleDateString('pt-BR');
        doc.text(`Vencimento: ${vencimentoFormatado}`);
        doc.moveDown();
      }

      if (data.beneficiario) {
        doc.text(`Beneficiário: ${data.beneficiario}`);
        doc.moveDown();
      }

      if (data.pagador) {
        doc.text(`Pagador: ${data.pagador}`);
        doc.moveDown();
      }

      doc.moveDown(2);

      // Linha digitável
      if (data.linhaDigitavel) {
        doc.fontSize(14).font('Courier');
        doc.text('Linha Digitável:', { align: 'left' });
        doc.moveDown(0.5);
        doc.text(data.linhaDigitavel, { align: 'center' });
        doc.moveDown();
      }

      // Código de barras (se disponível)
      if (data.codigoBarras) {
        doc.fontSize(12).font('Courier');
        doc.moveDown();
        doc.text('Código de Barras:', { align: 'left' });
        doc.moveDown(0.5);
        doc.text(data.codigoBarras, { align: 'center' });
      }

      // Finalizar PDF (deve ser chamado por último)
      doc.end();

      // Aguardar finalização do PDF
      await pdfPromise;

      // Concatenar chunks em um único buffer
      const pdfBuffer = Buffer.concat(chunks);

      this.logger.debug({ 
        filename: params.filename,
        size: pdfBuffer.length,
        nossoNumero: data.nossoNumero 
      }, 'PDF gerado a partir de dados');

      return pdfBuffer;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao gerar PDF';
      this.logger.error({ error: errorMessage }, 'Erro ao gerar PDF a partir de dados');
      throw new Error(`Falha ao gerar PDF: ${errorMessage}`);
    }
  }
}
