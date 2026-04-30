import Stripe from "stripe";

// POST /api/stripe/checkout
// Body: {
//   connectedAccountId: "acct_…",   // photographer's Stripe Connect account
//   invoiceId:          "INV-…",
//   amountCents:        12345,       // total invoice amount in cents
//   description:        "Wedding photography deposit",
//   clientEmail?:       "client@…",  // pre-fills Checkout
//   successUrl:         "https://…?paid=1",
//   cancelUrl:          "https://…",
//   applicationFeeCents?: 0          // platform fee (0 by default)
// }
//
// Creates a Stripe Checkout Session that charges the client and routes
// the funds to the photographer's connected account, minus an optional
// platform fee. The session URL is returned for the client to redirect to.
export async function POST(request) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return Response.json({ error: "Stripe is not configured." }, { status: 500 });
    }
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-12-18.acacia" });

    const {
      connectedAccountId,
      invoiceId,
      amountCents,
      description,
      clientEmail,
      successUrl,
      cancelUrl,
      applicationFeeCents = 0,
    } = await request.json();

    if (!connectedAccountId) return Response.json({ error: "connectedAccountId is required." }, { status: 400 });
    if (!invoiceId)          return Response.json({ error: "invoiceId is required." }, { status: 400 });
    if (!amountCents || amountCents < 50) return Response.json({ error: "amountCents must be >= 50 (Stripe minimum is $0.50)." }, { status: 400 });
    if (!successUrl || !cancelUrl) return Response.json({ error: "successUrl and cancelUrl are required." }, { status: 400 });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: { name: description || `Invoice ${invoiceId}` },
          unit_amount: Math.round(amountCents),
        },
        quantity: 1,
      }],
      payment_intent_data: {
        application_fee_amount: Math.round(applicationFeeCents) || 0,
        transfer_data: { destination: connectedAccountId },
        metadata: { invoiceId, connectedAccountId },
      },
      ...(clientEmail ? { customer_email: clientEmail } : {}),
      metadata: { invoiceId, connectedAccountId },
      success_url: successUrl,
      cancel_url:  cancelUrl,
    });

    return Response.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error("[stripe/checkout]", err);
    return Response.json({ error: err.message || "Checkout session failed." }, { status: 500 });
  }
}
