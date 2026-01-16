import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import { BankProvider } from '../../application/ports/driven/bank-provider.port.js';
import { BradescoPort } from '../../application/ports/driven/bradesco-port.js';
import { Title } from '../../domain/entities/title.js';
import { BoletoBradesco, BuscarBoletosPorCPFParams } from '../../domain/entities/boleto.js';
import { BankPdfResult } from '../../application/dtos/bank-pdf-result.dto.js';
import { BankDataResult } from '../../application/dtos/bank-data-result.dto.js';
import { Logger } from '../../application/ports/driven/logger-port.js';
import { Config } from '../../infrastructure/config/config.js';

/**
 * Erro customizado para erros do Bradesco
 */
export class BradescoError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = 'BradescoError';
  }
}

/**
 * Resposta de autenticação OAuth2 do Bradesco
 */
interface BradescoAuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

/**
 * Resposta de consulta de título do Bradesco
 */
interface BradescoTituloResponse {
  nossoNumero?: string;
  numeroDocumento?: string;
  valor?: number;
  dataVencimento?: string;
  situacao?: string;
  linhaDigitavel?: string;
  codigoBarras?: string;
  pdfBoleto?: string; // Base64 quando disponível
  [key: string]: unknown;
}

/**
 * Adapter: Provedor de Banco usando Bradesco
 * 
 * Implementa BankProvider e BradescoPort usando a API do Bradesco com:
 * - Autenticação OAuth2 com JWT Bearer (RS256)
 * - Token caching com expiração antecipada (-60s)
 * - Headers customizados (X-Brad-*)
 */
export class BradescoBankProviderAdapter implements BankProvider, BradescoPort {
  private api: AxiosInstance;
  private authToken?: string;
  private tokenExpiresAt?: Date;

  constructor(
    private config: Config,
    private logger: Logger
  ) {
    // Validar configuração obrigatória na inicialização
    if (!config.bradescoClientId) {
      throw new Error('BRADESCO_CLIENT_ID é obrigatório para usar BradescoBankProviderAdapter');
    }
    if (!config.bradescoPrivateKeyPem && !config.bradescoPfxBase64) {
      throw new Error('BRADESCO_PRIVATE_KEY_PEM ou BRADESCO_PFX_BASE64 é obrigatório para usar BradescoBankProviderAdapter');
    }
    if (!config.bradescoBeneficiaryCnpj) {
      throw new Error('BRADESCO_BENEFICIARY_CNPJ é obrigatório para usar BradescoBankProviderAdapter');
    }

    // Validar formato da chave privada PEM se fornecida (apenas em produção, não em testes)
    // A validação real acontece quando tenta usar a chave (lazy validation)
    if (config.bradescoPrivateKeyPem && config.nodeEnv !== 'test') {
      try {
        this.validatePrivateKeyPem(config.bradescoPrivateKeyPem);
      } catch (error) {
        // Em desenvolvimento, apenas logar warning; em produção, falhar
        if (config.nodeEnv === 'production') {
          throw error;
        }
        logger.warn({ error }, 'Chave privada PEM pode estar mal formatada - será validada em runtime');
      }
    }

    const baseUrl = config.bradescoBaseUrl || 'https://openapi.bradesco.com.br';
    this.api = axios.create({
      baseURL: baseUrl,
      timeout: 30000, // 30 segundos
    });
  }

  /**
   * Valida formato básico da chave privada PEM
   */
  private validatePrivateKeyPem(privateKeyPem: string): void {
    // Verificar se contém marcadores PEM básicos
    if (!privateKeyPem.includes('-----BEGIN') || !privateKeyPem.includes('-----END')) {
      throw new Error('BRADESCO_PRIVATE_KEY_PEM deve estar no formato PEM válido (com -----BEGIN e -----END)');
    }

    // Tentar criar objeto de chave para validar formato
    try {
      crypto.createPrivateKey(privateKeyPem);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      throw new Error(`BRADESCO_PRIVATE_KEY_PEM inválida: ${errorMessage}. Verifique se a chave está corretamente formatada.`);
    }
  }

  /**
   * Obtém token de autenticação OAuth2 com cache
   * 
   * Token expira 60 segundos antes do tempo real para evitar problemas
   */
  private async getAuthToken(): Promise<string> {
    // Verificar se token ainda é válido
    if (this.authToken && this.tokenExpiresAt && new Date() < this.tokenExpiresAt) {
      return this.authToken;
    }

    try {
      if (!this.config.bradescoClientId) {
        throw new Error('BRADESCO_CLIENT_ID não configurado');
      }

      if (!this.config.bradescoAuthUrl) {
        throw new Error('BRADESCO_AUTH_URL não configurado');
      }

      // Gerar JWT assertion
      const assertion = await this.generateJwtAssertion();

      // Fazer POST no endpoint de autenticação
      const response = await axios.post<BradescoAuthResponse>(
        this.config.bradescoAuthUrl,
        new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      this.authToken = response.data.access_token;
      
      // Expira 60 segundos antes do tempo real
      const expiresInSeconds = response.data.expires_in;
      const expirationBufferSeconds = 60;
      const expiresInMs = (expiresInSeconds - expirationBufferSeconds) * 1000;
      this.tokenExpiresAt = new Date(Date.now() + expiresInMs);

      this.logger.debug({ 
        expiresAt: this.tokenExpiresAt.toISOString() 
      }, 'Token Bradesco obtido e cacheado');

      return this.authToken;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao autenticar no Bradesco';
      const statusCode = axios.isAxiosError(error) ? error.response?.status : undefined;
      
      this.logger.error({ 
        error: errorMessage,
        statusCode
      }, 'Erro ao autenticar no Bradesco');
      
      throw new BradescoError(
        `Falha na autenticação Bradesco: ${errorMessage}`,
        statusCode
      );
    }
  }

  /**
   * Gera JWT assertion (JWS RS256) para autenticação OAuth2
   * 
   * Payload JWT:
   * - aud: BRADESCO_AUTH_URL
   * - sub: BRADESCO_CLIENT_ID
   * - iat: nowSeconds
   * - exp: nowSeconds + 3600
   * - jti: nowMillis
   * - ver: "1.1" (ou parametrizável)
   */
  private async generateJwtAssertion(): Promise<string> {
    if (!this.config.bradescoClientId) {
      throw new Error('BRADESCO_CLIENT_ID não configurado');
    }

    if (!this.config.bradescoAuthUrl) {
      throw new Error('BRADESCO_AUTH_URL não configurado');
    }

    // Obter chave privada
    const privateKey = await this.getPrivateKey();

    // Montar payload JWT
    const nowSeconds = Math.floor(Date.now() / 1000);
    const nowMillis = Date.now();
    
    const payload = {
      aud: this.config.bradescoAuthUrl,
      sub: this.config.bradescoClientId,
      iat: nowSeconds,
      exp: nowSeconds + 3600, // 1 hora
      jti: String(nowMillis),
      ver: '1.1',
    };

    // Criar header JWT
    const header = {
      alg: 'RS256',
      typ: 'JWT',
    };

    // Codificar header e payload em Base64URL
    const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
    const encodedPayload = this.base64UrlEncode(JSON.stringify(payload));

    // Criar assinatura
    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    const signature = crypto.createSign('RSA-SHA256')
      .update(signatureInput)
      .sign(privateKey, 'base64');

    // Converter assinatura para Base64URL
    const encodedSignature = this.base64ToBase64Url(signature);

    // Retornar JWT completo
    return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
  }

  /**
   * Obtém chave privada (PEM ou extraída do PFX)
   */
  private async getPrivateKey(): Promise<string> {
    // Prioridade: PEM > PFX
    if (this.config.bradescoPrivateKeyPem) {
      return this.config.bradescoPrivateKeyPem;
    }

    if (this.config.bradescoPfxBase64 && this.config.bradescoPfxPassword) {
      // TODO: Extrair chave privada do PFX usando node-forge (similar ao Sicoob)
      // Por enquanto, lançar erro informando que precisa de PEM ou implementar extração de PFX
      throw new Error(
        'Extração de chave privada de PFX ainda não implementada. ' +
        'Use BRADESCO_PRIVATE_KEY_PEM ou implemente extração de PFX.'
      );
    }

    throw new Error(
      'Chave privada não configurada. Configure BRADESCO_PRIVATE_KEY_PEM ou BRADESCO_PFX_BASE64 + BRADESCO_PFX_PASSWORD'
    );
  }

  /**
   * Codifica string para Base64URL
   */
  private base64UrlEncode(str: string): string {
    return Buffer.from(str)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Converte Base64 para Base64URL
   */
  private base64ToBase64Url(base64: string): string {
    return base64
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Constrói headers padronizados para requisições à API Bradesco
   * 
   * Headers obrigatórios:
   * - Authorization: Bearer <token>
   * - cpf-cnpj: <CNPJ completo>
   * - X-Brad-Nonce: <epochMillis>
   * - X-Brad-Timestamp: <ISO8601>
   * - X-Brad-Algorithm: SHA256
   */
  private buildBradescoHeaders(
    token: string,
    requestId?: string
  ): Record<string, string> {
    const now = new Date();
    const epochMillis = now.getTime();
    const iso8601 = now.toISOString();

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'cpf-cnpj': this.config.bradescoBeneficiaryCnpj || '',
      'X-Brad-Nonce': String(epochMillis),
      'X-Brad-Timestamp': iso8601,
      'X-Brad-Algorithm': 'SHA256',
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (requestId) {
      headers['X-Request-ID'] = requestId;
    }

    // Adicionar headers extras se configurados
    if (this.config.bradescoExtraHeaders) {
      Object.assign(headers, this.config.bradescoExtraHeaders);
    }

    return headers;
  }

  /**
   * Obtém o PDF da segunda via de um título
   */
  async getSecondCopyPdf(title: Title): Promise<BankPdfResult | null> {
    const requestId = crypto.randomUUID();
    
    try {
      const token = await this.getAuthToken();

      const apiPrefix = this.config.bradescoApiPrefix || '/v1/boleto';
      const response = await this.api.post<{ resultado?: BradescoTituloResponse }>(
        `${apiPrefix}/titulo-consultar`,
        {
          nossoNumero: title.nossoNumero,
        },
        {
          headers: this.buildBradescoHeaders(token, requestId),
        }
      );

      // Extrair pdfBoleto do resultado
      const pdfBase64 = response.data?.resultado?.pdfBoleto;
      
      if (!pdfBase64) {
        this.logger.warn({ 
          requestId, 
          nossoNumero: title.nossoNumero
        }, 'PDF não encontrado na resposta do Bradesco');
        return null;
      }

      // Converter Base64 para Buffer
      const buffer = Buffer.from(pdfBase64, 'base64');
      
      // Validar que é um PDF válido (começa com "%PDF")
      const isPdf = buffer.slice(0, 4).toString() === '%PDF';
      
      if (!isPdf) {
        this.logger.warn({ 
          requestId, 
          nossoNumero: title.nossoNumero
        }, 'Dados Base64 não correspondem a um PDF válido');
        return null;
      }

      this.logger.info({ 
        requestId, 
        nossoNumero: title.nossoNumero,
        pdfSize: buffer.length 
      }, 'PDF da segunda via obtido do Bradesco');

      return {
        buffer,
        mime: 'application/pdf',
        filename: `boleto-${title.nossoNumero}.pdf`,
      };
    } catch (error) {
      const statusCode = axios.isAxiosError(error) ? error.response?.status : undefined;
      
      this.logger.error({ 
        requestId,
        nossoNumero: title.nossoNumero,
        statusCode,
      }, 'Erro ao obter PDF da segunda via do Bradesco');

      // Se for 404, retornar null (não é erro fatal)
      if (statusCode === 404) {
        return null;
      }

      // Para outros erros, lançar exceção
      const errorMessage = error instanceof Error ? error.message : 'Erro ao obter PDF';
      throw new BradescoError(
        `Falha ao obter PDF da segunda via: ${errorMessage}`,
        statusCode
      );
    }
  }

  /**
   * Obtém os dados de um título para geração de PDF
   */
  async getSecondCopyData(title: Title): Promise<BankDataResult | null> {
    const requestId = crypto.randomUUID();

    try {
      const token = await this.getAuthToken();

      const apiPrefix = this.config.bradescoApiPrefix || '/v1/boleto';
      const response = await this.api.post<{ resultado?: BradescoTituloResponse }>(
        `${apiPrefix}/titulo-consultar`,
        {
          nossoNumero: title.nossoNumero,
        },
        {
          headers: this.buildBradescoHeaders(token, requestId),
        }
      );

      const resultado = response.data?.resultado;

      if (!resultado) {
        this.logger.warn({ 
          requestId, 
          nossoNumero: title.nossoNumero 
        }, 'Resultado não encontrado na resposta');
        return null;
      }

      // Validar campos obrigatórios
      if (!resultado.nossoNumero) {
        this.logger.warn({ 
          requestId, 
          nossoNumero: title.nossoNumero 
        }, 'Dados do boleto incompletos (nossoNumero ausente)');
        return null;
      }

      // Extrair linha digitável e código de barras
      const linhaDigitavel = resultado.linhaDigitavel || '';
      const codigoBarras = resultado.codigoBarras || '';
      
      const valor = resultado.valor || title.valor || 0;
      const vencimento = resultado.dataVencimento 
        ? new Date(resultado.dataVencimento)
        : title.vencimento || new Date();

      this.logger.info({ 
        requestId, 
        nossoNumero: title.nossoNumero 
      }, 'Dados do boleto obtidos do Bradesco');

      return {
        nossoNumero: String(resultado.nossoNumero),
        linhaDigitavel,
        codigoBarras,
        valor,
        vencimento,
        beneficiario: undefined,
        pagador: undefined,
      };
    } catch (error) {
      const statusCode = axios.isAxiosError(error) ? error.response?.status : undefined;
      
      this.logger.error({ 
        requestId,
        nossoNumero: title.nossoNumero,
        statusCode,
      }, 'Erro ao obter dados do boleto do Bradesco');

      // Se for 404, retornar null (não é erro fatal)
      if (statusCode === 404) {
        return null;
      }

      // Para outros erros, lançar exceção
      const errorMessage = error instanceof Error ? error.message : 'Erro ao obter dados';
      throw new BradescoError(
        `Falha ao obter dados do boleto: ${errorMessage}`,
        statusCode
      );
    }
  }

  /**
   * Busca boletos por CPF (implementação de BradescoPort)
   * 
   * Usa POST {BRADESCO_BASE_URL}{BRADESCO_API_PREFIX}/listar-titulo-pendente
   */
  async buscarBoletosPorCPF(cpf: string, requestId: string, params?: BuscarBoletosPorCPFParams): Promise<BoletoBradesco[]> {
    try {
      // Validar CPF/CNPJ (normalizar e verificar tamanho)
      const cpfNormalized = cpf.replace(/\D/g, '');
      if (cpfNormalized.length < 11 || cpfNormalized.length > 14) {
        throw new Error('CPF/CNPJ deve ter entre 11 e 14 dígitos');
      }

      const token = await this.getAuthToken();

      const apiPrefix = this.config.bradescoApiPrefix || '/v1/boleto';
      
      // Montar body da requisição
      const body: Record<string, unknown> = {
        cpfCnpj: cpfNormalized,
      };

      // Adicionar parâmetros opcionais se fornecidos
      if (params?.codigoSituacao !== undefined) {
        body.codigoSituacao = params.codigoSituacao;
      }

      if (params?.dataInicio) {
        body.dataInicio = params.dataInicio;
      }

      if (params?.dataFim) {
        body.dataFim = params.dataFim;
      }

      const response = await this.api.post<{ resultado?: BoletoBradesco[] }>(
        `${apiPrefix}/listar-titulo-pendente`,
        body,
        {
          headers: this.buildBradescoHeaders(token, requestId),
        }
      );

      // A resposta pode ser um array direto ou um objeto com resultado
      const boletosArray = Array.isArray(response.data) 
        ? response.data 
        : response.data?.resultado || [];

      const boletos: BoletoBradesco[] = boletosArray.map(boleto => ({
        nossoNumero: boleto.nossoNumero || '',
        numeroDocumento: boleto.numeroDocumento || '',
        valor: boleto.valor || 0,
        vencimento: boleto.vencimento || '',
        situacao: boleto.situacao || '',
        bank: 'BRADESCO',
      }));

      // Não logar CPF completo (conforme regras LGPD)
      const cpfMasked = `***.***.***-${cpfNormalized.slice(-2)}`;
      this.logger.info({ 
        requestId, 
        count: boletos.length,
        cpfMasked
      }, 'Boletos encontrados no Bradesco');

      return boletos;
    } catch (error) {
      const statusCode = axios.isAxiosError(error) ? error.response?.status : undefined;
      
      // Não logar CPF completo (conforme regras LGPD)
      const cpfNormalized = cpf.replace(/\D/g, '');
      const cpfMasked = cpfNormalized.length === 11 
        ? `***.***.***-${cpfNormalized.slice(-2)}`
        : '***';
      
      this.logger.error({ 
        requestId, 
        cpfMasked,
        statusCode,
      }, 'Erro ao buscar boletos no Bradesco');

      const errorMessage = error instanceof Error ? error.message : 'Erro ao buscar boletos';
      throw new BradescoError(
        `Falha ao buscar boletos: ${errorMessage}`,
        statusCode
      );
    }
  }
}
