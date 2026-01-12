import { google, Auth } from 'googleapis';

/**
 * Helper: Autenticação Google usando Service Account
 * 
 * Singleton que decodifica GOOGLE_SERVICE_ACCOUNT_JSON_BASE64
 * e cria cliente autenticado reutilizável
 */
export class GoogleAuth {
  private static instance: GoogleAuth | null = null;
  private auth: Auth.GoogleAuth | null = null;
  private serviceAccountJson: Record<string, unknown> | null = null;

  private constructor() {
    // Construtor privado para garantir singleton
  }

  /**
   * Obtém instância singleton do GoogleAuth
   */
  static getInstance(): GoogleAuth {
    if (!GoogleAuth.instance) {
      GoogleAuth.instance = new GoogleAuth();
    }
    return GoogleAuth.instance;
  }

  /**
   * Decodifica GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 e retorna o JSON
   */
  private decodeServiceAccountJson(base64: string): Record<string, unknown> {
    try {
      const jsonString = Buffer.from(base64, 'base64').toString('utf-8');
      return JSON.parse(jsonString) as Record<string, unknown>;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao decodificar JSON';
      throw new Error(`Falha ao decodificar GOOGLE_SERVICE_ACCOUNT_JSON_BASE64: ${errorMessage}`);
    }
  }

  /**
   * Inicializa autenticação com Service Account JSON base64
   */
  initialize(serviceAccountJsonBase64: string, scopes: string[]): void {
    if (this.auth) {
      // Já inicializado, reutilizar
      return;
    }

    this.serviceAccountJson = this.decodeServiceAccountJson(serviceAccountJsonBase64);

    this.auth = new google.auth.GoogleAuth({
      credentials: this.serviceAccountJson,
      scopes,
    });
  }

  /**
   * Obtém cliente autenticado (reutiliza instância)
   */
  getAuthClient(): Auth.GoogleAuth {
    if (!this.auth) {
      throw new Error('GoogleAuth não foi inicializado. Chame initialize() primeiro.');
    }

    return this.auth;
  }

  /**
   * Obtém email da service account do JSON decodificado
   */
  getClientEmail(): string {
    if (!this.serviceAccountJson) {
      throw new Error('Service Account JSON não foi decodificado. Chame initialize() primeiro.');
    }

    const email = this.serviceAccountJson.client_email;
    if (typeof email !== 'string') {
      throw new Error('client_email não encontrado no Service Account JSON');
    }

    return email;
  }

  /**
   * Reseta instância (útil para testes)
   */
  static reset(): void {
    GoogleAuth.instance = null;
  }
}
