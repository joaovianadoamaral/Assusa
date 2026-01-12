/**
 * Helper para normalizar texto
 * Converte para lowercase e remove acentos
 */

/**
 * Remove acentos de uma string
 */
function removeAccents(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Normaliza texto convertendo para lowercase e removendo acentos
 */
export function normalizeText(text: string): string {
  return removeAccents(text.toLowerCase().trim());
}
