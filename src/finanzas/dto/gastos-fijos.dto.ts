import { 
  IsEnum, 
  IsNumber, 
  IsString, 
  IsOptional, 
  IsMongoId, 
  IsDateString, 
  Min, 
  Max,
  IsBoolean,
  ValidateIf,
  IsArray
} from 'class-validator';

// ========== ENUMS ==========

export enum CategoriaGasto {
  NOMINA = 'NOMINA',
  ALQUILER = 'ALQUILER',
  SERVICIOS = 'SERVICIOS',
  MARKETING = 'MARKETING',
  TECNOLOGIA = 'TECNOLOGIA',
  TRANSPORTE = 'TRANSPORTE',
  MANTENIMIENTO = 'MANTENIMIENTO',
  LEGAL = 'LEGAL',
  OTROS = 'OTROS',
}

export enum QuincenaEnum {
  PRIMERA_QUINCENA = 'PRIMERA_QUINCENA',
  SEGUNDA_QUINCENA = 'SEGUNDA_QUINCENA',
}

export enum EstadoGasto {
  PENDIENTE = 'PENDIENTE',
  APROBADO = 'APROBADO',
  PAGADO = 'PAGADO',
  RECHAZADO = 'RECHAZADO',
}

export enum EstadoResumen {
  ABIERTO = 'ABIERTO',
  EN_REVISION = 'EN_REVISION',
  CONSOLIDADO = 'CONSOLIDADO',
}

// ========== DTOs de Request ==========

/**
 * DTO para registrar un gasto fijo quincenal
 */
export class RegistrarGastoFijoDto {
  @IsNumber()
  @Min(1)
  @Max(12)
  mes!: number;

  @IsNumber()
  @Min(2020)
  @Max(2030)
  anio!: number;

  @IsEnum(QuincenaEnum)
  quincena!: QuincenaEnum;

  @IsEnum(CategoriaGasto)
  categoria!: CategoriaGasto;

  // Si es NOMINA, debe tener empleadoId
  @ValidateIf((o) => o.categoria === CategoriaGasto.NOMINA)
  @IsMongoId({ message: 'El ID del empleado debe ser válido cuando la categoría es NOMINA' })
  empleadoId?: string;

  @IsNumber()
  @Min(0.01, { message: 'El monto debe ser mayor a 0' })
  montoUSD!: number;

  @IsString()
  concepto!: string;

  @IsOptional()
  @IsString()
  proveedor?: string;

  @IsDateString()
  fechaPago!: string;

  @IsOptional()
  @IsString()
  numeroFactura?: string;

  @IsOptional()
  @IsString()
  archivoComprobante?: string;

  @IsOptional()
  @IsString()
  notas?: string;

  @IsOptional()
  @IsEnum(EstadoGasto)
  estado?: EstadoGasto;
}

/**
 * DTO para actualizar un gasto fijo
 */
export class ActualizarGastoFijoDto {
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  montoUSD?: number;

  @IsOptional()
  @IsString()
  concepto?: string;

  @IsOptional()
  @IsString()
  proveedor?: string;

  @IsOptional()
  @IsDateString()
  fechaPago?: string;

  @IsOptional()
  @IsString()
  numeroFactura?: string;

  @IsOptional()
  @IsString()
  archivoComprobante?: string;

  @IsOptional()
  @IsEnum(EstadoGasto)
  estado?: EstadoGasto;

  @IsOptional()
  @IsString()
  notas?: string;
}

/**
 * DTO para aprobar/rechazar un gasto
 */
export class AprobarGastoDto {
  @IsEnum(EstadoGasto)
  estado!: EstadoGasto; // APROBADO o RECHAZADO

  @IsOptional()
  @IsString()
  notas?: string;
}

/**
 * DTO para consolidar el resumen mensual
 */
export class ConsolidarResumenMensualDto {
  @IsNumber()
  @Min(1)
  @Max(12)
  mes!: number;

  @IsNumber()
  @Min(2020)
  @Max(2030)
  anio!: number;

  @IsOptional()
  @IsString()
  notas?: string;
}

/**
 * DTO para generar gastos de nómina automáticamente
 */
export class GenerarNominaQuincenalDto {
  @IsNumber()
  @Min(1)
  @Max(12)
  mes!: number;

  @IsNumber()
  @Min(2020)
  @Max(2030)
  anio!: number;

  @IsEnum(QuincenaEnum)
  quincena!: QuincenaEnum;

  @IsOptional()
  @IsBoolean()
  soloActivos?: boolean; // Solo empleados activos (default: true)

  // ========== NUEVAS OPCIONES DE FLEXIBILIDAD ==========

  @IsOptional()
  @IsEnum(['MENSUAL_COMPLETO', 'QUINCENAL_DIVIDIDO'])
  modoPago?: 'MENSUAL_COMPLETO' | 'QUINCENAL_DIVIDIDO'; // Default: QUINCENAL_DIVIDIDO

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  empleadosSeleccionados?: string[]; // Si se envía, solo genera para estos IDs
}

// ========== DTOs de Response ==========

/**
 * DTO de respuesta con gasto formateado
 */
export interface GastoFijoFormateadoDto {
  id: string; // Nuevo campo consistente con frontend
  _id: string; // Mantener para compatibilidad
  mes: number;
  anio: number;
  quincena: QuincenaEnum;
  periodoId: string;
  categoria: CategoriaGasto;
  empleadoId?: string;
  empleadoNombre?: string; // Populated
  concepto: string;
  proveedor?: string;
  montoUSD: number;
  montoFormateado: string; // "$ 5,000.00"
  fechaPago: string;
  numeroFactura?: string;
  archivoComprobante?: string;
  estado: EstadoGasto;
  registradoPor: string;
  fechaRegistro: string;
  aprobadoPor?: string;
  fechaAprobacion?: string;
  notas?: string;
  meta?: any;
}

/**
 * DTO de respuesta con resumen quincenal
 */
export interface ResumenQuincenalDto {
  mes: number;
  anio: number;
  quincena: QuincenaEnum;
  periodoId: string;
  
  totales: {
    totalGastosUSD: number;
    totalGastosFormateado: string;
    cantidadGastos: number;
  };
  
  porCategoria: {
    categoria: CategoriaGasto;
    totalUSD: number;
    totalFormateado: string;
    cantidad: number;
    porcentaje: number; // % del total
  }[];
  
  gastos: GastoFijoFormateadoDto[];
  
  porEstado: {
    pendientes: number;
    aprobados: number;
    pagados: number;
    rechazados: number;
  };
}

/**
 * DTO de respuesta con resumen mensual consolidado
 */
export interface ResumenMensualConsolidadoDto {
  mes: number;
  anio: number;
  periodoId: string;
  
  // Totales por quincena
  primeraQuincena: {
    totalUSD: number;
    totalFormateado: string;
    cantidadGastos: number;
  };
  
  segundaQuincena: {
    totalUSD: number;
    totalFormateado: string;
    cantidadGastos: number;
  };
  
  // Total mensual
  totalGastosMensual: {
    totalUSD: number;
    totalFormateado: string;
    cantidadGastos: number;
  };
  
  // Ingresos del mes (desde FinanzasModelo)
  totalIngresos: {
    totalUSD: number;
    totalFormateado: string;
  };
  
  // Utilidad neta final
  utilidadNeta: {
    totalUSD: number;
    totalFormateado: string;
    esPositiva: boolean;
    color: 'verde' | 'rojo'; // Para UI
  };
  
  // Comparativa mes a mes
  comparativa?: {
    mesAnterior: string; // "Septiembre 2025"
    utilidadMesAnteriorUSD: number;
    utilidadMesAnteriorFormateado: string;
    porcentajeCrecimiento: number;
    direccion: 'crecimiento' | 'decrecimiento' | 'neutro';
  };
  
  // Desglose por categoría
  desgloseCategoria: {
    categoria: CategoriaGasto;
    primeraQuincenaUSD: number;
    segundaQuincenaUSD: number;
    totalUSD: number;
    totalFormateado: string;
    cantidad: number;
    porcentaje: number;
  }[];
  
  // Estado
  estado: EstadoResumen;
  fechaConsolidacion?: string;
  
  // Metadatos
  meta: {
    mayorGasto?: {
      concepto: string;
      montoFormateado: string;
      categoria: CategoriaGasto;
    };
    categoriaMayorGasto?: CategoriaGasto;
    totalGastos: number;
    gastosPendientes: number;
    gastosAprobados: number;
    gastosPagados: number;
  };
}

/**
 * DTO para comparativa de múltiples meses
 */
export interface ComparativaMensualDto {
  periodo: string; // "Octubre 2025"
  mes: number;
  anio: number;
  totalGastosUSD: number;
  totalGastosFormateado: string;
  totalIngresosUSD: number;
  totalIngresosFormateado: string;
  utilidadNetaUSD: number;
  utilidadNetaFormateado: string;
  porcentajeCrecimiento?: number;
}
