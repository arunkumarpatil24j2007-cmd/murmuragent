-- ==============================================================================
-- Murmur User Connections Schema & Row Level Security (RLS)
-- ==============================================================================

-- 1. Create user_connections table linked to auth.users
CREATE TABLE IF NOT EXISTS public.user_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,                                 -- 'google', 'notion', 'github', 'vercel', 'airtop'
    encrypted_access_token TEXT,                            -- AES-256-GCM encrypted access token / key
    encrypted_refresh_token TEXT,                           -- AES-256-GCM encrypted refresh token (if OAuth)
    account_label TEXT,                                     -- Human-readable label (e.g. "Work Account", "github-user")
    account_email TEXT,                                     -- Associated external account email
    account_avatar TEXT,                                    -- Avatar URL
    scopes TEXT[] NOT NULL DEFAULT '{}',                    -- Granted OAuth scopes
    expires_at TIMESTAMPTZ,                                 -- Access token expiration
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,            -- Additional provider-specific non-sensitive data
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_user_provider UNIQUE(user_id, provider)
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.user_connections ENABLE ROW LEVEL SECURITY;

-- 3. Row Level Security Policies
-- Policy: Users can view their own connections metadata (client anon key with authenticated JWT)
DROP POLICY IF EXISTS "Users can view own connections" ON public.user_connections;
CREATE POLICY "Users can view own connections"
    ON public.user_connections
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can insert their own connections
DROP POLICY IF EXISTS "Users can insert own connections" ON public.user_connections;
CREATE POLICY "Users can insert own connections"
    ON public.user_connections
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own connections
DROP POLICY IF EXISTS "Users can update own connections" ON public.user_connections;
CREATE POLICY "Users can update own connections"
    ON public.user_connections
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own connections (disconnect)
DROP POLICY IF EXISTS "Users can delete own connections" ON public.user_connections;
CREATE POLICY "Users can delete own connections"
    ON public.user_connections
    FOR DELETE
    USING (auth.uid() = user_id);

-- Policy: Full access for server-side service_role key
DROP POLICY IF EXISTS "Service role full access on user_connections" ON public.user_connections;
CREATE POLICY "Service role full access on user_connections"
    ON public.user_connections
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 4. Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_user_connections_user_id ON public.user_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_user_connections_lookup ON public.user_connections(user_id, provider);

-- 5. Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_user_connections_updated_at()
RETURNS trigger AS $$
BEGIN
    new.updated_at = now();
    RETURN new;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_user_connections_updated ON public.user_connections;
CREATE TRIGGER on_user_connections_updated
    BEFORE UPDATE ON public.user_connections
    FOR EACH ROW EXECUTE FUNCTION public.handle_user_connections_updated_at();
