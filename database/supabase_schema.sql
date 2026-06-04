BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_es text,
  price integer NOT NULL DEFAULT 0,
  duration_days integer NOT NULL DEFAULT 30,
  storage_limit_bytes bigint NOT NULL DEFAULT 0,
  token_limit_usage integer NOT NULL DEFAULT 1000,
  prueba_gratis boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trigger_update_plans_updated_at ON public.plans;
CREATE TRIGGER trigger_update_plans_updated_at
BEFORE UPDATE ON public.plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  name text,
  full_name text,
  telegram_id text,
  wssp text,
  phone_number text,
  phone_verified boolean NOT NULL DEFAULT false,
  cliente boolean NOT NULL DEFAULT false,
  estado_interaccion text,
  registered_via text DEFAULT 'web',
  onboarding_status text DEFAULT 'pending',
  registro_previo boolean NOT NULL DEFAULT false,
  admin boolean NOT NULL DEFAULT false,
  plan_gratis boolean NOT NULL DEFAULT false,
  limite_extension_gratis timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  current_plan_id uuid REFERENCES public.plans(id) ON DELETE SET NULL,
  plan_expiration timestamptz,
  used_storage_bytes bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_email_key UNIQUE (email)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_number_unique
ON public.users(phone_number)
WHERE phone_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_current_plan_id ON public.users(current_plan_id);

DROP TRIGGER IF EXISTS trigger_update_users_updated_at ON public.users;
CREATE TRIGGER trigger_update_users_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.plans(id) ON DELETE SET NULL,
  amount_usd numeric(12,2) NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'pending',
  payment_provider text,
  payment_ref text,
  paid_at timestamptz,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON public.payments(paid_at DESC);

CREATE TABLE IF NOT EXISTS public.user_credentials (
  id bigserial PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  telegram_chat_id text,
  email text,
  google_refresh_token text,
  google_access_token text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_credentials_user_or_telegram_chk CHECK (user_id IS NOT NULL OR telegram_chat_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_credentials_user_id_unique
ON public.user_credentials(user_id)
WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_credentials_telegram_chat_id ON public.user_credentials(telegram_chat_id);
CREATE INDEX IF NOT EXISTS idx_user_credentials_email ON public.user_credentials(email);

DROP TRIGGER IF EXISTS trigger_update_user_credentials_updated_at ON public.user_credentials;
CREATE TRIGGER trigger_update_user_credentials_updated_at
BEFORE UPDATE ON public.user_credentials
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.user_tokens_usage (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tokens_used integer NOT NULL DEFAULT 0,
  total_tokens integer NOT NULL DEFAULT 1000,
  tokens_limit integer GENERATED ALWAYS AS (total_tokens) STORED,
  total_tokens_used integer GENERATED ALWAYS AS (tokens_used) STORED,
  operation text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_updated_at timestamptz,
  CONSTRAINT user_tokens_usage_user_id_key UNIQUE (user_id)
);

DROP TRIGGER IF EXISTS trigger_update_user_tokens_usage_updated_at ON public.user_tokens_usage;
CREATE TRIGGER trigger_update_user_tokens_usage_updated_at
BEFORE UPDATE ON public.user_tokens_usage
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.extensiones (
  id text PRIMARY KEY,
  name text NOT NULL,
  name_es text NOT NULL,
  description text,
  description_es text,
  price numeric(10,2) NOT NULL DEFAULT 0.00,
  storage_bonus_bytes bigint DEFAULT 0,
  disponible boolean NOT NULL DEFAULT true,
  type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trigger_update_extensiones_updated_at ON public.extensiones;
CREATE TRIGGER trigger_update_extensiones_updated_at
BEFORE UPDATE ON public.extensiones
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_extensiones_disponible ON public.extensiones(disponible);

CREATE TABLE IF NOT EXISTS public.plan_extensiones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  extension_id text NOT NULL REFERENCES public.extensiones(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT plan_extensiones_unique UNIQUE (plan_id, extension_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_plan_extensiones_plan_id ON public.plan_extensiones(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_extensiones_user_id ON public.plan_extensiones(user_id);
CREATE INDEX IF NOT EXISTS idx_plan_extensiones_extension_id ON public.plan_extensiones(extension_id);

CREATE TABLE IF NOT EXISTS public.carpeta_administrador (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  correo text NOT NULL,
  telegram_id text,
  id_drive_carpeta text NOT NULL,
  plan_name text,
  plan_id uuid REFERENCES public.plans(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_carpeta_administrador_correo_unique
ON public.carpeta_administrador(correo);

DROP TRIGGER IF EXISTS trigger_update_carpeta_administrador_updated_at ON public.carpeta_administrador;
CREATE TRIGGER trigger_update_carpeta_administrador_updated_at
BEFORE UPDATE ON public.carpeta_administrador
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.sub_carpetas_administrador (
  id bigserial PRIMARY KEY,
  administrador_email text NOT NULL,
  file_id_master text NOT NULL,
  file_id_subcarpeta text NOT NULL,
  nombre_subcarpeta text NOT NULL,
  tipo_extension text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sub_carpetas_administrador_file_id_subcarpeta_key UNIQUE (file_id_subcarpeta)
);

CREATE INDEX IF NOT EXISTS idx_sub_carpetas_admin_email ON public.sub_carpetas_administrador(administrador_email);
CREATE INDEX IF NOT EXISTS idx_sub_carpetas_file_id_master ON public.sub_carpetas_administrador(file_id_master);
CREATE INDEX IF NOT EXISTS idx_sub_carpetas_tipo_extension ON public.sub_carpetas_administrador(tipo_extension);

DROP TRIGGER IF EXISTS trigger_update_sub_carpetas_administrador_updated_at ON public.sub_carpetas_administrador;
CREATE TRIGGER trigger_update_sub_carpetas_administrador_updated_at
BEFORE UPDATE ON public.sub_carpetas_administrador
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.carpetas_usuario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id text,
  correo text NOT NULL,
  id_carpeta_drive text NOT NULL,
  folder_id text GENERATED ALWAYS AS (id_carpeta_drive) STORED,
  folder_name text GENERATED ALWAYS AS (correo) STORED,
  administrador text NOT NULL,
  extension text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trigger_update_carpetas_usuario_updated_at ON public.carpetas_usuario;
CREATE TRIGGER trigger_update_carpetas_usuario_updated_at
BEFORE UPDATE ON public.carpetas_usuario
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_carpetas_usuario_administrador ON public.carpetas_usuario(administrador);
CREATE INDEX IF NOT EXISTS idx_carpetas_usuario_correo ON public.carpetas_usuario(correo);
CREATE INDEX IF NOT EXISTS idx_carpetas_usuario_id_carpeta_drive ON public.carpetas_usuario(id_carpeta_drive);

CREATE TABLE IF NOT EXISTS public.grupos_drive (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_name text NOT NULL,
  nombre_grupo_low text,
  folder_id text NOT NULL,
  administrador text NOT NULL,
  extension text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_grupos_drive_owner_id ON public.grupos_drive(owner_id);
CREATE INDEX IF NOT EXISTS idx_grupos_drive_administrador ON public.grupos_drive(administrador);
CREATE INDEX IF NOT EXISTS idx_grupos_drive_folder_id ON public.grupos_drive(folder_id);

DROP TRIGGER IF EXISTS trigger_update_grupos_drive_updated_at ON public.grupos_drive;
CREATE TRIGGER trigger_update_grupos_drive_updated_at
BEFORE UPDATE ON public.grupos_drive
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.grupos_carpetas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'lector',
  carpeta_id text NOT NULL,
  administrador text NOT NULL,
  usuario_lector text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT grupos_carpetas_unique UNIQUE (carpeta_id, usuario_lector)
);

CREATE INDEX IF NOT EXISTS idx_grupos_carpetas_user_id ON public.grupos_carpetas(user_id);
CREATE INDEX IF NOT EXISTS idx_grupos_carpetas_administrador ON public.grupos_carpetas(administrador);
CREATE INDEX IF NOT EXISTS idx_grupos_carpetas_usuario_lector ON public.grupos_carpetas(usuario_lector);

DROP TRIGGER IF EXISTS trigger_update_grupos_carpetas_updated_at ON public.grupos_carpetas;
CREATE TRIGGER trigger_update_grupos_carpetas_updated_at
BEFORE UPDATE ON public.grupos_carpetas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.documentos_administrador (
  id bigserial PRIMARY KEY,
  file_id text,
  name text,
  file_type text,
  file_size bigint,
  administrador text NOT NULL,
  cliente text,
  servicio text,
  carpeta_actual text,
  nombre_carpeta_actual text,
  telegram_id text,
  content text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  embedding vector(768),
  pendiente boolean NOT NULL DEFAULT false,
  nombre_limpio text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documentos_administrador_administrador ON public.documentos_administrador(administrador);
CREATE INDEX IF NOT EXISTS idx_documentos_administrador_cliente ON public.documentos_administrador(cliente);
CREATE INDEX IF NOT EXISTS idx_documentos_administrador_file_id ON public.documentos_administrador(file_id);
CREATE INDEX IF NOT EXISTS idx_documentos_administrador_servicio ON public.documentos_administrador(servicio);
CREATE INDEX IF NOT EXISTS idx_documentos_administrador_metadata_gin ON public.documentos_administrador USING gin (metadata);

CREATE INDEX IF NOT EXISTS idx_documentos_administrador_embedding
ON public.documentos_administrador USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

DROP TRIGGER IF EXISTS trigger_update_documentos_administrador_updated_at ON public.documentos_administrador;
CREATE TRIGGER trigger_update_documentos_administrador_updated_at
BEFORE UPDATE ON public.documentos_administrador
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.documentos_entrenador (
  id bigserial PRIMARY KEY,
  content text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  embedding vector(768),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  entrenador text,
  folder_id text
);

CREATE INDEX IF NOT EXISTS idx_documentos_entrenador_embedding
ON public.documentos_entrenador USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_documentos_entrenador_metadata_file_id
ON public.documentos_entrenador USING gin ((metadata->>'file_id'));

DROP TRIGGER IF EXISTS trigger_update_documentos_entrenador_updated_at ON public.documentos_entrenador;
CREATE TRIGGER trigger_update_documentos_entrenador_updated_at
BEFORE UPDATE ON public.documentos_entrenador
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.rutinas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email text NOT NULL UNIQUE,
  plan_semanal jsonb NOT NULL DEFAULT '{}'::jsonb,
  administrador text NOT NULL,
  file_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trigger_update_rutinas_updated_at ON public.rutinas;
CREATE TRIGGER trigger_update_rutinas_updated_at
BEFORE UPDATE ON public.rutinas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.conversaciones_usuario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_email text NOT NULL UNIQUE,
  conversaciones jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_searches integer NOT NULL DEFAULT 0,
  weekly_searches integer NOT NULL DEFAULT 0,
  last_search_date timestamptz,
  week_start_date timestamptz NOT NULL DEFAULT date_trunc('week', now()),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversaciones_usuario_email ON public.conversaciones_usuario(usuario_email);
CREATE INDEX IF NOT EXISTS idx_conversaciones_usuario_jsonb ON public.conversaciones_usuario USING gin (conversaciones);
CREATE INDEX IF NOT EXISTS idx_conversaciones_usuario_week_start ON public.conversaciones_usuario(week_start_date);
CREATE INDEX IF NOT EXISTS idx_conversaciones_usuario_last_search ON public.conversaciones_usuario(last_search_date);

DROP TRIGGER IF EXISTS trigger_update_conversaciones_usuario_updated_at ON public.conversaciones_usuario;
CREATE TRIGGER trigger_update_conversaciones_usuario_updated_at
BEFORE UPDATE ON public.conversaciones_usuario
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.reset_weekly_search_counters()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.conversaciones_usuario
  SET weekly_searches = 0,
      week_start_date = date_trunc('week', now())
  WHERE week_start_date < date_trunc('week', now());
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_search_counter(user_email text)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  current_week_start timestamptz;
BEGIN
  current_week_start := date_trunc('week', now());

  INSERT INTO public.conversaciones_usuario (usuario_email, total_searches, weekly_searches, last_search_date, week_start_date)
  VALUES (user_email, 1, 1, now(), current_week_start)
  ON CONFLICT (usuario_email)
  DO UPDATE SET
    total_searches = public.conversaciones_usuario.total_searches + 1,
    weekly_searches = CASE
      WHEN public.conversaciones_usuario.week_start_date < current_week_start THEN 1
      ELSE public.conversaciones_usuario.weekly_searches + 1
    END,
    last_search_date = now(),
    week_start_date = current_week_start,
    updated_at = now();
END;
$$;

CREATE TABLE IF NOT EXISTS public.user_insights_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_email text NOT NULL,
  week_start_date timestamptz NOT NULL,
  total_searches integer NOT NULL DEFAULT 0,
  semantic_searches integer NOT NULL DEFAULT 0,
  chat_ia_conversations integer NOT NULL DEFAULT 0,
  tokens_used integer NOT NULL DEFAULT 0,
  tokens_limit integer NOT NULL DEFAULT 1500,
  documents_processed integer NOT NULL DEFAULT 0,
  documents_uploaded integer NOT NULL DEFAULT 0,
  search_growth_percentage numeric(5,2) NOT NULL DEFAULT 0.0,
  token_usage_percentage numeric(5,2) NOT NULL DEFAULT 0.0,
  document_growth_percentage numeric(5,2) NOT NULL DEFAULT 0.0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_insights_stats_unique UNIQUE (usuario_email, week_start_date)
);

CREATE INDEX IF NOT EXISTS idx_user_insights_stats_email ON public.user_insights_stats(usuario_email);
CREATE INDEX IF NOT EXISTS idx_user_insights_stats_week ON public.user_insights_stats(week_start_date);
CREATE INDEX IF NOT EXISTS idx_user_insights_stats_email_week ON public.user_insights_stats(usuario_email, week_start_date);

DROP TRIGGER IF EXISTS trigger_update_user_insights_stats_updated_at ON public.user_insights_stats;
CREATE TRIGGER trigger_update_user_insights_stats_updated_at
BEFORE UPDATE ON public.user_insights_stats
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.get_or_create_current_week_stats(user_email text)
RETURNS public.user_insights_stats
LANGUAGE plpgsql
AS $$
DECLARE
  current_week timestamptz;
  stats_record public.user_insights_stats;
BEGIN
  current_week := date_trunc('week', now());

  SELECT * INTO stats_record
  FROM public.user_insights_stats
  WHERE usuario_email = user_email
    AND week_start_date = current_week;

  IF NOT FOUND THEN
    INSERT INTO public.user_insights_stats (usuario_email, week_start_date)
    VALUES (user_email, current_week)
    RETURNING * INTO stats_record;
  END IF;

  RETURN stats_record;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_search_stats(user_email text, search_type text DEFAULT 'semantic')
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  current_week timestamptz;
  previous_week_searches integer := 0;
  current_searches integer;
  growth_percentage numeric(5,2);
BEGIN
  current_week := date_trunc('week', now());

  SELECT COALESCE(total_searches, 0) INTO previous_week_searches
  FROM public.user_insights_stats
  WHERE usuario_email = user_email
    AND week_start_date = current_week - interval '1 week';

  INSERT INTO public.user_insights_stats (
    usuario_email,
    week_start_date,
    total_searches,
    semantic_searches,
    chat_ia_conversations
  )
  VALUES (
    user_email,
    current_week,
    1,
    CASE WHEN search_type = 'semantic' THEN 1 ELSE 0 END,
    CASE WHEN search_type = 'chat_ia' THEN 1 ELSE 0 END
  )
  ON CONFLICT (usuario_email, week_start_date)
  DO UPDATE SET
    total_searches = public.user_insights_stats.total_searches + 1,
    semantic_searches = public.user_insights_stats.semantic_searches +
      CASE WHEN search_type = 'semantic' THEN 1 ELSE 0 END,
    chat_ia_conversations = public.user_insights_stats.chat_ia_conversations +
      CASE WHEN search_type = 'chat_ia' THEN 1 ELSE 0 END,
    updated_at = now()
  RETURNING total_searches INTO current_searches;

  IF previous_week_searches > 0 THEN
    growth_percentage := ((current_searches - previous_week_searches)::numeric / previous_week_searches) * 100;
  ELSE
    growth_percentage := CASE WHEN current_searches > 0 THEN 100.0 ELSE 0.0 END;
  END IF;

  UPDATE public.user_insights_stats
  SET search_growth_percentage = growth_percentage
  WHERE usuario_email = user_email
    AND week_start_date = current_week;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_token_stats(user_email text, tokens_consumed integer)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  current_week timestamptz;
BEGIN
  current_week := date_trunc('week', now());

  INSERT INTO public.user_insights_stats (usuario_email, week_start_date, tokens_used)
  VALUES (user_email, current_week, tokens_consumed)
  ON CONFLICT (usuario_email, week_start_date)
  DO UPDATE SET
    tokens_used = public.user_insights_stats.tokens_used + tokens_consumed,
    updated_at = now();

  UPDATE public.user_insights_stats
  SET token_usage_percentage = (tokens_used::numeric / NULLIF(tokens_limit, 0)) * 100
  WHERE usuario_email = user_email
    AND week_start_date = current_week;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_document_stats(user_email text, doc_type text DEFAULT 'processed')
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  current_week timestamptz;
  previous_week_docs integer := 0;
  current_docs integer;
  growth_percentage numeric(5,2);
BEGIN
  current_week := date_trunc('week', now());

  SELECT COALESCE(documents_processed, 0) INTO previous_week_docs
  FROM public.user_insights_stats
  WHERE usuario_email = user_email
    AND week_start_date = current_week - interval '1 week';

  INSERT INTO public.user_insights_stats (
    usuario_email,
    week_start_date,
    documents_processed,
    documents_uploaded
  )
  VALUES (
    user_email,
    current_week,
    CASE WHEN doc_type = 'processed' THEN 1 ELSE 0 END,
    CASE WHEN doc_type = 'uploaded' THEN 1 ELSE 0 END
  )
  ON CONFLICT (usuario_email, week_start_date)
  DO UPDATE SET
    documents_processed = public.user_insights_stats.documents_processed +
      CASE WHEN doc_type = 'processed' THEN 1 ELSE 0 END,
    documents_uploaded = public.user_insights_stats.documents_uploaded +
      CASE WHEN doc_type = 'uploaded' THEN 1 ELSE 0 END,
    updated_at = now()
  RETURNING documents_processed INTO current_docs;

  IF previous_week_docs > 0 THEN
    growth_percentage := ((current_docs - previous_week_docs)::numeric / previous_week_docs) * 100;
  ELSE
    growth_percentage := CASE WHEN current_docs > 0 THEN 100.0 ELSE 0.0 END;
  END IF;

  UPDATE public.user_insights_stats
  SET document_growth_percentage = growth_percentage
  WHERE usuario_email = user_email
    AND week_start_date = current_week;
END;
$$;

CREATE TABLE IF NOT EXISTS public.weekly_summaries (
  id bigserial PRIMARY KEY,
  usuario_email text NOT NULL,
  week_start_date date NOT NULL,
  week_end_date date NOT NULL,
  total_searches integer NOT NULL DEFAULT 0,
  semantic_searches integer NOT NULL DEFAULT 0,
  chat_conversations integer NOT NULL DEFAULT 0,
  tokens_used integer NOT NULL DEFAULT 0,
  documents_processed integer NOT NULL DEFAULT 0,
  documents_uploaded integer NOT NULL DEFAULT 0,
  search_growth integer NOT NULL DEFAULT 0,
  token_growth integer NOT NULL DEFAULT 0,
  document_growth integer NOT NULL DEFAULT 0,
  insights jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommendations jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT weekly_summaries_unique_user_week UNIQUE (usuario_email, week_start_date)
);

CREATE INDEX IF NOT EXISTS idx_weekly_summaries_user_email ON public.weekly_summaries(usuario_email);
CREATE INDEX IF NOT EXISTS idx_weekly_summaries_week_start ON public.weekly_summaries(week_start_date);
CREATE INDEX IF NOT EXISTS idx_weekly_summaries_user_week ON public.weekly_summaries(usuario_email, week_start_date);

DROP TRIGGER IF EXISTS trigger_update_weekly_summaries_updated_at ON public.weekly_summaries;
CREATE TRIGGER trigger_update_weekly_summaries_updated_at
BEFORE UPDATE ON public.weekly_summaries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.get_user_weekly_summaries(p_usuario_email text, p_limit integer DEFAULT 4)
RETURNS TABLE (
  id bigint,
  week_start_date date,
  week_end_date date,
  total_searches integer,
  semantic_searches integer,
  chat_conversations integer,
  tokens_used integer,
  documents_processed integer,
  documents_uploaded integer,
  search_growth integer,
  token_growth integer,
  document_growth integer,
  insights jsonb,
  recommendations jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ws.id,
    ws.week_start_date,
    ws.week_end_date,
    ws.total_searches,
    ws.semantic_searches,
    ws.chat_conversations,
    ws.tokens_used,
    ws.documents_processed,
    ws.documents_uploaded,
    ws.search_growth,
    ws.token_growth,
    ws.document_growth,
    ws.insights,
    ws.recommendations,
    ws.created_at
  FROM public.weekly_summaries ws
  WHERE ws.usuario_email = p_usuario_email
  ORDER BY ws.week_start_date DESC
  LIMIT p_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_weekly_summary(
  p_usuario_email text,
  p_week_start_date date,
  p_week_end_date date,
  p_total_searches integer,
  p_semantic_searches integer,
  p_chat_conversations integer,
  p_tokens_used integer,
  p_documents_processed integer,
  p_documents_uploaded integer,
  p_search_growth integer,
  p_token_growth integer,
  p_document_growth integer,
  p_insights jsonb,
  p_recommendations jsonb
)
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
  summary_id bigint;
BEGIN
  INSERT INTO public.weekly_summaries (
    usuario_email,
    week_start_date,
    week_end_date,
    total_searches,
    semantic_searches,
    chat_conversations,
    tokens_used,
    documents_processed,
    documents_uploaded,
    search_growth,
    token_growth,
    document_growth,
    insights,
    recommendations
  )
  VALUES (
    p_usuario_email,
    p_week_start_date,
    p_week_end_date,
    p_total_searches,
    p_semantic_searches,
    p_chat_conversations,
    p_tokens_used,
    p_documents_processed,
    p_documents_uploaded,
    p_search_growth,
    p_token_growth,
    p_document_growth,
    p_insights,
    p_recommendations
  )
  ON CONFLICT (usuario_email, week_start_date)
  DO UPDATE SET
    week_end_date = EXCLUDED.week_end_date,
    total_searches = EXCLUDED.total_searches,
    semantic_searches = EXCLUDED.semantic_searches,
    chat_conversations = EXCLUDED.chat_conversations,
    tokens_used = EXCLUDED.tokens_used,
    documents_processed = EXCLUDED.documents_processed,
    documents_uploaded = EXCLUDED.documents_uploaded,
    search_growth = EXCLUDED.search_growth,
    token_growth = EXCLUDED.token_growth,
    document_growth = EXCLUDED.document_growth,
    insights = EXCLUDED.insights,
    recommendations = EXCLUDED.recommendations,
    updated_at = now()
  RETURNING id INTO summary_id;

  RETURN summary_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_active_users_last_week()
RETURNS TABLE (usuario_email text, last_activity timestamptz)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    uis.usuario_email,
    MAX(uis.updated_at) AS last_activity
  FROM public.user_insights_stats uis
  WHERE uis.updated_at >= current_date - interval '7 days'
  GROUP BY uis.usuario_email
  ORDER BY last_activity DESC;
END;
$$;

CREATE TABLE IF NOT EXISTS public.user_activity_stats (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  files_uploaded integer NOT NULL DEFAULT 0,
  files_processed integer NOT NULL DEFAULT 0,
  files_size_total bigint NOT NULL DEFAULT 0,
  semantic_searches integer NOT NULL DEFAULT 0,
  text_searches integer NOT NULL DEFAULT 0,
  legal_searches integer NOT NULL DEFAULT 0,
  ai_chat_sessions integer NOT NULL DEFAULT 0,
  ai_chat_messages integer NOT NULL DEFAULT 0,
  ai_tokens_used integer NOT NULL DEFAULT 0,
  drive_sync_count integer NOT NULL DEFAULT 0,
  last_sync_at timestamptz,
  first_activity_at timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  period_type text NOT NULL DEFAULT 'daily',
  period_date date NOT NULL DEFAULT current_date,
  api_calls integer NOT NULL DEFAULT 0,
  page_views integer NOT NULL DEFAULT 0,
  session_duration_seconds integer NOT NULL DEFAULT 0,
  CONSTRAINT user_activity_stats_unique UNIQUE (user_id, period_type, period_date)
);

CREATE INDEX IF NOT EXISTS idx_user_activity_stats_user_id ON public.user_activity_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_stats_period_date ON public.user_activity_stats(period_date);
CREATE INDEX IF NOT EXISTS idx_user_activity_stats_period_type ON public.user_activity_stats(period_type);
CREATE INDEX IF NOT EXISTS idx_user_activity_stats_last_activity ON public.user_activity_stats(last_activity_at);
CREATE INDEX IF NOT EXISTS idx_user_activity_stats_user_period ON public.user_activity_stats(user_id, period_type, period_date);

DROP TRIGGER IF EXISTS trigger_update_user_activity_stats_updated_at ON public.user_activity_stats;
CREATE TRIGGER trigger_update_user_activity_stats_updated_at
BEFORE UPDATE ON public.user_activity_stats
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.log_user_activity(p_user_id uuid, p_activity_type text, p_increment integer DEFAULT 1)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.user_activity_stats (
    user_id,
    files_uploaded,
    files_processed,
    semantic_searches,
    text_searches,
    legal_searches,
    ai_chat_sessions,
    ai_chat_messages,
    ai_tokens_used,
    drive_sync_count,
    last_activity_at,
    period_type,
    period_date
  )
  VALUES (
    p_user_id,
    CASE WHEN p_activity_type = 'file_upload' THEN p_increment ELSE 0 END,
    CASE WHEN p_activity_type = 'file_process' THEN p_increment ELSE 0 END,
    CASE WHEN p_activity_type = 'semantic_search' THEN p_increment ELSE 0 END,
    CASE WHEN p_activity_type = 'text_search' THEN p_increment ELSE 0 END,
    CASE WHEN p_activity_type = 'legal_search' THEN p_increment ELSE 0 END,
    CASE WHEN p_activity_type = 'ai_chat_session' THEN p_increment ELSE 0 END,
    CASE WHEN p_activity_type = 'ai_chat_message' THEN p_increment ELSE 0 END,
    CASE WHEN p_activity_type = 'ai_tokens' THEN p_increment ELSE 0 END,
    CASE WHEN p_activity_type = 'drive_sync' THEN p_increment ELSE 0 END,
    now(),
    'daily',
    current_date
  )
  ON CONFLICT (user_id, period_type, period_date)
  DO UPDATE SET
    files_uploaded = CASE WHEN p_activity_type = 'file_upload' THEN public.user_activity_stats.files_uploaded + p_increment ELSE public.user_activity_stats.files_uploaded END,
    files_processed = CASE WHEN p_activity_type = 'file_process' THEN public.user_activity_stats.files_processed + p_increment ELSE public.user_activity_stats.files_processed END,
    semantic_searches = CASE WHEN p_activity_type = 'semantic_search' THEN public.user_activity_stats.semantic_searches + p_increment ELSE public.user_activity_stats.semantic_searches END,
    text_searches = CASE WHEN p_activity_type = 'text_search' THEN public.user_activity_stats.text_searches + p_increment ELSE public.user_activity_stats.text_searches END,
    legal_searches = CASE WHEN p_activity_type = 'legal_search' THEN public.user_activity_stats.legal_searches + p_increment ELSE public.user_activity_stats.legal_searches END,
    ai_chat_sessions = CASE WHEN p_activity_type = 'ai_chat_session' THEN public.user_activity_stats.ai_chat_sessions + p_increment ELSE public.user_activity_stats.ai_chat_sessions END,
    ai_chat_messages = CASE WHEN p_activity_type = 'ai_chat_message' THEN public.user_activity_stats.ai_chat_messages + p_increment ELSE public.user_activity_stats.ai_chat_messages END,
    ai_tokens_used = CASE WHEN p_activity_type = 'ai_tokens' THEN public.user_activity_stats.ai_tokens_used + p_increment ELSE public.user_activity_stats.ai_tokens_used END,
    drive_sync_count = CASE WHEN p_activity_type = 'drive_sync' THEN public.user_activity_stats.drive_sync_count + p_increment ELSE public.user_activity_stats.drive_sync_count END,
    last_activity_at = now(),
    updated_at = now();
END;
$$;

CREATE OR REPLACE VIEW public.user_dashboard_stats AS
SELECT
  user_id,
  SUM(files_uploaded) AS total_files_uploaded,
  SUM(files_processed) AS total_files_processed,
  SUM(semantic_searches) AS total_semantic_searches,
  SUM(text_searches) AS total_text_searches,
  SUM(legal_searches) AS total_legal_searches,
  SUM(ai_chat_sessions) AS total_ai_chat_sessions,
  SUM(ai_chat_messages) AS total_ai_chat_messages,
  SUM(ai_tokens_used) AS total_ai_tokens_used,
  SUM(drive_sync_count) AS total_drive_sync_count,
  MAX(last_activity_at) AS last_activity,
  MIN(first_activity_at) AS first_activity
FROM public.user_activity_stats
GROUP BY user_id;

CREATE OR REPLACE VIEW public.user_recent_activity AS
SELECT
  u.id AS user_id,
  u.email,
  COALESCE(stats.files_uploaded, 0) AS files_uploaded,
  COALESCE(stats.semantic_searches, 0) AS semantic_searches,
  COALESCE(stats.ai_chat_sessions, 0) AS ai_chat_sessions,
  COALESCE(stats.last_activity_at, u.created_at) AS last_activity
FROM auth.users u
LEFT JOIN (
  SELECT
    user_id,
    SUM(files_uploaded) AS files_uploaded,
    SUM(semantic_searches) AS semantic_searches,
    SUM(ai_chat_sessions) AS ai_chat_sessions,
    MAX(last_activity_at) AS last_activity_at
  FROM public.user_activity_stats
  WHERE period_date >= current_date - interval '7 days'
  GROUP BY user_id
) stats ON u.id = stats.user_id;

CREATE TABLE IF NOT EXISTS public.wsp_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  phone_number text NOT NULL,
  current_branch text,
  branch_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_interaction timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wsp_sessions_phone ON public.wsp_sessions(phone_number);
CREATE INDEX IF NOT EXISTS idx_wsp_sessions_user ON public.wsp_sessions(user_id);

DROP TRIGGER IF EXISTS trigger_update_wsp_sessions_updated_at ON public.wsp_sessions;
CREATE TRIGGER trigger_update_wsp_sessions_updated_at
BEFORE UPDATE ON public.wsp_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.wsp_legal_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.wsp_sessions(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  thread_type text NOT NULL,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  laws_referenced text[] NOT NULL DEFAULT '{}'::text[],
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wsp_legal_threads_thread_type_chk CHECK (thread_type IN ('case', 'law_search'))
);

CREATE INDEX IF NOT EXISTS idx_wsp_legal_threads_session ON public.wsp_legal_threads(session_id);

DROP TRIGGER IF EXISTS trigger_update_wsp_legal_threads_updated_at ON public.wsp_legal_threads;
CREATE TRIGGER trigger_update_wsp_legal_threads_updated_at
BEFORE UPDATE ON public.wsp_legal_threads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.drive_watch_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  folder_id text NOT NULL,
  channel_id text NOT NULL,
  resource_id text,
  webhook_url text NOT NULL,
  expiration timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT drive_watch_channels_channel_id_key UNIQUE (channel_id)
);

CREATE INDEX IF NOT EXISTS idx_drive_watch_channels_user_id ON public.drive_watch_channels(user_id);
CREATE INDEX IF NOT EXISTS idx_drive_watch_channels_folder_id ON public.drive_watch_channels(folder_id);
CREATE INDEX IF NOT EXISTS idx_drive_watch_channels_active ON public.drive_watch_channels(is_active) WHERE is_active = true;

DROP TRIGGER IF EXISTS trigger_update_drive_watch_channels_updated_at ON public.drive_watch_channels;
CREATE TRIGGER trigger_update_drive_watch_channels_updated_at
BEFORE UPDATE ON public.drive_watch_channels
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.cleanup_expired_watch_channels()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE public.drive_watch_channels
  SET is_active = false,
      updated_at = now()
  WHERE expiration < now()
    AND is_active = true;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

CREATE TABLE IF NOT EXISTS public.drive_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id text NOT NULL,
  resource_id text,
  resource_state text,
  event_type text,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  folder_id text,
  resource_uri text,
  changed_files text,
  notification_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed boolean NOT NULL DEFAULT false,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_drive_notifications_channel_id ON public.drive_notifications(channel_id);
CREATE INDEX IF NOT EXISTS idx_drive_notifications_user_id ON public.drive_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_drive_notifications_created_at ON public.drive_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_drive_notifications_processed ON public.drive_notifications(processed) WHERE processed = false;

CREATE OR REPLACE VIEW public.planes AS
SELECT * FROM public.plans;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tokens_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extensiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_extensiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carpeta_administrador ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sub_carpetas_administrador ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carpetas_usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grupos_drive ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grupos_carpetas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentos_administrador ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentos_entrenador ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rutinas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversaciones_usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_insights_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wsp_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wsp_legal_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drive_watch_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drive_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select" ON public.users;
DROP POLICY IF EXISTS "users_insert" ON public.users;
DROP POLICY IF EXISTS "users_update" ON public.users;
CREATE POLICY "users_select" ON public.users FOR SELECT TO authenticated USING (true);
CREATE POLICY "users_insert" ON public.users FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "users_update" ON public.users FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "plans_select" ON public.plans;
CREATE POLICY "plans_select" ON public.plans FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "payments_select_own" ON public.payments;
DROP POLICY IF EXISTS "payments_insert_own" ON public.payments;
CREATE POLICY "payments_select_own" ON public.payments FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "payments_insert_own" ON public.payments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "user_credentials_select_own" ON public.user_credentials;
DROP POLICY IF EXISTS "user_credentials_insert_own" ON public.user_credentials;
DROP POLICY IF EXISTS "user_credentials_update_own" ON public.user_credentials;
CREATE POLICY "user_credentials_select_own" ON public.user_credentials FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "user_credentials_insert_own" ON public.user_credentials FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "user_credentials_update_own" ON public.user_credentials FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "user_tokens_usage_select_own" ON public.user_tokens_usage;
DROP POLICY IF EXISTS "user_tokens_usage_insert_own" ON public.user_tokens_usage;
DROP POLICY IF EXISTS "user_tokens_usage_update_own" ON public.user_tokens_usage;
CREATE POLICY "user_tokens_usage_select_own" ON public.user_tokens_usage FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "user_tokens_usage_insert_own" ON public.user_tokens_usage FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "user_tokens_usage_update_own" ON public.user_tokens_usage FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "extensiones_select" ON public.extensiones;
CREATE POLICY "extensiones_select" ON public.extensiones FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "plan_extensiones_select_own" ON public.plan_extensiones;
DROP POLICY IF EXISTS "plan_extensiones_insert_own" ON public.plan_extensiones;
DROP POLICY IF EXISTS "plan_extensiones_delete_own" ON public.plan_extensiones;
CREATE POLICY "plan_extensiones_select_own" ON public.plan_extensiones FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "plan_extensiones_insert_own" ON public.plan_extensiones FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "plan_extensiones_delete_own" ON public.plan_extensiones FOR DELETE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "carpeta_administrador_select_own" ON public.carpeta_administrador;
DROP POLICY IF EXISTS "carpeta_administrador_insert_own" ON public.carpeta_administrador;
DROP POLICY IF EXISTS "carpeta_administrador_update_own" ON public.carpeta_administrador;
CREATE POLICY "carpeta_administrador_select_own" ON public.carpeta_administrador FOR SELECT TO authenticated USING (correo = auth.jwt() ->> 'email' OR user_id = auth.uid());
CREATE POLICY "carpeta_administrador_insert_own" ON public.carpeta_administrador FOR INSERT TO authenticated WITH CHECK (correo = auth.jwt() ->> 'email' OR user_id = auth.uid());
CREATE POLICY "carpeta_administrador_update_own" ON public.carpeta_administrador FOR UPDATE TO authenticated USING (correo = auth.jwt() ->> 'email' OR user_id = auth.uid()) WITH CHECK (correo = auth.jwt() ->> 'email' OR user_id = auth.uid());

DROP POLICY IF EXISTS "sub_carpetas_administrador_all_own" ON public.sub_carpetas_administrador;
CREATE POLICY "sub_carpetas_administrador_all_own" ON public.sub_carpetas_administrador FOR ALL TO authenticated USING (administrador_email = auth.jwt() ->> 'email') WITH CHECK (administrador_email = auth.jwt() ->> 'email');

DROP POLICY IF EXISTS "carpetas_usuario_select" ON public.carpetas_usuario;
DROP POLICY IF EXISTS "carpetas_usuario_insert" ON public.carpetas_usuario;
DROP POLICY IF EXISTS "carpetas_usuario_update" ON public.carpetas_usuario;
DROP POLICY IF EXISTS "carpetas_usuario_delete" ON public.carpetas_usuario;
CREATE POLICY "carpetas_usuario_select" ON public.carpetas_usuario FOR SELECT TO authenticated USING (administrador = auth.jwt() ->> 'email' OR correo = auth.jwt() ->> 'email');
CREATE POLICY "carpetas_usuario_insert" ON public.carpetas_usuario FOR INSERT TO authenticated WITH CHECK (administrador = auth.jwt() ->> 'email');
CREATE POLICY "carpetas_usuario_update" ON public.carpetas_usuario FOR UPDATE TO authenticated USING (administrador = auth.jwt() ->> 'email') WITH CHECK (administrador = auth.jwt() ->> 'email');
CREATE POLICY "carpetas_usuario_delete" ON public.carpetas_usuario FOR DELETE TO authenticated USING (administrador = auth.jwt() ->> 'email');

DROP POLICY IF EXISTS "grupos_drive_select" ON public.grupos_drive;
DROP POLICY IF EXISTS "grupos_drive_insert" ON public.grupos_drive;
DROP POLICY IF EXISTS "grupos_drive_update" ON public.grupos_drive;
DROP POLICY IF EXISTS "grupos_drive_delete" ON public.grupos_drive;
CREATE POLICY "grupos_drive_select" ON public.grupos_drive FOR SELECT TO authenticated USING (administrador = auth.jwt() ->> 'email' OR owner_id = auth.uid());
CREATE POLICY "grupos_drive_insert" ON public.grupos_drive FOR INSERT TO authenticated WITH CHECK (administrador = auth.jwt() ->> 'email' OR owner_id = auth.uid());
CREATE POLICY "grupos_drive_update" ON public.grupos_drive FOR UPDATE TO authenticated USING (administrador = auth.jwt() ->> 'email' OR owner_id = auth.uid()) WITH CHECK (administrador = auth.jwt() ->> 'email' OR owner_id = auth.uid());
CREATE POLICY "grupos_drive_delete" ON public.grupos_drive FOR DELETE TO authenticated USING (administrador = auth.jwt() ->> 'email' OR owner_id = auth.uid());

DROP POLICY IF EXISTS "grupos_carpetas_select" ON public.grupos_carpetas;
DROP POLICY IF EXISTS "grupos_carpetas_insert" ON public.grupos_carpetas;
DROP POLICY IF EXISTS "grupos_carpetas_update" ON public.grupos_carpetas;
DROP POLICY IF EXISTS "grupos_carpetas_delete" ON public.grupos_carpetas;
CREATE POLICY "grupos_carpetas_select" ON public.grupos_carpetas FOR SELECT TO authenticated USING (administrador = auth.jwt() ->> 'email' OR usuario_lector = auth.jwt() ->> 'email' OR user_id = auth.uid());
CREATE POLICY "grupos_carpetas_insert" ON public.grupos_carpetas FOR INSERT TO authenticated WITH CHECK (administrador = auth.jwt() ->> 'email' OR user_id = auth.uid());
CREATE POLICY "grupos_carpetas_update" ON public.grupos_carpetas FOR UPDATE TO authenticated USING (administrador = auth.jwt() ->> 'email' OR user_id = auth.uid()) WITH CHECK (administrador = auth.jwt() ->> 'email' OR user_id = auth.uid());
CREATE POLICY "grupos_carpetas_delete" ON public.grupos_carpetas FOR DELETE TO authenticated USING (administrador = auth.jwt() ->> 'email' OR user_id = auth.uid());

DROP POLICY IF EXISTS "documentos_administrador_select_own" ON public.documentos_administrador;
DROP POLICY IF EXISTS "documentos_administrador_insert_own" ON public.documentos_administrador;
DROP POLICY IF EXISTS "documentos_administrador_update_own" ON public.documentos_administrador;
DROP POLICY IF EXISTS "documentos_administrador_delete_own" ON public.documentos_administrador;
CREATE POLICY "documentos_administrador_select_own" ON public.documentos_administrador FOR SELECT TO authenticated USING (cliente = auth.jwt() ->> 'email' OR administrador = auth.jwt() ->> 'email');
CREATE POLICY "documentos_administrador_insert_own" ON public.documentos_administrador FOR INSERT TO authenticated WITH CHECK (cliente = auth.jwt() ->> 'email' OR administrador = auth.jwt() ->> 'email');
CREATE POLICY "documentos_administrador_update_own" ON public.documentos_administrador FOR UPDATE TO authenticated USING (cliente = auth.jwt() ->> 'email' OR administrador = auth.jwt() ->> 'email') WITH CHECK (cliente = auth.jwt() ->> 'email' OR administrador = auth.jwt() ->> 'email');
CREATE POLICY "documentos_administrador_delete_own" ON public.documentos_administrador FOR DELETE TO authenticated USING (cliente = auth.jwt() ->> 'email' OR administrador = auth.jwt() ->> 'email');

DROP POLICY IF EXISTS "documentos_entrenador_select" ON public.documentos_entrenador;
DROP POLICY IF EXISTS "documentos_entrenador_insert" ON public.documentos_entrenador;
DROP POLICY IF EXISTS "documentos_entrenador_update" ON public.documentos_entrenador;
DROP POLICY IF EXISTS "documentos_entrenador_delete" ON public.documentos_entrenador;
CREATE POLICY "documentos_entrenador_select" ON public.documentos_entrenador FOR SELECT TO authenticated USING (entrenador = auth.jwt() ->> 'email' OR metadata->>'correo' = auth.jwt() ->> 'email');
CREATE POLICY "documentos_entrenador_insert" ON public.documentos_entrenador FOR INSERT TO authenticated WITH CHECK (entrenador = auth.jwt() ->> 'email');
CREATE POLICY "documentos_entrenador_update" ON public.documentos_entrenador FOR UPDATE TO authenticated USING (entrenador = auth.jwt() ->> 'email') WITH CHECK (entrenador = auth.jwt() ->> 'email');
CREATE POLICY "documentos_entrenador_delete" ON public.documentos_entrenador FOR DELETE TO authenticated USING (entrenador = auth.jwt() ->> 'email');

DROP POLICY IF EXISTS "rutinas_select" ON public.rutinas;
DROP POLICY IF EXISTS "rutinas_insert" ON public.rutinas;
DROP POLICY IF EXISTS "rutinas_update" ON public.rutinas;
DROP POLICY IF EXISTS "rutinas_delete" ON public.rutinas;
CREATE POLICY "rutinas_select" ON public.rutinas FOR SELECT TO authenticated USING (administrador = auth.jwt() ->> 'email' OR user_email = auth.jwt() ->> 'email');
CREATE POLICY "rutinas_insert" ON public.rutinas FOR INSERT TO authenticated WITH CHECK (administrador = auth.jwt() ->> 'email');
CREATE POLICY "rutinas_update" ON public.rutinas FOR UPDATE TO authenticated USING (administrador = auth.jwt() ->> 'email') WITH CHECK (administrador = auth.jwt() ->> 'email');
CREATE POLICY "rutinas_delete" ON public.rutinas FOR DELETE TO authenticated USING (administrador = auth.jwt() ->> 'email');

DROP POLICY IF EXISTS "conversaciones_usuario_select" ON public.conversaciones_usuario;
DROP POLICY IF EXISTS "conversaciones_usuario_insert" ON public.conversaciones_usuario;
DROP POLICY IF EXISTS "conversaciones_usuario_update" ON public.conversaciones_usuario;
DROP POLICY IF EXISTS "conversaciones_usuario_delete" ON public.conversaciones_usuario;
CREATE POLICY "conversaciones_usuario_select" ON public.conversaciones_usuario FOR SELECT TO authenticated USING (usuario_email = auth.jwt() ->> 'email');
CREATE POLICY "conversaciones_usuario_insert" ON public.conversaciones_usuario FOR INSERT TO authenticated WITH CHECK (usuario_email = auth.jwt() ->> 'email');
CREATE POLICY "conversaciones_usuario_update" ON public.conversaciones_usuario FOR UPDATE TO authenticated USING (usuario_email = auth.jwt() ->> 'email') WITH CHECK (usuario_email = auth.jwt() ->> 'email');
CREATE POLICY "conversaciones_usuario_delete" ON public.conversaciones_usuario FOR DELETE TO authenticated USING (usuario_email = auth.jwt() ->> 'email');

DROP POLICY IF EXISTS "user_insights_stats_select" ON public.user_insights_stats;
DROP POLICY IF EXISTS "user_insights_stats_insert" ON public.user_insights_stats;
DROP POLICY IF EXISTS "user_insights_stats_update" ON public.user_insights_stats;
CREATE POLICY "user_insights_stats_select" ON public.user_insights_stats FOR SELECT TO authenticated USING (usuario_email = auth.jwt() ->> 'email');
CREATE POLICY "user_insights_stats_insert" ON public.user_insights_stats FOR INSERT TO authenticated WITH CHECK (usuario_email = auth.jwt() ->> 'email');
CREATE POLICY "user_insights_stats_update" ON public.user_insights_stats FOR UPDATE TO authenticated USING (usuario_email = auth.jwt() ->> 'email') WITH CHECK (usuario_email = auth.jwt() ->> 'email');

DROP POLICY IF EXISTS "weekly_summaries_select" ON public.weekly_summaries;
DROP POLICY IF EXISTS "weekly_summaries_insert" ON public.weekly_summaries;
DROP POLICY IF EXISTS "weekly_summaries_update" ON public.weekly_summaries;
CREATE POLICY "weekly_summaries_select" ON public.weekly_summaries FOR SELECT TO authenticated USING (usuario_email = auth.jwt() ->> 'email');
CREATE POLICY "weekly_summaries_insert" ON public.weekly_summaries FOR INSERT TO authenticated WITH CHECK (usuario_email = auth.jwt() ->> 'email');
CREATE POLICY "weekly_summaries_update" ON public.weekly_summaries FOR UPDATE TO authenticated USING (usuario_email = auth.jwt() ->> 'email') WITH CHECK (usuario_email = auth.jwt() ->> 'email');

DROP POLICY IF EXISTS "user_activity_stats_select_own" ON public.user_activity_stats;
DROP POLICY IF EXISTS "user_activity_stats_insert_own" ON public.user_activity_stats;
DROP POLICY IF EXISTS "user_activity_stats_update_own" ON public.user_activity_stats;
CREATE POLICY "user_activity_stats_select_own" ON public.user_activity_stats FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "user_activity_stats_insert_own" ON public.user_activity_stats FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "user_activity_stats_update_own" ON public.user_activity_stats FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "wsp_sessions_select_own" ON public.wsp_sessions;
DROP POLICY IF EXISTS "wsp_sessions_insert_own" ON public.wsp_sessions;
DROP POLICY IF EXISTS "wsp_sessions_update_own" ON public.wsp_sessions;
CREATE POLICY "wsp_sessions_select_own" ON public.wsp_sessions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "wsp_sessions_insert_own" ON public.wsp_sessions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "wsp_sessions_update_own" ON public.wsp_sessions FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "wsp_legal_threads_select_own" ON public.wsp_legal_threads;
DROP POLICY IF EXISTS "wsp_legal_threads_insert_own" ON public.wsp_legal_threads;
DROP POLICY IF EXISTS "wsp_legal_threads_update_own" ON public.wsp_legal_threads;
CREATE POLICY "wsp_legal_threads_select_own" ON public.wsp_legal_threads FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "wsp_legal_threads_insert_own" ON public.wsp_legal_threads FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "wsp_legal_threads_update_own" ON public.wsp_legal_threads FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "drive_watch_channels_select_own" ON public.drive_watch_channels;
DROP POLICY IF EXISTS "drive_watch_channels_insert_own" ON public.drive_watch_channels;
DROP POLICY IF EXISTS "drive_watch_channels_update_own" ON public.drive_watch_channels;
DROP POLICY IF EXISTS "drive_watch_channels_delete_own" ON public.drive_watch_channels;
CREATE POLICY "drive_watch_channels_select_own" ON public.drive_watch_channels FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "drive_watch_channels_insert_own" ON public.drive_watch_channels FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "drive_watch_channels_update_own" ON public.drive_watch_channels FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "drive_watch_channels_delete_own" ON public.drive_watch_channels FOR DELETE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "drive_notifications_select_own" ON public.drive_notifications;
DROP POLICY IF EXISTS "drive_notifications_insert_own" ON public.drive_notifications;
DROP POLICY IF EXISTS "drive_notifications_update_own" ON public.drive_notifications;
CREATE POLICY "drive_notifications_select_own" ON public.drive_notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "drive_notifications_insert_own" ON public.drive_notifications FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "drive_notifications_update_own" ON public.drive_notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

COMMIT;
