export interface WhatsAppMessage {
  from: string; // WhatsApp ID
  message: string;
  messageId: string;
  timestamp: number;
}

export interface WhatsAppResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface WhatsAppPort {
  sendTextMessage(to: string, text: string, requestId: string): Promise<WhatsAppResponse>;
  sendDocumentMessage(to: string, documentUrl: string, filename: string, requestId: string): Promise<WhatsAppResponse>;
  handleWebhook(payload: unknown, requestId: string): Promise<WhatsAppMessage | null>;
  validateWebhook(mode: string, token: string, challenge: string): string | null;
}
