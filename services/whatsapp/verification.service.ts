import crypto from "crypto";
import { db } from "@/lib/db";
import { whatsappContacts, whatsappVerificationChallenges } from "@/db/schema";
import { eq, and, desc, gte } from "drizzle-orm";
import { normalizePhoneNumber } from "./phone.utils";
import { IWhatsAppClient, whatsAppClient } from "./client";
import { checkRateLimit } from "@/lib/utils/rate-limit";

const CHALLENGE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;
const MAX_CHALLENGE_REQUESTS_PER_WINDOW = 5;
const CHALLENGE_RATE_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export class WhatsAppVerificationService {
  /**
   * Request a phone verification challenge for an authenticated user.
   * Generates a single-use 6-digit code, stores its SHA-256 hash, and delivers via WhatsApp.
   */
  static async requestVerification(
    userId: string,
    rawPhoneNumber: string,
    client: IWhatsAppClient = whatsAppClient
  ): Promise<{
    success: boolean;
    expiresAt: Date;
    challengeId: string;
    error?: string;
    devCode?: string; // For testing / staging only
  }> {
    const normalized = normalizePhoneNumber(rawPhoneNumber);

    // Rate limit challenge requests per phone number
    const rateCheck = checkRateLimit(
      `wa_challenge_req_${normalized}`,
      MAX_CHALLENGE_REQUESTS_PER_WINDOW,
      CHALLENGE_RATE_WINDOW_MS
    );
    if (!rateCheck.allowed) {
      return {
        success: false,
        expiresAt: new Date(),
        challengeId: "",
        error: "Terlalu banyak permintaan kode verifikasi. Silakan coba lagi dalam beberapa menit.",
      };
    }

    // Check if phone number is already verified by another user
    const [existing] = await db
      .select()
      .from(whatsappContacts)
      .where(eq(whatsappContacts.phoneNumber, normalized))
      .limit(1);

    if (existing && existing.isActive && existing.verifiedAt && existing.userId !== userId) {
      return {
        success: false,
        expiresAt: new Date(),
        challengeId: "",
        error: "Nomor WhatsApp ini sudah terverifikasi oleh akun pengguna lain.",
      };
    }

    // Ensure contact record exists (marked unverified if new)
    if (!existing) {
      await db.insert(whatsappContacts).values({
        userId,
        phoneNumber: normalized,
        verifiedAt: null,
        isActive: false,
      });
    }

    // Generate cryptographically random 6-digit code
    const rawCode = crypto.randomInt(100000, 999999).toString();
    const codeHash = crypto.createHash("sha256").update(rawCode).digest("hex");
    const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);

    // Invalidate existing unused challenges for this phone & user
    await db
      .update(whatsappVerificationChallenges)
      .set({ isUsed: true })
      .where(
        and(
          eq(whatsappVerificationChallenges.userId, userId),
          eq(whatsappVerificationChallenges.phoneNumber, normalized),
          eq(whatsappVerificationChallenges.isUsed, false)
        )
      );

    // Insert new challenge
    const [challenge] = await db
      .insert(whatsappVerificationChallenges)
      .values({
        userId,
        phoneNumber: normalized,
        codeHash,
        attempts: 0,
        isUsed: false,
        expiresAt,
      })
      .returning();

    // Send code to user's WhatsApp
    const messageText =
      `Kode verifikasi FinTrack Anda adalah: *${rawCode}*\n\n` +
      `Kode ini berlaku selama 10 menit. Balas pesan ini dengan angka kode atau masukkan pada aplikasi.\n` +
      `Jangan bagikan kode ini kepada siapa pun.`;

    await client.sendTextMessage({
      to: normalized,
      text: messageText,
    });

    return {
      success: true,
      expiresAt,
      challengeId: challenge.id,
      devCode: rawCode,
    };
  }

  /**
   * Verify challenge code submitted via API or Web interface.
   */
  static async verifyCode(
    userId: string,
    rawPhoneNumber: string,
    code: string
  ): Promise<{ success: boolean; error?: string }> {
    const normalized = normalizePhoneNumber(rawPhoneNumber);
    const cleanedCode = code.trim().replace(/\D/g, "");

    if (cleanedCode.length !== 6) {
      return { success: false, error: "Kode verifikasi harus 6 digit angka." };
    }

    // Find latest active challenge
    const [challenge] = await db
      .select()
      .from(whatsappVerificationChallenges)
      .where(
        and(
          eq(whatsappVerificationChallenges.userId, userId),
          eq(whatsappVerificationChallenges.phoneNumber, normalized),
          eq(whatsappVerificationChallenges.isUsed, false),
          gte(whatsappVerificationChallenges.expiresAt, new Date())
        )
      )
      .orderBy(desc(whatsappVerificationChallenges.createdAt))
      .limit(1);

    if (!challenge) {
      return {
        success: false,
        error: "Kode verifikasi tidak ditemukan atau sudah kadaluarsa. Silakan minta kode baru.",
      };
    }

    // Check brute-force attempts
    if (challenge.attempts >= MAX_ATTEMPTS) {
      await db
        .update(whatsappVerificationChallenges)
        .set({ isUsed: true })
        .where(eq(whatsappVerificationChallenges.id, challenge.id));

      return {
        success: false,
        error: "Batas percobaan telah tercapai. Kode diblokir demi keamanan. Silakan minta kode baru.",
      };
    }

    // Hash user-provided code and compare constant-time
    const inputHash = crypto.createHash("sha256").update(cleanedCode).digest("hex");
    const isMatch = crypto.timingSafeEqual(
      Buffer.from(inputHash, "hex"),
      Buffer.from(challenge.codeHash, "hex")
    );

    if (!isMatch) {
      await db
        .update(whatsappVerificationChallenges)
        .set({ attempts: challenge.attempts + 1 })
        .where(eq(whatsappVerificationChallenges.id, challenge.id));

      return {
        success: false,
        error: `Kode verifikasi salah. Sisa percobaan: ${MAX_ATTEMPTS - (challenge.attempts + 1)}.`,
      };
    }

    // Verification succeeded: mark challenge used
    await db
      .update(whatsappVerificationChallenges)
      .set({ isUsed: true })
      .where(eq(whatsappVerificationChallenges.id, challenge.id));

    // Activate contact and set verified_at
    await db
      .update(whatsappContacts)
      .set({
        verifiedAt: new Date(),
        isActive: true,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(whatsappContacts.userId, userId),
          eq(whatsappContacts.phoneNumber, normalized)
        )
      );

    return { success: true };
  }

  /**
   * Check if an incoming WhatsApp message text is a verification code response.
   * e.g. "123456", "KODE 123456", "VERIFIKASI 123456"
   */
  static extractVerificationCode(text: string | null): string | null {
    if (!text) return null;
    const trimmed = text.trim();
    // Match exactly 6 digits, or "KODE 123456" / "VERIFIKASI 123456"
    const directMatch = trimmed.match(/^(\d{6})$/);
    if (directMatch && directMatch[1]) return directMatch[1];

    const prefixedMatch = trimmed.match(/^(?:kode|verifikasi|code)\s*[:#-]?\s*(\d{6})$/i);
    if (prefixedMatch && prefixedMatch[1]) return prefixedMatch[1];

    return null;
  }

  /**
   * Verify challenge directly from incoming WhatsApp text message.
   */
  static async verifyFromWhatsAppMessage(
    normalizedPhone: string,
    code: string
  ): Promise<{ success: boolean; userId?: string; error?: string }> {
    const cleanedCode = code.trim().replace(/\D/g, "");

    const [challenge] = await db
      .select()
      .from(whatsappVerificationChallenges)
      .where(
        and(
          eq(whatsappVerificationChallenges.phoneNumber, normalizedPhone),
          eq(whatsappVerificationChallenges.isUsed, false),
          gte(whatsappVerificationChallenges.expiresAt, new Date())
        )
      )
      .orderBy(desc(whatsappVerificationChallenges.createdAt))
      .limit(1);

    if (!challenge) {
      return { success: false, error: "Tidak ada kode verifikasi aktif untuk nomor ini." };
    }

    if (challenge.attempts >= MAX_ATTEMPTS) {
      await db
        .update(whatsappVerificationChallenges)
        .set({ isUsed: true })
        .where(eq(whatsappVerificationChallenges.id, challenge.id));
      return { success: false, error: "Batas percobaan terlampaui." };
    }

    const inputHash = crypto.createHash("sha256").update(cleanedCode).digest("hex");
    const isMatch = crypto.timingSafeEqual(
      Buffer.from(inputHash, "hex"),
      Buffer.from(challenge.codeHash, "hex")
    );

    if (!isMatch) {
      await db
        .update(whatsappVerificationChallenges)
        .set({ attempts: challenge.attempts + 1 })
        .where(eq(whatsappVerificationChallenges.id, challenge.id));
      return { success: false, error: "Kode salah." };
    }

    // Success
    await db
      .update(whatsappVerificationChallenges)
      .set({ isUsed: true })
      .where(eq(whatsappVerificationChallenges.id, challenge.id));

    await db
      .update(whatsappContacts)
      .set({
        verifiedAt: new Date(),
        isActive: true,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(whatsappContacts.userId, challenge.userId),
          eq(whatsappContacts.phoneNumber, normalizedPhone)
        )
      );

    return { success: true, userId: challenge.userId };
  }
}
