import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

// POST /api/stripe/webhook
// Stripe hits this endpoint after every event (payment success/failure,
// account updated, etc.). We verify the signature, then for successful
// checkout sessions we call a SECURITY DEFINER RPC that flips the
// matching invoice's status to "Paid" in app_state.
//
// Required env vars:
//   STRIPE_SECRET_KEY
//   STRIPE_WEBHOOK_SECRET
//   NEXT_PUBLIC_SUPABASE_URL  (or SUPABASE_URL)
//   SUPABASE_SERVICE_ROLE_KEY  (server-side only — never NEXT_PUBLIC_)

export const runtime = "nodejs"; // Stripe's signature check needs the raw body — Edge runtime can't.

export async function POST(request) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return new Response("Stripe is not configured.", { status: 500 });
  }
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-12-18.acacia" });

  const sig    = request.headers.get("stripe-signature");
  const rawBody = await request.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("[stripe/webhook] bad signature:", err.message);
    return new Response(`Webhook signature verification failed: ${err.message}`, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const invoiceId          = session.metadata?.invoiceId;
      const connectedAccountId = session.metadata?.connectedAccountId;
      const amountCents        = session.amount_total;

      if (invoiceId && connectedAccountId) {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
        const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (supabaseUrl && serviceKey) {
          const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
          // Mark the invoice paid by flipping it to status="Paid" in
          // whichever app_state row has the matching connected account.
          const { error } = await sb.rpc("mark_invoice_paid_by_connected_account", {
            p_connected_account_id: connectedAccountId,
            p_invoice_id:           invoiceId,
            p_amount_cents:         amountCents,
            p_session_id:           session.id,
          });
          if (error) console.error("[stripe/webhook] RPC error:", error);
        } else {
          console.warn("[stripe/webhook] SUPABASE_SERVICE_ROLE_KEY not set — invoice not auto-marked Paid.");
        }
      }
    }
    // (We could also handle account.updated here to refresh the
    // photographer's brandKit.stripeChargesEnabled flag.)
  } catch (err) {
    console.error("[stripe/webhook] handler error:", err);
    return new Response("Handler error.", { status: 500 });
  }

  return new Response("ok", { status: 200 });
}
