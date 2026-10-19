import { Type } from 'class-transformer';
import {
  IsBooleanString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

/**
 * Contrato de la consulta de GET /enrollments (Semana 6, sesión 12).
 *
 * Filtros combinables: un parámetro ausente no restringe la consulta.
 * activeOnly se conserva como texto validado porque llega desde la URL;
 * en el servicio se interpreta con una comparación explícita, nunca con
 * Boolean(activeOnly), porque Boolean('false') sería true.
 */
export class EnrollmentQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  studentId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  courseId?: number;

  @IsOptional()
  @IsBooleanString()
  activeOnly?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 10;
}
