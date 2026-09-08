import { Module } from '@nestjs/common'; // 1
import { createObserveModule } from '@nestjs/observe';
import { AppController } from './app.controller.js'; // 2
import { AppService } from './app.service.js'; // 3
import { WelcomeController } from './welcome.controller.js'; // 4
import { WelcomeService } from './welcome.service.js'; // 5
import { CoursesModule } from './courses/courses.module.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({ // 6
  imports: [
    ObserveModule.forRoot({
      appKey: process.env.OBSERVE_APP_KEY ?? '',
      appSecret: process.env.OBSERVE_APP_SECRET ?? '',
      serviceId: process.env.OBSERVE_SERVICE_ID ?? 'project-name',
    }),
    CoursesModule,
  ], // 7
  controllers: [AppController, WelcomeController], // 8
  providers: [AppService, WelcomeService], // 9
})
export class AppModule {} // 10