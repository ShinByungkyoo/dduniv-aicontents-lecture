import { useEffect, useMemo, useState } from 'react';
import { fetchLectures, createLecture, updateLecture, deleteLecture } from '../api.js';
import StudentUrlQr from '../components/StudentUrlQr.jsx';

const MAX_MATERIALS = 10;
const SECTION_OPTIONS = ['1분반', '2분반', '전체'];
const emptyMaterial = (kind = 'url') => ({ kind, label: '', value: '', file: null });
const emptyForm = () => ({
  section: '전체',
  date: '',
  title: '',
  materials: [emptyMaterial('url')],
});

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

export default function AdminDashboard() {
  const [lectures, setLectures] = useState([]);
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const filterParams = useMemo(() => ({
    q: q.trim() || undefined,
    from: from || undefined,
    to: to || undefined,
  }), [q, from, to]);

  const load = () => {
    fetchLectures(filterParams).then(setLectures).catch((e) => setError(e.message));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filterParams]);

  const resetForm = () => { setForm(emptyForm()); setEditingId(null); };

  const setMaterial = (idx, patch) => {
    setForm((f) => ({
      ...f,
      materials: f.materials.map((m, i) => (i === idx ? { ...m, ...patch } : m)),
    }));
  };
  const addMaterial = () => {
    setForm((f) => f.materials.length >= MAX_MATERIALS ? f : ({ ...f, materials: [...f.materials, emptyMaterial('url')] }));
  };
  const removeMaterial = (idx) => {
    setForm((f) => ({ ...f, materials: f.materials.filter((_, i) => i !== idx) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setOk(''); setSubmitting(true);
    try {
      if (form.materials.length === 0) throw new Error('최소 하나의 자료를 추가하세요.');
      for (const [i, m] of form.materials.entries()) {
        if (!m.label.trim()) throw new Error(`${i + 1}번째 자료의 라벨을 입력하세요.`);
        if (m.kind === 'url' && !m.value.trim()) throw new Error(`${i + 1}번째 자료의 URL을 입력하세요.`);
        if (m.kind === 'file' && !m.file && !m.value) throw new Error(`${i + 1}번째 자료의 파일을 선택하세요.`);
      }
      if (editingId) {
        await updateLecture(editingId, form);
        setOk('강의를 수정했습니다.');
      } else {
        await createLecture(form);
        setOk('강의를 등록했습니다.');
      }
      resetForm();
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (row) => {
    setEditingId(row.id);
    setForm({
      section: row.section,
      date: row.date,
      title: row.title,
      materials: (row.materials || []).map((m) => (
        m.kind === 'url'
          ? { kind: 'url', label: m.label, value: m.value, file: null }
          : { kind: 'file', label: m.label, value: m.value, originalFilename: m.originalFilename, file: null }
      )),
    });
    setOk(''); setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`"${row.title}" 강의를 삭제하시겠습니까?`)) return;
    setError(''); setOk('');
    try {
      await deleteLecture(row.id);
      setOk('강의를 삭제했습니다.');
      if (editingId === row.id) resetForm();
      load();
    } catch (err) { setError(err.message); }
  };

  return (
    <>
      <div className="page-title-band">
        <div className="page-title-band-inner">
          <h1>관리자 페이지</h1>
          <p>강의 자료를 등록하고 관리합니다. (교수 전용)</p>
        </div>
      </div>

      <main className="page">
        <div className="admin-grid">
          <div className="admin-side">
            <section className="card">
              <h2 className="card-title">{editingId ? '강의 수정' : '강의 등록'}</h2>
            {error && <div className="error-banner">{error}</div>}
            {ok && <div className="ok-banner">{ok}</div>}

            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="field">
                  <label>분반<span className="req">*</span></label>
                  <select value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} required disabled={!!editingId}>
                    {SECTION_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  {!editingId && form.section === '전체' && (
                    <span className="hint">'전체' 선택 시 1분반·2분반에 동시에 등록됩니다.</span>
                  )}
                  {editingId && (
                    <span className="hint">수정 시 분반은 변경할 수 없습니다. (개별 강의만 편집)</span>
                  )}
                </div>
                <div className="field">
                  <label>날짜<span className="req">*</span></label>
                  <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
                </div>
              </div>

              <div className="field">
                <label>강의 타이틀<span className="req">*</span></label>
                <input
                  type="text" value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="예) 3주차 - 프롬프트 엔지니어링 기초" required
                />
              </div>

              <div className="materials-block">
                <div className="materials-header">
                  <span>강의 자료<span className="req">*</span></span>
                  <button
                    type="button" className="btn btn-outline"
                    style={{ padding: '4px 12px', fontSize: 12 }}
                    onClick={addMaterial}
                    disabled={form.materials.length >= MAX_MATERIALS}
                  >
                    + 자료 추가 ({form.materials.length}/{MAX_MATERIALS})
                  </button>
                </div>

                {form.materials.map((m, idx) => (
                  <div className="material-row" key={idx}>
                    <div className="material-row-head">
                      <select
                        value={m.kind}
                        onChange={(e) => setMaterial(idx, { kind: e.target.value, value: '', file: null })}
                      >
                        <option value="url">URL</option>
                        <option value="file">파일</option>
                      </select>
                      <input
                        type="text" value={m.label} placeholder="라벨 (예: 슬라이드)"
                        onChange={(e) => setMaterial(idx, { label: e.target.value })}
                      />
                      {form.materials.length > 1 && (
                        <button type="button" className="btn-icon-remove" onClick={() => removeMaterial(idx)} title="삭제">×</button>
                      )}
                    </div>
                    {m.kind === 'url' ? (
                      <input
                        type="url" value={m.value} placeholder="https://..."
                        onChange={(e) => setMaterial(idx, { value: e.target.value })}
                      />
                    ) : (
                      <div>
                        {m.value && !m.file && (
                          <div className="existing-file">
                            현재: {m.originalFilename || m.value.split('/').pop()}
                            <span className="hint" style={{ marginLeft: 8 }}>새 파일 선택 시 교체됩니다</span>
                          </div>
                        )}
                        <input
                          type="file"
                          accept=".html,.htm,.ppt,.pptx"
                          onChange={(e) => setMaterial(idx, { file: e.target.files?.[0] || null })}
                        />
                        <div className="hint" style={{ marginTop: 4 }}>HTML / PPT / PPTX · 최대 30MB</div>
                        {m.file && <div className="filename">선택됨: {m.file.name}</div>}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
                <button className="btn btn-primary" type="submit" disabled={submitting}>
                  {submitting ? '처리 중...' : editingId ? '수정 저장' : '강의 등록'}
                </button>
                {editingId && (
                  <button className="btn btn-outline" type="button" onClick={resetForm}>취소</button>
                )}
              </div>
            </form>
            </section>
            <StudentUrlQr />
          </div>

          <section className="card">
            <h2 className="card-title">등록된 강의 ({lectures.length}건)</h2>

            <div className="filter-bar" style={{ marginBottom: 16 }}>
              <div className="filter-field">
                <label>검색</label>
                <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="타이틀..." />
              </div>
              <div className="filter-field">
                <label>시작일</label>
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div className="filter-field">
                <label>종료일</label>
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            </div>

            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: 110 }}>날짜</th>
                  <th style={{ width: 80 }}>분반</th>
                  <th>타이틀</th>
                  <th style={{ width: 70 }}>자료</th>
                  <th style={{ width: 130 }}></th>
                </tr>
              </thead>
              <tbody>
                {lectures.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', color: 'var(--dd-muted)', padding: '40px 12px' }}>
                      등록된 강의가 없습니다.
                    </td>
                  </tr>
                ) : (
                  lectures.map((row) => (
                    <tr key={row.id}>
                      <td>{formatDate(row.date)}</td>
                      <td><span className="tag">{row.section}</span></td>
                      <td>{row.title}</td>
                      <td><span className="tag tag-neutral">{row.materials?.length ?? 0}</span></td>
                      <td>
                        <div className="row-actions">
                          <button onClick={() => handleEdit(row)}>수정</button>
                          <button className="danger" onClick={() => handleDelete(row)}>삭제</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>
        </div>
      </main>
    </>
  );
}
