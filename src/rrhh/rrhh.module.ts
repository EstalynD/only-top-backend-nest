import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AreaEntity, AreaSchema } from './area.schema.js';
import { CargoEntity, CargoSchema } from './cargo.schema.js';
import { EmpleadoEntity, EmpleadoSchema } from './empleado.schema.js';
import { ContratoEntity, ContratoSchema } from './contrato.schema.js';
import { PlantillaContratoEntity, PlantillaContratoSchema } from './plantilla-contrato.schema.js';
import { DocumentoEntity, DocumentoSchema } from './documento.schema.js';
import { ModeloEntity, ModeloSchema } from './modelo.schema.js';
import { ContratoModeloEntity, ContratoModeloSchema } from './contrato-modelo.schema.js';
import { HorasExtrasEntity, HorasExtrasSchema } from './horas-extras.schema.js';
import { ChatterSaleEntity, ChatterSaleSchema } from '../chatter/chatter-sale.schema.js';
import { RrhhService } from './rrhh.service.js';
import { RrhhController } from './rrhh.controller.js';
import { RrhhSeederService } from './rrhh.seeder.js';
import { EmpleadosService } from './empleados.service.js';
import { EmpleadosController } from './empleados.controller.js';
import { ContratosService } from './contratos.service.js';
import { ContratosController } from './contratos.controller.js';
import { DocumentosService } from './documentos.service.js';
import { DocumentosController } from './documentos.controller.js';
import { ModelosService } from './modelos.service.js';
import { ModelosController } from './modelos.controller.js';
import { ContratosModeloService } from './contratos-modelo.service.js';
import { ContratosModeloController, FirmaPublicaController } from './contratos-modelo.controller.js';
import { HorasExtrasService } from './horas-extras.service.js';
import { HorasExtrasController } from './horas-extras.controller.js';
import { AuthModule } from '../auth/auth.module.js';
import { CloudinaryModule } from '../cloudinary/cloudinary.module.js';
import { UsersModule } from '../users/users.module.js';
import { SistemaModule } from '../sistema/sistema.module.js';
import { FinanzasModule } from '../finanzas/finanzas.module.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AreaEntity.name, schema: AreaSchema },
      { name: CargoEntity.name, schema: CargoSchema },
      { name: EmpleadoEntity.name, schema: EmpleadoSchema },
      { name: ContratoEntity.name, schema: ContratoSchema },
      { name: PlantillaContratoEntity.name, schema: PlantillaContratoSchema },
      { name: DocumentoEntity.name, schema: DocumentoSchema },
      { name: ModeloEntity.name, schema: ModeloSchema },
      { name: ContratoModeloEntity.name, schema: ContratoModeloSchema },
      { name: HorasExtrasEntity.name, schema: HorasExtrasSchema },
      { name: ChatterSaleEntity.name, schema: ChatterSaleSchema },
    ]),
    AuthModule,
    CloudinaryModule,
    UsersModule,
    forwardRef(() => SistemaModule),
    forwardRef(() => FinanzasModule),
  ],
  providers: [
    RrhhService, 
    RrhhSeederService, 
    EmpleadosService, 
    ContratosService, 
    DocumentosService, 
    ModelosService,
    ContratosModeloService,
    HorasExtrasService,
  ],
  controllers: [
    RrhhController, 
    EmpleadosController, 
    ContratosController, 
    DocumentosController, 
    ModelosController,
    ContratosModeloController,
    FirmaPublicaController,
    HorasExtrasController,
  ],
  exports: [
    MongooseModule, 
    RrhhService, 
    RrhhSeederService, 
    EmpleadosService, 
    ContratosService, 
    DocumentosService, 
    ModelosService,
    ContratosModeloService,
    HorasExtrasService,
  ],
})
export class RrhhModule {}
