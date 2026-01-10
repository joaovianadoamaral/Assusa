import crypto from 'crypto';
import { Cpf } from '../value-objects/cpf.js';

/**
 * LGPD Helpers
 * Funções auxiliares para compliance com LGPD
 */

/**
 * Hash SHA256 do CPF limpo com pepper
 * Retorna hash hexadecimal de 64 caracteres
 */
export function hashCpf(cpfLimpo: string, pepper: string): string {
  if (!pepper || pepper.length < 32) {
    throw new Error('Pepper deve ter pelo menos 32 caracteres');
  }

  const normalized = Cpf.normalize(cpfLimpo);
  if (normalized.length !== 11) {
    throw new Error('CPF limpo deve ter 11 dígitos');
  }

  return crypto
    .createHash('sha256')
    .update(normalized + pepper)
    .digest('hex');
}

/**
 * Mascara CPF no formato ***.***.***-XX
 * Mostra apenas os últimos 2 dígitos
 */
export function maskCpf(cpfLimpo: string): string {
  const normalized = Cpf.normalize(cpfLimpo);
  if (normalized.length !== 11) {
    return normalized;
  }

  // Mostra apenas os últimos 2 dígitos
  const lastTwo = normalized.substring(9, 11);
  return `***.***.***-${lastTwo}`;
}

/**
 * Sanitiza objeto removendo/mascarando campos sensíveis para logs
 * Remove/mascara: cpf, tokens, secrets, passwords, etc.
 * 
 * Regras:
 * - Não muta o objeto original (retorna cópia sanitizada)
 * - Remove campos sensíveis (case-insensitive)
 * - Mascara CPF válido encontrado em strings (apenas CPFs com dígitos verificadores corretos)
 * - Não mascara CPF inválido
 */
export function sanitizeForLogs<T extends Record<string, any>>(obj: T): Partial<T> {
  // Função auxiliar para verificar se uma chave é sensível
  // Regras: apenas campos realmente sensíveis, não campos que apenas contenham "cpf" no nome
  // Exemplos: remove "cpf", "cpf_hash", mas mantém "validCpf", "documentoCpf", "cpfFormatado"
  function isSensitiveField(key: string): boolean {
    const lowerKey = key.toLowerCase();
    
    // Lista de campos sensíveis exatos (case-insensitive)
    const exactSensitiveFields = [
      'cpf',
      'cpfhash',
      'cpf_hash',
      'cpflimpo',
      'cpf_limpo',
      'cpfclean',
      'cpf_clean',
      'cpfraw',
      'cpf_raw',
      'cpfplain',
      'cpf_plain',
      'token',
      'accesstoken',
      'access_token',
      'refreshtoken',
      'refresh_token',
      'authorization',
      'cookie',
      'secret',
      'password',
      'senha',
      'apikey',
      'api_key',
      'apisecret',
      'api_secret',
      'privatekey',
      'private_key',
      'clientsecret',
      'client_secret',
      'cert',
      'certificate',
      'pfx',
      'pepper',
      'hash',
    ];
    
    // Verifica correspondência exata
    if (exactSensitiveFields.includes(lowerKey)) {
      return true;
    }
    
    // Verifica prefixos: cpf_, cpf-
    if (lowerKey.startsWith('cpf_') || lowerKey.startsWith('cpf-')) {
      return true;
    }
    
    // Verifica sufixos: _cpf, -cpf (mas não _validcpf, _documentocpf, etc)
    // Apenas se terminar exatamente com _cpf ou -cpf (sem mais caracteres)
    if (lowerKey.endsWith('_cpf') || lowerKey.endsWith('-cpf')) {
      // Mas não remover campos como validCpf, documentoCpf, cpfFormatado
      // Esses devem ser preservados e apenas ter o valor sanitizado
      if (lowerKey === 'validcpf' || lowerKey === 'documentocpf' || lowerKey === 'cpfformatado') {
        return false;
      }
      return true;
    }
    
    return false;
  }

  // Função auxiliar para mascarar CPF válido em string
  function maskCpfInString(str: string): string {
    // Padrão para detectar CPF formatado: XXX.XXX.XXX-XX
    const formattedPattern = /(\d{3})\.(\d{3})\.(\d{3})-(\d{2})/g;
    let result = str.replace(formattedPattern, (match) => {
      const normalized = Cpf.normalize(match);
      // Valida CPF antes de mascarar
      if (Cpf.isValid(normalized)) {
        const lastTwo = normalized.substring(9, 11);
        return `***.***.***-${lastTwo}`;
      }
      return match; // Mantém original se CPF inválido
    });

    // Padrão para detectar CPF sem formatação: 11 dígitos seguidos
    // Usa lookahead/lookbehind para evitar capturar dígitos de números maiores
    const unformattedPattern = /\b(\d{11})\b/g;
    result = result.replace(unformattedPattern, (match) => {
      // Valida CPF antes de mascarar
      if (Cpf.isValid(match)) {
        const lastTwo = match.substring(9, 11);
        return `***.***.***-${lastTwo}`;
      }
      return match; // Mantém original se CPF inválido
    });

    return result;
  }

  // Criar cópia do objeto para não mutar o original
  const sanitized: Partial<T> = {};

  for (const [key, value] of Object.entries(obj)) {
    // Pula campos sensíveis
    if (isSensitiveField(key)) {
      continue;
    }

    // Recursão para objetos
    if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      sanitized[key as keyof T] = sanitizeForLogs(value) as T[keyof T];
    }
    // Sanitiza arrays
    else if (Array.isArray(value)) {
      sanitized[key as keyof T] = value.map((item) =>
        typeof item === 'object' && item !== null && !(item instanceof Date)
          ? sanitizeForLogs(item)
          : typeof item === 'string'
            ? maskCpfInString(item)
            : item
      ) as T[keyof T];
    }
    // Sanitiza strings que podem conter CPF
    else if (typeof value === 'string') {
      sanitized[key as keyof T] = maskCpfInString(value) as T[keyof T];
    }
    // Outros tipos (números, booleanos, null, etc.) - preserva sem alteração
    else {
      sanitized[key as keyof T] = value;
    }
  }

  return sanitized;
}
