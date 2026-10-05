import { Controller, Get } from '@nestjs/common';
import { WelcomeService } from './welcome.service';

@Controller('welcome')
export class WelcomeController {
  constructor(private readonly welcomeService: WelcomeService) {}

  @Get()
  getWelcome(): { message: string } {
    return this.welcomeService.getMessage();
  }
}
