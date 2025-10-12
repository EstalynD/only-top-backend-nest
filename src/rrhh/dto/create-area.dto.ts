import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsNumber, IsHexColor, MaxLength, MinLength, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateAreaDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(20)
  @Matches(/^[A-Z_]+$/, { message: 'Code must contain only uppercase letters and underscores' })
  @Transform(({ value }) => value?.trim().toUpperCase())
  code!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) => value?.trim() || null)
  description?: string | null;

  @IsOptional()
  @IsHexColor()
  color?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim() || null)
  defaultContractTemplateId?: string | null;
}
