import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

/**
 * Contrato de la consulta de GET /courses (Semana 6, sesión 11).
 *
 * Cada parámetro tiene una responsabilidad: level reduce el conjunto,
 * page y limit seleccionan una ventana y sortBy/order hacen que esa
 * ventana sea estable. Los valores por defecto permiten seguir usando
 * GET /courses sin parámetros.
 */
export class CoursesQueryDto {
  @IsOptional()
  @IsString()
  level?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 10;

  // El nombre de una columna no puede parametrizarse: solo se aceptan
  // campos de una lista cerrada. Cualquier otro valor responde 400.
  @IsOptional()
  @IsIn(['id', 'title', 'level'])
  sortBy: 'id' | 'title' | 'level' = 'id';

  @IsOptional()
  @Transform(({ value }) => String(value).toUpperCase())
  @IsIn(['ASC', 'DESC'])
  order: 'ASC' | 'DESC' = 'ASC';
}
