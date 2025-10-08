import { 
  IsString, 
  IsNotEmpty, 
  IsDateString, 
  IsEnum, 
  IsOptional, 
  IsNumber,
  Min,
  Max,
  IsMongoId,
  ValidateIf,
  IsBoolean,
} from 'class-validator';
import { PeriodicidadPago, TipoComision } from '../contrato-modelo.schema.js';

// DTO para crear contrato (borrador)
export class CreateContratoModeloDto {
  @IsMongoId()
  @IsNotEmpty()
  modeloId!: string;

  @IsDateString()
  @IsNotEmpty()
  fechaInicio!: string;

  @IsEnum(PeriodicidadPago)
  @IsNotEmpty()
  periodicidadPago!: PeriodicidadPago;

  @IsDateString()
  @IsNotEmpty()
  fechaInicioCobro!: string;

  @IsEnum(TipoComision)
  @IsNotEmpty()
  tipoComision!: TipoComision;

  // Si tipo es FIJO, este campo es obligatorio
  @ValidateIf(o => o.tipoComision === TipoComision.FIJO)
  @IsNumber()
  @Min(0)
  @Max(100)
  comisionFijaPorcentaje?: number;

  // Si tipo es ESCALONADO, este campo es obligatorio
  @ValidateIf(o => o.tipoComision === TipoComision.ESCALONADO)
  @IsMongoId()
  comisionEscalonadaId?: string;

  @IsMongoId()
  @IsNotEmpty()
  procesadorPagoId!: string;

  @IsOptional()
  @IsString()
  notasInternas?: string;

  @IsOptional()
  @IsMongoId()
  salesCloserAsignado?: string;
}

// DTO para actualizar contrato (solo si está en borrador)
export class UpdateContratoModeloDto {
  @IsOptional()
  @IsDateString()
  fechaInicio?: string;

  @IsOptional()
  @IsEnum(PeriodicidadPago)
  periodicidadPago?: PeriodicidadPago;

  @IsOptional()
  @IsDateString()
  fechaInicioCobro?: string;

  @IsOptional()
  @IsEnum(TipoComision)
  tipoComision?: TipoComision;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  comisionFijaPorcentaje?: number;

  @IsOptional()
  @IsMongoId()
  comisionEscalonadaId?: string;

  @IsOptional()
  @IsMongoId()
  procesadorPagoId?: string;

  @IsOptional()
  @IsString()
  notasInternas?: string;
}

// DTO para solicitar OTP
export class SolicitarOtpDto {
  @IsMongoId()
  @IsNotEmpty()
  contratoId!: string;
}

// DTO para firmar contrato
export class FirmarContratoDto {
  @IsMongoId()
  @IsNotEmpty()
  contratoId!: string;

  @IsString()
  @IsNotEmpty()
  nombreCompleto!: string;

  @IsString()
  @IsNotEmpty()
  numeroIdentificacion!: string;

  @IsString()
  @IsNotEmpty()
  codigoOtp!: string;

  @IsString()
  @IsNotEmpty()
  ipAddress!: string;

  @IsString()
  @IsNotEmpty()
  userAgent!: string;

  @IsOptional()
  @IsString()
  dispositivo?: string;
}

// DTO para enviar contrato para firma
export class EnviarParaFirmaDto {
  @IsMongoId()
  @IsNotEmpty()
  contratoId!: string;
}

