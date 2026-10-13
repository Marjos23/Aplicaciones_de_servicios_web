import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ParsePositiveIntPipe } from '../common/pipes/parse-positive-int.pipe.js';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto.js';
import { EnrollmentQueryDto } from './dto/enrollment-query.dto.js';
import { EnrollmentsService } from './enrollments.service.js';

@Controller()
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @Post('enrollments')
  create(@Body() dto: CreateEnrollmentDto) {
    return this.enrollmentsService.create(dto);
  }

  @Get('enrollments')
  findAll(@Query() query: EnrollmentQueryDto) {
    return this.enrollmentsService.findAll(query);
  }

  @Get('students/:studentId/enrollments')
  findByStudent(@Param('studentId', ParsePositiveIntPipe) studentId: number) {
    return this.enrollmentsService.findByStudent(studentId);
  }

  @Get('courses/:courseId/enrollments')
  findByCourse(@Param('courseId', ParsePositiveIntPipe) courseId: number) {
    return this.enrollmentsService.findByCourse(courseId);
  }

  @Delete('enrollments/:id')
  remove(@Param('id', ParsePositiveIntPipe) id: number) {
    return this.enrollmentsService.remove(id);
  }
}
