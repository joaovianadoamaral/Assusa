import { Title } from '../../../domain/entities/title.js';

/**
 * Port: Repositório de Títulos
 * 
 * Responsável por buscar títulos no sistema
 */
export interface TitleRepository {
  /**
   * Busca títulos em aberto por CPF
   * @param cpf CPF original (11 dígitos)
   * @param cpfHash Hash do CPF (SHA256 + pepper) - usado apenas para logs
   * @returns Lista de títulos em aberto
   */
  findOpenTitlesByCpfHash(cpf: string, cpfHash: string): Promise<Title[]>;
}
