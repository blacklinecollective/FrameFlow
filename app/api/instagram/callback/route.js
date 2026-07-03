// GET /api/instagram/callback?code=...&state=...
// Exchanges the OAuth code for a long-lived token and stores the
// connected Instagram account in Supabase (ig_accounts).
import { NextResponse } from "next/server";
import { adminClient, verifyState, redirectUri, siteUrl } from "../../../../lib/instagram";

export const runtime = "nodejs";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const userId = verifyState(searchParams.get("state"));

  const back = (q) => NextResponse.redirect(`${siteUrl()}/?${q}`);

  if (!code || !userId) return back("ig_error=invalid_callback");

  try {
    // 1. code → short-lived token
    const form = new URLSearchParams({
      client_id: process.env.IG_APP_ID,
      client_secret: process.env.IG_APP_SECRET,
      grant_type: "authorization_code",
      redirect_uri: redirectUri(),
      code,
    });
    const tokRes = await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    });
    const tok = await tokRes.json();
    if (!tok.access_token) return back("ig_error=token_exchange_failed");

    // 2. short-lived → long-lived token (~60 days)
    const llRes = await fetch(
      `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${process.env.IG_APP_SECRET}&access_token=${tok.access_token}`
    );
    const ll = await llRes.json();
    const accessToken = ll.access_token || tok.access_token;
    const expiresAt = ll.expires_in
      ? new Date(Date.now() + ll.expires_in * 1000).toISOString()
      : null;

    // 3. who is this account?
    const meRes = await fetch(
      `https://graph.instagram.com/v23.0/me?fields=user_id,username&access_token=${accessToken}`
    );
    const me = await meRes.json();
    const igUserId = String(me.user_id || tok.user_id || "");
    if (!igUserId) return back("ig_error=no_ig_user");

    // 4. store (service role — bypasses RLS)
    const db = adminClient();
    const { error } = await db.from("ig_accounts").upsert({
      owner_user_id: userId,
      ig_user_id: igUserId,
      ig_username: me.username || null,
      access_token: accessToken,
      token_expires_at: expiresAt,
      connected_at: new Date().toISOString(),
    }, { onConflict: "ig_user_id" });
    if (error) return back("ig_error=db_save_failed");

    return back(`ig_connected=${encodeURIComponent(me.username || "ok")}`);
  } catch (e) {
    return back("ig_error=unexpected");
  }
}
