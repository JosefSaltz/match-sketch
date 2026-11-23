CREATE TYPE "public"."length_unit" AS ENUM('ft', 'yd');--> statement-breakpoint
CREATE SEQUENCE "public"."sync_change_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "canvases" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"change_seq" bigint DEFAULT nextval('sync_change_seq') NOT NULL,
	"name" text NOT NULL,
	"width_ft" double precision NOT NULL,
	"depth_ft" double precision NOT NULL,
	"unit" "length_unit" NOT NULL
);
--> statement-breakpoint
ALTER TABLE "canvases" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"change_seq" bigint DEFAULT nextval('sync_change_seq') NOT NULL,
	"name" text NOT NULL,
	"date" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "matches" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"change_seq" bigint DEFAULT nextval('sync_change_seq') NOT NULL,
	"match_id" uuid,
	"stage_order" integer,
	"source_canvas_id" uuid,
	"width_ft" double precision NOT NULL,
	"depth_ft" double precision NOT NULL,
	"unit" "length_unit" NOT NULL,
	"schema_version" integer NOT NULL,
	"document" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "canvases" ADD CONSTRAINT "canvases_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "canvases_owner_change_seq" ON "canvases" USING btree ("owner_id","change_seq");--> statement-breakpoint
CREATE INDEX "matches_owner_change_seq" ON "matches" USING btree ("owner_id","change_seq");--> statement-breakpoint
CREATE INDEX "plans_owner_change_seq" ON "plans" USING btree ("owner_id","change_seq");--> statement-breakpoint
CREATE POLICY "canvases_select_own" ON "canvases" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "canvases"."owner_id");--> statement-breakpoint
CREATE POLICY "matches_select_own" ON "matches" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "matches"."owner_id");--> statement-breakpoint
CREATE POLICY "plans_select_own" ON "plans" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "plans"."owner_id");