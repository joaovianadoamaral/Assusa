import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GoogleDriveAdapter } from '../../src/adapters/google/drive-adapter.js';
import { Config } from '../../src/infrastructure/config/config.js';
import { Logger } from '../../src/application/ports/driven/logger-port.js';
import { GoogleAuth } from '../../src/infrastructure/utils/google-auth.js';

// Mocks
const mockDriveFilesCreate = vi.fn();
const mockDriveFilesDelete = vi.fn();
const mockDriveFilesGet = vi.fn();

// Mock do googleapis
vi.mock('googleapis', () => {
  const mockDrive = vi.fn(() => ({
    files: {
      create: mockDriveFilesCreate,
      delete: mockDriveFilesDelete,
      get: mockDriveFilesGet,
    },
  }));

  return {
    google: {
      drive: mockDrive,
      auth: {
        GoogleAuth: vi.fn(),
      },
    },
  };
});

// Mock do GoogleAuth
vi.mock('../../src/infrastructure/utils/google-auth.js', () => {
  const mockAuth = {
    getAuthClient: vi.fn(() => mockAuth),
  };

  return {
    GoogleAuth: {
      getInstance: vi.fn(() => ({
        initialize: vi.fn(),
        getAuthClient: vi.fn(() => mockAuth),
        getClientEmail: vi.fn(() => 'test@example.com'),
      })),
      reset: vi.fn(),
    },
  };
});

describe('GoogleDriveAdapter', () => {
  let adapter: GoogleDriveAdapter;
  let mockConfig: Config;
  let mockLogger: Logger;

  const folderId = 'test-folder-id-123';
  const serviceAccountJsonBase64 = Buffer.from(JSON.stringify({
    type: 'service_account',
    project_id: 'test-project',
    private_key_id: 'test-key-id',
    private_key: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----\n',
    client_email: 'test@example.com',
    client_id: 'test-client-id',
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
  })).toString('base64');

  beforeEach(() => {
    // Reset mocks
    GoogleAuth.reset();
    vi.clearAllMocks();
    
    // Reset dos mocks do drive
    mockDriveFilesCreate.mockClear();
    mockDriveFilesDelete.mockClear();
    mockDriveFilesGet.mockClear();

    mockConfig = {
      googleServiceAccountJsonBase64: serviceAccountJsonBase64,
      googleDriveFolderId: folderId,
      googleSheetsSpreadsheetId: 'test-spreadsheet-id',
      googleSheetsWorksheetName: 'Requests',
    } as Config;

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };

    adapter = new GoogleDriveAdapter(mockConfig, mockLogger);
  });

  describe('uploadFile', () => {
    it('deve criar arquivo no Drive com parents contendo folderId', async () => {
      const fileName = 'boleto-123.pdf';
      const fileContent = Buffer.from('PDF content');
      const mimeType = 'application/pdf';
      const requestId = 'test-request-id';
      const fileId = 'drive-file-id-123';

      mockDriveFilesCreate.mockResolvedValue({
        data: {
          id: fileId,
          webViewLink: 'https://drive.google.com/file/d/123/view',
        },
      });

      const result = await adapter.uploadFile(fileName, fileContent, mimeType, requestId);

      expect(result).toBe(fileId);
      expect(mockDriveFilesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: expect.objectContaining({
            name: fileName,
            parents: [folderId], // Validar que parents contém folderId
            mimeType: undefined, // mimeType vai no media, não no requestBody
          }),
          media: expect.objectContaining({
            mimeType,
            body: fileContent,
          }),
          fields: 'id, webViewLink',
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Request-ID': requestId,
          }),
        })
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ requestId, fileId, fileName }),
        'Arquivo enviado para o Drive'
      );
    });

    it('deve criar arquivo sem permissões públicas (apenas na pasta privada)', async () => {
      const fileName = 'boleto-123.pdf';
      const fileContent = Buffer.from('PDF content');
      const mimeType = 'application/pdf';
      const requestId = 'test-request-id';
      const fileId = 'drive-file-id-123';

      mockDriveFilesCreate.mockResolvedValue({
        data: {
          id: fileId,
          webViewLink: 'https://drive.google.com/file/d/123/view',
        },
      });

      await adapter.uploadFile(fileName, fileContent, mimeType, requestId);

      // Validar que não há chamada para permissions.create (arquivo privado)
      const callArgs = mockDriveFilesCreate.mock.calls[0][0];
      expect(callArgs.requestBody).not.toHaveProperty('permissions');
      expect(callArgs.requestBody.parents).toEqual([folderId]);
    });

    it('deve lançar erro quando upload falha', async () => {
      const fileName = 'boleto-123.pdf';
      const fileContent = Buffer.from('PDF content');
      const mimeType = 'application/pdf';
      const requestId = 'test-request-id';
      const error = new Error('Erro ao fazer upload');

      mockDriveFilesCreate.mockRejectedValue(error);

      await expect(adapter.uploadFile(fileName, fileContent, mimeType, requestId)).rejects.toThrow('Falha ao fazer upload');
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ requestId, fileName, error: 'Erro ao fazer upload' }),
        'Erro ao fazer upload para Drive'
      );
    });

    it('deve lançar erro quando fileId não é retornado', async () => {
      const fileName = 'boleto-123.pdf';
      const fileContent = Buffer.from('PDF content');
      const mimeType = 'application/pdf';
      const requestId = 'test-request-id';

      mockDriveFilesCreate.mockResolvedValue({
        data: {
          id: undefined,
          webViewLink: 'https://drive.google.com/file/d/123/view',
        },
      });

      await expect(adapter.uploadFile(fileName, fileContent, mimeType, requestId)).rejects.toThrow('ID do arquivo não retornado');
    });
  });

  describe('deleteFile', () => {
    it('deve deletar arquivo do Drive', async () => {
      const fileId = 'drive-file-id-123';
      const requestId = 'test-request-id';

      mockDriveFilesDelete.mockResolvedValue(undefined);

      await adapter.deleteFile(fileId, requestId);

      expect(mockDriveFilesDelete).toHaveBeenCalledWith(
        expect.objectContaining({
          fileId,
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Request-ID': requestId,
          }),
        })
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ requestId, fileId }),
        'Arquivo deletado do Drive'
      );
    });

    it('deve lançar erro quando exclusão falha', async () => {
      const fileId = 'drive-file-id-123';
      const requestId = 'test-request-id';
      const error = new Error('Erro ao deletar arquivo');

      mockDriveFilesDelete.mockRejectedValue(error);

      await expect(adapter.deleteFile(fileId, requestId)).rejects.toThrow('Falha ao deletar arquivo');
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ requestId, fileId, error: 'Erro ao deletar arquivo' }),
        'Erro ao deletar arquivo do Drive'
      );
    });
  });

  describe('getFileUrl', () => {
    it('deve retornar URL de visualização do arquivo', () => {
      const fileId = 'drive-file-id-123';
      const url = adapter.getFileUrl(fileId);

      expect(url).toBe(`https://drive.google.com/file/d/${fileId}/view`);
    });
  });

  describe('getDownloadUrl', () => {
    it('deve retornar URL de download quando disponível', async () => {
      const fileId = 'drive-file-id-123';
      const requestId = 'test-request-id';
      const downloadUrl = 'https://drive.google.com/uc?export=download&id=123';

      mockDriveFilesGet.mockResolvedValue({
        data: {
          webContentLink: downloadUrl,
        },
      });

      const result = await adapter.getDownloadUrl(fileId, requestId);

      expect(result).toBe(downloadUrl);
      expect(mockDriveFilesGet).toHaveBeenCalledWith({
        fileId,
        fields: 'webContentLink',
      });
    });

    it('deve retornar URL de visualização quando webContentLink não está disponível', async () => {
      const fileId = 'drive-file-id-123';
      const requestId = 'test-request-id';

      mockDriveFilesGet.mockResolvedValue({
        data: {
          webContentLink: undefined,
        },
      });

      const result = await adapter.getDownloadUrl(fileId, requestId);

      expect(result).toBe(`https://drive.google.com/file/d/${fileId}/view`);
    });

    it('deve retornar URL de visualização quando ocorre erro', async () => {
      const fileId = 'drive-file-id-123';
      const requestId = 'test-request-id';
      const error = new Error('Erro ao obter URL');

      mockDriveFilesGet.mockRejectedValue(error);

      const result = await adapter.getDownloadUrl(fileId, requestId);

      expect(result).toBe(`https://drive.google.com/file/d/${fileId}/view`);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ requestId, fileId, error }),
        'Erro ao obter URL de download'
      );
    });
  });
});
