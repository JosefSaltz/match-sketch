CREATE TYPE "public"."draft_status" AS ENUM('ok', 'repaired', 'partial', 'failed', 'refused', 'capped', 'paused');--> statement-breakpoint
CREATE TABLE "ai_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"model" text NOT NULL,
	"status" "draft_status" NOT NULL,
	"input_tokens" integer NOT NULL,
	"output_tokens" integer NOT NULL,
	"cache_read_tokens" integer NOT NULL,
	"cost_usd" numeric(10, 6) NOT NULL,
	"error" text,
	"request" jsonb NOT NULL,
	"response" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_drafts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ai_drafts" ADD CONSTRAINT "ai_drafts_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_drafts_owner_created" ON "ai_drafts" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_drafts_created" ON "ai_drafts" USING btree ("created_at");