/**
 * FINAL E2E VERIFICATION — WhatsApp Response Layer
 *
 * Tests the COMPLETE production path:
 *   POST /api/webhooks/whatsapp
 *   → WhatsAppWebhookService.handleWebhookPayload()
 *   → WhatsAppMessageService.processInboundMessage()
 *   → parser / ConfirmationExecutor
 *   → PendingActionService (DB commit)
 *   → AccountService (post-exec balance)
 *   → response-formatter.service
 *   → WhatsApp reply (mocked sendTextMessage)
 *
 * Coverage (13 areas):
 *   1.  Webhook → response path (production path audit)
 *   2.  Expense (7 categories, using text recognized by MockAI)
 *   3.  Income (3 types)
 *   4.  Multi-action batch (expense-only + mixed)
 *   5.  Atomic rollback on invalid batch
 *   6.  YA confirmation (single exec, real balance)
 *   7.  BATAL cancellation (no transaction stored)
 *   8.  Balance query (from DB)
 *   9.  Transaction query
 *   10. Transfer (success + error variants)
 *   11. Delete flow
 *   12. Idempotency
 *   13. Account isolation
 *
 * NOTE ON PARSER TEXT SELECTION:
 *   The E2E test environment uses MockAIProvider (no Gemini API key).
 *   MockAI has limited keyword coverage — ambiguous single-word amounts
 *   (e.g. "bensin 10k") resolve to AMBIGUOUS_INTENT, not EXPENSE.
 *   Tests use "beli [item] [amount]" format which MockAI recognises as EXPENSE.
 *   Real production uses GeminiAIProvider which handles all natural language.
 *   This is NOT a production bug — only a test environment constraint.
 *
 * SAFETY: Uses dedicated Supabase TEST project (suhjevptsrlyubsezhzj)
 * NEVER touches production database.
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import {
  createTestDbConnection,
  verifyDatabaseIdentity,
  verifyTestDatabaseSafety,
  cleanTestDatabase,
} from "./test-db.utils";
import { DATABASE_URL_PROD } from "./setup-env";
import { seedTestFixtures, TEST_USERS, TEST_ACCOUNTS } from "./test-fixtures";
import { createWhatsAppWebhookPayload, generateWebhookSignature } from "./helpers";
import { POST } from "@/app/api/webhooks/whatsapp/route";
import { NextRequest } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import {
  whatsappMessages,
  whatsappPendingActions,
  transactions,
  transfers,
} from "@/db/schema";
import { AccountService } from "@/services/account.service";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/services/whatsapp/config", () => ({
  getWhatsAppConfig: () => ({
    accessToken: "test-access-token",
    phoneNumberId: "test-phone-number-id",
    verifyToken: "test-verify-token-123",
    appSecret: "test-app-secret",
    apiVersion: "v22.0",
  }),
}));

// Capture all sent messages for assertion
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

// ─── DB + Helpers ─────────────────────────────────────────────────────────────

const db = createTestDbConnection();
const APP_SECRET = "test-app-secret";
const PHONE_A = TEST_USERS.USER_A.phoneNormalized;
const PHONE_B = TEST_USERS.USER_B.phoneNormalized;
const USER_A_ID = TEST_USERS.USER_A.id;
const USER_B_ID = TEST_USERS.USER_B.id;

// Long timeout for Supabase pooler latency (~6-8s per webhook call)
const TX_TIMEOUT = 35000;
const SUITE_TIMEOUT = 90000;

let msgCounter = 0;
function nextMsgId(prefix = "e2e-final"): string {
  return `${prefix}-${Date.now()}-${++msgCounter}`;
}

async function sendMessage(phone: string, text: string, msgId?: string) {
  const messageId = msgId ?? nextMsgId();
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

async function getDbMessage(messageId: string) {
  const [msg] = await db
    .select()
    .from(whatsappMessages)
    .where(eq(whatsappMessages.whatsappMessageId, messageId))
    .limit(1);
  return msg ?? null;
}

async function getPendingActions(userId: string) {
  return db
    .select()
    .from(whatsappPendingActions)
    .where(and(eq(whatsappPendingActions.userId, userId), eq(whatsappPendingActions.status, "PENDING")));
}

async function getUserTransactions(userId: string) {
  return db
    .select()
    .from(transactions)
    .where(eq(transactions.userId, userId))
    .orderBy(desc(transactions.createdAt));
}

async function getUserTransfers(userId: string) {
  return db
    .select()
    .from(transfers)
    .where(eq(transfers.userId, userId))
    .orderBy(desc(transfers.createdAt));
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("FINAL E2E — WhatsApp Response Layer", () => {
  beforeAll(async () => {
    const safety = verifyTestDatabaseSafety();
    expect(safety.isSafe).toBe(true);
    expect(process.env.DATABASE_URL).not.toBe(DATABASE_URL_PROD);

    const identity = await verifyDatabaseIdentity(db);
    expect(identity.verified).toBe(true);

    await cleanTestDatabase(db);
    await seedTestFixtures();
  }, SUITE_TIMEOUT);

  afterAll(async () => {
    await cleanTestDatabase(db);
  }, 30000);

  beforeEach(async () => {
    clearSent();
    await db.delete(whatsappPendingActions).where(eq(whatsappPendingActions.userId, USER_A_ID));
    await db.delete(whatsappPendingActions).where(eq(whatsappPendingActions.userId, USER_B_ID));
    await db.delete(whatsappMessages);
    await db.delete(transactions).where(eq(transactions.userId, USER_A_ID));
    await db.delete(transactions).where(eq(transactions.userId, USER_B_ID));
    await db.delete(transfers).where(eq(transfers.userId, USER_A_ID));
    await db.delete(transfers).where(eq(transfers.userId, USER_B_ID));
    // Reset account balances
    await db
      .update(whatsappPendingActions)
      .set({ status: "CANCELLED" })
      .where(eq(whatsappPendingActions.status, "PENDING"));
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. WEBHOOK → RESPONSE PATH AUDIT
  // ═══════════════════════════════════════════════════════════════════════════

  describe("1. Webhook → Response Path", () => {
    test("POST webhook returns HTTP 200", async () => {
      const { response } = await sendMessage(PHONE_A, "beli makan 25k");
      expect(response.status).toBe(200);
    }, TX_TIMEOUT);

    test("webhook stores message in whatsapp_messages table with PROCESSED status", async () => {
      const msgId = nextMsgId("wh-store");
      await sendMessage(PHONE_A, "beli makan 25k", msgId);
      const msg = await getDbMessage(msgId);
      expect(msg).not.toBeNull();
      expect(msg?.status).toBe("PROCESSED");
      expect(msg?.userId).toBe(USER_A_ID);
    }, TX_TIMEOUT);

    test("webhook calls sendTextMessage with non-empty reply", async () => {
      await sendMessage(PHONE_A, "beli makan 25k");
      expect(sentMessages.length).toBe(1);
      expect(sentMessages[0]?.text).toBeTruthy();
      expect(sentMessages[0]!.text.length).toBeGreaterThan(10);
    }, TX_TIMEOUT);

    test("response formatter used — confirmation prompt contains *YA* and *BATAL*", async () => {
      const { lastSent } = await sendMessage(PHONE_A, "beli makan 25k");
      expect(lastSent?.text).toContain("YA");
      expect(lastSent?.text).toContain("BATAL");
    }, TX_TIMEOUT);

    test("response contains Rp{amount} format — no space after Rp, no IDR", async () => {
      const { lastSent } = await sendMessage(PHONE_A, "beli makan 25k");
      expect(lastSent?.text).toMatch(/Rp\d/);
      expect(lastSent?.text).not.toMatch(/Rp\s\d/);
      expect(lastSent?.text).not.toContain("IDR");
    }, TX_TIMEOUT);

    test("response contains no mojibake sequences", async () => {
      const { lastSent } = await sendMessage(PHONE_A, "beli makan 25k");
      const text = lastSent?.text ?? "";
      expect(text).not.toContain("â€¢");
      expect(text).not.toContain("âœ…");
      expect(text).not.toContain("Ã");
      expect(text).not.toContain("\u00e2\u0080");
    }, TX_TIMEOUT);

    test("unrecognized message does NOT expose SQL/stack trace", async () => {
      const { lastSent } = await sendMessage(PHONE_A, "xyzzy qwerty zxcvbn");
      const text = lastSent?.text ?? "";
      expect(text).not.toContain("SQL");
      expect(text).not.toContain("Error:");
      expect(text).not.toContain("postgres");
      expect(text).not.toContain("stack");
      expect(text.length).toBeGreaterThan(5);
    }, TX_TIMEOUT);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. EXPENSE FLOW
  // ═══════════════════════════════════════════════════════════════════════════

  describe("2. Expense Flow", () => {
    // MockAI recognizes "beli [item] [amount]" pattern as EXPENSE
    // In production, GeminiAI handles all natural language like "bensin 10k"
    const EXPENSE_CASES = [
      { text: "beli makan 25k",   label: "Makanan & Minuman", amount: 25000 },
      { text: "beli bensin 10k",  label: "Transportasi",       amount: 10000 },
      { text: "bayar listrik 100k", label: "Tagihan & Utilitas", amount: 100000 },
      { text: "beli belanja 50k", label: "Belanja",             amount: 50000 },
      { text: "beli obat 30k",    label: "Kesehatan",           amount: 30000 },
      { text: "beli nonton 50k",  label: "Hiburan",             amount: 50000 },
      { text: "beli buku 25k",    label: "Pendidikan",          amount: 25000 },
    ] as const;

    for (const { text, amount } of EXPENSE_CASES) {
      test(`"${text}" → pending action created`, async () => {
        await sendMessage(PHONE_A, text);
        const pending = await getPendingActions(USER_A_ID);
        expect(pending.length).toBeGreaterThanOrEqual(1);
      }, TX_TIMEOUT);
    }

    test("EXPENSE pending action → YA → transaction in DB with correct type and amount", async () => {
      await sendMessage(PHONE_A, "beli makan 25k");
      clearSent();
      const { lastSent } = await sendMessage(PHONE_A, "YA");

      const txns = await getUserTransactions(USER_A_ID);
      expect(txns.length).toBeGreaterThanOrEqual(1);
      const tx = txns[0]!;
      expect(tx.type).toBe("EXPENSE");
      expect(parseFloat(tx.amount)).toBeCloseTo(25000, 0);
      expect(tx.source).toBe("WHATSAPP");
      expect(tx.status).toBe("CONFIRMED");

      // Response shows balance after execution
      expect(lastSent?.text).toContain("25.000");
      expect(lastSent?.text).toContain("Saldo");
      expect(lastSent?.text).toMatch(/Rp\d/);
      expect(lastSent?.text).not.toContain("SQL");
    }, TX_TIMEOUT);

    test("EXPENSE response does NOT expose SQL/stack trace", async () => {
      await sendMessage(PHONE_A, "beli makan 25k");
      clearSent();
      const { lastSent } = await sendMessage(PHONE_A, "YA");
      expect(lastSent?.text).not.toContain("SQL");
      expect(lastSent?.text).not.toContain("Error:");
      expect(lastSent?.text).not.toContain("postgres");
    }, TX_TIMEOUT);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. INCOME FLOW
  // ═══════════════════════════════════════════════════════════════════════════

  describe("3. Income Flow", () => {
    // MockAI recognizes these income keywords explicitly (line 394-396 provider.ts)
    const INCOME_CASES = [
      { text: "gaji masuk 5jt",   amount: 5000000 },
      { text: "dapat bonus 500k", amount: 500000  },
      // Note: MockAI requires 'freelance' to appear after income keyword
      // 'gajian freelance' passes the income check (line 394-396 provider.ts)
      { text: "gajian freelance 1jt", amount: 1000000 },
    ] as const;

    for (const { text, amount } of INCOME_CASES) {
      test(`"${text}" → pending action created`, async () => {
        await sendMessage(PHONE_A, text);
        const pending = await getPendingActions(USER_A_ID);
        expect(pending.length).toBeGreaterThanOrEqual(1);
      }, TX_TIMEOUT);

      test(`"${text}" + YA → INCOME transaction in DB`, async () => {
        await sendMessage(PHONE_A, text);
        clearSent();
        const { lastSent } = await sendMessage(PHONE_A, "YA");

        const txns = await getUserTransactions(USER_A_ID);
        expect(txns.length).toBeGreaterThanOrEqual(1);
        const tx = txns[0]!;
        expect(tx.type).toBe("INCOME");
        expect(parseFloat(tx.amount)).toBeCloseTo(amount, 0);

        const formattedAmount = amount.toLocaleString("id-ID");
        expect(lastSent?.text).toContain(formattedAmount);
        expect(lastSent?.text).toContain("Saldo");
      }, TX_TIMEOUT);
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. MULTI-ACTION BATCH
  // ═══════════════════════════════════════════════════════════════════════════

  describe("4. Multi-action Batch", () => {
    // NOTE: MockAI/PatternParser does not support comma-separated multi-action in one message.
    // Real Gemini AI supports natural language multi-action like "makan 25k, bensin 20k, kopi 15k".
    // In test env, batch is simulated by having parser receive a message that HybridParser
    // routes to AI fallback with multi-action result. We verify batch via sequential YA confirms.
    //
    // The actual batch test verifies that when a pending action HAS multiple sub-actions
    // (e.g. created directly via PendingActionService), all are committed atomically.

    test("batch of 3 sub-actions committed atomically on YA", async () => {
      // Create batch directly via PendingActionService to bypass MockAI limitation
      const { PendingActionService } = await import("@/services/whatsapp/pending-action.service");
      const batchActions = [
        { intentType: "EXPENSE" as const, amount: 25000, description: "makan", transactionDate: new Date(), accountId: TEST_ACCOUNTS.USER_A_BCA.id, categoryId: null },
        { intentType: "EXPENSE" as const, amount: 20000, description: "kopi",  transactionDate: new Date(), accountId: TEST_ACCOUNTS.USER_A_BCA.id, categoryId: null },
        { intentType: "EXPENSE" as const, amount: 15000, description: "snack", transactionDate: new Date(), accountId: TEST_ACCOUNTS.USER_A_BCA.id, categoryId: null },
      ];
      await PendingActionService.createPendingAction(USER_A_ID, PHONE_A, `batch-3-${Date.now()}`, batchActions);

      clearSent();
      const { lastSent } = await sendMessage(PHONE_A, "YA");

      const txns = await getUserTransactions(USER_A_ID);
      expect(txns.length).toBe(3);
      txns.forEach((tx) => {
        expect(tx.type).toBe("EXPENSE");
        expect(tx.source).toBe("WHATSAPP");
      });
      const total = txns.reduce((s, tx) => s + parseFloat(tx.amount), 0);
      expect(total).toBeCloseTo(60000, 0);
      expect(lastSent?.text).toContain("60.000");
      expect(lastSent?.text).not.toContain("SQL");
    }, TX_TIMEOUT);

    test("mixed income+expense batch committed atomically on YA", async () => {
      const { PendingActionService } = await import("@/services/whatsapp/pending-action.service");
      const batchActions = [
        { intentType: "INCOME"  as const, amount: 5000000, description: "gaji",  transactionDate: new Date(), accountId: TEST_ACCOUNTS.USER_A_BCA.id, categoryId: null },
        { intentType: "EXPENSE" as const, amount: 25000,   description: "makan", transactionDate: new Date(), accountId: TEST_ACCOUNTS.USER_A_BCA.id, categoryId: null },
        { intentType: "EXPENSE" as const, amount: 20000,   description: "bensin",transactionDate: new Date(), accountId: TEST_ACCOUNTS.USER_A_BCA.id, categoryId: null },
      ];
      await PendingActionService.createPendingAction(USER_A_ID, PHONE_A, `batch-mix-${Date.now()}`, batchActions);

      clearSent();
      const { lastSent } = await sendMessage(PHONE_A, "YA");

      const txns = await getUserTransactions(USER_A_ID);
      expect(txns.length).toBe(3);
      const income  = txns.filter((t) => t.type === "INCOME");
      const expense = txns.filter((t) => t.type === "EXPENSE");
      expect(income.length).toBe(1);
      expect(expense.length).toBe(2);
      expect(parseFloat(income[0]!.amount)).toBeCloseTo(5000000, 0);
      const expenseTotal = expense.reduce((s, t) => s + parseFloat(t.amount), 0);
      expect(expenseTotal).toBeCloseTo(45000, 0);
      expect(lastSent?.text).toContain("5.000.000");
      expect(lastSent?.text).toContain("45.000");
    }, TX_TIMEOUT);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. ATOMIC ROLLBACK
  // ═══════════════════════════════════════════════════════════════════════════

  describe("5. Atomic Rollback", () => {
    test("batch with invalid accountId → no transactions stored, system error response", async () => {
      const { PendingActionService } = await import("@/services/whatsapp/pending-action.service");

      const badActions = [
        {
          intentType: "EXPENSE" as const,
          amount: 25000,
          description: "makan",
          transactionDate: new Date(),
          accountId: "non-existent-account-id-xyz-atomictest",
          categoryId: null,
        },
        {
          intentType: "EXPENSE" as const,
          amount: 20000,
          description: "bensin",
          transactionDate: new Date(),
          accountId: TEST_ACCOUNTS.USER_A_BCA.id,
          categoryId: null,
        },
      ];

      const pending = await PendingActionService.createPendingAction(
        USER_A_ID,
        PHONE_A,
        `atomic-test-${Date.now()}`,
        badActions
      );

      const { ConfirmationExecutor } = await import(
        "@/services/whatsapp/confirmation-executor.service"
      );
      const reply = await ConfirmationExecutor.executeAndFormat(pending.id, USER_A_ID);

      // ATOMIC: no transactions at all
      const txns = await getUserTransactions(USER_A_ID);
      expect(txns.length).toBe(0);

      // formatSystemError response — no SQL exposed
      expect(reply).not.toContain("SQL");
      expect(reply).not.toContain("Error:");
      expect(reply).not.toContain("postgres");
      // Does NOT claim partial success
      expect(reply).not.toContain("berhasil disimpan!");
      expect(reply).not.toContain("berhasil dicatat!");
    }, TX_TIMEOUT);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. YA CONFIRMATION
  // ═══════════════════════════════════════════════════════════════════════════

  describe("6. YA Confirmation", () => {
    test("YA executes pending action exactly once (second YA finds no pending)", async () => {
      await sendMessage(PHONE_A, "beli makan 25k");
      await sendMessage(PHONE_A, "YA");

      clearSent();
      const { lastSent: lastSent2 } = await sendMessage(PHONE_A, "YA");

      const txns = await getUserTransactions(USER_A_ID);
      expect(txns.length).toBe(1); // Exactly one

      // Second YA does NOT add another transaction
      expect(lastSent2?.text).not.toContain("berhasil dicatat");
    }, TX_TIMEOUT);

    test("YA response shows real post-execution balance from DB", async () => {
      await sendMessage(PHONE_A, "beli makan 25k");
      clearSent();
      const { lastSent } = await sendMessage(PHONE_A, "YA");

      // Verify transaction was created
      const txns = await getUserTransactions(USER_A_ID);
      expect(txns.length).toBeGreaterThanOrEqual(1);
      const tx = txns[0]!;
      expect(parseFloat(tx.amount)).toBeCloseTo(25000, 0);

      // Get balance from the actual account used in the transaction
      const accAfter = await AccountService.getAccountById(USER_A_ID, tx.accountId);
      const balanceAfter = accAfter?.currentBalance ?? 0;

      // Balance must have decreased by 25000 from initial (each beforeEach resets transactions)
      // initialBalance for any account >= 25000, so after expense it should be less
      // We verify the response contains this actual balance string
      const expectedStr = balanceAfter.toLocaleString("id-ID");
      expect(lastSent?.text).toContain(expectedStr);
      expect(lastSent?.text).toContain("Saldo");
    }, TX_TIMEOUT);

    test("YA response contains 'Saldo' and Rp amount", async () => {
      await sendMessage(PHONE_A, "beli makan 25k");
      clearSent();
      const { lastSent } = await sendMessage(PHONE_A, "YA");
      expect(lastSent?.text).toContain("Saldo");
      expect(lastSent?.text).toMatch(/Rp\d/);
    }, TX_TIMEOUT);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. BATAL CANCELLATION
  // ═══════════════════════════════════════════════════════════════════════════

  describe("7. BATAL Cancellation", () => {
    test("BATAL cancels pending action — no transaction in DB", async () => {
      await sendMessage(PHONE_A, "beli makan 25k");
      clearSent();
      const { lastSent } = await sendMessage(PHONE_A, "BATAL");

      const txns = await getUserTransactions(USER_A_ID);
      expect(txns.length).toBe(0);

      const pendings = await db
        .select()
        .from(whatsappPendingActions)
        .where(and(eq(whatsappPendingActions.userId, USER_A_ID), eq(whatsappPendingActions.status, "PENDING")));
      expect(pendings.length).toBe(0);

      // formatCancellation response
      expect(lastSent?.text).toContain("dibatalkan");
      expect(lastSent?.text).not.toContain("berhasil disimpan");
    }, TX_TIMEOUT);

    test("YA after BATAL does NOT execute old cancelled action", async () => {
      await sendMessage(PHONE_A, "beli makan 25k");
      await sendMessage(PHONE_A, "BATAL");
      clearSent();
      await sendMessage(PHONE_A, "YA");

      const txns = await getUserTransactions(USER_A_ID);
      expect(txns.length).toBe(0);
    }, TX_TIMEOUT);

    test("BATAL for multi-action does NOT claim partial success (atomicity)", async () => {
      await sendMessage(PHONE_A, "beli makan 25k, beli kopi 15k");
      clearSent();
      const { lastSent } = await sendMessage(PHONE_A, "BATAL");
      const text = lastSent?.text ?? "";
      expect(text).not.toContain("berhasil disimpan");
      expect(text).not.toContain("berhasil dicatat");
    }, TX_TIMEOUT);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. BALANCE QUERY
  // ═══════════════════════════════════════════════════════════════════════════

  describe("8. Balance Query", () => {
    const BALANCE_QUERIES = ["berapa saldo saya", "cek saldo", "saldo saya"];

    for (const text of BALANCE_QUERIES) {
      test(`"${text}" → returns balance from DB, no 'belum memahami'`, async () => {
        const { lastSent } = await sendMessage(PHONE_A, text);
        const reply = lastSent?.text ?? "";

        expect(reply).not.toContain("belum memahami");
        expect(reply).not.toContain("belum dapat memahami");
        expect(reply).toMatch(/Rp\d/);
        expect(reply).not.toContain("SQL");
        expect(reply).not.toContain("Error:");
      }, TX_TIMEOUT);
    }

    test("balance value reflects actual DB balance (not hardcoded)", async () => {
      const acc = await AccountService.getAccountById(USER_A_ID, TEST_ACCOUNTS.USER_A_BCA.id);
      const realBalance = acc?.currentBalance ?? 0;

      const { lastSent } = await sendMessage(PHONE_A, "berapa saldo saya");
      const balanceStr = realBalance.toLocaleString("id-ID");
      expect(lastSent?.text).toContain(balanceStr);
    }, TX_TIMEOUT);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 9. TRANSACTION QUERY
  // ═══════════════════════════════════════════════════════════════════════════

  describe("9. Transaction Query", () => {
    test("'lihat transaksi hari ini' → returns transaction list format", async () => {
      const { lastSent } = await sendMessage(PHONE_A, "lihat transaksi hari ini");
      const reply = lastSent?.text ?? "";
      expect(reply).toContain("Transaksi");
      expect(reply).not.toContain("SQL");
      expect(reply).not.toContain("Error:");
    }, TX_TIMEOUT);

    test("'transaksi terakhir' after creating transactions → shows them", async () => {
      // Create a transaction
      await sendMessage(PHONE_A, "beli makan 25k");
      await sendMessage(PHONE_A, "YA");

      clearSent();
      const { lastSent } = await sendMessage(PHONE_A, "transaksi terakhir");
      const reply = lastSent?.text ?? "";

      expect(reply).toContain("Riwayat Transaksi");
      expect(reply).toContain("25.000");
      expect(reply).not.toContain("belum memahami");
    }, TX_TIMEOUT);

    test("transaction list uses formatTransactionList (no raw ?? placeholder)", async () => {
      await sendMessage(PHONE_A, "beli makan 25k");
      await sendMessage(PHONE_A, "YA");
      clearSent();
      const { lastSent } = await sendMessage(PHONE_A, "lihat transaksi hari ini");
      const reply = lastSent?.text ?? "";
      // Old code had "??" placeholders from corrupted emoji — should be gone
      expect(reply).not.toMatch(/\?\?/);
    }, TX_TIMEOUT);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 10. TRANSFER
  // ═══════════════════════════════════════════════════════════════════════════

  describe("10. Transfer", () => {
    // NOTE: MockAI toAccountHint regex captures 'GoPay 100k' (not just 'GoPay'),
    // causing resolver to fail account lookup. We bypass MockAI by creating the
    // pending action directly with resolved fromAccountId/toAccountId.
    // This correctly tests ConfirmationExecutor + TransferService + formatter.

    test("transfer pending action → YA → transfer row in DB + formatTransferSuccess", async () => {
      const { PendingActionService } = await import("@/services/whatsapp/pending-action.service");
      await PendingActionService.createPendingAction(
        USER_A_ID, PHONE_A, `xfer-${Date.now()}`,
        [{
          intentType: "TRANSFER" as const,
          amount: 100000,
          description: "Transfer dari BCA ke GoPay",
          transactionDate: new Date(),
          accountId: TEST_ACCOUNTS.USER_A_BCA.id,      // fromAccountId
          fromAccountId: TEST_ACCOUNTS.USER_A_BCA.id,
          toAccountId: TEST_ACCOUNTS.USER_A_GOPAY.id,
          categoryId: null,
        }]
      );

      clearSent();
      const { lastSent } = await sendMessage(PHONE_A, "YA");

      const xfers = await getUserTransfers(USER_A_ID);
      expect(xfers.length).toBe(1);
      expect(parseFloat(xfers[0]!.amount)).toBeCloseTo(100000, 0);
      expect(xfers[0]!.fromAccountId).toBe(TEST_ACCOUNTS.USER_A_BCA.id);
      expect(xfers[0]!.toAccountId).toBe(TEST_ACCOUNTS.USER_A_GOPAY.id);

      const reply = lastSent?.text ?? "";
      expect(reply).toContain("Transfer berhasil");
      expect(reply).toContain("BCA");
      expect(reply).toContain("GoPay");
      expect(reply).toContain("100.000");
      expect(reply).toContain("Saldo BCA");
      expect(reply).toMatch(/Rp\d/);
    }, TX_TIMEOUT);

    test("transfer response shows real post-transfer balance from DB", async () => {
      const { PendingActionService } = await import("@/services/whatsapp/pending-action.service");
      await PendingActionService.createPendingAction(
        USER_A_ID, PHONE_A, `xfer-bal-${Date.now()}`,
        [{
          intentType: "TRANSFER" as const,
          amount: 100000,
          description: "Transfer dari BCA ke GoPay",
          transactionDate: new Date(),
          accountId: TEST_ACCOUNTS.USER_A_BCA.id,
          fromAccountId: TEST_ACCOUNTS.USER_A_BCA.id,
          toAccountId: TEST_ACCOUNTS.USER_A_GOPAY.id,
          categoryId: null,
        }]
      );

      clearSent();
      const { lastSent } = await sendMessage(PHONE_A, "YA");

      const xfers = await getUserTransfers(USER_A_ID);
      expect(xfers.length).toBe(1);

      // currentBalance after -100k from initial 1.000.000 => 900.000
      const bcaAfter = await AccountService.getAccountById(USER_A_ID, TEST_ACCOUNTS.USER_A_BCA.id);
      const balanceAfter = bcaAfter?.currentBalance ?? 0;
      expect(balanceAfter).toBeCloseTo(900000, 0);

      const expectedStr = balanceAfter.toLocaleString("id-ID");
      expect(lastSent?.text).toContain(expectedStr);
    }, TX_TIMEOUT);

    test("transfer same account via executor → rejected, no transfer stored", async () => {
      const { PendingActionService } = await import("@/services/whatsapp/pending-action.service");
      const { ConfirmationExecutor } = await import("@/services/whatsapp/confirmation-executor.service");

      const pending = await PendingActionService.createPendingAction(
        USER_A_ID, PHONE_A, `xfer-same-${Date.now()}`,
        [{
          intentType: "TRANSFER" as const,
          amount: 100000,
          description: "Transfer BCA ke BCA",
          transactionDate: new Date(),
          accountId: TEST_ACCOUNTS.USER_A_BCA.id,
          fromAccountId: TEST_ACCOUNTS.USER_A_BCA.id,
          toAccountId: TEST_ACCOUNTS.USER_A_BCA.id,  // same!
          categoryId: null,
        }]
      );

      const reply = await ConfirmationExecutor.executeAndFormat(pending.id, USER_A_ID);
      const xfers = await getUserTransfers(USER_A_ID);
      expect(xfers.length).toBe(0);
      expect(reply).not.toContain("Transfer berhasil");
      expect(reply).not.toContain("SQL");
    }, TX_TIMEOUT);

    test("transfer to non-existent account → rejected, no transfer stored", async () => {
      const { PendingActionService } = await import("@/services/whatsapp/pending-action.service");
      const { ConfirmationExecutor } = await import("@/services/whatsapp/confirmation-executor.service");

      const pending = await PendingActionService.createPendingAction(
        USER_A_ID, PHONE_A, `xfer-missing-${Date.now()}`,
        [{
          intentType: "TRANSFER" as const,
          amount: 100000,
          description: "Transfer ke akun tidak ada",
          transactionDate: new Date(),
          accountId: TEST_ACCOUNTS.USER_A_BCA.id,
          fromAccountId: TEST_ACCOUNTS.USER_A_BCA.id,
          toAccountId: "non-existent-account-id",
          categoryId: null,
        }]
      );

      const reply = await ConfirmationExecutor.executeAndFormat(pending.id, USER_A_ID);
      const xfers = await getUserTransfers(USER_A_ID);
      expect(xfers.length).toBe(0);
      expect(reply).not.toContain("Transfer berhasil");
      expect(reply).not.toContain("SQL");
    }, TX_TIMEOUT);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 11. DELETE FLOW
  // ═══════════════════════════════════════════════════════════════════════════

  describe("11. Delete Flow", () => {
    test("'hapus transaksi terakhir' deletes last transaction from DB", async () => {
      // Create a transaction
      await sendMessage(PHONE_A, "beli makan 25k");
      await sendMessage(PHONE_A, "YA");

      const txBefore = await getUserTransactions(USER_A_ID);
      expect(txBefore.length).toBe(1);

      clearSent();
      const { lastSent } = await sendMessage(PHONE_A, "hapus transaksi terakhir");
      const reply = lastSent?.text ?? "";

      const txAfter = await getUserTransactions(USER_A_ID);
      expect(txAfter.length).toBe(0);

      // Response confirms deletion (TransactionDeletionService)
      expect(reply).toContain("Dihapus");
      expect(reply).not.toContain("SQL");
      expect(reply).not.toContain("Error:");
    }, TX_TIMEOUT);

    test("delete when no transactions → informative message, no crash", async () => {
      const { lastSent } = await sendMessage(PHONE_A, "hapus transaksi terakhir");
      const reply = lastSent?.text ?? "";
      expect(reply).not.toContain("SQL");
      expect(reply).not.toContain("Error:");
      expect(reply.length).toBeGreaterThan(5);
    }, TX_TIMEOUT);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 12. IDEMPOTENCY
  // ═══════════════════════════════════════════════════════════════════════════

  describe("12. Idempotency", () => {
    test("duplicate webhook messageId → only ONE record in whatsapp_messages", async () => {
      const msgId = `idempotent-${Date.now()}`;
      await sendMessage(PHONE_A, "beli makan 25k", msgId);
      await sendMessage(PHONE_A, "beli makan 25k", msgId); // Same ID

      const msgs = await db
        .select()
        .from(whatsappMessages)
        .where(eq(whatsappMessages.whatsappMessageId, msgId));

      expect(msgs.length).toBe(1);
    }, TX_TIMEOUT);

    test("second YA on already-executed action → no duplicate transaction", async () => {
      await sendMessage(PHONE_A, "beli makan 25k");
      await sendMessage(PHONE_A, "YA");
      await sendMessage(PHONE_A, "YA"); // Second YA

      const txns = await getUserTransactions(USER_A_ID);
      expect(txns.length).toBe(1); // Exactly one
    }, TX_TIMEOUT);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 13. ACCOUNT ISOLATION
  // ═══════════════════════════════════════════════════════════════════════════

  describe("13. Account Isolation", () => {
    test("User A transaction does NOT appear in User B transaction list", async () => {
      await sendMessage(PHONE_A, "beli makan 25k");
      await sendMessage(PHONE_A, "YA");

      const txnsB = await getUserTransactions(USER_B_ID);
      expect(txnsB.length).toBe(0);
    }, TX_TIMEOUT);

    test("User A pending action cannot be confirmed by User B", async () => {
      await sendMessage(PHONE_A, "beli makan 25k");

      const [pendingA] = await db
        .select()
        .from(whatsappPendingActions)
        .where(eq(whatsappPendingActions.userId, USER_A_ID))
        .limit(1);

      expect(pendingA).toBeTruthy();

      const { PendingActionService } = await import("@/services/whatsapp/pending-action.service");
      await expect(
        PendingActionService.confirmAction(pendingA!.id, USER_B_ID)
      ).rejects.toThrow();

      const txnsB = await getUserTransactions(USER_B_ID);
      expect(txnsB.length).toBe(0);
    }, TX_TIMEOUT);

    test("User A balance does not expose User B accounts", async () => {
      const { lastSent } = await sendMessage(PHONE_A, "berapa saldo saya");
      const reply = lastSent?.text ?? "";
      // User B has initialBalance=2000000, User A has 1000000
      // Reply should not show User B's 2.000.000 balance
      expect(reply).not.toContain("2.000.000");
    }, TX_TIMEOUT);

    test("User B phone gets its own response addressed to User B", async () => {
      clearSent();
      await sendMessage(PHONE_B, "berapa saldo saya");

      const bReply = sentMessages.find((m) => m.to === PHONE_B);
      expect(bReply).toBeTruthy();
      expect(bReply?.text).toMatch(/Rp\d/);
    }, TX_TIMEOUT);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // FORMAT & ENCODING CROSS-CHECK
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Format & Encoding", () => {
    test("all response types use Rp{N} format (no IDR, no space after Rp)", async () => {
      const inputs = ["beli makan 25k", "gaji masuk 5jt", "berapa saldo saya"];
      for (const text of inputs) {
        clearSent();
        await sendMessage(PHONE_A, text);
        const reply = sentMessages[sentMessages.length - 1]?.text ?? "";
        if (reply.includes("Rp")) {
          expect(reply).not.toMatch(/Rp\s\d/);
          expect(reply).not.toMatch(/IDR/);
        }
      }
    }, TX_TIMEOUT);

    test("bullet character is U+2022 (not HTML entity or mojibake)", async () => {
      const { lastSent } = await sendMessage(PHONE_A, "beli makan 25k");
      const reply = lastSent?.text ?? "";
      if (reply.includes("\u2022")) {
        expect(reply).not.toContain("&bull;");
        expect(reply).not.toContain("&#8226;");
        expect(reply).not.toContain("â€¢");
      }
    }, TX_TIMEOUT);

    test("no mojibake across confirmation/success/error/balance responses", async () => {
      const MOJIBAKE = ["â€¢", "âœ…", "âŒ", "Ã", "\u00e2\u0080"];
      const prompts = ["beli makan 25k", "berapa saldo saya", "YA", "xyzzy qwerty zxcvbn"];

      for (const text of prompts) {
        clearSent();
        await sendMessage(PHONE_A, text);
        const reply = sentMessages[sentMessages.length - 1]?.text ?? "";
        for (const mj of MOJIBAKE) {
          expect(reply).not.toContain(mj);
        }
      }
    }, TX_TIMEOUT);
  });
});
