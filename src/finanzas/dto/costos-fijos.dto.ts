import { IsNumber, IsString, IsOptional, IsEnum, IsArray, ValidateNested, Min, Max, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO para registrar un gasto fijo dentro de una categoría
 */
export class RegistrarGastoDto {
  @IsString()
  @IsOptional()
  categoriaId?: string; // ID interno generado (para actualización)

  @IsString()
  nombreCategoria!: string; // Nombre de la categoría (ej: "Administrativos")

  @IsString()
  concepto!: string; // Concepto del gasto (ej: "Alquiler de oficina")

  @IsNumber()
  @Min(0)
  montoUSD!: number; // Monto en USD (se convertirá a BigInt)

  @IsString()
  @IsOptional()
  notas?: string; // Notas adicionales sobre el gasto
}

/**
 * DTO para crear una nueva categoría de gastos
 */
export class CrearCategoriaDto {
  @IsString()
  nombre!: string; // Nombre de la categoría

  @IsString()
  @IsOptional()
  descripcion?: string; // Descripción de la categoría

  @IsString()
  @IsOptional()
  color?: string; // Color hex para UI (ej: "#3b82f6")
}

/**
 * DTO para actualizar un gasto existente
 */
export class ActualizarGastoDto {
  @IsString()
  nombreCategoria!: string; // Categoría donde está el gasto

  @IsNumber()
  indiceGasto!: number; // Índice del gasto en el array

  @IsString()
  @IsOptional()
  concepto?: string; // Nuevo concepto

  @IsNumber()
  @Min(0)
  @IsOptional()
  montoUSD?: number; // Nuevo monto

  @IsString()
  @IsOptional()
  notas?: string; // Nuevas notas
}

/**
 * DTO para eliminar un gasto
 */
export class EliminarGastoDto {
  @IsString()
  nombreCategoria!: string; // Categoría donde está el gasto

  @IsNumber()
  indiceGasto!: number; // Índice del gasto a eliminar
}

/**
 * DTO para eliminar una categoría completa
 */
export class EliminarCategoriaDto {
  @IsString()
  nombreCategoria!: string; // Nombre de la categoría a eliminar
}

/**
 * DTO para consolidar los costos fijos del mes
 */
export class ConsolidarCostosDto {
  @IsNumber()
  @Min(1)
  @Max(12)
  mes!: number; // Mes a consolidar

  @IsNumber()
  anio!: number; // Año a consolidar

  @IsString()
  @IsOptional()
  notasCierre?: string; // Notas sobre la consolidación
}

/**
 * DTO de respuesta con costos formateados
 */
export class CostosFijosFormateadoDto {
  mes!: number;
  anio!: number;
  periodo!: string;
  estado!: string;
  consolidado!: boolean;
  
  categorias!: {
    nombre: string;
    descripcion?: string;
    color?: string;
    gastos: {
      concepto: string;
      montoUSD: number;
      montoFormateado: string;
      fechaRegistro: string;
      notas?: string;
      porcentajeCategoria: number; // % dentro de su categoría
    }[];
    totalCategoriaUSD: number;
    totalCategoriaFormateado: string;
    porcentajeDelTotal: number; // % del total general
    cantidadGastos: number;
  }[];

  totalGastosUSD!: number;
  totalGastosFormateado!: string;
  
  fechaConsolidacion?: string;
  fechaUltimaActualizacion?: string;
  notasInternas?: string;
  
  meta?: {
    categoriaMayorGasto?: string;
    categoriaConMasGastos?: string;
    promedioGastoPorDia?: number;
    promedioGastoPorDiaFormateado?: string;
  };
}

/**
 * DTO para respuesta de consolidación
 */
export class ConsolidarCostosRespuestaDto {
  periodo!: string;
  totalGastosUSD!: number;
  totalGastosFormateado!: string;
  categorias!: number;
  gastos!: number;
  consolidado!: boolean;
  fechaConsolidacion!: string;
  message!: string;
}
