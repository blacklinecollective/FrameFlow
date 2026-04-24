-- ─────────────────────────────────────────────────────────────
-- FrameFlow · Supabase Database Setup
-- Run this once in your Supabase SQL Editor:
--   supabase.com/dashboard → your project → SQL Editor → New query
--   Paste everything below → Run
-- ─────────────────────────────────────────────────────────────

-- 1. Create the app_state table (one row per user, stores all data)
CREATE TABLE IF NOT EXISTS public.app_state (
  user_id     uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  brand_kit   jsonb DEFAULT '{}'::jsonb,
  projects    jsonb DEFAULT '[]'::jsonb,
  invoices    jsonb DEFAULT '[]'::jsonb,
  crm_clients jsonb DEFAULT '[]'::jsonb,
  bookings    jsonb DEFAULT '[]'::jsonb,
  cal_events  jsonb DEFAULT '[]'::jsonb,
  community_profile jsonb DEFAULT '{}'::jsonb,
  updated_at  timestamptz DEFAULT now()
);

-- 2. Enable Row Level Security (each user only sees their own data)
ALTER TABLE public.app_state ENABLE ROW LEVEL SECURITY;

-- 3. Policies — users can only read/write their own row
CREATE POLICY "Users can read own state"
  ON public.app_state FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own state"
  ON public.app_state FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own state"
  ON public.app_state FOR UPDATE
  USING (auth.uid() = user_id);

-- 4. Auto-update the updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.app_state
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Done! Your database is ready.
-- Now go back to FrameFlow and log in — your data will start saving automatically.
