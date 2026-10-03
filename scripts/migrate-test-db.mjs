/**
 * Apply Drizzle migrations to Supabase TEST database
 * With cleanup of partial migration state
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const DATABASE_URL_TEST = 'postgresql://postgres.suhjevptsrlyubsezhzj:Wancak123%3F%21@aws-0-ap-south-1.pooler.supabase.com:5432/postgres';

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║  Applying Drizzle Migrations to Supabase TEST Database  ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

console.log('Target: Supabase TEST project (suhjevptsrlyubsezhzj)');
console.log('URL (masked):', DATABASE_URL_TEST.replace(/:([^:@]+)@/, ':***@'));
console.log('');

async function runMigrations() {
  const client = postgres(DATABASE_URL_TEST, { max: 1, connect_timeout: 10 });
  const db = drizzle(client);

  try {
    // Clean up partial migration state
    console.log('Cleaning up any partial migration state...');
    try {
      await client.unsafe('DROP SCHEMA IF EXISTS drizzle CASCADE');
      await client.unsafe('DROP TABLE IF EXISTS __drizzle_migrations CASCADE');
      console.log('✓ Cleaned up drizzle schema\n');
    } catch (e) {
      console.log('Note: No cleanup needed\n');
    }

    console.log('Running migrations from drizzle/migrations/...');
    await migrate(db, { migrationsFolder: './drizzle/migrations' });
    console.log('✓ Migrations applied successfully!\n');

    console.log('Verifying schema...');
    const result = await client.unsafe(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    console.log(`\n✓ Found ${result.length} tables in public schema:`);
    result.forEach((row, i) => {
      console.log(`  ${i + 1}. ${row.table_name}`);
    });

    const tableNames = result.map(r => r.table_name);
    const criticalTables = ['user', 'accounts', 'categories', 'transactions', 'transfers', 'whatsapp_contacts', 'whatsapp_messages', 'whatsapp_pending_actions'];
    const missing = criticalTables.filter(t => !tableNames.includes(t));
    
    if (missing.length > 0) {
      console.log(`\n⚠️  WARNING: Missing expected tables: ${missing.join(', ')}`);
    } else {
      console.log('\n✓ All critical tables present');
    }

    await client.end();
    console.log('\n✓ Migration complete. Supabase TEST database is ready for E2E tests.\n');
    process.exit(0);
  } catch (error) {
    console.error('\n✗ Migration failed:', error);
    await client.end();
    process.exit(1);
  }
}

runMigrations();