import { FlowType } from '../enums/flow-type.js';

/**
 * Estado de uma conversação
 */
export interface ConversationState {
  activeFlow: FlowType | null;
  step: string;
  data: Record<string, unknown>;
  updatedAt: Date;
}

/**
 * Port para gerenciar estado de conversações
 */
export interface ConversationStateStore {
  /**
   * Obtém o estado de uma conversação
   * @param from Identificador do remetente (ex: WhatsApp ID)
   * @returns Estado da conversação ou null se não existir
   */
  get(from: string): Promise<ConversationState | null>;

  /**
   * Define o estado de uma conversação
   * @param from Identificador do remetente
   * @param state Estado da conversação
   * @param ttlSeconds Tempo de vida em segundos (padrão: 15 minutos)
   */
  set(from: string, state: ConversationState, ttlSeconds?: number): Promise<void>;

  /**
   * Limpa o estado de uma conversação
   * @param from Identificador do remetente
   */
  clear(from: string): Promise<void>;
}
