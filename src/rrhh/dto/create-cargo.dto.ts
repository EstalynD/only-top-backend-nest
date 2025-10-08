import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsNumber, IsMongoId, MaxLength, MinLength, Matches, ValidateNested, IsArray, IsPositive, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { Types } from 'mongoose';

class SalaryRangeDto {
  @IsNumber()
  @IsPositive()
  min!: number;

  @IsNumber()
  @IsPositive()
  max!: number;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;
}

class RequirementsDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  education?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  experience?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  skills?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  languages?: string[];
}

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

  @IsMongoId()
  @Transform(({ value }) => new Types.ObjectId(value))
  areaId!: Types.ObjectId;

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
  @ValidateNested()
  @Type(() => SalaryRangeDto)
  salaryRange?: SalaryRangeDto | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => RequirementsDto)
  requirements?: RequirementsDto | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}
