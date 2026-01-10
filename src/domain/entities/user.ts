export interface User {
  whatsappId: string;
  cpfHash: string; // SHA256 + pepper
  cpfMasked: string; // CPF mascarado
  createdAt: Date;
  lastInteractionAt: Date;
}
