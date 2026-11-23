ALTER TABLE "matches" ADD COLUMN "share_id" text;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "share_on" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "share_id" text;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "share_on" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_share_id_unique" UNIQUE("share_id");--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_share_id_unique" UNIQUE("share_id");