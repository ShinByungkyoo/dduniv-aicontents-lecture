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
    let msg = '요청 실패';
    try { const d = await res.json(); if (d?.error) msg = d.error; } catch (_e) { /* ignore */ }
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

// materials: array of { kind:'url', label, value } | { kind:'file', label, file?:File, keep?:boolean, value?, originalFilename? }
function buildFormData({ section, date, title, materials }) {
  const fd = new FormData();
  fd.append('section', section);
  fd.append('date', date);
  fd.append('title', title);

  const clientMaterials = materials.map((m, idx) => {
    if (m.kind === 'url') {
      return { kind: 'url', label: m.label, value: m.value };
    }
    if (m.file) {
      const fileKey = `file_${idx}`;
      fd.append(fileKey, m.file);
      return { kind: 'file', label: m.label, fileKey };
    }
    // existing file kept as-is (edit case)
    return {
      kind: 'file', label: m.label, keep: true,
      value: m.value, originalFilename: m.originalFilename || null,
    };
  });
  fd.append('materials', JSON.stringify(clientMaterials));
  return fd;
}

export async function createLecture(payload) {
  const res = await fetch('/api/lectures', {
    method: 'POST',
    headers: { ...authHeaders() },
    body: buildFormData(payload),
  });
  return handle(res);
}

export async function updateLecture(id, payload) {
  const res = await fetch(`/api/lectures/${id}`, {
    method: 'PUT',
    headers: { ...authHeaders() },
    body: buildFormData(payload),
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
