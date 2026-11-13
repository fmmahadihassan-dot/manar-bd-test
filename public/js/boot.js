/* শুরুর স্ক্রিপ্ট: ব্যাকএন্ড (API) থাকলে সেখান থেকে পণ্য, ব্যানার, অফার ও প্রোমো নিয়ে আসে।
   ব্যাকএন্ড না থাকলে (সাধারণ স্ট্যাটিক হোস্টিং) data.js এর তথ্য দিয়েই সাইট চলে। */
(function () {
  var S = window.STORE, started = false;
  function start() { if (started) return; started = true; var s = document.createElement('script'); s.src = 'js/app.js'; document.body.appendChild(s); }
  if (location.protocol === 'file:' || !window.fetch) { start(); return; }
  function apply(j) { S.products = j.products; S.hero = j.hero || []; S.offer = j.offer || S.offer; S.promo = j.promo || S.promo; S.requireLogin = j.requireLogin !== false; if (j.loyalty) S.loyalty = Object.assign({}, S.loyalty, j.loyalty); S.mailKeys = Array.isArray(j.mailKeys) ? j.mailKeys : []; S.api = true; }
  /* আগের ভিজিটের তথ্য থাকলে সাথে সাথে দোকান দেখাই; নতুন তথ্য পেছনে এনে রাখি (পরের বার/রিলোডে কাজে লাগে) */
  var cached = null; try { cached = JSON.parse(localStorage.getItem('mb_store') || 'null'); } catch (e) {}
  if (cached && cached.products && cached.products.length) { apply(cached); start(); fetch('/api/store', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { if (j && j.products) try { localStorage.setItem('mb_store', JSON.stringify(j)); } catch (e) {} }).catch(function () {}); return; }
  var ctl = window.AbortController ? new AbortController() : null, to = setTimeout(function () { if (ctl) ctl.abort(); start(); }, 5000);
  fetch('/api/store', { credentials: 'same-origin', signal: ctl ? ctl.signal : undefined })
    .then(function (r) { if (!r.ok || !/json/.test(r.headers.get('content-type') || '')) throw 0; return r.json(); })
    .then(function (j) {
      if (!j || !j.products) throw 0;
      apply(j); try { localStorage.setItem('mb_store', JSON.stringify(j)); } catch (e) {}
    })
    .catch(function () {})
    .then(function () { clearTimeout(to); start(); });
})();
