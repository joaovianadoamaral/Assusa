# Guia de Configuração Rápida - Assusa

Este guia ajudará você a configurar o projeto Assusa rapidamente.

## Pré-requisitos

1. **Node.js 20+** instalado
2. **npm** ou **yarn** instalado
3. **Git** instalado

## Passo a Passo

### 1. Instalar Dependências

```bash
npm install
```

### 2. Configurar Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto e copie o template de `docs/ENV_TEMPLATE.md`:

```bash
# No Windows (PowerShell)
# Copie o conteúdo de docs/ENV_TEMPLATE.md e crie o arquivo .env

# No Linux/Mac
cat docs/ENV_TEMPLATE.md | grep -A 1000 "^```env" | grep -B 1000 "^```$" | sed '1d;$d' > .env
```

**Alternativa:** Copie manualmente o conteúdo de `docs/ENV_TEMPLATE.md` (seção entre ```env e ```) para um novo arquivo `.env`.

### 3. Preencher Variáveis de Ambiente

Abra o arquivo `.env` e preencha todas as variáveis necessárias com seus valores reais.

#### Variáveis Obrigatórias

- `CPF_PEPPER`: Gere uma string segura aleatória:
  ```bash
  # No Windows (PowerShell)
  -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | % {[char]$_})
  
  # No Linux/Mac
  openssl rand -hex 32
  ```

- `WHATSAPP_API_TOKEN`: Token da API do WhatsApp Cloud API
- `WHATSAPP_PHONE_NUMBER_ID`: ID do número de telefone no WhatsApp
- `WHATSAPP_VERIFY_TOKEN`: Token de verificação do webhook (pode ser qualquer string)
- `SICOOB_CLIENT_ID`: Client ID da API Sicoob
- `SICOOB_CLIENT_SECRET`: Client Secret da API Sicoob
- `SICOOB_BASE_URL`: URL base da API Sicoob (padrão: `https://api.sicoob.com.br/cobranca-bancaria/v3`)
- `SICOOB_AUTH_TOKEN_URL`: URL de autenticação OAuth (padrão: `https://auth.sicoob.com.br/auth/realms/cooperado/protocol/openid-connect/token`)
- `SICOOB_NUMERO_CLIENTE`: Número do cliente no Sicoob (obrigatório)
- `SICOOB_CODIGO_MODALIDADE`: Código da modalidade de cobrança (obrigatório)
- `SICOOB_NUMERO_CONTRATO_COBRANCA`: Número do contrato de cobrança (opcional)
- `GOOGLE_CLIENT_EMAIL`: Email da service account do Google
- `GOOGLE_PRIVATE_KEY`: Chave privada da service account (substitua `\n` reais por `\n` na string)
- `GOOGLE_PROJECT_ID`: ID do projeto no Google Cloud
- `GOOGLE_DRIVE_FOLDER_ID`: ID da pasta no Google Drive
- `GOOGLE_SHEETS_SPREADSHEET_ID`: ID da planilha do Google Sheets

#### Variáveis Opcionais

- `REDIS_URL`: URL do Redis (padrão: redis://localhost:6379)
- `REDIS_ENABLED`: true/false (padrão: true)
- Se Redis não estiver disponível, o sistema usará fallback em memória automaticamente

### 4. Configurar Google Cloud

1. Crie um projeto no Google Cloud Console
2. Habilite as APIs:
   - Google Drive API
   - Google Sheets API
3. Crie uma Service Account
4. Baixe a chave JSON
5. Extraia `client_email` e `private_key` para o `.env`
6. Compartilhe a pasta do Drive e a planilha com o email da service account

### 5. Configurar WhatsApp

1. Configure o webhook no WhatsApp Business:
   - URL: `https://seu-dominio.com/webhook`
   - Método: GET (verificação) e POST (mensagens)
   - Token: Use o valor de `WHATSAPP_VERIFY_TOKEN`

### 6. Compilar e Executar

```bash
# Compilar
npm run build

# Executar
npm start
```

Para desenvolvimento com hot-reload:

```bash
npm run dev
```

### 7. Validar Configuração

Antes de iniciar o servidor, valide se todas as variáveis estão configuradas corretamente:

```bash
npm run validate-config
```

Este comando verifica:
- ✅ Todas as variáveis obrigatórias estão presentes
- ✅ Valores são válidos (formato, tamanho, etc.)
- ⚠️  Avisos sobre configurações opcionais recomendadas

### 8. Verificar se está funcionando

```bash
# Health check
curl http://localhost:3000/health
```

Deve retornar:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Troubleshooting

### Erros de TypeScript

Se você ver erros de tipo como "Cannot find module 'zod'", isso é normal antes de instalar as dependências. Execute:

```bash
npm install
```

### Redis não disponível

Se você não tiver Redis configurado, o sistema usará fallback em memória automaticamente. Você verá um aviso nos logs. Para produção, recomenda-se usar Redis.

### Erro de autenticação do Google

- Verifique se a `GOOGLE_PRIVATE_KEY` está correta (substitua `\n` reais por `\n` na string)
- Confirme que a service account tem as permissões necessárias
- Verifique se as APIs estão habilitadas no Google Cloud Console

### Erro de autenticação do Sicoob

- Verifique se `SICOOB_CLIENT_ID` e `SICOOB_CLIENT_SECRET` estão corretos
- Verifique se `SICOOB_NUMERO_CLIENTE` e `SICOOB_CODIGO_MODALIDADE` estão configurados
- Se usar certificados SSL, verifique os caminhos (`SICOOB_CERTIFICATE_PATH` e `SICOOB_KEY_PATH`, ou `SICOOB_CERT_PFX_BASE64` e `SICOOB_CERT_PFX_PASSWORD`)
- Confirme que as credenciais têm as permissões necessárias na API Cobrança Bancária v3
- Para sandbox, ajuste `SICOOB_BASE_URL` para `https://sandbox.sicoob.com.br/sicoob/sandbox/cobranca-bancaria/v3`

## Testes

```bash
# Executar testes
npm test

# Com coverage
npm run test:coverage
```

## Próximos Passos

1. Configure o webhook do WhatsApp apontando para seu servidor
2. Teste o fluxo completo enviando uma mensagem no WhatsApp
3. Configure monitoramento e alertas (logs, métricas)
4. Configure deploy contínuo (CI/CD)

## Suporte

Para mais informações, consulte o [README.md](README.md).
