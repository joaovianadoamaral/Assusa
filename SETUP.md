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

**Opção A: Usar script de setup automático (recomendado)**

```bash
# No Windows (PowerShell)
.\setup.ps1

# No Linux/Mac
chmod +x setup.sh
./setup.sh
```

**Opção B: Configuração manual**

Copie o arquivo `.env.example` para `.env`:

```bash
# No Windows (PowerShell)
Copy-Item .env.example .env

# No Linux/Mac
cp .env.example .env
```

### 3. Preencher Variáveis de Ambiente

Abra o arquivo `.env` e preencha todas as variáveis necessárias.

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

### 7. Verificar se está funcionando

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
- Se usar certificados SSL, verifique os caminhos
- Confirme que as credenciais têm as permissões necessárias

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
