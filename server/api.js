/* =====================================================================
   Manar BD – ব্যাকএন্ড (API)।
   একই কোড দুই জায়গায় চলে:
     1) Cloudflare Pages Functions (ডাটাবেস = Cloudflare D1)
     2) নিজের ফোন/কম্পিউটারে লোকাল সার্ভার (server/dev.js, ডাটাবেস = SQLite ফাইল)
   বাইরের কোনো প্যাকেজ লাগে না।
   ===================================================================== */
import { SEED_PRODUCTS, SEED_SETTINGS } from './seed.js';

class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const bad = (m, s) => new HttpError(s || 400, m);

/* ---------- ছোট হেল্পার ---------- */
const enc = new TextEncoder();
const now = () => Date.now();
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });
const b64 = (bytes) => { let s = ''; for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192)); return btoa(s); };
const unb64 = (str) => { const s = atob(str), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
const b64url = (bytes) => b64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const rand = (n) => crypto.getRandomValues(new Uint8Array(n));
const hex = (buf) => [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('');
const sha = async (s) => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
const toEn = (s) => String(s).replace(/[০-৯]/g, (d) => String(d.charCodeAt(0) - 0x09E6));
const str = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
const int = (v, min, max) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : null; };

/* ---------- পাসওয়ার্ড (PBKDF2, Cloudflare এ সর্বোচ্চ 100000 রাউন্ড চলে) ---------- */
const ITER = 100000;
async function hashPw(pw, salt) {
  salt = salt || rand(16);
  const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITER }, key, 256);
  return `pbkdf2$${ITER}$${b64(salt)}$${b64(new Uint8Array(bits))}`;
}
async function checkPw(pw, stored) {
  const p = String(stored).split('$'); if (p[0] !== 'pbkdf2') return false;
  const again = await hashPw(pw, unb64(p[2])), a = again.split('$')[3], b = p[3];
  let d = a.length ^ b.length; for (let i = 0; i < Math.min(a.length, b.length); i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/* ---------- ইমেল/ফোন যাচাই ---------- */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
function normPhone(v) {
  let p = toEn(v).replace(/[\s\-()]/g, '');
  p = p.replace(/^\+?88/, '');
  return /^01[3-9]\d{8}$/.test(p) ? p : null;
}
function parseLogin(v) {
  v = str(v, 120);
  if (v.includes('@')) { v = v.toLowerCase(); if (!EMAIL.test(v)) throw bad('Please enter a valid email address.'); return { email: v, phone: null }; }
  const p = normPhone(v); if (!p) throw bad('Enter a valid email or an 11-digit mobile number (e.g. 01712345678).');
  return { email: null, phone: p };
}

/* ---------- ডাটাবেস স্কিমা (প্রথম রিকোয়েস্টে নিজে তৈরি হয়) ---------- */
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT UNIQUE, phone TEXT UNIQUE, hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'customer', avatar TEXT, dist TEXT, address TEXT, created INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id INTEGER NOT NULL, exp INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, data TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, pos INTEGER NOT NULL DEFAULT 0, updated INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT, number TEXT UNIQUE NOT NULL, user_id INTEGER, name TEXT, phone TEXT, dist TEXT, address TEXT, note TEXT, items TEXT NOT NULL, subtotal INTEGER, discount INTEGER, delivery INTEGER, total INTEGER, promo TEXT, via TEXT, status TEXT NOT NULL DEFAULT 'pending', admin_note TEXT, created INTEGER NOT NULL, updated INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS settings (k TEXT PRIMARY KEY, v TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS images (id TEXT PRIMARY KEY, mime TEXT NOT NULL, b64 TEXT NOT NULL, created INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS attempts (k TEXT NOT NULL, ts INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, day TEXT NOT NULL, t TEXT NOT NULL, vid TEXT NOT NULL, uid INTEGER, pid TEXT, src TEXT, created INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS ev_day ON events (day, t)`,
  `CREATE INDEX IF NOT EXISTS i_orders_user ON orders(user_id)`,
  `CREATE INDEX IF NOT EXISTS i_orders_status ON orders(status)`,
  `CREATE TABLE IF NOT EXISTS blocked (phone TEXT PRIMARY KEY, note TEXT, created INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS i_attempts ON attempts(k, ts)`
];
const SCHEMA_V = '15';
const ready = new WeakMap();
function ensureReady(db) {
  if (!ready.has(db)) {
    ready.set(db, (async () => {
      // দ্রুত পথ: স্কিমা আগেই তৈরি থাকলে একটি মাত্র কোয়েরিতেই শেষ
      try { const v = await db.prepare(`SELECT v FROM settings WHERE k='schema'`).first(); if (v && v.v === SCHEMA_V) return; } catch (e) { /* টেবিল এখনও নেই */ }
      await db.batch(SCHEMA.map((s) => db.prepare(s)));
      try { await db.prepare(`ALTER TABLE orders ADD COLUMN track_url TEXT`).run(); } catch (e) { /* কলাম আগেই আছে */ }
      try { await db.prepare(`ALTER TABLE orders ADD COLUMN loy INTEGER DEFAULT 0`).run(); } catch (e) { /* কলাম আগেই আছে */ }
      try { await db.prepare(`ALTER TABLE orders ADD COLUMN risk INTEGER DEFAULT 0`).run(); } catch (e) { /* কলাম আগেই আছে */ }
      try { await db.prepare(`ALTER TABLE orders ADD COLUMN risk_note TEXT`).run(); } catch (e) { /* কলাম আগেই আছে */ }
      try { await db.prepare(`ALTER TABLE users ADD COLUMN pw_req INTEGER`).run(); } catch (e) { /* কলাম আগেই আছে */ }
      const seeded = await db.prepare(`SELECT v FROM settings WHERE k='seeded'`).first();
      if (!seeded) {
        const st = [];
        SEED_PRODUCTS.forEach((p, i) => st.push(db.prepare(`INSERT OR IGNORE INTO products (id,data,active,pos,updated) VALUES (?,?,1,?,?)`).bind(p.id, JSON.stringify(p), i + 1, now())));
        Object.keys(SEED_SETTINGS).forEach((k) => st.push(db.prepare(`INSERT OR IGNORE INTO settings (k,v) VALUES (?,?)`).bind(k, JSON.stringify(SEED_SETTINGS[k]))));
        st.push(db.prepare(`INSERT OR IGNORE INTO settings (k,v) VALUES ('seeded','1')`));
        await db.batch(st);
      }
      await db.prepare(`INSERT INTO settings (k,v) VALUES ('schema',?) ON CONFLICT(k) DO UPDATE SET v=excluded.v`).bind(SCHEMA_V).run();
    })().catch((e) => { ready.delete(db); throw e; }));
  }
  return ready.get(db);
}

/* ---------- সেটিংস ---------- */
async function getSetting(db, k) { const r = await db.prepare(`SELECT v FROM settings WHERE k=?`).bind(k).first(); return r ? JSON.parse(r.v) : SEED_SETTINGS[k]; }
const setSetting = (db, k, v) => db.prepare(`INSERT INTO settings (k,v) VALUES (?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v`).bind(k, JSON.stringify(v)).run();

/* ---------- অফারের তারিখ (বাংলাদেশ সময়) ---------- */
function dhakaDate() { return new Date(Date.now() + 6 * 3600 * 1000).toISOString().slice(0, 10); }
function offerOn(o) {
  if (!o || !o.enabled) return false; const t = dhakaDate();
  if (o.startDate && t < o.startDate) return false; if (o.endDate && t > o.endDate) return false; return true;
}

/* ---------- রেট লিমিট ---------- */
async function tooMany(db, key, max, windowMs) {
  const r = await db.prepare(`SELECT COUNT(*) AS n FROM attempts WHERE k=? AND ts>?`).bind(key, now() - windowMs).first();
  return (r ? r.n : 0) >= max;
}
const noteAttempt = (db, key) => db.prepare(`INSERT INTO attempts (k,ts) VALUES (?,?)`).bind(key, now()).run();

/* ---------- সেশন ও ইউজার ---------- */
const COOKIE = 'mb_sid';
function getCookie(req, name) {
  const m = (req.headers.get('cookie') || '').split(/;\s*/).find((c) => c.startsWith(name + '='));
  return m ? decodeURIComponent(m.slice(name.length + 1)) : '';
}
function cookieHeader(req, token, maxAge) {
  const secure = new URL(req.url).protocol === 'https:' || req.headers.get('x-forwarded-proto') === 'https';
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}
const ownerList = (env) => String(env.OWNER_LOGIN || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
async function maybeOwner(env, db, u) {
  if (!u || u.role === 'owner') return u;
  const mine = [u.email, u.phone].filter(Boolean).map((s) => s.toLowerCase());
  let make = ownerList(env).some((x) => mine.includes(x) || (normPhone(x) && mine.includes(normPhone(x))));
  if (!make && env.DEV_FIRST_OWNER) { const r = await db.prepare(`SELECT COUNT(*) AS n FROM users WHERE role='owner'`).first(); make = !r || r.n === 0; }
  if (make) { await db.prepare(`UPDATE users SET role='owner' WHERE id=?`).bind(u.id).run(); u.role = 'owner'; }
  return u;
}
async function newSession(req, db, userId) {
  const token = b64url(rand(32));
  await db.prepare(`INSERT INTO sessions (id,user_id,exp) VALUES (?,?,?)`).bind(await sha(token), userId, now() + 30 * 864e5).run();
  return cookieHeader(req, token, 30 * 86400);
}
async function currentUser(req, env, db) {
  const t = getCookie(req, COOKIE); if (!t) return null;
  const row = await db.prepare(`SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id=? AND s.exp>?`).bind(await sha(t), now()).first();
  return row ? maybeOwner(env, db, row) : null;
}
const pub = (u) => u && ({ id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, avatar: u.avatar, dist: u.dist || '', address: u.address || '' });
const isAdmin = (u) => u && (u.role === 'admin' || u.role === 'owner');

/* ---------- ছবি ---------- */
function sniff(b) {
  if (b[0] === 0xFF && b[1] === 0xD8) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return 'image/png';
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45) return 'image/webp';
  return null;
}
async function saveImage(req, db) {
  const buf = new Uint8Array(await req.arrayBuffer());
  if (!buf.length || buf.length > 1_600_000) throw bad('Image is too large (max 1.5 MB after resize).', 413);
  const mime = sniff(buf); if (!mime) throw bad('Only JPEG, PNG or WebP images are allowed.');
  const id = b64url(rand(12));
  await db.prepare(`INSERT INTO images (id,mime,b64,created) VALUES (?,?,?,?)`).bind(id, mime, b64(buf), now()).run();
  return '/api/img/' + id;
}

/* ---------- প্রোডাক্ট পরিষ্কার করা (অ্যাডমিনের পাঠানো তথ্য) ---------- */
const urlOk = (u) => /^(images\/|\/api\/img\/|https:\/\/)/.test(u) && u.length < 400;
const list = (v, n, m) => (Array.isArray(v) ? v : []).map((x) => str(x, m)).filter(Boolean).slice(0, n);
const TEXT_FIELDS = { brand: 60, model: 60, type: 60, warranty: 60, capacity: 60, watt: 60, voltage: 60, material: 60, battery: 60, light: 60, chargingTime: 60, usageTime: 60, badge: 30, short: 90, about: 1500 };
function cleanProduct(x, id) {
  const p = { id, name: str(x.name, 120) };
  if (p.name.length < 2) throw bad('Product name is required.');
  Object.keys(TEXT_FIELDS).forEach((k) => { const v = str(x[k], TEXT_FIELDS[k]); if (v) p[k] = v; });
  const vs = (Array.isArray(x.variants) ? x.variants : []).slice(0, 12).map((v) => ({ name: str(v && v.name, 40), price: int(v && v.price, 1, 10000000), old: int(v && v.old, 0, 10000000) })).filter((v) => v.name && v.price);
  vs.forEach((v) => { if (!v.old || v.old <= v.price) delete v.old; });
  if (vs.length) p.variants = vs;
  else {
    p.price = int(x.price, 1, 10000000); if (!p.price) throw bad('Price is required.');
    const o = int(x.old, 0, 10000000); if (o && o > p.price) p.old = o;
  }
  p.free = !!x.free; if (!p.free) p.charge = int(x.charge, 0, 5000) || 0;
  p.hot = !!x.hot; p.popular = !!x.popular; p.inStock = x.inStock !== false;
  p.tags = list(x.tags, 6, 24).filter((t) => /^[a-z0-9-]+$/.test(t)); if (!p.tags.length) throw bad('Choose at least one category.');
  p.gallery = list(x.gallery, 10, 400).filter(urlOk);
  if (x.img && urlOk(str(x.img, 400))) p.img = str(x.img, 400); else if (p.gallery[0]) p.img = p.gallery[0];
  if (x.imgSm && urlOk(str(x.imgSm, 400))) p.imgSm = str(x.imgSm, 400); else if (p.img) p.imgSm = p.img;
  if (!p.img && x.icon) p.icon = str(x.icon, 20);
  if (!p.img && !p.icon) throw bad('Add at least one product image.');
  if (!p.gallery.length && p.img) p.gallery = [p.img];
  const v = str(x.video, 300); if (v) { if (!/^https?:\/\//.test(v)) throw bad('Video link must start with https://'); p.video = v; }
  p.features = list(x.features, 12, 140);
  p.specs = (Array.isArray(x.specs) ? x.specs : []).slice(0, 20).map((r) => [str(r && r[0], 40), str(r && r[1], 100)]).filter((r) => r[0] && r[1]);
  ['autoOff', 'eco'].forEach((k) => { if (x[k] === true || x[k] === false) p[k] = x[k]; });
  return p;
}
const slug = (s) => str(s, 60).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
const rowToProduct = (r) => { const p = JSON.parse(r.data); p.id = r.id; return p; };

/* ---------- অর্ডারের দাম (সার্ভারে নতুন করে হিসাব, ক্লায়েন্টের উপর ভরসা নেই) ---------- */
async function priceOrder(db, items) {
  if (!Array.isArray(items) || !items.length || items.length > 30) throw bad('Your cart is empty.');
  const offer = await getSetting(db, 'offer'), promo = await getSetting(db, 'promo');
  const lines = []; let sub = 0, anyFree = false; const paid = [];
  for (const it of items) {
    const r = await db.prepare(`SELECT * FROM products WHERE id=? AND active=1`).bind(str(it && it.id, 60)).first();
    if (!r) throw bad('A product in your cart is no longer available.', 409);
    const p = rowToProduct(r); if (p.inStock === false) throw bad('"' + p.name + '" is out of stock.', 409);
    const vi = p.variants ? int(it.v, 0, p.variants.length - 1) : 0, x = p.variants ? p.variants[vi || 0] : p;
    const qty = int(it.qty, 1, 99) || 1;
    lines.push({ id: p.id, name: p.name, variant: p.variants ? x.name : '', price: x.price, qty });
    sub += x.price * qty; if (p.free) anyFree = true; else paid.push(p.charge || 0);
  }
  return { lines, sub, paid, anyFree, offer, promo };
}
function totalsOf(pr, code) {
  // কার্টে একটি পণ্যও ফ্রি-ডেলিভারি হলে পুরো অর্ডারের ডেলিভারি ফ্রি; নাহলে সর্বোচ্চ চার্জ একবার
  let fee = pr.anyFree || !pr.paid.length ? 0 : Math.max(...pr.paid);
  const useP = code && String(code).toUpperCase() === String(pr.promo.code).toUpperCase();
  const disc = useP ? Math.round(pr.sub * pr.promo.percent / 100) : 0;
  if (offerOn(pr.offer) && fee > 0 && pr.sub >= pr.offer.minOrder) fee = 0;
  return { sub: pr.sub, disc, fee, total: pr.sub - disc + fee, promo: useP ? String(pr.promo.code).toUpperCase() : '' };
}


/* ---------- লয়্যালটি রিওয়ার্ড: ৫টি delivered অর্ডারের পর একবার ফ্ল্যাট ছাড়, শুধু ওই অ্যাকাউন্টে ---------- */
const LOY_DEFAULT = { enabled: true, orders: 5, reward: 200, min: 1000, code: 'M5PG200' };
async function getLoyalty(db) { return { ...LOY_DEFAULT, ...((await getSetting(db, 'loyalty')) || {}) }; }
async function loyaltyProgress(db, userId) {
  const last = await db.prepare(`SELECT MAX(created) t FROM orders WHERE user_id=? AND loy=1 AND status<>'cancelled'`).bind(userId).first();
  const c = await db.prepare(`SELECT COUNT(*) n FROM orders WHERE user_id=? AND status='delivered' AND created>?`).bind(userId, (last && last.t) || 0).first();
  return c ? c.n : 0;
}
/* কোডটা রিওয়ার্ড কোড হলে যোগ্যতা যাচাই করে; যোগ্য না হলে ইংরেজি বার্তাসহ বাতিল */
async function checkLoyaltyCode(db, user, L, sub) {
  if (!user) throw bad('Please sign in to use this reward code.', 401);
  const done = await loyaltyProgress(db, user.id);
  if (done < L.orders) throw bad('Buy ' + L.orders + ' products first, then apply this promo code. You have completed ' + done + ' of ' + L.orders + '.');
  if (sub != null && sub < L.min) throw bad('This reward works on orders of ৳' + L.min.toLocaleString('en-US') + ' or more.');
}

/* ---------- ভিজিটর/কার্ট ট্র্যাকিং (নাম-পরিচয় ছাড়া, শুধু র‍্যান্ডম আইডি; লগইন থাকলে অ্যাকাউন্ট) ---------- */
const BD = 6 * 3600e3;                                         // বাংলাদেশ সময় UTC+6
const dayKey = (ms) => new Date(ms + BD).toISOString().slice(0, 10);
const TAGNAMES = { electrical: 'Electrical', socket: 'Sockets & Boards', light: 'Lights & Bulbs', electronics: 'Electronics', appliance: 'Appliances', gadget: 'Gadgets', home: 'Home', decor: 'Home Decor', kitchen: 'Kitchen', bathroom: 'Bathroom', personal: 'Personal Care' };
const EV_TYPES = ['visit', 'product', 'cart', 'checkout'], EV_SRC = ['direct', 'search', 'social', 'referral', 'email'];
async function dashboardData(db, R) {
  const t0 = now(), todayKey = dayKey(t0), startMs = Date.parse(todayKey + 'T00:00:00Z') - BD - (R - 1) * 864e5, prevStart = startMs - R * 864e5;
  const days = []; for (let i = 0; i < R; i++) days.push(dayKey(startMs + i * 864e5));
  const all = (sql, ...a) => db.prepare(sql).bind(...a).all().then((r) => r.results);
  const orders = await all(`SELECT created,total,items,dist FROM orders WHERE status<>'cancelled' AND created>=?`, prevStart);
  const pmap = {}; for (const r of await all(`SELECT id,data FROM products`)) { try { pmap[r.id] = JSON.parse(r.data); } catch (e) {} }
  const cur = orders.filter((o) => o.created >= startMs), prev = orders.filter((o) => o.created < startMs);
  const rev = Object.fromEntries(days.map((d) => [d, 0])), cnt = { ...rev }, cats = {}, areas = {};
  for (const o of cur) {
    const k = dayKey(o.created); rev[k] += o.total; cnt[k] += 1;
    const a = (o.dist || 'Unknown').trim() || 'Unknown'; areas[a] = (areas[a] || 0) + 1;
    for (const l of JSON.parse(o.items)) { const tg = ((pmap[l.id] || {}).tags || []).find((x) => TAGNAMES[x]) || ((pmap[l.id] || {}).tags || [])[0] || 'other'; cats[tg] = (cats[tg] || 0) + l.price * l.qty * 1; }
  }
  const sum = (a) => a.reduce((x, o) => x + o.total, 0);
  const vis = async (from, to) => ((await db.prepare(`SELECT COUNT(DISTINCT vid) n FROM events WHERE t='visit' AND created>=? AND created<?`).bind(from, to).first()) || {}).n || 0;
  const uniq = async (t, from, to) => ((await db.prepare(`SELECT COUNT(DISTINCT vid) n FROM events WHERE t=? AND created>=? AND created<?`).bind(t, from, to).first()) || {}).n || 0;
  const funnel = async (from, to, ordersN) => { const [v, c, k] = await Promise.all([uniq('product', from, to), uniq('cart', from, to), uniq('checkout', from, to)]); return { views: v, carts: c, checkouts: k, purchases: ordersN, abandoned: Math.max(0, c - ordersN) }; };
  const [fNow, fPrev] = await Promise.all([funnel(startMs, t0 + 1, cur.length), funnel(prevStart, startMs, prev.length)]);
  const monthStart = Date.parse(todayKey.slice(0, 8) + '01T00:00:00Z') - BD;
  const monthRev = ((await db.prepare(`SELECT COALESCE(SUM(total),0) s FROM orders WHERE status<>'cancelled' AND created>=?`).bind(monthStart).first()) || {}).s || 0;
  const target = (await getSetting(db, 'target')) || { monthly: 50000 };
  const srcRows = await all(`SELECT src, COUNT(DISTINCT vid) n FROM events WHERE t='visit' AND created>=? GROUP BY src`, startMs);
  const users = ((await db.prepare(`SELECT COUNT(*) n FROM users`).first()) || {}).n || 0;
  const newUsers = ((await db.prepare(`SELECT COUNT(*) n FROM users WHERE created>=?`).bind(startMs).first()) || {}).n || 0;
  const act = await all(`SELECT uid, MAX(created) last, SUM(t='product') views, SUM(t='cart') carts, SUM(t='checkout') ck FROM events WHERE uid IS NOT NULL AND created>=? GROUP BY uid ORDER BY last DESC LIMIT 10`, t0 - 30 * 864e5);
  const activity = [];
  await Promise.all(act.map(async (a) => {
    const [u, lo, rec] = await Promise.all([
      db.prepare(`SELECT name,email,phone FROM users WHERE id=?`).bind(a.uid).first(),
      db.prepare(`SELECT MAX(created) t FROM orders WHERE user_id=? AND status<>'cancelled'`).bind(a.uid).first(),
      all(`SELECT t,pid,created FROM events WHERE uid=? AND t IN ('cart','product') AND pid IS NOT NULL ORDER BY id DESC LIMIT 12`, a.uid)]);
    if (!u) return; const lastOrd = (lo || {}).t || 0;
    const nm = (id) => (pmap[id] || {}).name || id;
    const carted = [...new Set(rec.filter((r) => r.t === 'cart' && r.created > lastOrd).map((r) => nm(r.pid)))].slice(0, 3);
    const viewed = [...new Set(rec.filter((r) => r.t === 'product').map((r) => nm(r.pid)))].slice(0, 3);
    activity.push({ name: u.name, contact: u.email || u.phone || '', last: a.last, views: a.views, carts: a.carts, checkouts: a.ck, carted, viewed, pending: carted.length > 0 });
  }));
  activity.sort((x, y) => y.last - x.last);
  const V = await Promise.all([vis(startMs, t0 + 1), vis(prevStart, startMs)]);
  const top = (o, n) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n);
  const aTot = Object.values(areas).reduce((x, y) => x + y, 0) || 1;
  return {
    range: R, days, revenue: days.map((d) => rev[d]), orders: days.map((d) => cnt[d]),
    totals: { sales: sum(cur), orders: cur.length, visitors: V[0] },
    prev: { sales: sum(prev), orders: prev.length, visitors: V[1] },
    categories: top(cats, 4).map(([k, v]) => ({ name: TAGNAMES[k] || k, value: v })), salesTotal: sum(cur),
    month: { revenue: monthRev, target: target.monthly }, funnel: fNow, funnelPrev: fPrev,
    sources: EV_SRC.map((k) => ({ name: k, n: (srcRows.find((r) => r.src === k) || {}).n || 0 })),
    users: { total: users, fresh: newUsers, areas: top(areas, 4).map(([k, v]) => ({ name: k, pct: Math.round(v / aTot * 1000) / 10 })) },
    activity
  };
}

const STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];

/* ---------- সাইন-ইন লাগবে কি না (অ্যাডমিন টিক) ---------- */
async function requireLogin(db) { const g = await getSetting(db, 'gate'); return !g || g.requireLogin !== false; }

/* ---------- ফেক অর্ডার ধরার স্কোর (০–১০০; যত বেশি তত সন্দেহ) ---------- */
async function riskScore(db, { user, name, phone, addr, total, ip, ms, hp }) {
  let r = 0; const why = [];
  const add = (n, t) => { r += n; why.push(t); };
  const digits = phone.slice(2);
  if (/(\d)\1{5,}/.test(digits)) add(40, 'Phone looks fake');
  else if (/(01234567|12345678|23456789|98765432|87654321)/.test(digits)) add(15, 'Phone looks like a test number');
  const letters = name.replace(/[^\p{L}]/gu, '');
  if (letters.length < 2) add(25, 'Name has no letters');
  else if (/^(.)\1+$/u.test(letters) || /(asdf|qwer|test|abcd|xxxx)/i.test(name)) add(25, 'Name looks fake');
  if (addr.replace(/[^\p{L}\d]/gu, '').length < 10) add(15, 'Very short address');
  if (/^(.)\1{4,}$/u.test(addr.replace(/\s/g, ''))) add(25, 'Address looks fake');
  if (ms !== null && ms < 6000) add(20, 'Filled in too fast');
  if (!user) add(5, 'Guest order');
  if (user && now() - user.created < 3 * 60e3) add(8, 'Brand-new account');
  if (total >= 15000) add(10, 'Very large order');
  const since = now() - 864e5;
  const pend = await db.prepare(`SELECT COUNT(*) n FROM orders WHERE phone=? AND status='pending' AND created>?`).bind(phone, since).first();
  if (pend && pend.n >= 1) add(pend.n >= 2 ? 35 : 20, pend.n + ' other pending order(s) from this number in 24h');
  const canc = await db.prepare(`SELECT COUNT(*) n FROM orders WHERE phone=? AND status='cancelled'`).bind(phone).first();
  if (canc && canc.n >= 1) add(canc.n >= 2 ? 40 : 20, canc.n + ' earlier cancelled order(s) from this number');
  const ok = await db.prepare(`SELECT COUNT(*) n FROM orders WHERE phone=? AND status='delivered'`).bind(phone).first();
  if (ok && ok.n >= 1) { r -= 25; why.push('Returning customer (-)'); }
  const byIp = await db.prepare(`SELECT COUNT(*) n FROM attempts WHERE k=? AND ts>?`).bind('ord:' + ip, now() - 3600e3).first();
  if (byIp && byIp.n >= 3) add(20, 'Many orders from one device in 1 hour');
  if (hp) add(100, 'Bot filled hidden field');
  return { score: Math.max(0, Math.min(100, r)), note: why.join(' · ') };
}

/* ---------- ফ্রি নোটিফিকেশন (Telegram) — ব্যর্থ হলে অর্ডার আটকায় না ---------- */
async function notifyOwnerR(db, text) {
  try {
    const n = (await getSetting(db, 'notify')) || {};
    if (!n.tgToken || !n.tgChat) return { ok: false, err: 'Token or Chat ID is not saved yet. Fill both and press Save first.' };
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 4000);
    try {
      const r = await fetch('https://api.telegram.org/bot' + encodeURIComponent(n.tgToken) + '/sendMessage', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: n.tgChat, text, disable_web_page_preview: true }), signal: ctl.signal });
      if (r.ok) return { ok: true };
      let d = ''; try { d = (await r.json()).description || ''; } catch (e) {}
      return { ok: false, err: d || ('Telegram error ' + r.status) };
    } finally { clearTimeout(t); }
  } catch (e) { return { ok: false, err: 'Could not reach Telegram (' + (e && e.name === 'AbortError' ? 'timeout' : 'network') + ').' }; }
}
async function notifyOwner(db, text) { return (await notifyOwnerR(db, text)).ok; }

const orderOut = (o) => ({ id: o.id, number: o.number, name: o.name, phone: o.phone, dist: o.dist, address: o.address, note: o.note, items: JSON.parse(o.items), subtotal: o.subtotal, discount: o.discount, delivery: o.delivery, total: o.total, promo: o.promo, via: o.via, status: o.status, adminNote: o.admin_note || '', trackUrl: o.track_url || '', created: o.created, userId: o.user_id, risk: o.risk || 0, riskNote: o.risk_note || '' });

/* =====================================================================
   রাউটার
   ===================================================================== */
export async function handle(req, env) {
  try {
    const db = env.DB; if (!db) throw new HttpError(500, 'Database is not connected (binding "DB" is missing).');
    await ensureReady(db);
    const url = new URL(req.url), path = url.pathname.replace(/^\/api\/?/, '').replace(/\/$/, ''), seg = path.split('/'), M = req.method;

    // CSRF সুরক্ষা: অন্য সাইট থেকে পাঠানো পরিবর্তনমূলক রিকোয়েস্ট বন্ধ
    if (M !== 'GET' && M !== 'HEAD') {
      const o = req.headers.get('origin'); if (o && new URL(o).host !== url.host) throw bad('Blocked.', 403);
      if (!req.headers.get('x-requested-with')) throw bad('Blocked.', 403);
    }
    const body = async () => { try { const t = await req.text(); if (t.length > 300000) throw 0; return JSON.parse(t || '{}'); } catch (e) { throw bad('Invalid request.'); } };
    const user = await currentUser(req, env, db);
    const need = () => { if (!user) throw bad('Please sign in first.', 401); return user; };
    const admin = () => { need(); if (!isAdmin(user)) throw bad('Admin access only.', 403); return user; };
    const ip = req.headers.get('cf-connecting-ip') || (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'local';

    /* ----- পাবলিক ----- */
    if (M === 'GET' && path === 'store') {
      const [pr, st] = await db.batch([db.prepare(`SELECT * FROM products WHERE active=1 ORDER BY pos ASC, updated DESC`), db.prepare(`SELECT k,v FROM settings WHERE k IN ('hero','offer','promo','gate','loyalty','mail')`)]);
      const g = (k) => { const r = st.results.find((x) => x.k === k); return r ? JSON.parse(r.v) : SEED_SETTINGS[k]; };
      const gate = g('gate'), L = { ...LOY_DEFAULT, ...(g('loyalty') || {}) };
      return json({ products: pr.results.map(rowToProduct), hero: g('hero'), offer: g('offer'), promo: { percent: g('promo').percent }, requireLogin: !gate || gate.requireLogin !== false, mailKeys: ((g('mail') || {}).keys || []), loyalty: { enabled: L.enabled, orders: L.orders, reward: L.reward, min: L.min } });   // প্রোমো কোড এখানে পাঠানো হয় না
    }
    if (M === 'POST' && path === 'track') {
      const b = await body(), t = String(b.t || ''), vid = String(b.vid || '');
      if (!EV_TYPES.includes(t) || !/^[a-z0-9]{8,32}$/.test(vid)) return json({ ok: true });
      if (await tooMany(db, 'trk:' + ip, 500, 3600e3)) return json({ ok: true });
      const day = dayKey(now()), pid = b.pid ? str(b.pid, 40) : null, src = EV_SRC.includes(b.src) ? b.src : null;
      const dup = await db.prepare(`SELECT 1 x FROM events WHERE day=? AND t=? AND vid=? AND COALESCE(pid,'')=?`).bind(day, t, vid, pid || '').first();
      if (!dup) {
        await db.prepare(`INSERT INTO events (day,t,vid,uid,pid,src,created) VALUES (?,?,?,?,?,?,?)`).bind(day, t, vid, user ? user.id : null, pid, t === 'visit' ? (src || 'direct') : null, now()).run();
        await noteAttempt(db, 'trk:' + ip);
        if (Math.random() < 0.02) await db.prepare(`DELETE FROM events WHERE created<?`).bind(now() - 100 * 864e5).run();
      }
      return json({ ok: true });
    }
    if (M === 'POST' && path === 'promo') {
      if (await tooMany(db, 'promo:' + ip, 12, 600e3)) throw bad('Too many tries. Please wait a few minutes.', 429);
      const b = await body(), pr = await getSetting(db, 'promo'), c = String(b.code || '').trim().toUpperCase(), L = await getLoyalty(db);
      if (L.enabled && L.code && c === String(L.code).toUpperCase()) {
        await checkLoyaltyCode(db, user, L, Number.isFinite(+b.sub) && +b.sub > 0 ? +b.sub : null);
        return json({ code: c, kind: 'loyalty', amount: L.reward, min: L.min });
      }
      if (!c || c !== String(pr.code).toUpperCase()) { await noteAttempt(db, 'promo:' + ip); throw bad('This code is not valid. Please try again.'); }
      return json({ code: c, kind: 'percent', percent: pr.percent });
    }
    if (M === 'GET' && seg[0] === 'img' && seg[1]) {
      const r = await db.prepare(`SELECT mime,b64 FROM images WHERE id=?`).bind(seg[1]).first(); if (!r) throw bad('Not found', 404);
      return new Response(unb64(r.b64), { headers: { 'content-type': r.mime, 'cache-control': 'public, max-age=31536000, immutable', 'x-content-type-options': 'nosniff' } });
    }

    /* ----- সাইন আপ / লগইন ----- */
    if (M === 'POST' && path === 'auth/register') {
      if (await tooMany(db, 'reg:' + ip, 10, 3600e3)) throw bad('Too many sign-ups from this device. Please try later.', 429);
      const b = await body(), name = str(b.name, 80), pw = String(b.password || '');
      if (name.length < 2) throw bad('Please enter your name.');
      const id = parseLogin(b.login);
      if (pw.length < 6) throw bad('Password must be at least 6 characters.');
      if (pw !== String(b.confirm || '')) throw bad('Passwords do not match.');
      const dup = await db.prepare(`SELECT id FROM users WHERE (email IS NOT NULL AND email=?) OR (phone IS NOT NULL AND phone=?)`).bind(id.email, id.phone).first();
      if (dup) throw bad('An account with this email or mobile number already exists. Please sign in.', 409);
      const r = await db.prepare(`INSERT INTO users (name,email,phone,hash,role,created) VALUES (?,?,?,?, 'customer', ?)`).bind(name, id.email, id.phone, await hashPw(pw), now()).run();
      await noteAttempt(db, 'reg:' + ip);
      const u = await maybeOwner(env, db, await db.prepare(`SELECT * FROM users WHERE id=?`).bind(r.meta.last_row_id).first());
      return json({ user: pub(u) }, 200, { 'set-cookie': await newSession(req, db, u.id) });
    }
    if (M === 'POST' && path === 'auth/login') {
      const b = await body(); let id;
      try { id = parseLogin(b.login); } catch (e) { throw bad('Incorrect email/mobile or password.', 401); }
      const key = 'login:' + (id.email || id.phone);
      if ((await tooMany(db, key, 8, 15 * 60e3)) || (await tooMany(db, 'loginip:' + ip, 30, 15 * 60e3))) throw bad('Too many attempts. Please wait 15 minutes and try again.', 429);
      const u = await db.prepare(`SELECT * FROM users WHERE (email IS NOT NULL AND email=?) OR (phone IS NOT NULL AND phone=?)`).bind(id.email, id.phone).first();
      if (!u) { await noteAttempt(db, key); await noteAttempt(db, 'loginip:' + ip); throw Object.assign(bad('You don\'t have an account yet. Please create one.', 404), { code: 'no_account' }); }
      if (!(await checkPw(String(b.password || ''), u.hash))) { await noteAttempt(db, key); await noteAttempt(db, 'loginip:' + ip); throw bad('Incorrect email/mobile or password.', 401); }
      await db.prepare(`DELETE FROM attempts WHERE k=?`).bind(key).run();
      await maybeOwner(env, db, u);
      return json({ user: pub(u) }, 200, { 'set-cookie': await newSession(req, db, u.id) });
    }
    if (M === 'POST' && path === 'auth/forgot') {
      if (await tooMany(db, 'fgt:' + ip, 5, 3600e3)) throw bad('Too many requests. Please try later.', 429);
      const b = await body(); let id; try { id = parseLogin(b.login); } catch (e) { throw bad('Enter the email or mobile number of your account.'); }
      await noteAttempt(db, 'fgt:' + ip);
      const u = await db.prepare(`SELECT id,name FROM users WHERE (email IS NOT NULL AND email=?) OR (phone IS NOT NULL AND phone=?)`).bind(id.email, id.phone).first();
      if (u) { await db.prepare(`UPDATE users SET pw_req=? WHERE id=?`).bind(now(), u.id).run(); await notifyOwner(db, '🔑 Password reset requested\n' + u.name + ' — ' + (id.email || id.phone)); }
      return json({ ok: true });   // অ্যাকাউন্ট আছে কি না বলা হয় না
    }
    if (M === 'POST' && path === 'auth/logout') {
      const t = getCookie(req, COOKIE); if (t) await db.prepare(`DELETE FROM sessions WHERE id=?`).bind(await sha(t)).run();
      return json({ ok: true }, 200, { 'set-cookie': cookieHeader(req, '', 0) });
    }

    /* ----- আমার অ্যাকাউন্ট ----- */
    if (M === 'GET' && path === 'me') {
      if (!user) return json({ user: null });
      const c = await db.prepare(`SELECT COUNT(*) n FROM orders WHERE user_id=? AND status<>'cancelled'`).bind(user.id).first();
      { const L = await getLoyalty(db), lp = await loyaltyProgress(db, user.id);
        // কোডটা শুধু যোগ্য কাস্টমার নিজের অ্যাকাউন্টে দেখতে পায়
        return json({ user: { ...pub(user), orderCount: c ? c.n : 0, loyaltyProgress: lp, loyaltyCode: L.enabled && lp >= L.orders ? L.code : '' } }); }
    }
    if (M === 'PATCH' && path === 'me') {
      need(); const b = await body(); const name = str(b.name, 80); if (name.length < 2) throw bad('Please enter your name.');
      let email = user.email, phone = user.phone;
      if (str(b.email, 120)) { email = parseLogin(b.email).email; if (!email) throw bad('Enter a valid email address.'); } else if (user.phone) email = null;
      if (str(b.phone, 40)) { phone = normPhone(b.phone); if (!phone) throw bad('Enter a valid 11-digit mobile number.'); } else if (user.email) phone = null;
      if (!email && !phone) throw bad('Keep at least an email or a mobile number.');
      const dup = await db.prepare(`SELECT id FROM users WHERE id<>? AND ((email IS NOT NULL AND email=?) OR (phone IS NOT NULL AND phone=?))`).bind(user.id, email, phone).first();
      if (dup) throw bad('That email or mobile number is used by another account.', 409);
      await db.prepare(`UPDATE users SET name=?, email=?, phone=?, dist=?, address=? WHERE id=?`).bind(name, email, phone, str(b.dist, 80), str(b.address, 300), user.id).run();
      return json({ user: pub(await maybeOwner(env, db, await db.prepare(`SELECT * FROM users WHERE id=?`).bind(user.id).first())) });
    }
    if (M === 'POST' && path === 'me/password') {
      need(); const b = await body();
      if (!(await checkPw(String(b.current || ''), user.hash))) throw bad('Your current password is incorrect.', 403);
      if (String(b.password || '').length < 6) throw bad('New password must be at least 6 characters.');
      if (b.password !== b.confirm) throw bad('Passwords do not match.');
      await db.prepare(`UPDATE users SET hash=? WHERE id=?`).bind(await hashPw(b.password), user.id).run();
      return json({ ok: true });
    }
    if (M === 'POST' && path === 'me/avatar') {
      need(); const u = await saveImage(req, db);
      await db.prepare(`UPDATE users SET avatar=? WHERE id=?`).bind(u, user.id).run(); return json({ avatar: u });
    }
    if (M === 'GET' && path === 'me/orders') {
      need(); const rows = (await db.prepare(`SELECT * FROM orders WHERE user_id=? ORDER BY id DESC LIMIT 60`).bind(user.id).all()).results;
      return json({ orders: rows.map(orderOut) });
    }

    /* ----- অর্ডার দেওয়া (লগইন ছাড়াও চলে) ----- */
    if (M === 'POST' && path === 'orders') {
      if (!user && (await requireLogin(db))) throw bad('Please sign up or sign in to place your order.', 401);
      if (await tooMany(db, 'ord:' + ip, 25, 3600e3)) throw bad('Too many orders from this device. Please try later.', 429);
      const b = await body(), c = b.customer || {};
      const name = str(c.name, 80), phone = normPhone(c.phone || ''), dist = str(c.dist, 80), addr = str(c.addr, 300), note = str(c.note, 300);
      if (name.length < 2) throw bad('Please enter your name.');
      if (!phone) throw bad('Enter a valid 11-digit mobile number.');
      if (dist.length < 2) throw bad('Enter your district or area.');
      if (addr.length < 6) throw bad('Enter your full address.');
      if (b.hp) return json({ ok: true, number: 'MB-' + (100000 + (rand(2)[0] * 3000)), total: 0, subtotal: 0, discount: 0, delivery: 0 });   // বট: ভান করে সফল দেখানো, কিছু সেভ হয় না
      if (await db.prepare(`SELECT 1 x FROM blocked WHERE phone=?`).bind(phone).first()) throw bad('This mobile number cannot place online orders because of earlier fake or repeated orders. If this is a mistake, please message us on WhatsApp.', 403);
      const pr = await priceOrder(db, b.items), L = await getLoyalty(db), pc = String(b.promo || '').trim().toUpperCase();
      const isLoy = !!(L.enabled && L.code && pc && pc === String(L.code).toUpperCase());
      if (isLoy) await checkLoyaltyCode(db, user, L, pr.sub);
      const t = totalsOf(pr, isLoy ? '' : b.promo);
      if (isLoy) { t.disc = Math.min(L.reward, pr.sub); t.total = t.sub - t.disc + t.fee; t.promo = pc; }
      const ms = Number.isFinite(+b.ms) ? +b.ms : null;
      const rk = await riskScore(db, { user, name, phone, addr, total: t.total, ip, ms, hp: '' });
      if (rk.score >= 90) throw bad('This mobile number cannot place online orders because of earlier fake or repeated orders. If this is a mistake, please message us on WhatsApp.', 403);
      const via = b.via === 'whatsapp' ? 'whatsapp' : 'direct';
      let number, tries = 0;
      for (;;) {
        number = 'MB-' + (100000 + (rand(4).reduce((a, x) => a * 256 + x, 0) % 900000));
        try {
          await db.prepare(`INSERT INTO orders (number,user_id,name,phone,dist,address,note,items,subtotal,discount,delivery,total,promo,via,loy,risk,risk_note,status,created,updated) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'pending', ?, ?)`)
            .bind(number, user ? user.id : null, name, phone, dist, addr, note, JSON.stringify(pr.lines), t.sub, t.disc, t.fee, t.total, t.promo, via, isLoy ? 1 : 0, rk.score, rk.note, now(), now()).run(); break;
        } catch (e) { if (++tries > 5) throw e; }
      }
      await noteAttempt(db, 'ord:' + ip);
      await notifyOwner(db, '🛒 New order ' + number + (rk.score >= 60 ? '  ⚠️ HIGH RISK (' + rk.score + ')' : rk.score >= 30 ? '  ⚠ check (' + rk.score + ')' : '') + '\n' + name + ' · ' + phone + '\n' + dist + ', ' + addr + '\n' + pr.lines.map((l) => l.name + ' ×' + l.qty).join(', ') + '\nTotal: ৳' + t.total + ' (COD)' + (rk.note ? '\n' + rk.note : ''));
      if (user) {
        await db.prepare(`UPDATE users SET dist=CASE WHEN dist IS NULL OR dist='' THEN ? ELSE dist END, address=CASE WHEN address IS NULL OR address='' THEN ? ELSE address END WHERE id=?`).bind(dist, addr, user.id).run();
        if (!user.phone && !(await db.prepare(`SELECT 1 x FROM users WHERE phone=?`).bind(phone).first())) await db.prepare(`UPDATE users SET phone=? WHERE id=?`).bind(phone, user.id).run();
      }
      return json({ ok: true, number, total: t.total, subtotal: t.sub, discount: t.disc, delivery: t.fee });
    }

    /* =================== অ্যাডমিন =================== */
    if (seg[0] === 'admin') {
      admin(); const A = seg.slice(1).join('/');

      if (M === 'GET' && A === 'stats') {
        const day = now() - 864e5;
        const R = await db.batch([
          db.prepare(`SELECT COUNT(*) n FROM orders WHERE status='pending'`),
          db.prepare(`SELECT COUNT(*) n, COALESCE(SUM(total),0) s FROM orders WHERE created>? AND status<>'cancelled'`).bind(day),
          db.prepare(`SELECT COUNT(*) n, COALESCE(SUM(total),0) s FROM orders WHERE status<>'cancelled'`),
          db.prepare(`SELECT COUNT(*) n, COALESCE(SUM(total),0) s FROM orders WHERE status='delivered'`),
          db.prepare(`SELECT COUNT(*) n FROM products`), db.prepare(`SELECT COUNT(*) n FROM users`),
          db.prepare(`SELECT * FROM orders ORDER BY id DESC LIMIT 6`)]);
        const f = (i) => R[i].results[0] || {};
        return json({
          pending: f(0).n, today: f(1), all: f(2), delivered: f(3), products: f(4).n, users: f(5).n,
          recent: R[6].results.map(orderOut)
        });
      }
      if (M === 'GET' && A === 'dashboard') return json(await dashboardData(db, [7, 30, 90].includes(+url.searchParams.get('range')) ? +url.searchParams.get('range') : 7));
      if (M === 'PUT' && A === 'target') { const b = await body(); await setSetting(db, 'target', { monthly: int(b.monthly, 0, 1e9) || 0 }); return json({ ok: true }); }
      if (M === 'GET' && A === 'orders') {
        const st = url.searchParams.get('status') || '', q = str(url.searchParams.get('q'), 60), off = int(url.searchParams.get('offset'), 0, 1e6) || 0;
        const w = [], a = [];
        if (STATUSES.includes(st)) { w.push('status=?'); a.push(st); }
        if (q) { w.push('(number LIKE ? OR name LIKE ? OR phone LIKE ?)'); a.push('%' + q + '%', '%' + q + '%', '%' + q + '%'); }
        const rows = (await db.prepare(`SELECT * FROM orders ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY id DESC LIMIT 30 OFFSET ?`).bind(...a, off).all()).results;
        return json({ orders: rows.map(orderOut), more: rows.length === 30 });
      }
      if (M === 'GET' && seg[1] === 'orders' && seg[2]) {
        const o = await db.prepare(`SELECT * FROM orders WHERE id=?`).bind(int(seg[2], 1, 1e12)).first(); if (!o) throw bad('Order not found.', 404);
        return json({ order: orderOut(o), blocked: !!(await db.prepare(`SELECT 1 x FROM blocked WHERE phone=?`).bind(o.phone).first()) });
      }
      if (M === 'PATCH' && seg[1] === 'orders' && seg[2]) {
        const b = await body(), o = await db.prepare(`SELECT id FROM orders WHERE id=?`).bind(int(seg[2], 1, 1e12)).first(); if (!o) throw bad('Order not found.', 404);
        if (b.status !== undefined && !STATUSES.includes(b.status)) throw bad('Invalid status.');
        let tu = null;
        if (b.trackUrl !== undefined) { tu = str(b.trackUrl, 500).trim(); if (tu && !/^https?:\/\/[^\s]+$/i.test(tu)) throw bad('Tracking link must start with http:// or https://'); }
        await db.prepare(`UPDATE orders SET status=COALESCE(?,status), admin_note=COALESCE(?,admin_note), track_url=COALESCE(?,track_url), updated=? WHERE id=?`).bind(b.status || null, b.adminNote === undefined ? null : str(b.adminNote, 400), tu, now(), o.id).run();
        return json({ order: orderOut(await db.prepare(`SELECT * FROM orders WHERE id=?`).bind(o.id).first()) });
      }

      if (M === 'GET' && A === 'products') {
        const rows = (await db.prepare(`SELECT * FROM products ORDER BY pos ASC, updated DESC`).all()).results;
        return json({ products: rows.map((r) => ({ ...rowToProduct(r), active: !!r.active })) });
      }
      if (M === 'POST' && A === 'products') {
        const b = await body(); let id = slug(b.id || b.name) || 'product';
        const taken = async (i) => !!(await db.prepare(`SELECT 1 x FROM products WHERE id=?`).bind(i).first());
        let n = 1, base = id; while (await taken(id)) id = base + '-' + (++n);
        const p = cleanProduct(b, id), min = await db.prepare(`SELECT COALESCE(MIN(pos),1) m FROM products`).first();
        await db.prepare(`INSERT INTO products (id,data,active,pos,updated) VALUES (?,?,?,?,?)`).bind(id, JSON.stringify(p), b.active === false ? 0 : 1, (min.m || 1) - 1, now()).run();
        return json({ product: p });
      }
      if (seg[1] === 'products' && seg[2]) {
        const id = str(seg[2], 60), r = await db.prepare(`SELECT * FROM products WHERE id=?`).bind(id).first(); if (!r) throw bad('Product not found.', 404);
        if (M === 'PUT') {
          const b = await body(), old = rowToProduct(r), p = cleanProduct({ icon: old.icon, ...b }, id);
          await db.prepare(`UPDATE products SET data=?, active=?, updated=? WHERE id=?`).bind(JSON.stringify(p), b.active === false ? 0 : 1, now(), id).run();
          return json({ product: p });
        }
        if (M === 'PATCH') {                                         // তাড়াতাড়ি স্টক/অ্যাক্টিভ বদল
          const b = await body(), p = rowToProduct(r);
          if (typeof b.inStock === 'boolean') p.inStock = b.inStock;
          await db.prepare(`UPDATE products SET data=?, active=?, updated=? WHERE id=?`).bind(JSON.stringify(p), typeof b.active === 'boolean' ? (b.active ? 1 : 0) : r.active, now(), id).run();
          return json({ ok: true });
        }
        if (M === 'DELETE') { await db.prepare(`DELETE FROM products WHERE id=?`).bind(id).run(); return json({ ok: true }); }
      }
      if (M === 'POST' && A === 'upload') return json({ url: await saveImage(req, db) });

      if (M === 'POST' && A === 'block') { const b = await body(), ph = normPhone(b.phone || ''); if (!ph) throw bad('Invalid number.'); await db.prepare(`INSERT OR REPLACE INTO blocked (phone,note,created) VALUES (?,?,?)`).bind(ph, str(b.note, 100), now()).run(); return json({ ok: true }); }
      if (M === 'DELETE' && seg[1] === 'block' && seg[2]) { await db.prepare(`DELETE FROM blocked WHERE phone=?`).bind(str(seg[2], 20)).run(); return json({ ok: true }); }
      if (M === 'GET' && A === 'blocked') return json({ blocked: (await db.prepare(`SELECT * FROM blocked ORDER BY created DESC LIMIT 200`).all()).results });
      if (A === 'notify') {
        if (user.role !== 'owner') throw bad('Only the owner can change notifications.', 403);
        const n = (await getSetting(db, 'notify')) || {};
        if (M === 'GET') return json({ tgToken: n.tgToken ? '••••' + n.tgToken.slice(-4) : '', tgChat: n.tgChat || '' });
        if (M === 'PUT') {
          const b = await body(), tok = str(b.tgToken, 100), chat = str(b.tgChat, 40);
          if (chat && !/^-?\d{4,20}$|^@[A-Za-z0-9_]{4,}$/.test(chat)) throw bad('Chat ID looks wrong (use the number from @userinfobot).');
          if (tok && !tok.startsWith('••••') && !/^\d{5,12}:[A-Za-z0-9_-]{20,}$/.test(tok)) throw bad('Bot token looks wrong. It looks like 123456789:ABC… (from @BotFather).');
          await setSetting(db, 'notify', { tgToken: tok.startsWith('••••') ? n.tgToken : tok, tgChat: chat }); return json({ ok: true });
        }
      }
      if (A === 'mail') {
        if (user.role !== 'owner') throw bad('Only the owner can do this.', 403);
        if (M === 'GET') return json({ keys: ((await getSetting(db, 'mail')) || {}).keys || [] });
        if (M === 'PUT') {
          const b = await body(), ks = (Array.isArray(b.keys) ? b.keys : String(b.keys || '').split(/[\s,]+/)).map((x) => String(x).trim().toLowerCase()).filter(Boolean);
          if (ks.length > 5) throw bad('Up to 5 keys.'); for (const k of ks) if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(k)) throw bad('A key looks wrong: ' + k.slice(0, 12) + '… (it should look like xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx).');
          await setSetting(db, 'mail', { keys: [...new Set(ks)] }); return json({ ok: true });
        }
      }
      if (M === 'POST' && A === 'notify/test') { if (user.role !== 'owner') throw bad('Only the owner can do this.', 403); return json(await notifyOwnerR(db, '✅ Manar BD: test notification. Orders will arrive here.')); }
      if (M === 'GET' && A === 'settings') return json({ gate: { requireLogin: await requireLogin(db) }, hero: await getSetting(db, 'hero'), offer: await getSetting(db, 'offer'), promo: await getSetting(db, 'promo'), loyalty: await getLoyalty(db) });
      if (M === 'PUT' && A === 'settings') {
        const b = await body();
        if (b.gate) await setSetting(db, 'gate', { requireLogin: !!b.gate.requireLogin });
        if (b.hero) await setSetting(db, 'hero', (Array.isArray(b.hero) ? b.hero : []).slice(0, 10).map((h) => ({ img: str(h && h.img, 400), product: str(h && h.product, 60), alt: str(h && h.alt, 120) })).filter((h) => urlOk(h.img)));
        if (b.offer) {
          const o = b.offer, d = (x) => (/^\d{4}-\d{2}-\d{2}$/.test(str(x, 10)) ? str(x, 10) : '');
          await setSetting(db, 'offer', { enabled: !!o.enabled, minOrder: int(o.minOrder, 1, 1e7) || 999, text: str(o.text, 160), startDate: d(o.startDate), endDate: d(o.endDate) });
        }
        if (b.promo) { const code = str(b.promo.code, 20).toUpperCase().replace(/[^A-Z0-9]/g, ''); if (code.length < 3) throw bad('Promo code needs at least 3 letters or digits.'); await setSetting(db, 'promo', { code, percent: int(b.promo.percent, 1, 90) || 10 }); }
        if (b.loyalty) { const l = b.loyalty, code = str(l.code, 20).toUpperCase().replace(/[^A-Z0-9]/g, ''); if (code.length < 4) throw bad('Reward code needs at least 4 letters or digits.'); await setSetting(db, 'loyalty', { enabled: !!l.enabled, orders: int(l.orders, 1, 50) || 5, reward: int(l.reward, 1, 1e6) || 200, min: int(l.min, 0, 1e7) || 1000, code }); }
        return json({ ok: true });
      }

      if (M === 'GET' && A === 'users') {
        const q = str(url.searchParams.get('q'), 60);
        const rows = (await db.prepare(`SELECT u.id,u.name,u.email,u.phone,u.role,u.created,u.pw_req,(SELECT COUNT(*) FROM orders o WHERE o.user_id=u.id) AS orders FROM users u ${q ? 'WHERE u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?' : ''} ORDER BY u.id DESC LIMIT 100`).bind(...(q ? ['%' + q + '%', '%' + q + '%', '%' + q + '%'] : [])).all()).results;
        return json({ users: rows });
      }
      if (seg[1] === 'users' && seg[2]) {
        if (user.role !== 'owner') throw bad('Only the owner can manage users.', 403);
        const t = await db.prepare(`SELECT * FROM users WHERE id=?`).bind(int(seg[2], 1, 1e12)).first(); if (!t) throw bad('User not found.', 404);
        if (t.role === 'owner') throw bad('The owner account cannot be changed here.', 403);
        if (M === 'PATCH') {
          const b = await body(); if (!['admin', 'customer'].includes(b.role)) throw bad('Invalid role.');
          await db.prepare(`UPDATE users SET role=? WHERE id=?`).bind(b.role, t.id).run(); return json({ ok: true });
        }
        if (M === 'POST' && seg[3] === 'reset') {
          const b = await body(); if (String(b.password || '').length < 6) throw bad('Password must be at least 6 characters.');
          await db.prepare(`UPDATE users SET hash=?, pw_req=NULL WHERE id=?`).bind(await hashPw(String(b.password)), t.id).run();
          await db.prepare(`DELETE FROM sessions WHERE user_id=?`).bind(t.id).run(); return json({ ok: true });
        }
      }
    }
    throw bad('Not found', 404);
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
}
