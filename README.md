# 동덕여자대학교 강의자료실 (lecture-portal)

교수가 강의 자료를 등록하면, 학생이 로그인 없이 분반별로 열람할 수 있는 강의자료 포털.

## 스택
- Backend: Node.js 22+ (`node:sqlite` 내장, `--env-file-if-exists`) + Express + multer
- Frontend: React 19 + Vite + React Router + qrcode
- 디자인: 동덕여자대학교 웹사이트 룩앤필 (딥그린 `#00543C`, 미니멀/클래식)

## 최초 설치
```powershell
npm run install:all
```

## 개발 실행 (백엔드 + 프론트엔드 동시)
```powershell
npm run dev
```
- Frontend: http://localhost:5173
- Backend:  http://localhost:4000

Vite dev server는 `/api`와 `/uploads` 요청을 4000번 백엔드로 프록시합니다.

## 관리자(교수) 로그인
- URL: http://localhost:5173/admin/login
- 자격증명은 `server/.env` 파일에서 설정합니다. `server/.env.example`을 복사해 사용하세요.
- `.env`가 없으면 개발용 기본값(`server/index.js` 상단 상수)이 사용됩니다.
- 세션 토큰은 기본 24시간(`SESSION_HOURS`)에 만료되며, 만료 시 자동으로 로그인 화면으로 이동합니다.

## 데이터 저장 위치
- SQLite: `server/data.db` (Phase 1→2→3 자동 마이그레이션)
- 업로드 파일: `server/uploads/`
- 두 항목과 `server/.env` 모두 `.gitignore`에 포함되어 있어 커밋되지 않습니다.

## 스탠드얼론 데모
`standalone/index.html`을 브라우저로 열면 서버 없이 localStorage 기반으로 동일한 UI를 체험할 수 있습니다. 자료·파일 업로드·QR 모두 동일하게 동작합니다.

## 주요 기능 (Phase 1 → 3)
- **분반**: 1분반 / 2분반 (관리자 등록 시 '전체' 선택 시 양쪽에 동시 생성 — 첨부 파일은 참조 카운팅으로 안전 삭제)
- **자료 다중 첨부**: 강의 1건에 URL + 파일 혼합 최대 10개
- **상세 페이지**: `/lectures/:id` 좌측 자료 목록 + 우측 iframe 인라인 프리뷰
- **검색 & 날짜 범위 필터** (학생/관리자 양쪽)
- **QR 코드**: 관리자 페이지에 학생 접속 URL의 QR 표시 (수업 화면 공유용)
- **모바일 반응형**: 640px 이하 헤더 축소·테이블 가로 스크롤

## API 요약
| Method | Path | Auth | 설명 |
| :--- | :--- | :--- | :--- |
| POST | `/api/login` | - | 로그인 (JSON `{id, pw}` → `{token, expiresAt}`) |
| POST | `/api/logout` | ✅ | 토큰 폐기 |
| GET | `/api/lectures?section=&q=&from=&to=` | - | 목록 조회 (필터 옵션) |
| GET | `/api/lectures/:id` | - | 상세 조회 |
| POST | `/api/lectures` | ✅ | 등록 (multipart; `section='전체'` 지원) |
| PUT | `/api/lectures/:id` | ✅ | 수정 (개별 분반만) |
| DELETE | `/api/lectures/:id` | ✅ | 삭제 (다른 강의에서 참조 안 하는 파일만 실제 제거) |
