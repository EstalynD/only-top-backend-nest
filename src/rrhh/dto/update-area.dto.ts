import { PartialType } from '@nestjs/mapped-types';
import { CreateAreaDto } from './create-area.dto.js';

export class UpdateAreaDto extends PartialType(CreateAreaDto) {
	// Propiedades explícitas para mejor inferencia de tipos en servicios
	code?: string;
}
