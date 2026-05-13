import { createClient } from "@supabase/supabase-js";

export const SUPA_URL  = "https://rsaoscgotumlvsbzwdiy.supabase.co";
export const SUPA_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzYW9zY2dvdHVtbHZzYnp3ZGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4NTkwNzAsImV4cCI6MjA4ODQzNTA3MH0.eZfmlFg-bg_g5uWruw2xBDFTIvmxHV1lAHrKQdv8aSk";

export const supabase = createClient(SUPA_URL, SUPA_ANON, { auth: { storageKey: "mbb-partner-session" } });

export const PARTNER_PROXY = "https://rsaoscgotumlvsbzwdiy.supabase.co/functions/v1/partner-proxy";

export async function partnerPost(operation: string, body: object = {}, token: string) {
  const res = await fetch(PARTNER_PROXY, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ operation, ...body }),
  });
  return res.json();
}
