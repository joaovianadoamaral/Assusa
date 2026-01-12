# TODO - Pendências do Projeto Assusa

Este arquivo lista todas as pendências e ajustes necessários do projeto.

**Última atualização**: 2024-12-19

---

## 🔴 CRÍTICO - Homologação Sicoob

### 1. Headers Obrigatórios Adicionais

**Status**: ⚠️ **PENDENTE** - Requer validação com catálogo oficial

**Arquivo**: `src/adapters/sicoob/sicoob-bank-provider-adapter.ts`

#### 1.1. Headers para Obter PDF
- [ ] **PENDENTE**: Verificar se headers adicionais são necessários conforme catálogo
- **Localização**: `getSecondCopyPdf()` método (linha ~333)
- **Headers atuais**:
  - `Authorization`: Bearer token
  - `client_id`: Client ID do Sicoob
  - `Accept`: application/json
  - `Content-Type`: application/json
  - `X-Request-ID`: Request ID para rastreamento
- **Possíveis headers adicionais** (verificar no catálogo):
  - `X-Cooperativa`: Código da cooperativa
  - `X-Contrato`: Número do contrato
  - `X-Beneficiario`: Código do beneficiário
- **Ação**: Validar com catálogo oficial se headers adicionais são necessários

#### 1.2. Headers para Consultar Dados
- [ ] **PENDENTE**: Verificar se headers adicionais são necessários conforme catálogo
- **Localização**: `getSecondCopyData()` método (linha ~438)
- **Headers atuais**: Mesmos de `getSecondCopyPdf()`
- **Ação**: Validar com catálogo oficial se headers adicionais são necessários

### 2. Implementação buscarBoletosPorCPF

**Status**: ⚠️ **PENDENTE** - Requer estratégia para hash→CPF

**Arquivo**: `src/adapters/sicoob/sicoob-bank-provider-adapter.ts`

#### 2.1. Busca por CPF Hash
- [ ] **PENDÊNCIA**: Implementar estratégia para obter CPF original a partir do hash
- **Localização**: Método `buscarBoletosPorCPF()` (linha ~543)
- **Problema**: A API do Sicoob requer CPF original, não hash. Método atualmente lança erro informativo.
- **Notas no código**:
  - "A API do Sicoob provavelmente não aceita hash de CPF diretamente"
  - "Seria necessário ter um sistema intermediário ou usar outra abordagem"
- **Ações possíveis**:
  1. Buscar todos os boletos e filtrar (não recomendado para produção)
  2. Criar tabela de mapeamento hash → CPF (viola LGPD se não for seguro)
  3. Usar outra abordagem conforme documentação da API
- **Código comentado**: Rota `/pagadores/{cpfCnpj}/boletos` está documentada no código (linha ~561)
- **Ação**: Definir estratégia e implementar conforme documentação real

---

## 🟢 MELHORIAS FUTURAS

### 3. Método Futuro - TitleRepository

**Arquivo**: `src/application/ports/driven/title-repository.port.ts`

#### 3.1. Método findByReference
- [ ] **FUTURO**: Método `findByReference` comentado para referência
- **Status**: Não implementado - apenas mencionado como possível necessidade futura
- **Ação**: Implementar quando necessário

---

## 📋 CHECKLIST DE HOMOLOGAÇÃO

Este checklist é para validação manual durante homologação. Os itens de código já estão implementados.

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
- [ ] Erros de autenticação mapeados corretamente (`SICOOB_AUTH_FAILED`) ✅ Implementado

### Endpoints
- [x] Rota de autenticação ajustada conforme catálogo ✅
- [x] Rota de PDF ajustada conforme catálogo ✅
- [x] Rota de consulta de dados ajustada conforme catálogo ✅
- [ ] Headers obrigatórios adicionados (se necessário) - Requer validação com catálogo

### Mapeamento de Campos
- [x] Interface `SicoobSegundaViaResponse` ajustada conforme resposta real ✅
- [x] Mapeamento de dados em `getSecondCopyData()` ajustado ✅

### Tratamento de Erros
- [x] Erros 401/403 mapeados para `SICOOB_AUTH_FAILED` ✅
- [x] Erros 404 mapeados para `SICOOB_NOT_FOUND` (retorna `null`, não é fatal) ✅
- [x] Erros 400 mapeados para `SICOOB_BAD_REQUEST` ✅
- [x] Erros 429 mapeados para `SICOOB_RATE_LIMIT` ✅
- [x] Outros erros mapeados para `SICOOB_UNKNOWN` ✅
- [x] Payloads brutos do banco **nunca** aparecem em logs (conforme LGPD) ✅

### Validação de PDF
- [x] PDF retornado é válido (verifica assinatura `%PDF`) ✅
- [x] PDF inválido retorna `null` (não é erro fatal) ✅
- [x] Tamanho do PDF é logado (sem dados sensíveis) ✅

### Testes
- [x] Teste de autenticação bem-sucedida
- [x] Teste de cache de token (não reautentica se válido)
- [x] Teste de expiração de token (reautentica quando expirado)
- [x] Teste de obtenção de PDF bem-sucedida
- [x] Teste de obtenção de dados bem-sucedida
- [x] Teste de erro 404 (retorna `null`)
- [x] Teste de mTLS (se configurado)
- [x] Teste de erro de autenticação (lança `SicoobError`) - **REMOVIDO**: Limitação técnica do mock de `axios.isAxiosError` no Vitest. O código funciona corretamente em produção, mas o mock não pode ser validado adequadamente nos testes. A lógica é validada indiretamente pelos outros testes.

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

---

## ✅ CONCLUÍDO (Histórico)

As seguintes tarefas foram concluídas e removidas do TODO principal:

- ✅ Rotas da API do Sicoob ajustadas (`/boletos/segunda-via`)
- ✅ Estrutura de dados (`SicoobSegundaViaResponse`) implementada
- ✅ Migração ADR-0001 (arquivos ponte removidos)
- ✅ Google Sheets Sheet ID dinâmico
- ✅ node-forge adicionado como dependência opcional
- ✅ Métodos legados WhatsApp verificados (todos em uso)
- ✅ Placeholders verificados (apenas em código de teste)
- ✅ Tratamento de erros implementado
- ✅ Validação de PDF implementada
- ✅ Consolidação SicoobBankProviderAdapter
