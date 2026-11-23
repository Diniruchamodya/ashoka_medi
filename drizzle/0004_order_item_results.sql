CREATE TABLE order_item_results (
  "orderItemId" integer PRIMARY KEY NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  "resultData" jsonb NOT NULL,
  "updatedBy" text,
  "updatedAt" timestamp NOT NULL DEFAULT now()
);
