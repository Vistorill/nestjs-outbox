import { Column } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  text,
  numeric,
  timestamp,
  jsonb,
  pgEnum,
  primaryKey,
} from 'drizzle-orm/pg-core';

export const ordes = pgTable('ordes', {
  id: uuid('id').primaryKey().defaultRandom(),
  customerEmail: text('customer_email').notNull(),
  amount: numeric('amount').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const outboxStatus = pgEnum('outbox_status', {
  pending: 'pending',
  published: 'published',
  failed: 'failed',
});

export const outbox = pgTable('outbox', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventType: text('event_type').notNull(),
  payload: jsonb('payload').notNull(),
  status: outboxStatus('status').notNull().default('pending'),
  availableAt: timestamp('available_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  publishedAt: timestamp('published_at'),
  lastError: text('last_error'),
});

export type Order = typeof ordes.$inferSelect;
export type Outbox = typeof outbox.$inferSelect;
export type NewOutboxEvent = typeof outbox.$inferInsert;

export const processedEvents = pgTable('processed_events',
  {
  eventId: uuid('event_id').notNull(),
  consumer: text('consumer').notNull(),
  processedAt: timestamp('processed_at').defaultNow().notNull(),
},
(t)=> [primaryKey({columns: [t.eventId, t.consumer]})]

);