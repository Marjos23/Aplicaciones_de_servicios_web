import {
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Course } from '../../courses/entities/course.entity';
import { Student } from '../../students/entities/student.entity';

@Entity('enrollments')
// Restricción única compuesta: la pareja estudiante-curso no puede repetirse.
// Sin nombre explícito, porque en PostgreSQL las restricciones viven en el
// esquema y un nombre fijo chocaría al existir dos tablas de matrículas con
// prefijos distintos, como ocurre en las pruebas.
@Unique(['student', 'course'])
export class Enrollment {
  @PrimaryGeneratedColumn()
  id: number;

  // onDelete RESTRICT: no se permite borrar un estudiante o curso que
  // todavía tenga matrículas. Cancelar la matrícula es una decisión
  // explícita, nunca una consecuencia de borrar el recurso.
  @ManyToOne(() => Student, (student) => student.enrollments, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'student_id' })
  student: Student;

  @ManyToOne(() => Course, (course) => course.enrollments, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'course_id' })
  course: Course;
}
