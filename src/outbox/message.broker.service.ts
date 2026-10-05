import { Inject, Injectable, Logger } from '@nestjs/common';
import * as Pulsar from 'pulsar-client';
import { PULSAR_CLIENT } from '../pulsar/pulsar.module';

@Injectable()
export class MessageBrokerService {
  private readonly logger = new Logger(MessageBrokerService.name);
  private readonly producer = new Map<string, Promise<Pulsar.Producer>>();

  constructor(@Inject(PULSAR_CLIENT) private readonly client: Pulsar.Client) {}

  async publish(eventType: string, payload: unknown, eventId: string) {
    const producer = await this.getProducer(eventType);
    await producer.send({
      data: Buffer.from(JSON.stringify(payload)),
      properties: {
        eventId,
      },
    });
    this.logger.log(
      `Event published ${eventType}: ${JSON.stringify(payload)}`,
    );
  }

  private getProducer(topic: string) {
    let producer = this.producer.get(topic);
    if (!producer) {
      producer = this.client.createProducer({ topic });
      this.producer.set(topic, producer);
    }
    return producer;
  }
}