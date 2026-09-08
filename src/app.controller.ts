import { Controller, Get } from '@nestjs/common'; // 1
import { AppService } from './app.service.js'; // 2

@Controller() // 3
export class AppController { // 4
  constructor(private readonly appService: AppService) {} // 5

  @Get() // 6
  getHello(): string { // 7
    return this.appService.getHello(); // 8
  }
  
}