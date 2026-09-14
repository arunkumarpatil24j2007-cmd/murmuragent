-- ==============================================================================
-- Murmur Supabase Database Schema & Row Level Security (RLS)
-- ==============================================================================

-- 1. Create profiles table linked to auth.users
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Row Level Security Policies
-- Policy: A user can view their own profile only
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
    ON public.profiles
    FOR SELECT
    USING (auth.uid() = id);

-- Policy: A user can insert their own profile only
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
    ON public.profiles
    FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Policy: A user can update their own profile only
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
    ON public.profiles
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- 4. Automatically create profile on new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.profiles (id, email, display_name, avatar_url, created_at, updated_at)
    VALUES (
        new.id,
        new.email,
        COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
        new.raw_user_meta_data->>'avatar_url',
        now(),
        now()
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        display_name = COALESCE(EXCLUDED.display_name, public.profiles.display_name),
        avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
        updated_at = now();
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to execute on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Automatically maintain updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger AS $$
BEGIN
    new.updated_at = now();
    RETURN new;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_profiles_updated ON public.profiles;
CREATE TRIGGER on_profiles_updated
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- 6. Google Workspace OAuth Accounts (Encrypted Tokens Store)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.google_oauth_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id TEXT NOT NULL UNIQUE,                 -- Primary key identifier (email or Google sub)
    email TEXT NOT NULL,
    name TEXT,
    picture TEXT,
    is_primary BOOLEAN NOT NULL DEFAULT true,
    encrypted_tokens TEXT NOT NULL,                  -- AES-256-GCM cipher payload (iv:authTag:cipher)
    scopes TEXT[] NOT NULL DEFAULT '{}',
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.google_oauth_accounts ENABLE ROW LEVEL SECURITY;

-- Strict Security Policy:
-- Deny all client (anon) access. Only the server-side service_role key can read/write tokens!
DROP POLICY IF EXISTS "Service role only access on google_oauth_accounts" ON public.google_oauth_accounts;
CREATE POLICY "Service role only access on google_oauth_accounts"
    ON public.google_oauth_accounts
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Index for high-performance lookup by account_id and primary account
CREATE INDEX IF NOT EXISTS idx_google_oauth_account_id ON public.google_oauth_accounts(account_id);
CREATE INDEX IF NOT EXISTS idx_google_oauth_primary ON public.google_oauth_accounts(is_primary);

-- Trigger to auto-maintain updated_at on token refresh
DROP TRIGGER IF EXISTS on_google_oauth_accounts_updated ON public.google_oauth_accounts;
CREATE TRIGGER on_google_oauth_accounts_updated
    BEFORE UPDATE ON public.google_oauth_accounts
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
