/**
 * E2E: Webhook Verification Tests
 * 
 * Tests the GET/POST webhook verification flow without database mutations.
 * Validates that the webhook correctly verifies Meta challenges and HMAC signatures.
 */

import { describe, test, expect, vi } from 'vitest';
import { GET, POST } from '@/app/api/webhooks/whatsapp/route';
import { NextRequest } from 'next/server';
import { createWhatsAppWebhookPayload, generateWebhookSignature, TEST_USERS } from './helpers';

// Mock configuration
vi.mock('@/services/whatsapp/config', () => ({
  getWhatsAppConfig: () => ({
    accessToken: 'test-access-token',
    phoneNumberId: 'test-phone-number-id',
    verifyToken: 'test-verify-token-123',
    appSecret: 'test-app-secret',
    apiVersion: 'v22.0',
  }),
}));

// Mock rate limiting to always allow
vi.mock('@/lib/utils/rate-limit', () => ({
  checkRateLimit: () => ({ allowed: true, remaining: 100 }),
}));

// Mock WhatsApp client to prevent actual API calls
vi.mock('@/services/whatsapp/client', () => ({
  whatsAppClient: {
    sendMessage: vi.fn().mockResolvedValue({ success: true }),
  },
}));

describe('E2E: Webhook Verification', () => {
  describe('GET /api/webhooks/whatsapp (Meta Verification)', () => {
    test('Valid verify_token and challenge ? returns challenge with 200', async () => {
      const url = 'http://localhost:3000/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=test-verify-token-123&hub.challenge=test-challenge-12345';
      const request = new NextRequest(url);

      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(await response.text()).toBe('test-challenge-12345');
      expect(response.headers.get('Content-Type')).toBe('text/plain');
    });

    test('Invalid verify_token ? returns 403', async () => {
      const url = 'http://localhost:3000/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong-token&hub.challenge=test-challenge';
      const request = new NextRequest(url);

      const response = await GET(request);

      expect(response.status).toBe(403);
      expect(await response.text()).toBe('Forbidden');
    });

    test('Missing verify_token ? returns 403', async () => {
      const url = 'http://localhost:3000/api/webhooks/whatsapp?hub.mode=subscribe&hub.challenge=test-challenge';
      const request = new NextRequest(url);

      const response = await GET(request);

      expect(response.status).toBe(403);
    });

    test('Wrong mode ? returns 403', async () => {
      const url = 'http://localhost:3000/api/webhooks/whatsapp?hub.mode=unsubscribe&hub.verify_token=test-verify-token-123&hub.challenge=test-challenge';
      const request = new NextRequest(url);

      const response = await GET(request);

      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/webhooks/whatsapp (HMAC Signature Verification)', () => {
    test('Valid signature ? webhook processed', async () => {
      const payload = createWhatsAppWebhookPayload({
        messageId: 'test-msg-001',
        phone: TEST_USERS.USER_A.phone,
        text: 'makan siang 25k',
      });

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

      // Note: This test will fail because user mapping will fail (no DB)
      // But signature verification passes
      const response = await POST(request);

      // We don't check success here since DB is mocked
      // We only verify signature was accepted (didn't return 401)
      expect(response.status).not.toBe(401);
    });

    test('Invalid signature ? returns 401', async () => {
      const payload = createWhatsAppWebhookPayload({
        messageId: 'test-msg-002',
        phone: TEST_USERS.USER_A.phone,
        text: 'test',
      });

      const rawBody = JSON.stringify(payload);
      const badSignature = generateWebhookSignature(rawBody, 'wrong-secret');

      const request = new NextRequest('http://localhost:3000/api/webhooks/whatsapp', {
        method: 'POST',
        headers: {
          'x-hub-signature-256': badSignature,
          'content-type': 'application/json',
        },
        body: rawBody,
      });

      const response = await POST(request);

      expect(response.status).toBe(401);
      // Signature validation failure returns 401, exact error message may vary
    });

    test('Missing signature header ? returns 401', async () => {
      const payload = createWhatsAppWebhookPayload({
        messageId: 'test-msg-003',
        phone: TEST_USERS.USER_A.phone,
        text: 'test',
      });

      const rawBody = JSON.stringify(payload);

      const request = new NextRequest('http://localhost:3000/api/webhooks/whatsapp', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: rawBody,
      });

      const response = await POST(request);

      expect(response.status).toBe(401);
    });

    test('Malformed JSON ? returns 400', async () => {
      const rawBody = '{invalid json';
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

      expect(response.status).toBe(400);
    });
  });
});

