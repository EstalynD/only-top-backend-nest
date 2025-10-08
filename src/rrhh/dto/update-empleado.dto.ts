import { PartialType } from '@nestjs/mapped-types';
import { CreateEmpleadoDto } from './create-empleado.dto.js';
import { Types } from 'mongoose';

export class UpdateEmpleadoDto extends PartialType(CreateEmpleadoDto) {
  // Propiedades explícitas para mejor inferencia de tipos
  correoElectronico?: string;
  numeroIdentificacion?: string;
  cargoId?: string;
  areaId?: string;
  jefeInmediatoId?: string | null;
  estado?: string;
}
