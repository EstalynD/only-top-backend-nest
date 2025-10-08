import { IsString, IsNumber, IsDateString, IsArray, IsOptional, ValidateNested, IsEnum, Min, ArrayMinSize, ArrayMaxSize, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { EstadoModeloCerrada } from '../recruitment-activity.schema.js';

// DTO para contacto obtenido
export class ContactoObtenidoDto {
  @IsString()
  @IsNotEmpty()
  numero!: string;

  @IsOptional()
  @IsString()
  perfilInstagram?: string;

  @IsOptional()
  @IsString()
  nombreProspecto?: string;

  @IsOptional()
  @IsDateString()
  fechaObtencion?: string;
}

// DTO para modelo cerrada
export class ModeloCerradaDto {
  @IsString()
  @IsNotEmpty()
  nombreModelo!: string;

  @IsString()
  @IsNotEmpty()
  perfilInstagram!: string;

  @IsArray()
  @ArrayMinSize(3)
  @ArrayMaxSize(3)
  @IsNumber({}, { each: true })
  @Min(0, { each: true })
  facturacionUltimosTresMeses!: number[];

  @IsDateString()
  fechaCierre!: string;

  @IsOptional()
  @IsEnum(EstadoModeloCerrada)
  estado?: EstadoModeloCerrada;

  @IsOptional()
  @IsString()
  modeloId?: string; // ID de la modelo si ya está registrada

  @IsOptional()
  @IsString()
  notas?: string;
}

// DTO para crear actividad
export class CreateRecruitmentActivityDto {
  @IsDateString()
  fechaActividad!: string;

  @IsOptional()
  @IsString()
  salesCloserId?: string; // Opcional, se puede autocompletar del usuario logueado

  @IsNumber()
  @Min(0)
  cuentasTexteadas!: number;

  @IsNumber()
  @Min(0)
  likesRealizados!: number;

  @IsNumber()
  @Min(0)
  comentariosRealizados!: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContactoObtenidoDto)
  contactosObtenidos?: ContactoObtenidoDto[];

  @IsNumber()
  @Min(0)
  reunionesAgendadas!: number;

  @IsNumber()
  @Min(0)
  reunionesRealizadas!: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ModeloCerradaDto)
  modelosCerradas?: ModeloCerradaDto[];

  @IsOptional()
  @IsString()
  notasDia?: string;
}

// DTO para actualizar actividad
export class UpdateRecruitmentActivityDto {
  @IsOptional()
  @IsDateString()
  fechaActividad?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cuentasTexteadas?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  likesRealizados?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  comentariosRealizados?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContactoObtenidoDto)
  contactosObtenidos?: ContactoObtenidoDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  reunionesAgendadas?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  reunionesRealizadas?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ModeloCerradaDto)
  modelosCerradas?: ModeloCerradaDto[];

  @IsOptional()
  @IsString()
  notasDia?: string;
}

// DTO para vincular modelo cerrada con modelo registrada
export class VincularModeloDto {
  @IsString()
  @IsNotEmpty()
  actividadId!: string;

  @IsNumber()
  @Min(0)
  modeloCerradaIndex!: number; // Índice de la modelo cerrada en el array

  @IsString()
  @IsNotEmpty()
  modeloId!: string; // ID de la modelo en el sistema
}

