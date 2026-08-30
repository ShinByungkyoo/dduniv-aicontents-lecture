import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchLectures } from '../api.js';

const SECTIONS = ['전체', '1분반', '2분반'];

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

export default function StudentView() {
  const [section, setSection] = useState('전체');
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [lectures, setLectures] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const params = useMemo(() => ({
    section: section === '전체' ? undefined : section,
    q: q.trim() || undefined,
    from: from || undefined,
    to: to || undefined,
  }), [section, q, from, to]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError('');
    const t = setTimeout(() => {
      fetchLectures(params)
        .then((rows) => { if (!cancelled) setLectures(rows); })
        .catch((e) => { if (!cancelled) setError(e.message); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 200);
    return () => { cancelled = true; clearTimeout(t); };
  }, [params]);

  const resetFilters = () => { setQ(''); setFrom(''); setTo(''); };

  return (
    <>
      <div className="page-title-band">
        <div className="page-title-band-inner">
          <h1>강의자료</h1>
          <p>수업 중 안내된 강의자료를 분반별로 확인할 수 있습니다.</p>
        </div>
      </div>

      <main className="page">
        <div className="section-tabs">
          {SECTIONS.map((s) => (
            <button
              key={s}
              className={'section-tab ' + (section === s ? 'active' : '')}
              onClick={() => setSection(s)}
            >{s}</button>
          ))}
        </div>

        <div className="filter-bar">
          <div className="filter-field">
            <label>검색</label>
            <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="타이틀 검색..." />
          </div>
          <div className="filter-field">
            <label>시작일</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="filter-field">
            <label>종료일</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          {(q || from || to) && (
            <button className="btn btn-outline" style={{ padding: '8px 14px' }} onClick={resetFilters}>초기화</button>
          )}
        </div>

        {error && <div className="error-banner">{error}</div>}

        <table className="lecture-table">
          <thead>
            <tr>
              <th className="col-date">날짜</th>
              <th className="col-section">분반</th>
              <th className="col-title">강의 타이틀</th>
              <th style={{ width: 90 }}>자료</th>
              <th className="col-open">상세보기</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr className="empty-row"><td colSpan={5}>불러오는 중...</td></tr>
            ) : lectures.length === 0 ? (
              <tr className="empty-row"><td colSpan={5}>조건에 맞는 강의가 없습니다.</td></tr>
            ) : (
              lectures.map((row) => (
                <tr key={row.id}>
                  <td className="col-date">{formatDate(row.date)}</td>
                  <td className="col-section"><span className="tag">{row.section}</span></td>
                  <td className="col-title">
                    <Link to={`/lectures/${row.id}`} className="lecture-title-link">{row.title}</Link>
                  </td>
                  <td>
                    <span className="tag tag-neutral">{row.materials?.length ?? 0}개</span>
                  </td>
                  <td className="col-open">
                    <Link
                      to={`/lectures/${row.id}`}
                      className="btn btn-outline"
                      style={{ padding: '6px 14px', fontSize: 13 }}
                    >열기</Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </main>
    </>
  );
}
