import { Module } from '@nestjs/common';
import { OutboxMessagePublishedService } from './message.published.service';
import { MessageBrokerService } from './message.broker.service';

@Module({
  providers: [MessageBrokerService, OutboxMessagePublishedService],
  exports: [MessageBrokerService],
})
export class OutboxModule {}
