import axios, { AxiosInstance } from 'axios';
import https from 'https';
import crypto from 'crypto';
import fs from 'fs/promises';
import { BankProvider } from '../../application/ports/driven/bank-provider.port.js';
import { SicoobPort } from '../../application/ports/driven/sicoob-port.js';
import { Title } from '../../domain/entities/title.js';
import { BoletoSicoob } from '../../domain/entities/boleto.js';
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
 * Ajustado conforme API Cobrança Bancária v3
 */
interface SicoobBoletoResponse {
  resultado?: {
    nossoNumero?: string;
    numeroDocumento?: string;
    valor?: number;
    dataVencimento?: string;
    situacao?: string;
    linhaDigitavel?: string;
    codigoBarras?: string;
    pdfBoleto?: string; // Base64 quando gerarPdf=true
    beneficiario?: {
      nome?: string;
      documento?: string;
    };
    pagador?: {
      nome?: string;
      documento?: string;
    };
    [key: string]: unknown;
  };
  // Para compatibilidade com respostas que retornam array
  [key: string]: unknown;
}

/**
 * Resposta de segunda via do Sicoob (GET /boletos/segunda-via)
 */
interface SicoobSegundaViaResponse {
  resultado: {
    nossoNumero?: string;
    linhaDigitavel?: string;
    codigoBarras?: string;
    pdfBoleto?: string; // Base64 quando gerarPdf=true
    valor?: number;
    dataVencimento?: string;
    [key: string]: unknown;
  };
}

/**
 * Adapter: Provedor de Banco usando Sicoob
 * 
 * Implementa BankProvider e SicoobPort usando a API do Sicoob com:
 * - Autenticação OAuth2 com client credentials
 * - mTLS usando certificado PFX
 * - Token caching com expiração antecipada (-60s)
 * - Mapeamento de erros para códigos internos
 * 
 * Consolida toda a lógica de integração com Sicoob em um único adapter.
 */
export class SicoobBankProviderAdapter implements BankProvider, SicoobPort {
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
      // Usar URL de autenticação configurável (padrão: endpoint OAuth do Sicoob)
      const authUrl = this.config.sicoobAuthTokenUrl;

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
   * Usa GET /boletos/segunda-via com gerarPdf=true
   * Retorna JSON com campo pdfBoleto em Base64
   */
  async getSecondCopyPdf(title: Title): Promise<BankPdfResult | null> {
    const requestId = crypto.randomUUID();
    
    try {
      const token = await this.getAuthToken();

      // Montar query params obrigatórios
      const queryParams: Record<string, string> = {
        numeroCliente: this.config.sicoobNumeroCliente,
        codigoModalidade: this.config.sicoobCodigoModalidade,
        nossoNumero: title.nossoNumero,
        gerarPdf: 'true',
      };

      // Adicionar contrato se configurado
      if (this.config.sicoobNumeroContratoCobranca) {
        queryParams.numeroContratoCobranca = this.config.sicoobNumeroContratoCobranca;
      }

      const response = await this.api.get<SicoobSegundaViaResponse>(
        '/boletos/segunda-via',
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'client_id': this.config.sicoobClientId,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'X-Request-ID': requestId,
          },
          params: queryParams,
          httpsAgent: this.httpsAgent, // Usar mTLS se configurado
        }
      );

      // Extrair pdfBoleto do resultado
      const pdfBase64 = response.data?.resultado?.pdfBoleto;
      
      if (!pdfBase64) {
        this.logger.warn({ 
          requestId, 
          nossoNumero: title.nossoNumero
        }, 'PDF não encontrado na resposta da segunda via');
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
      }, 'PDF da segunda via obtido do Sicoob (Base64 convertido)');

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
   * Usa GET /boletos/segunda-via com gerarPdf=false para obter dados atualizados
   * Alternativamente, pode usar GET /boletos para consulta geral
   */
  async getSecondCopyData(title: Title): Promise<BankDataResult | null> {
    const requestId = crypto.randomUUID();

    try {
      const token = await this.getAuthToken();

      // Montar query params obrigatórios
      const queryParams: Record<string, string> = {
        numeroCliente: this.config.sicoobNumeroCliente,
        codigoModalidade: this.config.sicoobCodigoModalidade,
        nossoNumero: title.nossoNumero,
        gerarPdf: 'false',
      };

      // Adicionar contrato se configurado
      if (this.config.sicoobNumeroContratoCobranca) {
        queryParams.numeroContratoCobranca = this.config.sicoobNumeroContratoCobranca;
      }

      // Usar /boletos/segunda-via com gerarPdf=false para obter dados atualizados
      const response = await this.api.get<SicoobSegundaViaResponse>(
        '/boletos/segunda-via',
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'client_id': this.config.sicoobClientId,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'X-Request-ID': requestId,
          },
          params: queryParams,
          httpsAgent: this.httpsAgent, // Usar mTLS se configurado
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
      
      // Se não tiver linha digitável, tentar usar código de barras
      const linhaDigitavelFinal = linhaDigitavel || codigoBarras || '';
      
      if (!linhaDigitavelFinal) {
        this.logger.warn({ 
          requestId, 
          nossoNumero: title.nossoNumero 
        }, 'Linha digitável e código de barras não encontrados nos dados do boleto');
        // Não retornar null - tentar usar dados disponíveis
      }

      const valor = resultado.valor || title.valor || 0;
      const vencimento = resultado.dataVencimento 
        ? new Date(resultado.dataVencimento)
        : title.vencimento || new Date();

      this.logger.info({ 
        requestId, 
        nossoNumero: title.nossoNumero 
      }, 'Dados do boleto obtidos do Sicoob');

      return {
        nossoNumero: resultado.nossoNumero,
        linhaDigitavel: linhaDigitavelFinal,
        codigoBarras: resultado.codigoBarras,
        valor,
        vencimento,
        beneficiario: undefined,
        pagador: undefined,
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

  /**
   * Busca boletos por CPF hash (implementação de SicoobPort)
   * 
   * Usa GET /pagadores/{numeroCpfCnpj}/boletos
   * 
   * NOTA IMPORTANTE: A API do Sicoob requer CPF/CNPJ real, não hash.
   * Este método recebe cpfHash, mas a API precisa do CPF original.
   * Em produção, seria necessário ter um sistema intermediário que mapeie
   * hash -> CPF (sem armazenar o CPF) ou usar outra estratégia.
   * Por enquanto, este método está implementado conforme a rota correta,
   * mas requer adaptação para funcionar com hash.
   */
  async buscarBoletosPorCPF(cpfHash: string, requestId: string): Promise<BoletoSicoob[]> {
    try {
      const token = await this.getAuthToken();

      // NOTA: A API do Sicoob requer CPF/CNPJ real (11 ou 14 dígitos)
      // Como recebemos hash, precisaríamos de um mapeamento reverso
      // Por enquanto, vamos assumir que o sistema tem uma forma de obter o CPF original
      // sem armazená-lo permanentemente (ex: cache temporário durante o fluxo)
      
      // TODO: Implementar estratégia para obter CPF original a partir do hash
      // Por enquanto, lançar erro informativo
      throw new Error(
        'buscarBoletosPorCPF requer CPF original, não hash. ' +
        'Implementar estratégia de mapeamento hash->CPF temporário ou usar outra abordagem.'
      );

      // Código comentado para referência da rota correta:
      /*
      const cpfOriginal = await this.getCpfFromHash(cpfHash); // Método a ser implementado
      
      const response = await this.api.get<SicoobBoletoResponse[]>(
        `/pagadores/${cpfOriginal}/boletos`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'client_id': this.config.sicoobClientId,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'X-Request-ID': requestId,
          },
          params: {
            // Adicionar query params se necessário (contrato, modalidade, etc.)
            numeroContratoCobranca: this.config.sicoobNumeroContratoCobranca,
          },
          httpsAgent: this.httpsAgent,
        }
      );

      // A resposta pode ser um array direto ou um objeto com resultado
      const boletosArray = Array.isArray(response.data) 
        ? response.data 
        : (response.data as { resultado?: SicoobBoletoResponse[] }).resultado || [];

      const boletos: BoletoSicoob[] = boletosArray.map(boleto => {
        const resultado = boleto.resultado || boleto;
        return {
          nossoNumero: resultado.nossoNumero || '',
          numeroDocumento: resultado.numeroDocumento || '',
          valor: resultado.valor || 0,
          vencimento: resultado.dataVencimento || '',
          situacao: resultado.situacao || '',
        };
      });

      this.logger.info({ requestId, count: boletos.length }, 'Boletos encontrados no Sicoob');

      return boletos;
      */
    } catch (error) {
      const errorCode = this.mapErrorToCode(error);
      const statusCode = this.getStatusCode(error);
      
      // Não logar payload bruto do banco (conforme regras LGPD)
      this.logger.error({ 
        requestId, 
        cpfHash: cpfHash.slice(0, 8) + '...', // Log apenas hash parcial
        code: errorCode,
        statusCode,
      }, 'Erro ao buscar boletos no Sicoob');

      const errorMessage = error instanceof Error ? error.message : 'Erro ao buscar boletos';
      throw new SicoobError(
        `Falha ao buscar boletos: ${errorMessage}`,
        errorCode,
        statusCode
      );
    }
  }

  /**
   * Gera segunda via de boleto (implementação de SicoobPort)
   * 
   * Usa GET /boletos/segunda-via com gerarPdf=true
   * Este método é mantido para compatibilidade com SicoobPort.
   * Para novos usos, prefira getSecondCopyPdf() que retorna BankPdfResult.
   */
  async gerarSegundaVia(nossoNumero: string, _cpfHash: string, requestId: string): Promise<Buffer> {
    try {
      const token = await this.getAuthToken();

      // Montar query params obrigatórios
      const queryParams: Record<string, string> = {
        numeroCliente: this.config.sicoobNumeroCliente,
        codigoModalidade: this.config.sicoobCodigoModalidade,
        nossoNumero,
        gerarPdf: 'true',
      };

      // Adicionar contrato se configurado
      if (this.config.sicoobNumeroContratoCobranca) {
        queryParams.numeroContratoCobranca = this.config.sicoobNumeroContratoCobranca;
      }

      const response = await this.api.get<SicoobSegundaViaResponse>(
        '/boletos/segunda-via',
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'client_id': this.config.sicoobClientId,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'X-Request-ID': requestId,
          },
          params: queryParams,
          httpsAgent: this.httpsAgent, // Usar mTLS se configurado
        }
      );

      // Extrair pdfBoleto do resultado
      const pdfBase64 = response.data?.resultado?.pdfBoleto;
      
      if (!pdfBase64) {
        this.logger.warn({ 
          requestId, 
          nossoNumero
        }, 'PDF não encontrado na resposta da segunda via');
        throw new SicoobError(
          'PDF não encontrado na resposta da segunda via',
          SicoobErrorCode.SICOOB_BAD_REQUEST,
          response.status
        );
      }

      // Converter Base64 para Buffer
      const pdfBuffer = Buffer.from(pdfBase64, 'base64');

      // Verificar se a resposta é realmente um PDF
      const isPdf = pdfBuffer.slice(0, 4).toString() === '%PDF';
      if (!isPdf) {
        this.logger.warn({ 
          requestId, 
          nossoNumero
        }, 'Dados Base64 não correspondem a um PDF válido');
        throw new SicoobError(
          'Resposta da API não é um PDF válido',
          SicoobErrorCode.SICOOB_BAD_REQUEST,
          response.status
        );
      }

      this.logger.info({ requestId, nossoNumero, pdfSize: pdfBuffer.length }, 'PDF da 2ª via gerado (Base64 convertido)');

      return pdfBuffer;
    } catch (error) {
      const errorCode = this.mapErrorToCode(error);
      const statusCode = this.getStatusCode(error);
      
      // Não logar payload bruto do banco (conforme regras LGPD)
      this.logger.error({ 
        requestId, 
        nossoNumero, 
        code: errorCode,
        statusCode,
      }, 'Erro ao gerar PDF da 2ª via');

      const errorMessage = error instanceof Error ? error.message : 'Erro ao gerar 2ª via';
      
      // Se for SicoobError, relançar
      if (error instanceof SicoobError) {
        throw error;
      }
      
      throw new SicoobError(
        `Falha ao gerar 2ª via: ${errorMessage}`,
        errorCode,
        statusCode
      );
    }
  }
}
