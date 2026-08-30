import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchLecture } from '../api.js';

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
}

function kindLabel(m) {
  if (m.kind === 'url') return 'URL';
  const name = m.originalFilename || m.value || '';
  if (/\.pptx?$/i.test(name)) return 'PPT';
  if (/\.html?$/i.test(name)) return 'HTML';
  return '파일';
}

export default function LectureDetail() {
  const { id } = useParams();
  const [lecture, setLecture] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError('');
    fetchLecture(id)
      .then((row) => { if (!cancelled) setLecture(row); })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  if (loading) return <main className="page">불러오는 중...</main>;
  if (error) return <main className="page"><div className="error-banner">{error}</div><Link to="/">← 목록으로</Link></main>;
  if (!lecture) return null;

  const materials = lecture.materials || [];

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
          <section className="card">
            <h2 className="card-title">자료 목록 ({materials.length}건)</h2>
            <ul className="material-open-list">
              {materials.map((m, idx) => (
                <li key={idx} className="material-open-item">
                  <span className={'tag ' + (m.kind === 'file' ? '' : 'tag-neutral')}>{kindLabel(m)}</span>
                  <div className="material-open-info">
                    <div className="material-open-label">{m.label}</div>
                    {m.originalFilename && (
                      <div className="material-open-filename">{m.originalFilename}</div>
                    )}
                  </div>
                  <a
                    href={m.value}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-primary"
                  >열기 ↗</a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </>
  );
}
