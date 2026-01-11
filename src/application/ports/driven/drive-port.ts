export interface DrivePort {
  uploadFile(fileName: string, fileContent: Buffer, mimeType: string, requestId: string): Promise<string>;
  deleteFile(fileId: string, requestId: string): Promise<void>;
  getFileUrl(fileId: string): string;
}
