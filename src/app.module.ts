import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { CoursesModule } from './courses/courses.module.js';
import { StudentsModule } from './students/students.module.js';

@Module({
  imports: [CoursesModule, StudentsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
