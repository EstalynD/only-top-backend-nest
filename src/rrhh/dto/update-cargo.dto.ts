import { PartialType } from '@nestjs/mapped-types';
import { CreateCargoDto } from './create-cargo.dto.js';
import { Types } from 'mongoose';

export class UpdateCargoDto extends PartialType(CreateCargoDto) {
	// Propiedades explícitas que usamos en el servicio
	code?: string;
	areaId?: Types.ObjectId;
}
