import { PartialType } from '@nestjs/mapped-types';
import { CreateModeloDto } from './create-modelo.dto.js';

export class UpdateModeloDto extends PartialType(CreateModeloDto) {}

