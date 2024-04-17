import { Test, TestingModule } from '@nestjs/testing';
import { FcService } from './fc.service';

describe('FcService', () => {
  let service: FcService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FcService],
    }).compile();

    service = module.get<FcService>(FcService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
