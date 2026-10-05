import { Inject, Injectable } from '@nestjs/common';
import { Database, DRIZLE } from '../db/db.module';
import { ordes, outbox } from '../db/schema';
import type { CreateOrderPayload } from './types/order.types';

@Injectable()
export class OrdersService {
  constructor(@Inject(DRIZLE) private readonly db: Database) {}

  async create(dto: CreateOrderPayload) {
    return this.db.transaction(async (tx) => {
      const [order] = await tx
        .insert(ordes)
        .values({
          customerEmail: dto.customerEmail,
          amount: dto.amount.toFixed(2),
        })
        .returning();

      await tx.insert(outbox).values({
        eventType: 'OrderCreated',
        payload: {
          orderId: order.id,
          customerEmail: order.customerEmail,
          amount: order.amount,
        },
      });

      return order;
    });
  }
}
