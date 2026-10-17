import { Readable } from 'node:stream';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  NoSuchBucket,
  NotFound,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import {
  assertValidStorageKey,
  ObjectStorage,
  type PutObjectOptions,
  type StoredObjectMetadata,
} from './object-storage.js';

@Injectable()
export class S3ObjectStorageService extends ObjectStorage {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly defaultSignedUrlTtl: number;
  private bucketPromise: Promise<void> | null = null;

  constructor(configService: ConfigService) {
    super();

    this.bucket = configService.getOrThrow<string>('STORAGE_BUCKET');
    this.defaultSignedUrlTtl = configService.getOrThrow<number>(
      'STORAGE_SIGNED_URL_TTL_SECONDS',
    );

    this.client = new S3Client({
      endpoint: configService.getOrThrow<string>('STORAGE_ENDPOINT'),
      region: configService.getOrThrow<string>('STORAGE_REGION'),
      forcePathStyle: configService.getOrThrow<boolean>(
        'STORAGE_FORCE_PATH_STYLE',
      ),
      credentials: {
        accessKeyId: configService.getOrThrow<string>('STORAGE_ACCESS_KEY'),
        secretAccessKey: configService.getOrThrow<string>('STORAGE_SECRET_KEY'),
      },
    });
  }

  async ensureBucket(): Promise<void> {
    this.bucketPromise ??= this.createBucketIfMissing().catch((error) => {
      this.bucketPromise = null;
      throw error;
    });

    return this.bucketPromise;
  }

  async createUploadUrl(
    key: string,
    options: PutObjectOptions = {},
    expiresInSeconds = this.defaultSignedUrlTtl,
  ): Promise<string> {
    assertValidStorageKey(key);
    await this.ensureBucket();

    return getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: options.contentType,
        ContentLength: options.contentLength,
        Metadata: options.metadata,
      }),
      { expiresIn: expiresInSeconds },
    );
  }

  async createDownloadUrl(
    key: string,
    expiresInSeconds = this.defaultSignedUrlTtl,
    downloadName?: string,
  ): Promise<string> {
    assertValidStorageKey(key);
    await this.ensureBucket();

    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentDisposition: downloadName
          ? `attachment; filename="${downloadName.replaceAll(/["\\\r\n]/g, '_')}"`
          : undefined,
      }),
      { expiresIn: expiresInSeconds },
    );
  }

  async putObject(
    key: string,
    body: Readable | Uint8Array | string,
    options: PutObjectOptions = {},
  ): Promise<void> {
    assertValidStorageKey(key);
    await this.ensureBucket();

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: options.contentType,
        ContentLength: options.contentLength,
        Metadata: options.metadata,
      }),
    );
  }

  async getObject(key: string): Promise<Readable> {
    assertValidStorageKey(key);
    await this.ensureBucket();

    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );

    if (!(result.Body instanceof Readable)) {
      throw new Error('Object storage returned an unsupported response body.');
    }

    return result.Body;
  }

  async statObject(key: string): Promise<StoredObjectMetadata | null> {
    assertValidStorageKey(key);
    await this.ensureBucket();

    try {
      const result = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );

      return {
        key,
        contentLength: result.ContentLength ?? null,
        contentType: result.ContentType ?? null,
        etag: result.ETag?.replaceAll('"', '') ?? null,
        lastModified: result.LastModified ?? null,
        metadata: result.Metadata ?? {},
      };
    } catch (error) {
      if (error instanceof NotFound || this.hasStatus(error, 404)) return null;
      throw error;
    }
  }

  async deleteObject(key: string): Promise<void> {
    assertValidStorageKey(key);
    await this.ensureBucket();
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  private async createBucketIfMissing(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch (error) {
      if (!(error instanceof NoSuchBucket) && !this.hasStatus(error, 404)) {
        throw error;
      }

      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
    }
  }

  private hasStatus(error: unknown, status: number): boolean {
    if (!error || typeof error !== 'object' || !('$metadata' in error)) return false;

    const metadata = (error as { $metadata?: { httpStatusCode?: number } }).$metadata;
    return metadata?.httpStatusCode === status;
  }
}
