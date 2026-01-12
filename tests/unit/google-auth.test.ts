import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GoogleAuth } from '../../src/infrastructure/utils/google-auth.js';

describe('GoogleAuth', () => {
  beforeEach(() => {
    GoogleAuth.reset();
  });

  describe('getInstance', () => {
    it('deve retornar a mesma instância (singleton)', () => {
      const instance1 = GoogleAuth.getInstance();
      const instance2 = GoogleAuth.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('deve criar nova instância após reset', () => {
      const instance1 = GoogleAuth.getInstance();
      GoogleAuth.reset();
      const instance2 = GoogleAuth.getInstance();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('initialize', () => {
    it('deve decodificar Service Account JSON base64 corretamente', () => {
      const serviceAccountJson = {
        type: 'service_account',
        project_id: 'test-project',
        private_key_id: 'test-key-id',
        private_key: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----\n',
        client_email: 'test@example.com',
        client_id: 'test-client-id',
        auth_uri: 'https://accounts.google.com/o/oauth2/auth',
        token_uri: 'https://oauth2.googleapis.com/token',
      };

      const base64 = Buffer.from(JSON.stringify(serviceAccountJson)).toString('base64');
      const googleAuth = GoogleAuth.getInstance();

      expect(() => {
        googleAuth.initialize(base64, ['https://www.googleapis.com/auth/drive']);
      }).not.toThrow();
    });

    it('deve lançar erro quando base64 é inválido', () => {
      const googleAuth = GoogleAuth.getInstance();

      expect(() => {
        googleAuth.initialize('invalid-base64', ['https://www.googleapis.com/auth/drive']);
      }).toThrow('Falha ao decodificar GOOGLE_SERVICE_ACCOUNT_JSON_BASE64');
    });

    it('deve lançar erro quando JSON é inválido', () => {
      const invalidJson = Buffer.from('invalid json').toString('base64');
      const googleAuth = GoogleAuth.getInstance();

      expect(() => {
        googleAuth.initialize(invalidJson, ['https://www.googleapis.com/auth/drive']);
      }).toThrow('Falha ao decodificar GOOGLE_SERVICE_ACCOUNT_JSON_BASE64');
    });

    it('deve reutilizar instância quando já inicializado', () => {
      const serviceAccountJson = {
        type: 'service_account',
        client_email: 'test@example.com',
      };

      const base64 = Buffer.from(JSON.stringify(serviceAccountJson)).toString('base64');
      const googleAuth = GoogleAuth.getInstance();

      googleAuth.initialize(base64, ['https://www.googleapis.com/auth/drive']);
      
      // Segunda chamada não deve lançar erro
      expect(() => {
        googleAuth.initialize(base64, ['https://www.googleapis.com/auth/drive']);
      }).not.toThrow();
    });
  });

  describe('getAuthClient', () => {
    it('deve retornar cliente autenticado após inicialização', () => {
      const serviceAccountJson = {
        type: 'service_account',
        client_email: 'test@example.com',
      };

      const base64 = Buffer.from(JSON.stringify(serviceAccountJson)).toString('base64');
      const googleAuth = GoogleAuth.getInstance();

      googleAuth.initialize(base64, ['https://www.googleapis.com/auth/drive']);

      expect(() => {
        googleAuth.getAuthClient();
      }).not.toThrow();
    });

    it('deve lançar erro quando não foi inicializado', () => {
      const googleAuth = GoogleAuth.getInstance();

      expect(() => {
        googleAuth.getAuthClient();
      }).toThrow('GoogleAuth não foi inicializado');
    });
  });

  describe('getClientEmail', () => {
    it('deve retornar email da service account', () => {
      const serviceAccountJson = {
        type: 'service_account',
        client_email: 'test@example.com',
      };

      const base64 = Buffer.from(JSON.stringify(serviceAccountJson)).toString('base64');
      const googleAuth = GoogleAuth.getInstance();

      googleAuth.initialize(base64, ['https://www.googleapis.com/auth/drive']);

      expect(googleAuth.getClientEmail()).toBe('test@example.com');
    });

    it('deve lançar erro quando não foi inicializado', () => {
      const googleAuth = GoogleAuth.getInstance();

      expect(() => {
        googleAuth.getClientEmail();
      }).toThrow('Service Account JSON não foi decodificado');
    });

    it('deve lançar erro quando client_email não existe no JSON', () => {
      const serviceAccountJson = {
        type: 'service_account',
        // client_email ausente
      };

      const base64 = Buffer.from(JSON.stringify(serviceAccountJson)).toString('base64');
      const googleAuth = GoogleAuth.getInstance();

      googleAuth.initialize(base64, ['https://www.googleapis.com/auth/drive']);

      expect(() => {
        googleAuth.getClientEmail();
      }).toThrow('client_email não encontrado no Service Account JSON');
    });
  });
});
