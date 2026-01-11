import { SiteLinkResult } from '../../dtos/site-link-result.dto.js';

/**
 * Port: Serviço de Link do Site
 * 
 * Responsável por gerar links para acesso ao site com tokens opcionais
 */
export interface SiteLinkService {
  /**
   * Gera um link para acesso ao site
   * @param from Identificador de origem (ex: WhatsApp ID)
   * @param existingCpfHash Hash do CPF existente (opcional, para vincular sessão)
   * @returns URL do link e indicador se token foi usado
   */
  generateLink(from: string, existingCpfHash?: string): Promise<SiteLinkResult>;
}
