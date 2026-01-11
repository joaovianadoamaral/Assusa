# ADR-0001: Ports de Integrações Externas Residem na Camada Application

## Status
✅ Aceito

## Contexto

O projeto Assusa segue Clean Architecture (Ports & Adapters) e inicialmente os ports (interfaces) foram organizados em `src/domain/ports/`. No entanto, isso criava uma inconsistência arquitetural:

1. **Ports de integrações externas** (WhatsApp, Sicoob, Google Drive, Google Sheets, Redis, etc.) estavam misturados com o domínio puro
2. A camada **Domain** deve ser a mais pura possível**, sem conhecimento de integrações específicas
3. **Ports de integração externa** são na verdade **dependências de casos de uso** e serviços da camada Application, não do domínio

O domínio deve conter apenas:
- Entidades (Entities)
- Regras de negócio puras
- Casos de uso (Use Cases)
- Value Objects
- **Apenas ports puramente de domínio** (genéricos e abstratos, como Clock, IdGenerator, Hasher, RandomProvider, DomainPolicy abstractions)

## Decisão

**Ports de integrações externas devem residir na camada Application**, não no Domain:

1. **Nova localização padrão:**
   - `src/application/ports/driven/` - para ports de integrações externas (saídas)
   - `src/application/ports/driving/` - para ports de controllers/handlers (entradas, se existirem)

2. **Migração gradual:**
   - Ports legados em `src/domain/ports/` serão migrados gradualmente
   - Criar "arquivos ponte" temporários em `src/domain/ports/` que reexportam os ports do novo caminho
   - Migrar imports aos poucos, arquivo por arquivo
   - Remover as pontes quando todos os imports estiverem atualizados

3. **Exceções (permanecem no Domain):**
   - Apenas ports puramente de domínio e genéricos
   - Se o nome do port "parece integração" (ex: WhatsAppPort, SicoobPort, DrivePort), ele **NÃO é domínio**

## Consequências

### Positivas
- ✅ **Domínio mais limpo**: Domain permanece independente de integrações externas
- ✅ **Consistência arquitetural**: Ports de integrações ficam próximos aos serviços que os utilizam
- ✅ **Manutenção mais fácil**: Separação clara entre domínio puro e integrações
- ✅ **Migração incremental**: Evita refatoração "big bang", permite migração gradual sem quebrar o projeto
- ✅ **Alinhado com Clean Architecture**: Domain não conhece detalhes de implementação externa

### Negativas
- ⚠️ **Migração necessária**: Precisa migrar ports existentes e atualizar imports
- ⚠️ **Temporariamente dois lugares**: Durante a migração, alguns ports estarão em ambos os lugares (com ponte)

### Neutras
- Arquivos ponte temporários criam uma camada extra, mas facilitam migração incremental

## Implementação

### Passos da Migração
1. ✅ Criar estrutura `src/application/ports/driven/`
2. ✅ Mover novos ports do Bloco 4 para `driven/`
3. ✅ Mover ports legados de `domain/ports` para `application/ports/driven/`
4. ✅ Criar arquivos ponte em `domain/ports` (reexports temporários)
5. 🔄 Migrar imports gradualmente (arquivo por arquivo)
6. 🔄 Remover arquivos ponte quando todos os imports estiverem atualizados

### Exemplo de Arquivo Ponte
```typescript
// src/domain/ports/sicoob-port.ts (ponte temporária)
export * from '../../application/ports/driven/sicoob-port.js';
```

### Ports Migrados
- ✅ `WhatsAppPort` → `application/ports/driven/whatsapp-port.ts`
- ✅ `SicoobPort` → `application/ports/driven/sicoob-port.ts`
- ✅ `DrivePort` → `application/ports/driven/drive-port.ts`
- ✅ `SheetsPort` → `application/ports/driven/sheets-port.ts`
- ✅ `StoragePort` → `application/ports/driven/storage-port.ts`
- ✅ `RateLimiter` → `application/ports/driven/rate-limiter.ts`
- ✅ `ConversationStateStore` → `application/ports/driven/conversation-state-store.ts`
- ✅ `Logger` → `application/ports/driven/logger-port.ts` (genérico mas usado principalmente para integração externa)

### Novos Ports do Bloco 4
- ✅ `TitleRepository` → `application/ports/driven/title-repository.port.ts`
- ✅ `BankProvider` → `application/ports/driven/bank-provider.port.ts`
- ✅ `PdfService` → `application/ports/driven/pdf-service.port.ts`
- ✅ `DriveStorage` → `application/ports/driven/drive-storage.port.ts`
- ✅ `SheetLogger` → `application/ports/driven/sheet-logger.port.ts`
- ✅ `SiteLinkService` → `application/ports/driven/site-link-service.port.ts`

## Referências
- [Clean Architecture - Robert C. Martin](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Hexagonal Architecture (Ports & Adapters)](https://alistair.cockburn.us/hexagonal-architecture/)

## Data
2024-12-19

## Autor
Time Assusa
