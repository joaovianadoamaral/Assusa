import { TitleRepository } from '../../application/ports/driven/title-repository.port.js';
import { Title } from '../../domain/entities/title.js';
import { Logger } from '../../application/ports/driven/logger-port.js';
import crypto from 'crypto';

/**
 * Implementação em memória do TitleRepository
 * Utilizada para desenvolvimento e testes quando não há integração com ERP
 * 
 * Mantém um mapa cpfHash -> Title[] com dados de exemplo
 */
export class InMemoryTitleRepository implements TitleRepository {
  private storage: Map<string, Title[]> = new Map();

  constructor(private logger: Logger) {
    this.seedExampleData();
    this.logger.info({}, 'InMemoryTitleRepository inicializado com dados de exemplo');
  }

  /**
   * Popula dados de exemplo para desenvolvimento
   * 
   * Exemplo de CPFs para teste (hash SHA256 + pepper):
   * - CPF: 12345678900 -> usar CpfHandler.hashCpf() para obter o hash real
   * - CPF: 98765432100 -> usar CpfHandler.hashCpf() para obter o hash real
   * 
   * Para obter o hash real, use:
   * import { CpfHandler } from '../../infrastructure/security/cpf-handler.js';
   * const hash = CpfHandler.hashCpf('12345678900');
   */
  private seedExampleData(): void {
    // Exemplo 1: CPF com 1 título em aberto
    // Hash do CPF "12345678900" (use CpfHandler.hashCpf() para obter o hash real)
    const cpfHash1 = 'exemplo_hash_cpf_1_12345678900'; // Substitua pelo hash real
    this.storage.set(cpfHash1, [
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

    // Exemplo 2: CPF com múltiplos títulos em aberto
    const cpfHash2 = 'exemplo_hash_cpf_2_98765432100'; // Substitua pelo hash real
    this.storage.set(cpfHash2, [
      {
        id: crypto.randomUUID(),
        nossoNumero: '98765432109876543',
        contrato: 'CTR-2024-002',
        codigoBeneficiario: '123456',
        valor: 250.75,
        vencimento: new Date('2024-11-30'),
        status: 'OPEN',
      },
      {
        id: crypto.randomUUID(),
        nossoNumero: '98765432109876544',
        contrato: 'CTR-2024-003',
        codigoBeneficiario: '123456',
        valor: 350.00,
        vencimento: new Date('2024-12-15'),
        status: 'OPEN',
      },
      {
        id: crypto.randomUUID(),
        nossoNumero: '98765432109876545',
        contrato: 'CTR-2024-004',
        codigoBeneficiario: '123456',
        valor: 100.25,
        vencimento: new Date('2024-10-20'),
        status: 'OPEN',
      },
    ]);

    // Exemplo 3: CPF sem títulos em aberto
    const cpfHash3 = 'exemplo_hash_cpf_3_sem_titulos'; // Substitua pelo hash real
    this.storage.set(cpfHash3, []);
  }

  /**
   * Busca títulos em aberto por hash do CPF
   * @param cpfHash Hash do CPF (SHA256 + pepper)
   * @returns Lista de títulos em aberto (status === 'OPEN')
   */
  async findOpenTitlesByCpfHash(cpfHash: string): Promise<Title[]> {
    const allTitles = this.storage.get(cpfHash) || [];
    
    // Filtrar apenas títulos com status 'OPEN'
    const openTitles = allTitles.filter(title => title.status === 'OPEN');
    
    this.logger.debug(
      { cpfHash, total: allTitles.length, open: openTitles.length },
      'Títulos encontrados no repositório em memória'
    );
    
    return openTitles;
  }

  /**
   * Método auxiliar para adicionar títulos manualmente durante desenvolvimento
   * @param cpfHash Hash do CPF
   * @param titles Lista de títulos para adicionar
   */
  addTitles(cpfHash: string, titles: Title[]): void {
    const existing = this.storage.get(cpfHash) || [];
    this.storage.set(cpfHash, [...existing, ...titles]);
    this.logger.debug({ cpfHash, added: titles.length }, 'Títulos adicionados ao repositório em memória');
  }

  /**
   * Método auxiliar para limpar todos os dados (útil para testes)
   */
  clear(): void {
    this.storage.clear();
    this.seedExampleData();
    this.logger.debug({}, 'Repositório em memória limpo e reinicializado');
  }
}
