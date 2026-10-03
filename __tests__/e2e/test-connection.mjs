import postgres from 'postgres';

const url = 'postgresql://postgres.suhjevptsrlyubsezhzj:Wancak123%3F%21@aws-0-ap-south-1.pooler.supabase.com:5432/postgres';

console.log('Testing Supabase TEST connection...');

const sql = postgres(url, { max: 1, connect_timeout: 5 });

try {
  const result = await sql.unsafe('SELECT current_database(), current_user, version()');
  console.log('\n✓ Connected to Supabase TEST!');
  console.log('  Database:', result[0].current_database);
  console.log('  User:', result[0].current_user);
  console.log('  Version:', result[0].version.substring(0, 60));
  await sql.end();
  console.log('\n✓ Connection test PASSED\n');
} catch (e) {
  console.error('\n✗ Connection FAILED:', e.message);
  process.exit(1);
}
