/**
 * Powercast AI - Supabase Client (Browser)
 * Client-side Supabase client for React components
 */
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

// Environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

/**
 * Check if Supabase is configured
 */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/**
 * Create a Supabase client for browser/client components
 * This should be used in React components and client-side code
 */
export function createClient() {
  if (!isSupabaseConfigured) {
    console.warn(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
    return null;
  }

  return createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
}

/**
 * Singleton client for use throughout the app
 */
let browserClient: ReturnType<typeof createBrowserClient<Database>> | null =
  null;

export function getSupabaseClient() {
  if (!isSupabaseConfigured) {
    return null;
  }

  if (!browserClient) {
    browserClient = createBrowserClient<Database>(
      SUPABASE_URL,
      SUPABASE_ANON_KEY
    );
  }

  return browserClient;
}

/**
 * Re-export createBrowserClient for direct use if needed
 */
export { createBrowserClient };
