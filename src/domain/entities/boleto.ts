export interface Boleto {
  id: string;
  numeroDocumento: string;
  nossoNumero: string;
  valor: number;
  vencimento: Date;
  cpfHash: string; // SHA256 + pepper do CPF
  pdfUrl?: string;
  pdfDriveId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BoletoSicoob {
  nossoNumero: string;
  numeroDocumento: string;
  valor: number;
  vencimento: string;
  situacao: string;
  pdf?: Buffer;
}
