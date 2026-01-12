import { hashCpf as lgpdHashCpf } from '../../domain/helpers/lgpd-helpers.js';

export class CpfHandler {
  /**
   * Obtém o pepper em runtime (não em import time)
   * Permite que testes configurem a variável de ambiente antes de chamar
   */
  private static getPepper(): string {
    return process.env.CPF_PEPPER || '';
  }

  /**
   * Hash SHA256 do CPF com pepper
   * Usa lgpd-helpers.hashCpf internamente para evitar duplicação
   */
  static hashCpf(cpf: string): string {
    const pepper = this.getPepper();
    if (!pepper) {
      throw new Error('CPF_PEPPER não configurado');
    }
    const normalized = this.normalizeCpf(cpf);
    return lgpdHashCpf(normalized, pepper);
  }

  /**
   * Normaliza CPF removendo caracteres especiais
   */
  static normalizeCpf(cpf: string): string {
    return cpf.replace(/\D/g, '');
  }

  /**
   * Valida formato do CPF (apenas formato, não dígitos verificadores)
   */
  static isValidFormat(cpf: string): boolean {
    const normalized = this.normalizeCpf(cpf);
    return /^\d{11}$/.test(normalized);
  }

  /**
   * Mascara CPF (XXX.XXX.XXX-XX)
   */
  static maskCpf(cpf: string): string {
    const normalized = this.normalizeCpf(cpf);
    if (normalized.length !== 11) {
      return cpf; // Retorna original se não tiver 11 dígitos
    }
    return normalized.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }

  /**
   * Valida CPF completo (formato + dígitos verificadores)
   */
  static isValidCpf(cpf: string): boolean {
    const normalized = this.normalizeCpf(cpf);
    
    if (normalized.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(normalized)) return false; // Todos dígitos iguais

    let sum = 0;
    let remainder: number;

    // Valida primeiro dígito
    for (let i = 1; i <= 9; i++) {
      sum += parseInt(normalized.substring(i - 1, i)) * (11 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(normalized.substring(9, 10))) return false;

    // Valida segundo dígito
    sum = 0;
    for (let i = 1; i <= 10; i++) {
      sum += parseInt(normalized.substring(i - 1, i)) * (12 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(normalized.substring(10, 11))) return false;

    return true;
  }


  /**
   * Gera nome de arquivo seguro (sem CPF puro, a menos que permitido)
   */
  static generateSafeFilename(prefix: string, nossoNumero: string, cpf?: string): string {
    const allowRawCpf = process.env.ALLOW_RAW_CPF_IN_FILENAME === 'true';
    
    if (cpf && allowRawCpf) {
      const normalized = this.normalizeCpf(cpf);
      return `${prefix}-${nossoNumero}-${normalized}.pdf`;
    }
    
    return `${prefix}-${nossoNumero}-${Date.now()}.pdf`;
  }
}
