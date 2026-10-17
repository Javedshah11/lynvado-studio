import type { Readable } from 'node:stream';

export interface StoredObjectMetadata {
  key: string;
  contentLength: number | null;
  contentType: string | null;
  etag: string | null;
  lastModified: Date | null;
  metadata: Record<string, string>;
}

export interface PutObjectOptions {
  contentType?: string;
  contentLength?: number;
  metadata?: Record<string, string>;
}

export abstract class ObjectStorage {
  abstract ensureBucket(): Promise<void>;

  abstract createUploadUrl(
    key: string,
    options?: PutObjectOptions,
    expiresInSeconds?: number,
  ): Promise<string>;

  abstract createDownloadUrl(
    key: string,
    expiresInSeconds?: number,
    downloadName?: string,
  ): Promise<string>;

  abstract putObject(
    key: string,
    body: Readable | Uint8Array | string,
    options?: PutObjectOptions,
  ): Promise<void>;

  abstract getObject(key: string): Promise<Readable>;

  abstract statObject(
    key: string,
  ): Promise<StoredObjectMetadata | null>;

  abstract deleteObject(key: string): Promise<void>;
}

export function assertValidStorageKey(key: string): void {
  const segments = key.split('/');

  if (
    !key ||
    key.startsWith('/') ||
    key.includes('\\') ||
    segments.some((segment) => !segment || segment === '.' || segment === '..')
  ) {
    throw new Error('Invalid object storage key.');
  }
}
