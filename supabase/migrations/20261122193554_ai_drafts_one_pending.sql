-- One running draft per user. In its own migration: the enum value it uses is added by the
-- previous one, and a new enum value can't be used in the transaction that adds it.
CREATE UNIQUE INDEX "ai_drafts_one_pending" ON "ai_drafts" USING btree ("owner_id") WHERE "ai_drafts"."status" = 'pending';
