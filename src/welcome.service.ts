import { Injectable } from '@nestjs/common'; // 1

@Injectable() // 2
export class WelcomeService { // 3
  getMessage(): { message: string } { // 4
    return { message: 'Bienvenido a CourseHub API' }; // 5
  }
}