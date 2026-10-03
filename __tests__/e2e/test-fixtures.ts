/**
 * Test Fixtures for E2E Database Tests
 * 
 * Deterministic test data for consistent E2E testing
 */

import { createTestDbConnection } from './test-db.utils';
import { eq } from 'drizzle-orm';
import { user, accounts, categories, whatsappContacts } from '@/db/schema';
import crypto from 'crypto';

export const TEST_USERS = {
  USER_A: {
    id: 'test-user-a-e2e',
    name: 'Test User A',
    email: 'user-a@test.fintrack.local',
    phone: '+6281234567890',
    phoneNormalized: '+6281234567890',
  },
  USER_B: {
    id: 'test-user-b-e2e',
    name: 'Test User B', 
    email: 'user-b@test.fintrack.local',
    phone: '+6289876543210',
    phoneNormalized: '+6289876543210',
  },
} as const;

export const TEST_ACCOUNTS = {
  USER_A_BCA: {
    id: 'test-account-user-a-bca',
    name: 'BCA',
    type: 'BANK' as const,
    currency: 'IDR',
    initialBalance: '1000000.00',
    isActive: true,
  },
  USER_A_GOPAY: {
    id: 'test-account-user-a-gopay',
    name: 'GoPay',
    type: 'E_WALLET' as const,
    currency: 'IDR',
    initialBalance: '500000.00',
    isActive: true,
  },
  USER_A_CASH: {
    id: 'test-account-user-a-cash',
    name: 'Cash',
    type: 'CASH' as const,
    currency: 'IDR',
    initialBalance: '300000.00',
    isActive: true,
  },
  USER_B_BCA: {
    id: 'test-account-user-b-bca',
    name: 'BCA',
    type: 'BANK' as const,
    currency: 'IDR',
    initialBalance: '2000000.00',
    isActive: true,
  },
  USER_A_INACTIVE: {
    id: 'test-account-user-a-inactive',
    name: 'Inactive Account',
    type: 'BANK' as const,
    currency: 'IDR',
    initialBalance: '100000.00',
    isActive: false,
  },
} as const;

export const TEST_CATEGORIES = {
  FOOD: {
    id: 'test-category-food',
    name: 'Food',
    type: 'EXPENSE' as const,
    color: '#FF5733',
    icon: '🍔',
    userId: null, // System category
  },
  TRANSPORTATION: {
    id: 'test-category-transportation',
    name: 'Transportation',
    type: 'EXPENSE' as const,
    color: '#3498DB',
    icon: '🚗',
    userId: null,
  },
  SALARY: {
    id: 'test-category-salary',
    name: 'Salary',
    type: 'INCOME' as const,
    color: '#2ECC71',
    icon: '💰',
    userId: null,
  },
  BONUS: {
    id: 'test-category-bonus',
    name: 'Bonus',
    type: 'INCOME' as const,
    color: '#F39C12',
    icon: '🎁',
    userId: null,
  },
} as const;

/**
 * Seed deterministic test fixtures
 */
export async function seedTestFixtures() {
  const db = createTestDbConnection();
  
  console.log('[Fixtures] Seeding test data...');

  // Create users
  await db.insert(user).values([
    {
      id: TEST_USERS.USER_A.id,
      name: TEST_USERS.USER_A.name,
      email: TEST_USERS.USER_A.email,
      
      
      
    },
    {
      id: TEST_USERS.USER_B.id,
      name: TEST_USERS.USER_B.name,
      email: TEST_USERS.USER_B.email,
      
      
      
    },
  ]);

  // Create WhatsApp contacts (verified)
  await db.insert(whatsappContacts).values([
    {
      id: crypto.randomUUID(),
      userId: TEST_USERS.USER_A.id,
      phoneNumber: TEST_USERS.USER_A.phoneNormalized,
      verifiedAt: new Date(),
      isActive: true,
    },
    {
      id: crypto.randomUUID(),
      userId: TEST_USERS.USER_B.id,
      phoneNumber: TEST_USERS.USER_B.phoneNormalized,
      verifiedAt: new Date(),
      isActive: true,
    },
  ]);
  // Create accounts
  await db.insert(accounts).values([
    { ...TEST_ACCOUNTS.USER_A_BCA, userId: TEST_USERS.USER_A.id },
    { ...TEST_ACCOUNTS.USER_A_GOPAY, userId: TEST_USERS.USER_A.id },
    { ...TEST_ACCOUNTS.USER_A_CASH, userId: TEST_USERS.USER_A.id },
    { ...TEST_ACCOUNTS.USER_A_INACTIVE, userId: TEST_USERS.USER_A.id },
    { ...TEST_ACCOUNTS.USER_B_BCA, userId: TEST_USERS.USER_B.id },
  ]);

  // Create categories
  await db.insert(categories).values([
    TEST_CATEGORIES.FOOD,
    TEST_CATEGORIES.TRANSPORTATION,
    TEST_CATEGORIES.SALARY,
    TEST_CATEGORIES.BONUS,
  ]);

  console.log('[Fixtures] Test data seeded successfully');
  console.log(`[Fixtures] Users: ${Object.keys(TEST_USERS).length}`);
  console.log(`[Fixtures] Accounts: ${Object.keys(TEST_ACCOUNTS).length}`);
  console.log(`[Fixtures] Categories: ${Object.keys(TEST_CATEGORIES).length}`);
}

/**
 * Get account balance from database
 */
export async function getAccountBalance(db: ReturnType<typeof createTestDbConnection>, accountId: string) {
  const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId)).limit(1);
  return account ? parseFloat(account.initialBalance) : null;
}
