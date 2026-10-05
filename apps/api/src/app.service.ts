import { Injectable } from '@nestjs/common';

export interface ApiInformation {
  name: string;
  description: string;
  version: string;
  status: 'running';
}

@Injectable()
export class AppService {
  getApiInformation(): ApiInformation {
    return {
      name: 'Lynvado Studio API',
      description:
        'Backend API for the Lynvado Studio AI video platform.',
      version: '0.1.0',
      status: 'running',
    };
  }
}