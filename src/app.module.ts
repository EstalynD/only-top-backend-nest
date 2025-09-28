import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module.js';
import { RbacModule } from './rbac/rbac.module.js';
import { SistemaController } from './sistema/sistema.controller.js';
import { DatabaseModule } from './database/database.module.js';

@Module({
  imports: [DatabaseModule, RbacModule, AuthModule],
  controllers: [AppController, SistemaController],
  providers: [AppService],
})
export class AppModule {}
