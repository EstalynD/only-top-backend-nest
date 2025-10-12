import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsNumber, IsMongoId, MaxLength, MinLength, Matches, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateCargoDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(30)
  @Matches(/^[A-Z_]+$/, { message: 'Code must contain only uppercase letters and underscores' })
  @Transform(({ value }) => value?.trim().toUpperCase())
  code!: string;

  // Mantener como string para que la validación @IsMongoId funcione; Mongoose castea a ObjectId
  @IsMongoId()
  @Transform(({ value }) => (value == null ? value : String(value)))
  areaId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) => value?.trim() || null)
  description?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(1)
  hierarchyLevel?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}
