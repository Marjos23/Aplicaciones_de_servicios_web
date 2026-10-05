import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { WelcomeController } from './welcome.controller';
import { WelcomeService } from './welcome.service';
import { CoursesModule } from './courses/courses.module';
import { Course } from './courses/entities/course.entity';
import { StudentsModule } from './students/students.module';
import { Student } from './students/entities/student.entity';
import { EnrollmentsModule } from './enrollments/enrollments.module';
import { Enrollment } from './enrollments/entities/enrollment.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.getOrThrow('DATABASE_HOST'),
        port: Number(config.getOrThrow('DATABASE_PORT')),
        username: config.getOrThrow('DATABASE_USER'),
        password: config.getOrThrow('DATABASE_PASSWORD'),
        database: config.getOrThrow('DATABASE_NAME'),
        entities: [Course, Student, Enrollment],
        // synchronize ajusta el esquema a las entidades. Es una comodidad
        // de desarrollo local, nunca una estrategia de producción: allí el
        // esquema cambia mediante migraciones revisadas.
        synchronize: true,
        logging: config.get('DATABASE_LOGGING') === 'true',
      }),
    }),
    CoursesModule,
    StudentsModule,
    EnrollmentsModule,
  ],
  controllers: [AppController, WelcomeController],
  providers: [AppService, WelcomeService],
})
export class AppModule {}
