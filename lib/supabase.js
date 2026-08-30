import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.warn('[supabase] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — Supabase client will not work.');
}

export const supabase = createClient(url || 'http://placeholder.local', serviceKey || 'placeholder', {
  auth: { persistSession: false, autoRefreshToken: false },
});

export const LECTURES_TABLE = 'lectures';
export const UPLOADS_BUCKET = 'lecture-uploads';
