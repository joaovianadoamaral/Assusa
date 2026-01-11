import { DriveSaveResult } from '../../dtos/drive-save-result.dto.js';

/**
 * Port: Armazenamento no Drive
 * 
 * Responsável por salvar e excluir PDFs privados no Google Drive
 */
export interface DriveStorage {
  /**
   * Salva um PDF privado no Drive
   * @param buffer Buffer do arquivo PDF
   * @param filename Nome do arquivo
   * @returns ID do arquivo salvo no Drive
   */
  savePrivatePdf(buffer: Buffer, filename: string): Promise<DriveSaveResult>;
  
  /**
   * Exclui um arquivo do Drive
   * @param fileId ID do arquivo no Drive
   */
  deleteFile(fileId: string): Promise<void>;
}
