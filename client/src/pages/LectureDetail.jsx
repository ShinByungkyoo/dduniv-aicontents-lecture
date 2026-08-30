import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchLecture } from '../api.js';

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
}

export default function LectureDetail() {
  const { id } = useParams();
  const [lecture, setLecture] = useState(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError('');
    fetchLecture(id)
      .then((row) => { if (!cancelled) { setLecture(row); setActiveIdx(0); } })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  if (loading) return <main className="page">불러오는 중...</main>;
  if (error) return <main className="page"><div className="error-banner">{error}</div><Link to="/">← 목록으로</Link></main>;
  if (!lecture) return null;

  const materials = lecture.materials || [];
  const active = materials[activeIdx];

  return (
    <>
      <div className="page-title-band">
        <div className="page-title-band-inner">
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
            <span className="tag" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}>{lecture.section}</span>
            <span style={{ opacity: 0.8, fontSize: 13 }}>{formatDate(lecture.date)}</span>
          </div>
          <h1>{lecture.title}</h1>
          <p><Link to="/" style={{ color: '#fff', textDecoration: 'underline' }}>← 강의자료 목록</Link></p>
        </div>
      </div>

      <main className="page">
        {materials.length === 0 ? (
          <div className="info-banner">등록된 자료가 없습니다.</div>
        ) : (
          <div className="detail-layout">
            <aside className="material-list">
              <h3 className="card-title">자료 목록 ({materials.length}건)</h3>
              {materials.map((m, idx) => (
                <button
                  key={idx}
                  className={'material-item ' + (idx === activeIdx ? 'active' : '')}
                  onClick={() => setActiveIdx(idx)}
                >
                  <span className={'tag ' + (m.kind === 'file' ? '' : 'tag-neutral')}>
                    {m.kind === 'file' ? '파일' : 'URL'}
                  </span>
                  <span className="material-label">{m.label}</span>
                </button>
              ))}
            </aside>
            <section className="material-viewer">
              <div className="material-toolbar">
                <span className="material-title">{active.label}</span>
                <a href={active.value} target="_blank" rel="noreferrer" className="btn btn-outline" style={{ padding: '6px 14px', fontSize: 13 }}>
                  새 창에서 열기 ↗
                </a>
              </div>
              <iframe
                key={active.value}
                title={active.label}
                src={active.value}
                className="material-iframe"
                sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
              />
            </section>
          </div>
        )}
      </main>
    </>
  );
}
