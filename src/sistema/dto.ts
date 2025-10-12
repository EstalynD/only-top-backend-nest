import { IsDateString, IsNotEmpty, IsNumber, IsObject, IsOptional, Min, IsBoolean, IsArray, ValidateNested, Max, IsEnum, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTrmDto {
  // Fecha/hora ISO de vigencia. Se recomienda normalizar a 00:00:00Z del día de vigencia
  @IsDateString()
  effectiveAt!: string;

  // COP por 1 USD
  @IsNumber()
  @Min(0)
  copPerUsd!: number;

  // Datos opcionales de auditoría
  @IsOptional()
  @IsObject()
  meta?: Record<string, any>;
}

export class ListTrmQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number;
}

export type CurrencyCode = 'USD' | 'COP';
export type DisplayFormat = 'CODE_SYMBOL' | 'SYMBOL_ONLY';

export class UpdateCurrencyDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumFractionDigits?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maximumFractionDigits?: number;

  @IsOptional()
  displayFormat?: DisplayFormat;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateTimezoneDto {
  @IsNotEmpty()
  timezone!: 'Colombia' | 'Peru';
}

export type TimeFormat = '12h' | '24h';

export class UpdateTimeFormatDto {
  @IsNotEmpty()
  format!: TimeFormat;
}

export class EmailConfigDto {
  @IsOptional()
  provider?: string;

  @IsOptional()
  host?: string;

  @IsOptional()
  @IsNumber()
  port?: number;

  @IsOptional()
  @IsBoolean()
  secure?: boolean;

  @IsOptional()
  authUser?: string;

  @IsOptional()
  authPass?: string;

  @IsOptional()
  from?: string;

  @IsOptional()
  fromName?: string;

  @IsOptional()
  replyTo?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;
}

export class TestEmailDto {
  @IsNotEmpty()
  to!: string;
}

// === FINANCE DTOS ===

export type CommissionType = 'PERCENTAGE' | 'FIXED_USD' | 'FIXED_COP';

export class CreatePaymentProcessorDto {
  @IsNotEmpty()
  name!: string;

  @IsNotEmpty()
  commissionType!: CommissionType;

  @IsNumber()
  @Min(0)
  commissionValue!: number;

  @IsDateString()
  effectiveDate!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  description?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class UpdatePaymentProcessorDto {
  @IsOptional()
  name?: string;

  @IsOptional()
  commissionType?: CommissionType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  commissionValue?: number;

  @IsOptional()
  @IsDateString()
  effectiveDate?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  description?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class CommissionRuleDto {
  @IsNumber()
  @Min(0)
  minUsd!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxUsd?: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  percentage!: number;
}

export class CreateCommissionScaleDto {
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CommissionRuleDto)
  rules!: CommissionRuleDto[];

  @IsOptional()
  description?: string;
}

export class UpdateCommissionScaleDto {
  @IsOptional()
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CommissionRuleDto)
  rules?: CommissionRuleDto[];

  @IsOptional()
  description?: string;
}

// === INTERNAL COMMISSIONS DTOS ===

export class PerformanceScaleDto {
  @IsNumber()
  @Min(0)
  @Max(1000) // Allow up to 1000% performance
  fromPercent!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  toPercent?: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  commissionPercent!: number;
}

export class UpdateInternalCommissionsDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  salesCloserPercent?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(12)
  salesCloserMonths?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  traffickerPercent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  chattersMinPercent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  chattersMaxPercent?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PerformanceScaleDto)
  chattersPerformanceScale?: PerformanceScaleDto[];

  @IsOptional()
  description?: string;
}

// === ATTENDANCE CONFIGURATION DTOS ===

export type ShiftType = 'AM' | 'PM' | 'MADRUGADA' | 'CUSTOM';

export class TimeSlotDto {
  @IsNotEmpty()
  startTime!: string; // Format: "HH:mm"

  @IsNotEmpty()
  endTime!: string; // Format: "HH:mm"
}

export class ShiftDto {
  @IsNotEmpty()
  id!: string;

  @IsNotEmpty()
  name!: string;

  @IsNotEmpty()
  type!: ShiftType;

  @ValidateNested()
  @Type(() => TimeSlotDto)
  timeSlot!: TimeSlotDto;

  @IsOptional()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class FixedScheduleDto {
  @ValidateNested()
  @Type(() => TimeSlotDto)
  monday!: TimeSlotDto;

  @ValidateNested()
  @Type(() => TimeSlotDto)
  tuesday!: TimeSlotDto;

  @ValidateNested()
  @Type(() => TimeSlotDto)
  wednesday!: TimeSlotDto;

  @ValidateNested()
  @Type(() => TimeSlotDto)
  thursday!: TimeSlotDto;

  @ValidateNested()
  @Type(() => TimeSlotDto)
  friday!: TimeSlotDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => TimeSlotDto)
  saturday?: TimeSlotDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => TimeSlotDto)
  sunday?: TimeSlotDto;

  // Configuración opcional de almuerzo para horario fijo
  @IsOptional()
  @IsBoolean()
  lunchBreakEnabled?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => TimeSlotDto)
  lunchBreak?: TimeSlotDto;
}

export class UpdateAttendanceConfigDto {
  @IsOptional()
  @IsBoolean()
  fixedScheduleEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  rotatingShiftsEnabled?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => FixedScheduleDto)
  fixedSchedule?: FixedScheduleDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ShiftDto)
  rotatingShifts?: ShiftDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(240)
  breakDurationMinutes?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(60)
  toleranceMinutes?: number;

  @IsOptional()
  @IsBoolean()
  weekendEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  overtimeEnabled?: boolean;

  @IsOptional()
  timezone?: string;

  @IsOptional()
  description?: string;

  // Fecha/hora global (ISO) desde la cual se permite registrar asistencia
  // Ej: "2025-01-01T08:00:00.000Z". Si se omite, no cambia el valor.
  @IsOptional()
  @IsDateString()
  attendanceEnabledFrom?: string;

  // ========== CONFIGURACIÓN DE SUPERNUMERARIOS ==========
  
  // Modalidad de trabajo del supernumerario: REPLACEMENT (reemplaza turnos) o FIXED_SCHEDULE (horario fijo)
  @IsOptional()
  @IsEnum(['REPLACEMENT', 'FIXED_SCHEDULE'])
  supernumeraryMode?: 'REPLACEMENT' | 'FIXED_SCHEDULE';

  // IDs de los turnos que el supernumerario puede cubrir en modo REPLACEMENT
  // Ejemplo: ['shift_am', 'shift_pm'] permite cubrir mañana y tarde, pero no madrugada
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedReplacementShifts?: string[];

  // Horario fijo específico para supernumerarios cuando está en modo FIXED_SCHEDULE
  @IsOptional()
  @ValidateNested()
  @Type(() => FixedScheduleDto)
  supernumeraryFixedSchedule?: FixedScheduleDto;
}

export type CurrencyFormatSpec = {
  code: CurrencyCode;
  symbol: string;
  minimumFractionDigits: number;
  maximumFractionDigits: number;
  displayFormat: DisplayFormat;
  isActive: boolean;
  sample: string;
};


