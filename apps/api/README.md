# Assusa API

API do sistema Assusa - Chatbot WhatsApp para geração de 2ª via de boletos com compliance LGPD.

## 🏗️ Arquitetura

O projeto segue **Clean Architecture** (Ports & Adapters) com separação clara de responsabilidades:

```
apps/api/src/
├── config/          # Configuração da aplicação (env, logger)
├── domain/          # Regras de negócio puras (entities, ports, use-cases)
├── application/     # Casos de uso e orquestração
├── infrastructure/  # Implementações concretas (plugins, adapters)
├── interfaces/      # Camada de entrada (HTTP, WhatsApp webhooks)
│   ├── http/        # Fastify server e rotas HTTP
│   └── whatsapp/    # Handlers e adapters do WhatsApp
└── shared/          # Código compartilhado (errors, utils)
```

### Camadas

1. **Domain**: Entidades, portas (interfaces) e casos de uso - independente de frameworks
2. **Application**: Serviços que orquestram os casos de uso
3. **Infrastructure**: Implementações concretas (plugins Fastify, adapters externos)
4. **Interfaces**: Camada de entrada (HTTP server, webhooks)
5. **Shared**: Código compartilhado (erros customizados, utilities)

## 🚀 Como Rodar Local

### Pré-requisitos

- Node.js 20+ instalado
- npm ou yarn instalado

### 1. Instalar Dependências

```bash
npm install
```

### 2. Configurar Variáveis de Ambiente

Copie o arquivo `.env.example` para `.env`:

```bash
cp .env.example .env
```

Preencha todas as variáveis obrigatórias (veja seção [Variáveis de Ambiente](#variáveis-de-ambiente)).

### 3. Executar em Desenvolvimento

```bash
npm run dev
```

O servidor iniciará em `http://localhost:3000` com hot-reload habilitado.

### 4. Compilar e Executar em Produção

```bash
# Compilar
npm run build

# Executar
npm start
```

## 📋 Variáveis de Ambiente

### Obrigatórias

#### WhatsApp Cloud API
- `WHATSAPP_ACCESS_TOKEN`: Token de acesso da API do WhatsApp
- `WHATSAPP_PHONE_NUMBER_ID`: ID do número de telefone no WhatsApp
- `WHATSAPP_VERIFY_TOKEN`: Token de verificação do webhook
- `WHATSAPP_APP_SECRET`: Secret da aplicação WhatsApp

#### Google APIs
- `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64`: Service Account JSON codificado em base64
- `GOOGLE_DRIVE_FOLDER_ID`: ID da pasta no Google Drive para salvar PDFs
- `GOOGLE_SHEETS_SPREADSHEET_ID`: ID da planilha do Google Sheets para logs
- `GOOGLE_SHEETS_TAB_NAME`: Nome da aba na planilha (padrão: `logs`)

#### Sicoob API
- `SICOOB_CLIENT_ID`: Client ID da aplicação Sicoob
- `SICOOB_CLIENT_SECRET`: Client Secret da aplicação Sicoob
- `SICOOB_BASE_URL`: URL base da API Sicoob (padrão: `https://api.sicoob.com.br`)
- `SICOOB_CERT_PFX_BASE64`: Certificado PFX codificado em base64 (opcional)
- `SICOOB_CERT_PFX_PASSWORD`: Senha do certificado PFX (opcional)

#### Segurança & LGPD
- `CPF_HASH_PEPPER`: String secreta para hash do CPF (mínimo 32 caracteres)
  - Gerar: `openssl rand -hex 32` (Linux/Mac) ou `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

### Opcionais

- `NODE_ENV`: Ambiente (development/production/test, padrão: `development`)
- `PORT`: Porta do servidor (padrão: `3000`)
- `HOST`: Host do servidor (padrão: `0.0.0.0`)
- `ALLOW_RAW_CPF_IN_FILENAME`: Permitir CPF puro em nomes de arquivo (padrão: `false`)
- `RETENTION_DAYS_PDF`: Dias de retenção de PDFs (padrão: `30`)
- `RETENTION_DAYS_LOG`: Dias de retenção de logs (padrão: `90`)
- `REDIS_URL`: URL do Redis (opcional - se não fornecido, usa fallback em memória)
- `SITE_URL`: URL do site (opcional)
- `ENABLE_SITE_TOKEN`: Habilitar token para acesso ao site (padrão: `false`)
- `SITE_TOKEN_TTL_MINUTES`: TTL do token do site em minutos (padrão: `15`)
- `LOG_LEVEL`: Nível de log (fatal/error/warn/info/debug/trace, padrão: `info`)
- `SERVICE_NAME`: Nome do serviço para logs (padrão: `assusa-api`)

## 🧪 Testes

### Executar Testes

```bash
# Todos os testes
npm test

# Com coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### Estrutura de Testes

```
src/
├── **/*.test.ts       # Testes unitários
└── **/*.spec.ts       # Testes de integração
```

## 🔧 Scripts Disponíveis

- `npm run dev`: Executa em modo desenvolvimento com hot-reload (tsx watch)
- `npm run build`: Compila TypeScript para JavaScript (tsc)
- `npm start`: Executa a versão compilada (node dist/index.js)
- `npm test`: Executa testes com Vitest
- `npm run test:coverage`: Executa testes com coverage
- `npm run test:watch`: Executa testes em watch mode
- `npm run lint`: Verifica código com ESLint
- `npm run lint:fix`: Corrige problemas do ESLint automaticamente
- `npm run format`: Formata código com Prettier
- `npm run format:check`: Verifica formatação sem modificar arquivos
- `npm run type-check`: Verifica tipos TypeScript sem compilar

## 📦 Stack Tecnológica

- **Runtime**: Node.js 20+
- **Linguagem**: TypeScript 5.6+
- **Framework HTTP**: Fastify 4.x
- **Validação**: Zod 3.x
- **Logging**: Pino 9.x
- **Testes**: Vitest 2.x
- **Lint**: ESLint 9.x
- **Format**: Prettier 3.x

## 🏛️ Plugins Fastify

O servidor Fastify inclui os seguintes plugins e middlewares:

1. **@fastify/request-id**: Gera request ID único para cada requisição
2. **@fastify/request-context**: Contexto por requisição
3. **Error Handler**: Handler padronizado de erros (sem vazar stack em produção)
4. **Pino Logger**: Logs estruturados com sanitização de dados sensíveis

## 🛣️ Rotas

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "service": "assusa-api"
}
```

### GET /

Informações sobre a API.

**Response:**
```json
{
  "message": "Assusa API",
  "version": "1.0.0",
  "documentation": "/health"
}
```

## 🐳 Docker

### Build

```bash
docker build -f docker/Dockerfile -t assusa-api .
```

### Run

```bash
docker run -p 3000:3000 --env-file .env assusa-api
```

### Docker Compose (exemplo)

```yaml
version: '3.8'
services:
  api:
    build:
      context: .
      dockerfile: docker/Dockerfile
    ports:
      - "3000:3000"
    env_file:
      - apps/api/.env
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"]
      interval: 30s
      timeout: 3s
      retries: 3
```

## 🔒 Segurança & LGPD

- ✅ CPF armazenado apenas como hash SHA256 + pepper
- ✅ CPFs nunca aparecem em logs (são mascarados/removidos)
- ✅ Nomes de arquivo não contêm CPF puro por padrão
- ✅ Error handler não vaza stack trace em produção
- ✅ Logs estruturados com sanitização de dados sensíveis
- ✅ Request ID para rastreamento e correlação
- ✅ Validação de variáveis de ambiente com Zod

## 📚 Estrutura de Arquivos

```
apps/api/
├── src/
│   ├── config/
│   │   ├── env.ts          # Carregamento e validação de variáveis de ambiente
│   │   └── logger.ts       # Configuração do logger Pino
│   ├── domain/             # Camada de domínio
│   │   ├── entities/       # Entidades de domínio
│   │   ├── ports/          # Interfaces (contratos)
│   │   └── use-cases/      # Casos de uso
│   ├── application/        # Camada de aplicação
│   │   └── services/       # Serviços de aplicação
│   ├── infrastructure/     # Camada de infraestrutura
│   │   └── plugins/        # Plugins Fastify
│   ├── interfaces/         # Camada de interfaces
│   │   ├── http/           # Servidor HTTP (Fastify)
│   │   │   ├── server.ts   # Criação e configuração do servidor
│   │   │   └── routes/     # Rotas HTTP
│   │   └── whatsapp/       # Interfaces WhatsApp
│   ├── shared/             # Código compartilhado
│   │   └── errors/         # Erros customizados
│   └── index.ts            # Entry point
├── dist/                   # Arquivos compilados (gerado)
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── .eslintrc.json
├── .prettierrc.json
├── .env.example
└── README.md
```

## 🔍 Path Aliases

O projeto usa path aliases configurados no `tsconfig.json`:

- `@/*` → `./src/*`
- `@/config/*` → `./src/config/*`
- `@/domain/*` → `./src/domain/*`
- `@/application/*` → `./src/application/*`
- `@/infrastructure/*` → `./src/infrastructure/*`
- `@/interfaces/*` → `./src/interfaces/*`
- `@/shared/*` → `./src/shared/*`

## 📝 Notas Importantes

1. **CPF_HASH_PEPPER**: Esta é uma variável crítica. Nunca compartilhe ou commite. Use um gerador de strings seguras.

2. **Google Service Account**: O JSON da service account deve ser codificado em base64. Use:
   ```bash
   cat service-account.json | base64 -w 0
   ```

3. **Sicoob Certificado**: Se usar certificado PFX, codifique em base64:
   ```bash
   cat certificate.pfx | base64 -w 0
   ```

4. **Logs**: CPFs nunca aparecem em logs. Se encontrar um CPF em logs, reporte imediatamente como bug de segurança.

5. **Error Handling**: Em produção, stack traces não são expostos ao cliente. Apenas mensagens genéricas são retornadas.

## 🤝 Contribuindo

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT.
