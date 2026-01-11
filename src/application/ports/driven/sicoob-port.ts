import { BoletoSicoob } from '../../../domain/entities/boleto.js';

export interface SicoobPort {
  buscarBoletosPorCPF(cpfHash: string, requestId: string): Promise<BoletoSicoob[]>;
  gerarSegundaVia(nossoNumero: string, cpfHash: string, requestId: string): Promise<Buffer>;
}
