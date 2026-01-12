# Template de Variáveis de Ambiente

Este arquivo contém todas as variáveis de ambiente necessárias para o projeto Assusa.

**Como usar:**
1. Copie o conteúdo abaixo
2. Crie um arquivo `.env` na raiz do projeto
3. Cole o conteúdo e preencha com seus valores reais
4. **NUNCA** commite o arquivo `.env` no repositório!

```env
# ============================================
# ASSUSA - Configuração de Variáveis de Ambiente
# ============================================

# ============================================
# SERVIDOR
# ============================================
NODE_ENV=development
PORT=3000
HOST=0.0.0.0

# ============================================
# WHATSAPP CLOUD API
# ============================================
WHATSAPP_API_TOKEN=seu_token_da_api_whatsapp_aqui
WHATSAPP_PHONE_NUMBER_ID=seu_phone_number_id_aqui
WHATSAPP_VERIFY_TOKEN=seu_token_de_verificacao_aqui
WHATSAPP_APP_SECRET=seu_app_secret_aqui
WHATSAPP_WEBHOOK_URL=https://seu-dominio.com/webhooks/whatsapp

# ============================================
# SICOOB API (Cobrança Bancária v3)
# ============================================
# Obrigatórias
SICOOB_CLIENT_ID=seu_client_id_sicoob
SICOOB_CLIENT_SECRET=seu_client_secret_sicoob
SICOOB_NUMERO_CLIENTE=seu_numero_cliente
SICOOB_CODIGO_MODALIDADE=seu_codigo_modalidade

# Opcionais (com valores padrão)
SICOOB_BASE_URL=https://api.sicoob.com.br/cobranca-bancaria/v3
SICOOB_AUTH_TOKEN_URL=https://auth.sicoob.com.br/auth/realms/cooperado/protocol/openid-connect/token
SICOOB_NUMERO_CONTRATO_COBRANCA=

# Certificados SSL para mTLS (opcional)
SICOOB_CERT_PFX_BASE64=
SICOOB_CERT_PFX_PASSWORD=
SICOOB_CERTIFICATE_PATH=
SICOOB_KEY_PATH=

# ============================================
# GOOGLE CLOUD APIs
# ============================================
GOOGLE_SERVICE_ACCOUNT_JSON_BASE64=seu_json_base64_aqui
GOOGLE_DRIVE_FOLDER_ID=id_da_pasta_privada_no_drive
GOOGLE_SHEETS_SPREADSHEET_ID=id_da_planilha
GOOGLE_SHEETS_WORKSHEET_NAME=Requests

# ============================================
# REDIS (Cache/Estado)
# ============================================
REDIS_URL=redis://localhost:6379
REDIS_ENABLED=true

# ============================================
# SEGURANÇA & LGPD
# ============================================
CPF_PEPPER=gerar_string_segura_aleatoria_com_pelo_menos_32_caracteres_aqui
ALLOW_RAW_CPF_IN_FILENAME=false
DATA_RETENTION_DAYS=90

# ============================================
# OBSERVABILIDADE
# ============================================
LOG_LEVEL=info
SERVICE_NAME=assusa

# ============================================
# RATE LIMITING
# ============================================
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=60000

# ============================================
# CONVERSATION STATE
# ============================================
CONVERSATION_STATE_TTL_SECONDS=900
```

## Geração de CPF_PEPPER

O `CPF_PEPPER` é obrigatório e deve ter pelo menos 32 caracteres. Gere uma string segura:

**Linux/Mac:**
```bash
openssl rand -hex 32
```

**Windows PowerShell:**
```powershell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | % {[char]$_})
```

## Validação de Configuração

Após criar o arquivo `.env`, valide a configuração:

```bash
npm run validate-config
```

Este comando verifica se todas as variáveis obrigatórias estão configuradas e se os valores são válidos.

## Sandbox do Sicoob

Para testar sem afetar produção, use o ambiente sandbox:

```env
SICOOB_BASE_URL=https://sandbox.sicoob.com.br/sicoob/sandbox/cobranca-bancaria/v3
```

## Mais Informações

- Consulte `docs/SETUP.md` para instruções detalhadas
- Consulte `README.md` para visão geral do projeto
