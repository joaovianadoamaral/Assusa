# TODO - Pendências do Projeto Assusa

Este arquivo lista todas as pendências, ajustes necessários e melhorias futuras do projeto.

**Última atualização**: 2024-12-19

---

## 🔴 CRÍTICO - Homologação Sicoob

### 1. Ajustar Rotas da API do Sicoob

**Arquivo**: `src/adapters/sicoob/sicoob-bank-provider-adapter.ts`

#### 1.1. Rota de Autenticação (Linha ~224)
- [ ] **TODO**: Ajustar rota de autenticação conforme catálogo do Sicoob
- **Localização**: `getAuthToken()` método privado
- **Código atual**: 
  ```typescript
  const authUrl = `${this.config.sicoobBaseUrl}/auth/token`;
  ```
- **Exemplos comuns**: `/auth/token`, `/oauth/token`, `/token`
- **Ação**: Consultar catálogo/documentação do Sicoob e ajustar conforme necessário

#### 1.2. Rota para Obter PDF (Linha ~325)
- [ ] **TODO**: Ajustar rota conforme catálogo do Sicoob
- **Localização**: `getSecondCopyPdf()` método
- **Código atual**:
  ```typescript
  const pdfUrl = `/boletos/${title.nossoNumero}/pdf`;
  ```
- **Exemplos comuns**: 
  - `GET /boletos/{nossoNumero}/pdf`
  - `GET /cobranca/boletos/{nossoNumero}/segunda-via`
  - `POST /boletos/segunda-via` com body `{ nossoNumero }`
- **Ação**: Verificar se é necessário passar `contrato/cooperativa/beneficiário` na rota ou headers

#### 1.3. Rota para Consultar Dados (Linha ~406)
- [ ] **TODO**: Ajustar rota conforme catálogo do Sicoob
- **Localização**: `getSecondCopyData()` método
- **Código atual**:
  ```typescript
  const consultaUrl = `/boletos/${title.nossoNumero}`;
  ```
- **Exemplos comuns**:
  - `GET /boletos/{nossoNumero}`
  - `GET /cobranca/boletos/{nossoNumero}`
  - `POST /boletos/consultar` com body `{ nossoNumero }`
- **Ação**: Verificar se é necessário passar `contrato/cooperativa/beneficiário` na rota ou headers

### 2. Adicionar Headers Obrigatórios

**Arquivo**: `src/adapters/sicoob/sicoob-bank-provider-adapter.ts`

#### 2.1. Headers para Obter PDF (Linha ~331)
- [ ] **TODO**: Adicionar headers exigidos conforme catálogo (ex: X-Cooperativa, X-Contrato)
- **Localização**: `getSecondCopyPdf()` método, dentro do objeto `headers`
- **Possíveis headers**:
  - `X-Cooperativa`: Código da cooperativa
  - `X-Contrato`: Número do contrato
  - `X-Beneficiario`: Código do beneficiário
- **Ação**: Consultar catálogo e adicionar headers conforme necessário

#### 2.2. Headers para Consultar Dados (Linha ~412)
- [ ] **TODO**: Adicionar headers exigidos conforme catálogo (ex: X-Cooperativa, X-Contrato)
- **Localização**: `getSecondCopyData()` método, dentro do objeto `headers`
- **Ação**: Consultar catálogo e adicionar headers conforme necessário

### 3. Ajustar Estrutura de Dados da API

**Arquivo**: `src/adapters/sicoob/sicoob-bank-provider-adapter.ts`

#### 3.1. Interface SicoobBoletoResponse (Linha ~39)
- [ ] **TODO**: Ajustar campos conforme catálogo da API do Sicoob
- **Localização**: Interface `SicoobBoletoResponse`
- **Campos atuais**:
  - `nossoNumero`, `numeroDocumento`, `valor`, `dataVencimento`, `situacao`
  - `linhaDigitavel`, `codigoBarras`
  - `beneficiario`, `pagador`
- **Ação**: Adicionar campos exigidos conforme catálogo (beneficiário/contrato/cooperativa)

#### 3.2. Mapeamento de Campos (Linha ~428)
- [ ] **TODO**: Mapear campos conforme estrutura real da API do Sicoob
- **Localização**: `getSecondCopyData()` método
- **Código atual**:
  ```typescript
  const linhaDigitavel = boleto.linhaDigitavel || boleto.codigoBarras || '';
  ```
- **Ação**: Ajustar conforme catálogo (linhaDigitavel pode vir em campo diferente)

### 4. Implementação Simplificada - buscarBoletosPorCPF

**Arquivo**: `src/adapters/sicoob/sicoob-bank-provider-adapter.ts`

**Status**: ✅ **CONSOLIDADO** - Método movido para `SicoobBankProviderAdapter` (linha ~490)

#### 4.1. Busca por CPF Hash (Linha ~490)
- [ ] **PENDÊNCIA**: Implementação simplificada - adaptar conforme API real do Sicoob
- **Problema**: A API do Sicoob normalmente busca por CPF diretamente, mas estamos usando hash
- **Notas no código**:
  - "A API do Sicoob provavelmente não aceita hash de CPF diretamente"
  - "Seria necessário ter um sistema intermediário ou usar outra abordagem"
  - "Isso provavelmente não funcionará diretamente - é um exemplo"
- **Ações possíveis**:
  1. Buscar todos os boletos e filtrar (não recomendado para produção)
  2. Criar tabela de mapeamento hash → CPF (viola LGPD se não for seguro)
  3. Usar outra abordagem conforme documentação da API
- **Ação**: Definir estratégia e implementar conforme documentação real

#### 4.2. Endpoint de Busca (Linha ~505)
- [ ] **PENDÊNCIA**: Endpoint real pode variar
- **Código atual**: `/boletos`
- **Ação**: Ajustar conforme catálogo/documentação

#### 4.3. Endpoint de Segunda Via (Método gerarSegundaVia - Linha ~540)
- [ ] **PENDÊNCIA**: Endpoint real pode variar
- **Código atual**: `/boletos/${nossoNumero}/pdf`
- **Ação**: Ajustar conforme catálogo/documentação
- **Nota**: Este método é mantido para compatibilidade com `SicoobPort`. Para novos usos, prefira `getSecondCopyPdf()`.

---

## ✅ CONCLUÍDO - Consolidação de Adapters

### 11. Consolidação SicoobBankProviderAdapter

**Status**: ✅ **CONCLUÍDO** - 2024-12-19

- [x] `SicoobBankProviderAdapter` agora implementa tanto `BankProvider` quanto `SicoobPort`
- [x] Métodos `buscarBoletosPorCPF()` e `gerarSegundaVia()` adicionados ao adapter consolidado
- [x] `main.ts` atualizado para usar apenas `SicoobBankProviderAdapter`
- [x] `SicoobTitleRepositoryAdapter` agora usa o adapter consolidado
- [x] Testes passando

**Arquivo legado**: `src/adapters/sicoob/sicoob-api-adapter.ts` pode ser removido após validação completa.

---

## 🟡 IMPORTANTE - Migração de Arquitetura

### 5. Remover Arquivos Ponte (Migração ADR-0001)

**Status**: Migração gradual em andamento

**Arquivos ponte temporários** (em `src/domain/ports/`):
- [ ] `src/domain/ports/sicoob-port.ts` - Reexporta de `application/ports/driven/sicoob-port.js`
- [ ] `src/domain/ports/storage-port.ts` - Reexporta de `application/ports/driven/storage-port.js`
- [ ] `src/domain/ports/sheets-port.ts` - Reexporta de `application/ports/driven/sheets-port.js`
- [ ] `src/domain/ports/drive-port.ts` - Reexporta de `application/ports/driven/drive-port.js`
- [ ] `src/domain/ports/conversation-state-store.ts` - Reexporta de `application/ports/driven/conversation-state-store.js`
- [ ] `src/domain/ports/rate-limiter.ts` - Reexporta de `application/ports/driven/rate-limiter.js`
- [ ] `src/domain/ports/logger-port.ts` - Reexporta de `application/ports/driven/logger-port.js`
- [ ] `src/domain/ports/whatsapp-port.ts` - Reexporta de `application/ports/driven/whatsapp-port.js`

**Ação**: 
1. Buscar todos os imports que ainda usam `domain/ports/`
2. Migrar para `application/ports/driven/`
3. Remover arquivos ponte quando todos os imports estiverem atualizados

**Referência**: Ver `docs/adr/ADR-0001-ports-na-application.md`

---

## 🟢 MELHORIAS - Código e Configuração

### 6. Google Sheets - Sheet ID Hardcoded

**Arquivo**: `src/adapters/google/sheets-adapter.ts`

#### 6.1. Sheet ID Assumido (Linha ~180)
- [ ] **MELHORIA**: `sheetId: 0` está hardcoded - pode precisar ajustar
- **Localização**: Método de deleção de linhas
- **Código atual**:
  ```typescript
  sheetId: 0, // Assumindo primeira aba - pode precisar ajustar
  ```
- **Ação**: Tornar configurável ou detectar dinamicamente

### 7. Dependência Opcional - node-forge

**Arquivo**: `src/adapters/sicoob/sicoob-bank-provider-adapter.ts`

#### 7.1. Conversão de PFX (Linha ~124)
- [ ] **PENDÊNCIA**: Requer biblioteca `node-forge` para conversão de PFX
- **Status**: Documentado, mas não instalado
- **Ação**: 
  - Instalar se usar `SICOOB_CERT_PFX_BASE64`: `npm install node-forge @types/node-forge`
  - OU converter PFX para PEM separado externamente e usar `SICOOB_CERTIFICATE_PATH`/`SICOOB_KEY_PATH`

### 8. Método Futuro - TitleRepository

**Arquivo**: `src/application/ports/driven/title-repository.port.ts`

#### 8.1. Método Comentado (Linha ~16)
- [ ] **FUTURO**: Método `findByReference` comentado para referência
- **Código**:
  ```typescript
  // Método futuro - comentado para referência
  // findByReference(...params: unknown[]): Promise<Title[]>;
  ```
- **Ação**: Implementar quando necessário

### 9. Métodos Legados - WhatsApp

**Arquivos**:
- `src/adapters/whatsapp/whatsapp-cloud-api-adapter.ts` (Linha ~178)
- `src/application/ports/driven/whatsapp-port.ts` (Linha ~18)

#### 9.1. Métodos Legados Mantidos
- [ ] **REVISÃO**: Métodos legados mantidos para compatibilidade
- **Ação**: Avaliar se ainda são necessários e remover se não forem mais usados

### 10. Placeholders em Documentação

**Arquivo**: `README.md`

#### 10.1. Hashes de Exemplo (Linha ~363)
- [ ] **DOCUMENTAÇÃO**: Hashes de exemplo são placeholders
- **Nota**: "Os hashes de exemplo no código são placeholders. Substitua pelos hashes reais usando `CpfHandler.hashCpf()`."
- **Ação**: Verificar se há placeholders em código de produção e substituir

---

## 📋 CHECKLIST DE HOMOLOGAÇÃO

### Configuração
- [ ] `SICOOB_CLIENT_ID` configurado
- [ ] `SICOOB_CLIENT_SECRET` configurado
- [ ] `SICOOB_BASE_URL` configurado (ou usando default)
- [ ] Certificado mTLS configurado (PFX ou PEM separado)
- [ ] Se usar PFX: `node-forge` instalado

### Autenticação
- [ ] Token OAuth2 sendo obtido com sucesso
- [ ] Token sendo cacheado corretamente (expira -60s antes do tempo real)
- [ ] mTLS funcionando (se configurado)
- [ ] Erros de autenticação mapeados corretamente (`SICOOB_AUTH_FAILED`)

### Endpoints
- [ ] Rota de autenticação ajustada conforme catálogo
- [ ] Rota de PDF ajustada conforme catálogo
- [ ] Rota de consulta de dados ajustada conforme catálogo
- [ ] Headers obrigatórios adicionados (se necessário)

### Mapeamento de Campos
- [ ] Interface `SicoobBoletoResponse` ajustada conforme resposta real
- [ ] Mapeamento de dados em `getSecondCopyData()` ajustado

### Tratamento de Erros
- [ ] Erros 401/403 mapeados para `SICOOB_AUTH_FAILED`
- [ ] Erros 404 mapeados para `SICOOB_NOT_FOUND` (retorna `null`, não é fatal)
- [ ] Erros 400 mapeados para `SICOOB_BAD_REQUEST`
- [ ] Erros 429 mapeados para `SICOOB_RATE_LIMIT`
- [ ] Outros erros mapeados para `SICOOB_UNKNOWN`
- [ ] Payloads brutos do banco **nunca** aparecem em logs (conforme LGPD)

### Validação de PDF
- [ ] PDF retornado é válido (verifica assinatura `%PDF`)
- [ ] PDF inválido retorna `null` (não é erro fatal)
- [ ] Tamanho do PDF é logado (sem dados sensíveis)

### Testes
- [ ] Teste de autenticação bem-sucedida
- [ ] Teste de cache de token (não reautentica se válido)
- [ ] Teste de expiração de token (reautentica quando expirado)
- [ ] Teste de obtenção de PDF bem-sucedida
- [ ] Teste de obtenção de dados bem-sucedida
- [ ] Teste de erro 404 (retorna `null`)
- [ ] Teste de erro de autenticação (lança `SicoobError`)
- [ ] Teste de mTLS (se configurado)

---

## 📚 Referências

- **Documentação Sicoob**: `docs/SICOOB.md`
- **ADR-0001**: `docs/adr/ADR-0001-ports-na-application.md`
- **Catálogo da API do Sicoob**: Documentação oficial (obter da empresa/Sicoob)

---

## 🔄 Como Usar Este Arquivo

1. **Ao iniciar uma tarefa**: Marque como `[ ]` (pendente)
2. **Durante desenvolvimento**: Atualize o status
3. **Ao concluir**: Marque como `[x]` (concluído)
4. **Ao adicionar nova pendência**: Adicione na seção apropriada

---

## 📝 Notas

- **Prioridade**: 🔴 Crítico > 🟡 Importante > 🟢 Melhorias
- **Status**: Use `[ ]` para pendente, `[x]` para concluído, `[~]` para em andamento
- **Atualização**: Atualize a data no topo do arquivo ao fazer mudanças significativas
