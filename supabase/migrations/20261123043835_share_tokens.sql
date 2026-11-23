CREATE TABLE "share_tokens" (
	"token" text PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "share_tokens" ENABLE ROW LEVEL SECURITY;