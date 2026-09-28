CREATE TABLE "whatsapp_pending_actions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"phone_number" text NOT NULL,
	"whatsapp_message_id" text NOT NULL,
	"intent_type" text NOT NULL,
	"intent_payload" jsonb NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_verification_challenges" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"phone_number" text NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"is_used" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "whatsapp_pending_actions" ADD CONSTRAINT "whatsapp_pending_actions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_verification_challenges" ADD CONSTRAINT "whatsapp_verification_challenges_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "wa_pending_actions_userId_idx" ON "whatsapp_pending_actions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "wa_pending_actions_phoneNumber_idx" ON "whatsapp_pending_actions" USING btree ("phone_number");--> statement-breakpoint
CREATE INDEX "wa_pending_actions_status_idx" ON "whatsapp_pending_actions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "wa_pending_actions_expiresAt_idx" ON "whatsapp_pending_actions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "wa_verification_userId_idx" ON "whatsapp_verification_challenges" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "wa_verification_phoneNumber_idx" ON "whatsapp_verification_challenges" USING btree ("phone_number");--> statement-breakpoint
CREATE INDEX "wa_verification_expiresAt_idx" ON "whatsapp_verification_challenges" USING btree ("expires_at");