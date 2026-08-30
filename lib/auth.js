import crypto from 'crypto';

const ADMIN_ID = process.env.ADMIN_ID || 'snownoon';
const ADMIN_PW = process.env.ADMIN_PW || 'snownoon';
const AUTH_SECRET = process.env.AUTH_SECRET || 'dev-only-insecure-secret-change-me';
const SESSION_HOURS = Number(process.env.SESSION_HOURS || 24);

function sign(payload) {
  return crypto.createHmac('sha256', AUTH_SECRET).update(payload).digest('hex');
}

function safeEqual(a, b) {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// Stateless token: base64url(expiresAt).<hmac>
export function issueToken() {
  const expiresAt = Date.now() + SESSION_HOURS * 60 * 60 * 1000;
  const body = Buffer.from(String(expiresAt), 'utf8').toString('base64url');
  const mac = sign(body);
  return { token: `${body}.${mac}`, expiresAt };
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string') return false;
  const [body, mac] = token.split('.');
  if (!body || !mac) return false;
  if (!safeEqual(mac, sign(body))) return false;
  const expStr = Buffer.from(body, 'base64url').toString('utf8');
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() > exp) return false;
  return true;
}

export function checkCredentials(id, pw) {
  return id === ADMIN_ID && pw === ADMIN_PW;
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!verifyToken(token)) {
    return res.status(401).json({ error: '세션이 만료되었거나 인증이 필요합니다.' });
  }
  next();
}
