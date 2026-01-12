import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SicoobTitleRepositoryAdapter } from '../../src/adapters/sicoob/sicoob-title-repository-adapter.js';
import { SicoobPort } from '../../src/application/ports/driven/sicoob-port.js';
import { Logger } from '../../src/application/ports/driven/logger-port.js';
import { BoletoSicoob } from '../../src/domain/entities/boleto.js';

describe('SicoobTitleRepositoryAdapter', () => {
  let adapter: SicoobTitleRepositoryAdapter;
  let mockSicoobPort: SicoobPort;
  let mockLogger: Logger;

  beforeEach(() => {
    mockSicoobPort = {
      buscarBoletosPorCPF: vi.fn(),
      gerarSegundaVia: vi.fn(),
    };

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };

    adapter = new SicoobTitleRepositoryAdapter(mockSicoobPort, mockLogger);
  });

  it('deve converter BoletoSicoob[] em Title[] filtrando apenas boletos abertos', async () => {
    const cpfHash = 'abc123hash';
    const boletos: BoletoSicoob[] = [
      {
        nossoNumero: '12345',
        numeroDocumento: 'DOC001',
        valor: 100.50,
        vencimento: '2024-12-31',
        situacao: 'Aberto',
      },
      {
        nossoNumero: '12346',
        numeroDocumento: 'DOC002',
        valor: 200.75,
        vencimento: '2024-11-30',
        situacao: 'Liquidado',
      },
      {
        nossoNumero: '12347',
        numeroDocumento: 'DOC003',
        valor: 300.00,
        vencimento: '2024-10-31',
        situacao: 'ABERTO',
      },
    ];

    vi.mocked(mockSicoobPort.buscarBoletosPorCPF).mockResolvedValue(boletos);

    const titles = await adapter.findOpenTitlesByCpfHash(cpfHash);

    expect(titles).toHaveLength(2);
    expect(titles[0].nossoNumero).toBe('12345');
    expect(titles[0].valor).toBe(100.50);
    expect(titles[0].status).toBe('Aberto');
    expect(titles[1].nossoNumero).toBe('12347');
    expect(titles[1].status).toBe('ABERTO');
    expect(mockSicoobPort.buscarBoletosPorCPF).toHaveBeenCalledWith(cpfHash, expect.any(String));
  });

  it('deve retornar array vazio quando não há boletos abertos', async () => {
    const cpfHash = 'abc123hash';
    const boletos: BoletoSicoob[] = [
      {
        nossoNumero: '12345',
        numeroDocumento: 'DOC001',
        valor: 100.50,
        vencimento: '2024-12-31',
        situacao: 'Liquidado',
      },
    ];

    vi.mocked(mockSicoobPort.buscarBoletosPorCPF).mockResolvedValue(boletos);

    const titles = await adapter.findOpenTitlesByCpfHash(cpfHash);

    expect(titles).toHaveLength(0);
  });

  it('deve lançar erro quando SicoobPort falha', async () => {
    const cpfHash = 'abc123hash';
    const error = new Error('Erro ao buscar boletos');

    vi.mocked(mockSicoobPort.buscarBoletosPorCPF).mockRejectedValue(error);

    await expect(adapter.findOpenTitlesByCpfHash(cpfHash)).rejects.toThrow('Falha ao buscar títulos');
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ cpfHash, error: 'Erro ao buscar boletos' }),
      'Erro ao buscar títulos no Sicoob'
    );
  });

  it('deve converter vencimento string para Date', async () => {
    const cpfHash = 'abc123hash';
    const boletos: BoletoSicoob[] = [
      {
        nossoNumero: '12345',
        numeroDocumento: 'DOC001',
        valor: 100.50,
        vencimento: '2024-12-31',
        situacao: 'Aberto',
      },
    ];

    vi.mocked(mockSicoobPort.buscarBoletosPorCPF).mockResolvedValue(boletos);

    const titles = await adapter.findOpenTitlesByCpfHash(cpfHash);

    expect(titles[0].vencimento).toBeInstanceOf(Date);
    expect(titles[0].vencimento?.getFullYear()).toBe(2024);
  });
});
