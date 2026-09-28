import { auth } from "@/lib/auth/auth";
import { headers } from "next/headers";

/**
 * Server-side helper to get the active session.
 * Uses request headers from Next.js server components or server actions.
 */
export async function getSession() {
  const reqHeaders = await headers();
  return auth.api.getSession({
    headers: reqHeaders,
  });
}

/**
 * Server-side helper to get the current authenticated user.
 * Returns null if the user is not authenticated.
 *
 * NEVER trust user_id from client request bodies.
 * Always use this helper as the source of truth for user identity.
 */
export async function getCurrentUser() {
  const session = await getSession();
  return session?.user ?? null;
}
