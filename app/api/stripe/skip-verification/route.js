import Stripe from "stripe";

// POST /api/stripe/skip-verification
// Body: { accountId }
//
// SANDBOX-ONLY convenience: when Stripe's identity-document upload UI
// is glitchy in the connected dashboard, we can satisfy
// requirements.individual.verification.document programmatically by
// attaching Stripe's magic test file `file_identity_document_success`
// to the account holder. This ONLY works in test mode — production
// keys will reject it. We refuse to run unless the secret key starts
// with `sk_test_`.
export async function POST(request) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return Response.json({ error: "Stripe is not configured." }, { status: 500 });
    }
    if (!process.env.STRIPE_SECRET_KEY.startsWith("sk_test_")) {
      return Response.json({ error: "Refusing to run skip-verification with a live secret key." }, { status: 400 });
    }
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-12-18.acacia" });
    const { accountId } = await request.json();
    if (!accountId) return Response.json({ error: "accountId is required." }, { status: 400 });

    // 1. List the persons on the connected account. For Standard / Express
    //    individual accounts there's typically just one (the account holder).
    const persons = await stripe.accounts.listPersons(accountId, { limit: 100 });
    const updated = [];
    for (const p of persons.data) {
      const u = await stripe.accounts.updatePerson(accountId, p.id, {
        verification: {
          document: {
            front: "file_identity_document_success",
            back:  "file_identity_document_success",
          },
        },
      });
      updated.push({ id: u.id, status: u.verification?.status });
    }

    // 2. Re-fetch the account so the caller sees the new requirements list.
    const a = await stripe.accounts.retrieve(accountId);
    return Response.json({
      ok: true,
      personsUpdated: updated,
      chargesEnabled:    a.charges_enabled,
      payoutsEnabled:    a.payouts_enabled,
      detailsSubmitted:  a.details_submitted,
      requirementsCount: (a.requirements?.currently_due || []).length,
      requirementsCurrentlyDue: a.requirements?.currently_due || [],
    });
  } catch (err) {
    console.error("[stripe/skip-verification]", err);
    return Response.json({ error: err.message || "Skip-verification failed." }, { status: 500 });
  }
}
