import Stripe from "stripe";

// POST /api/stripe/onboard
// Body: { existingAccountId?: string, returnUrl: string, refreshUrl: string, email?: string }
// Creates a Stripe Connect Standard account (if needed) and returns an
// onboarding URL the user should redirect to. Once Stripe finishes, it
// redirects them back to returnUrl. The caller is responsible for
// persisting `accountId` to brand_kit so we can reuse it later.
export async function POST(request) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return Response.json({ error: "Stripe is not configured. Add STRIPE_SECRET_KEY to Vercel env vars." }, { status: 500 });
    }
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-12-18.acacia" });
    const { existingAccountId, returnUrl, refreshUrl, email } = await request.json();
    if (!returnUrl || !refreshUrl) {
      return Response.json({ error: "returnUrl and refreshUrl are required." }, { status: 400 });
    }

    let accountId = existingAccountId || null;

    // Create the connected account if the photographer doesn't have one yet.
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "standard",
        ...(email ? { email } : {}),
      });
      accountId = account.id;
    }

    // AccountLinks are short-lived, single-use URLs that send the user
    // through Stripe's hosted onboarding flow. We create a fresh one on
    // every "Connect Stripe" click.
    const accountLink = await stripe.accountLinks.create({
      account:    accountId,
      refresh_url: refreshUrl,
      return_url:  returnUrl,
      type:       "account_onboarding",
    });

    return Response.json({ accountId, url: accountLink.url });
  } catch (err) {
    console.error("[stripe/onboard]", err);
    return Response.json({ error: err.message || "Onboarding link failed." }, { status: 500 });
  }
}
