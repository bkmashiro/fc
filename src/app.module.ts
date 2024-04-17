import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FcModule } from './fc/fc.module';

@Module({
  imports: [FcModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
