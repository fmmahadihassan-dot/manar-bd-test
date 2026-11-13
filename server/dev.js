/* লোকাল সার্ভার: নিজের ফোন/কম্পিউটারে সাইট ও ব্যাকএন্ড একসাথে চালায়।
   চালানো:  node server/dev.js        (Node 22 বা তার ওপরের ভার্সন লাগবে)
   তারপর ব্রাউজারে খুলুন:  http://localhost:8080
   ডাটাবেস থাকে data/manar.db ফাইলে। মুছে দিলে নতুন করে শুরু হয়। */
import zlib from 'node:zlib';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { handle } from './api.js';
import { robotsTxt, sitemapXml, fixHtml } from './seo.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUB = path.join(root, 'public'), PORT = Number(process.env.PORT) || 8080;
fs.mkdirSync(path.join(root, 'data'), { recursive: true });

/* Cloudflare D1 এর মতো করে SQLite কে ব্যবহার করার ছোট আবরণ */
function makeD1(file) {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
  const clean = (a) => a.map((v) => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v));
  const prep = (sql) => {
    let args = []; const st = { get: (...a) => db.prepare(sql).get(...a), all: (...a) => db.prepare(sql).all(...a), run: (...a) => db.prepare(sql).run(...a) };   // লাগলে তখন কম্পাইল (টেবিল তৈরির আগে ইনডেক্স প্রস্তুত করা যায়)
    const o = {
      bind: (...a) => { args = clean(a); return o; },
      first: async () => { const r = st.get(...args); return r ? { ...r } : null; },
      all: async () => ({ results: st.all(...args).map((r) => ({ ...r })) }),
      run: async () => { const r = st.run(...args); return { success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }; }
    };
    return o;
  };
  return {
    prepare: prep,
    batch: async (list) => { db.exec('BEGIN'); try { const out = []; for (const s of list) out.push(await s.run()); db.exec('COMMIT'); return out; } catch (e) { db.exec('ROLLBACK'); throw e; } }
  };
}
const env = {
  DB: makeD1(path.join(root, 'data', 'manar.db')),
  OWNER_LOGIN: process.env.OWNER_LOGIN || '',
  DEV_FIRST_OWNER: process.env.OWNER_LOGIN ? '' : '1'         // OWNER_LOGIN না দিলে প্রথম যে সাইন আপ করবে সেই মালিক
};

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.mp4': 'video/mp4' };

// public/_headers (Cloudflare এর ফাইল) এর "/*" অংশ লোকালেও প্রয়োগ হয়, যাতে এখানেই পরীক্ষা করা যায়
const secHdr = {};
try { let on = false; for (const l of fs.readFileSync(path.join(PUB, '_headers'), 'utf8').split('\n')) { if (/^\S/.test(l)) on = l.trim() === '/*'; else if (on && l.includes(':')) { const i = l.indexOf(':'); secHdr[l.slice(0, i).trim().toLowerCase()] = l.slice(i + 1).trim(); } } } catch (e) { /* ফাইল না থাকলে সমস্যা নেই */ }
delete secHdr['strict-transport-security'];

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
    if (url.pathname.startsWith('/api/')) {
      const chunks = []; for await (const c of req) chunks.push(c);
      const hasBody = !['GET', 'HEAD'].includes(req.method);
      const r = await handle(new Request(url, { method: req.method, headers: req.headers, body: hasBody ? Buffer.concat(chunks) : undefined }), env);
      const h = {}; r.headers.forEach((v, k) => { h[k] = v; });
      res.writeHead(r.status, h); res.end(Buffer.from(await r.arrayBuffer())); return;
    }
    let p = decodeURIComponent(url.pathname);
    if (p.startsWith('/public/')) { res.writeHead(302, { location: p.slice(7) || '/' }); res.end(); return; }   // ভুল করে /public/... খুললেও ঠিক পাতায় নেবে
    const origin = 'http://' + (req.headers.host || 'localhost:' + PORT);
    if (p === '/robots.txt') { res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' }); res.end(robotsTxt(origin)); return; }
    if (p === '/sitemap.xml') { res.writeHead(200, { 'content-type': 'application/xml; charset=utf-8' }); res.end(sitemapXml(origin)); return; }
    if (p === '/_headers') { res.writeHead(404); res.end('Not found'); return; }
    if (p === '/admin') { res.writeHead(302, { location: '/admin/' }); res.end(); return; }
    if (p.endsWith('/')) p += 'index.html';
    const file = path.normalize(path.join(PUB, p));
    if (!file.startsWith(PUB) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404, { 'content-type': 'text/plain' }); res.end('Not found'); return; }
    if (path.extname(file) === '.html') { const body = Buffer.from(fixHtml(fs.readFileSync(file, 'utf8'), origin)); res.writeHead(200, { ...secHdr, 'content-type': TYPES['.html'], 'cache-control': 'no-cache', 'content-length': body.length }); res.end(body); return; }
    const st = fs.statSync(file), ext = path.extname(file).toLowerCase(), etag = '"' + st.size.toString(16) + '-' + Math.floor(st.mtimeMs).toString(16) + '"';
    // ছবি/ফন্ট ১ ঘণ্টা ফোনেই থাকবে; css/js/html প্রতিবার শুধু "বদলেছে কি?" জিজ্ঞেস করবে (304), তাই ফাইল বদলালে সাথে সাথে নতুনটা আসে
    const heavy = ['.png', '.jpg', '.jpeg', '.webp', '.svg', '.woff2', '.mp4', '.ico'].includes(ext);
    const hdr = { ...secHdr, 'content-type': TYPES[ext] || 'application/octet-stream', etag, 'cache-control': heavy ? 'public, max-age=3600' : 'no-cache' };
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, hdr); res.end(); return; }
    if (!heavy && /gzip/.test(req.headers['accept-encoding'] || '')) { hdr['content-encoding'] = 'gzip'; hdr.vary = 'Accept-Encoding'; res.writeHead(200, hdr); fs.createReadStream(file).pipe(zlib.createGzip({ level: 4 })).pipe(res); return; }
    hdr['content-length'] = st.size; res.writeHead(200, hdr);
    fs.createReadStream(file).pipe(res);
  } catch (e) { console.error(e); res.writeHead(500); res.end('Server error'); }
}).listen(PORT, () => {
  console.log('\n  Manar BD চালু হয়েছে:  http://localhost:' + PORT);
  console.log('  অ্যাডমিন প্যানেল:    http://localhost:' + PORT + '/admin/');
  console.log(env.OWNER_LOGIN ? '  মালিক: ' + env.OWNER_LOGIN : '  প্রথম যে অ্যাকাউন্ট খুলবেন সেটাই মালিক (অ্যাডমিন) হবে।');
});
