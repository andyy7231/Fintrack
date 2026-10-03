import { describe, test, expect, beforeAll } from 'vitest';
import { FinancialParserService } from '@/services/ai/parser.service';
import { createTestDbConnection, cleanTestDatabase } from './e2e/test-db.utils';
import { seedTestFixtures, TEST_USERS } from './e2e/test-fixtures';

const db = createTestDbConnection();

describe('Parser Direct Test', () => {
  beforeAll(async () => {
    await cleanTestDatabase(db);
    await seedTestFixtures();
  });

  test('makan siang 25k should return READY_FOR_CONFIRMATION', async () => {
    const parser = new FinancialParserService();
    const result = await parser.processFinancialText(
      'makan siang 25k',
      TEST_USERS.USER_A.id,
      TEST_USERS.USER_A.phoneNormalized
    );
    
    console.log('Parser result:', JSON.stringify(result, null, 2));
    expect(result.status).toBe('READY_FOR_CONFIRMATION');
  });
});
