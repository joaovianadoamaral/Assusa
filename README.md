# Assusa - Chatbot WhatsApp para 2ª Via de Boletos

Sistema de chatbot no WhatsApp para geração de 2ª via de boletos bancários usando a API do Sicoob, com compliance total à LGPD.

## 📋 Índice

- [Sobre](#sobre)
- [Arquitetura](#arquitetura)
- [Stack Tecnológica](#stack-tecnológica)
- [Funcionalidades](#funcionalidades)
- [Requisitos](#requisitos)
- [Instalação](#instalação)
- [Configuração](#configuração)
- [Uso](#uso)
- [LGPD e Segurança](#lgpd-e-segurança)
- [Testes](#testes)
- [Deploy](#deploy)
- [Estrutura do Projeto](#estrutura-do-projeto)

## 🎯 Sobre

O Assusa é um chatbot desenvolvido para WhatsApp que permite aos clientes solicitar a 2ª via de boletos bancários de forma rápida e segura. O sistema foi desenvolvido seguindo os princípios da **Clean Architecture** (Ports & Adapters) para garantir flexibilidade, testabilidade e fácil manutenção.

### Principais Características

- ✅ Compliance total com LGPD
- ✅ Arquitetura limpa e escalável
- ✅ Suporte a múltiplos canais (preparado para site/app/email)
- ✅ Suporte a múltiplos bancos (atualmente Sicoob)
- ✅ Observabilidade completa
- ✅ Testes automatizados
- ✅ Deploy no Google Cloud Run

## 🏗️ Arquitetura

O projeto segue a **Clean Architecture** (Ports & Adapters), dividida em camadas:

```
src/
├── domain/          # Regras de negócio puras (entities, value-objects, use-cases, ports)
├── application/     # Serviços, use-cases e ports de integrações externas
├── adapters/        # Implementações concretas (WhatsApp, Sicoob, Google, Redis, in-memory)
└── infrastructure/  # Configuração, logging, segurança
```

### Camadas

1. **Domain** (`domain/`): 
   - Entidades de domínio
   - Value Objects (CPF, etc.)
   - Ports puramente de domínio (raros, durante migração gradual)

2. **Application** (`application/`): 
   - Serviços que orquestram os casos de uso (ApplicationService, WhatsappRouter)
   - Use Cases da camada de aplicação (ShowMenu, StartSecondCopyFlow, GenerateSecondCopy, DeleteData, etc.)
   - **Ports de integrações externas** (`application/ports/driven/`): Interfaces de integrações (WhatsApp, Sicoob, Google Drive, Google Sheets, Redis, Logger, etc.)
   - DTOs

3. **Adapters** (`adapters/`): Implementações concretas das portas
   - http: Servidor Fastify
   - whatsapp: Adapter WhatsApp Cloud API
   - sicoob: Adapter Sicoob API
   - google: Adapters Google Drive/Sheets
   - redis: Adapter Redis (com fallback em memória)
   - in-memory: Implementações em memória para desenvolvimento/testes

4. **Infrastructure** (`infrastructure/`): Configuração, logging, segurança

### Organização dos Ports

**Importante**: Os ports de integrações externas estão localizados em `src/application/ports/driven/`, seguindo a arquitetura definida no projeto. Ports puramente de domínio (raros) podem estar em `src/domain/ports/` durante a migração gradual.

**Ports de integrações externas** (em `application/ports/driven/`):
- `WhatsAppPort`, `SicoobPort`, `DrivePort`, `SheetsPort`, `StoragePort`, `RateLimiter`, `Logger`, etc.

**Ports puramente de domínio** (raros, em `domain/ports/`):
- Abstrações genéricas como `Clock`, `IdGenerator`, `Hasher`, `RandomProvider`

Ver mais detalhes em `docs/adr/ADR-0001-ports-na-application.md`.

### Benefícios da Arquitetura

- **Desacoplamento**: Facilita a troca de implementações (ex: trocar Redis por Memcached)
- **Testabilidade**: Permite criar mocks facilmente
- **Extensibilidade**: Adicionar novos bancos ou canais é simples
- **Manutenibilidade**: Código organizado e fácil de entender

## 🛠️ Stack Tecnológica

- **Runtime**: Node.js 20+
- **Linguagem**: TypeScript
- **Framework HTTP**: Fastify
- **Validação**: Zod
- **Cache/Estado**: Redis (com fallback em memória)
- **Logging**: Pino (logs estruturados)
- **APIs Externas**:
  - WhatsApp Cloud API
  - Sicoob API
  - Google Drive API
  - Google Sheets API
- **Testes**: Vitest
- **Deploy**: Google Cloud Run

## ✨ Funcionalidades

### Fluxo Principal: Gerar 2ª Via de Boleto

1. Cliente envia mensagem no WhatsApp
2. Sistema apresenta menu interativo
3. Cliente seleciona "Gerar 2ª via de boleto"
4. Sistema exibe aviso LGPD
5. Cliente informa CPF
6. Sistema busca boletos no Sicoob
7. Se houver múltiplos boletos, cliente escolhe qual deseja
8. Cliente escolhe o formato da 2ª via:
   - **PDF**: Gera e envia PDF completo
   - **Código de barras**: Envia apenas o código de barras
   - **Linha digitável**: Envia apenas a linha digitável
9. Sistema processa a solicitação:
   - Para PDF: gera PDF, salva no Google Drive (pasta privada), registra no Sheets e envia via WhatsApp
   - Para código de barras/linha digitável: obtém dados do boleto, registra no Sheets e envia via WhatsApp
10. Solicitação é registrada no Google Sheets com o tipo apropriado

### Outras Funcionalidades

- **Fale com a gente**: Exibe informações de contato
- **Acessar nosso site**: Exibe link do site
- **EXCLUIR DADOS (LGPD)**: Permite que o cliente solicite exclusão de todos os seus dados

## 📦 Requisitos

- Node.js 20 ou superior
- npm ou yarn
- Redis (opcional - tem fallback em memória)
- Contas/configurações:
  - WhatsApp Business Cloud API
  - Sicoob API (credenciais e certificados)
  - Google Cloud Project (com APIs habilitadas):
    - Google Drive API
    - Google Sheets API

## 🚀 Instalação

1. Clone o repositório:
```bash
git clone <repository-url>
cd assusa
```

2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente:
   - Copie o template de `docs/ENV_TEMPLATE.md` para um novo arquivo `.env` na raiz
   - Preencha todas as variáveis obrigatórias com seus valores reais
   - Valide a configuração: `npm run validate-config`

4. Compile o projeto:
```bash
npm run build
```

5. Execute o projeto:
```bash
npm start
```

Para desenvolvimento com hot-reload:
```bash
npm run dev
```

## ⚙️ Configuração

Crie um arquivo `.env` na raiz do projeto e configure as variáveis de ambiente abaixo.

**Nota**: Não existe um arquivo `.env.example` no projeto. Configure manualmente as variáveis necessárias.

### Variáveis de Ambiente

#### Servidor
- `NODE_ENV`: Ambiente (development/production/test)
- `PORT`: Porta do servidor (padrão: 3000)
- `HOST`: Host do servidor (padrão: 0.0.0.0)

#### WhatsApp Cloud API
- `WHATSAPP_API_TOKEN`: Token de acesso da API do WhatsApp
- `WHATSAPP_PHONE_NUMBER_ID`: ID do número de telefone no WhatsApp
- `WHATSAPP_VERIFY_TOKEN`: Token de verificação do webhook
- `WHATSAPP_WEBHOOK_URL`: URL pública do webhook (opcional)

#### Sicoob API (Cobrança Bancária v3)
- `SICOOB_CLIENT_ID`: Client ID da aplicação Sicoob (obrigatório)
- `SICOOB_CLIENT_SECRET`: Client Secret da aplicação Sicoob (obrigatório)
- `SICOOB_NUMERO_CLIENTE`: Número do cliente no Sicoob (obrigatório)
- `SICOOB_CODIGO_MODALIDADE`: Código da modalidade de cobrança (obrigatório)
- `SICOOB_BASE_URL`: URL base da API (padrão: `https://api.sicoob.com.br/cobranca-bancaria/v3`)
  - Para sandbox: `https://sandbox.sicoob.com.br/sicoob/sandbox/cobranca-bancaria/v3`
- `SICOOB_AUTH_TOKEN_URL`: URL de autenticação OAuth (padrão: `https://auth.sicoob.com.br/auth/realms/cooperado/protocol/openid-connect/token`)
- `SICOOB_NUMERO_CONTRATO_COBRANCA`: Número do contrato de cobrança (opcional)
- `SICOOB_CERTIFICATE_PATH`: Caminho do certificado SSL PEM (opcional, para mTLS)
- `SICOOB_KEY_PATH`: Caminho da chave privada SSL PEM (opcional, para mTLS)
- `SICOOB_CERT_PFX_BASE64`: Certificado PFX codificado em base64 (opcional, para mTLS)
- `SICOOB_CERT_PFX_PASSWORD`: Senha do certificado PFX (opcional, para mTLS)

#### Google APIs
- `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64`: Service Account JSON codificado em base64 (obrigatório)
- `GOOGLE_DRIVE_FOLDER_ID`: ID da pasta no Google Drive onde os PDFs serão salvos (obrigatório)
- `GOOGLE_SHEETS_SPREADSHEET_ID`: ID da planilha do Google Sheets (obrigatório)
- `GOOGLE_SHEETS_WORKSHEET_NAME`: Nome da aba na planilha (padrão: Requests)

**Nota**: Campos legados (`GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_PROJECT_ID`) são opcionais e mantidos apenas para compatibilidade durante migração.

#### Redis
- `REDIS_URL`: URL de conexão do Redis (ex: redis://localhost:6379)
- `REDIS_ENABLED`: Habilitar Redis (true/false, padrão: true)

#### Segurança & LGPD
- `CPF_PEPPER`: String secreta para hash do CPF (mínimo 32 caracteres) - **OBRIGATÓRIO**
- `ALLOW_RAW_CPF_IN_FILENAME`: Permitir CPF puro em nomes de arquivo (true/false, padrão: false)
- `DATA_RETENTION_DAYS`: Dias de retenção de dados (padrão: 90)

#### Observabilidade
- `LOG_LEVEL`: Nível de log (fatal/error/warn/info/debug/trace, padrão: info)
- `SERVICE_NAME`: Nome do serviço para logs (padrão: assusa)

#### Rate Limiting
- `RATE_LIMIT_MAX_REQUESTS`: Máximo de requisições por janela (padrão: 100)
- `RATE_LIMIT_WINDOW_MS`: Janela de tempo em milissegundos (padrão: 60000 = 1 minuto)

#### Conversation State
- `CONVERSATION_STATE_TTL_SECONDS`: TTL do estado da conversa em segundos (padrão: 900 = 15 minutos)

### Configuração do WhatsApp

1. Configure o webhook no WhatsApp Business:
   - URL: `https://seu-dominio.com/webhook`
   - Método: GET (para verificação) e POST (para mensagens)
   - Token de verificação: Use o valor de `WHATSAPP_VERIFY_TOKEN`

### Configuração do Google Cloud

#### 1. Criar Service Account

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/)
2. Crie um projeto ou selecione um existente
3. Vá em **IAM & Admin** > **Service Accounts**
4. Clique em **Create Service Account**
5. Preencha os dados e crie a service account
6. Clique na service account criada e vá em **Keys** > **Add Key** > **Create new key**
7. Selecione **JSON** e baixe o arquivo

#### 2. Habilitar APIs

1. No Google Cloud Console, vá em **APIs & Services** > **Library**
2. Habilite as seguintes APIs:
   - **Google Drive API**
   - **Google Sheets API**

#### 3. Codificar Service Account JSON em Base64

1. Abra o arquivo JSON baixado
2. Codifique o conteúdo completo em base64:

```bash
# Linux/Mac
cat service-account.json | base64 -w 0

# Windows (PowerShell)
[Convert]::ToBase64String([System.IO.File]::ReadAllBytes("service-account.json"))
```

3. Copie o resultado e configure a variável `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64`

#### 4. Configurar Pasta Privada no Google Drive

1. Acesse o [Google Drive](https://drive.google.com/)
2. Crie uma nova pasta (ou use uma existente) para armazenar os PDFs
3. Clique com o botão direito na pasta > **Compartilhar**
4. Adicione o email da service account (encontrado no campo `client_email` do JSON) com permissão de **Editor**
5. **Importante**: Não torne a pasta pública. Mantenha apenas a service account e membros da equipe com acesso
6. Para obter o **Folder ID**:
   - Abra a pasta no Google Drive
   - O ID está na URL: `https://drive.google.com/drive/folders/FOLDER_ID_AQUI`
   - Copie o `FOLDER_ID_AQUI` e configure em `GOOGLE_DRIVE_FOLDER_ID`

#### 5. Configurar Planilha do Google Sheets

1. Crie uma nova planilha no Google Sheets (ou use uma existente)
2. Compartilhe a planilha com o email da service account com permissão de **Editor**
3. Para obter o **Spreadsheet ID**:
   - Abra a planilha
   - O ID está na URL: `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID_AQUI/edit`
   - Copie o `SPREADSHEET_ID_AQUI` e configure em `GOOGLE_SHEETS_SPREADSHEET_ID`
4. Configure o nome da aba em `GOOGLE_SHEETS_WORKSHEET_NAME` (padrão: `Requests`)

#### Resumo das Variáveis

```env
GOOGLE_SERVICE_ACCOUNT_JSON_BASE64=<JSON codificado em base64>
GOOGLE_DRIVE_FOLDER_ID=<ID da pasta do Drive>
GOOGLE_SHEETS_SPREADSHEET_ID=<ID da planilha>
GOOGLE_SHEETS_WORKSHEET_NAME=Requests
```

### Configuração do Sicoob

O sistema usa a **API Cobrança Bancária v3** do Sicoob. Configure as seguintes variáveis:

#### Variáveis Obrigatórias

- `SICOOB_CLIENT_ID`: Client ID da API Sicoob
- `SICOOB_CLIENT_SECRET`: Client Secret da API Sicoob
- `SICOOB_NUMERO_CLIENTE`: Número do cliente no Sicoob
- `SICOOB_CODIGO_MODALIDADE`: Código da modalidade de cobrança

#### Variáveis Opcionais

- `SICOOB_BASE_URL`: URL base da API (padrão: `https://api.sicoob.com.br/cobranca-bancaria/v3`)
  - Para sandbox: `https://sandbox.sicoob.com.br/sicoob/sandbox/cobranca-bancaria/v3`
- `SICOOB_AUTH_TOKEN_URL`: URL de autenticação OAuth (padrão: `https://auth.sicoob.com.br/auth/realms/cooperado/protocol/openid-connect/token`)
- `SICOOB_NUMERO_CONTRATO_COBRANCA`: Número do contrato de cobrança (se aplicável)

#### Certificados SSL (mTLS)

Se a API do Sicoob exigir certificados SSL para autenticação mútua (mTLS), configure uma das opções:

**Opção 1: Certificado PFX em Base64 (recomendado)**
```env
SICOOB_CERT_PFX_BASE64=<certificado PFX codificado em base64>
SICOOB_CERT_PFX_PASSWORD=<senha do certificado PFX>
```

**Opção 2: Certificado PEM separado**
```env
SICOOB_CERTIFICATE_PATH=/caminho/para/cert.pem
SICOOB_KEY_PATH=/caminho/para/key.pem
```

#### Endpoints Utilizados

- **Autenticação**: `POST {SICOOB_AUTH_TOKEN_URL}` (OAuth Client Credentials)
- **Listar boletos por CPF**: `GET {SICOOB_BASE_URL}/pagadores/{cpf}/boletos`
- **Consultar boleto completo**: `GET {SICOOB_BASE_URL}/boletos?nossoNumero={nossoNumero}`
- **Segunda via com PDF**: `GET {SICOOB_BASE_URL}/boletos/segunda-via?gerarPdf=true&nossoNumero={nossoNumero}`
- **Dados do boleto**: `GET {SICOOB_BASE_URL}/boletos/segunda-via?gerarPdf=false&nossoNumero={nossoNumero}`

#### Fluxo de Requisições do Sicoob

O sistema obtém os identificadores dos boletos (`nossoNumero`) a partir do CPF informado pelo usuário através do seguinte fluxo:

**1. Usuário informa CPF**
- Entrada: apenas o CPF (11 dígitos)

**2. Listagem inicial de boletos (usa CPF)**
- **Endpoint**: `GET /pagadores/{cpf}/boletos`
- **Método**: `buscarBoletosPorCPF(cpf: string, requestId: string)`
- **Resposta**: Lista de boletos, cada um contendo:
  ```json
  {
    "nossoNumero": "12345678901234567",
    "numeroDocumento": "DOC001",
    "valor": 100.50,
    "vencimento": "2024-12-31",
    "situacao": "Aberto"
  }
  ```
- **Observação**: O `nossoNumero` é **extraído da resposta** desta chamada inicial

**3. Enriquecimento dos boletos (usa nossoNumero obtido da lista)**
- **Endpoint**: `GET /boletos?nossoNumero={nossoNumero}`
- **Método**: `consultarBoleto({ nossoNumero }, requestId)`
- **Quando**: Executado em paralelo para cada boleto encontrado na lista
- **Usa**: `nossoNumero` extraído da resposta do passo 2
- **Retorna**: Dados completos do boleto (pagador, histórico, QR Code, etc.)

**4. Geração da segunda via (usa nossoNumero obtido da lista)**
- **Endpoint**: `GET /boletos/segunda-via?nossoNumero={nossoNumero}&gerarPdf=true/false`
- **Métodos**: `getSecondCopyPdf(title)` / `getSecondCopyData(title)`
- **Quando**: Quando o usuário escolhe o formato (PDF, código de barras ou linha digitável)
- **Usa**: `title.nossoNumero` (obtido do passo 2, sem precisar do CPF novamente)
- **Retorna**: PDF ou dados atualizados do boleto

**Fluxo visual:**
```
1. Usuário informa CPF
   ↓
2. GET /pagadores/{cpf}/boletos
   ↓
3. Resposta: Lista de boletos [ { nossoNumero: "123...", ... }, ... ]
   ↓
4. Sistema extrai nossoNumero de cada boleto da lista
   ↓
5. Para cada nossoNumero extraído (em paralelo):
   ├─→ GET /boletos?nossoNumero={nossoNumero} (enriquecimento)
   └─→ GET /boletos/segunda-via?nossoNumero={nossoNumero} (gerar PDF)
```

**Resumo:**
- ✅ **CPF é necessário apenas para descobrir quais boletos existem** (passo 2)
- ✅ **Depois, todas as operações usam `nossoNumero`** extraído da lista inicial
- ✅ **O `nossoNumero` é obtido automaticamente** da resposta de `GET /pagadores/{cpf}/boletos`
- ✅ **Não é necessário que o usuário informe `nossoNumero`** - ele vem da resposta do Sicoob

#### Notas Importantes

- A API retorna PDF em Base64 no campo `pdfBoleto` da resposta JSON
- Todos os endpoints requerem o header `client_id` com o valor de `SICOOB_CLIENT_ID`
- O sistema converte automaticamente Base64 para Buffer quando necessário

### TitleRepository - Repositório de Títulos

O sistema suporta diferentes implementações do `TitleRepository` para buscar títulos:

#### 1. SicoobTitleRepositoryAdapter (Produção)

Implementação que busca títulos diretamente da API do Sicoob. Esta é a implementação padrão usada em produção.

#### 2. InMemoryTitleRepository (Desenvolvimento)

Implementação em memória para desenvolvimento e testes. Mantém um mapa `cpfHash -> Title[]` com dados de exemplo.

**Como usar:**

1. No arquivo `src/main.ts`, substitua a inicialização do `titleRepository`:

```typescript
// Em vez de:
const titleRepository = new SicoobTitleRepositoryAdapter(sicoobAdapter, logger);

// Use:
import { InMemoryTitleRepository } from './adapters/in-memory/in-memory-title-repository.js';
const titleRepository = new InMemoryTitleRepository(logger);
```

2. **Seed de Exemplo:**

O `InMemoryTitleRepository` já vem com dados de exemplo pré-configurados. Para obter os hashes reais dos CPFs de teste, use:

```typescript
import { CpfHandler } from './infrastructure/security/cpf-handler.js';

// Obter hash do CPF
const cpfHash = CpfHandler.hashCpf('12345678900');
console.log('Hash do CPF:', cpfHash);
```

3. **Adicionar Títulos Manualmente:**

Durante desenvolvimento, você pode adicionar títulos manualmente:

```typescript
const titleRepository = new InMemoryTitleRepository(logger);

// Adicionar títulos para um CPF
const cpfHash = CpfHandler.hashCpf('12345678900');
titleRepository.addTitles(cpfHash, [
  {
    id: crypto.randomUUID(),
    nossoNumero: '12345678901234567',
    contrato: 'CTR-2024-001',
    codigoBeneficiario: '123456',
    valor: 150.50,
    vencimento: new Date('2024-12-31'),
    status: 'OPEN',
  },
]);
```

**Estrutura dos Dados de Exemplo:**

- **CPF 1**: 1 título em aberto
- **CPF 2**: 3 títulos em aberto (para testar seleção múltipla)
- **CPF 3**: 0 títulos (para testar caso sem títulos)

**Importante**: Os hashes de exemplo no código são placeholders. Substitua pelos hashes reais usando `CpfHandler.hashCpf()`.

#### 3. GoogleSheetsTitleRepository (Opcional)

Implementação que lê títulos de uma planilha do Google Sheets. Útil para desenvolvimento ou quando não há integração com ERP.

**Configuração:**

1. Crie uma aba chamada "titles" na planilha configurada em `GOOGLE_SHEETS_SPREADSHEET_ID`
2. Configure a variável de ambiente (opcional):
   ```env
   GOOGLE_SHEETS_TITLES_WORKSHEET_NAME=titles
   ```

3. Estrutura da planilha (colunas A-G):
   - **A**: `cpf_hash` - Hash do CPF (SHA256 + pepper)
   - **B**: `nosso_numero` - Número do título
   - **C**: `contrato` - Número do contrato (opcional)
   - **D**: `codigo_beneficiario` - Código do beneficiário (opcional)
   - **E**: `valor` - Valor do título (opcional)
   - **F**: `vencimento` - Data de vencimento no formato ISO (opcional)
   - **G**: `status` - Status do título (OPEN, CLOSED, etc.)

4. O repositório filtra automaticamente apenas títulos com `status=OPEN`

5. **Cache**: O repositório usa cache de 5 minutos para reduzir custos de API do Google Sheets

**Exemplo de dados na planilha:**

| cpf_hash | nosso_numero | contrato | codigo_beneficiario | valor | vencimento | status |
|----------|--------------|----------|---------------------|-------|------------|--------|
| abc123... | 12345678901234567 | CTR-2024-001 | 123456 | 150.50 | 2024-12-31 | OPEN |
| abc123... | 12345678901234568 | CTR-2024-002 | 123456 | 250.75 | 2024-11-30 | OPEN |
| def456... | 98765432109876543 | CTR-2024-003 | 123456 | 350.00 | 2024-12-15 | CLOSED |

**Como usar:**

```typescript
import { GoogleSheetsTitleRepository } from './adapters/google/google-sheets-title-repository.js';
const titleRepository = new GoogleSheetsTitleRepository(config, logger);
```

## 💻 Uso

### Desenvolvimento Local

```bash
# Instalar dependências
npm install

# Rodar em modo desenvolvimento (com hot-reload)
npm run dev

# Compilar
npm run build

# Executar
npm start
```

### Testes

```bash
# Rodar testes
npm test

# Rodar testes com coverage
npm run test:coverage
```

### Health Check

```bash
curl http://localhost:3000/health
```

## 🔒 LGPD e Segurança

O projeto foi desenvolvido com foco total em compliance com a LGPD. As principais medidas implementadas:

### Proteção de Dados Sensíveis

1. **CPF Hash**: CPFs são armazenados apenas como hash SHA256 + pepper
2. **Máscara**: CPFs são mascarados em logs e interfaces (XXX.XXX.XXX-XX)
3. **Logs Sanitizados**: CPFs nunca aparecem em logs (são removidos/mascarados)
4. **Pasta Privada**: PDFs são salvos em pasta privada no Google Drive
5. **Política de Retenção**: Dados são retidos apenas pelo período configurado

### Funcionalidades LGPD

- **Minimização de Dados**: Apenas dados estritamente necessários são coletados
- **Comando EXCLUIR DADOS**: Cliente pode solicitar exclusão completa de seus dados
- **Auditoria**: Todas as operações são registradas no Google Sheets para auditoria

### Nomes de Arquivo

Por padrão, os arquivos no Drive **NÃO** contêm CPF puro. Isso é controlado pela variável `ALLOW_RAW_CPF_IN_FILENAME`:

- `false` (padrão): Nome do arquivo: `boleto-{nossoNumero}-{timestamp}.pdf`
- `true`: Nome do arquivo: `boleto-{nossoNumero}-{cpf}.pdf`

## 🧪 Testes

### Estrutura de Testes

```
tests/
├── unit/          # Testes unitários
└── integration/   # Testes de integração
```

### Executar Testes

```bash
# Todos os testes
npm test

# Com coverage
npm run test:coverage

# Apenas testes unitários
npm test -- tests/unit

# Apenas testes de integração
npm test -- tests/integration

# Validar configuração de variáveis de ambiente
npm run validate-config
```

### Scripts Disponíveis

- `npm run dev` - Desenvolvimento com hot-reload
- `npm run build` - Compilar TypeScript
- `npm start` - Executar versão compilada
- `npm test` - Executar testes
- `npm run test:coverage` - Testes com cobertura
- `npm run validate-config` - Validar variáveis de ambiente
- `npm run lint` - Verificar lint
- `npm run type-check` - Verificar tipos TypeScript

### Exemplos de Testes

- Validação de CPF (formato, dígitos verificadores)
- Hash de CPF com pepper
- Sanitização de logs
- Fluxo do WhatsApp Service
- Integrações com APIs externas (mocks)

## 🚢 Deploy

### Google Cloud Run

Este guia descreve o processo completo de deploy no Google Cloud Run.

#### 1. Pré-requisitos

- Conta no Google Cloud Platform (GCP)
- `gcloud` CLI instalado e configurado
- Projeto criado no GCP
- APIs habilitadas: Cloud Run API, Cloud Build API, Artifact Registry API (se usar Artifact Registry)

#### 2. Configurar gcloud CLI

```bash
# Autenticar
gcloud auth login

# Configurar projeto
gcloud config set project SEU_PROJECT_ID

# Verificar configuração
gcloud config list
```

#### 3. Habilitar APIs Necessárias

```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com
```

#### 4. Criar Artifact Registry (Opcional, mas Recomendado)

O Artifact Registry é o serviço moderno do GCP para armazenar imagens Docker. Alternativamente, você pode usar o Container Registry (GCR).

```bash
# Criar repositório no Artifact Registry
gcloud artifacts repositories create assusa-repo \
  --repository-format=docker \
  --location=us-central1 \
  --description="Repositório de imagens Docker do Assusa"

# Configurar autenticação Docker
gcloud auth configure-docker us-central1-docker.pkg.dev
```

**Nota**: Se preferir usar Container Registry (legacy), substitua `us-central1-docker.pkg.dev/SEU_PROJECT_ID/assusa-repo` por `gcr.io/SEU_PROJECT_ID/assusa` nos comandos abaixo.

#### 5. Build e Push da Imagem Docker

O projeto possui um Dockerfile multi-stage na raiz que:
- Faz build do TypeScript
- Instala apenas dependências de produção
- Configura usuário não-root para segurança
- Suporta PORT do Cloud Run (padrão 8080)

```bash
# Build e push usando Cloud Build
gcloud builds submit --tag us-central1-docker.pkg.dev/SEU_PROJECT_ID/assusa-repo/assusa:latest

# Ou, se usar Container Registry:
# gcloud builds submit --tag gcr.io/SEU_PROJECT_ID/assusa:latest
```

**Alternativa**: Build local e push manual:

```bash
# Build local
docker build -t us-central1-docker.pkg.dev/SEU_PROJECT_ID/assusa-repo/assusa:latest .

# Push
docker push us-central1-docker.pkg.dev/SEU_PROJECT_ID/assusa-repo/assusa:latest
```

#### 6. Deploy no Cloud Run

```bash
gcloud run deploy assusa \
  --image us-central1-docker.pkg.dev/SEU_PROJECT_ID/assusa-repo/assusa:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --timeout 300 \
  --concurrency 80
```

**Parâmetros importantes**:
- `--allow-unauthenticated`: Permite acesso público (necessário para webhook do WhatsApp)
- `--port 8080`: Porta padrão do Cloud Run (aplicação lê PORT automaticamente)
- `--memory 512Mi`: Memória alocada (ajuste conforme necessário)
- `--min-instances 0`: Escala para zero quando não há tráfego (reduz custos)
- `--timeout 300`: Timeout de 5 minutos (útil para gerar PDFs grandes)

#### 7. Configurar Variáveis de Ambiente

Você pode configurar as variáveis de ambiente de duas formas:

##### Opção A: Via gcloud CLI (Recomendado para desenvolvimento)

```bash
gcloud run services update assusa \
  --update-env-vars NODE_ENV=production,PORT=8080 \
  --region us-central1
```

Para múltiplas variáveis, crie um arquivo `.env` e use:

```bash
# Criar arquivo com variáveis (NÃO commitar este arquivo!)
gcloud run services update assusa \
  --update-env-vars-file .env.production \
  --region us-central1
```

##### Opção B: Via Secret Manager (Recomendado para produção)

O Secret Manager é mais seguro para dados sensíveis como tokens e chaves:

```bash
# Criar secret
echo -n "seu-valor-aqui" | gcloud secrets create whatsapp-api-token --data-file=-

# Dar permissão ao Cloud Run para acessar o secret
gcloud secrets add-iam-policy-binding whatsapp-api-token \
  --member="serviceAccount:SEU_PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Configurar variável de ambiente que referencia o secret
gcloud run services update assusa \
  --update-secrets WHATSAPP_API_TOKEN=whatsapp-api-token:latest \
  --region us-central1
```

**Variáveis obrigatórias**:

- `CPF_PEPPER` (use Secret Manager!)
- `WHATSAPP_API_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_VERIFY_TOKEN`
- `WHATSAPP_APP_SECRET`
- `SICOOB_CLIENT_ID`
- `SICOOB_CLIENT_SECRET`
- `SICOOB_NUMERO_CLIENTE`
- `SICOOB_CODIGO_MODALIDADE`
- `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64`
- `GOOGLE_DRIVE_FOLDER_ID`
- `GOOGLE_SHEETS_SPREADSHEET_ID`

**Variáveis opcionais** (com defaults):

- `NODE_ENV=production`
- `PORT=8080` (já configurado pelo Cloud Run)
- `REDIS_URL` (se usar Redis)
- `REDIS_ENABLED=true`

#### 8. Configurar Webhook do WhatsApp

Após o deploy, obtenha a URL do serviço:

```bash
gcloud run services describe assusa \
  --region us-central1 \
  --format 'value(status.url)'
```

**Configurar no Meta for Developers**:

1. Acesse [Meta for Developers](https://developers.facebook.com/)
2. Vá em **WhatsApp** > **Configuração** > **Webhooks**
3. Clique em **Configurar Webhooks**
4. Configure:
   - **URL de retorno de chamada**: `https://SEU_SERVICO.run.app/webhooks/whatsapp`
   - **Token de verificação**: Use o valor de `WHATSAPP_VERIFY_TOKEN`
   - **Campos de assinatura**: Marque `messages`
5. Salve e teste a verificação

**Importante**: Certifique-se de que a URL seja **pública** e **HTTPS**. O Cloud Run já fornece HTTPS automaticamente.

#### 9. Verificar Deploy

```bash
# Health check
curl https://SEU_SERVICO.run.app/health

# Resultado esperado:
# {"status":"ok","timestamp":"2024-01-12T18:00:00.000Z"}

# Ver logs
gcloud run services logs read assusa --region us-central1 --limit 50
```

#### 10. Monitoramento e Logs

- **Logs**: `gcloud run services logs read assusa --region us-central1`
- **Métricas**: Google Cloud Console > Cloud Run > assusa > Métricas
- **Alertas**: Configure alertas para taxa de erro e latência

**Nota**: O projeto já possui um Dockerfile multi-stage na raiz com healthcheck configurado e suporte a PORT do Cloud Run.

## 📁 Estrutura do Projeto

```
assusa/
├── src/
│   ├── domain/
│   │   ├── entities/          # Entidades de domínio (Boleto, Request, User, etc.)
│   │   ├── enums/             # Enumeradores (EventType, FlowType, RequestStatus)
│   │   ├── helpers/           # Helpers de domínio (LGPD helpers)
│   │   ├── ports/             # Ports puramente de domínio (durante migração gradual)
│   │   ├── use-cases/         # Use Cases de domínio (GerarSegundaVia, ExcluirDados)
│   │   └── value-objects/     # Value Objects (CPF)
│   ├── application/
│   │   ├── dtos/              # Data Transfer Objects
│   │   ├── ports/
│   │   │   └── driven/        # Ports de integrações externas (WhatsApp, Sicoob, Google, Redis, Logger, etc.)
│   │   ├── services/          # Serviços de aplicação (ApplicationService, WhatsappRouter)
│   │   └── use-cases/         # Use Cases da camada de aplicação (ShowMenu, StartSecondCopyFlow, etc.)
│   ├── adapters/
│   │   ├── http/              # Servidor Fastify
│   │   ├── whatsapp/          # Adapter WhatsApp Cloud API
│   │   ├── sicoob/            # Adapter Sicoob API
│   │   ├── google/            # Adapters Google Drive/Sheets
│   │   ├── redis/             # Adapter Redis (com fallback em memória)
│   │   └── in-memory/         # Implementações em memória (para desenvolvimento/testes)
│   ├── infrastructure/
│   │   ├── config/            # Configuração (loadConfig)
│   │   ├── logging/           # Logger (Pino)
│   │   └── security/          # Segurança/LGPD (CPF handler)
│   └── main.ts                # Entry point (bootstrap)
├── tests/
│   ├── unit/                  # Testes unitários
│   └── integration/           # Testes de integração
├── docker/                    # Dockerfile adicional
├── docs/                      # Documentação (ADRs)
├── Dockerfile                 # Dockerfile principal (multi-stage com healthcheck)
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

## 🔧 Troubleshooting

### Redis não disponível

O sistema tem fallback automático para memória quando Redis não está disponível. Um aviso será exibido nos logs.

### Erro de autenticação do Google

- Verifique se o `GOOGLE_PRIVATE_KEY` está corretamente formatado (com `\n` escapados)
- Confirme que a service account tem permissões necessárias
- Verifique se as APIs estão habilitadas no Google Cloud Console

### Erro de autenticação do Sicoob

- Verifique se `SICOOB_CLIENT_ID` e `SICOOB_CLIENT_SECRET` estão corretos
- Se usar certificados SSL, verifique os caminhos
- Confirme que as credenciais têm permissões necessárias

### CPF não encontrado

- Verifique se o CPF está sendo enviado corretamente
- Confirme que o hash está sendo gerado corretamente (mesmo pepper)
- Verifique a integração com a API do Sicoob

## 📝 Notas Importantes

1. **CPF_PEPPER**: Esta é uma variável crítica. Nunca compartilhe ou commite. Use um gerador de strings seguras (ex: `openssl rand -hex 32`).

2. **Logs**: CPFs nunca aparecem em logs. Se encontrar um CPF em logs, reporte imediatamente como bug de segurança.

3. **Google Drive**: A pasta configurada deve ser privada. Apenas a service account deve ter acesso.

4. **Redis**: Em produção, use sempre Redis. O fallback em memória é apenas para desenvolvimento.

5. **Sicoob API**: A implementação atual é um exemplo. Adapte conforme a documentação real da API do Sicoob.

## 🤝 Contribuindo

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT.

## 📞 Suporte

Para suporte, entre em contato através dos canais:

- **Email comercial:** [aguavaledoouro@gmail.com](mailto:aguavaledoouro@gmail.com)
- **Email técnico:** [joaovianaamr@gmail.com](mailto:joaovianaamr@gmail.com)
- **WhatsApp Assusa:**
  - (31) 8549-7547
  - (31) 3624-8550
- **WhatsApp suporte técnico:** (31) 99475-6008

---

**Desenvolvido com ❤️ seguindo as melhores práticas de Clean Architecture e LGPD.**
