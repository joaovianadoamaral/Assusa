import { EventType } from '../../../domain/enums/event-type.js';

/**
 * Payload genérico para eventos
 */
export type EventPayload = Record<string, unknown>;

/**
 * Port: Logger de Planilha
 * 
 * Responsável por registrar eventos em planilha (Google Sheets)
 */
export interface SheetLogger {
  /**
   * Adiciona um evento à planilha
   * @param eventType Tipo do evento
   * @param payload Dados do evento (objeto com informações específicas do evento)
   */
  appendEvent(eventType: EventType, payload: EventPayload): Promise<void>;
}
