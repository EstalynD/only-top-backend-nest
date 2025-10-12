import { IsString, IsNotEmpty, IsEnum } from 'class-validator';

export class JustifyAttendanceDto {
  @IsString()
  @IsNotEmpty()
  justification!: string;
}

export class AdminJustifyAttendanceDto extends JustifyAttendanceDto {
  @IsEnum(['JUSTIFIED', 'REJECTED'])
  status!: 'JUSTIFIED' | 'REJECTED';
}
