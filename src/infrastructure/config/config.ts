import { z } from 'zod';

const configSchema = z.object({
  // Server
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  port: z.coerce.number().default(3000),
  host: z.string().default('0.0.0.0'),

  // WhatsApp
  whatsappApiToken: z.string().min(1),
  whatsappPhoneNumberId: z.string().min(1),
  whatsappVerifyToken: z.string().min(1),
  whatsappAppSecret: z.string().min(1),
  whatsappWebhookUrl: z.string().url().optional(),

  // Sicoob
  sicoobClientId: z.string().min(1),
  sicoobClientSecret: z.string().min(1),
  sicoobBaseUrl: z.string().url().default('https://api.sicoob.com.br/cobranca-bancaria/v3'),
  sicoobAuthTokenUrl: z.string().url().default('https://auth.sicoob.com.br/auth/realms/cooperado/protocol/openid-connect/token'),
  sicoobNumeroCliente: z.string().min(1),
  sicoobCodigoModalidade: z.string().min(1),
  sicoobNumeroContratoCobranca: z.string().optional(),
  sicoobCertificatePath: z.string().optional(),
  sicoobKeyPath: z.string().optional(),
  sicoobCertPfxBase64: z.string().optional(),
  sicoobCertPfxPassword: z.string().optional(),

  // Google
  googleServiceAccountJsonBase64: z.string().min(1),
  googleDriveFolderId: z.string().min(1),
  googleSheetsSpreadsheetId: z.string().min(1),
  googleSheetsWorksheetName: z.string().default('Requests'),
  // Campos legados (opcionais para compatibilidade durante migração)
  googleClientEmail: z.string().email().optional(),
  googlePrivateKey: z.string().min(1).optional(),
  googleProjectId: z.string().min(1).optional(),

  // Redis
  redisUrl: z.string().url().optional(),
  redisEnabled: z.coerce.boolean().default(true),

  // Security & LGPD
  cpfPepper: z.string().min(32, 'CPF_PEPPER deve ter pelo menos 32 caracteres'),
  allowRawCpfInFilename: z.coerce.boolean().default(false),
  dataRetentionDays: z.coerce.number().int().positive().default(90),

  // Observability
  logLevel: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  serviceName: z.string().default('assusa'),

  // Rate Limiting
  rateLimitMaxRequests: z.coerce.number().int().positive().default(100),
  rateLimitWindowMs: z.coerce.number().int().positive().default(60000),

  // Conversation State
  conversationStateTtlSeconds: z.coerce.number().int().positive().default(15 * 60), // 15 minutos
});

export type Config = z.infer<typeof configSchema>;

export function loadConfig(): Config {
  try {
    const config = {
      nodeEnv: process.env.NODE_ENV,
      port: process.env.PORT,
      host: process.env.HOST,
      whatsappApiToken: process.env.WHATSAPP_API_TOKEN,
      whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
      whatsappVerifyToken: process.env.WHATSAPP_VERIFY_TOKEN,
      whatsappAppSecret: process.env.WHATSAPP_APP_SECRET,
      whatsappWebhookUrl: process.env.WHATSAPP_WEBHOOK_URL,
      sicoobClientId: process.env.SICOOB_CLIENT_ID,
      sicoobClientSecret: process.env.SICOOB_CLIENT_SECRET,
      sicoobBaseUrl: process.env.SICOOB_BASE_URL,
      sicoobAuthTokenUrl: process.env.SICOOB_AUTH_TOKEN_URL,
      sicoobNumeroCliente: process.env.SICOOB_NUMERO_CLIENTE,
      sicoobCodigoModalidade: process.env.SICOOB_CODIGO_MODALIDADE,
      sicoobNumeroContratoCobranca: process.env.SICOOB_NUMERO_CONTRATO_COBRANCA,
      sicoobCertificatePath: process.env.SICOOB_CERTIFICATE_PATH,
      sicoobKeyPath: process.env.SICOOB_KEY_PATH,
      sicoobCertPfxBase64: process.env.SICOOB_CERT_PFX_BASE64,
      sicoobCertPfxPassword: process.env.SICOOB_CERT_PFX_PASSWORD,
      googleServiceAccountJsonBase64: process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64,
      googleDriveFolderId: process.env.GOOGLE_DRIVE_FOLDER_ID,
      googleSheetsSpreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
      googleSheetsWorksheetName: process.env.GOOGLE_SHEETS_WORKSHEET_NAME,
      // Campos legados (opcionais para compatibilidade durante migração)
      googleClientEmail: process.env.GOOGLE_CLIENT_EMAIL,
      googlePrivateKey: process.env.GOOGLE_PRIVATE_KEY,
      googleProjectId: process.env.GOOGLE_PROJECT_ID,
      redisUrl: process.env.REDIS_URL,
      redisEnabled: process.env.REDIS_ENABLED,
      cpfPepper: process.env.CPF_PEPPER,
      allowRawCpfInFilename: process.env.ALLOW_RAW_CPF_IN_FILENAME,
      dataRetentionDays: process.env.DATA_RETENTION_DAYS,
      logLevel: process.env.LOG_LEVEL,
      serviceName: process.env.SERVICE_NAME,
      rateLimitMaxRequests: process.env.RATE_LIMIT_MAX_REQUESTS,
      rateLimitWindowMs: process.env.RATE_LIMIT_WINDOW_MS,
      conversationStateTtlSeconds: process.env.CONVERSATION_STATE_TTL_SECONDS,
    };

    return configSchema.parse(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map((e) => e.path.map(String).join('.')).join(', ');
      throw new Error(`Configuração inválida. Variáveis faltando ou inválidas: ${missingVars}`);
    }
    throw error;
  }
}
