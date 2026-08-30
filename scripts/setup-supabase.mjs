// Idempotent Supabase schema setup:
//  - Creates public.lectures table + index
//  - Creates public 'lecture-uploads' storage bucket
// Run with:  node --env-file=.env.local scripts/setup-supabase.mjs
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const POSTGRES_URL = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Did you run `vercel env pull .env.local`?');
  process.exit(1);
}
if (!POSTGRES_URL) {
  console.error('Missing POSTGRES_URL_NON_POOLING. Did you run `vercel env pull .env.local`?');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// --- 1) Create table & index via direct Postgres connection
const DDL = `
CREATE TABLE IF NOT EXISTS public.lectures (
  id BIGSERIAL PRIMARY KEY,
  section TEXT NOT NULL CHECK (section IN ('1분반', '2분반')),
  date DATE NOT NULL,
  title TEXT NOT NULL,
  materials JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS lectures_section_date_idx ON public.lectures (section, date DESC);
CREATE INDEX IF NOT EXISTS lectures_date_idx ON public.lectures (date DESC);
`;

console.log('[1/2] Applying DDL to lectures table...');
const connStr = POSTGRES_URL.includes('sslmode=')
  ? POSTGRES_URL
  : POSTGRES_URL + (POSTGRES_URL.includes('?') ? '&' : '?') + 'sslmode=require&uselibpqcompat=true';
const pgClient = new pg.Client({ connectionString: connStr });
await pgClient.connect();
try {
  await pgClient.query(DDL);
  const { rows } = await pgClient.query("SELECT COUNT(*)::int AS n FROM public.lectures");
  console.log(`      ✓ lectures table ready (current rows: ${rows[0].n})`);
} finally {
  await pgClient.end();
}

// --- 2) Create public storage bucket for HTML uploads
console.log('[2/2] Ensuring storage bucket "lecture-uploads"...');
const { data: buckets, error: listErr } = await supabase.storage.listBuckets();
if (listErr) { console.error('listBuckets failed:', listErr.message); process.exit(1); }
const exists = (buckets || []).some((b) => b.name === 'lecture-uploads');
if (exists) {
  console.log('      ✓ bucket already exists');
} else {
  const { error: createErr } = await supabase.storage.createBucket('lecture-uploads', {
    public: true,
    fileSizeLimit: 31457280,   // 30 MB
    allowedMimeTypes: [
      'text/html',
      'text/html; charset=utf-8',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ],
  });
  if (createErr) { console.error('createBucket failed:', createErr.message); process.exit(1); }
  console.log('      ✓ bucket created (public, 30 MB, HTML + PPT)');
}

console.log('\nDone. Supabase is ready.');
