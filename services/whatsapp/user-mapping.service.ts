import { db } from "@/lib/db";
import { whatsappContacts, whatsappVerificationChallenges } from "@/db/schema";
import { eq, and, isNotNull } from "drizzle-orm";
import { normalizePhoneNumber } from "./phone.utils";

export interface WhatsAppContactRecord {
  id: string;
  userId: string;
  phoneNumber: string;
  verifiedAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class UserMappingService {
  /**
   * Find internal user ID mapped to a WhatsApp phone number.
   * Normalizes the input phone number first.
   * By default, returns only verified and active contacts.
   */
  static async findUserByPhoneNumber(
    rawOrNormalizedPhone: string,
    onlyVerified = true
  ): Promise<{
    userId: string;
    contactId: string;
    phoneNumber: string;
    isVerified: boolean;
  } | null> {
    const normalized = normalizePhoneNumber(rawOrNormalizedPhone);

    const conditions = [
      eq(whatsappContacts.phoneNumber, normalized),
      eq(whatsappContacts.isActive, true),
    ];

    if (onlyVerified) {
      conditions.push(isNotNull(whatsappContacts.verifiedAt));
    }

    const [contact] = await db
      .select({
        id: whatsappContacts.id,
        userId: whatsappContacts.userId,
        phoneNumber: whatsappContacts.phoneNumber,
        verifiedAt: whatsappContacts.verifiedAt,
      })
      .from(whatsappContacts)
      .where(and(...conditions))
      .limit(1);

    if (!contact) {
      return null;
    }

    return {
      userId: contact.userId,
      contactId: contact.id,
      phoneNumber: contact.phoneNumber,
      isVerified: contact.verifiedAt !== null,
    };
  }

  /**
   * Link a phone number to an authenticated user.
   * Normalizes phone number, verifies uniqueness, and persists contact.
   * Starts as verified = true if explicit, otherwise requires challenge verification.
   */
  static async linkPhoneNumber(
    userId: string,
    rawPhoneNumber: string,
    isPreVerified = true // Default true for direct API linking / backwards compatibility
  ): Promise<WhatsAppContactRecord> {
    const normalized = normalizePhoneNumber(rawPhoneNumber);

    // Check if phone number is already linked to another active user
    const [existing] = await db
      .select()
      .from(whatsappContacts)
      .where(eq(whatsappContacts.phoneNumber, normalized))
      .limit(1);

    if (existing) {
      if (existing.userId !== userId && existing.isActive && existing.verifiedAt) {
        throw new Error(
          "Nomor WhatsApp ini sudah terhubung dengan akun pengguna lain."
        );
      }

      // If belonged to the same user or was inactive, reactivate and update
      const [updated] = await db
        .update(whatsappContacts)
        .set({
          userId,
          isActive: true,
          verifiedAt: isPreVerified ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(whatsappContacts.id, existing.id))
        .returning();

      return updated;
    }

    // Insert new contact record
    const [created] = await db
      .insert(whatsappContacts)
      .values({
        userId,
        phoneNumber: normalized,
        verifiedAt: isPreVerified ? new Date() : null,
        isActive: true,
      })
      .returning();

    return created;
  }

  /**
   * Unlink (soft-deactivate) a WhatsApp contact for a user.
   * Also invalidates any active verification challenges.
   */
  static async unlinkPhoneNumber(
    userId: string,
    rawPhoneNumber: string
  ): Promise<boolean> {
    const normalized = normalizePhoneNumber(rawPhoneNumber);

    // Invalidate pending challenges
    await db
      .update(whatsappVerificationChallenges)
      .set({ isUsed: true })
      .where(
        and(
          eq(whatsappVerificationChallenges.userId, userId),
          eq(whatsappVerificationChallenges.phoneNumber, normalized)
        )
      );

    const result = await db
      .update(whatsappContacts)
      .set({
        isActive: false,
        verifiedAt: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(whatsappContacts.userId, userId),
          eq(whatsappContacts.phoneNumber, normalized)
        )
      )
      .returning({ id: whatsappContacts.id });

    return result.length > 0;
  }

  /**
   * List all linked WhatsApp contacts for a user.
   */
  static async getUserContacts(userId: string): Promise<WhatsAppContactRecord[]> {
    return db
      .select()
      .from(whatsappContacts)
      .where(
        and(
          eq(whatsappContacts.userId, userId),
          eq(whatsappContacts.isActive, true)
        )
      );
  }
}
