/**
 * Bug Condition Exploration Test: WhatsApp Immediate Transaction Execution
 * 
 * CRITICAL: This test MUST FAIL on unfixed code - failure confirms the bug exists.
 * DO NOT attempt to fix the test or the code when it fails.
 * 
 * PURPOSE: Surface counterexamples that demonstrate valid transactions incorrectly 
 * trigger confirmation flow instead of executing immediately.
 * 
 * BUG CONDITION: Valid, unambiguous transactions (with all required fields) 
 * should execute immediately without requiring YA/BATAL confirmation.
 * 
 * EXPECTED OUTCOME ON UNFIXED CODE: Test FAILS (proves bug exists)
 * EXPECTED OUTCOME ON FIXED CODE: Test PASSES (proves bug is resolved)
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import {
  createTestDbConnection,
  verifyTestDatabaseSafety,
  cleanTestDatabase,
} from "../../../__tests__/e2e/test-db.utils";
import { seedTestFixtures, TEST_USERS, TEST_ACCOUNTS } from "../../../__tests__/e2e/test-fixtures";
import { createWhatsAppWebhookPayload, generateWebhookSignature } from "../../../__tests__/e2e/helpers";
import { POST } from "@/app/api/webhooks/whatsapp/route";
import { NextRequest } from "next/server";
import { eq, and } from "drizzle-orm";
import { whatsappPendingActions, transactions } from "@/db/schema";

// ─── Test Environment Setup ──────────────────────────────────────────────

vi.mock("@/services/whatsapp/config", () => ({
  getWhatsAppConfig: () => ({
    accessToken: "test-access-token",
    phoneNumberId: "test-phone-number-id",
    verifyToken: "test-verify-token-123",
    appSecret: "test-app-secret",
    apiVersion: "v22.0",
  }),
}));

// Capture sent WhatsApp messages
const sentMessages: Array<{ to: string; text: string }> = [];

vi.mock("@/services/whatsapp/client", () => ({
  whatsAppClient: {
    sendMessage: vi.fn().mockResolvedValue({ success: true }),
    sendTextMessage: vi.fn().mockImplementation(async (params: { to: string; text: string }) => {
      sentMessages.push({ to: params.to, text: params.text });
      return { success: true };
    }),
  },
}));

vi.mock("@/lib/utils/rate-limit", () => ({
  checkRateLimit: () => ({ allowed: true, remaining: 100 }),
}));

// ─── Test Helpers ────────────────────────────────────────────────────────

const db = createTestDbConnection();
const APP_SECRET = "test-app-secret";
const PHONE_A = TEST_USERS.USER_A.phoneNormalized;
const USER_A_ID = TEST_USERS.USER_A.id;

let msgCounter = 0;
function nextMsgId(): string {
  return `bug-exploration-${Date.now()}-${++msgCounter}`;
}

async function sendMessage(phone: string, text: string) {
  const messageId = nextMsgId();
  const payload = createWhatsAppWebhookPayload({ messageId, phone, text });
  const rawBody = JSON.stringify(payload);
  const signature = generateWebhookSignature(rawBody, APP_SECRET);
  const request = new NextRequest("http://localhost:3000/api/webhooks/whatsapp", {
    method: "POST",
    headers: { "x-hub-signature-256": signature, "content-type": "application/json" },
    body: rawBody,
  });
  const response = await POST(request);
  const lastSent = sentMessages[sentMessages.length - 1] ?? null;
  return { response, messageId, lastSent };
}

function clearSent() {
  sentMessages.length = 0;
}

async function getPendingActions(userId: string) {
  return db
    .select()
    .from(whatsappPendingActions)
    .where(and(
      eq(whatsappPendingActions.userId, userId),
      eq(whatsappPendingActions.status, "PENDING")
    ));
}

async function getUserTransactions(userId: string) {
  return db
    .select()
    .from(transactions)
    .where(eq(transactions.userId, userId));
}

// ─── Bug Condition Exploration Tests ────────────────────────────────────

describe("Bug Condition Exploration: WhatsApp Immediate Transaction Execution", () => {
  
  beforeAll(async () => {
    const safety = verifyTestDatabaseSafety();
    expect(safety.isSafe).toBe(true);

    await cleanTestDatabase(db);
    await seedTestFixtures();
  }, 30000);

  afterAll(async () => {
    await cleanTestDatabase(db);
  }, 30000);

  beforeEach(() => {
    clearSent();
  });

  /**
   * BUG MANIFESTATION TEST 1: Single Expense
   * 
   * EXPECTED BEHAVIOR (what should happen after fix):
   * - "beli makan 25k" should execute immediately
   * - NO PendingAction should be created
   * - Response should be success message with balance info
   * - Transaction should be in database immediately
   * 
   * ACTUAL BEHAVIOR (bug - what happens on unfixed code):
   * - "beli makan 25k" creates PendingAction
   * - Response is confirmation prompt with YA/BATAL
   * - NO transaction in database until YA confirmation
   * 
   * This test encodes the EXPECTED behavior and will FAIL on unfixed code.
   */
  test("[BUG] Valid single expense should execute immediately (no YA/BATAL confirmation)", async () => {
    // Send valid expense message
    const { lastSent } = await sendMessage(PHONE_A, "beli makan 25k");
    
    // EXPECTED BEHAVIOR: Immediate execution, no confirmation prompt
    // On UNFIXED code: this will fail because confirmation prompt is sent
    expect(lastSent?.text).not.toContain("YA");
    expect(lastSent?.text).not.toContain("BATAL");
    expect(lastSent?.text).not.toContain("konfirmasi");
    
    // EXPECTED BEHAVIOR: Success response with balance info
    // On UNFIXED code: this will fail because confirmation prompt is sent instead
    expect(lastSent?.text).toContain("✅");
    expect(lastSent?.text).toContain("berhasil");
    expect(lastSent?.text).toContain("Sisa uang keseluruhan");
    
    // EXPECTED BEHAVIOR: No PendingAction created (immediate execution)
    // On UNFIXED code: this will fail because PendingAction is created
    const pendingActions = await getPendingActions(USER_A_ID);
    expect(pendingActions.length).toBe(0);
    
    // EXPECTED BEHAVIOR: Transaction exists in database immediately
    // On UNFIXED code: this will fail because transaction only exists after YA
    const transactionsList = await getUserTransactions(USER_A_ID);
    expect(transactionsList.length).toBeGreaterThanOrEqual(1);
    
    const transaction = transactionsList.find(tx => tx.description.includes("makan"));
    expect(transaction).toBeDefined();
    expect(transaction?.type).toBe("EXPENSE");
    expect(parseFloat(transaction?.amount || "0")).toBeCloseTo(25000, 0);
    
  }, 30000);

  /**
   * BUG MANIFESTATION TEST 2: Two-Message Friction
   * 
   * This test demonstrates the current friction where users must send 
   * two messages (transaction + YA) instead of one message.
   */
  test("[BUG] Current flow requires unnecessary two-message friction", async () => {
    // Send valid transaction
    const { lastSent: confirmationResponse } = await sendMessage(PHONE_A, "beli makan 25k");
    
    // UNFIXED CODE: Creates confirmation prompt
    // EXPECTED BEHAVIOR AFTER FIX: Should be success message
    const isConfirmationPrompt = (
      confirmationResponse?.text.includes("YA") && 
      confirmationResponse?.text.includes("BATAL")
    );
    
    if (isConfirmationPrompt) {
      // This demonstrates the bug: valid transaction requires confirmation
      console.log("BUG CONFIRMED: Valid transaction created confirmation prompt");
      console.log("Confirmation message:", confirmationResponse?.text);
      
      // Verify PendingAction was created (bug behavior)
      const pendingActions = await getPendingActions(USER_A_ID);
      expect(pendingActions.length).toBe(1);
      
      // Send YA to complete the flow
      clearSent();
      const { lastSent: executionResponse } = await sendMessage(PHONE_A, "YA");
      
      // Now transaction should exist
      const transactionsList = await getUserTransactions(USER_A_ID);
      const transaction = transactionsList.find(tx => tx.description.includes("makan"));
      expect(transaction).toBeDefined();
      
      // This test FAILS expectation that one message should be enough
      throw new Error(
        "BUG DEMONSTRATED: Valid transaction 'beli makan 25k' required TWO messages " +
        "(transaction + YA confirmation) instead of immediate execution. " +
        "This proves the bug exists and needs to be fixed."
      );
    } else {
      // This means the bug is already fixed - immediate execution happened
      console.log("Bug appears to be fixed: got immediate success response");
      expect(confirmationResponse?.text).toContain("✅");
      expect(confirmationResponse?.text).toContain("berhasil");
    }
    
  }, 30000);

});
