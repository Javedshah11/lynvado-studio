import { Module } from '@nestjs/common';

import { ObjectStorage } from './object-storage.js';
import { S3ObjectStorageService } from './s3-object-storage.service.js';

@Module({
  providers: [
    S3ObjectStorageService,
    {
      provide: ObjectStorage,
      useExisting: S3ObjectStorageService,
    },
  ],
  exports: [ObjectStorage],
})
export class StorageModule {}
