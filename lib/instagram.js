// ── Instagram integration helpers (server-side only) ──────────
// Used by the /api/instagram/* route handlers. Requires these env
// vars (set them in Vercel → Project → Settings → Environment Variables):
//   IG_APP_ID                  – Instagram app ID from developers.facebook.com
//   IG_APP_SECRET              – Instagram app secret
//   IG_VERIFY_TOKEN            – any random string; must match webhook config
//   SUPABASE_SERVICE_ROLE_KEY  – Supabase service role key (server-only!)
//   NEXT_PUBLIC_SITE_URL       – e.g. https://frame-flow-sipg.vercel.app

import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = "https://czmzxwtnzyguhbmivizq.supabase.co";

// Service-role client — bypasses RLS. NEVER import this in client code.
export function adminClient() {
  return createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

export function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
}

export function redirectUri() {
  return `${siteUrl()}/api/instagram/callback`;
}

// ── Signed OAuth state ────────────────────────────────────────
// state = "<userId>.<hmac>" so the callback can trust which FrameFlow
// user initiated the connect flow.
export function signState(userId) {
  const sig = crypto.createHmac("sha256", process.env.IG_APP_SECRET)
    .update(userId).digest("hex").slice(0, 32);
  return `${userId}.${sig}`;
}

export function verifyState(state) {
  const [userId, sig] = String(state || "").split(".");
  if (!userId || !sig) return null;
  const expect = crypto.createHmac("sha256", process.env.IG_APP_SECRET)
    .update(userId).digest("hex").slice(0, 32);
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect)) ? userId : null;
  } catch { return null; }
}

// ── Webhook payload signature (X-Hub-Signature-256) ───────────
export function verifyWebhookSignature(rawBody, headerSig) {
  if (!headerSig) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", process.env.IG_APP_SECRET)
    .update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(headerSig), Buffer.from(expected));
  } catch { return false; }
}
