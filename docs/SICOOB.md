# Documentação Sicoob Bank Provider

## 📋 Configurações Necessárias

### Variáveis de Ambiente Obrigatórias

```bash
# Autenticação OAuth2
SICOOB_CLIENT_ID=seu_client_id
SICOOB_CLIENT_SECRET=seu_client_secret
SICOOB_BASE_URL=https://api.sicoob.com.br  # URL base da API (opcional, tem default)
```

### Variáveis de Ambiente Opcionais (mTLS)

**Opção 1: Certificado PFX em Base64** (recomendado para produção)

```bash
SICOOB_CERT_PFX_BASE64=base64_do_certificado_pfx
SICOOB_CERT_PFX_PASSWORD=senha_do_certificado
```

**Opção 2: Certificado PEM Separado**

```bash
SICOOB_CERTIFICATE_PATH=/caminho/para/cert.pem
SICOOB_KEY_PATH=/caminho/para/key.pem
```

### Como Obter Certificado PFX em Base64

```bash
# Converter certificado PFX para base64
cat certificate.pfx | base64 -w 0

# No Windows (PowerShell)
[Convert]::ToBase64String([IO.File]::ReadAllBytes("certificate.pfx"))
```

### Dependência Opcional para PFX

Se usar `SICOOB_CERT_PFX_BASE64`, é necessário instalar `node-forge`:

```bash
npm install node-forge @types/node-forge
```

**Alternativa**: Converter PFX para PEM separado externamente:

```bash
# Extrair certificado
openssl pkcs12 -in certificate.pfx -out cert.pem -clcerts -nokeys

# Extrair chave privada
openssl pkcs12 -in certificate.pfx -out key.pem -nocerts -nodes
```

## 🔧 Checklist de Homologação

### 1. Configuração de Ambiente

- [ ] `SICOOB_CLIENT_ID` configurado
- [ ] `SICOOB_CLIENT_SECRET` configurado
- [ ] `SICOOB_BASE_URL` configurado (ou usando default)
- [ ] Certificado mTLS configurado (PFX ou PEM separado)
- [ ] Se usar PFX: `node-forge` instalado

### 2. Autenticação

- [ ] Token OAuth2 sendo obtido com sucesso
- [ ] Token sendo cacheado corretamente (expira -60s antes do tempo real)
- [ ] mTLS funcionando (se configurado)
- [ ] Erros de autenticação mapeados corretamente (`SICOOB_AUTH_FAILED`)

### 3. Endpoints

- [ ] **Ajustar rota de autenticação** conforme catálogo:
  - Localização: `src/adapters/sicoob/sicoob-bank-provider-adapter.ts`
  - Linha: ~205
  - TODO: `// TODO: Ajustar rota de autenticação conforme catálogo do Sicoob`

- [ ] **Ajustar rota de PDF** conforme catálogo:
  - Localização: `src/adapters/sicoob/sicoob-bank-provider-adapter.ts`
  - Linha: ~306
  - TODO: `// TODO: Ajustar rota conforme catálogo do Sicoob`
  - Exemplos comuns:
    - `GET /boletos/{nossoNumero}/pdf`
    - `GET /cobranca/boletos/{nossoNumero}/segunda-via`
    - `POST /boletos/segunda-via` com body `{ nossoNumero }`

- [ ] **Ajustar rota de consulta de dados** conforme catálogo:
  - Localização: `src/adapters/sicoob/sicoob-bank-provider-adapter.ts`
  - Linha: ~420
  - TODO: `// TODO: Ajustar rota conforme catálogo do Sicoob`
  - Exemplos comuns:
    - `GET /boletos/{nossoNumero}`
    - `GET /cobranca/boletos/{nossoNumero}`
    - `POST /boletos/consultar` com body `{ nossoNumero }`

### 4. Headers e Parâmetros

- [ ] **Verificar headers obrigatórios** conforme catálogo:
  - Localização: `src/adapters/sicoob/sicoob-bank-provider-adapter.ts`
  - Linhas: ~312, ~425
  - TODO: `// TODO: Adicionar headers exigidos conforme catálogo (ex: X-Cooperativa, X-Contrato)`
  - Possíveis headers:
    - `X-Cooperativa`: Código da cooperativa
    - `X-Contrato`: Número do contrato
    - `X-Beneficiario`: Código do beneficiário

- [ ] **Verificar se parâmetros são necessários na rota**:
  - Algumas APIs exigem `contrato`, `cooperativa` ou `beneficiario` na URL
  - Exemplo: `/boletos/{cooperativa}/{contrato}/{nossoNumero}/pdf`

### 5. Mapeamento de Campos

- [ ] **Ajustar interface `SicoobBoletoResponse`** conforme resposta real:
  - Localização: `src/adapters/sicoob/sicoob-bank-provider-adapter.ts`
  - Linha: ~39
  - TODO: `// TODO: Ajustar campos conforme catálogo da API do Sicoob`
  - Campos a verificar:
    - `linhaDigitavel`: Pode vir em campo diferente (ex: `linhaDigitavel`, `codigoBarras`, `codigoDeBarras`)
    - `beneficiario`: Estrutura pode variar
    - `pagador`: Estrutura pode variar
    - Campos adicionais exigidos pelo catálogo

- [ ] **Ajustar mapeamento de dados** em `getSecondCopyData()`:
  - Localização: `src/adapters/sicoob/sicoob-bank-provider-adapter.ts`
  - Linha: ~440
  - TODO: `// TODO: Mapear campos conforme estrutura real da API do Sicoob`

### 6. Tratamento de Erros

- [ ] Erros 401/403 mapeados para `SICOOB_AUTH_FAILED`
- [ ] Erros 404 mapeados para `SICOOB_NOT_FOUND` (retorna `null`, não é fatal)
- [ ] Erros 400 mapeados para `SICOOB_BAD_REQUEST`
- [ ] Erros 429 mapeados para `SICOOB_RATE_LIMIT`
- [ ] Outros erros mapeados para `SICOOB_UNKNOWN`
- [ ] Payloads brutos do banco **nunca** aparecem em logs (conforme LGPD)

### 7. Validação de PDF

- [ ] PDF retornado é válido (verifica assinatura `%PDF`)
- [ ] PDF inválido retorna `null` (não é erro fatal)
- [ ] Tamanho do PDF é logado (sem dados sensíveis)

### 8. Testes

- [ ] Teste de autenticação bem-sucedida
- [ ] Teste de cache de token (não reautentica se válido)
- [ ] Teste de expiração de token (reautentica quando expirado)
- [ ] Teste de obtenção de PDF bem-sucedida
- [ ] Teste de obtenção de dados bem-sucedida
- [ ] Teste de erro 404 (retorna `null`)
- [ ] Teste de erro de autenticação (lança `SicoobError`)
- [ ] Teste de mTLS (se configurado)

## 📍 Pontos de Ajuste no Código

### 1. Rotas da API

**Arquivo**: `src/adapters/sicoob/sicoob-bank-provider-adapter.ts`

| Função | Linha Aproximada | O que Ajustar |
|--------|------------------|---------------|
| `getAuthToken()` | ~205 | Rota de autenticação (`/auth/token`) |
| `getSecondCopyPdf()` | ~306 | Rota para obter PDF (`/boletos/{nossoNumero}/pdf`) |
| `getSecondCopyData()` | ~420 | Rota para consultar dados (`/boletos/{nossoNumero}`) |

### 2. Headers Obrigatórios

**Arquivo**: `src/adapters/sicoob/sicoob-bank-provider-adapter.ts`

| Função | Linha Aproximada | O que Ajustar |
|--------|------------------|---------------|
| `getSecondCopyPdf()` | ~312 | Headers adicionais (ex: `X-Cooperativa`, `X-Contrato`) |
| `getSecondCopyData()` | ~425 | Headers adicionais (ex: `X-Cooperativa`, `X-Contrato`) |

### 3. Estrutura de Dados

**Arquivo**: `src/adapters/sicoob/sicoob-bank-provider-adapter.ts`

| Interface/Tipo | Linha Aproximada | O que Ajustar |
|----------------|------------------|---------------|
| `SicoobBoletoResponse` | ~39 | Campos da resposta da API |
| `getSecondCopyData()` | ~440 | Mapeamento de campos da resposta |

### 4. Parâmetros de Rota

Se a API exigir parâmetros adicionais na URL (ex: `contrato`, `cooperativa`):

**Exemplo de ajuste necessário**:

```typescript
// Se a API exigir: /boletos/{cooperativa}/{contrato}/{nossoNumero}/pdf
const pdfUrl = `/boletos/${title.cooperativa}/${title.contrato}/${title.nossoNumero}/pdf`;
```

**Verificar se `Title` tem campos necessários**:
- Arquivo: `src/domain/entities/title.ts`
- Adicionar campos se necessário: `contrato`, `cooperativa`, `codigoBeneficiario`, etc.

## 🔍 Como Diagnosticar Problemas

### Logs a Observar

1. **Autenticação**:
   ```
   Token Sicoob obtido e cacheado
   Erro ao autenticar no Sicoob
   ```

2. **PDF**:
   ```
   PDF da segunda via obtido do Sicoob
   Resposta não é um PDF válido
   Erro ao obter PDF da segunda via do Sicoob
   ```

3. **Dados**:
   ```
   Dados do boleto obtidos do Sicoob
   Dados do boleto incompletos
   Linha digitável não encontrada nos dados do boleto
   Erro ao obter dados do boleto do Sicoob
   ```

### Códigos de Erro

| Código | Significado | Ação |
|--------|-------------|------|
| `SICOOB_AUTH_FAILED` | Falha na autenticação (401/403) | Verificar credenciais e certificado |
| `SICOOB_NOT_FOUND` | Recurso não encontrado (404) | Retorna `null` (não é fatal) |
| `SICOOB_BAD_REQUEST` | Requisição inválida (400) | Verificar parâmetros e formato |
| `SICOOB_RATE_LIMIT` | Rate limit excedido (429) | Implementar retry com backoff |
| `SICOOB_UNKNOWN` | Erro desconhecido | Verificar logs e catálogo da API |

### Testes Manuais

1. **Testar autenticação**:
   ```bash
   curl -X POST https://api.sicoob.com.br/auth/token \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "grant_type=client_credentials&client_id=XXX&client_secret=YYY"
   ```

2. **Testar obtenção de PDF** (com token):
   ```bash
   curl -X GET https://api.sicoob.com.br/boletos/{nossoNumero}/pdf \
     -H "Authorization: Bearer {token}"
   ```

3. **Testar consulta de dados** (com token):
   ```bash
   curl -X GET https://api.sicoob.com.br/boletos/{nossoNumero} \
     -H "Authorization: Bearer {token}"
   ```

## 📚 Referências

- Catálogo da API do Sicoob (documentação oficial)
- Especificação OAuth2 Client Credentials
- RFC 8446 (TLS 1.3) para mTLS

## ⚠️ Observações Importantes

1. **LGPD**: Payloads brutos do banco **nunca** devem aparecer em logs
2. **Token Caching**: Token expira 60 segundos antes do tempo real para evitar problemas
3. **mTLS**: Se usar PFX, instalar `node-forge` ou converter para PEM separado
4. **Erros 404**: Não são fatais - retornam `null` para permitir fallback
5. **TODOs**: Todos os pontos de ajuste estão marcados com `// TODO:` no código
