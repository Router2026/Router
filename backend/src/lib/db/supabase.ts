import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  if (process.env.NODE_ENV === "production" && !process.env.NEXT_PHASE) {
    throw new Error("Missing Supabase environment variables");
  }
}

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseKey || "placeholder-key",
);

// Admin client — requires SUPABASE_SERVICE_KEY (service_role key)
export const supabaseAdmin = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_KEY || supabaseKey || "placeholder-key",
  { auth: { autoRefreshToken: false, persistSession: false } }
);
