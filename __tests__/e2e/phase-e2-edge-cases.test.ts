/**
 * Phase E.2: Edge Cases & Regression Testing
 * 
 * Comprehensive edge case validation for WhatsApp financial transaction flow.
 * Tests scenarios not covered in Phase E.1 to increase confidence in the parser,
 * resolver, and database flow without redesigning working components.
 * 
 * Coverage:
 * - Natural language variations
 * - Date parsing
 * - Missing information handling
 * - Ambiguous accounts/categories
 * - Transfer edge cases
 * - Duplicate/replay protection
 * - Confirmation edge cases
 * - User isolation
 * - Non-financial messages
 * - Malformed inputs
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import {
  createTestDbConnection,
  verifyDatabaseIdentity,
  verifyTestDatabaseSafety,
  cleanTestDatabase,
} from './test-db.utils';
import { seedTestFixtures, TEST_USERS } from './test-fixtures';
import { createWhatsAppWebhookPayload, generateWebhookSignature } from './helpers';
import { POST } from '@/app/api/webhooks/whatsapp/route';
import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { whatsappMessages, whatsappPendingActions, transactions } from '@/db/schema';

// Mock external APIs
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

vi.mock('@/lib/utils/rate-limit', () => ({
  checkRateLimit: () => ({ allowed: true, remaining: 100 }),
}));

const db = createTestDbConnection();

describe('Phase E.2: Edge Cases & Regression Tests', () => {
  beforeAll(async () => {
    console.log('\n=== Setting up Phase E.2 Edge Case Tests ===\n');
    
    verifyTestDatabaseSafety();
    await verifyDatabaseIdentity(db);
    await cleanTestDatabase(db);
    await seedTestFixtures();
    
    console.log('\n=== Setup complete ===\n');
  }, 60000);

  afterAll(async () => {
    await cleanTestDatabase(db);
  });

  beforeEach(async () => {
    await db.delete(whatsappPendingActions);
    await db.delete(whatsappMessages);
    await db.delete(transactions);
  });

  describe('B. Natural Language Variations', () => {
    test('Order variation: "25k makan siang"', async () => {
      const messageId = 'e2e-nlp-001';
      const text = '25k makan siang';
      const phone = TEST_USERS.USER_A.phoneNormalized;

      const payload = createWhatsAppWebhookPayload({ messageId, phone, text });
      const rawBody = JSON.stringify(payload);
      const signature = generateWebhookSignature(rawBody, 'test-app-secret');

      const request = new NextRequest('http://localhost:3000/api/webhooks/whatsapp', {
        method: 'POST',
        headers: {
          'x-hub-signature-256': signature,
          'content-type': 'application/json',
        },
        body: rawBody,
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const pendings = await db
        .select()
        .from(whatsappPendingActions)
        .where(eq(whatsappPendingActions.userId, TEST_USERS.USER_A.id));

      expect(pendings.length).toBeGreaterThan(0);
    });

    test('Temporal prefix: "tadi makan 25rb"', async () => {
      const messageId = 'e2e-nlp-002';
      const text = 'tadi makan 25rb';
      const phone = TEST_USERS.USER_A.phoneNormalized;

      const payload = createWhatsAppWebhookPayload({ messageId, phone, text });
      const rawBody = JSON.stringify(payload);
      const signature = generateWebhookSignature(rawBody, 'test-app-secret');

      const request = new NextRequest('http://localhost:3000/api/webhooks/whatsapp', {
        method: 'POST',
        headers: {
          'x-hub-signature-256': signature,
          'content-type': 'application/json',
        },
        body: rawBody,
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const pendings = await db
        .select()
        .from(whatsappPendingActions)
        .where(eq(whatsappPendingActions.userId, TEST_USERS.USER_A.id));

      expect(pendings.length).toBeGreaterThan(0);
    });

    test('Longer phrase: "barusan beli makan 25 ribu"', async () => {
      const messageId = 'e2e-nlp-003';
      const text = 'barusan beli makan 25 ribu';
      const phone = TEST_USERS.USER_A.phoneNormalized;

      const payload = createWhatsAppWebhookPayload({ messageId, phone, text });
      const rawBody = JSON.stringify(payload);
      const signature = generateWebhookSignature(rawBody, 'test-app-secret');

      const request = new NextRequest('http://localhost:3000/api/webhooks/whatsapp', {
        method: 'POST',
        headers: {
          'x-hub-signature-256': signature,
          'content-type': 'application/json',
        },
        body: rawBody,
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const pendings = await db
        .select()
        .from(whatsappPendingActions)
        .where(eq(whatsappPendingActions.userId, TEST_USERS.USER_A.id));

      expect(pendings.length).toBeGreaterThan(0);
    });

    test('First person: "aku habis makan 25k"', async () => {
      const messageId = 'e2e-nlp-004';
      const text = 'aku habis makan 25k';
      const phone = TEST_USERS.USER_A.phoneNormalized;

      const payload = createWhatsAppWebhookPayload({ messageId, phone, text });
      const rawBody = JSON.stringify(payload);
      const signature = generateWebhookSignature(rawBody, 'test-app-secret');

      const request = new NextRequest('http://localhost:3000/api/webhooks/whatsapp', {
        method: 'POST',
        headers: {
          'x-hub-signature-256': signature,
          'content-type': 'application/json',
        },
        body: rawBody,
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const pendings = await db
        .select()
        .from(whatsappPendingActions)
        .where(eq(whatsappPendingActions.userId, TEST_USERS.USER_A.id));

      expect(pendings.length).toBeGreaterThan(0);
    });

    test('All uppercase: "MAKAN SIANG 25K"', async () => {
      const messageId = 'e2e-nlp-005';
      const text = 'MAKAN SIANG 25K';
      const phone = TEST_USERS.USER_A.phoneNormalized;

      const payload = createWhatsAppWebhookPayload({ messageId, phone, text });
      const rawBody = JSON.stringify(payload);
      const signature = generateWebhookSignature(rawBody, 'test-app-secret');

      const request = new NextRequest('http://localhost:3000/api/webhooks/whatsapp', {
        method: 'POST',
        headers: {
          'x-hub-signature-256': signature,
          'content-type': 'application/json',
        },
        body: rawBody,
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const pendings = await db
        .select()
        .from(whatsappPendingActions)
        .where(eq(whatsappPendingActions.userId, TEST_USERS.USER_A.id));

      expect(pendings.length).toBeGreaterThan(0);
    });

    test('Extra whitespace: "  makan   siang  25k  "', async () => {
      const messageId = 'e2e-nlp-006';
      const text = '  makan   siang  25k  ';
      const phone = TEST_USERS.USER_A.phoneNormalized;

      const payload = createWhatsAppWebhookPayload({ messageId, phone, text });
      const rawBody = JSON.stringify(payload);
      const signature = generateWebhookSignature(rawBody, 'test-app-secret');

      const request = new NextRequest('http://localhost:3000/api/webhooks/whatsapp', {
        method: 'POST',
        headers: {
          'x-hub-signature-256': signature,
          'content-type': 'application/json',
        },
        body: rawBody,
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const pendings = await db
        .select()
        .from(whatsappPendingActions)
        .where(eq(whatsappPendingActions.userId, TEST_USERS.USER_A.id));

      expect(pendings.length).toBeGreaterThan(0);
    });
  });

  describe('D. Missing Information', () => {
    test('Missing amount: "makan siang"', async () => {
      const messageId = 'e2e-missing-001';
      const text = 'makan siang';
      const phone = TEST_USERS.USER_A.phoneNormalized;

      const payload = createWhatsAppWebhookPayload({ messageId, phone, text });
      const rawBody = JSON.stringify(payload);
      const signature = generateWebhookSignature(rawBody, 'test-app-secret');

      const request = new NextRequest('http://localhost:3000/api/webhooks/whatsapp', {
        method: 'POST',
        headers: {
          'x-hub-signature-256': signature,
          'content-type': 'application/json',
        },
        body: rawBody,
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      // Should not create transaction or pending action for missing amount
      const txns = await db
        .select()
        .from(transactions)
        .where(eq(transactions.userId, TEST_USERS.USER_A.id));

      const messages = await db
        .select()
        .from(whatsappMessages)
        .where(eq(whatsappMessages.whatsappMessageId, messageId));

      expect(txns.length).toBe(0);
      expect(messages.length).toBe(1);
      expect(messages[0]?.status).toMatch(/PROCESSED|IGNORED/);
    });

    test('Missing amount: "gajian"', async () => {
      const messageId = 'e2e-missing-002';
      const text = 'gajian';
      const phone = TEST_USERS.USER_A.phoneNormalized;

      const payload = createWhatsAppWebhookPayload({ messageId, phone, text });
      const rawBody = JSON.stringify(payload);
      const signature = generateWebhookSignature(rawBody, 'test-app-secret');

      const request = new NextRequest('http://localhost:3000/api/webhooks/whatsapp', {
        method: 'POST',
        headers: {
          'x-hub-signature-256': signature,
          'content-type': 'application/json',
        },
        body: rawBody,
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const txns = await db
        .select()
        .from(transactions)
        .where(eq(transactions.userId, TEST_USERS.USER_A.id));

      expect(txns.length).toBe(0);
    });

    test('Incomplete transfer: "transfer 500k" (no accounts)', async () => {
      const messageId = 'e2e-missing-003';
      const text = 'transfer 500k';
      const phone = TEST_USERS.USER_A.phoneNormalized;

      const payload = createWhatsAppWebhookPayload({ messageId, phone, text });
      const rawBody = JSON.stringify(payload);
      const signature = generateWebhookSignature(rawBody, 'test-app-secret');

      const request = new NextRequest('http://localhost:3000/api/webhooks/whatsapp', {
        method: 'POST',
        headers: {
          'x-hub-signature-256': signature,
          'content-type': 'application/json',
        },
        body: rawBody,
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      // Should handle missing accounts gracefully
      const messages = await db
        .select()
        .from(whatsappMessages)
        .where(eq(whatsappMessages.whatsappMessageId, messageId));

      expect(messages.length).toBe(1);
      expect(messages[0]?.status).toMatch(/PROCESSED|IGNORED/);
    });

    test('Incomplete transfer: "transfer dari BCA" (no destination)', async () => {
      const messageId = 'e2e-missing-004';
      const text = 'transfer dari BCA 100k';
      const phone = TEST_USERS.USER_A.phoneNormalized;

      const payload = createWhatsAppWebhookPayload({ messageId, phone, text });
      const rawBody = JSON.stringify(payload);
      const signature = generateWebhookSignature(rawBody, 'test-app-secret');

      const request = new NextRequest('http://localhost:3000/api/webhooks/whatsapp', {
        method: 'POST',
        headers: {
          'x-hub-signature-256': signature,
          'content-type': 'application/json',
        },
        body: rawBody,
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const messages = await db
        .select()
        .from(whatsappMessages)
        .where(eq(whatsappMessages.whatsappMessageId, messageId));

      expect(messages.length).toBe(1);
    });

    test('Incomplete transfer: "transfer ke GoPay" (no source)', async () => {
      const messageId = 'e2e-missing-005';
      const text = 'transfer ke GoPay 100k';
      const phone = TEST_USERS.USER_A.phoneNormalized;

      const payload = createWhatsAppWebhookPayload({ messageId, phone, text });
      const rawBody = JSON.stringify(payload);
      const signature = generateWebhookSignature(rawBody, 'test-app-secret');

      const request = new NextRequest('http://localhost:3000/api/webhooks/whatsapp', {
        method: 'POST',
        headers: {
          'x-hub-signature-256': signature,
          'content-type': 'application/json',
        },
        body: rawBody,
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const messages = await db
        .select()
        .from(whatsappMessages)
        .where(eq(whatsappMessages.whatsappMessageId, messageId));

      expect(messages.length).toBe(1);
    }, 20000);
  });

  describe('E. Ambiguous Accounts', () => {
    test('Account not found: "makan pakai NONEXISTENT 25k"', async () => {
      const messageId = 'e2e-account-001';
      const text = 'makan pakai NONEXISTENT 25k';
      const phone = TEST_USERS.USER_A.phoneNormalized;

      const payload = createWhatsAppWebhookPayload({ messageId, phone, text });
      const rawBody = JSON.stringify(payload);
      const signature = generateWebhookSignature(rawBody, 'test-app-secret');

      const request = new NextRequest('http://localhost:3000/api/webhooks/whatsapp', {
        method: 'POST',
        headers: {
          'x-hub-signature-256': signature,
          'content-type': 'application/json',
        },
        body: rawBody,
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      // Should handle gracefully - either create pending with default account or ask for clarification
      const messages = await db
        .select()
        .from(whatsappMessages)
        .where(eq(whatsappMessages.whatsappMessageId, messageId));

      expect(messages.length).toBe(1);
      expect(messages[0]?.status).toMatch(/PROCESSED|IGNORED/);
    });
  });

  describe('I. Confirmation Edge Cases', () => {
    test('Case variation: "ya" (lowercase)', async () => {
      // First create a pending action
      const messageId1 = 'e2e-confirm-case-001';
      const text1 = 'makan siang 25k';
      const phone = TEST_USERS.USER_A.phoneNormalized;

      const payload1 = createWhatsAppWebhookPayload({ messageId: messageId1, phone, text: text1 });
      const rawBody1 = JSON.stringify(payload1);
      const signature1 = generateWebhookSignature(rawBody1, 'test-app-secret');

      const request1 = new NextRequest('http://localhost:3000/api/webhooks/whatsapp', {
        method: 'POST',
        headers: {
          'x-hub-signature-256': signature1,
          'content-type': 'application/json',
        },
        body: rawBody1,
      });

      await POST(request1);

      // Now send "ya" (lowercase)
      const messageId2 = 'e2e-confirm-case-002';
      const text2 = 'ya';

      const payload2 = createWhatsAppWebhookPayload({ messageId: messageId2, phone, text: text2 });
      const rawBody2 = JSON.stringify(payload2);
      const signature2 = generateWebhookSignature(rawBody2, 'test-app-secret');

      const request2 = new NextRequest('http://localhost:3000/api/webhooks/whatsapp', {
        method: 'POST',
        headers: {
          'x-hub-signature-256': signature2,
          'content-type': 'application/json',
        },
        body: rawBody2,
      });

      const response2 = await POST(request2);
      expect(response2.status).toBe(200);
    });

    test('Case variation: "Ya" (mixed)', async () => {
      const messageId1 = 'e2e-confirm-case-003';
      const text1 = 'makan siang 25k';
      const phone = TEST_USERS.USER_A.phoneNormalized;

      const payload1 = createWhatsAppWebhookPayload({ messageId: messageId1, phone, text: text1 });
      const rawBody1 = JSON.stringify(payload1);
      const signature1 = generateWebhookSignature(rawBody1, 'test-app-secret');

      const request1 = new NextRequest('http://localhost:3000/api/webhooks/whatsapp', {
        method: 'POST',
        headers: {
          'x-hub-signature-256': signature1,
          'content-type': 'application/json',
        },
        body: rawBody1,
      });

      await POST(request1);

      const messageId2 = 'e2e-confirm-case-004';
      const text2 = 'Ya';

      const payload2 = createWhatsAppWebhookPayload({ messageId: messageId2, phone, text: text2 });
      const rawBody2 = JSON.stringify(payload2);
      const signature2 = generateWebhookSignature(rawBody2, 'test-app-secret');

      const request2 = new NextRequest('http://localhost:3000/api/webhooks/whatsapp', {
        method: 'POST',
        headers: {
          'x-hub-signature-256': signature2,
          'content-type': 'application/json',
        },
        body: rawBody2,
      });

      const response2 = await POST(request2);
      expect(response2.status).toBe(200);
    });

    test('Whitespace around confirmation: "  YA  "', async () => {
      const messageId1 = 'e2e-confirm-space-001';
      const text1 = 'makan siang 25k';
      const phone = TEST_USERS.USER_A.phoneNormalized;

      const payload1 = createWhatsAppWebhookPayload({ messageId: messageId1, phone, text: text1 });
      const rawBody1 = JSON.stringify(payload1);
      const signature1 = generateWebhookSignature(rawBody1, 'test-app-secret');

      const request1 = new NextRequest('http://localhost:3000/api/webhooks/whatsapp', {
        method: 'POST',
        headers: {
          'x-hub-signature-256': signature1,
          'content-type': 'application/json',
        },
        body: rawBody1,
      });

      await POST(request1);

      const messageId2 = 'e2e-confirm-space-002';
      const text2 = '  YA  ';

      const payload2 = createWhatsAppWebhookPayload({ messageId: messageId2, phone, text: text2 });
      const rawBody2 = JSON.stringify(payload2);
      const signature2 = generateWebhookSignature(rawBody2, 'test-app-secret');

      const request2 = new NextRequest('http://localhost:3000/api/webhooks/whatsapp', {
        method: 'POST',
        headers: {
          'x-hub-signature-256': signature2,
          'content-type': 'application/json',
        },
        body: rawBody2,
      });

      const response2 = await POST(request2);
      expect(response2.status).toBe(200);
    });

    test('YA without pending action should not error', async () => {
      const messageId = 'e2e-confirm-no-pending-001';
      const text = 'YA';
      const phone = TEST_USERS.USER_A.phoneNormalized;

      const payload = createWhatsAppWebhookPayload({ messageId, phone, text });
      const rawBody = JSON.stringify(payload);
      const signature = generateWebhookSignature(rawBody, 'test-app-secret');

      const request = new NextRequest('http://localhost:3000/api/webhooks/whatsapp', {
        method: 'POST',
        headers: {
          'x-hub-signature-256': signature,
          'content-type': 'application/json',
        },
        body: rawBody,
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const messages = await db
        .select()
        .from(whatsappMessages)
        .where(eq(whatsappMessages.whatsappMessageId, messageId));

      expect(messages.length).toBe(1);
      expect(messages[0]?.status).toMatch(/PROCESSED|IGNORED/);
    });

    test('BATAL without pending action should not error', async () => {
      const messageId = 'e2e-cancel-no-pending-001';
      const text = 'BATAL';
      const phone = TEST_USERS.USER_A.phoneNormalized;

      const payload = createWhatsAppWebhookPayload({ messageId, phone, text });
      const rawBody = JSON.stringify(payload);
      const signature = generateWebhookSignature(rawBody, 'test-app-secret');

      const request = new NextRequest('http://localhost:3000/api/webhooks/whatsapp', {
        method: 'POST',
        headers: {
          'x-hub-signature-256': signature,
          'content-type': 'application/json',
        },
        body: rawBody,
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const messages = await db
        .select()
        .from(whatsappMessages)
        .where(eq(whatsappMessages.whatsappMessageId, messageId));

      expect(messages.length).toBe(1);
      expect(messages[0]?.status).toMatch(/PROCESSED|IGNORED/);
    });

    test('Case variation: "batal" (lowercase)', async () => {
      const messageId1 = 'e2e-cancel-case-001';
      const text1 = 'makan siang 25k';
      const phone = TEST_USERS.USER_A.phoneNormalized;

      const payload1 = createWhatsAppWebhookPayload({ messageId: messageId1, phone, text: text1 });
      const rawBody1 = JSON.stringify(payload1);
      const signature1 = generateWebhookSignature(rawBody1, 'test-app-secret');

      const request1 = new NextRequest('http://localhost:3000/api/webhooks/whatsapp', {
        method: 'POST',
        headers: {
          'x-hub-signature-256': signature1,
          'content-type': 'application/json',
        },
        body: rawBody1,
      });

      await POST(request1);

      const messageId2 = 'e2e-cancel-case-002';
      const text2 = 'batal';

      const payload2 = createWhatsAppWebhookPayload({ messageId: messageId2, phone, text: text2 });
      const rawBody2 = JSON.stringify(payload2);
      const signature2 = generateWebhookSignature(rawBody2, 'test-app-secret');

      const request2 = new NextRequest('http://localhost:3000/api/webhooks/whatsapp', {
        method: 'POST',
        headers: {
          'x-hub-signature-256': signature2,
          'content-type': 'application/json',
        },
        body: rawBody2,
      });

      const response2 = await POST(request2);
      expect(response2.status).toBe(200);
    });
  });

  describe('K. Non-Financial Messages', () => {
    test('Greeting: "halo"', async () => {
      const messageId = 'e2e-nonfinancial-001';
      const text = 'halo';
      const phone = TEST_USERS.USER_A.phoneNormalized;

      const payload = createWhatsAppWebhookPayload({ messageId, phone, text });
      const rawBody = JSON.stringify(payload);
      const signature = generateWebhookSignature(rawBody, 'test-app-secret');

      const request = new NextRequest('http://localhost:3000/api/webhooks/whatsapp', {
        method: 'POST',
        headers: {
          'x-hub-signature-256': signature,
          'content-type': 'application/json',
        },
        body: rawBody,
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      // Should not create any transaction
      const txns = await db
        .select()
        .from(transactions)
        .where(eq(transactions.userId, TEST_USERS.USER_A.id));

      const pendings = await db
        .select()
        .from(whatsappPendingActions)
        .where(eq(whatsappPendingActions.userId, TEST_USERS.USER_A.id));

      expect(txns.length).toBe(0);
      expect(pendings.length).toBe(0);
    });

    test('Greeting: "hai"', async () => {
      const messageId = 'e2e-nonfinancial-002';
      const text = 'hai';
      const phone = TEST_USERS.USER_A.phoneNormalized;

      const payload = createWhatsAppWebhookPayload({ messageId, phone, text });
      const rawBody = JSON.stringify(payload);
      const signature = generateWebhookSignature(rawBody, 'test-app-secret');

      const request = new NextRequest('http://localhost:3000/api/webhooks/whatsapp', {
        method: 'POST',
        headers: {
          'x-hub-signature-256': signature,
          'content-type': 'application/json',
        },
        body: rawBody,
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const txns = await db
        .select()
        .from(transactions)
        .where(eq(transactions.userId, TEST_USERS.USER_A.id));

      expect(txns.length).toBe(0);
    });

    test('Question: "apa kabar"', async () => {
      const messageId = 'e2e-nonfinancial-003';
      const text = 'apa kabar';
      const phone = TEST_USERS.USER_A.phoneNormalized;

      const payload = createWhatsAppWebhookPayload({ messageId, phone, text });
      const rawBody = JSON.stringify(payload);
      const signature = generateWebhookSignature(rawBody, 'test-app-secret');

      const request = new NextRequest('http://localhost:3000/api/webhooks/whatsapp', {
        method: 'POST',
        headers: {
          'x-hub-signature-256': signature,
          'content-type': 'application/json',
        },
        body: rawBody,
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const txns = await db
        .select()
        .from(transactions)
        .where(eq(transactions.userId, TEST_USERS.USER_A.id));

      expect(txns.length).toBe(0);
    });

    test('Random text: "xyz abc 123"', async () => {
      const messageId = 'e2e-nonfinancial-004';
      const text = 'xyz abc 123';
      const phone = TEST_USERS.USER_A.phoneNormalized;

      const payload = createWhatsAppWebhookPayload({ messageId, phone, text });
      const rawBody = JSON.stringify(payload);
      const signature = generateWebhookSignature(rawBody, 'test-app-secret');

      const request = new NextRequest('http://localhost:3000/api/webhooks/whatsapp', {
        method: 'POST',
        headers: {
          'x-hub-signature-256': signature,
          'content-type': 'application/json',
        },
        body: rawBody,
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const txns = await db
        .select()
        .from(transactions)
        .where(eq(transactions.userId, TEST_USERS.USER_A.id));

      expect(txns.length).toBe(0);
    });

    test('Empty message should be handled gracefully', async () => {
      const messageId = 'e2e-nonfinancial-005';
      const text = '';
      const phone = TEST_USERS.USER_A.phoneNormalized;

      const payload = createWhatsAppWebhookPayload({ messageId, phone, text });
      const rawBody = JSON.stringify(payload);
      const signature = generateWebhookSignature(rawBody, 'test-app-secret');

      const request = new NextRequest('http://localhost:3000/api/webhooks/whatsapp', {
        method: 'POST',
        headers: {
          'x-hub-signature-256': signature,
          'content-type': 'application/json',
        },
        body: rawBody,
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const txns = await db
        .select()
        .from(transactions)
        .where(eq(transactions.userId, TEST_USERS.USER_A.id));

      expect(txns.length).toBe(0);
    });

    test('Whitespace only: "   "', async () => {
      const messageId = 'e2e-nonfinancial-006';
      const text = '   ';
      const phone = TEST_USERS.USER_A.phoneNormalized;

      const payload = createWhatsAppWebhookPayload({ messageId, phone, text });
      const rawBody = JSON.stringify(payload);
      const signature = generateWebhookSignature(rawBody, 'test-app-secret');

      const request = new NextRequest('http://localhost:3000/api/webhooks/whatsapp', {
        method: 'POST',
        headers: {
          'x-hub-signature-256': signature,
          'content-type': 'application/json',
        },
        body: rawBody,
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const txns = await db
        .select()
        .from(transactions)
        .where(eq(transactions.userId, TEST_USERS.USER_A.id));

      expect(txns.length).toBe(0);
    });
  });

  describe('L. Malformed/Defensive Inputs', () => {
    test('Very long message (500+ chars)', async () => {
      const messageId = 'e2e-defensive-001';
      const text = 'makan siang '.repeat(50) + '25k'; // ~600 chars
      const phone = TEST_USERS.USER_A.phoneNormalized;

      const payload = createWhatsAppWebhookPayload({ messageId, phone, text });
      const rawBody = JSON.stringify(payload);
      const signature = generateWebhookSignature(rawBody, 'test-app-secret');

      const request = new NextRequest('http://localhost:3000/api/webhooks/whatsapp', {
        method: 'POST',
        headers: {
          'x-hub-signature-256': signature,
          'content-type': 'application/json',
        },
        body: rawBody,
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const messages = await db
        .select()
        .from(whatsappMessages)
        .where(eq(whatsappMessages.whatsappMessageId, messageId));

      expect(messages.length).toBe(1);
    });

    test('Repeated punctuation: "makan!!! siang!!! 25k!!!"', async () => {
      const messageId = 'e2e-defensive-002';
      const text = 'makan!!! siang!!! 25k!!!';
      const phone = TEST_USERS.USER_A.phoneNormalized;

      const payload = createWhatsAppWebhookPayload({ messageId, phone, text });
      const rawBody = JSON.stringify(payload);
      const signature = generateWebhookSignature(rawBody, 'test-app-secret');

      const request = new NextRequest('http://localhost:3000/api/webhooks/whatsapp', {
        method: 'POST',
        headers: {
          'x-hub-signature-256': signature,
          'content-type': 'application/json',
        },
        body: rawBody,
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const messages = await db
        .select()
        .from(whatsappMessages)
        .where(eq(whatsappMessages.whatsappMessageId, messageId));

      expect(messages.length).toBe(1);
    });

    test('Mixed punctuation: "makan, siang. 25k?"', async () => {
      const messageId = 'e2e-defensive-003';
      const text = 'makan, siang. 25k?';
      const phone = TEST_USERS.USER_A.phoneNormalized;

      const payload = createWhatsAppWebhookPayload({ messageId, phone, text });
      const rawBody = JSON.stringify(payload);
      const signature = generateWebhookSignature(rawBody, 'test-app-secret');

      const request = new NextRequest('http://localhost:3000/api/webhooks/whatsapp', {
        method: 'POST',
        headers: {
          'x-hub-signature-256': signature,
          'content-type': 'application/json',
        },
        body: rawBody,
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const messages = await db
        .select()
        .from(whatsappMessages)
        .where(eq(whatsappMessages.whatsappMessageId, messageId));

      expect(messages.length).toBe(1);
    }, 20000);
  });

  describe('H. Duplicate / Replay Protection (Critical Gap)', () => {
    test('Duplicate YA confirmation should not execute twice', async () => {
      // Create a pending action
      const messageId1 = 'e2e-dup-confirm-001';
      const text1 = 'makan siang 25k';
      const phone = TEST_USERS.USER_A.phoneNormalized;

      const payload1 = createWhatsAppWebhookPayload({ messageId: messageId1, phone, text: text1 });
      const rawBody1 = JSON.stringify(payload1);
      const signature1 = generateWebhookSignature(rawBody1, 'test-app-secret');

      const request1 = new NextRequest('http://localhost:3000/api/webhooks/whatsapp', {
        method: 'POST',
        headers: {
          'x-hub-signature-256': signature1,
          'content-type': 'application/json',
        },
        body: rawBody1,
      });

      await POST(request1);

      // Send YA
      const messageId2 = 'e2e-dup-confirm-002';
      const text2 = 'YA';

      const payload2 = createWhatsAppWebhookPayload({ messageId: messageId2, phone, text: text2 });
      const rawBody2 = JSON.stringify(payload2);
      const signature2 = generateWebhookSignature(rawBody2, 'test-app-secret');

      const request2 = new NextRequest('http://localhost:3000/api/webhooks/whatsapp', {
        method: 'POST',
        headers: {
          'x-hub-signature-256': signature2,
          'content-type': 'application/json',
        },
        body: rawBody2,
      });

      await POST(request2);

      // Send YA again (duplicate)
      const messageId3 = 'e2e-dup-confirm-003';
      const text3 = 'YA';

      const payload3 = createWhatsAppWebhookPayload({ messageId: messageId3, phone, text: text3 });
      const rawBody3 = JSON.stringify(payload3);
      const signature3 = generateWebhookSignature(rawBody3, 'test-app-secret');

      const request3 = new NextRequest('http://localhost:3000/api/webhooks/whatsapp', {
        method: 'POST',
        headers: {
          'x-hub-signature-256': signature3,
          'content-type': 'application/json',
        },
        body: rawBody3,
      });

      const response3 = await POST(request3);
      expect(response3.status).toBe(200);

      // Verify exactly 1 transaction created (not duplicated)
      const txns = await db
        .select()
        .from(transactions)
        .where(eq(transactions.userId, TEST_USERS.USER_A.id));

      // System prevents duplicate confirmation - only 1 transaction
      expect(txns.length).toBe(1);
      
      // Verify pending action status is EXECUTED (cannot execute again)
      const pendings = await db
        .select()
        .from(whatsappPendingActions)
        .where(eq(whatsappPendingActions.userId, TEST_USERS.USER_A.id));
      
      expect(pendings.length).toBeGreaterThan(0);
      expect(pendings[0]?.status).toMatch(/EXECUTED|CONFIRMED/);
    }, 20000);

    test('Duplicate BATAL should not error', async () => {
      const messageId1 = 'e2e-dup-cancel-001';
      const text1 = 'makan siang 25k';
      const phone = TEST_USERS.USER_A.phoneNormalized;

      const payload1 = createWhatsAppWebhookPayload({ messageId: messageId1, phone, text: text1 });
      const rawBody1 = JSON.stringify(payload1);
      const signature1 = generateWebhookSignature(rawBody1, 'test-app-secret');

      const request1 = new NextRequest('http://localhost:3000/api/webhooks/whatsapp', {
        method: 'POST',
        headers: {
          'x-hub-signature-256': signature1,
          'content-type': 'application/json',
        },
        body: rawBody1,
      });

      await POST(request1);

      // Send BATAL
      const messageId2 = 'e2e-dup-cancel-002';
      const text2 = 'BATAL';

      const payload2 = createWhatsAppWebhookPayload({ messageId: messageId2, phone, text: text2 });
      const rawBody2 = JSON.stringify(payload2);
      const signature2 = generateWebhookSignature(rawBody2, 'test-app-secret');

      const request2 = new NextRequest('http://localhost:3000/api/webhooks/whatsapp', {
        method: 'POST',
        headers: {
          'x-hub-signature-256': signature2,
          'content-type': 'application/json',
        },
        body: rawBody2,
      });

      await POST(request2);

      // Send BATAL again
      const messageId3 = 'e2e-dup-cancel-003';
      const text3 = 'BATAL';

      const payload3 = createWhatsAppWebhookPayload({ messageId: messageId3, phone, text: text3 });
      const rawBody3 = JSON.stringify(payload3);
      const signature3 = generateWebhookSignature(rawBody3, 'test-app-secret');

      const request3 = new NextRequest('http://localhost:3000/api/webhooks/whatsapp', {
        method: 'POST',
        headers: {
          'x-hub-signature-256': signature3,
          'content-type': 'application/json',
        },
        body: rawBody3,
      });

      const response3 = await POST(request3);
      expect(response3.status).toBe(200);

      // Should handle gracefully
      const messages = await db
        .select()
        .from(whatsappMessages)
        .where(eq(whatsappMessages.whatsappMessageId, messageId3));

      expect(messages.length).toBe(1);
    }, 20000);
  });

  describe('J. User Isolation (Cross-User Confirmation)', () => {
    test('USER_B cannot confirm USER_A pending action', async () => {
      // USER_A creates pending action
      const messageId1 = 'e2e-cross-confirm-001';
      const text1 = 'makan siang 25k';
      const phoneA = TEST_USERS.USER_A.phoneNormalized;

      const payload1 = createWhatsAppWebhookPayload({ messageId: messageId1, phone: phoneA, text: text1 });
      const rawBody1 = JSON.stringify(payload1);
      const signature1 = generateWebhookSignature(rawBody1, 'test-app-secret');

      const request1 = new NextRequest('http://localhost:3000/api/webhooks/whatsapp', {
        method: 'POST',
        headers: {
          'x-hub-signature-256': signature1,
          'content-type': 'application/json',
        },
        body: rawBody1,
      });

      await POST(request1);

      // USER_B tries to confirm
      const messageId2 = 'e2e-cross-confirm-002';
      const text2 = 'YA';
      const phoneB = TEST_USERS.USER_B.phoneNormalized;

      const payload2 = createWhatsAppWebhookPayload({ messageId: messageId2, phone: phoneB, text: text2 });
      const rawBody2 = JSON.stringify(payload2);
      const signature2 = generateWebhookSignature(rawBody2, 'test-app-secret');

      const request2 = new NextRequest('http://localhost:3000/api/webhooks/whatsapp', {
        method: 'POST',
        headers: {
          'x-hub-signature-256': signature2,
          'content-type': 'application/json',
        },
        body: rawBody2,
      });

      const response2 = await POST(request2);
      expect(response2.status).toBe(200);

      // USER_A pending action should still exist (not executed by USER_B)
      const pendingsA = await db
        .select()
        .from(whatsappPendingActions)
        .where(eq(whatsappPendingActions.userId, TEST_USERS.USER_A.id));

      const txnsB = await db
        .select()
        .from(transactions)
        .where(eq(transactions.userId, TEST_USERS.USER_B.id));

      // USER_A should still have pending action
      expect(pendingsA.length).toBeGreaterThan(0);
      // USER_B should not have created transaction
      expect(txnsB.length).toBe(0);
    });
  });

  describe('K. Non-Financial Messages (Emoji)', () => {
    test('Emoji only: "👍"', async () => {
      const messageId = 'e2e-emoji-001';
      const text = '👍';
      const phone = TEST_USERS.USER_A.phoneNormalized;

      const payload = createWhatsAppWebhookPayload({ messageId, phone, text });
      const rawBody = JSON.stringify(payload);
      const signature = generateWebhookSignature(rawBody, 'test-app-secret');

      const request = new NextRequest('http://localhost:3000/api/webhooks/whatsapp', {
        method: 'POST',
        headers: {
          'x-hub-signature-256': signature,
          'content-type': 'application/json',
        },
        body: rawBody,
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const txns = await db
        .select()
        .from(transactions)
        .where(eq(transactions.userId, TEST_USERS.USER_A.id));

      expect(txns.length).toBe(0);
    });

    test('Message with emoji: "makan 😋 25k"', async () => {
      const messageId = 'e2e-emoji-002';
      const text = 'makan 😋 25k';
      const phone = TEST_USERS.USER_A.phoneNormalized;

      const payload = createWhatsAppWebhookPayload({ messageId, phone, text });
      const rawBody = JSON.stringify(payload);
      const signature = generateWebhookSignature(rawBody, 'test-app-secret');

      const request = new NextRequest('http://localhost:3000/api/webhooks/whatsapp', {
        method: 'POST',
        headers: {
          'x-hub-signature-256': signature,
          'content-type': 'application/json',
        },
        body: rawBody,
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      // Should handle emoji gracefully, may create pending action if parsed
      const messages = await db
        .select()
        .from(whatsappMessages)
        .where(eq(whatsappMessages.whatsappMessageId, messageId));

      expect(messages.length).toBe(1);
      expect(messages[0]?.status).toMatch(/PROCESSED|IGNORED/);
    });
  });
});



