import Stripe from "stripe";

// POST /api/stripe/account-status
// Body: { accountId }
// Returns: { chargesEnabled, payoutsEnabled, detailsSubmitted, requirementsCount }
// Used after the photographer returns from Stripe's onboarding flow so
// we can show "Connected ✓" vs "Continue setup" in the UI.
export async function POST(request) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return Response.json({ error: "Stripe is not configured." }, { status: 500 });
    }
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-12-18.acacia" });
    const { accountId } = await request.json();
    if (!accountId) return Response.json({ error: "accountId is required." }, { status: 400 });

    const a = await stripe.accounts.retrieve(accountId);
    return Response.json({
      chargesEnabled:    a.charges_enabled,
      payoutsEnabled:    a.payouts_enabled,
      detailsSubmitted:  a.details_submitted,
      requirementsCount: (a.requirements?.currently_due || []).length,
    });
  } catch (err) {
    console.error("[stripe/account-status]", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
