import { IsOptional, IsNumber, Min, Max, IsEnum, IsString, IsMongoId } from 'class-validator';

/**
 * DTO para calcular finanzas de una modelo en un período específico
 */
export class CalcularFinanzasDto {
  @IsMongoId({ message: 'ID de modelo inválido' })
  modeloId!: string;

  @IsNumber()
  @Min(1, { message: 'El mes debe estar entre 1 y 12' })
  @Max(12, { message: 'El mes debe estar entre 1 y 12' })
  mes!: number;

  @IsNumber()
  @Min(2020, { message: 'El año debe ser mayor o igual a 2020' })
  anio!: number;

  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'La comisión bancaria debe ser un valor positivo' })
  @Max(100, { message: 'La comisión bancaria no puede exceder 100%' })
  porcentajeComisionBanco?: number; // Default: 2%
}

/**
 * DTO para recalcular finanzas de múltiples modelos
 */
export class RecalcularFinanzasDto {
  @IsNumber()
  @Min(1)
  @Max(12)
  mes!: number;

  @IsNumber()
  @Min(2020)
  anio!: number;

  @IsOptional()
  @IsMongoId({ each: true, message: 'IDs de modelos inválidos' })
  modeloIds?: string[]; // Si no se especifica, recalcula todas

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  porcentajeComisionBanco?: number;
}

/**
 * DTO para actualizar estado de finanzas
 */
export class ActualizarEstadoFinanzasDto {
  @IsEnum(['CALCULADO', 'PENDIENTE_REVISION', 'APROBADO', 'PAGADO'], {
    message: 'Estado inválido. Use: CALCULADO, PENDIENTE_REVISION, APROBADO, PAGADO',
  })
  estado!: string;

  @IsOptional()
  @IsString()
  notasInternas?: string;
}

/**
 * DTO para actualizar configuración de comisión bancaria
 */
export class ActualizarComisionBancoDto {
  @IsNumber()
  @Min(0, { message: 'La comisión debe ser un valor positivo' })
  @Max(100, { message: 'La comisión no puede exceder 100%' })
  porcentajeComisionBanco!: number;
}

/**
 * DTO para actualizar comisión bancaria de un periodo específico
 */
export class ActualizarComisionBancoPeriodoDto {
  @IsNumber()
  @Min(1, { message: 'El mes debe estar entre 1 y 12' })
  @Max(12, { message: 'El mes debe estar entre 1 y 12' })
  mes!: number;

  @IsNumber()
  @Min(2020, { message: 'El año debe ser mayor o igual a 2020' })
  anio!: number;

  @IsNumber()
  @Min(0, { message: 'La comisión debe ser un valor positivo' })
  @Max(100, { message: 'La comisión no puede exceder 100%' })
  porcentajeComisionBanco!: number;
}

/**
 * DTO para filtrar finanzas
 */
export class FiltrarFinanzasDto {
  @IsOptional()
  @IsMongoId({ message: 'ID de modelo inválido' })
  modeloId?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(12)
  mes?: number;

  @IsOptional()
  @IsNumber()
  @Min(2020)
  anio?: number;

  @IsOptional()
  @IsEnum(['CALCULADO', 'PENDIENTE_REVISION', 'APROBADO', 'PAGADO'])
  estado?: string;

  @IsOptional()
  @IsString()
  search?: string; // Buscar por nombre de modelo
}

/**
 * DTO para obtener resumen financiero
 */
export class ObtenerResumenDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(12)
  mesInicio?: number;

  @IsOptional()
  @IsNumber()
  @Min(2020)
  anioInicio?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(12)
  mesFin?: number;

  @IsOptional()
  @IsNumber()
  @Min(2020)
  anioFin?: number;

  @IsOptional()
  @IsMongoId({ message: 'ID de modelo inválido' })
  modeloId?: string;
}

/**
 * DTO de respuesta para datos financieros formateados
 */
export interface FinanzasFormateadaDto {
  id: string;
  modeloId: string;
  nombreModelo: string;
  usuarioOnlyFans?: string;
  mes: number;
  anio: number;
  
  // Montos decimales
  ventasNetasUSD: number;
  comisionAgenciaUSD: number;
  comisionBancoUSD: number;
  gananciaModeloUSD: number;
  gananciaOnlyTopUSD: number;
  
  // Montos formateados para usuario
  ventasNetasFormateado: string;
  comisionAgenciaFormateado: string;
  comisionBancoFormateado: string;
  gananciaModeloFormateado: string;
  gananciaOnlyTopFormateado: string;
  
  // Porcentajes
  porcentajeComisionAgencia: number;
  porcentajeComisionBanco: number;
  porcentajeParticipacionModelo: number; // 100 - porcentajeComisionAgencia
  
  // Estadísticas
  cantidadVentas: number;
  promedioVentaDiaria?: number;
  
  // Estado
  estado: string;
  fechaUltimoCalculo?: Date;
  contratoId?: string;
  notasInternas?: string;
}

/**
 * DTO de respuesta para lista de modelos con ganancias
 */
export interface ModeloConGananciasDto {
  modeloId: string;
  nombreCompleto: string;
  email: string;
  usuarioOnlyFans?: string;
  fotoPerfil?: string;
  estado: string;
  tieneFinanzas: boolean;
  mesActual: number;
  anioActual: number;
  
  // Finanzas del mes actual (alias para compatibilidad con frontend)
  finanzas?: {
    _id: string;
    modeloId: string;
    mes: number;
    anio: number;
    ventasNetas: string;
    comisionAgencia: string;
    comisionBanco: string;
    gananciaModelo: string;
    gananciaOnlyTop: string;
    porcentajeComisionAgencia: number;
    porcentajeComisionBanco: number;
    estado: string;
    fechaCalculo: string;
    calculadoPor: string;
    notas?: string;
    meta?: any;
  };
  
  // Finanzas del mes actual
  finanzasMesActual?: {
    mes: number;
    anio: number;
    ventasNetasUSD: number;
    gananciaModeloUSD: number;
    gananciaOnlyTopUSD: number;
    cantidadVentas: number;
    estado: string;
    // Formateados
    ventasNetasFormateado: string;
    gananciaModeloFormateado: string;
    gananciaOnlyTopFormateado: string;
  } | null;
  
  // Estadísticas históricas
  totalHistoricoVentasUSD: number;
  totalHistoricoGananciaOnlyTopUSD: number;
  mesesConVentas: number;
}

/**
 * DTO de respuesta para estadísticas generales
 */
export interface EstadisticasFinanzasDto {
  periodo: {
    mes: number;
    anio: number;
  };
  
  totales: {
    ventasNetasUSD: number;
    gananciaOnlyTopUSD: number;
    comisionesBancoUSD: number;
    gananciaModelosUSD: number;
    
    // Formateados
    ventasNetasFormateado: string;
    gananciaOnlyTopFormateado: string;
    comisionesBancoFormateado: string;
    gananciaModelosFormateado: string;
  };
  
  promedios: {
    ventasPorModelo: number;
    gananciaOnlyTopPorModelo: number;
  };
  
  modelosActivas: number;
  totalVentas: number;
  
  topModelos: Array<{
    modeloId: string;
    nombreModelo: string;
    ventasNetasUSD: number;
    gananciaOnlyTopUSD: number;
    ventasNetasFormateado: string;
    gananciaOnlyTopFormateado: string;
  }>;
  
  porEstado: Record<string, number>;
}
