/**
 * Storage Port — File upload and storage provider interfaces
 */

/**
 * File uploaded via multer or similar middleware
 */
export interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

/**
 * Result of a successful file upload
 */
export interface UploadResult {
  url: string;
  filename: string;
  size: number;
  mimetype: string;
}

/**
 * FileSystem abstraction for dependency injection (testability)
 */
export interface FileSystem {
  existsSync(path: string): boolean;
  mkdirSync(path: string, options?: { recursive?: boolean }): void;
  writeFile(path: string, data: Buffer): Promise<void>;
  unlink(path: string): Promise<void>;
}

/**
 * Storage provider for file uploads (logos, tier photos, segment images)
 */
export interface StorageProvider {
  uploadLogo(file: UploadedFile, tenantId: string): Promise<UploadResult>;
  uploadTierPhoto(file: UploadedFile, tierId: string, tenantId?: string): Promise<UploadResult>;
  uploadSegmentImage(file: UploadedFile, tenantId: string): Promise<UploadResult>;
  uploadLandingPageImage(file: UploadedFile, tenantId: string): Promise<UploadResult>;
  deleteLogo(filename: string): Promise<void>;
  deleteTierPhoto(filename: string): Promise<void>;
  deleteSegmentImage(url: string, tenantId: string): Promise<void>;
  deleteLandingPageImage(url: string, tenantId: string): Promise<void>;
}
