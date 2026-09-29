import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/lib/db";
import * as schema from "@/db/schema";

const getBaseUrl = () => {
  if (process.env.BETTER_AUTH_URL && !process.env.BETTER_AUTH_URL.includes("localhost")) {
    return process.env.BETTER_AUTH_URL;
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "https://fintrack-iota-three.vercel.app";
};

export const auth = betterAuth({
  secret:
    process.env.BETTER_AUTH_SECRET ||
    "fintrack-dev-secret-replace-in-production-min-32-chars",
  baseURL: getBaseUrl(),
  trustedOrigins: [
    "https://fintrack-iota-three.vercel.app",
    "https://*.vercel.app",
    "http://localhost:3000",
  ],
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
