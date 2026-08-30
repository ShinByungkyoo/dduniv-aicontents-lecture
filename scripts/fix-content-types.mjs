// One-shot: rewrite content-type of already-uploaded HTML files in
// the lecture-uploads bucket to `text/html; charset=utf-8`, so browsers
// render them as HTML instead of showing the source as plain text.
//
// Usage: node --env-file=.env.local scripts/fix-content-types.mjs
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = 'lecture-uploads';
const CORRECT_CT = 'text/html; charset=utf-8';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Run `vercel env pull .env.local`.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: files, error: listErr } = await supabase.storage.from(BUCKET).list('', { limit: 1000 });
if (listErr) { console.error('list failed:', listErr.message); process.exit(1); }

const htmlFiles = files.filter((f) => /\.html?$/i.test(f.name));
console.log(`Found ${htmlFiles.length} .html file(s) in bucket "${BUCKET}"`);

let fixed = 0, skipped = 0, failed = 0;
for (const f of htmlFiles) {
  const current = f.metadata?.mimetype || f.metadata?.contentType || '?';
  if (current === CORRECT_CT) { skipped++; continue; }

  // Download → re-upload with correct content-type
  const { data: blob, error: dlErr } = await supabase.storage.from(BUCKET).download(f.name);
  if (dlErr) { console.warn(`  ✗ ${f.name}: download failed — ${dlErr.message}`); failed++; continue; }
  const buffer = Buffer.from(await blob.arrayBuffer());
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .update(f.name, buffer, { contentType: CORRECT_CT, cacheControl: '0', upsert: true });
  if (upErr) { console.warn(`  ✗ ${f.name}: update failed — ${upErr.message}`); failed++; continue; }
  console.log(`  ✓ ${f.name} (${current} → ${CORRECT_CT})`);
  fixed++;
}

console.log(`\nDone. fixed=${fixed}, skipped=${skipped}, failed=${failed}`);
