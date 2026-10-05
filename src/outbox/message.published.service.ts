import { Inject, Injectable, Logger } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { Database, DRIZLE } from "../db/db.module";
import { eq } from "drizzle-orm/sql/expressions/conditions";
import { outbox } from "../db/schema";
import { MessageBrokerService } from './message.broker.service';

const POLI_INTERVAL_MS = Number(process.env.OUTBOX_POLI_INTERVAL_MS ?? 5000);
const  BATCH_SIZE = Number(process.env.OUTBOX_BATCH_SIZE ?? 10);

@Injectable()
export class OutboxMessagePublishedService {
  private readonly logger = new Logger(OutboxMessagePublishedService.name);
  private draining = false;
  

  constructor(
    @Inject(DRIZLE) private readonly db: Database,
     private readonly broker: MessageBrokerService,
  ){}
      
    

  @Interval(POLI_INTERVAL_MS)
  async poll() {
    if (this.draining)
      return;
    this.draining = true;

    try {
      // Fetch messages from the outbox table in batches
       await this.drain();

      }catch (err) {
      this.logger.error("Error occurred while polling outbox messages", err
        instanceof Error ? err.stack : err,
      );

    } finally {
      this.draining = false;
    }

    }  private async drain() {
      await this.db.transaction(async (tx) => {
        const batch = await tx
          .select()
          .from(outbox)
          .where(eq(outbox.status, 'pending'))
          .limit(BATCH_SIZE)
          .for('update', { skipLocked: true });

          if (batch.length === 0) return;

        for (const event of batch) {
          try {
            // Publish the message to the message broker
            await this.broker.publish(event.eventType, event.payload, event.id);
            /// verificacao de idempotencia: implement event deduplication using eventId in the consumer side to avoid processing the same event multiple times

            await tx.update(outbox)
              .set({ status: 'published', publishedAt: new Date() })
              .where(eq(outbox.id, event.id));

          } catch (err) {
            await tx
              .update(outbox)
              .set({
                lastError: err instanceof Error ? err.message : String(err),
              })
              .where(eq(outbox.id, event.id));
            this.logger.warn(`Publish failed for event ${event.id}`);
          }
        }
      });
    }
}