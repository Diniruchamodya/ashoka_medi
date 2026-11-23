CREATE TABLE order_item_sms_notifications (
  "orderItemId" integer PRIMARY KEY NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  "submittedBy" text NOT NULL,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "submittedAt" timestamp
);
