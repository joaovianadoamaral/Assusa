#!/usr/bin/env node
/**
 * Script de Validação de Configuração
 * 
 * Valida se todas as variáveis de ambiente obrigatórias estão configuradas
 * e se os valores são válidos.
 * 
 * Uso: npm run validate-config
 * ou: npx tsx scripts/validate-config.ts
 */

import { loadConfig } from '../src/infrastructure/config/config.js';
import { z } from 'zod';

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

function validateConfig(): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  };

  try {
    const config = loadConfig();
    
    console.log('✅ Configuração carregada com sucesso!\n');
    
    // Validações adicionais
    validateSicoobConfig(config, result);
    validateGoogleConfig(config, result);
    validateSecurityConfig(config, result);
    validateRedisConfig(config, result);
    
  } catch (error) {
    result.valid = false;
    if (error instanceof z.ZodError) {
      error.errors.forEach((err) => {
        const path = err.path.map(String).join('.');
        result.errors.push(`${path}: ${err.message}`);
      });
    } else if (error instanceof Error) {
      result.errors.push(error.message);
    } else {
      result.errors.push('Erro desconhecido ao validar configuração');
    }
  }

  return result;
}

function validateSicoobConfig(config: any, result: ValidationResult): void {
  console.log('🔍 Validando configuração do Sicoob...');
  
  // Verificar se está usando sandbox
  if (config.sicoobBaseUrl?.includes('sandbox')) {
    result.warnings.push('⚠️  Usando ambiente SANDBOX do Sicoob');
  }
  
  // Verificar se certificados estão configurados
  const hasPfx = config.sicoobCertPfxBase64 && config.sicoobCertPfxPassword;
  const hasPem = config.sicoobCertificatePath && config.sicoobKeyPath;
  
  if (!hasPfx && !hasPem) {
    result.warnings.push('⚠️  Certificados SSL (mTLS) não configurados - pode ser necessário para produção');
  }
  
  console.log('✅ Configuração do Sicoob OK\n');
}

function validateGoogleConfig(config: any, result: ValidationResult): void {
  console.log('🔍 Validando configuração do Google...');
  
  // Verificar se está usando campos legados
  if (config.googleClientEmail || config.googlePrivateKey || config.googleProjectId) {
    result.warnings.push('⚠️  Usando campos legados do Google (GOOGLE_CLIENT_EMAIL, etc.) - migre para GOOGLE_SERVICE_ACCOUNT_JSON_BASE64');
  }
  
  console.log('✅ Configuração do Google OK\n');
}

function validateSecurityConfig(config: any, result: ValidationResult): void {
  console.log('🔍 Validando configuração de segurança...');
  
  // Verificar CPF_PEPPER
  if (config.cpfPepper.length < 32) {
    result.errors.push('CPF_PEPPER deve ter pelo menos 32 caracteres');
    result.valid = false;
  }
  
  // Verificar se ALLOW_RAW_CPF_IN_FILENAME está habilitado em produção
  if (config.nodeEnv === 'production' && config.allowRawCpfInFilename) {
    result.warnings.push('⚠️  ALLOW_RAW_CPF_IN_FILENAME=true em produção - não recomendado para LGPD');
  }
  
  console.log('✅ Configuração de segurança OK\n');
}

function validateRedisConfig(config: any, result: ValidationResult): void {
  console.log('🔍 Validando configuração do Redis...');
  
  if (config.redisEnabled && !config.redisUrl) {
    result.warnings.push('⚠️  REDIS_ENABLED=true mas REDIS_URL não configurado - usando fallback em memória');
  }
  
  if (!config.redisEnabled) {
    result.warnings.push('⚠️  Redis desabilitado - usando fallback em memória (não recomendado para produção)');
  }
  
  console.log('✅ Configuração do Redis OK\n');
}

function main(): void {
  console.log('🚀 Validando configuração do Assusa...\n');
  
  const result = validateConfig();
  
  if (result.warnings.length > 0) {
    console.log('\n📋 Avisos:');
    result.warnings.forEach((warning) => console.log(`  ${warning}`));
  }
  
  if (result.errors.length > 0) {
    console.log('\n❌ Erros encontrados:');
    result.errors.forEach((error) => console.log(`  - ${error}`));
    console.log('\n💡 Corrija os erros acima e tente novamente.');
    console.log('💡 Consulte docs/SETUP.md para mais informações.\n');
    process.exit(1);
  }
  
  if (result.valid) {
    console.log('\n✅ Todas as validações passaram!');
    if (result.warnings.length > 0) {
      console.log('⚠️  Verifique os avisos acima antes de prosseguir.\n');
    } else {
      console.log('🎉 Configuração pronta para uso!\n');
    }
    process.exit(0);
  }
}

main();
