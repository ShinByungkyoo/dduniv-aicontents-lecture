import { Routes, Route, Link, NavLink, Navigate, useNavigate } from 'react-router-dom';
import StudentView from './pages/StudentView.jsx';
import LectureDetail from './pages/LectureDetail.jsx';
import AdminLogin from './pages/AdminLogin.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import { isLoggedIn, logout } from './api.js';

function Header() {
  const navigate = useNavigate();
  const loggedIn = isLoggedIn();
  const handleLogout = async () => { await logout(); navigate('/'); };
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link to="/" className="site-brand">
          <div className="site-brand-mark">동덕</div>
          <div className="site-brand-text">
            <span className="site-brand-title">동덕여자대학교 강의자료실</span>
            <span className="site-brand-sub">DONGDUK WOMEN'S UNIVERSITY · LECTURE PORTAL</span>
          </div>
        </Link>
        <nav className="site-nav">
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>강의자료</NavLink>
          {loggedIn ? (
            <>
              <NavLink to="/admin" className={({ isActive }) => (isActive ? 'active' : '')}>관리자</NavLink>
              <button className="btn-outline" onClick={handleLogout}>로그아웃</button>
            </>
          ) : (
            <Link to="/admin/login" className="btn-outline">교수 로그인</Link>
          )}
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  return <footer className="site-footer">© 동덕여자대학교 AI콘텐츠제작 · 강의자료 공유 포털</footer>;
}

function RequireAuth({ children }) {
  if (!isLoggedIn()) return <Navigate to="/admin/login" replace />;
  return children;
}

export default function App() {
  return (
    <>
      <Header />
      <Routes>
        <Route path="/" element={<StudentView />} />
        <Route path="/lectures/:id" element={<LectureDetail />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<RequireAuth><AdminDashboard /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Footer />
    </>
  );
}
