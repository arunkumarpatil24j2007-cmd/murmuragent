-- ==============================================================================
-- Murmur Multi-User SaaS Database Migration
-- Migration: 20260917_multi_user_saas.sql
-- Description: Complete schema for multi-user profiles, user connections,
--              user settings, agent sessions, agent messages, and agent tasks
--              with Row Level Security (RLS) and service-role bypass.
-- ==============================================================================

-- 1. Profiles Table Updates
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    name TEXT,
    display_name TEXT,
    phone_number TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure required columns exist if profiles was previously created
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Service role full access on profiles" ON public.profiles;
CREATE POLICY "Service role full access on profiles"
    ON public.profiles FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 2. User Connections Table (Per-User Credentials & Status)
CREATE TABLE IF NOT EXISTS public.user_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,                                 -- 'google', 'notion', 'github', 'vercel', 'airtop'
    status TEXT NOT NULL DEFAULT 'connected',               -- 'connected', 'disconnected', 'expired'
    encrypted_access_token TEXT,                            -- AES-256-GCM encrypted token
    encrypted_refresh_token TEXT,                           -- AES-256-GCM encrypted refresh token
    account_label TEXT,                                     -- e.g. "Work Account", "github-username"
    account_email TEXT,                                     -- Associated external account email
    account_avatar TEXT,                                    -- Avatar URL from provider
    scopes TEXT[] NOT NULL DEFAULT '{}',                    -- Granted OAuth scopes
    expires_at TIMESTAMPTZ,                                 -- Token expiration timestamp
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,            -- Additional provider-specific metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_user_provider UNIQUE(user_id, provider)
);

ALTER TABLE public.user_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own connections" ON public.user_connections;
CREATE POLICY "Users can view own connections"
    ON public.user_connections FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own connections" ON public.user_connections;
CREATE POLICY "Users can insert own connections"
    ON public.user_connections FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own connections" ON public.user_connections;
CREATE POLICY "Users can update own connections"
    ON public.user_connections FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own connections" ON public.user_connections;
CREATE POLICY "Users can delete own connections"
    ON public.user_connections FOR DELETE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access on user_connections" ON public.user_connections;
CREATE POLICY "Service role full access on user_connections"
    ON public.user_connections FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_user_connections_user_id ON public.user_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_user_connections_lookup ON public.user_connections(user_id, provider);

-- 3. User Settings Table (Per-User Preferences, Models, Notifications)
CREATE TABLE IF NOT EXISTS public.user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own settings" ON public.user_settings;
CREATE POLICY "Users can view own settings"
    ON public.user_settings FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own settings" ON public.user_settings;
CREATE POLICY "Users can insert own settings"
    ON public.user_settings FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own settings" ON public.user_settings;
CREATE POLICY "Users can update own settings"
    ON public.user_settings FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access on user_settings" ON public.user_settings;
CREATE POLICY "Service role full access on user_settings"
    ON public.user_settings FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON public.user_settings(user_id);

-- 4. Agent Sessions Table (Conversations / Workspaces)
CREATE TABLE IF NOT EXISTS public.agent_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'New Conversation',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own agent sessions" ON public.agent_sessions;
CREATE POLICY "Users can view own agent sessions"
    ON public.agent_sessions FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own agent sessions" ON public.agent_sessions;
CREATE POLICY "Users can insert own agent sessions"
    ON public.agent_sessions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own agent sessions" ON public.agent_sessions;
CREATE POLICY "Users can update own agent sessions"
    ON public.agent_sessions FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own agent sessions" ON public.agent_sessions;
CREATE POLICY "Users can delete own agent sessions"
    ON public.agent_sessions FOR DELETE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access on agent_sessions" ON public.agent_sessions;
CREATE POLICY "Service role full access on agent_sessions"
    ON public.agent_sessions FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_agent_sessions_user_id ON public.agent_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_updated_at ON public.agent_sessions(updated_at DESC);

-- 5. Agent Messages Table (Conversation History)
CREATE TABLE IF NOT EXISTS public.agent_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.agent_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL,                                     -- 'user', 'assistant', 'system', 'tool'
    content TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,            -- Tool calls, token counts, model names
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own agent messages" ON public.agent_messages;
CREATE POLICY "Users can view own agent messages"
    ON public.agent_messages FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own agent messages" ON public.agent_messages;
CREATE POLICY "Users can insert own agent messages"
    ON public.agent_messages FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own agent messages" ON public.agent_messages;
CREATE POLICY "Users can delete own agent messages"
    ON public.agent_messages FOR DELETE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access on agent_messages" ON public.agent_messages;
CREATE POLICY "Service role full access on agent_messages"
    ON public.agent_messages FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_agent_messages_session_id ON public.agent_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_messages_user_id ON public.agent_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_messages_created_at ON public.agent_messages(created_at ASC);

-- 6. Agent Tasks Table (Autonomous Executions History)
CREATE TABLE IF NOT EXISTS public.agent_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id UUID REFERENCES public.agent_sessions(id) ON DELETE SET NULL,
    task TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',                 -- 'pending', 'running', 'completed', 'failed', 'cancelled'
    result JSONB,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own agent tasks" ON public.agent_tasks;
CREATE POLICY "Users can view own agent tasks"
    ON public.agent_tasks FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own agent tasks" ON public.agent_tasks;
CREATE POLICY "Users can insert own agent tasks"
    ON public.agent_tasks FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own agent tasks" ON public.agent_tasks;
CREATE POLICY "Users can update own agent tasks"
    ON public.agent_tasks FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access on agent_tasks" ON public.agent_tasks;
CREATE POLICY "Service role full access on agent_tasks"
    ON public.agent_tasks FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_agent_tasks_user_id ON public.agent_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_status ON public.agent_tasks(status);

-- 7. Automated Timestamps Trigger Function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger AS $$
BEGIN
    new.updated_at = now();
    RETURN new;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to all mutable tables
DROP TRIGGER IF EXISTS on_profiles_updated ON public.profiles;
CREATE TRIGGER on_profiles_updated
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS on_user_connections_updated ON public.user_connections;
CREATE TRIGGER on_user_connections_updated
    BEFORE UPDATE ON public.user_connections
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS on_user_settings_updated ON public.user_settings;
CREATE TRIGGER on_user_settings_updated
    BEFORE UPDATE ON public.user_settings
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS on_agent_sessions_updated ON public.agent_sessions;
CREATE TRIGGER on_agent_sessions_updated
    BEFORE UPDATE ON public.agent_sessions
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS on_agent_tasks_updated ON public.agent_tasks;
CREATE TRIGGER on_agent_tasks_updated
    BEFORE UPDATE ON public.agent_tasks
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
