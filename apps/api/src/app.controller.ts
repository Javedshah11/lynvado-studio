import { Controller, Get } from '@nestjs/common';

import {
  AppService,
  type ApiInformation,
} from './app.service.js';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
  ) {}

  @Get()
  getRoot(): ApiInformation {
    return this.appService.getApiInformation();
  }
}
