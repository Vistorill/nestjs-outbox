import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_PIPE } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';
import { DbModule } from './db/db.module';
import { OrdersModule } from './orders/orders.module';
import { PulsarModule } from './pulsar/pulsar.module';
import { ScheduleModule } from '@nestjs/schedule';
import { Consumer } from 'pulsar-client';
import { ConsumersModule } from './consumers/consumers.module';
import { OutboxModule } from './outbox/outbox.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), 
    ScheduleModule.forRoot(),
    OutboxModule,
    DbModule, 
    OrdersModule, 
    ConsumersModule,
    PulsarModule],
  controllers: [],
  providers: [
    {
      provide: APP_PIPE,
      useClass: ZodValidationPipe,
    },
  ],
})
export class AppModule {}
