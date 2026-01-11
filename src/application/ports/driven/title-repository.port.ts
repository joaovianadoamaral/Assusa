import { Title } from '../../../domain/entities/title.js';

/**
 * Port: Repositório de Títulos
 * 
 * Responsável por buscar títulos no sistema
 */
export interface TitleRepository {
  /**
   * Busca títulos em aberto por hash do CPF
   * @param cpfHash Hash do CPF (SHA256 + pepper)
   * @returns Lista de títulos em aberto
   */
  findOpenTitlesByCpfHash(cpfHash: string): Promise<Title[]>;
  
  // Método futuro - comentado para referência
  // findByReference(...params: unknown[]): Promise<Title[]>;
}
