import { db } from "@/lib/db";
import { whatsappMessages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { WhatsAppInboundMessage, ProcessedWhatsAppMessage } from "./types";
import { UserMappingService } from "./user-mapping.service";
import { WhatsAppVerificationService } from "./verification.service";
import { PendingActionService } from "./pending-action.service";
import { FinancialParserService } from "@/services/ai/parser.service";
import { IWhatsAppClient, whatsAppClient } from "./client";

export class WhatsAppMessageService {
  /**
   * Process a single normalized inbound WhatsApp message.
   *
   * Responsibilities:
   * 1. Idempotency check via unique whatsapp_message_id constraint.
   * 2. Message lifecycle status updates: RECEIVED -> PROCESSING -> PROCESSED | IGNORED | UNSUPPORTED | FAILED.
   * 3. Deterministic verification challenge handling.
   * 4. Identity resolution via UserMappingService (verified only).
   * 5. Deterministic YA / BATAL confirmation handling.
   * 6. Financial natural language parsing via FinancialParserService.
   * 7. Routing confirmed actions exclusively through the existing financial core.
   */
  static async processInboundMessage(
    message: WhatsAppInboundMessage,
    client: IWhatsAppClient = whatsAppClient,
    parserService?: FinancialParserService
  ): Promise<ProcessedWhatsAppMessage> {
    const parser = parserService || new FinancialParserService();

    // Step 1: Idempotency insert into whatsapp_messages table
    const [inserted] = await db
      .insert(whatsappMessages)
      .values({
        whatsappMessageId: message.providerMessageId,
        phoneNumber: message.normalizedPhoneNumber,
        messageType: message.messageType,
        messageText: message.text,
        rawPayload: message.rawPayload as Record<string, unknown>,
        receivedAt: message.receivedAt,
        status: "RECEIVED",
      })
      .onConflictDoNothing({ target: whatsappMessages.whatsappMessageId })
      .returning();

    // If duplicate message arrived, return idempotent duplicate response without resending reply
    if (!inserted) {
      const [existing] = await db
        .select()
        .from(whatsappMessages)
        .where(eq(whatsappMessages.whatsappMessageId, message.providerMessageId))
        .limit(1);

      return {
        id: existing?.id || "",
        providerMessageId: message.providerMessageId,
        userId: existing?.userId || null,
        phoneNumber: message.normalizedPhoneNumber,
        status: "DUPLICATE",
        isDuplicate: true,
      };
    }

    // Mark as PROCESSING
    await db
      .update(whatsappMessages)
      .set({ status: "PROCESSING", updatedAt: new Date() })
      .where(eq(whatsappMessages.id, inserted.id));

    let outboundReply: string | null = null;
    let finalStatus: "PROCESSED" | "IGNORED" | "UNSUPPORTED" | "FAILED" = "PROCESSED";
    let matchedUserId: string | null = null;

    try {
      const trimmedText = message.text ? message.text.trim() : "";
      const lowerText = trimmedText.toLowerCase();

      // Step 2: Check if message is a phone verification code (e.g. "123456" or "KODE 123456")
      const verificationCode = WhatsAppVerificationService.extractVerificationCode(trimmedText);
      if (verificationCode) {
        const verifyRes = await WhatsAppVerificationService.verifyFromWhatsAppMessage(
          message.normalizedPhoneNumber,
          verificationCode
        );

        if (verifyRes.success) {
          matchedUserId = verifyRes.userId || null;
          finalStatus = "PROCESSED";
          outboundReply =
            "Selamat! Nomor WhatsApp Anda berhasil diverifikasi dan terhubung dengan akun FinTrack.\n\n" +
            "Sekarang Anda dapat mencatat transaksi keuangan secara mudah melalui pesan WhatsApp ini.";
        } else {
          finalStatus = "IGNORED";
          outboundReply =
            `Verifikasi gagal: ${verifyRes.error || "Kode salah atau sudah kadaluarsa."}\n\n` +
            `Silakan minta kode verifikasi baru melalui aplikasi FinTrack.`;
        }
      } else {
        // Step 3: Resolve user identity (must be verified active contact)
        const mapping = await UserMappingService.findUserByPhoneNumber(
          message.normalizedPhoneNumber,
          true // Only verified contacts
        );

        if (!mapping) {
          // Unlinked or unverified contact
          finalStatus = "IGNORED";
          outboundReply =
            "Nomor WhatsApp ini belum terhubung atau belum diverifikasi dengan akun FinTrack.\n\n" +
            "Silakan hubungkan nomor WhatsApp Anda terlebih dahulu melalui menu profil aplikasi FinTrack.";
        } else {
          matchedUserId = mapping.userId;

          if (message.messageType !== "text") {
            // Unsupported message type
            finalStatus = "UNSUPPORTED";
            outboundReply =
              "Format pesan tidak didukung. FinTrack saat ini hanya mendukung pesan teks untuk pencatatan transaksi.";
          } else {
            // Step 4: Check for deterministic confirmation / cancellation commands
            const isConfirmCmd = [
              "ya",
              "y",
              "iya",
              "ok",
              "okay",
              "lanjut",
              "konfirmasi",
              "setuju",
            ].includes(lowerText);

            const isCancelCmd = [
              "batal",
              "cancel",
              "tidak",
              "gak",
              "ga",
            ].includes(lowerText);

            if (isConfirmCmd) {
              const activeAction = await PendingActionService.getActivePendingAction(
                mapping.userId,
                message.normalizedPhoneNumber
              );

              if (!activeAction) {
                outboundReply =
                  "Tidak ada transaksi yang sedang menunggu konfirmasi atau batas waktu konfirmasi telah habis.\n\n" +
                  "Kirim pesan transaksi baru untuk memulai, contoh: 'Beli kopi 25 ribu'.";
              } else {
                try {
                  await PendingActionService.confirmAction(
                    activeAction.id,
                    mapping.userId
                  );
                  outboundReply =
                    "Transaksi berhasil dicatat!\n\n" +
                    "Catatan keuangan Anda telah berhasil diperbarui.";
                } catch (err: unknown) {
                  const errMsg =
                    err instanceof Error ? err.message : "Gagal mengonfirmasi transaksi";
                  if (errMsg.includes("DUPLICATE_CONFIRMATION")) {
                    outboundReply = "Transaksi ini sudah dicatat sebelumnya.";
                  } else {
                    outboundReply = `Gagal mencatat transaksi: ${errMsg}`;
                  }
                }
              }
              finalStatus = "PROCESSED";
            } else if (isCancelCmd) {
              const activeAction = await PendingActionService.getActivePendingAction(
                mapping.userId,
                message.normalizedPhoneNumber
              );

              if (activeAction) {
                await PendingActionService.cancelAction(
                  activeAction.id,
                  mapping.userId
                );
                outboundReply = "Pencatatan transaksi telah dibatalkan.";
              } else {
                outboundReply = "Tidak ada transaksi yang perlu dibatalkan.";
              }
              finalStatus = "PROCESSED";
            } else {
              // Step 5: Natural Language Financial Parser
              const parseResult = await parser.processFinancialText(
                trimmedText,
                mapping.userId
              );

              if (parseResult.status === "READY_FOR_CONFIRMATION") {
                await PendingActionService.createPendingAction(
                  mapping.userId,
                  message.normalizedPhoneNumber,
                  message.providerMessageId,
                  parseResult.intentType,
                  parseResult.payload
                );

                outboundReply = `${parseResult.summaryText}\n\n${parseResult.confirmationPrompt}`;
              } else if (parseResult.status === "NEEDS_CLARIFICATION") {
                outboundReply = parseResult.clarificationText;
              } else {
                outboundReply = parseResult.errorText;
              }
              finalStatus = "PROCESSED";
            }
          }
        }
      }

      // Step 6: Send Outbound WhatsApp message (if reply defined)
      if (outboundReply) {
        await client.sendTextMessage({
          to: message.phoneNumber,
          text: outboundReply,
        });
      }

      // Step 7: Update final status and processedAt
      await db
        .update(whatsappMessages)
        .set({
          userId: matchedUserId,
          status: finalStatus,
          processedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(whatsappMessages.id, inserted.id));

      return {
        id: inserted.id,
        providerMessageId: message.providerMessageId,
        userId: matchedUserId,
        phoneNumber: message.normalizedPhoneNumber,
        status: finalStatus,
        responseSent: outboundReply || undefined,
        isDuplicate: false,
      };
    } catch {
      await db
        .update(whatsappMessages)
        .set({
          status: "FAILED",
          processedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(whatsappMessages.id, inserted.id));

      return {
        id: inserted.id,
        providerMessageId: message.providerMessageId,
        userId: matchedUserId,
        phoneNumber: message.normalizedPhoneNumber,
        status: "FAILED",
        isDuplicate: false,
      };
    }
  }
}
