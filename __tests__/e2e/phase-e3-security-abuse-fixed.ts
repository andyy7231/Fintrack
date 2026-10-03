/**
 * Phase E.3: Security & Abuse Testing
 * 
 * Comprehensive security audit for WhatsApp financial transaction flow.
 * 
 * Security Matrix:
 * 1. User Isolation
 * 2. Account Authorization
 * 3. Transfer Security
 * 4. Pending Action Security
 * 5. Confirmation Abuse
 * 6. Replay / Idempotency
 * 7. Webhook Abuse
 * 8. Privilege Boundaries
 * 9. Atomicity
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import {
  createTestDbConnection,
  verifyDatabaseIdentity,
  verifyTestDatabaseSafety,
  cleanTestDatabase,
} from './test-db.utils';
import { seedTestFixtures, TEST_USERS, TEST_ACCOUNTS } from './test-fixtures';
import { createWhatsAppWebhookPayload, generateWebhookSignature } from './helpers';
import { POST } from '@/app/api/webhooks/whatsapp/route';
import { NextRequest } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { whatsappMessages, whatsappPendingActions, transactions, transfers, accounts } from '@/db/schema';

vi.mock('@/services/whatsapp/config', () => ({
  getWhatsAppConfig: () => ({
    accessToken: 'test-access-token',
    phoneNumberId: 'test-phone-number-id',
    verifyToken: 'test-verify-token-123',
    appSecret: 'test-app-secret',
    apiVersion: 'v22.0',
  }),
}));

vi.mock('@/services/whatsapp/client', () => ({
  whatsAppClient: {
    sendMessage: vi.fn().mockResolvedValue({ success: true }),
    sendTextMessage: vi.fn().mockResolvedValue({ success: true }),
  },
}));

const APP_SECRET = 'test-app-secret';
const testDb = createTestDbConnection();

describe('Phase E.3: Security & Abuse Testing', () => {
  beforeAll(async () => {
    console.log('[E2E Setup] Phase E.3 Security Tests');
    
    await verifyDatabaseIdentity(testDb);
    await verifyTestDatabaseSafety();
    
    await cleanTestDatabase(testDb);
    await seedTestFixtures();
  }, 30000);

  afterAll(async () => {
    await cleanTestDatabase(testDb);
  });

  beforeEach(async () => {
    await testDb.delete(whatsappMessages);
    await testDb.delete(whatsappPendingActions);
  });

  async function sendMessage(phone: string, text: string, msgId?: string) {
    const messageId = msgId || `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const payload = createWhatsAppWebhookPayload({ messageId, phone, text });
    const rawBody = JSON.stringify(payload);
    const signature = generateWebhookSignature(rawBody, APP_SECRET);

    const request = new NextRequest('http://localhost:3000/api/webhooks/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-hub-signature-256': signature },
      body: rawBody,
    });

    return POST(request);
  }

  async function getAccountBalance(accountId: string): Promise<number> {
    const [account] = await testDb.select().from(accounts).where(eq(accounts.id, accountId)).limit(1);
    return account ? parseFloat(account.initialBalance) : 0;
  }

  async function getTxCount(userId: string): Promise<number> {
    const txs = await testDb.select().from(transactions).where(eq(transactions.userId, userId));
    return txs.length;
  }

  async function getTransferCount(userId: string): Promise<number> {
    const tfs = await testDb.select().from(transfers).where(eq(transfers.userId, userId));
    return tfs.length;
  }
  // ═══════════════════════════════════════════════════════════════
  // 1. USER ISOLATION
  // ═══════════════════════════════════════════════════════════════
  
  describe('1. User Isolation', () => {
    test('USER_A cannot use USER_B account', async () => {
      const initialBalanceB = await getAccountBalance(TEST_ACCOUNTS.USER_B_BCA.id);
      const initialTxA = await getTxCount(TEST_USERS.USER_A.id);

      await sendMessage(TEST_USERS.USER_A.phoneNormalized, 'makan 25000 pakai BCA');
      await new Promise(resolve => setTimeout(resolve, 500));

      await sendMessage(TEST_USERS.USER_A.phoneNormalized, 'YA');
      await new Promise(resolve => setTimeout(resolve, 1000));

      const finalTxA = await getTxCount(TEST_USERS.USER_A.id);
      const finalBalanceB = await getAccountBalance(TEST_ACCOUNTS.USER_B_BCA.id);

      expect(finalTxA).toBe(initialTxA);
      expect(finalBalanceB).toBe(initialBalanceB);
    }, 15000);

    test('USER_B cannot confirm USER_A pending action', async () => {
      await sendMessage(TEST_USERS.USER_A.phoneNormalized, 'makan 25000');
      await new Promise(resolve => setTimeout(resolve, 500));

      const [pending] = await testDb
        .select()
        .from(whatsappPendingActions)
        .where(eq(whatsappPendingActions.userId, TEST_USERS.USER_A.id))
        .limit(1);

      expect(pending).toBeDefined();
      expect(pending.status).toBe('PENDING');

      const txCountA = await getTxCount(TEST_USERS.USER_A.id);

      await sendMessage(TEST_USERS.USER_B.phoneNormalized, 'YA');
      await new Promise(resolve => setTimeout(resolve, 500));

      const [afterAction] = await testDb
        .select()
        .from(whatsappPendingActions)
        .where(eq(whatsappPendingActions.id, pending.id))
        .limit(1);

      expect(afterAction.status).toBe('PENDING');

      const finalTxA = await getTxCount(TEST_USERS.USER_A.id);
      expect(finalTxA).toBe(txCountA);
    }, 15000);

    test('USER_A cannot cancel USER_B pending action', async () => {
      await sendMessage(TEST_USERS.USER_B.phoneNormalized, 'makan 50000');
      await new Promise(resolve => setTimeout(resolve, 500));

      const [pending] = await testDb
        .select()
        .from(whatsappPendingActions)
        .where(eq(whatsappPendingActions.userId, TEST_USERS.USER_B.id))
        .limit(1);

      expect(pending).toBeDefined();

      await sendMessage(TEST_USERS.USER_A.phoneNormalized, 'BATAL');
      await new Promise(resolve => setTimeout(resolve, 500));

      const [afterAction] = await testDb
        .select()
        .from(whatsappPendingActions)
        .where(eq(whatsappPendingActions.id, pending.id))
        .limit(1);

      expect(afterAction.status).toBe('PENDING');
    }, 15000);
  });

  // ═══════════════════════════════════════════════════════════════
  // 2. ACCOUNT AUTHORIZATION
  // ═══════════════════════════════════════════════════════════════

  describe('2. Account Authorization', () => {
    test('Inactive account rejected', async () => {
      const initialTx = await getTxCount(TEST_USERS.USER_A.id);

      await sendMessage(TEST_USERS.USER_A.phoneNormalized, 'makan 25000 pakai Inactive Account');
      await new Promise(resolve => setTimeout(resolve, 500));

      await sendMessage(TEST_USERS.USER_A.phoneNormalized, 'YA');
      await new Promise(resolve => setTimeout(resolve, 1000));

      const finalTx = await getTxCount(TEST_USERS.USER_A.id);
      expect(finalTx).toBe(initialTx);
    }, 15000);

    test('Non-existent account rejected', async () => {
      const initialTx = await getTxCount(TEST_USERS.USER_A.id);

      await sendMessage(TEST_USERS.USER_A.phoneNormalized, 'makan 25000 pakai NonExistent');
      await new Promise(resolve => setTimeout(resolve, 500));

      await sendMessage(TEST_USERS.USER_A.phoneNormalized, 'YA');
      await new Promise(resolve => setTimeout(resolve, 1000));

      const finalTx = await getTxCount(TEST_USERS.USER_A.id);
      expect(finalTx).toBe(initialTx);
    }, 15000);
  });

  // ═══════════════════════════════════════════════════════════════
  // 3. TRANSFER SECURITY
  // ═══════════════════════════════════════════════════════════════

  describe('3. Transfer Security', () => {
    test('Transfer from foreign account rejected', async () => {
      const initialBalanceB = await getAccountBalance(TEST_ACCOUNTS.USER_B_BCA.id);
      const initialBalanceA = await getAccountBalance(TEST_ACCOUNTS.USER_A_GOPAY.id);
      const initialTransfers = await getTransferCount(TEST_USERS.USER_A.id);

      await sendMessage(TEST_USERS.USER_A.phoneNormalized, 'transfer dari BCA ke GoPay 100000');
      await new Promise(resolve => setTimeout(resolve, 500));

      await sendMessage(TEST_USERS.USER_A.phoneNormalized, 'YA');
      await new Promise(resolve => setTimeout(resolve, 1000));

      const finalBalanceB = await getAccountBalance(TEST_ACCOUNTS.USER_B_BCA.id);
      const finalBalanceA = await getAccountBalance(TEST_ACCOUNTS.USER_A_GOPAY.id);
      const finalTransfers = await getTransferCount(TEST_USERS.USER_A.id);

      expect(finalBalanceB).toBe(initialBalanceB);
      expect(finalBalanceA).toBe(initialBalanceA);
      expect(finalTransfers).toBe(initialTransfers);
    }, 15000);

    test('Same source/destination rejected', async () => {
      const initialBalance = await getAccountBalance(TEST_ACCOUNTS.USER_A_BCA.id);
      const initialTransfers = await getTransferCount(TEST_USERS.USER_A.id);

      await sendMessage(TEST_USERS.USER_A.phoneNormalized, 'transfer dari BCA ke BCA 100000');
      await new Promise(resolve => setTimeout(resolve, 500));

      await sendMessage(TEST_USERS.USER_A.phoneNormalized, 'YA');
      await new Promise(resolve => setTimeout(resolve, 1000));

      const finalBalance = await getAccountBalance(TEST_ACCOUNTS.USER_A_BCA.id);
      const finalTransfers = await getTransferCount(TEST_USERS.USER_A.id);

      expect(finalBalance).toBe(initialBalance);
      expect(finalTransfers).toBe(initialTransfers);
    }, 15000);

    test('Transfer from inactive account rejected', async () => {
      const initialTransfers = await getTransferCount(TEST_USERS.USER_A.id);

      await sendMessage(TEST_USERS.USER_A.phoneNormalized, 'transfer dari Inactive Account ke GoPay 50000');
      await new Promise(resolve => setTimeout(resolve, 500));

      await sendMessage(TEST_USERS.USER_A.phoneNormalized, 'YA');
      await new Promise(resolve => setTimeout(resolve, 1000));

      const finalTransfers = await getTransferCount(TEST_USERS.USER_A.id);
      expect(finalTransfers).toBe(initialTransfers);
    }, 15000);

    test('Transfer to inactive account rejected', async () => {
      const initialTransfers = await getTransferCount(TEST_USERS.USER_A.id);

      await sendMessage(TEST_USERS.USER_A.phoneNormalized, 'transfer dari BCA ke Inactive Account 50000');
      await new Promise(resolve => setTimeout(resolve, 500));

      await sendMessage(TEST_USERS.USER_A.phoneNormalized, 'YA');
      await new Promise(resolve => setTimeout(resolve, 1000));

      const finalTransfers = await getTransferCount(TEST_USERS.USER_A.id);
      expect(finalTransfers).toBe(initialTransfers);
    }, 15000);

    test('Valid transfer succeeds', async () => {
      const initialTransfers = await getTransferCount(TEST_USERS.USER_A.id);

      await sendMessage(TEST_USERS.USER_A.phoneNormalized, 'transfer dari BCA ke GoPay 50000');
      await new Promise(resolve => setTimeout(resolve, 500));

      await sendMessage(TEST_USERS.USER_A.phoneNormalized, 'YA');
      await new Promise(resolve => setTimeout(resolve, 1000));

      const finalTransfers = await getTransferCount(TEST_USERS.USER_A.id);
      expect(finalTransfers).toBe(initialTransfers + 1);

      const tfs = await testDb.select().from(transfers).where(eq(transfers.userId, TEST_USERS.USER_A.id));
      expect(tfs[0].fromAccountId).toBe(TEST_ACCOUNTS.USER_A_BCA.id);
      expect(tfs[0].toAccountId).toBe(TEST_ACCOUNTS.USER_A_GOPAY.id);
      expect(tfs[0].amount).toBe('50000.00');
    }, 15000);
  });

  // ═══════════════════════════════════════════════════════════════
  // 4. PENDING ACTION SECURITY
  // ═══════════════════════════════════════════════════════════════

  describe('4. Pending Action Security', () => {
    test('Already-confirmed action cannot be re-confirmed', async () => {
      await sendMessage(TEST_USERS.USER_A.phoneNormalized, 'makan 20000');
      await new Promise(resolve => setTimeout(resolve, 500));

      await sendMessage(TEST_USERS.USER_A.phoneNormalized, 'YA');
      await new Promise(resolve => setTimeout(resolve, 1000));

      const txCountFirst = await getTxCount(TEST_USERS.USER_A.id);

      await sendMessage(TEST_USERS.USER_A.phoneNormalized, 'YA');
      await new Promise(resolve => setTimeout(resolve, 500));

      const txCountSecond = await getTxCount(TEST_USERS.USER_A.id);
      expect(txCountSecond).toBe(txCountFirst);
    }, 15000);

    test('Already-cancelled action cannot be confirmed', async () => {
      await sendMessage(TEST_USERS.USER_A.phoneNormalized, 'makan 15000');
      await new Promise(resolve => setTimeout(resolve, 500));

      await sendMessage(TEST_USERS.USER_A.phoneNormalized, 'BATAL');
      await new Promise(resolve => setTimeout(resolve, 500));

      const [cancelled] = await testDb
        .select()
        .from(whatsappPendingActions)
        .where(eq(whatsappPendingActions.userId, TEST_USERS.USER_A.id))
        .limit(1);

      expect(cancelled.status).toBe('CANCELLED');

      const txCount = await getTxCount(TEST_USERS.USER_A.id);

      await sendMessage(TEST_USERS.USER_A.phoneNormalized, 'YA');
      await new Promise(resolve => setTimeout(resolve, 500));

      const finalTxCount = await getTxCount(TEST_USERS.USER_A.id);
      expect(finalTxCount).toBe(txCount);
    }, 15000);
  });

  // ═══════════════════════════════════════════════════════════════
  // 5. CONFIRMATION ABUSE
  // ═══════════════════════════════════════════════════════════════

  describe('5. Confirmation Abuse', () => {
    test('YA without pending action', async () => {
      const txCount = await getTxCount(TEST_USERS.USER_A.id);

      await sendMessage(TEST_USERS.USER_A.phoneNormalized, 'YA');
      await new Promise(resolve => setTimeout(resolve, 500));

      const finalTxCount = await getTxCount(TEST_USERS.USER_A.id);
      expect(finalTxCount).toBe(txCount);
    }, 15000);

    test('BATAL without pending action', async () => {
      const txCount = await getTxCount(TEST_USERS.USER_A.id);

      await sendMessage(TEST_USERS.USER_A.phoneNormalized, 'BATAL');
      await new Promise(resolve => setTimeout(resolve, 500));

      const finalTxCount = await getTxCount(TEST_USERS.USER_A.id);
      expect(finalTxCount).toBe(txCount);
    }, 15000);

    test('YA case insensitive', async () => {
      await sendMessage(TEST_USERS.USER_A.phoneNormalized, 'makan 25000');
      await new Promise(resolve => setTimeout(resolve, 500));

      await sendMessage(TEST_USERS.USER_A.phoneNormalized, 'ya');
      await new Promise(resolve => setTimeout(resolve, 1000));

      const txs = await testDb.select().from(transactions).where(eq(transactions.userId, TEST_USERS.USER_A.id));
      expect(txs.length).toBe(1);
      expect(txs[0].amount).toBe('25000.00');
    }, 15000);

    test('BATAL after YA no effect', async () => {
      await sendMessage(TEST_USERS.USER_A.phoneNormalized, 'makan 20000');
      await new Promise(resolve => setTimeout(resolve, 500));

      await sendMessage(TEST_USERS.USER_A.phoneNormalized, 'YA');
      await new Promise(resolve => setTimeout(resolve, 1000));

      const txCountAfterYA = await getTxCount(TEST_USERS.USER_A.id);

      await sendMessage(TEST_USERS.USER_A.phoneNormalized, 'BATAL');
      await new Promise(resolve => setTimeout(resolve, 500));

      const txCountFinal = await getTxCount(TEST_USERS.USER_A.id);
      expect(txCountFinal).toBe(txCountAfterYA);
    }, 15000);

    test('YA after BATAL no effect', async () => {
      await sendMessage(TEST_USERS.USER_A.phoneNormalized, 'makan 18000');
      await new Promise(resolve => setTimeout(resolve, 500));

      await sendMessage(TEST_USERS.USER_A.phoneNormalized, 'BATAL');
      await new Promise(resolve => setTimeout(resolve, 500));

      const txCount = await getTxCount(TEST_USERS.USER_A.id);

      await sendMessage(TEST_USERS.USER_A.phoneNormalized, 'YA');
      await new Promise(resolve => setTimeout(resolve, 500));

      const finalTxCount = await getTxCount(TEST_USERS.USER_A.id);
      expect(finalTxCount).toBe(txCount);
    }, 15000);
  });

  // ═══════════════════════════════════════════════════════════════
  // 6. REPLAY / IDEMPOTENCY
  // ═══════════════════════════════════════════════════════════════

  describe('6. Replay / Idempotency', () => {
    test('Identical whatsappMessageId rejected (idempotency)', async () => {
      const msgId = 'test-duplicate-msg-12345';

      await sendMessage(TEST_USERS.USER_A.phoneNormalized, 'makan 25000', msgId);
      await new Promise(resolve => setTimeout(resolve, 500));

      const messages = await testDb
        .select()
        .from(whatsappMessages)
        .where(eq(whatsappMessages.whatsappMessageId, msgId));

      expect(messages.length).toBe(1);

      await sendMessage(TEST_USERS.USER_A.phoneNormalized, 'makan 25000', msgId);
      await new Promise(resolve => setTimeout(resolve, 500));

      const messagesAfter = await testDb
        .select()
        .from(whatsappMessages)
        .where(eq(whatsappMessages.whatsappMessageId, msgId));

      expect(messagesAfter.length).toBe(1);
    }, 15000);

    test('Same text different ID creates new action', async () => {
      const text = 'makan 30000';

      await sendMessage(TEST_USERS.USER_A.phoneNormalized, text, 'msg-1');
      await new Promise(resolve => setTimeout(resolve, 500));

      const pending1 = await testDb
        .select()
        .from(whatsappPendingActions)
        .where(eq(whatsappPendingActions.userId, TEST_USERS.USER_A.id));

      expect(pending1.length).toBe(1);

      await sendMessage(TEST_USERS.USER_A.phoneNormalized, text, 'msg-2');
      await new Promise(resolve => setTimeout(resolve, 500));

      const pending2 = await testDb
        .select()
        .from(whatsappPendingActions)
        .where(
          and(
            eq(whatsappPendingActions.userId, TEST_USERS.USER_A.id),
            eq(whatsappPendingActions.status, 'PENDING')
          )
        );

      expect(pending2.length).toBe(1);
      expect(pending2[0].whatsappMessageId).toBe('msg-2');
    }, 15000);
  });

  // ═══════════════════════════════════════════════════════════════
  // 7. WEBHOOK ABUSE
  // ═══════════════════════════════════════════════════════════════

  describe('7. Webhook Abuse', () => {
    test('Invalid webhook signature rejected', async () => {
      const msgId = 'test-invalid-sig';
      const payload = createWhatsAppWebhookPayload({
        messageId: msgId,
        phone: TEST_USERS.USER_A.phoneNormalized,
        text: 'makan 25000',
      });
      const rawBody = JSON.stringify(payload);

      const request = new NextRequest('http://localhost:3000/api/webhooks/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-hub-signature-256': 'sha256=invalid' },
        body: rawBody,
      });

      const res = await POST(request);
      expect(res.status).toBe(401);

      const messages = await testDb
        .select()
        .from(whatsappMessages)
        .where(eq(whatsappMessages.whatsappMessageId, msgId));

      expect(messages.length).toBe(0);
    }, 15000);

    test('Missing webhook signature rejected', async () => {
      const msgId = 'test-no-sig';
      const payload = createWhatsAppWebhookPayload({
        messageId: msgId,
        phone: TEST_USERS.USER_A.phoneNormalized,
        text: 'makan 25000',
      });
      const rawBody = JSON.stringify(payload);

      const request = new NextRequest('http://localhost:3000/api/webhooks/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: rawBody,
      });

      const res = await POST(request);
      expect(res.status).toBe(401);

      const messages = await testDb
        .select()
        .from(whatsappMessages)
        .where(eq(whatsappMessages.whatsappMessageId, msgId));

      expect(messages.length).toBe(0);
    }, 15000);

    test('Malformed JSON rejected', async () => {
      const rawBody = '{ invalid json }';
      const signature = generateWebhookSignature(rawBody, APP_SECRET);

      const request = new NextRequest('http://localhost:3000/api/webhooks/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-hub-signature-256': signature },
        body: rawBody,
      });

      const res = await POST(request);
      expect(res.status).toBe(400);
    }, 15000);

    test('Unknown sender handled safely', async () => {
      const unknownPhone = '+6281111111111';
      const res = await sendMessage(unknownPhone, 'makan 25000');
      expect(res.status).toBe(200);

      const messages = await testDb
        .select()
        .from(whatsappMessages)
        .where(eq(whatsappMessages.phoneNumber, unknownPhone));

      expect(messages.length).toBe(1);
      expect(messages[0].status).toBe('IGNORED');
    }, 15000);
  });

  // ═══════════════════════════════════════════════════════════════
  // 8. PRIVILEGE BOUNDARIES
  // ═══════════════════════════════════════════════════════════════

  describe('8. Privilege Boundaries', () => {
    test('User ID derived from verified phone', async () => {
      await sendMessage(TEST_USERS.USER_A.phoneNormalized, 'makan 25000');
      await new Promise(resolve => setTimeout(resolve, 500));

      const messages = await testDb
        .select()
        .from(whatsappMessages)
        .where(eq(whatsappMessages.phoneNumber, TEST_USERS.USER_A.phoneNormalized));

      expect(messages[0].userId).toBe(TEST_USERS.USER_A.id);

      await sendMessage(TEST_USERS.USER_A.phoneNormalized, 'YA');
      await new Promise(resolve => setTimeout(resolve, 1000));

      const txs = await testDb
        .select()
        .from(transactions)
        .where(eq(transactions.userId, TEST_USERS.USER_A.id));

      expect(txs.length).toBe(1);
      expect(txs[0].userId).toBe(TEST_USERS.USER_A.id);
    }, 15000);

    test('Account ownership enforced', async () => {
      const initialTxA = await getTxCount(TEST_USERS.USER_A.id);
      const initialBalanceB = await getAccountBalance(TEST_ACCOUNTS.USER_B_BCA.id);

      await sendMessage(TEST_USERS.USER_A.phoneNormalized, 'makan 50000 pakai BCA');
      await new Promise(resolve => setTimeout(resolve, 500));

      await sendMessage(TEST_USERS.USER_A.phoneNormalized, 'YA');
      await new Promise(resolve => setTimeout(resolve, 1000));

      const txs = await testDb
        .select()
        .from(transactions)
        .where(eq(transactions.userId, TEST_USERS.USER_A.id));

      const unauthorizedTx = txs.find(t => t.accountId === TEST_ACCOUNTS.USER_B_BCA.id);
      expect(unauthorizedTx).toBeUndefined();

      const finalBalanceB = await getAccountBalance(TEST_ACCOUNTS.USER_B_BCA.id);
      expect(finalBalanceB).toBe(initialBalanceB);
    }, 15000);
  });

  // ═══════════════════════════════════════════════════════════════
  // 9. ATOMICITY
  // ═══════════════════════════════════════════════════════════════

  describe('9. Atomicity', () => {
    test('Invalid account no partial transaction', async () => {
      const initialTx = await getTxCount(TEST_USERS.USER_A.id);

      await sendMessage(TEST_USERS.USER_A.phoneNormalized, 'makan 25000 pakai InvalidAccount');
      await new Promise(resolve => setTimeout(resolve, 500));

      await sendMessage(TEST_USERS.USER_A.phoneNormalized, 'YA');
      await new Promise(resolve => setTimeout(resolve, 1000));

      const finalTx = await getTxCount(TEST_USERS.USER_A.id);
      expect(finalTx).toBe(initialTx);
    }, 15000);

    test('Transfer atomicity maintained', async () => {
      const initialTransfers = await getTransferCount(TEST_USERS.USER_A.id);

      await sendMessage(TEST_USERS.USER_A.phoneNormalized, 'transfer dari BCA ke GoPay 50000');
      await new Promise(resolve => setTimeout(resolve, 500));

      await sendMessage(TEST_USERS.USER_A.phoneNormalized, 'YA');
      await new Promise(resolve => setTimeout(resolve, 1000));

      const finalTransfers = await getTransferCount(TEST_USERS.USER_A.id);
      expect(finalTransfers).toBe(initialTransfers + 1);

      const tfs = await testDb.select().from(transfers).where(eq(transfers.userId, TEST_USERS.USER_A.id));
      expect(tfs[0].fromAccountId).toBe(TEST_ACCOUNTS.USER_A_BCA.id);
      expect(tfs[0].toAccountId).toBe(TEST_ACCOUNTS.USER_A_GOPAY.id);
      expect(tfs[0].amount).toBe('50000.00');
    }, 15000);

    test('Pending action state consistency', async () => {
      await sendMessage(TEST_USERS.USER_A.phoneNormalized, 'makan 25000 pakai InvalidAccount');
      await new Promise(resolve => setTimeout(resolve, 500));

      const [pendingBefore] = await testDb
        .select()
        .from(whatsappPendingActions)
        .where(eq(whatsappPendingActions.userId, TEST_USERS.USER_A.id))
        .limit(1);

      expect(pendingBefore.status).toBe('PENDING');

      await sendMessage(TEST_USERS.USER_A.phoneNormalized, 'YA');
      await new Promise(resolve => setTimeout(resolve, 1000));

      const [pendingAfter] = await testDb
        .select()
        .from(whatsappPendingActions)
        .where(eq(whatsappPendingActions.id, pendingBefore.id))
        .limit(1);

      expect(['FAILED', 'CONFIRMED', 'PENDING']).toContain(pendingAfter.status);

      const txs = await testDb
        .select()
        .from(transactions)
        .where(eq(transactions.userId, TEST_USERS.USER_A.id));

      expect(txs.length).toBe(0);
    }, 15000);
  });
});
