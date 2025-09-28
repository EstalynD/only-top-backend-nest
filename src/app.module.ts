import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module.js';
import { SistemaController } from './sistema/sistema.controller.js';
import { DatabaseModule } from './database/database.module.js';
import { ProfileController } from './users/profile.controller.js';
import { UsersAdminController } from './users/users.admin.controller.js';
import { UsersModule } from './users/users.module.js';
import { CloudinaryModule } from './cloudinary/cloudinary.module.js';

@Module({
  imports: [DatabaseModule, UsersModule, AuthModule, CloudinaryModule],
  controllers: [AppController, SistemaController, ProfileController, UsersAdminController],
  providers: [AppService],
})
export class AppModule {}
