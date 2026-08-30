const TOKEN_KEY = 'lp_admin_token';

export function getToken() { return localStorage.getItem(TOKEN_KEY); }
export function setToken(t) { localStorage.setItem(TOKEN_KEY, t); }
export function clearToken() { localStorage.removeItem(TOKEN_KEY); }
export function isLoggedIn() { return !!getToken(); }

async function handle(res) {
  if (res.status === 401) {
    clearToken();
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/admin/login')) {
      window.location.assign('/admin/login');
    }
    throw new Error('세션이 만료되었습니다. 다시 로그인해 주세요.');
  }
  if (!res.ok) {
    let msg = `요청 실패 (${res.status})`;
    try {
      const d = await res.json();
      if (d?.error) msg = d.error;
    } catch (_e) {
      try {
        const text = await res.text();
        if (text) msg = `요청 실패 (${res.status}): ${text.slice(0, 200)}`;
      } catch (_e2) { /* ignore */ }
    }
    throw new Error(msg);
  }
  return res.json();
}

function authHeaders() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export async function login(id, pw) {
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, pw }),
  });
  return handle(res);
}

export async function logout() {
  try { await fetch('/api/logout', { method: 'POST', headers: { ...authHeaders() } }); }
  catch (_e) { /* ignore */ }
  clearToken();
}

export async function fetchLectures({ section, q, from, to } = {}) {
  const params = new URLSearchParams();
  if (section) params.set('section', section);
  if (q) params.set('q', q);
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const qs = params.toString();
  const res = await fetch('/api/lectures' + (qs ? `?${qs}` : ''));
  return handle(res);
}

export async function fetchLecture(id) {
  const res = await fetch(`/api/lectures/${id}`);
  return handle(res);
}

// Request a signed upload URL from the server, then PUT the file directly to
// Supabase Storage. Returns the storagePath that identifies the uploaded object.
async function uploadFileDirect(file, onProgress) {
  const meta = await handle(await fetch('/api/upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ filename: file.name }),
  }));

  // Use XHR so we can report progress (fetch doesn't natively support upload progress).
  await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', meta.signedUrl);
    xhr.setRequestHeader('Content-Type', meta.contentType);
    xhr.upload.onprogress = (e) => {
      if (onProgress && e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Supabase 업로드 실패 (${xhr.status}): ${xhr.responseText?.slice(0, 200) || ''}`));
    };
    xhr.onerror = () => reject(new Error('네트워크 오류로 업로드가 중단되었습니다.'));
    xhr.send(file);
  });

  return { storagePath: meta.storagePath, originalFilename: file.name };
}

// materials: array of client-side items:
//   { kind:'url', label, value }
//   { kind:'file', label, file:File }            (new file)
//   { kind:'file', label, keep:true, storagePath, value, originalFilename }  (edit-preserving)
async function buildRequestBody({ section, date, title, materials }, onProgress) {
  const final = [];
  const total = materials.filter((m) => m.file).length;
  let done = 0;
  for (const m of materials) {
    if (m.kind === 'url') {
      final.push({ kind: 'url', label: m.label, value: m.value });
    } else if (m.kind === 'file') {
      if (m.file) {
        const { storagePath, originalFilename } = await uploadFileDirect(m.file, (p) => {
          if (onProgress) onProgress({ index: done, filename: m.file.name, progress: p });
        });
        done++;
        if (onProgress) onProgress({ index: done, filename: m.file.name, progress: 1, done, total });
        final.push({ kind: 'file', label: m.label, storagePath, originalFilename });
      } else {
        final.push({
          kind: 'file', label: m.label, keep: true,
          storagePath: m.storagePath, value: m.value,
          originalFilename: m.originalFilename || null,
        });
      }
    }
  }
  return { section, date, title, materials: final };
}

export async function createLecture(payload, onProgress) {
  const body = await buildRequestBody(payload, onProgress);
  const res = await fetch('/api/lectures', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  });
  return handle(res);
}

export async function updateLecture(id, payload, onProgress) {
  const body = await buildRequestBody(payload, onProgress);
  const res = await fetch(`/api/lectures/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  });
  return handle(res);
}

export async function deleteLecture(id) {
  const res = await fetch(`/api/lectures/${id}`, {
    method: 'DELETE',
    headers: { ...authHeaders() },
  });
  return handle(res);
}
