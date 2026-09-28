CREATE TABLE "whatsapp_contacts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"phone_number" text NOT NULL,
	"verified_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "whatsapp_contacts_phone_number_unique" UNIQUE("phone_number")
);
--> statement-breakpoint
CREATE TABLE "whatsapp_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"phone_number" text NOT NULL,
	"whatsapp_message_id" text NOT NULL,
	"message_type" text NOT NULL,
	"message_text" text,
	"raw_payload" jsonb,
	"status" text DEFAULT 'RECEIVED' NOT NULL,
	"received_at" timestamp NOT NULL,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "whatsapp_messages_whatsapp_message_id_unique" UNIQUE("whatsapp_message_id")
);
--> statement-breakpoint
ALTER TABLE "whatsapp_contacts" ADD CONSTRAINT "whatsapp_contacts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "whatsapp_contacts_userId_idx" ON "whatsapp_contacts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "whatsapp_contacts_phoneNumber_idx" ON "whatsapp_contacts" USING btree ("phone_number");--> statement-breakpoint
CREATE INDEX "whatsapp_contacts_isActive_idx" ON "whatsapp_contacts" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "whatsapp_messages_userId_idx" ON "whatsapp_messages" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "whatsapp_messages_phoneNumber_idx" ON "whatsapp_messages" USING btree ("phone_number");--> statement-breakpoint
CREATE INDEX "whatsapp_messages_status_idx" ON "whatsapp_messages" USING btree ("status");