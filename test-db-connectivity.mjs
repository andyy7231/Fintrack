import { createTestDbConnection } from './__tests__/e2e/test-db.utils';

async function testConnection() {
  console.log('Connecting to TEST database...');
  const start = Date.now();
  
  try {
    const db = createTestDbConnection();
    console.log('Connection created:', Date.now() - start, 'ms');
    
    const queryStart = Date.now();
    const result = await db.execute(sql`SELECT 1 as test`);
    console.log('Query executed:', Date.now() - queryStart, 'ms');
    console.log('Result:', result);
    console.log('Total time:', Date.now() - start, 'ms');
    
    process.exit(0);
  } catch (error) {
    console.error('Connection failed:', error);
    process.exit(1);
  }
}

testConnection();
