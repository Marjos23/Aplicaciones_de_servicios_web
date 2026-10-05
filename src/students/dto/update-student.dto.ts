import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class UpdateStudentDto {
  // Todas las propiedades son opcionales: un PATCH envía solo lo que cambia.
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  age?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  career?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  semester?: number;

  // Se mantiene por compatibilidad con el CRUD de la Semana 3, cuya ruta
  // pública no se rediseña en esta entrega. Nota: activar o desactivar
  // también tiene su propio endpoint, PATCH /students/:id/status.
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
