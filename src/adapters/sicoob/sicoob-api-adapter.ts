import axios, { AxiosInstance } from 'axios';
import https from 'https';
import fs from 'fs/promises';
import { SicoobPort } from '../../application/ports/driven/sicoob-port.js';
import { BoletoSicoob } from '../../domain/entities/boleto.js';
import { Logger } from '../../application/ports/driven/logger-port.js';
import { Config } from '../../infrastructure/config/config.js';

interface SicoobAuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

// Interface removida - não é mais usada diretamente
// A resposta de segunda via usa SicoobSegundaViaResponse

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

export class SicoobApiAdapter implements SicoobPort {
  private api: AxiosInstance;
  private authToken?: string;
  private tokenExpiresAt?: Date;

  constructor(private config: Config, private logger: Logger) {
    this.api = axios.create({
      baseURL: config.sicoobBaseUrl,
    });
  }

  private async getAuthToken(requestId: string): Promise<string> {
    // Verificar se token ainda é válido
    if (this.authToken && this.tokenExpiresAt && new Date() < this.tokenExpiresAt) {
      return this.authToken;
    }

    try {
      // Configurar certificado SSL se fornecido
      let httpsAgent: https.Agent | undefined;
      if (this.config.sicoobCertificatePath && this.config.sicoobKeyPath) {
        const cert = await fs.readFile(this.config.sicoobCertificatePath);
        const key = await fs.readFile(this.config.sicoobKeyPath);
        
        httpsAgent = new https.Agent({
          cert,
          key,
        });
      }

      // Usar URL de autenticação configurável (padrão: endpoint OAuth do Sicoob)
      const authUrl = this.config.sicoobAuthTokenUrl || 
        'https://auth.sicoob.com.br/auth/realms/cooperado/protocol/openid-connect/token';

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
          httpsAgent,
        }
      );

      this.authToken = response.data.access_token;
      // Expira 5 minutos antes do tempo real para evitar problemas
      this.tokenExpiresAt = new Date(Date.now() + (response.data.expires_in - 300) * 1000);

      this.logger.debug({ requestId }, 'Token Sicoob obtido com sucesso');

      return this.authToken;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao autenticar no Sicoob';
      this.logger.error({ requestId, error: errorMessage }, 'Erro ao autenticar no Sicoob');
      throw new Error(`Falha na autenticação Sicoob: ${errorMessage}`);
    }
  }

  async buscarBoletosPorCPF(_cpfHash: string, requestId: string): Promise<BoletoSicoob[]> {
    try {
      // NOTA: A API do Sicoob requer CPF/CNPJ real, não hash.
      // Este método recebe cpfHash, mas a API precisa do CPF original.
      // Em produção, seria necessário ter um sistema intermediário que mapeie
      // hash -> CPF (sem armazenar o CPF) ou usar outra estratégia.
      
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
      const errorMessage = error instanceof Error ? error.message : 'Erro ao buscar boletos';
      this.logger.error({ requestId, error: errorMessage }, 'Erro ao buscar boletos no Sicoob');
      throw new Error(`Falha ao buscar boletos: ${errorMessage}`);
    }
  }

  async gerarSegundaVia(nossoNumero: string, _cpfHash: string, requestId: string): Promise<Buffer> {
    try {
      const token = await this.getAuthToken(requestId);

      // Montar query params obrigatórios
      // NOTA: Este adapter legado não tem acesso direto às configs de numeroCliente, codigoModalidade
      // Em produção, seria necessário passar esses valores ou ajustar a arquitetura
      const queryParams: Record<string, string> = {
        nossoNumero,
        gerarPdf: 'true',
      };

      // Tentar obter configs se disponíveis (pode não estar disponível neste adapter legado)
      const numeroCliente = (this.config as unknown as { sicoobNumeroCliente?: string }).sicoobNumeroCliente;
      const codigoModalidade = (this.config as unknown as { sicoobCodigoModalidade?: string }).sicoobCodigoModalidade;
      const numeroContratoCobranca = (this.config as unknown as { sicoobNumeroContratoCobranca?: string }).sicoobNumeroContratoCobranca;

      if (numeroCliente) {
        queryParams.numeroCliente = numeroCliente;
      }
      if (codigoModalidade) {
        queryParams.codigoModalidade = codigoModalidade;
      }
      if (numeroContratoCobranca) {
        queryParams.numeroContratoCobranca = numeroContratoCobranca;
      }

      const clientId = this.config.sicoobClientId;

      // Usar GET /boletos/segunda-via com gerarPdf=true
      const response = await this.api.get<SicoobSegundaViaResponse>(
        '/boletos/segunda-via',
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'client_id': clientId,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'X-Request-ID': requestId,
          },
          params: queryParams,
        }
      );

      // Extrair pdfBoleto do resultado
      const pdfBase64 = response.data?.resultado?.pdfBoleto;
      
      if (!pdfBase64) {
        this.logger.warn({ requestId, nossoNumero }, 'PDF não encontrado na resposta da segunda via');
        throw new Error('PDF não encontrado na resposta da segunda via');
      }

      // Converter Base64 para Buffer
      const pdfBuffer = Buffer.from(pdfBase64, 'base64');

      // Verificar se a resposta é realmente um PDF
      const isPdf = pdfBuffer.slice(0, 4).toString() === '%PDF';
      if (!isPdf) {
        this.logger.warn({ requestId, nossoNumero }, 'Dados Base64 não correspondem a um PDF válido');
        throw new Error('Resposta da API não é um PDF válido');
      }

      this.logger.info({ requestId, nossoNumero, pdfSize: pdfBuffer.length }, 'PDF da 2ª via gerado (Base64 convertido)');

      return pdfBuffer;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao gerar 2ª via';
      this.logger.error({ requestId, nossoNumero, error: errorMessage }, 'Erro ao gerar PDF da 2ª via');
      throw new Error(`Falha ao gerar 2ª via: ${errorMessage}`);
    }
  }
}
