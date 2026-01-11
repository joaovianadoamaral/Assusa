import { RequestLog } from '../../../domain/entities/request.js';

export interface SheetsPort {
  logRequest(request: RequestLog, requestId: string): Promise<void>;
  findRequestsByCpfHash(cpfHash: string, requestId: string): Promise<RequestLog[]>;
  deleteRequestsByCpfHash(cpfHash: string, requestId: string): Promise<void>;
}
