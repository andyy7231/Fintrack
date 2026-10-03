/**
 * E2E Test Helpers
 * 
 * Utilities for testing WhatsApp webhook → parser → resolver → pending action flow
 */

import crypto from 'crypto';

export interface WhatsAppTestMessage {
  messageId: string;
  phone: string;
  text: string;
  timestamp?: string;
}

export interface WhatsAppWebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        contacts: Array<{
          profile: { name: string };
          wa_id: string;
        }>;
        messages: Array<{
          from: string;
          id: string;
          timestamp: string;
          text: { body: string };
          type: string;
        }>;
      };
      field: string;
    }>;
  }>;
}

/**
 * Create realistic WhatsApp webhook payload
 */
export function createWhatsAppWebhookPayload(
  message: WhatsAppTestMessage
): WhatsAppWebhookPayload {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'test-business-account-id',
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '+6281234567890',
                phone_number_id: 'test-phone-number-id',
              },
              contacts: [
                {
                  profile: { name: 'Test User' },
                  wa_id: message.phone,
                },
              ],
              messages: [
                {
                  from: message.phone,
                  id: message.messageId,
                  timestamp: message.timestamp || Math.floor(Date.now() / 1000).toString(),
                  text: { body: message.text },
                  type: 'text',
                },
              ],
            },
            field: 'messages',
          },
        ],
      },
    ],
  };
}

/**
 * Generate HMAC SHA-256 signature for webhook payload
 */
export function generateWebhookSignature(rawBody: string, appSecret: string): string {
  const hmac = crypto.createHmac('sha256', appSecret);
  hmac.update(rawBody);
  return `sha256=${hmac.digest('hex')}`;
}

/**
 * Test user fixtures
 */
export const TEST_USERS = {
  USER_A: {
    id: 'test-user-a',
    phone: '6281234567890',
    verified: true,
  },
  USER_B: {
    id: 'test-user-b',
    phone: '6289876543210',
    verified: true,
  },
} as const;

/**
 * Test account fixtures
 */
export const TEST_ACCOUNTS = {
  BCA: {
    id: 'test-account-bca',
    name: 'BCA',
    type: 'BANK',
    currency: 'IDR',
    balance: '1000000.00',
    isActive: true,
  },
  GOPAY: {
    id: 'test-account-gopay',
    name: 'GoPay',
    type: 'E_WALLET',
    currency: 'IDR',
    balance: '100000.00',
    isActive: true,
  },
  CASH: {
    id: 'test-account-cash',
    name: 'Cash',
    type: 'CASH',
    currency: 'IDR',
    balance: '500000.00',
    isActive: true,
  },
} as const;

/**
 * Test category fixtures
 */
export const TEST_CATEGORIES = {
  FOOD: {
    id: 'test-category-food',
    name: 'Food',
    type: 'EXPENSE',
    userId: null, // system category
  },
  SALARY: {
    id: 'test-category-salary',
    name: 'Salary',
    type: 'INCOME',
    userId: null,
  },
  BONUS: {
    id: 'test-category-bonus',
    name: 'Bonus',
    type: 'INCOME',
    userId: null,
  },
} as const;
