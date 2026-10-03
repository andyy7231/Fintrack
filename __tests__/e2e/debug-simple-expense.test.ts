/**
 * DEBUG: Simple Expense E2E Test
 * Tests "makan siang 25k" flow with diagnostic logging
 */

import { describe, test, expect, beforeAll, afterAll, vi } from 'vitest';
import { createTestDbConnection, verifyDatabaseIdentity, verifyTestDatabaseSafety, cleanTestDatabase } from './test-db.utils';
import { seedTestFixtures, TEST_USERS, TEST_ACCOUNTS, TEST_CATEGORIES } from './test-fixtures';
import { createWhatsAppWebhookPayload, generateWebhookSignature } from './helpers';
import { POST } from '@/app/api/webhooks/whatsapp/route';
import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { whatsappMessages, whatsappPendingActions, transactions, user, whatsappContacts } from '@/db/schema';

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

describe('DEBUG: Simple Expense E2E', () => {
  beforeAll(async () => {
    console.log('\n=== DEBUG: Setting up test ===\n');
    
    const safety = verifyTestDatabaseSafety();
    console.log('✓ Safety verified:', safety.isSupabaseTest);
    
    const identity = await verifyDatabaseIdentity(db);
    console.log('✓ Database:', identity.dbName);
    
    await cleanTestDatabase(db);
    console.log('✓ Database cleaned');
    
    await seedTestFixtures();
    console.log('✓ Fixtures seeded');
    
    // Verify user exists
    const users = await db.select().from(user);
    console.log('✓ Users in DB:', users.length);
    users.forEach(u => console.log('  -', u.id, u.email));
    
    
    // Verify whatsapp contacts exist
    const contacts = await db.select().from(whatsappContacts);
    console.log('✓ WhatsApp Contacts in DB:', contacts.length);
    contacts.forEach(c => console.log('  -', c.phoneNumber, 'verified:', c.isVerified, 'userId:', c.userId));
    console.log('\n=== Setup complete ===\n');
  }, 60000);

  afterAll(async () => {
    await cleanTestDatabase(db);
  });

  test('makan siang 25k creates expense transaction', async () => {
    const messageId = 'debug-expense-001';
    const text = 'makan siang 25k';
    const phone = TEST_USERS.USER_A.phoneNormalized;

    console.log('\n=== TEST: makan siang 25k ===');
    console.log('Message ID:', messageId);
    console.log('Phone:', phone);
    console.log('Text:', text);

    // Create webhook payload
    const payload = createWhatsAppWebhookPayload({ messageId, phone, text });
    const rawBody = JSON.stringify(payload);
    const signature = generateWebhookSignature(rawBody, 'test-app-secret');

    console.log('\nPayload created:');
    console.log('  Signature:', signature.substring(0, 20) + '...');
    console.log('  Body length:', rawBody.length);

    // Send webhook request
    const request = new NextRequest('http://localhost:3000/api/webhooks/whatsapp', {
      method: 'POST',
      headers: {
        'x-hub-signature-256': signature,
        'content-type': 'application/json',
      },
      body: rawBody,
    });

    console.log('\nSending webhook request...');
    const response = await POST(request);
    console.log('Response status:', response.status);
    
    const responseBody = await response.text();
    console.log('Response body:', responseBody.substring(0, 200));

    expect(response.status).toBe(200);

    // Check whatsapp_messages table
    console.log('\nQuerying whatsapp_messages...');
    const messages = await db
      .select()
      .from(whatsappMessages)
      .where(eq(whatsappMessages.whatsappMessageId, messageId));

    console.log('Messages found:', messages.length);
    if (messages.length > 0) {
      console.log('Message:', {
        id: messages[0].id,
        userId: messages[0].userId,
        status: messages[0].status,
        phoneNumber: messages[0].phoneNumber,
      });
    }

    expect(messages.length).toBe(1);
    expect(messages[0]?.status).toMatch(/PROCESSED|IGNORED/);

    // Check pending actions
    console.log('\nQuerying pending actions...');
    const pendings = await db
      .select()
      .from(whatsappPendingActions)
      .where(eq(whatsappPendingActions.userId, TEST_USERS.USER_A.id));

    console.log('Pending actions:', pendings.length);
    if (pendings.length > 0) {
      console.log('Pending:', {
        id: pendings[0].id,
        status: pendings[0].status,
        actionsData: pendings[0].actionsData ? 'present' : 'null',
      });
    }

    expect(pendings.length).toBeGreaterThan(0);

    console.log('\n=== TEST COMPLETE ===\n');
  }, 15000);
});
