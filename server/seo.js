/* SEO সাহায্যকারী: robots.txt, sitemap.xml, আর HTML এ ডোমেইন বসানো। Cloudflare ও লোকাল দুই জায়গাতেই চলে। */
export const robotsTxt = (o) => `User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\n\nSitemap: ${o}/sitemap.xml\n`;
export const sitemapXml = (o) => `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${o}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url></urlset>\n`;
export const fixHtml = (html, o) => html.replace(/__ORIGIN__/g, o);
