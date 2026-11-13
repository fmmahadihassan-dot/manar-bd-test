// প্রতিটি পাতায় সঠিক ডোমেইন বসায় (SEO/শেয়ার কার্ডের জন্য) এবং robots.txt / sitemap.xml বানায়
import { robotsTxt, sitemapXml, fixHtml } from '../server/seo.js';
export async function onRequest(ctx) {
  const url = new URL(ctx.request.url), o = url.origin;
  if (url.pathname === '/robots.txt') return new Response(robotsTxt(o), { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
  if (url.pathname === '/sitemap.xml') return new Response(sitemapXml(o), { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
  const res = await ctx.next();
  if ((res.headers.get('content-type') || '').includes('text/html')) {
    const h = new Headers(res.headers); h.delete('content-length'); h.delete('etag');
    return new Response(fixHtml(await res.text(), o), { status: res.status, headers: h });
  }
  return res;
}
