/* ছোট সার্ভিস ওয়ার্কার: অ্যাপ হিসেবে ইনস্টল করার জন্য। নেট না থাকলে সাধারণ একটি বার্তা দেখায়। API বা অ্যাডমিন কখনো ক্যাশ করে না। */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function (e) {
  var r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || u.pathname.indexOf('/api/') === 0 || u.pathname.indexOf('/admin') === 0) return;
  if (r.mode === 'navigate') {
    e.respondWith(fetch(r).catch(function () {
      return new Response('<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><body style="font-family:sans-serif;text-align:center;padding:48px 20px"><h2>You are offline</h2><p>Please check your internet connection and try again.</p>', { headers: { 'content-type': 'text/html; charset=utf-8' } });
    }));
  }
});
