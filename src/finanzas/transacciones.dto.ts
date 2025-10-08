import {
  IsEnum,
  IsOptional,
  IsNumber,
  IsString,
  Min,
  Max,
  IsDateString,
  IsMongoId,
} from 'class-validator';
import {
  TipoTransaccion,
  OrigenTransaccion,
  EstadoTransaccion,
} from './transaccion-movimiento.schema.js';

// ========== DTOs DE CONSULTA ==========

/**
 * DTO para filtrar transacciones
 */
export class FiltrarTransaccionesDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(12)
  mes?: number;

  @IsOptional()
  @IsNumber()
  anio?: number;

  @IsOptional()
  @IsString()
  periodo?: string; // "YYYY-MM"

  @IsOptional()
  @IsEnum(TipoTransaccion)
  tipo?: TipoTransaccion;

  @IsOptional()
  @IsEnum(OrigenTransaccion)
  origen?: OrigenTransaccion;

  @IsOptional()
  @IsEnum(EstadoTransaccion)
  estado?: EstadoTransaccion;

  @IsOptional()
  @IsMongoId()
  modeloId?: string;

  @IsOptional()
  @IsString()
  referenciaId?: string;

  @IsOptional()
  @IsDateString()
  fechaDesde?: string;

  @IsOptional()
  @IsDateString()
  fechaHasta?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  limite?: number; // Para paginación

  @IsOptional()
  @IsNumber()
  @Min(0)
  saltar?: number; // Para paginación
}

// ========== DTOs DE CREACIÓN ==========

/**
 * DTO interno para crear transacción
 * (No se expone en API, solo se usa en servicios)
 */
export class CrearTransaccionDto {
  periodo!: string;
  mes!: number;
  anio!: number;
  tipo!: TipoTransaccion;
  origen!: OrigenTransaccion;
  montoUSD!: bigint;
  descripcion!: string;
  referenciaId?: string;
  referenciaModelo?: string;
  modeloId?: string;
  notas?: string;
  creadoPor?: string;
  meta?: any;
}

// ========== DTOs DE RESPUESTA ==========

/**
 * Transacción formateada para frontend
 */
export class TransaccionFormateadaDto {
  id!: string;
  periodo!: string;
  mes!: number;
  anio!: number;
  tipo!: TipoTransaccion;
  origen!: OrigenTransaccion;
  montoUSD!: number; // Convertido de BigInt
  montoFormateado!: string; // ej: "$1,234.56 USD"
  descripcion!: string;
  notas?: string | null;
  estado!: EstadoTransaccion;
  referenciaId?: string | null;
  referenciaModelo?: string | null;
  modeloId?: string | null;
  fechaCreacion!: Date;
  fechaConsolidacion?: Date | null;
  consolidadoPor?: string | null;
  creadoPor?: string | null;
  meta?: any;
}

/**
 * Respuesta paginada de transacciones
 */
export class TransaccionesPaginadasDto {
  transacciones!: TransaccionFormateadaDto[];
  total!: number;
  pagina!: number;
  limite!: number;
  totalPaginas!: number;
}

/**
 * Resumen de transacciones por periodo
 */
export class ResumenTransaccionesPeriodoDto {
  periodo!: string;
  mes!: number;
  anio!: number;

  // Totales
  totalIngresos!: number;
  totalIngresosFormateado!: string;
  totalEgresos!: number;
  totalEgresosFormateado!: string;
  saldoNeto!: number;
  saldoNetoFormateado!: string;

  // Cantidad de transacciones
  cantidadIngresos!: number;
  cantidadEgresos!: number;
  cantidadTotal!: number;

  // Por origen
  desglosePorOrigen!: {
    origen: OrigenTransaccion;
    tipo: TipoTransaccion;
    cantidad: number;
    total: number;
    totalFormateado: string;
  }[];

  // Estado
  transaccionesEnMovimiento!: number;
  transaccionesConsolidadas!: number;
  estado!: 'ABIERTO' | 'CONSOLIDADO';

  // Fechas
  fechaUltimaTransaccion?: Date;
  fechaConsolidacion?: Date | null;
}

/**
 * Saldo actual en movimiento
 */
export class SaldoMovimientoDto {
  periodoActual!: string;
  dineroMovimientoUSD!: number;
  dineroMovimientoFormateado!: string;
  dineroConsolidadoUSD!: number;
  dineroConsolidadoFormateado!: string;
  totalUSD!: number;
  totalFormateado!: string;

  // Desglose del movimiento actual
  ingresosEnMovimiento!: number;
  egresosEnMovimiento!: number;
  saldoNetoMovimiento!: number;

  // Estadísticas
  transaccionesEnMovimiento!: number;
  ultimaTransaccion?: {
    fecha: Date;
    tipo: TipoTransaccion;
    origen: OrigenTransaccion;
    monto: number;
    descripcion: string;
  };
}

/**
 * Flujo de caja detallado
 */
export class FlujoCajaDetalladoDto {
  periodo!: string;
  mes!: number;
  anio!: number;

  // Saldo inicial (consolidado anterior)
  saldoInicial!: number;
  saldoInicialFormateado!: string;

  // Movimientos del periodo
  ingresos!: {
    tipo: OrigenTransaccion;
    cantidad: number;
    total: number;
    totalFormateado: string;
  }[];

  egresos!: {
    tipo: OrigenTransaccion;
    cantidad: number;
    total: number;
    totalFormateado: string;
  }[];

  totalIngresos!: number;
  totalIngresosFormateado!: string;
  totalEgresos!: number;
  totalEgresosFormateado!: string;

  // Saldo final
  saldoFinal!: number;
  saldoFinalFormateado!: string;

  // Cambio
  cambioAbsoluto!: number;
  cambioRelativo!: number; // Porcentaje

  // Estado
  consolidado!: boolean;
  fechaConsolidacion?: Date | null;
}

/**
 * Comparativa de periodos
 */
export class ComparativaTransaccionesDto {
  periodos!: {
    periodo: string;
    ingresos: number;
    egresos: number;
    saldo: number;
    consolidado: boolean;
  }[];

  promedioIngresos!: number;
  promedioEgresos!: number;
  promedioSaldo!: number;

  mejorPeriodo!: {
    periodo: string;
    saldo: number;
  };

  peorPeriodo!: {
    periodo: string;
    saldo: number;
  };

  tendencia!: 'CRECIENTE' | 'ESTABLE' | 'DECRECIENTE';
}
