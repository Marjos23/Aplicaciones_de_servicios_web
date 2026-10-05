import { PartialType } from '@nestjs/mapped-types';
import { CreateCourseDto } from './create-course.dto';

/**
 * Para PATCH todos los campos son opcionales: se envía solo lo que cambia.
 * PartialType reutiliza las validaciones de CreateCourseDto sin duplicarlas.
 */
export class UpdateCourseDto extends PartialType(CreateCourseDto) {}
