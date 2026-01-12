import { google } from 'googleapis';
import { DrivePort } from '../../application/ports/driven/drive-port.js';
import { Logger } from '../../application/ports/driven/logger-port.js';
import { Config } from '../../infrastructure/config/config.js';
import { GoogleAuth } from '../../infrastructure/utils/google-auth.js';

export class GoogleDriveAdapter implements DrivePort {
  private drive: ReturnType<typeof google.drive>;
  private folderId: string;

  constructor(config: Config, private logger: Logger) {
    this.folderId = config.googleDriveFolderId;

    // Inicializar GoogleAuth com Service Account JSON base64
    const googleAuth = GoogleAuth.getInstance();
    googleAuth.initialize(config.googleServiceAccountJsonBase64, [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/drive',
    ]);

    // Criar cliente Drive usando o auth do GoogleAuth
    this.drive = google.drive({
      version: 'v3',
      auth: googleAuth.getAuthClient(),
    });
  }

  async uploadFile(
    fileName: string,
    fileContent: Buffer,
    mimeType: string,
    requestId: string
  ): Promise<string> {
    try {
      const response = await this.drive.files.create({
        requestBody: {
          name: fileName,
          parents: [this.folderId],
          // Tornar privado (apenas para o serviço)
          // A pasta já deve estar configurada como privada
        },
        media: {
          mimeType,
          body: fileContent,
        },
        fields: 'id, webViewLink',
      }, {
        headers: {
          'X-Request-ID': requestId,
        },
      });

      const fileId = response.data.id;
      if (!fileId) {
        throw new Error('ID do arquivo não retornado');
      }

      // Arquivo é criado na pasta privada, sem permissões públicas
      // A pasta já deve estar compartilhada apenas com service account e equipe

      this.logger.info({ requestId, fileId, fileName }, 'Arquivo enviado para o Drive');

      return fileId;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao fazer upload';
      this.logger.error({ requestId, fileName, error: errorMessage }, 'Erro ao fazer upload para Drive');
      throw new Error(`Falha ao fazer upload: ${errorMessage}`);
    }
  }

  async deleteFile(fileId: string, requestId: string): Promise<void> {
    try {
      await this.drive.files.delete({
        fileId,
      }, {
        headers: {
          'X-Request-ID': requestId,
        },
      });

      this.logger.info({ requestId, fileId }, 'Arquivo deletado do Drive');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao deletar arquivo';
      this.logger.error({ requestId, fileId, error: errorMessage }, 'Erro ao deletar arquivo do Drive');
      throw new Error(`Falha ao deletar arquivo: ${errorMessage}`);
    }
  }

  getFileUrl(fileId: string): string {
    // Retornar URL de visualização do arquivo (requer autenticação)
    return `https://drive.google.com/file/d/${fileId}/view`;
  }

  async getDownloadUrl(fileId: string, requestId: string): Promise<string> {
    try {
      const file = await this.drive.files.get({
        fileId,
        fields: 'webContentLink',
      });

      return file.data.webContentLink || this.getFileUrl(fileId);
    } catch (error) {
      this.logger.error({ requestId, fileId, error }, 'Erro ao obter URL de download');
      return this.getFileUrl(fileId);
    }
  }
}
