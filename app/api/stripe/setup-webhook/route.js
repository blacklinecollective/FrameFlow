import Stripe from "stripe";

// GET /api/stripe/setup-webhook
//
// One-shot setup helper. Stripe's dashboard UI for creating webhooks
// has been finicky — this route uses the API instead. It:
//   1. Removes any existing webhook endpoint that points at our
//      /api/stripe/webhook URL on this deployment.
//   2. Creates a fresh one subscribed to checkout.session.completed.
//   3. Returns the signing secret in a copy-friendly HTML page.
//
// The page is meant to be visited once in the user's browser. Copy the
// `whsec_…` value into Vercel as STRIPE_WEBHOOK_SECRET and you're done.
// Refusing to run with a live secret key — sandbox/test only.
export async function GET(request) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return new Response("Stripe is not configured (STRIPE_SECRET_KEY missing).", { status: 500 });
  }
  // Works in both sandbox (sk_test_) and live (sk_live_) modes — Stripe
  // tracks webhook endpoints separately for each, so calling this in
  // either mode just registers/replaces the endpoint for that mode.
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-12-18.acacia" });

  // Compute the webhook URL from the incoming host so this works on any
  // preview deployment as well as production.
  const url    = new URL(request.url);
  const target = `${url.origin}/api/stripe/webhook`;

  try {
    // 1. Wipe any existing endpoints pointing at our URL.
    const existing = await stripe.webhookEndpoints.list({ limit: 100 });
    let removed = 0;
    for (const ep of existing.data) {
      if (ep.url === target) {
        await stripe.webhookEndpoints.del(ep.id);
        removed++;
      }
    }

    // 2. Create a fresh one. enabled_events covers what our handler reads.
    const created = await stripe.webhookEndpoints.create({
      url: target,
      enabled_events: ["checkout.session.completed"],
      description: "FrameFlow — auto-mark invoice Paid",
    });

    const secret = created.secret;

    // 3. Render a copy-friendly HTML page.
    const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Stripe webhook ready</title>
<style>
  body { font:14px -apple-system,system-ui,sans-serif; background:#faf9f7; color:#1a1a1a; margin:0; padding:40px 20px; }
  .card { max-width:640px; margin:0 auto; background:#fff; border:1px solid #e8e4df; border-radius:14px; padding:28px; box-shadow:0 4px 24px rgba(0,0,0,.06); }
  h1 { font-size:22px; margin:0 0 12px; }
  p { line-height:1.6; color:#555; }
  code { background:#f5f2ee; padding:2px 6px; border-radius:6px; font-size:13px; }
  .secret { display:flex; gap:8px; align-items:center; margin:18px 0 24px; }
  .secret input { flex:1; font-family:monospace; font-size:14px; padding:12px 14px; border:1px solid #e8e4df; border-radius:10px; background:#faf9f7; }
  .copy { padding:12px 18px; background:#1a1a1a; color:#fff; border:none; border-radius:10px; cursor:pointer; font-weight:600; }
  .copy:active { transform:scale(.97); }
  ol { line-height:1.8; }
  .meta { font-size:12px; color:#888; margin-top:18px; padding-top:18px; border-top:1px solid #e8e4df; }
  a { color:#6772e5; }
</style></head><body>
<div class="card">
  <h1>✓ Webhook set up</h1>
  <p>Stripe webhook created at <code>${target}</code>. ${removed > 0 ? `(Replaced ${removed} stale endpoint${removed===1?"":"s"}.)` : ""}</p>
  <div class="secret">
    <input id="s" readonly value="${secret}" onclick="this.select()"/>
    <button class="copy" onclick="navigator.clipboard.writeText(document.getElementById('s').value); this.textContent='Copied ✓'">Copy</button>
  </div>
  <ol>
    <li>Click <strong>Copy</strong> above to grab the signing secret.</li>
    <li>Open <a href="https://vercel.com/dashboard" target="_blank" rel="noopener">your Vercel project</a> → Settings → Environment Variables.</li>
    <li>Add <code>STRIPE_WEBHOOK_SECRET</code> with the value you just copied. Apply to all three environments.</li>
    <li>Add <code>SUPABASE_SERVICE_ROLE_KEY</code> while you're there — get it from <a href="https://supabase.com/dashboard/project/_/settings/api" target="_blank" rel="noopener">Supabase API settings</a>.</li>
    <li>Trigger a redeploy (or push any new commit). Done.</li>
  </ol>
  <p class="meta">Endpoint id: <code>${created.id}</code> · Listening for <code>checkout.session.completed</code> · ${process.env.STRIPE_SECRET_KEY.startsWith("sk_live_") ? "<strong style='color:#c0594a'>LIVE MODE</strong>" : "Test mode"}</p>
</div>
</body></html>`;

    return new Response(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (err) {
    console.error("[stripe/setup-webhook]", err);
    return new Response(`Setup failed: ${err.message}`, { status: 500 });
  }
}
