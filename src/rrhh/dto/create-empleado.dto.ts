import { IsString, IsNotEmpty, IsOptional, IsEmail, IsDateString, IsNumber, IsEnum, IsMongoId, ValidateNested, IsPositive, MinLength, MaxLength } from 'class-validator';
import { Transform, Type } from 'class-transformer';

class SalarioDto {
  @IsNumber()
  @IsPositive()
  monto!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(3)
  moneda!: string;
}

class ContactoEmergenciaDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  nombre!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(7)
  @MaxLength(20)
  @Transform(({ value }) => value?.trim())
  telefono!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Transform(({ value }) => value?.trim() || null)
  relacion?: string;
}

class InformacionBancariaDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  nombreBanco!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(20)
  @Transform(({ value }) => value?.trim())
  numeroCuenta!: string;

  @IsEnum(['AHORROS', 'CORRIENTE'])
  tipoCuenta!: string;
}

export class CreateEmpleadoDto {
  // Información personal básica
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(50)
  @Transform(({ value }) => value?.trim())
  nombre!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(50)
  @Transform(({ value }) => value?.trim())
  apellido!: string;

  @IsEmail()
  @Transform(({ value }) => value?.toLowerCase().trim())
  correoElectronico!: string;

  @IsOptional()
  @IsEmail()
  @Transform(({ value }) => value?.toLowerCase().trim() || null)
  correoPersonal?: string | null;

  @IsOptional()
  @IsEmail()
  @Transform(({ value }) => value?.toLowerCase().trim() || null)
  correoCorporativo?: string | null;

  @IsString()
  @IsNotEmpty()
  @MinLength(7)
  @MaxLength(20)
  @Transform(({ value }) => value?.trim())
  telefono!: string;

  // Información laboral
  @IsMongoId()
  @Transform(({ value }) => (typeof value === 'string' ? value : String(value)))
  cargoId!: string;

  @IsMongoId()
  @Transform(({ value }) => (typeof value === 'string' ? value : String(value)))
  areaId!: string;

  @IsOptional()
  @IsMongoId()
  @Transform(({ value }) => (value ? (typeof value === 'string' ? value : String(value)) : null))
  jefeInmediatoId?: string | null;

  @IsDateString()
  fechaInicio!: string;

  @ValidateNested()
  @Type(() => SalarioDto)
  salario!: SalarioDto;

  @IsEnum(['PRESTACION_SERVICIOS', 'TERMINO_FIJO', 'TERMINO_INDEFINIDO', 'OBRA_LABOR', 'APRENDIZAJE'])
  tipoContrato!: string;

  // Información de identificación
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(20)
  @Transform(({ value }) => value?.trim())
  numeroIdentificacion!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(200)
  @Transform(({ value }) => value?.trim())
  direccion!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  ciudad!: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Transform(({ value }) => value?.trim() || 'Colombia')
  pais?: string;

  // Contacto de emergencia
  @ValidateNested()
  @Type(() => ContactoEmergenciaDto)
  contactoEmergencia!: ContactoEmergenciaDto;

  @IsDateString()
  fechaNacimiento!: string;

  @IsOptional()
  @IsEnum(['ACTIVO', 'INACTIVO', 'SUSPENDIDO', 'TERMINADO'])
  estado?: string;

  // Información bancaria
  @ValidateNested()
  @Type(() => InformacionBancariaDto)
  informacionBancaria!: InformacionBancariaDto;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  fotoPerfil?: string | null;
}
