/**
 * Códigos de erro do Sicoob
 * Usados para mapear erros da API do Sicoob para códigos internos
 */
export enum SicoobErrorCode {
  /** Falha na autenticação (401, 403) */
  SICOOB_AUTH_FAILED = 'SICOOB_AUTH_FAILED',
  
  /** Recurso não encontrado (404) */
  SICOOB_NOT_FOUND = 'SICOOB_NOT_FOUND',
  
  /** Requisição inválida (400) */
  SICOOB_BAD_REQUEST = 'SICOOB_BAD_REQUEST',
  
  /** Rate limit excedido (429) */
  SICOOB_RATE_LIMIT = 'SICOOB_RATE_LIMIT',
  
  /** Erro desconhecido (outros códigos HTTP ou erros não mapeados) */
  SICOOB_UNKNOWN = 'SICOOB_UNKNOWN',
}
