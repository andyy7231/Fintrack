/**
 * Test Database Setup Utilities (Supabase TEST)
 * 
 * CRITICAL SAFETY: These utilities enforce strict isolation between
 * test and production databases. All operations include safety guards
 * to prevent accidental production database access.
 * 
 * NOTE: DATABASE_URL override and validation is handled by setup-env.ts
 * which runs first via vitest.config.ts setupFiles. This module provides
 * the database connection and utility functions.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@/db/schema';
import { sql } from 'drizzle-orm';

// Hardcoded Supabase TEST URL with URL-encoded password
const DATABASE_URL_TEST = 'postgresql://postgres.suhjevptsrlyubsezhzj:Wancak123%3F%21@aws-0-ap-south-1.pooler.supabase.com:5432/postgres';

console.log('[Test DB] Using Supabase TEST database');
console.log('[Test DB] URL (masked):', DATABASE_URL_TEST.replace(/:([^:@]+)@/, ':***@'));

/**
 * Safety guard: Verify we're using the test database
 * 
 * NOTE: DATABASE_URL override is already handled by setup-env.ts
 */
export function verifyTestDatabaseSafety() {
  // Check 1: DATABASE_URL_TEST must exist
  if (!DATABASE_URL_TEST) {
    throw new Error(
      'SAFETY ABORT: DATABASE_URL_TEST is not defined. ' +
      'Test database configuration is required for E2E tests.'
    );
  }

  // Check 2: For Supabase, verify it's the TEST project
  const testUrl = DATABASE_URL_TEST.toLowerCase();
  
  // Supabase TEST project identifier
  const isSupabaseTest = testUrl.includes('suhjevptsrlyubsezhzj'); // TEST project ID
  
  if (!isSupabaseTest) {
    throw new Error(
      'SAFETY ABORT: DATABASE_URL_TEST does not match the known Supabase TEST project identifier (suhjevptsrlyubsezhzj). ' +
      'Verify this is actually the test database.'
    );
  }

  return {
    testUrl: DATABASE_URL_TEST.replace(/:[^:@]+@/, ':***@'), // Hide password in logs
    isSupabaseTest,
    isSafe: true,
  };
}

/**
 * Create test database connection
 */
export function createTestDbConnection() {
  const safety = verifyTestDatabaseSafety();
  
  console.log('[Test DB] Connecting to Supabase TEST database...');
  console.log(`[Test DB] Supabase TEST project: ${safety.isSupabaseTest}`);
  
  const client = postgres(DATABASE_URL_TEST, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  return drizzle(client, { schema });
}

/**
 * Verify database identity
 */
export async function verifyDatabaseIdentity(db: ReturnType<typeof createTestDbConnection>) {
  try {
    const result = await db.execute(sql`SELECT current_database() as db, current_user as usr, version() as ver`);
    const row = result[0];
    const dbName = row?.db || row?.current_database;
    const dbUser = row?.usr || row?.current_user;
    const version = row?.ver || row?.version;

    console.log(`[Test DB] Connected to database: ${dbName}`);
    console.log(`[Test DB] Current user: ${dbUser}`);
    console.log(`[Test DB] PostgreSQL version: ${version}`);

    // Supabase uses 'postgres' as the database name
    if (dbName !== 'postgres') {
      console.warn(
        `[Test DB] WARNING: Expected Supabase database name 'postgres', got '${dbName}'. ` +
        'Proceeding with caution.'
      );
    }

    // Additional safety: verify the connection string is correct
    const safety = verifyTestDatabaseSafety();
    if (!safety.isSupabaseTest) {
      throw new Error(
        'SAFETY ABORT: Database identity verification failed. ' +
        'Cannot confirm this is the Supabase TEST project.'
      );
    }

    return { dbName, dbUser, version, verified: true };
  } catch (error) {
    console.error('[Test DB] Failed to verify database identity:', error);
    throw new Error('SAFETY ABORT: Could not verify test database identity.');
  }
}

/**
 * Apply migrations to test database
 */
export async function applyTestMigrations() {
  const safety = verifyTestDatabaseSafety();
  console.log('[Test DB] Applying migrations to Supabase TEST database...');
  
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);

  try {
    // Set DATABASE_URL to test database for migration
    const env = {
      ...process.env,
      DATABASE_URL: DATABASE_URL_TEST,
    };

    const { stdout, stderr } = await execAsync('npx drizzle-kit push', { env });
    
    if (stderr && !stderr.includes('?')) {
      console.error('[Test DB] Migration stderr:', stderr);
    }
    
    console.log('[Test DB] Migrations applied successfully');
    return { success: true, output: stdout };
  } catch (error) {
    console.error('[Test DB] Migration failed:', error);
    throw error;
  }
}

/**
 * Clean all test data
 */
export async function cleanTestDatabase(db: ReturnType<typeof createTestDbConnection>) {
  await verifyDatabaseIdentity(db);
  
  console.log('[Test DB] Cleaning Supabase TEST database...');
  
  // Order matters: delete in reverse dependency order
  const tables = [
    'whatsapp_pending_actions',
    'whatsapp_verification_challenges',
    'whatsapp_messages',
    'whatsapp_contacts',
    'transfers',
    'transactions',
    'budgets',
    'budget_allocations',
    'goal_contributions',
    'goals',
    'categories',
    'accounts',
    '"session"',
    '"user"',
  ];
  
  for (const table of tables) {
    try {
      await db.execute(sql.raw(`TRUNCATE TABLE ${table} CASCADE`));
    } catch (e) {
      console.log(`[Test DB] Note: ${table} table may not exist yet`);
    }
  }
  
  console.log('[Test DB] Database cleaned');
}
