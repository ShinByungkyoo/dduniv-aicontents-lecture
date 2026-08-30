// Rewrite existing lecture materials to use the /api/f/... proxy URL instead of
// the raw Supabase Storage public URL (which serves user HTML as text/plain).
// Usage: node --env-file=.env.local scripts/migrate-material-urls.mjs
import { createClient } from '@supabase/supabase-js';

const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data: rows, error } = await s.from('lectures').select('id, materials');
if (error) { console.error(error.message); process.exit(1); }

let touched = 0;
for (const row of rows) {
  const materials = row.materials || [];
  let dirty = false;
  for (const m of materials) {
    if (m?.kind === 'file' && m.storagePath) {
      const want = `/api/f/${encodeURIComponent(m.storagePath)}`;
      if (m.value !== want) {
        m.value = want;
        dirty = true;
      }
    }
  }
  if (dirty) {
    const { error: updErr } = await s.from('lectures').update({ materials }).eq('id', row.id);
    if (updErr) console.error(`update id=${row.id}:`, updErr.message);
    else { console.log(`  ✓ lecture id=${row.id}`); touched++; }
  }
}
console.log(`\nDone. rewrote ${touched} row(s).`);
