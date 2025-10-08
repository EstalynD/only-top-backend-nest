import { 
  IsString, IsNotEmpty, IsNumber, Min, Max, IsEnum, IsArray, 
  ValidateNested, IsOptional, IsDateString, IsMongoId, ArrayMinSize,
  IsBoolean, IsEmail, Matches, MinLength
} from 'class-validator';
import { Type } from 'class-transformer';
import { EstadoFactura } from '../factura.schema.js';
import { MetodoPago } from '../pago.schema.js';
import { TipoRecordatorio } from '../recordatorio.schema.js';

// ========== DTOs DE FACTURA ==========

export class PeriodoFacturacionDto {
  @IsNumber({}, { message: 'El año debe ser un número' })
  @Min(2020, { message: 'Año mínimo: 2020' })
  @Max(2100, { message: 'Año máximo: 2100' })
  anio!: number;

  @IsNumber({}, { message: 'El mes debe ser un número' })
  @Min(1, { message: 'Mes mínimo: 1' })
  @Max(12, { message: 'Mes máximo: 12' })
  mes!: number;

  @IsOptional()
  @IsNumber({}, { message: 'La quincena debe ser un número' })
  @IsEnum([1, 2], { message: 'Quincena debe ser 1 o 2' })
  quincena?: number;
}

export class ItemFacturaDto {
  @IsString({ message: 'El concepto debe ser un texto' })
  @IsNotEmpty({ message: 'El concepto es requerido' })
  @MinLength(3, { message: 'El concepto debe tener al menos 3 caracteres' })
  concepto!: string;

  @IsNumber({}, { message: 'La cantidad debe ser un número' })
  @Min(0, { message: 'La cantidad debe ser mayor a 0' })
  cantidad!: number;

  @IsNumber({}, { message: 'El valor unitario debe ser un número' })
  @Min(0, { message: 'El valor unitario debe ser mayor a 0' })
  valorUnitario!: number; // Se convertirá a BigInt escalado en el servicio

  @IsOptional()
  @IsString()
  notas?: string;
}

export class CreateFacturaDto {
  @IsMongoId({ message: 'ID de modelo inválido' })
  @IsNotEmpty({ message: 'El modelo es requerido' })
  modeloId!: string;

  @ValidateNested()
  @Type(() => PeriodoFacturacionDto)
  periodo!: PeriodoFacturacionDto;

  @IsArray({ message: 'Los items deben ser un array' })
  @ArrayMinSize(1, { message: 'Debe incluir al menos un item' })
  @ValidateNested({ each: true })
  @Type(() => ItemFacturaDto)
  items!: ItemFacturaDto[];

  @IsOptional()
  @IsNumber({}, { message: 'El descuento debe ser un número' })
  @Min(0, { message: 'El descuento debe ser mayor o igual a 0' })
  descuento?: number;

  @IsOptional()
  @IsString()
  notas?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Fecha de emisión inválida' })
  fechaEmision?: string; // ISO 8601, por defecto será la fecha actual

  @IsOptional()
  @IsNumber({}, { message: 'Los días de vencimiento deben ser un número' })
  @Min(1, { message: 'Los días de vencimiento deben ser al menos 1' })
  diasVencimiento?: number; // Por defecto se usa la configuración global
}

export class UpdateFacturaDto {
  @IsOptional()
  @IsEnum(EstadoFactura, { message: 'Estado de factura inválido' })
  estado?: EstadoFactura;

  @IsOptional()
  @IsString()
  notas?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Fecha de vencimiento inválida' })
  fechaVencimiento?: string;
}

export class FiltrosFacturasDto {
  @IsOptional()
  @IsMongoId()
  modeloId?: string;

  @IsOptional()
  @IsMongoId()
  contratoId?: string;

  @IsOptional()
  @IsEnum(EstadoFactura)
  estado?: EstadoFactura;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  anio?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  mes?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  quincena?: number;

  @IsOptional()
  @IsDateString()
  fechaEmisionDesde?: string;

  @IsOptional()
  @IsDateString()
  fechaEmisionHasta?: string;

  @IsOptional()
  @IsDateString()
  fechaVencimientoDesde?: string;

  @IsOptional()
  @IsDateString()
  fechaVencimientoHasta?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  limit?: number;
}

export class GenerarFacturasPorPeriodoDto {
  @IsNumber({}, { message: 'El año debe ser un número' })
  @Min(2020, { message: 'Año mínimo: 2020' })
  @Max(2100, { message: 'Año máximo: 2100' })
  anio!: number;

  @IsNumber({}, { message: 'El mes debe ser un número' })
  @Min(1, { message: 'Mes mínimo: 1' })
  @Max(12, { message: 'Mes máximo: 12' })
  mes!: number;

  @IsOptional()
  @IsNumber({}, { message: 'La quincena debe ser un número' })
  @IsEnum([1, 2], { message: 'Quincena debe ser 1 o 2' })
  quincena?: number;

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true, message: 'ID de modelo inválido' })
  modeloIds?: string[]; // Si no se proporciona, se generan para todas las modelos activas
}

// ========== DTOs DE PAGO ==========

export class RegistrarPagoDto {
  @IsMongoId({ message: 'ID de factura inválido' })
  @IsNotEmpty({ message: 'La factura es requerida' })
  facturaId!: string;

  @IsDateString({}, { message: 'Fecha de pago inválida' })
  @IsNotEmpty({ message: 'La fecha de pago es requerida' })
  fechaPago!: string; // ISO 8601

  @IsNumber({}, { message: 'El monto debe ser un número' })
  @Min(0.01, { message: 'El monto debe ser mayor a 0' })
  monto!: number; // Se convertirá a BigInt escalado en el servicio

  @IsEnum(MetodoPago, { message: 'Método de pago inválido' })
  metodoPago!: MetodoPago;

  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'La referencia debe tener al menos 3 caracteres' })
  referencia?: string;

  @IsOptional()
  @IsString()
  observaciones?: string;
}

export class FiltrosPagosDto {
  @IsOptional()
  @IsMongoId()
  facturaId?: string;

  @IsOptional()
  @IsMongoId()
  modeloId?: string;

  @IsOptional()
  @IsEnum(MetodoPago)
  metodoPago?: MetodoPago;

  @IsOptional()
  @IsDateString()
  fechaPagoDesde?: string;

  @IsOptional()
  @IsDateString()
  fechaPagoHasta?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  limit?: number;
}

// ========== DTOs DE RECORDATORIO ==========

export class EnviarRecordatorioDto {
  @IsOptional()
  @IsEnum(TipoRecordatorio, { message: 'Tipo de recordatorio inválido' })
  tipo?: TipoRecordatorio; // Si no se proporciona, se determina automáticamente

  @IsOptional()
  @IsString()
  mensajeAdicional?: string; // Mensaje personalizado adicional

  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true, message: 'Email inválido en CC' })
  emailsCC?: string[];
}

export class FiltrosRecordatoriosDto {
  @IsOptional()
  @IsMongoId()
  facturaId?: string;

  @IsOptional()
  @IsMongoId()
  modeloId?: string;

  @IsOptional()
  @IsEnum(TipoRecordatorio)
  tipo?: TipoRecordatorio;

  @IsOptional()
  @IsDateString()
  fechaEnvioDesde?: string;

  @IsOptional()
  @IsDateString()
  fechaEnvioHasta?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  limit?: number;
}

// ========== DTOs DE ESTADO DE CUENTA ==========

export class ObtenerEstadoCuentaDto {
  @IsOptional()
  @IsDateString()
  fechaInicio?: string;

  @IsOptional()
  @IsDateString()
  fechaFin?: string;
}

// ========== DTOs DE CONFIGURACIÓN ==========

export class UpdateConfiguracionCarteraDto {
  @IsOptional()
  @IsNumber({}, { message: 'Los días de vencimiento deben ser un número' })
  @Min(1, { message: 'Los días de vencimiento deben ser al menos 1' })
  @Max(90, { message: 'Los días de vencimiento no pueden ser más de 90' })
  diasVencimientoFactura?: number;

  @IsOptional()
  @IsNumber({}, { message: 'Los días antes de alerta deben ser un número' })
  @Min(1, { message: 'Los días antes de alerta deben ser al menos 1' })
  @Max(30, { message: 'Los días antes de alerta no pueden ser más de 30' })
  diasAntesAlerta1?: number;

  @IsOptional()
  @IsNumber({}, { message: 'Los días antes de alerta deben ser un número' })
  @Min(1, { message: 'Los días antes de alerta deben ser al menos 1' })
  @Max(30, { message: 'Los días antes de alerta no pueden ser más de 30' })
  diasAntesAlerta2?: number;

  @IsOptional()
  @IsNumber({}, { message: 'Los días después de alerta deben ser un número' })
  @Min(1, { message: 'Los días después de alerta deben ser al menos 1' })
  @Max(30, { message: 'Los días después de alerta no pueden ser más de 30' })
  diasDespuesAlertaMora?: number;

  @IsOptional()
  @IsNumber({}, { message: 'Los días después de alerta deben ser un número' })
  @Min(1, { message: 'Los días después de alerta deben ser al menos 1' })
  @Max(90, { message: 'Los días después de alerta no pueden ser más de 90' })
  diasDespuesAlertaMora2?: number;

  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true, message: 'Email inválido en CC' })
  emailCC?: string[];

  @IsOptional()
  @IsString()
  emailFrom?: string;

  @IsOptional()
  @IsBoolean({ message: 'La generación automática debe ser verdadero o falso' })
  generacionAutomaticaActiva?: boolean;

  @IsOptional()
  @IsNumber({}, { message: 'El día de generación debe ser un número' })
  @Min(1, { message: 'El día de generación debe ser al menos 1' })
  @Max(28, { message: 'El día de generación no puede ser más de 28' })
  diaGeneracionFacturas?: number;

  @IsOptional()
  @IsBoolean({ message: 'Los recordatorios automáticos deben ser verdadero o falso' })
  recordatoriosAutomaticosActivos?: boolean;

  @IsOptional()
  @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, { message: 'Hora inválida. Formato: HH:mm' })
  horaEjecucionRecordatorios?: string;

  @IsOptional()
  @IsBoolean({ message: 'El estado activo debe ser verdadero o falso' })
  activo?: boolean;
}

// ========== DTOs DE DASHBOARD ==========

export class FiltrosDashboardDto {
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  anio?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  mes?: number;

  @IsOptional()
  @IsDateString()
  fechaInicio?: string;

  @IsOptional()
  @IsDateString()
  fechaFin?: string;
}
