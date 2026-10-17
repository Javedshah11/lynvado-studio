import { createReadStream, createWriteStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';

import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

import { workerConfig } from './config.js';

export const storageClient = new S3Client({
  endpoint: workerConfig.STORAGE_ENDPOINT,
  region: workerConfig.STORAGE_REGION,
  forcePathStyle: workerConfig.STORAGE_FORCE_PATH_STYLE,
  credentials: {
    accessKeyId: workerConfig.STORAGE_ACCESS_KEY,
    secretAccessKey: workerConfig.STORAGE_SECRET_KEY,
  },
});

export async function downloadObject(key: string, destination: string): Promise<void> {
  const response = await storageClient.send(
    new GetObjectCommand({ Bucket: workerConfig.STORAGE_BUCKET, Key: key }),
  );

  if (!response.Body) throw new Error(`Storage object ${key} has no body.`);
  await pipeline(response.Body as NodeJS.ReadableStream, createWriteStream(destination));
}

export async function uploadObject(
  key: string,
  source: string,
  contentType: string,
): Promise<{ etag: string | null; sizeBytes: number }> {
  const file = await stat(source);
  const response = await storageClient.send(
    new PutObjectCommand({
      Bucket: workerConfig.STORAGE_BUCKET,
      Key: key,
      Body: createReadStream(source),
      ContentLength: file.size,
      ContentType: contentType,
    }),
  );

  return {
    etag: response.ETag?.replaceAll('"', '') ?? null,
    sizeBytes: file.size,
  };
}
