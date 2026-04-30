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
    const req = a.requirements || {};
    return Response.json({
      chargesEnabled:    a.charges_enabled,
      payoutsEnabled:    a.payouts_enabled,
      detailsSubmitted:  a.details_submitted,
      requirementsCount: (req.currently_due || []).length,
      requirements: {
        currentlyDue:  req.currently_due || [],
        eventuallyDue: req.eventually_due || [],
        pastDue:       req.past_due || [],
        disabledReason: req.disabled_reason || null,
      },
      // Direct link to this account in the Stripe dashboard for fast triage.
      dashboardUrl: `https://dashboard.stripe.com/test/connect/accounts/${accountId}`,
    });
  } catch (err) {
    console.error("[stripe/account-status]", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
