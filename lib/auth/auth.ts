import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/lib/db";
import * as schema from "@/db/schema";

export const auth = betterAuth({
  secret:
    process.env.BETTER_AUTH_SECRET ||
    "fintrack-dev-secret-replace-in-production-min-32-chars",
  baseURL: process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  user: {
    additionalFields: {
      currency: {
        type: "string",
        defaultValue: "IDR",
        input: false,
      },
      timezone: {
        type: "string",
        defaultValue: "Asia/Jakarta",
        input: false,
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session.session;
export type User = typeof auth.$Infer.Session.user;
