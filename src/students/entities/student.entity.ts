import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Enrollment } from '../../enrollments/entities/enrollment.entity';

@Entity('students')
export class Student {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  // Índice único: la base de datos impide repetir el correo, no solo el servicio.
  // Se deja el nombre en manos de TypeORM a propósito. En PostgreSQL los
  // índices viven en el esquema, no en la tabla, así que un nombre fijo como
  // 'UQ_students_email' colisiona en cuanto existe una segunda tabla de
  // estudiantes con otro prefijo, que es justo lo que hacen las pruebas.
  @Column({ unique: true })
  email: string;

  @Column()
  age: number;

  @Column()
  career: string;

  @Column()
  semester: number;

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => Enrollment, (enrollment) => enrollment.student)
  enrollments: Enrollment[];
}
