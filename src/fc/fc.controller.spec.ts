import { Test, TestingModule } from '@nestjs/testing';
import { FcController } from './fc.controller';
import { FcService } from './fc.service';

describe('FcController', () => {
  let controller: FcController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FcController],
      providers: [FcService],
    }).compile();

    controller = module.get<FcController>(FcController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
