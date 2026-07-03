// GET /api/instagram/login?uid=<supabase user id>
// Starts the "Instagram API with Instagram Login" OAuth flow.
import { NextResponse } from "next/server";
import { signState, redirectUri } from "../../../../lib/instagram";

export const runtime = "nodejs";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const uid = searchParams.get("uid");
  if (!uid) return NextResponse.json({ error: "missing uid" }, { status: 400 });
  if (!process.env.IG_APP_ID || !process.env.IG_APP_SECRET) {
    return NextResponse.json({ error: "Instagram app not configured. Set IG_APP_ID / IG_APP_SECRET in Vercel." }, { status: 500 });
  }

  const params = new URLSearchParams({
    client_id: process.env.IG_APP_ID,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: "instagram_business_basic,instagram_business_manage_messages",
    state: signState(uid),
  });

  return NextResponse.redirect(`https://www.instagram.com/oauth/authorize?${params}`);
}
