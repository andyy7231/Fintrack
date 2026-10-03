/**
 * E2E Test Environment Setup
 * 
 * CRITICAL: This file MUST be imported FIRST in E2E tests
 * to ensure DATABASE_URL is overridden before any services load.
 */

// Load test environment
import { loadEnvConfig } from '@next/env';
// Note: loadEnvConfig loads .env.test automatically in test environment
// Second parameter is dev flag (boolean), not filename
loadEnvConfig(process.cwd());

// Override DATABASE_URL before ANY application modules load
const DATABASE_URL_TEST = 'postgresql://postgres.suhjevptsrlyubsezhzj:Wancak123%3F%21@aws-0-ap-south-1.pooler.supabase.com:5432/postgres';
const DATABASE_URL_BEFORE_OVERRIDE = process.env.DATABASE_URL;

// CRITICAL: Override BEFORE imports
process.env.DATABASE_URL = DATABASE_URL_TEST;

// Safety verification
if (!DATABASE_URL_TEST.includes('suhjevptsrlyubsezhzj')) {
  throw new Error('SAFETY ABORT: DATABASE_URL_TEST does not point to Supabase TEST project');
}

// Verify the TEST URL is actually different from production
const DATABASE_URL_PROD_PROJECT = 'cxgbfzhsbztaoaptnfol'; // Production project ID
if (DATABASE_URL_TEST.includes(DATABASE_URL_PROD_PROJECT)) {
  throw new Error('SAFETY ABORT: DATABASE_URL_TEST points to PRODUCTION project');
}

// Verify override was successful
if (process.env.DATABASE_URL !== DATABASE_URL_TEST) {
  throw new Error('SAFETY ABORT: Failed to override DATABASE_URL');
}

console.log('[E2E Setup] Database environment configured');
console.log('[E2E Setup] TEST URL:', DATABASE_URL_TEST.replace(/:([^:@]+)@/, ':***@'));
console.log('[E2E Setup] BEFORE OVERRIDE:', DATABASE_URL_BEFORE_OVERRIDE ? DATABASE_URL_BEFORE_OVERRIDE.replace(/:([^:@]+)@/, ':***@') : 'NOT SET');
console.log('[E2E Setup] CURRENT DATABASE_URL:', process.env.DATABASE_URL.replace(/:([^:@]+)@/, ':***@'));

export { DATABASE_URL_TEST, DATABASE_URL_BEFORE_OVERRIDE as DATABASE_URL_PROD };
