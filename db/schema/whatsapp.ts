import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  index,
  jsonb,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

/**
 * WhatsApp Contacts Table
 * Maps verified WhatsApp phone numbers to application user accounts.
 */
export const whatsappContacts = pgTable(
  "whatsapp_contacts",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    phoneNumber: text("phone_number").notNull().unique(), // Canonical E.164 format (e.g., +6281234567890)
    verifiedAt: timestamp("verified_at"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("whatsapp_contacts_userId_idx").on(table.userId),
    index("whatsapp_contacts_phoneNumber_idx").on(table.phoneNumber),
    index("whatsapp_contacts_isActive_idx").on(table.isActive),
  ]
);

/**
 * WhatsApp Messages Table
 * Inbound messages received from WhatsApp Cloud API webhook.
 * Provides audit log and idempotency guard via unique whatsapp_message_id.
 */
export const whatsappMessages = pgTable(
  "whatsapp_messages",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    phoneNumber: text("phone_number").notNull(),
    whatsappMessageId: text("whatsapp_message_id").notNull().unique(), // Provider idempotency key
    messageType: text("message_type").notNull(), // 'text' | 'image' | 'audio' | etc.
    messageText: text("message_text"),
    rawPayload: jsonb("raw_payload"),
    status: text("status").default("RECEIVED").notNull(), // 'RECEIVED' | 'PROCESSING' | 'PROCESSED' | 'FAILED' | 'IGNORED' | 'UNSUPPORTED'
    receivedAt: timestamp("received_at").notNull(),
    processedAt: timestamp("processed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("whatsapp_messages_userId_idx").on(table.userId),
    index("whatsapp_messages_phoneNumber_idx").on(table.phoneNumber),
    index("whatsapp_messages_status_idx").on(table.status),
  ]
);

/**
 * WhatsApp Phone Ownership Verification Challenges Table
 * Manages cryptographically secure verification challenges for linking phone numbers.
 */
export const whatsappVerificationChallenges = pgTable(
  "whatsapp_verification_challenges",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    phoneNumber: text("phone_number").notNull(),
    codeHash: text("code_hash").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    isUsed: boolean("is_used").default(false).notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("wa_verification_userId_idx").on(table.userId),
    index("wa_verification_phoneNumber_idx").on(table.phoneNumber),
    index("wa_verification_expiresAt_idx").on(table.expiresAt),
  ]
);

/**
 * WhatsApp Pending Actions Table (Phase 5 Confirmation State)
 * Holds interpreted financial intents awaiting explicit user confirmation (YA / BATAL).
 * Prevents direct unauthorized AI writes to financial tables.
 */
export const whatsappPendingActions = pgTable(
  "whatsapp_pending_actions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    phoneNumber: text("phone_number").notNull(),
    whatsappMessageId: text("whatsapp_message_id").notNull(),
    intentType: text("intent_type").notNull(), // 'EXPENSE' | 'INCOME' | 'TRANSFER'
    intentPayload: jsonb("intent_payload").notNull(), // Validated intent parameters
    status: text("status").default("PENDING").notNull(), // 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED' | 'EXECUTED'
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("wa_pending_actions_userId_idx").on(table.userId),
    index("wa_pending_actions_phoneNumber_idx").on(table.phoneNumber),
    index("wa_pending_actions_status_idx").on(table.status),
    index("wa_pending_actions_expiresAt_idx").on(table.expiresAt),
  ]
);

// ============================================
// RELATIONS
// ============================================

export const whatsappContactsRelations = relations(whatsappContacts, ({ one }) => ({
  user: one(user, {
    fields: [whatsappContacts.userId],
    references: [user.id],
  }),
}));

export const whatsappMessagesRelations = relations(whatsappMessages, ({ one }) => ({
  user: one(user, {
    fields: [whatsappMessages.userId],
    references: [user.id],
  }),
}));

export const whatsappVerificationChallengesRelations = relations(
  whatsappVerificationChallenges,
  ({ one }) => ({
    user: one(user, {
      fields: [whatsappVerificationChallenges.userId],
      references: [user.id],
    }),
  })
);

export const whatsappPendingActionsRelations = relations(
  whatsappPendingActions,
  ({ one }) => ({
    user: one(user, {
      fields: [whatsappPendingActions.userId],
      references: [user.id],
    }),
  })
);
