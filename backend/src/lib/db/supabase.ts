import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  if (process.env.NODE_ENV === "production" && !process.env.NEXT_PHASE) {
    throw new Error("Missing Supabase environment variables");
  }
}

// Server-side clients are module-level singletons shared by every request, so
// they must never hold a session: with the defaults, signInWithPassword /
// signUp / refreshSession would store the *last caller's* session on this
// shared instance and start a background timer that refreshes it — consuming
// users' rotating refresh tokens behind their backs. Sessions are handed back
// to the caller and never kept here.
const statelessAuth = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
} as const;

// Shared anon client: ONLY for calls that don't create a session
// (getUser(jwt), resetPasswordForEmail, resend). Note persistSession:false
// still keeps the session in this instance's memory, so session-creating
// calls must use createRequestAuthClient() below instead.
export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseKey || "placeholder-key",
  statelessAuth,
);

/**
 * A fresh, request-scoped anon client for calls that CREATE a session
 * (signInWithPassword, signUp, refreshSession, verifyOtp). The session lives
 * only in this throwaway instance and is garbage-collected with it, so it can
 * never leak into another request.
 */
export function createRequestAuthClient() {
  return createClient(
    supabaseUrl || "https://placeholder.supabase.co",
    supabaseKey || "placeholder-key",
    statelessAuth,
  );
}

// Admin client — requires the service_role key. Accept both names: the
// .env.example documents SUPABASE_SERVICE_KEY, but Supabase's own docs (and
// existing .env files) use SUPABASE_SERVICE_ROLE_KEY.
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseAdmin = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseServiceKey || supabaseKey || "placeholder-key",
  statelessAuth,
);
