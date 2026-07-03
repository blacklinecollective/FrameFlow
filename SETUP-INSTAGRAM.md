# Instagram DM → Pipeline Setup

FrameFlow's code side is done: OAuth connect flow, DM webhook, database tables, and the Pipeline integration are all built. To make it live, complete these one-time steps on Meta's side.

## 1. Instagram account type
Your Instagram must be a **Professional account** (Business or Creator).
Instagram app → Settings → Account type and tools → Switch to professional account. Free, reversible.

## 2. Create the Meta app
1. Go to https://developers.facebook.com → **My Apps → Create App**.
2. Use case: select **Instagram** (the "Instagram API with Instagram Login" setup).
3. In the app dashboard, open **Instagram → API setup with Instagram login**.
4. Note your **Instagram App ID** and **Instagram App Secret**.

## 3. Configure OAuth redirect
In the Instagram settings of the app, add this **OAuth Redirect URI**:
```
https://frame-flow-sipg.vercel.app/api/instagram/callback
```

## 4. Configure the webhook
In **Instagram → API setup → Webhooks** (or Products → Webhooks → Instagram):
- Callback URL: `https://frame-flow-sipg.vercel.app/api/instagram/webhook`
- Verify token: the same random string you set as `IG_VERIFY_TOKEN` below
- Subscribe to the **messages** field.

(Do this AFTER step 5 is deployed, or verification will fail.)

## 5. Environment variables in Vercel
Vercel dashboard → your project (frame-flow-sipg) → Settings → Environment Variables. Add:

| Name | Value |
|---|---|
| `IG_APP_ID` | Instagram App ID from step 2 |
| `IG_APP_SECRET` | Instagram App Secret from step 2 |
| `IG_VERIFY_TOKEN` | any random string you invent (must match step 4) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard → project frameflow → Settings → API → `service_role` key (keep secret!) |
| `NEXT_PUBLIC_SITE_URL` | `https://frame-flow-sipg.vercel.app` |

Then redeploy so the vars take effect.

## 6. Connect and test
1. In FrameFlow → **Pipeline** tab → click **Connect Instagram** → log in and approve.
2. Add yourself/testers as Instagram Testers in the Meta app dashboard (up to 25 accounts work before App Review).
3. Send the connected account a DM from another Instagram account → it should appear in Pipeline as a lead within seconds.

## 7. App Review (for other FrameFlow users)
Works immediately for your own + tester accounts. For ANY photographer to connect their Instagram, submit the app for **Meta App Review** requesting `instagram_business_manage_messages` (typically takes weeks). Provide a screencast of the connect flow + a lead appearing in Pipeline.

## Notes & limits
- Long-lived tokens last ~60 days. Token refresh isn't automated yet — reconnecting via the button refreshes it. (Auto-refresh can be added later.)
- Meta rate limits: ~200 automated DMs/hour per account — irrelevant for receiving leads.
- Webhook events are signed; the endpoint rejects anything not signed with your app secret.
