import { z } from 'zod';

const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),

  // WhatsApp
  WHATSAPP_ACCESS_TOKEN: z.string().min(1),
  WHATSAPP_PHONE_NUMBER_ID: z.string().min(1),
  WHATSAPP_VERIFY_TOKEN: z.string().min(1),
  WHATSAPP_APP_SECRET: z.string().min(1),

  // Google
  GOOGLE_SERVICE_ACCOUNT_JSON_BASE64: z.string().min(1),
  GOOGLE_DRIVE_FOLDER_ID: z.string().min(1),
  GOOGLE_SHEETS_SPREADSHEET_ID: z.string().min(1),
  GOOGLE_SHEETS_TAB_NAME: z.string().default('logs'),

  // Sicoob
  SICOOB_BASE_URL: z.string().url().default('https://api.sicoob.com.br'),
  SICOOB_CLIENT_ID: z.string().min(1),
  SICOOB_CLIENT_SECRET: z.string().min(1),
  SICOOB_CERT_PFX_BASE64: z.string().optional(),
  SICOOB_CERT_PFX_PASSWORD: z.string().optional(),

  // Security & LGPD
  CPF_HASH_PEPPER: z.string().min(32, 'CPF_HASH_PEPPER deve ter pelo menos 32 caracteres'),
  ALLOW_RAW_CPF_IN_FILENAME: z.coerce.boolean().default(false),
  RETENTION_DAYS_PDF: z.coerce.number().int().positive().default(30),
  RETENTION_DAYS_LOG: z.coerce.number().int().positive().default(90),

  // Redis
  REDIS_URL: z.string().url().optional(),

  // Site
  SITE_URL: z.string().url().optional(),
  ENABLE_SITE_TOKEN: z.coerce.boolean().default(false),
  SITE_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(15),

  // Observability
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  SERVICE_NAME: z.string().default('assusa-api'),
});

export type Env = z.infer<typeof envSchema>;

let env: Env | null = null;

export function loadEnv(): Env {
  if (env) {
    return env;
  }

  try {
    env = envSchema.parse(process.env);
    return env;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join(', ');
      throw new Error(`❌ Configuração inválida. Variáveis faltando ou inválidas:\n${missingVars}`);
    }
    throw error;
  }
}

export function getEnv(): Env {
  if (!env) {
    return loadEnv();
  }
  return env;
}
