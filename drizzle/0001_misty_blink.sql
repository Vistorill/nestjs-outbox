CREATE TABLE "processed_events" (
	"event_id" uuid NOT NULL,
	"consumer" text NOT NULL,
	"processed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "processed_events_event_id_consumer_pk" PRIMARY KEY("event_id","consumer")
);
