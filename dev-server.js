// Local dev entry point. Vercel executes api/index.js directly.
import app from './api/index.js';

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`[lecture-portal dev] listening on http://localhost:${PORT}`);
  if (!process.env.SUPABASE_URL) {
    console.warn('[lecture-portal dev] WARNING: SUPABASE_URL not set — API calls will fail. Run `vercel env pull .env` after linking.');
  }
});
