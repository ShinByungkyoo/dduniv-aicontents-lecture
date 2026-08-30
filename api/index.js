import express from 'express';
import cors from 'cors';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import { supabase, LECTURES_TABLE, UPLOADS_BUCKET } from '../lib/supabase.js';
import { issueToken, checkCredentials, requireAuth, verifyToken } from '../lib/auth.js';

const MAX_MATERIALS_PER_LECTURE = 10;
const VALID_SECTIONS = ['1분반', '2분반'];

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: MAX_MATERIALS_PER_LECTURE },
  fileFilter: (_req, file, cb) => {
    const ok = /\.html?$/i.test(file.originalname) || file.mimetype === 'text/html';
    if (!ok) return cb(new Error('HTML 파일만 업로드할 수 있습니다.'));
    cb(null, true);
  },
});

function toRow(dbRow) {
  return {
    id: dbRow.id,
    section: dbRow.section,
    date: dbRow.date,
    title: dbRow.title,
    materials: Array.isArray(dbRow.materials) ? dbRow.materials : [],
    created_at: dbRow.created_at,
  };
}

async function referencedStoragePaths(excludeIds = []) {
  const { data, error } = await supabase.from(LECTURES_TABLE).select('id, materials');
  if (error) throw error;
  const set = new Set();
  for (const row of data || []) {
    if (excludeIds.includes(row.id)) continue;
    const arr = Array.isArray(row.materials) ? row.materials : [];
    for (const m of arr) {
      if (m?.kind === 'file' && m.storagePath) set.add(m.storagePath);
    }
  }
  return set;
}

async function deleteUnreferencedFiles(materials, referenced) {
  const paths = [];
  for (const m of materials || []) {
    if (m?.kind === 'file' && m.storagePath && !referenced.has(m.storagePath)) {
      paths.push(m.storagePath);
    }
  }
  if (paths.length === 0) return;
  const { error } = await supabase.storage.from(UPLOADS_BUCKET).remove(paths);
  if (error) console.warn('[storage] remove failed:', error.message);
}

async function uploadFile(file) {
  const ext = path.extname(file.originalname) || '.html';
  const stem = crypto.randomBytes(8).toString('hex');
  const objectPath = `${Date.now()}-${stem}${ext}`;

  const isHtml = /\.html?$/i.test(file.originalname);
  const contentType = isHtml
    ? 'text/html; charset=utf-8'
    : (file.mimetype || 'application/octet-stream');

  const { error } = await supabase.storage
    .from(UPLOADS_BUCKET)
    .upload(objectPath, file.buffer, { contentType, cacheControl: '3600', upsert: false });
  if (error) throw new Error(`업로드 실패: ${error.message}`);

  // Supabase Storage forces user-uploaded HTML to serve as text/plain (XSS mitigation).
  // We proxy through our own /api/f/... endpoint so we control the Content-Type.
  return {
    storagePath: objectPath,
    publicUrl: `/api/f/${encodeURIComponent(objectPath)}`,
  };
}

async function assembleMaterials(materialsJson, files) {
  let submitted;
  try { submitted = JSON.parse(materialsJson || '[]'); }
  catch { throw new Error('materials JSON 파싱 실패'); }
  if (!Array.isArray(submitted)) throw new Error('materials는 배열이어야 합니다.');
  if (submitted.length === 0) throw new Error('최소 하나의 자료가 필요합니다.');
  if (submitted.length > MAX_MATERIALS_PER_LECTURE) {
    throw new Error(`자료는 최대 ${MAX_MATERIALS_PER_LECTURE}개까지 등록할 수 있습니다.`);
  }

  const filesByField = new Map(files.map((f) => [f.fieldname, f]));
  const finalMaterials = [];
  for (const m of submitted) {
    if (!m || typeof m !== 'object') throw new Error('자료 항목이 올바르지 않습니다.');
    const label = String(m.label || '').trim();
    if (!label) throw new Error('자료의 라벨(제목)은 비워둘 수 없습니다.');

    if (m.kind === 'url') {
      const value = String(m.value || '').trim();
      if (!value) throw new Error(`"${label}"의 URL이 비어있습니다.`);
      finalMaterials.push({ kind: 'url', label, value });
    } else if (m.kind === 'file') {
      if (m.keep && m.value && m.storagePath) {
        finalMaterials.push({
          kind: 'file', label,
          value: m.value,
          storagePath: m.storagePath,
          originalFilename: m.originalFilename || null,
        });
      } else {
        const key = String(m.fileKey || '');
        const file = filesByField.get(key);
        if (!file) throw new Error(`"${label}"에 첨부할 파일이 누락되었습니다.`);
        const { storagePath, publicUrl } = await uploadFile(file);
        finalMaterials.push({
          kind: 'file', label,
          value: publicUrl,
          storagePath,
          originalFilename: file.originalname,
        });
      }
    } else {
      throw new Error('자료 종류(kind)는 url 또는 file 이어야 합니다.');
    }
  }
  return finalMaterials;
}

// Serve user-uploaded HTML with the correct Content-Type. We proxy from Supabase
// Storage because Supabase itself refuses to serve user HTML as text/html (XSS
// mitigation) and always returns text/plain.
app.get('/api/f/:path(*)', async (req, res, next) => {
  try {
    const objectPath = decodeURIComponent(req.params.path || '');
    if (!objectPath || objectPath.includes('..')) {
      return res.status(400).json({ error: '잘못된 경로입니다.' });
    }
    const { data, error } = await supabase.storage.from(UPLOADS_BUCKET).download(objectPath);
    if (error || !data) return res.status(404).json({ error: '파일을 찾을 수 없습니다.' });

    const isHtml = /\.html?$/i.test(objectPath);
    res.setHeader('Content-Type', isHtml ? 'text/html; charset=utf-8' : 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    const buf = Buffer.from(await data.arrayBuffer());
    res.status(200).send(buf);
  } catch (err) { next(err); }
});

app.post('/api/login', (req, res) => {
  const { id, pw } = req.body || {};
  if (!checkCredentials(id, pw)) {
    return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
  }
  const { token, expiresAt } = issueToken();
  res.json({ token, expiresAt });
});

app.post('/api/logout', requireAuth, (_req, res) => {
  // Stateless token — client just discards it.
  res.json({ ok: true });
});

app.get('/api/lectures', async (req, res, next) => {
  try {
    const { section, q, from, to } = req.query;
    let query = supabase.from(LECTURES_TABLE)
      .select('id, section, date, title, materials, created_at')
      .order('date', { ascending: false })
      .order('id', { ascending: false });
    if (section && VALID_SECTIONS.includes(section)) query = query.eq('section', section);
    if (q && String(q).trim()) query = query.ilike('title', `%${String(q).trim()}%`);
    if (from) query = query.gte('date', String(from));
    if (to)   query = query.lte('date', String(to));
    const { data, error } = await query;
    if (error) throw error;
    res.json((data || []).map(toRow));
  } catch (err) { next(err); }
});

app.get('/api/lectures/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { data, error } = await supabase.from(LECTURES_TABLE)
      .select('id, section, date, title, materials, created_at').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: '강의를 찾을 수 없습니다.' });
    res.json(toRow(data));
  } catch (err) { next(err); }
});

app.post('/api/lectures', requireAuth, upload.any(), async (req, res, next) => {
  try {
    const { section, date, title, materials } = req.body;
    if (!section || !date || !title) {
      return res.status(400).json({ error: '분반, 날짜, 타이틀은 필수입니다.' });
    }
    const sectionsToInsert =
      section === '전체' ? [...VALID_SECTIONS]
      : VALID_SECTIONS.includes(section) ? [section]
      : null;
    if (!sectionsToInsert) return res.status(400).json({ error: '분반 값이 올바르지 않습니다.' });

    const finalMaterials = await assembleMaterials(materials, req.files || []);
    const rows = sectionsToInsert.map((sec) => ({
      section: sec, date, title: title.trim(), materials: finalMaterials,
    }));
    const { data, error } = await supabase.from(LECTURES_TABLE)
      .insert(rows)
      .select('id, section, date, title, materials, created_at');
    if (error) throw error;
    const created = (data || []).map(toRow);
    res.status(201).json(created.length === 1 ? created[0] : { created });
  } catch (err) { next(err); }
});

app.put('/api/lectures/:id', requireAuth, upload.any(), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { data: existing, error: e0 } = await supabase.from(LECTURES_TABLE)
      .select('id, materials').eq('id', id).maybeSingle();
    if (e0) throw e0;
    if (!existing) return res.status(404).json({ error: '강의를 찾을 수 없습니다.' });

    const { section, date, title, materials } = req.body;
    if (!section || !date || !title) {
      return res.status(400).json({ error: '분반, 날짜, 타이틀은 필수입니다.' });
    }
    if (!VALID_SECTIONS.includes(section)) {
      return res.status(400).json({ error: '분반 값이 올바르지 않습니다. (수정 시 개별 분반만 지정 가능)' });
    }

    const finalMaterials = await assembleMaterials(materials, req.files || []);
    const oldMaterials = Array.isArray(existing.materials) ? existing.materials : [];
    const keptPaths = new Set(finalMaterials.filter((m) => m.kind === 'file').map((m) => m.storagePath));
    const orphaned = oldMaterials.filter((m) => m.kind === 'file' && m.storagePath && !keptPaths.has(m.storagePath));
    const otherRefs = await referencedStoragePaths([id]);
    await deleteUnreferencedFiles(orphaned, otherRefs);

    const { data, error } = await supabase.from(LECTURES_TABLE)
      .update({ section, date, title: title.trim(), materials: finalMaterials })
      .eq('id', id)
      .select('id, section, date, title, materials, created_at')
      .maybeSingle();
    if (error) throw error;
    res.json(toRow(data));
  } catch (err) { next(err); }
});

app.delete('/api/lectures/:id', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { data: existing, error: e0 } = await supabase.from(LECTURES_TABLE)
      .select('id, materials').eq('id', id).maybeSingle();
    if (e0) throw e0;
    if (!existing) return res.status(404).json({ error: '강의를 찾을 수 없습니다.' });

    const materials = Array.isArray(existing.materials) ? existing.materials : [];
    const { error: delErr } = await supabase.from(LECTURES_TABLE).delete().eq('id', id);
    if (delErr) throw delErr;
    const otherRefs = await referencedStoragePaths([]);
    await deleteUnreferencedFiles(materials, otherRefs);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(400).json({ error: err.message || '요청을 처리할 수 없습니다.' });
});

export default app;
