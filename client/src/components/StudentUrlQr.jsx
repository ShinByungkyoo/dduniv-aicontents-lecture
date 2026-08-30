import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export default function StudentUrlQr() {
  const studentUrl = typeof window !== 'undefined' ? `${window.location.origin}/` : '';
  const [svgMarkup, setSvgMarkup] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!studentUrl) return;
    QRCode.toString(studentUrl, { type: 'svg', margin: 2, color: { dark: '#00543c', light: '#ffffff' } })
      .then(setSvgMarkup)
      .catch(() => setSvgMarkup(''));
  }, [studentUrl]);

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(studentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  return (
    <section className="card qr-card">
      <h2 className="card-title">학생 접속 QR</h2>
      <p className="qr-desc">수업 화면에 이 QR을 띄워두면 학생들이 스캔해서 강의자료 페이지로 접속할 수 있습니다.</p>
      <div className="qr-image" dangerouslySetInnerHTML={{ __html: svgMarkup }} />
      <div className="qr-url">{studentUrl}</div>
      <button className="btn btn-outline" onClick={copyUrl}>{copied ? '✓ 복사됨' : 'URL 복사'}</button>
    </section>
  );
}
