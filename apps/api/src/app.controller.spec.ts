import { Test, TestingModule } from '@nestjs/testing';

import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

describe('AppController', () => {
  let controller: AppController;

  beforeEach(async () => {
    const module: TestingModule =
      await Test.createTestingModule({
        controllers: [AppController],
        providers: [AppService],
      }).compile();

    controller =
      module.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return Lynvado Studio API information', () => {
      expect(controller.getRoot()).toEqual({
        name: 'Lynvado Studio API',
        description:
          'Backend API for the Lynvado Studio AI video platform.',
        version: '0.1.0',
        status: 'running',
      });
    });
  });
});
