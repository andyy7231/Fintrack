import postgres from 'postgres';

const DATABASE_URL_TEST = 'postgresql://postgres.suhjevptsrlyubsezhzj:Wancak123%3F%21@aws-0-ap-south-1.pooler.supabase.com:5432/postgres';

console.log('Checking Supabase TEST schema...\n');

const client = postgres(DATABASE_URL_TEST, { max: 1 });

try {
  const result = await client.unsafe(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  
  console.log(`Found ${result.length} tables in public schema:`);
  result.forEach((row, i) => {
    console.log(`  ${i + 1}. ${row.table_name}`);
  });

  const tableNames = result.map(r => r.table_name);
  const criticalTables = ['user', 'session', 'account', 'verification', 'accounts', 'categories', 'transactions', 'transfers', 'whatsapp_contacts', 'whatsapp_messages', 'whatsapp_pending_actions'];
  
  console.log('\nCritical tables check:');
  criticalTables.forEach(t => {
    const exists = tableNames.includes(t);
    console.log(`  ${exists ? '✓' : '✗'} ${t}`);
  });

  const missing = criticalTables.filter(t => !tableNames.includes(t));
  
  if (missing.length > 0) {
    console.log(`\n⚠️  Missing tables: ${missing.join(', ')}`);
    console.log('Schema is incomplete - migrations needed');
    process.exit(1);
  } else {
    console.log('\n✓ Schema appears complete - ready for E2E tests!');
    process.exit(0);
  }
} catch (error) {
  console.error('Error:', error);
  process.exit(1);
} finally {
  await client.end();
}