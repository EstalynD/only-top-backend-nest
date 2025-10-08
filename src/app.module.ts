import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module.js';
import { SistemaModule } from './sistema/sistema.module.js';
import { DatabaseModule } from './database/database.module.js';
import { ProfileController } from './users/profile.controller.js';
import { UsersAdminController } from './users/users.admin.controller.js';
import { UsersModule } from './users/users.module.js';
import { CloudinaryModule } from './cloudinary/cloudinary.module.js';
import { RrhhModule } from './rrhh/rrhh.module.js';
import { RbacModule } from './rbac/rbac.module.js';
import { AttendanceModule } from './rrhh/attendance/attendance.module.js';
import { MemorandumModule } from './rrhh/memorandum/memorandum.module.js';
import { PdfModule } from './pdf/pdf.module.js';
import { RecruitmentModule } from './recruitment/recruitment.module.js';
import { ChatterModule } from './chatter/chatter.module.js';
import { TrafficModule } from './traffic/traffic.module.js';
import { MoneyModule } from './money/money.module.js';
import { FinanzasModule } from './finanzas/finanzas.module.js';
import { CarteraModule } from './cartera/cartera.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    DatabaseModule, 
    MoneyModule, // Módulo global para manejo preciso de monedas
    UsersModule, 
    AuthModule, 
    CloudinaryModule, 
    SistemaModule, 
    RrhhModule, 
    AttendanceModule,
    MemorandumModule,
    RbacModule,
    PdfModule,
    RecruitmentModule,
    ChatterModule,
    TrafficModule,
    FinanzasModule, // Módulo de gestión financiera
    CarteraModule, // Módulo de facturación y cartera
  ],
  controllers: [AppController, ProfileController, UsersAdminController],
  providers: [AppService],
})
export class AppModule {}
