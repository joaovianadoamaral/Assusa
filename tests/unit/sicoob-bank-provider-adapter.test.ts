import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios, { AxiosInstance } from 'axios';
import { SicoobBankProviderAdapter } from '../../src/adapters/sicoob/sicoob-bank-provider-adapter.js';
import { Config } from '../../src/infrastructure/config/config.js';
import { Logger } from '../../src/application/ports/driven/logger-port.js';
import { Title } from '../../src/domain/entities/title.js';
import { SicoobErrorCode } from '../../src/domain/enums/sicoob-error-code.js';

// Mock do axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

// Mock da instância axios
const mockAxiosInstance = {
  get: vi.fn(),
  post: vi.fn(),
} as unknown as AxiosInstance;

describe('SicoobBankProviderAdapter', () => {
  let adapter: SicoobBankProviderAdapter;
  let mockConfig: Config;
  let mockLogger: Logger;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock axios.create para retornar nossa instância mockada
    mockedAxios.create.mockReturnValue(mockAxiosInstance as any);

    mockConfig = {
      sicoobClientId: 'test-client-id',
      sicoobClientSecret: 'test-client-secret',
      sicoobBaseUrl: 'https://api.sicoob.com.br/cobranca-bancaria/v3',
      sicoobAuthTokenUrl: 'https://auth.sicoob.com.br/auth/realms/cooperado/protocol/openid-connect/token',
      sicoobNumeroCliente: '12345',
      sicoobCodigoModalidade: '01',
      sicoobNumeroContratoCobranca: '67890',
      nodeEnv: 'test',
      port: 3000,
      host: '0.0.0.0',
      whatsappApiToken: 'test-token',
      whatsappPhoneNumberId: 'test-phone-id',
      whatsappVerifyToken: 'test-verify',
      whatsappAppSecret: 'test-secret',
      googleServiceAccountJsonBase64: 'test-json',
      googleDriveFolderId: 'test-folder',
      googleSheetsSpreadsheetId: 'test-sheet',
      googleSheetsWorksheetName: 'Requests',
      redisEnabled: false,
      cpfPepper: 'test-pepper-key-for-hashing-cpf-security-min-32-char',
      allowRawCpfInFilename: false,
      dataRetentionDays: 90,
      logLevel: 'info',
      serviceName: 'assusa',
      rateLimitMaxRequests: 100,
      rateLimitWindowMs: 60000,
      conversationStateTtlSeconds: 900,
    } as Config;

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };

    adapter = new SicoobBankProviderAdapter(mockConfig, mockLogger);
  });

  describe('getAuthToken', () => {
    it('deve obter token usando URL configurável', async () => {
      const mockTokenResponse = {
        data: {
          access_token: 'test-access-token',
          token_type: 'Bearer',
          expires_in: 3600,
        },
      };

      mockedAxios.post.mockResolvedValueOnce(mockTokenResponse);

      // Acessar método privado via reflexão ou testar indiretamente
      // Como getAuthToken é privado, vamos testar indiretamente através de getSecondCopyPdf
      const title: Title = {
        id: 'test-id',
        nossoNumero: '123456',
      };

      const mockSegundaViaResponse = {
        data: {
          resultado: {
            nossoNumero: '123456',
            pdfBoleto: Buffer.from('%PDF-test-content').toString('base64'),
          },
        },
        status: 200,
      };

      // Mock já configurado no beforeEach
      vi.mocked(mockAxiosInstance.get).mockResolvedValueOnce(mockSegundaViaResponse);

      const result = await adapter.getSecondCopyPdf(title);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        mockConfig.sicoobAuthTokenUrl,
        expect.any(URLSearchParams),
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        })
      );

      expect(result).not.toBeNull();
      expect(result?.buffer).toBeInstanceOf(Buffer);
    });
  });

  describe('getSecondCopyPdf', () => {
    it('deve obter PDF convertendo Base64 para Buffer', async () => {
      const title: Title = {
        id: 'test-id',
        nossoNumero: '123456',
      };

      const mockTokenResponse = {
        data: {
          access_token: 'test-access-token',
          token_type: 'Bearer',
          expires_in: 3600,
        },
      };

      const pdfContent = '%PDF-test-content';
      const pdfBase64 = Buffer.from(pdfContent).toString('base64');

      const mockSegundaViaResponse = {
        data: {
          resultado: {
            nossoNumero: '123456',
            pdfBoleto: pdfBase64,
          },
        },
        status: 200,
      };

      mockedAxios.post.mockResolvedValueOnce(mockTokenResponse);

      vi.mocked(mockAxiosInstance.get).mockResolvedValueOnce(mockSegundaViaResponse);

      const result = await adapter.getSecondCopyPdf(title);

      expect(result).not.toBeNull();
      expect(result?.buffer).toBeInstanceOf(Buffer);
      expect(result?.buffer.toString()).toBe(pdfContent);
      expect(result?.mime).toBe('application/pdf');
      expect(result?.filename).toBe('boleto-123456.pdf');

      // Verificar que a chamada foi feita com os parâmetros corretos
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/boletos/segunda-via',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-access-token',
            'client_id': 'test-client-id',
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          }),
          params: expect.objectContaining({
            numeroCliente: '12345',
            codigoModalidade: '01',
            nossoNumero: '123456',
            gerarPdf: 'true',
            numeroContratoCobranca: '67890',
          }),
        })
      );
    });

    it('deve retornar null quando pdfBoleto não está presente', async () => {
      const title: Title = {
        id: 'test-id',
        nossoNumero: '123456',
      };

      const mockTokenResponse = {
        data: {
          access_token: 'test-access-token',
          token_type: 'Bearer',
          expires_in: 3600,
        },
      };

      const mockSegundaViaResponse = {
        data: {
          resultado: {
            nossoNumero: '123456',
            // pdfBoleto ausente
          },
        },
        status: 200,
      };

      mockedAxios.post.mockResolvedValueOnce(mockTokenResponse);

      vi.mocked(mockAxiosInstance.get).mockResolvedValueOnce(mockSegundaViaResponse);

      const result = await adapter.getSecondCopyPdf(title);

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          nossoNumero: '123456',
        }),
        'PDF não encontrado na resposta da segunda via'
      );
    });

    it('deve retornar null quando Base64 não é um PDF válido', async () => {
      const title: Title = {
        id: 'test-id',
        nossoNumero: '123456',
      };

      const mockTokenResponse = {
        data: {
          access_token: 'test-access-token',
          token_type: 'Bearer',
          expires_in: 3600,
        },
      };

      const invalidPdfBase64 = Buffer.from('not-a-pdf').toString('base64');

      const mockSegundaViaResponse = {
        data: {
          resultado: {
            nossoNumero: '123456',
            pdfBoleto: invalidPdfBase64,
          },
        },
        status: 200,
      };

      mockedAxios.post.mockResolvedValueOnce(mockTokenResponse);

      vi.mocked(mockAxiosInstance.get).mockResolvedValueOnce(mockSegundaViaResponse);

      const result = await adapter.getSecondCopyPdf(title);

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          nossoNumero: '123456',
        }),
        'Dados Base64 não correspondem a um PDF válido'
      );
    });

    it('deve retornar null quando recebe 404', async () => {
      const title: Title = {
        id: 'test-id',
        nossoNumero: '123456',
      };

      const mockTokenResponse = {
        data: {
          access_token: 'test-access-token',
          token_type: 'Bearer',
          expires_in: 3600,
        },
      };

      const axiosError = {
        isAxiosError: true,
        response: {
          status: 404,
          data: { message: 'Not found' },
        },
      } as any;

      // Mock axios.isAxiosError para retornar true
      vi.mocked(axios.isAxiosError).mockReturnValue(true);

      mockedAxios.post.mockResolvedValueOnce(mockTokenResponse);
      vi.mocked(mockAxiosInstance.get).mockRejectedValueOnce(axiosError);

      const result = await adapter.getSecondCopyPdf(title);

      expect(result).toBeNull();
    });
  });

  describe('getSecondCopyData', () => {
    it('deve obter dados do boleto com linha digitável e código de barras', async () => {
      const title: Title = {
        id: 'test-id',
        nossoNumero: '123456',
      };

      const mockTokenResponse = {
        data: {
          access_token: 'test-access-token',
          token_type: 'Bearer',
          expires_in: 3600,
        },
      };

      const mockSegundaViaResponse = {
        data: {
          resultado: {
            nossoNumero: '123456',
            linhaDigitavel: '12345.67890 12345.678901 12345.678901 1 23456789012345',
            codigoBarras: '12345678901234567890123456789012345678901234',
            valor: 100.50,
            dataVencimento: '2024-12-31',
          },
        },
        status: 200,
      };

      mockedAxios.post.mockResolvedValueOnce(mockTokenResponse);

      vi.mocked(mockAxiosInstance.get).mockResolvedValueOnce(mockSegundaViaResponse);

      const result = await adapter.getSecondCopyData(title);

      expect(result).not.toBeNull();
      expect(result?.nossoNumero).toBe('123456');
      expect(result?.linhaDigitavel).toBe('12345.67890 12345.678901 12345.678901 1 23456789012345');
      expect(result?.codigoBarras).toBe('12345678901234567890123456789012345678901234');
      expect(result?.valor).toBe(100.50);
      expect(result?.vencimento).toBeInstanceOf(Date);

      // Verificar que a chamada foi feita com gerarPdf=false
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/boletos/segunda-via',
        expect.objectContaining({
          params: expect.objectContaining({
            gerarPdf: 'false',
          }),
        })
      );
    });

    it('deve retornar null quando resultado não está presente', async () => {
      const title: Title = {
        id: 'test-id',
        nossoNumero: '123456',
      };

      const mockTokenResponse = {
        data: {
          access_token: 'test-access-token',
          token_type: 'Bearer',
          expires_in: 3600,
        },
      };

      const mockSegundaViaResponse = {
        data: {
          // resultado ausente
        },
        status: 200,
      };

      mockedAxios.post.mockResolvedValueOnce(mockTokenResponse);

      vi.mocked(mockAxiosInstance.get).mockResolvedValueOnce(mockSegundaViaResponse);

      const result = await adapter.getSecondCopyData(title);

      expect(result).toBeNull();
    });

    it('deve retornar null quando nossoNumero não está presente', async () => {
      const title: Title = {
        id: 'test-id',
        nossoNumero: '123456',
      };

      const mockTokenResponse = {
        data: {
          access_token: 'test-access-token',
          token_type: 'Bearer',
          expires_in: 3600,
        },
      };

      const mockSegundaViaResponse = {
        data: {
          resultado: {
            // nossoNumero ausente
            valor: 100.50,
          },
        },
        status: 200,
      };

      mockedAxios.post.mockResolvedValueOnce(mockTokenResponse);

      vi.mocked(mockAxiosInstance.get).mockResolvedValueOnce(mockSegundaViaResponse);

      const result = await adapter.getSecondCopyData(title);

      expect(result).toBeNull();
    });
  });
});
