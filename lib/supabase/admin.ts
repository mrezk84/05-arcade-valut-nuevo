import { createClient } from '@supabase/supabase-js';

// Cliente con la service_role key: ignora RLS. Solo para Route Handlers;
// nunca importarlo desde componentes cliente.
export const createAdminClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
