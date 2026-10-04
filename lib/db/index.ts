import { loadEnvConfig } from "@next/env";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "@/db/schema";

loadEnvConfig(process.cwd());

const rawConnectionString =
  process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/fintrack";

// Automatically switch Supabase pooler from session mode (5432) to transaction mode (6543)
// to prevent EMAXCONNSESSION errors in serverless environments
const connectionString = rawConnectionString.includes("pooler.supabase.com:5432")
  ? rawConnectionString.replace(":5432", ":6543")
  : rawConnectionString;

if (!process.env.DATABASE_URL && process.env.NODE_ENV === "production") {
  console.warn(
    "[FinTrack DB] DATABASE_URL is not set. Please set DATABASE_URL in your production environment."
  );
}

/**
 * PostgreSQL client using postgres.js driver.
 *
 * In development, we reuse the connection across hot reloads
 * to avoid exhausting the connection pool.
 */
const globalForDb = globalThis as unknown as {
  pgClient: ReturnType<typeof postgres> | undefined;
};

const isRemoteDb =
  connectionString.includes("supabase.co") ||
  connectionString.includes("supabase.com") ||
  connectionString.includes("sslmode=require") ||
  process.env.NODE_ENV === "production";

const client =
  globalForDb.pgClient ??
  postgres(connectionString, {
    ssl: isRemoteDb ? "require" : undefined,
    prepare: false, // Required for transaction poolers
    max: 10, // Increased for production load
    idle_timeout: 20,
    connect_timeout: 10,
    max_lifetime: 60 * 30, // 30 minutes
    transform: {
      undefined: null, // Handle undefined values
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pgClient = client;
}

/**
 * Drizzle ORM instance with schema.
 * Use this for all database queries throughout the application.
 */
export const db = drizzle(client, { schema });

