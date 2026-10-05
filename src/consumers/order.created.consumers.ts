import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PULSAR_CLIENT } from '../pulsar/pulsar.module';
import * as Pulsar from 'pulsar-client';
import { Database, DRIZLE } from '../db/db.module';
import { processedEvents } from '../db/schema';

const CONSUMERS_NAME = 'order.created_consumers';

@Injectable()
export class OrderCreatedConsumer implements OnModuleInit {
    private readonly logger = new Logger(OrderCreatedConsumer.name);
    
  constructor(
    @Inject(PULSAR_CLIENT) private readonly client: Pulsar.Client,
    @Inject(DRIZLE) private readonly db:Database
  ) {}

  async onModuleInit() {
    await this.client.subscribe({
      topic: 'order.created',
      subscription: 'demo-consumer',
      subscriptionType: 'Shared',
      listener: async (msg, consumer) => {
        try {
          await this.handle(msg);
          await consumer.acknowledge(msg);
        } catch (error) {
          this.logger.error(
            'Failed to handle message',
            error instanceof Error ? error.stack : error,
          );
          consumer.negativeAcknowledge(msg);
        }
      },
    });
  }

  async handle(msg: Pulsar.Message) {
    const eventId = msg.getProperties().eventId;
    const payload = JSON.parse(msg.getData().toString());

    await this.db.transaction(async (tx) => {
      const inserted = await tx
        .insert(processedEvents)
        .values({ eventId, consumer: CONSUMERS_NAME })
        .onConflictDoNothing()
        .returning();

        if(inserted.length === 0)
        {
          this.logger.warn
          ('Skipping duplicate delivery of event ${eventId}')
        }

         this.logger.log(
           'Received order.cre3ate (event ${eventId}): ${JSON.stringify(payload)}',
         )
    });

    this.logger.log(
      `Received order.created ${eventId}: ${JSON.stringify(payload)}`,
    );
  }
}
