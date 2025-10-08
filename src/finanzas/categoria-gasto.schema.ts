import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

/**
 * CategoriaGastoEntity - Schema para categorías de gastos fijos
 * 
 * Colección global de categorías que pueden ser usadas en cualquier mes.
 * Incluye categorías predeterminadas del sistema y personalizadas por usuarios.
 */
@Schema({ collection: 'finanzas_categorias_gastos', timestamps: true })
export class CategoriaGastoEntity {
  @Prop({ type: String, required: true, unique: true })
  nombre!: string; // ej: "Administrativos", "Marketing"

  @Prop({ type: String, default: null })
  descripcion?: string | null;

  @Prop({ type: String, default: '#6b7280' })
  color!: string; // Color hex para UI (ej: "#3b82f6")

  @Prop({ type: String, default: null })
  icon?: string | null; // Emoji o nombre de ícono

  @Prop({ type: Boolean, default: false })
  esPersonalizada!: boolean; // true = creada por usuario, false = sistema

  @Prop({ type: Boolean, default: true })
  activa!: boolean; // Se puede desactivar sin eliminar

  @Prop({ type: SchemaTypes.ObjectId, ref: 'UserEntity', default: null })
  creadoPor?: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  fechaCreacion?: Date | null;
}

export type CategoriaGastoDocument = HydratedDocument<CategoriaGastoEntity>;
export const CategoriaGastoSchema = SchemaFactory.createForClass(CategoriaGastoEntity);

// Índices
// nombre ya tiene unique: true en @Prop, no necesita índice adicional
CategoriaGastoSchema.index({ activa: 1 });
CategoriaGastoSchema.index({ esPersonalizada: 1 });
