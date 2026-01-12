import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import FormData from 'form-data';
import { WhatsAppPort, WhatsAppMessage, WhatsAppResponse } from '../../application/ports/driven/whatsapp-port.js';
import { Logger } from '../../application/ports/driven/logger-port.js';
import { Config } from '../../infrastructure/config/config.js';
import { withRetry } from '../../infrastructure/utils/retry-helper.js';

export class WhatsAppCloudApiAdapter implements WhatsAppPort {
  private api: AxiosInstance;
  private phoneNumberId: string;

  constructor(private config: Config, private logger: Logger) {
    this.phoneNumberId = config.whatsappPhoneNumberId;
    this.api = axios.create({
      baseURL: 'https://graph.facebook.com/v18.0',
      headers: {
        'Authorization': `Bearer ${config.whatsappApiToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async sendText(to: string, text: string, requestId: string): Promise<WhatsAppResponse> {
    return withRetry(
      async () => {
        const response = await this.api.post(`/${this.phoneNumberId}/messages`, {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: 'text',
          text: {
            preview_url: false,
            body: text,
          },
        }, {
          headers: {
            'X-Request-ID': requestId,
          },
        });

        this.logger.debug({ requestId, to, messageId: response.data.messages?.[0]?.id }, 'Mensagem de texto enviada');

        return {
          success: true,
          messageId: response.data.messages?.[0]?.id,
        };
      },
      {
        maxRetries: 3,
        initialDelayMs: 100,
        maxDelayMs: 2000,
      }
    ).catch((error) => {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao enviar mensagem';
      this.logger.error({ requestId, to, error: errorMessage }, 'Erro ao enviar mensagem WhatsApp');
      return {
        success: false,
        error: errorMessage,
      };
    });
  }

  async uploadMedia(buffer: Buffer, mimeType: string, filename: string, requestId: string): Promise<string> {
    return withRetry(
      async () => {
        const formData = new FormData();
        formData.append('file', buffer, {
          filename,
          contentType: mimeType,
        });
        formData.append('type', mimeType);
        formData.append('messaging_product', 'whatsapp');

        const response = await this.api.post(`/${this.phoneNumberId}/media`, formData, {
          headers: {
            'X-Request-ID': requestId,
            ...formData.getHeaders(),
          },
        });

        const mediaId = response.data.id;
        if (!mediaId) {
          throw new Error('Media ID não retornado');
        }

        this.logger.debug({ requestId, mediaId, filename }, 'Mídia enviada com sucesso');

        return mediaId;
      },
      {
        maxRetries: 3,
        initialDelayMs: 100,
        maxDelayMs: 2000,
      }
    ).catch((error) => {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao fazer upload de mídia';
      this.logger.error({ requestId, filename, error: errorMessage }, 'Erro ao fazer upload de mídia');
      throw new Error(`Falha ao fazer upload: ${errorMessage}`);
    });
  }

  async sendDocument(
    to: string,
    mediaId: string,
    filename: string,
    caption: string | undefined,
    requestId: string
  ): Promise<WhatsAppResponse> {
    return withRetry(
      async () => {
        const document: { id: string; filename: string; caption?: string } = {
          id: mediaId,
          filename,
        };
        if (caption) {
          document.caption = caption;
        }

        const response = await this.api.post(`/${this.phoneNumberId}/messages`, {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: 'document',
          document,
        }, {
          headers: {
            'X-Request-ID': requestId,
          },
        });

        this.logger.debug({ requestId, to, messageId: response.data.messages?.[0]?.id }, 'Documento enviado');

        return {
          success: true,
          messageId: response.data.messages?.[0]?.id,
        };
      },
      {
        maxRetries: 3,
        initialDelayMs: 100,
        maxDelayMs: 2000,
      }
    ).catch((error) => {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao enviar documento';
      this.logger.error({ requestId, to, error: errorMessage }, 'Erro ao enviar documento WhatsApp');
      return {
        success: false,
        error: errorMessage,
      };
    });
  }

  validateSignature(payload: string, signature: string, requestId: string): boolean {
    try {
      if (!signature) {
        this.logger.warn({ requestId }, 'Assinatura de webhook não fornecida');
        return false;
      }

      const hmac = crypto.createHmac('sha256', this.config.whatsappAppSecret);
      hmac.update(payload);
      const expectedHash = hmac.digest('hex');
      const expectedSignature = `sha256=${expectedHash}`;
      const isValid = signature === expectedSignature;
      
      if (!isValid) {
        this.logger.warn({ requestId }, 'Assinatura de webhook inválida');
      }
      
      return isValid;
    } catch (error) {
      this.logger.error({ requestId, error }, 'Erro ao validar assinatura');
      return false;
    }
  }

  // Métodos legados mantidos para compatibilidade
  async sendTextMessage(to: string, text: string, requestId: string): Promise<WhatsAppResponse> {
    return this.sendText(to, text, requestId);
  }

  async sendDocumentMessage(
    to: string,
    documentUrl: string,
    filename: string,
    requestId: string
  ): Promise<WhatsAppResponse> {
    try {
      const response = await this.api.post(`/${this.phoneNumberId}/messages`, {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'document',
        document: {
          link: documentUrl,
          filename,
        },
      }, {
        headers: {
          'X-Request-ID': requestId,
        },
      });

      this.logger.debug({ requestId, to, messageId: response.data.messages?.[0]?.id }, 'Documento enviado');

      return {
        success: true,
        messageId: response.data.messages?.[0]?.id,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao enviar documento';
      this.logger.error({ requestId, to, error: errorMessage }, 'Erro ao enviar documento WhatsApp');
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async handleWebhook(payload: unknown, requestId: string): Promise<WhatsAppMessage | null> {
    try {
      const body = payload as {
        entry?: Array<{
          changes?: Array<{
            value?: {
              messages?: Array<{
                from: string;
                text?: { body: string };
                id: string;
                timestamp: string;
              }>;
            };
          }>;
        }>;
      };

      if (!body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
        return null;
      }

      const message = body.entry[0].changes[0].value.messages[0];

      if (!message.text) {
        // Ignorar mensagens que não são texto
        return null;
      }

      return {
        from: message.from,
        message: message.text.body,
        messageId: message.id,
        timestamp: parseInt(message.timestamp),
      };
    } catch (error) {
      this.logger.error({ requestId, error }, 'Erro ao processar webhook WhatsApp');
      return null;
    }
  }

  validateWebhook(mode: string, token: string, challenge: string): string | null {
    if (mode === 'subscribe' && token === this.config.whatsappVerifyToken) {
      return challenge;
    }
    return null;
  }
}
