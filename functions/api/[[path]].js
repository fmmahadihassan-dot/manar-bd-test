// Cloudflare Pages Functions: /api/... এর সব রিকোয়েস্ট এখানে আসে
import { handle } from '../../server/api.js';

// /api/store সবার জন্য একই, তাই কাছের সার্ভারে ২০ সেকেন্ড জমিয়ে রাখি (ডাটাবেসে না গিয়েই উত্তর)
const KEY = (u) => new Request(u.origin + '/api/store');
export const onRequest = async (ctx) => {
  const req = ctx.request, url = new URL(req.url), t0 = Date.now();
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  if (cache && req.method === 'GET' && url.pathname === '/api/store') {
    try {
      const hit = await cache.match(KEY(url));
      if (hit) { const r = new Response(hit.body, hit); r.headers.set('cache-control', 'no-cache'); r.headers.set('x-cache', 'HIT'); return r; }
    } catch (e) {}
    const r = await handle(req, ctx.env);
    if (r.ok) {
      const c = new Response(r.clone().body, r); c.headers.set('cache-control', 'public, s-maxage=20');
      ctx.waitUntil(cache.put(KEY(url), c).catch(() => {}));
    }
    const o = new Response(r.body, r); o.headers.set('x-cache', 'MISS'); o.headers.set('server-timing', 'app;dur=' + (Date.now() - t0)); return o;
  }
  const r = await handle(req, ctx.env);
  // অ্যাডমিন কিছু বদলালে জমানো কপি ফেলে দিই
  if (cache && req.method !== 'GET' && req.method !== 'HEAD' && url.pathname.startsWith('/api/admin/')) ctx.waitUntil(cache.delete(KEY(url)).catch(() => {}));
  const o = new Response(r.body, r); o.headers.set('server-timing', 'app;dur=' + (Date.now() - t0)); return o;
};
