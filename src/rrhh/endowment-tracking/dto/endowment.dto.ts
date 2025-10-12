import { IsString, IsOptional, IsBoolean, IsNumber, IsEnum, IsDateString, IsMongoId, Min, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

// ========== CATEGORÍAS ==========

export class CreateEndowmentCategoryDto {
  @IsString()
  name!: string;

  @IsString()
  description!: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateEndowmentCategoryDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ========== ELEMENTOS ==========

export class EstimatedValueDto {
  @IsNumber()
  @Min(0)
  monto!: number;

  @IsString()
  moneda!: string;
}

export class CreateEndowmentItemDto {
  @IsString()
  name!: string;

  @IsString()
  description!: string;

  @IsMongoId()
  categoryId!: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  serialNumber?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => EstimatedValueDto)
  estimatedValue?: EstimatedValueDto;

  @IsOptional()
  @IsString()
  condition?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateEndowmentItemDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsMongoId()
  categoryId?: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  serialNumber?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => EstimatedValueDto)
  estimatedValue?: EstimatedValueDto;

  @IsOptional()
  @IsString()
  condition?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ========== SEGUIMIENTO ==========

export enum EndowmentAction {
  ENTREGA = 'ENTREGA',
  DEVOLUCION = 'DEVOLUCION',
  MANTENIMIENTO = 'MANTENIMIENTO',
  REPARACION = 'REPARACION',
  REEMPLAZO = 'REEMPLAZO'
}

export class CreateEndowmentTrackingDto {
  @IsMongoId()
  empleadoId!: string;

  @IsMongoId()
  itemId!: string;

  @IsEnum(EndowmentAction)
  action!: EndowmentAction;

  @IsDateString()
  actionDate!: string;

  @IsOptional()
  @IsString()
  observations?: string;

  @IsOptional()
  @IsString()
  condition?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  referenceNumber?: string;
}

export class UpdateEndowmentTrackingDto {
  @IsOptional()
  @IsEnum(EndowmentAction)
  action?: EndowmentAction;

  @IsOptional()
  @IsDateString()
  actionDate?: string;

  @IsOptional()
  @IsString()
  observations?: string;

  @IsOptional()
  @IsString()
  condition?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  referenceNumber?: string;
}

// ========== QUERY DTOs ==========

export class EndowmentTrackingQueryDto {
  @IsOptional()
  @IsMongoId()
  empleadoId?: string;

  @IsOptional()
  @IsMongoId()
  itemId?: string;

  @IsOptional()
  @IsMongoId()
  categoryId?: string;

  @IsOptional()
  @IsEnum(EndowmentAction)
  action?: EndowmentAction;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsBoolean()
  includeInactive?: boolean;
}

export class EndowmentStatsQueryDto {
  @IsOptional()
  @IsMongoId()
  areaId?: string;

  @IsOptional()
  @IsMongoId()
  categoryId?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

// ========== RESPONSE DTOs ==========

export class EndowmentTrackingResponseDto {
  _id!: string;
  empleadoId!: {
    _id: string;
    nombre: string;
    apellido: string;
    correoElectronico: string;
    areaId: {
      _id: string;
      name: string;
      code: string;
    };
    cargoId: {
      _id: string;
      name: string;
      code: string;
    };
  };
  itemId!: {
    _id: string;
    name: string;
    description: string;
    brand?: string;
    model?: string;
    serialNumber?: string;
    estimatedValue?: {
      monto: number;
      moneda: string;
    };
  };
  categoryId!: {
    _id: string;
    name: string;
    description: string;
    icon?: string;
    color?: string;
  };
  action!: EndowmentAction;
  actionDate!: Date;
  observations?: string;
  condition?: string;
  location?: string;
  processedBy?: {
    _id: string;
    username: string;
    displayName: string;
  };
  referenceNumber?: string;
  createdAt!: Date;
  updatedAt!: Date;
}

export class EndowmentStatsResponseDto {
  totalItems!: number;
  totalCategories!: number;
  totalDeliveries!: number;
  totalReturns!: number;
  pendingReturns!: number;
  itemsByCategory!: Array<{
    category: string;
    count: number;
    totalValue: number;
  }>;
  deliveriesByMonth!: Array<{
    month: string;
    count: number;
  }>;
  topDeliveredItems!: Array<{
    item: string;
    count: number;
  }>;
}
