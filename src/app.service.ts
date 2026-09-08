import { Injectable } from '@nestjs/common'; // 1

@Injectable() // 2
export class AppService { // 3
  getHello(): string { // 4
    return 'CourseHub API está en línea'; // 5
  }
}