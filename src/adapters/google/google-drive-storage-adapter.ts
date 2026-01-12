import { DriveStorage } from '../../application/ports/driven/drive-storage.port.js';
import { DrivePort } from '../../application/ports/driven/drive-port.js';
import { DriveSaveResult } from '../../application/dtos/drive-save-result.dto.js';
import { Logger } from '../../application/ports/driven/logger-port.js';
import crypto from 'crypto';

/**
 * Adapter: Armazenamento no Drive usando GoogleDriveAdapter
 * Wrapper para DrivePort que adapta para a interface DriveStorage
 */
export class GoogleDriveStorageAdapter implements DriveStorage {
  constructor(
    private drivePort: DrivePort,
    private logger: Logger
  ) {}

  async savePrivatePdf(buffer: Buffer, filename: string): Promise<DriveSaveResult> {
    try {
      const requestId = crypto.randomUUID();
      
      const fileId = await this.drivePort.uploadFile(filename, buffer, 'application/pdf', requestId);

      this.logger.debug({ requestId, fileId, filename }, 'PDF salvo no Drive');

      return {
        fileId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao salvar PDF';
      this.logger.error({ filename, error: errorMessage }, 'Erro ao salvar PDF no Drive');
      throw new Error(`Falha ao salvar PDF: ${errorMessage}`);
    }
  }

  async deleteFile(fileId: string): Promise<void> {
    try {
      const requestId = crypto.randomUUID();
      
      await this.drivePort.deleteFile(fileId, requestId);

      this.logger.debug({ requestId, fileId }, 'Arquivo excluído do Drive');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao excluir arquivo';
      this.logger.error({ fileId, error: errorMessage }, 'Erro ao excluir arquivo do Drive');
      throw new Error(`Falha ao excluir arquivo: ${errorMessage}`);
    }
  }
}
