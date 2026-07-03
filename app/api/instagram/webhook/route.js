// /api/instagram/webhook
// GET  – Meta's one-time verification handshake (hub.challenge echo).
// POST – receives Instagram DM events and upserts them into ig_leads,
//        so new DMs appear as leads in the FrameFlow Pipeline tab.
import { NextResponse } from "next/server";
import { adminClient, verifyWebhookSignature } from "../../../../lib/instagram";

export const runtime = "nodejs";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  if (
    searchParams.get("hub.mode") === "subscribe" &&
    searchParams.get("hub.verify_token") === process.env.IG_VERIFY_TOKEN
  ) {
    return new Response(searchParams.get("hub.challenge"), { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

export async function POST(req) {
  const rawBody = await req.text();

  // Reject payloads not signed by Meta with our app secret.
  if (!verifyWebhookSignature(rawBody, req.headers.get("x-hub-signature-256"))) {
    return new Response("Bad signature", { status: 401 });
  }

  let payload;
  try { payload = JSON.parse(rawBody); } catch { return new Response("Bad JSON", { status: 400 }); }

  const db = adminClient();

  for (const entry of payload?.entry || []) {
    for (const ev of entry.messaging || []) {
      // Only inbound text messages (skip echoes of our own replies, read receipts, etc.)
      if (!ev.message || ev.message.is_echo) continue;

      const igAccountId = String(ev.recipient?.id || entry.id || "");
      const senderId = String(ev.sender?.id || "");
      const text = ev.message.text || "[attachment]";
      if (!igAccountId || !senderId || senderId === igAccountId) continue;

      // Which FrameFlow user owns this Instagram account?
      const { data: acct } = await db.from("ig_accounts")
        .select("owner_user_id, access_token")
        .eq("ig_user_id", igAccountId)
        .maybeSingle();
      if (!acct) continue;

      // Best-effort: resolve the sender's IG username for a friendly lead name.
      let senderUsername = null;
      try {
        const uRes = await fetch(
          `https://graph.instagram.com/v23.0/${senderId}?fields=username&access_token=${acct.access_token}`
        );
        const u = await uRes.json();
        senderUsername = u.username || null;
      } catch { /* keep null */ }

      // Upsert the lead: new sender → new pipeline lead; repeat sender →
      // bump message count + latest message.
      const { data: existing } = await db.from("ig_leads")
        .select("id, message_count")
        .eq("owner_user_id", acct.owner_user_id)
        .eq("ig_sender_id", senderId)
        .maybeSingle();

      if (existing) {
        await db.from("ig_leads").update({
          last_message: text,
          message_count: (existing.message_count || 0) + 1,
          last_message_at: new Date().toISOString(),
          ...(senderUsername ? { ig_sender_username: senderUsername } : {}),
        }).eq("id", existing.id);
      } else {
        await db.from("ig_leads").insert({
          owner_user_id: acct.owner_user_id,
          ig_sender_id: senderId,
          ig_sender_username: senderUsername,
          last_message: text,
        });
      }
    }
  }

  // Always 200 quickly so Meta doesn't retry/disable the webhook.
  return NextResponse.json({ ok: true });
}
