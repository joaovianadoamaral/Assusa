import axios, { AxiosInstance } from 'axios';
import https from 'https';
import crypto from 'crypto';
import fs from 'fs/promises';
import { BankProvider } from '../../application/ports/driven/bank-provider.port.js';
import { Title } from '../../domain/entities/title.js';
import { BankPdfResult } from '../../application/dtos/bank-pdf-result.dto.js';
import { BankDataResult } from '../../application/dtos/bank-data-result.dto.js';
import { Logger } from '../../application/ports/driven/logger-port.js';
import { Config } from '../../infrastructure/config/config.js';
import { SicoobErrorCode } from '../../domain/enums/sicoob-error-code.js';

/**
 * Erro customizado para erros do Sicoob
 */
export class SicoobError extends Error {
  constructor(
    message: string,
    public readonly code: SicoobErrorCode,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = 'SicoobError';
  }
}

/**
 * Resposta de autenticação do Sicoob
 */
interface SicoobAuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

/**
 * Resposta de consulta de boleto do Sicoob
 * TODO: Ajustar campos conforme catálogo da API do Sicoob
 */
interface SicoobBoletoResponse {
  nossoNumero: string;
  numeroDocumento?: string;
  valor: number;
  dataVencimento?: string;
  situacao?: string;
  linhaDigitavel?: string;
  codigoBarras?: string;
  beneficiario?: {
    nome?: string;
    documento?: string;
  };
  pagador?: {
    nome?: string;
    documento?: string;
  };
  // TODO: Adicionar campos exigidos conforme catálogo (beneficiário/contrato/cooperativa)
  [key: string]: unknown;
}

/**
 * Adapter: Provedor de Banco usando Sicoob
 * 
 * Implementa BankProvider usando a API do Sicoob com:
 * - Autenticação OAuth2 com client credentials
 * - mTLS usando certificado PFX
 * - Token caching com expiração antecipada (-60s)
 * - Mapeamento de erros para códigos internos
 */
export class SicoobBankProviderAdapter implements BankProvider {
  private api: AxiosInstance;
  private authToken?: string;
  private tokenExpiresAt?: Date;
  private httpsAgent?: https.Agent;

  constructor(
    private config: Config,
    private logger: Logger
  ) {
    this.api = axios.create({
      baseURL: config.sicoobBaseUrl,
    });

    // Configurar HTTPS Agent com mTLS se certificado PFX fornecido
    this.setupHttpsAgent();
  }

  /**
   * Configura HTTPS Agent com mTLS
   * 
   * Suporta duas formas:
   * 1. Certificado PFX em base64 (SICOOB_CERT_PFX_BASE64 + SICOOB_CERT_PFX_PASSWORD)
   * 2. Certificado PEM separado (SICOOB_CERTIFICATE_PATH + SICOOB_KEY_PATH)
   * 
   * Prioridade: PFX > PEM separado
   */
  private setupHttpsAgent(): void {
    // Tentar usar PFX primeiro
    if (this.config.sicoobCertPfxBase64 && this.config.sicoobCertPfxPassword) {
      try {
        this.httpsAgent = this.createHttpsAgentFromPfx(
          this.config.sicoobCertPfxBase64,
          this.config.sicoobCertPfxPassword
        );
        this.logger.debug({}, 'HTTPS Agent configurado com certificado PFX');
        return;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erro ao converter PFX';
        this.logger.warn({ error: errorMessage }, 'Falha ao configurar mTLS com PFX, tentando PEM separado');
      }
    }

    // Tentar usar PEM separado (será carregado de forma lazy na primeira requisição)
    if (this.config.sicoobCertificatePath && this.config.sicoobKeyPath) {
      this.logger.debug({}, 'Certificado PEM separado configurado (será carregado na primeira requisição)');
      // this.httpsAgent será configurado em ensureHttpsAgent() se necessário
    }

    this.logger.debug({}, 'mTLS desabilitado (nenhum certificado fornecido)');
  }

  /**
   * Cria HTTPS Agent a partir de certificado PFX
   * 
   * TODO: Requer biblioteca node-forge para conversão de PFX
   * Instalar: npm install node-forge @types/node-forge
   * 
   * Alternativa: Converter PFX para PEM separado externamente:
   * openssl pkcs12 -in certificate.pfx -out cert.pem -clcerts -nokeys
   * openssl pkcs12 -in certificate.pfx -out key.pem -nocerts -nodes
   */
  private createHttpsAgentFromPfx(pfxBase64: string, password: string): https.Agent {
    const pfxBuffer = Buffer.from(pfxBase64, 'base64');
    
    try {
      // Tentar usar node-forge se disponível
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const forge = require('node-forge');
      
      // Converter PFX para PEM
      const p12Asn1 = forge.asn1.fromDer(pfxBuffer.toString('binary'));
      const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);
      
      // Extrair certificado
      const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
      const certBag = certBags[forge.pki.oids.certBag]?.[0];
      if (!certBag) {
        throw new Error('Certificado não encontrado no PFX');
      }
      const certPem = forge.pki.certificateToPem(certBag.cert);
      
      // Extrair chave privada
      const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
      const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0];
      if (!keyBag) {
        throw new Error('Chave privada não encontrada no PFX');
      }
      const keyPem = forge.pki.privateKeyToPem(keyBag.key);
      
      return this.createHttpsAgent(certPem, keyPem);
    } catch (error) {
      if (error instanceof Error && error.message.includes('require')) {
        throw new Error(
          'node-forge não está instalado. ' +
          'Instale com: npm install node-forge @types/node-forge ' +
          'ou converta PFX para PEM separado e use SICOOB_CERTIFICATE_PATH/SICOOB_KEY_PATH'
        );
      }
      throw error;
    }
  }

  /**
   * Cria HTTPS Agent a partir de certificado e chave PEM
   * Método auxiliar para quando PFX já foi convertido
   */
  private createHttpsAgent(cert: string, key: string): https.Agent {
    return new https.Agent({
      cert,
      key,
      rejectUnauthorized: true, // Validar certificado do servidor
    });
  }

  /**
   * Garante que HTTPS Agent está configurado (carrega PEM separado se necessário)
   */
  private async ensureHttpsAgent(): Promise<void> {
    // Se já está configurado, não fazer nada
    if (this.httpsAgent) {
      return;
    }

    // Tentar carregar PEM separado se configurado
    if (this.config.sicoobCertificatePath && this.config.sicoobKeyPath) {
      try {
        const cert = await fs.readFile(this.config.sicoobCertificatePath, 'utf-8');
        const key = await fs.readFile(this.config.sicoobKeyPath, 'utf-8');
        this.httpsAgent = this.createHttpsAgent(cert, key);
        this.logger.debug({}, 'HTTPS Agent configurado com certificado PEM separado');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erro ao carregar certificado PEM';
        this.logger.error({ error: errorMessage }, 'Falha ao carregar certificado PEM separado');
        // Não lançar erro - permitir continuar sem mTLS
      }
    }
  }

  /**
   * Obtém token de autenticação OAuth2 com cache
   * 
   * Token expira 60 segundos antes do tempo real para evitar problemas
   */
  private async getAuthToken(): Promise<string> {
    // Garantir que HTTPS Agent está configurado
    await this.ensureHttpsAgent();
    // Verificar se token ainda é válido
    if (this.authToken && this.tokenExpiresAt && new Date() < this.tokenExpiresAt) {
      return this.authToken;
    }

    try {
      // TODO: Ajustar rota de autenticação conforme catálogo do Sicoob
      // Exemplos comuns: /auth/token, /oauth/token, /token
      const authUrl = `${this.config.sicoobBaseUrl}/auth/token`;

      const response = await axios.post<SicoobAuthResponse>(
        authUrl,
        new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.config.sicoobClientId,
          client_secret: this.config.sicoobClientSecret,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          httpsAgent: this.httpsAgent, // Usar mTLS se configurado
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
      }, 'Token Sicoob obtido e cacheado');

      return this.authToken;
    } catch (error) {
      const errorCode = this.mapErrorToCode(error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao autenticar no Sicoob';
      
      this.logger.error({ 
        error: errorMessage,
        code: errorCode 
      }, 'Erro ao autenticar no Sicoob');
      
      throw new SicoobError(
        `Falha na autenticação Sicoob: ${errorMessage}`,
        errorCode,
        this.getStatusCode(error)
      );
    }
  }

  /**
   * Mapeia erros HTTP para códigos internos do Sicoob
   */
  private mapErrorToCode(error: unknown): SicoobErrorCode {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      
      if (status === 401 || status === 403) {
        return SicoobErrorCode.SICOOB_AUTH_FAILED;
      }
      
      if (status === 404) {
        return SicoobErrorCode.SICOOB_NOT_FOUND;
      }
      
      if (status === 400) {
        return SicoobErrorCode.SICOOB_BAD_REQUEST;
      }
      
      if (status === 429) {
        return SicoobErrorCode.SICOOB_RATE_LIMIT;
      }
    }
    
    return SicoobErrorCode.SICOOB_UNKNOWN;
  }

  /**
   * Extrai status code HTTP de um erro
   */
  private getStatusCode(error: unknown): number | undefined {
    if (axios.isAxiosError(error)) {
      return error.response?.status;
    }
    return undefined;
  }

  /**
   * Obtém o PDF da segunda via de um título
   * 
   * TODO: Ajustar rota conforme catálogo do Sicoob
   * Exemplos comuns:
   * - GET /boletos/{nossoNumero}/pdf
   * - GET /cobranca/boletos/{nossoNumero}/segunda-via
   * - POST /boletos/segunda-via com body { nossoNumero }
   */
  async getSecondCopyPdf(title: Title): Promise<BankPdfResult | null> {
    const requestId = crypto.randomUUID();
    
    try {
      const token = await this.getAuthToken();

      // TODO: Ajustar rota conforme catálogo do Sicoob
      // TODO: Verificar se é necessário passar contrato/cooperativa/beneficiário na rota ou headers
      const pdfUrl = `/boletos/${title.nossoNumero}/pdf`;

      const response = await this.api.get(pdfUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Request-ID': requestId,
          // TODO: Adicionar headers exigidos conforme catálogo (ex: X-Cooperativa, X-Contrato)
        },
        responseType: 'arraybuffer',
        httpsAgent: this.httpsAgent, // Usar mTLS se configurado
      });

      // Verificar se a resposta é realmente um PDF
      const buffer = Buffer.from(response.data);
      const isPdf = buffer.slice(0, 4).toString() === '%PDF';
      
      if (!isPdf) {
        this.logger.warn({ 
          requestId, 
          nossoNumero: title.nossoNumero,
          contentType: response.headers['content-type']
        }, 'Resposta não é um PDF válido');
        return null;
      }

      this.logger.info({ 
        requestId, 
        nossoNumero: title.nossoNumero,
        pdfSize: buffer.length 
      }, 'PDF da segunda via obtido do Sicoob');

      return {
        buffer,
        mime: 'application/pdf',
        filename: `boleto-${title.nossoNumero}.pdf`,
      };
    } catch (error) {
      const errorCode = this.mapErrorToCode(error);
      const statusCode = this.getStatusCode(error);
      
      // Não logar payload bruto do banco (conforme regras LGPD)
      this.logger.error({ 
        requestId,
        nossoNumero: title.nossoNumero,
        code: errorCode,
        statusCode,
        // Não incluir error.message completo se contiver dados sensíveis
      }, 'Erro ao obter PDF da segunda via do Sicoob');

      // Se for 404, retornar null (não é erro fatal)
      if (errorCode === SicoobErrorCode.SICOOB_NOT_FOUND) {
        return null;
      }

      // Para outros erros, lançar exceção
      const errorMessage = error instanceof Error ? error.message : 'Erro ao obter PDF';
      throw new SicoobError(
        `Falha ao obter PDF da segunda via: ${errorMessage}`,
        errorCode,
        statusCode
      );
    }
  }

  /**
   * Obtém os dados de um título para geração de PDF
   * 
   * TODO: Ajustar rota conforme catálogo do Sicoob
   * Exemplos comuns:
   * - GET /boletos/{nossoNumero}
   * - GET /cobranca/boletos/{nossoNumero}
   * - POST /boletos/consultar com body { nossoNumero }
   */
  async getSecondCopyData(title: Title): Promise<BankDataResult | null> {
    const requestId = crypto.randomUUID();

    try {
      const token = await this.getAuthToken();

      // TODO: Ajustar rota conforme catálogo do Sicoob
      // TODO: Verificar se é necessário passar contrato/cooperativa/beneficiário na rota ou headers
      const consultaUrl = `/boletos/${title.nossoNumero}`;

      const response = await this.api.get<SicoobBoletoResponse>(consultaUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Request-ID': requestId,
          // TODO: Adicionar headers exigidos conforme catálogo (ex: X-Cooperativa, X-Contrato)
        },
        httpsAgent: this.httpsAgent, // Usar mTLS se configurado
      });

      const boleto = response.data;

      // Validar campos obrigatórios
      if (!boleto.nossoNumero || !boleto.valor) {
        this.logger.warn({ 
          requestId, 
          nossoNumero: title.nossoNumero 
        }, 'Dados do boleto incompletos');
        return null;
      }

      // TODO: Mapear campos conforme estrutura real da API do Sicoob
      // Ajustar conforme catálogo (linhaDigitavel pode vir em campo diferente)
      const linhaDigitavel = boleto.linhaDigitavel || boleto.codigoBarras || '';
      
      if (!linhaDigitavel) {
        this.logger.warn({ 
          requestId, 
          nossoNumero: title.nossoNumero 
        }, 'Linha digitável não encontrada nos dados do boleto');
        // Não retornar null - tentar usar dados disponíveis
      }

      const vencimento = boleto.dataVencimento 
        ? new Date(boleto.dataVencimento)
        : title.vencimento || new Date();

      const beneficiario = boleto.beneficiario?.nome || undefined;
      const pagador = boleto.pagador?.nome || undefined;

      this.logger.info({ 
        requestId, 
        nossoNumero: title.nossoNumero 
      }, 'Dados do boleto obtidos do Sicoob');

      return {
        nossoNumero: boleto.nossoNumero,
        linhaDigitavel,
        valor: boleto.valor,
        vencimento,
        beneficiario,
        pagador,
      };
    } catch (error) {
      const errorCode = this.mapErrorToCode(error);
      const statusCode = this.getStatusCode(error);
      
      // Não logar payload bruto do banco (conforme regras LGPD)
      this.logger.error({ 
        requestId,
        nossoNumero: title.nossoNumero,
        code: errorCode,
        statusCode,
        // Não incluir error.message completo se contiver dados sensíveis
      }, 'Erro ao obter dados do boleto do Sicoob');

      // Se for 404, retornar null (não é erro fatal)
      if (errorCode === SicoobErrorCode.SICOOB_NOT_FOUND) {
        return null;
      }

      // Para outros erros, lançar exceção
      const errorMessage = error instanceof Error ? error.message : 'Erro ao obter dados';
      throw new SicoobError(
        `Falha ao obter dados do boleto: ${errorMessage}`,
        errorCode,
        statusCode
      );
    }
  }
}
