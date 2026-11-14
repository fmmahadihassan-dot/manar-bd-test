/* Manar BD – স্টোরের লজিক (কার্ট, ডেলিভারি হিসাব, প্রোমো, চেকআউট, ভিডিও/ছবি গ্যালারি) */
(function () {
  'use strict';
  var S = window.STORE, P = S.products, ICONS = window.ICONS;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- হেল্পার ---------- */
  var bn = function (n) { try { return Number(n).toLocaleString('en-IN'); } catch (e) { return String(n); } };   // 1,25,000 ফরম্যাট
  var money = function (n) { return (S.currency || '৳') + bn(Math.round(n)); };
  var toEn = function (s) { return String(s).replace(/[০-৯]/g, function (d) { return d.charCodeAt(0) - 0x09E6; }); };  // বাংলা সংখ্যা → ইংরেজি
  var ic = function (n, cls) {
    var vb = (window.ICON_VB || {})[n];       // ব্র্যান্ড আইকনের নিজস্ব viewBox থাকে
    return '<svg class="ic' + (vb ? ' fill' : '') + (cls ? ' ' + cls : '') + '" viewBox="' + (vb || '0 0 24 24') + '" aria-hidden="true">' + ICONS[n] + '</svg>';
  };
  var byId = function (id) { for (var i = 0; i < P.length; i++) if (P[i].id === id) return P[i]; };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  var vx = function (p, v) { return p.variants ? p.variants[v || 0] : p; };           // দাম/পুরনো দাম
  var disc = function (p, v) { var x = vx(p, v); return x.old ? Math.round((1 - x.price / x.old) * 100) : 0; };
  var minPrice = function (p) { return p.variants ? Math.min.apply(null, p.variants.map(function (x) { return x.price; })) : p.price; };
  var catName = function (p) { return S.tagNames[p.tags[0]] || ''; };

  var inStock = function (p) { return p.inStock !== false; };   // inStock: false দিলে স্টকে নেই

  /* ---------- ফ্রি ডেলিভারি অফার (data.js এর offer.enabled দিয়ে চালু/বন্ধ) ---------- */
  function offerOn() {
    var o = S.offer; if (!o || !o.enabled) return false;
    var d = new Date(), pad = function (n) { return (n < 10 ? '0' : '') + n; };
    var today = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    if (o.startDate && today < o.startDate) return false;
    if (o.endDate && today > o.endDate) return false;
    return true;
  }

  /* ---------- অবস্থা ---------- */
  var st = { tag: 'all', q: '', sort: 'default', limit: 12 };
  var cart = store.get('manar_cart', []).filter(function (l) { var p = byId(l.id); return p && p.inStock !== false; });   // স্টকে নেই এমন পণ্য কার্ট থেকে বাদ
  var promoOn = false, promoCode = '', promoKind = 'percent', promoAmt = 0;   // প্রোমো কোড পাবলিক নয়: ব্যাকএন্ড থাকলে সার্ভার যাচাই করে
  var detail = null;
  var layers = [];

  /* ---------- প্রোডাক্ট কার্ড ---------- */
  function pic(p, big) {
    if (p.img) return '<img src="' + (big ? p.img : (p.imgSm || p.img)) + '" alt="' + esc(p.name) + '" loading="lazy" decoding="async">';
    return '<div class="ph">' + ic(p.icon || 'grid') + '</div>';
  }
  function card(p) {
    var d = disc(p), x = vx(p), from = p.variants ? '<small class="from">From</small>' : '';
    return '<article class="card' + (inStock(p) ? '' : ' is-oos') + '" data-open="' + p.id + '" tabindex="0" role="button" aria-label="' + esc(p.name) + ' – view details">' +
      '<div class="card-img">' + pic(p) +
      (!inStock(p) ? '<span class="badge oos">Out of stock</span>' : (p.badge ? '<span class="badge">' + p.badge + '</span>' : '')) +
      (p.free && inStock(p) ? '<span class="fd"><i class="fd-ic"></i>FREE DELIVERY</span>' : '') + '</div>' +
      '<h3>' + esc(p.name) + '</h3><p class="sub">' + esc(p.short || '') + '</p>' +
      '<div class="card-foot"><div class="pr">' + (from ? from : '') + '<div class="pr-row"><b>' + money(minPrice(p)) + '</b>' + (x.old && !p.variants ? '<s>' + money(x.old) + '</s>' : '') + '</div>' + (x.old && !p.variants && x.old > x.price ? '<span class="sv">You save ' + money(x.old - x.price) + '</span>' : '') + '</div>' +
      '<button class="add" data-add="' + p.id + '" aria-label="' + (inStock(p) ? 'Add to cart' : 'Out of stock') + '"' + (inStock(p) ? '' : ' disabled') + '>' + ic('plus') + '</button></div></article>';
  }

  /* ---------- তালিকা ও ফিল্টার ---------- */
  function filtered() {
    var q = st.q.trim().toLowerCase();
    var a = P.filter(function (p) {
      var okTag = st.tag === 'all' || p.tags.indexOf(st.tag) > -1;
      var hay = (p.name + ' ' + (p.short || '') + ' ' + (p.brand || '') + ' ' + p.tags.join(' ') + ' ' + p.tags.map(function (t) { return S.tagNames[t] || ''; }).join(' ')).toLowerCase();
      return okTag && (!q || hay.indexOf(q) > -1);
    });
    if (st.sort === 'low') a.sort(function (x, y) { return minPrice(x) - minPrice(y); });
    if (st.sort === 'high') a.sort(function (x, y) { return minPrice(y) - minPrice(x); });
    if (st.sort === 'disc') a.sort(function (x, y) { return disc(y) - disc(x); });
    return a;
  }
  function renderAll() {
    var searching = st.tag !== 'all' || st.q.trim();
    $('#home').hidden = !!searching;
    $('#results').hidden = !searching;
    if (searching) {
      var list = filtered();
      $('#resultsTitle').textContent = st.q.trim() ? 'Results for “' + st.q.trim() + '” (' + list.length + ')' : (S.tagNames[st.tag] || 'Products') + ' (' + list.length + ')';
      $('#resultsGrid').innerHTML = list.length ? list.map(card).join('') : '<p class="empty-res">No products found. Try a different name.</p>';
    } else {
      var all = filtered();
      $('#allGrid').innerHTML = all.slice(0, st.limit).map(card).join('');
      $('#allCount').textContent = all.length + ' products';
      $('#moreBtn').parentNode.hidden = all.length <= st.limit;
    }
    $$('.chip').forEach(function (c) { var on = c.dataset.tag === st.tag; c.classList.toggle('on', on); c.setAttribute('aria-pressed', on); });
    $$('#sortPop button').forEach(function (b) { b.classList.toggle('on', b.dataset.sort === st.sort); });
  }
  function renderAnnouncement() {
    var bar = $('#ann'), on = offerOn() && S.offer.text;
    bar.hidden = !on; if (!on) return;
    var run = $('#annRun'); run.textContent = S.offer.text;
    run.style.animationDuration = Math.max(14, S.offer.text.length * 0.28) + 's';     // লেখা যত বড়, তত ধীরে চলে
  }
  /* ---------- রিওয়ার্ড কার্ড (হিরোর নিচে) ---------- */
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-copy]'); if (!b) return;
    var v = b.getAttribute('data-copy');
    (navigator.clipboard ? navigator.clipboard.writeText(v) : Promise.reject()).then(function () { toast('Code copied: ' + v); }, function () { toast(v); });
  });
  document.addEventListener('visibilitychange', function () { if (!document.hidden && S.api && me) loadMe(); });   // অ্যাডমিন Delivered করলে ট্যাবে ফিরলেই হালনাগাদ
  function updateMenuAcc() {
    var b = $('#menuAcc'); if (!b) return;
    if (!S.api) { b.hidden = true; return; }
    b.hidden = false;
    b.innerHTML = ic('user') + '<span>' + (me ? esc(me.name) : 'Sign in / Sign up') + '</span>' + ic('chev');
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-copy]'); if (!b) return;
    var t = b.getAttribute('data-copy'), ok = function () { toast('Code copied: ' + t); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok, function () {}); else { var i = document.createElement('input'); i.value = t; document.body.appendChild(i); i.select(); try { document.execCommand('copy'); ok(); } catch (x) {} i.remove(); }
  });
  function renderReward() {
    updateMenuAcc();
    var L = S.loyalty, box = $('#reward'), code = me && me.loyaltyCode;
    if (!L || !L.enabled) { box.hidden = true; return; }
    var done = Math.min(L.orders, (typeof myCount === 'number' ? myCount : 0)), dots = '';
    for (var i = 1; i <= L.orders; i++) {
      dots += '<li class="' + (i <= done ? 'done' : '') + (i === L.orders ? ' goal' : '') + '"><span>' + ic(i <= done ? 'check' : (i === L.orders ? 'gift' : 'cart')) + '</span><b>' + i + '</b></li>';
    }
    var bd = function (n) { return String(bn(n)).replace(/[0-9]/g, function (d) { return '০১২৩৪৫৬৭৮৯'.charAt(d); }); };   // বাংলা সংখ্যা
    var amt = bd(L.reward) + '৳';
    box.innerHTML = '<div class="rw-top"><span class="rw-badge">' + ic('gift') + '</span><span class="eyebrow">Loyalty reward</span></div>' +
      '<h2>Buy ' + L.orders + ' get <span class="rw-amt">' + money(L.reward) + '</span> discount</h2>' +
      '<p>আমাদের থেকে <b>' + bd(L.orders) + 'টি প্রোডাক্ট</b> কেনাকাটা সম্পূর্ণ করলেই আপনি পাবেন <em>' + amt + ' ডিসকাউন্ট অফার</em>। এই অফার উপভোগ করুন পরবর্তী <b>' + bd(L.min) + '৳ বা তার বেশি</b> মূল্যের যেকোনো অর্ডারে।</p>' +
      '<ol class="rw-steps" aria-label="Your progress: ' + done + ' of ' + L.orders + '">' + dots + '</ol>' +
      (done >= L.orders ? '<p class="rw-won">অভিনন্দন! আপনি অফারটি আনলক করেছেন। ' + amt + ' ডিসকাউন্ট নিতে ' + (me && me.loyaltyCode ? '<button type="button" class="rw-code" data-copy="' + esc(me.loyaltyCode) + '" title="Tap to copy">' + esc(me.loyaltyCode) + '</button>' : 'প্রমো কোড') + ' এই প্রমো কোডটি Cart এ ব্যবহার করুন (একবার প্রযোজ্য, ' + bd(L.min) + '৳ বা তার বেশি অর্ডারে)।</p>' : '') +
      '<div class="rw-foot"><button class="btn btn-primary" data-action="all"><span class="btn-text">Shopping শুরু করুন</span> ' + ic('arrow') + '</button>' +
      (S.api && !me ? '<button type="button" class="rw-link" data-action="orders">Progress দেখতে Sign in করুন</button>' : '') + '</div>';
    box.hidden = false;
  }
  /* ---------- ব্যাজের বর্ডার: ছবির রং দেখে নিজে ঠিক করে (গাঢ় ছবিতে সাদা, হালকা ছবিতে কালচে) ---------- */
  (function () {
    var cv = document.createElement('canvas'), cx = cv.getContext && cv.getContext('2d', { willReadFrequently: true });
    function tone(img) {
      var box = img.parentNode, b = box && box.querySelector && box.querySelector('.badge');
      if (box && box.classList) box.classList.add('ready');   // ছবি এসেছে: skeleton এর ঝিলিক বন্ধ (স্ক্রলে কাজ কমে)
      if (!cx || !b || !img.naturalWidth || img.dataset.toned) return;
      img.dataset.toned = '1';
      try {
        var W = img.naturalWidth, H = img.naturalHeight, m = Math.min(W, H), sx = (W - m) / 2, sy = (H - m) / 2;   // object-fit: cover (বর্গ)
        cv.width = cv.height = 16;
        cx.drawImage(img, sx, sy, m * .5, m * .22, 0, 0, 16, 16);                                               // ব্যাজের জায়গা: ওপরের-বাঁ অংশ
        var d = cx.getImageData(0, 0, 16, 16).data, sum = 0, n = d.length / 4;
        for (var i = 0; i < d.length; i += 4) sum += (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
        b.style.setProperty('--bd', sum / n > 0.55 ? 'rgba(60,60,60,.22)' : 'rgba(255,255,255,.3)');
      } catch (e) { /* ছবি পড়া না গেলে ডিফল্ট বর্ডার থাকবে */ }
    }
    function scan() { $$('.card-img img').forEach(function (im) { if (im.complete) tone(im); }); }
    document.addEventListener('load', function (e) { if (e.target && e.target.tagName === 'IMG') tone(e.target); }, true);
    document.addEventListener('error', function (e) { var t = e.target; if (t && t.tagName === 'IMG' && t.parentNode && t.parentNode.classList) t.parentNode.classList.add('ready'); }, true);
    var raf = 0; new MutationObserver(function () { if (!raf) raf = requestAnimationFrame(function () { raf = 0; scan(); }); }).observe(document.body, { childList: true, subtree: true });
    scan();
  })();
  /* ব্লার সবসময় চালু। শুধু ধীর ফোনে নিজে বন্ধ করতে চাইলে ঠিকানার শেষে ?lite=1 দিন (বন্ধ: ?lite=0)। আগের সেভ হওয়া স্বয়ংক্রিয় lite মুছে ফেলা হয়। */
  (function () {
    var q = /[?&]lite=([01])/.exec(location.search);
    try { if (q) localStorage.setItem('mb_lite', q[1]); else localStorage.removeItem('mb_lite'); } catch (e) {}
    if (q && q[1] === '1') document.documentElement.classList.add('lite');
  })();
  function renderStatic() {
    renderAnnouncement(); renderReward();
    $('#dealsRow').innerHTML = P.filter(function (p) { return p.hot; }).map(card).join('');
    $('#popularGrid').innerHTML = P.filter(function (p) { return p.popular; }).map(card).join('');
    $('#chips').innerHTML = S.categories.map(function (c) {
      return '<button class="chip" data-tag="' + c.tag + '"><span class="cc">' + ic(c.icon) + '</span><span>' + c.label + '</span></button>';
    }).join('');
    var sc = S.social || {};
    var soc = [['facebook', sc.facebook], ['instagram', sc.instagram], ['whatsapp', 'https://wa.me/' + S.whatsapp], ['messenger', sc.messenger], ['youtube', sc.youtube]];
    $('#footAddr').innerHTML = (S.address ? '<span>' + ic('pin') + esc(S.address) + '</span>' : '') + '<a href="tel:+88' + esc(String(S.phoneDisplay).replace(/\D/g, '')) + '">' + ic('phone') + esc(S.phoneDisplay) + '</a>' + (S.email ? '<a href="mailto:' + esc(S.email) + '">' + ic('mail') + esc(S.email) + '</a>' : '') + (S.hours ? '<span>' + ic('clock') + esc(S.hours) + '</span>' : '');
    $('#socials').innerHTML = soc.filter(function (x) { return x[1]; }).map(function (x) {
      var label = x[0].charAt(0).toUpperCase() + x[0].slice(1);
      return '<a href="' + esc(x[1]) + '" target="_blank" rel="noopener" aria-label="' + label + '">' + ic(x[0]) + '</a>';
    }).join('');
    var sorts = [['default', 'Default'], ['low', 'Price: low to high'], ['high', 'Price: high to low'], ['disc', 'Biggest discount']];
    $('#sortPop').innerHTML = sorts.map(function (s) { return '<button role="menuitemradio" data-sort="' + s[0] + '">' + s[1] + ic('check') + '</button>'; }).join('');
    $('#menuList').innerHTML = S.menu.map(function (m, i) {
      var main = m.action ? 'data-action="' + m.action + '"' : 'data-tag="' + m.tag + '"';
      return '<li class="mi"><div class="mrow"><button class="mlabel" ' + main + '>' + ic(m.icon) + '<span>' + m.label + '</span></button>' +
        (m.sub ? '<button class="marrow" data-sub="' + i + '" aria-expanded="false" aria-label="Open ' + m.label + ' submenu">' + ic('chev') + '</button>' : '') + '</div>' +
        (m.sub ? '<div class="subwrap"><ul>' + m.sub.map(function (s) { return '<li><button data-tag="' + s.tag + '">' + s.label + '</button></li>'; }).join('') + '</ul></div>' : '') + '</li>';
    }).join('');
    // কনফেটি
    var cf = ''; for (var i = 0; i < 22; i++) cf += '<i style="left:' + (4 + i * 4.3) + '%;animation-delay:' + ((i % 7) * 0.07) + 's;transform:rotate(' + (i * 37) + 'deg);background:' + (i % 3 ? 'var(--accent)' : (i % 2 ? 'var(--good)' : 'var(--accent-strong)')) + '"></i>';
    $('.confetti').innerHTML = cf;
  }

  /* ---------- হিরো (পুরো ছবির ব্যানার, ক্লিক করলে প্রোডাক্টে যায়) ---------- */
  var heroIdx = 0, heroTimer;
  function renderHero() {
    var tr = $('#heroTrack');
    $('.hero').hidden = !S.hero.length; if (!S.hero.length) return;
    tr.innerHTML = S.hero.map(function (s) {
      var img = '<img src="' + s.img + '" alt="' + esc(s.alt || '') + '">';
      var pict = s.imgMobile ? '<picture><source media="(max-width: 640px)" srcset="' + s.imgMobile + '">' + img + '</picture>' : img;
      var target = s.product ? ' data-open="' + s.product + '"' : '';
      if (!s.product && s.url) return '<a class="slide" href="' + esc(s.url) + '" aria-label="' + esc(s.alt || 'Offer') + '">' + pict + '</a>';
      return '<button class="slide"' + target + ' aria-label="' + esc((s.alt || 'Offer') + ' – view product') + '">' + pict + '</button>';
    }).join('');
    $('#heroDots').innerHTML = S.hero.map(function (s, i) { return '<button aria-label="Banner ' + (i + 1) + '" data-dot="' + i + '"></button>'; }).join('');
    var setDot = function () { $$('#heroDots button').forEach(function (d, i) { d.classList.toggle('on', i === heroIdx); }); };
    setDot();
    tr.addEventListener('scroll', function () { var i = Math.round(tr.scrollLeft / tr.clientWidth); if (i !== heroIdx) { heroIdx = i; setDot(); } }, { passive: true });
    var go = function (i) { tr.scrollTo({ left: i * tr.clientWidth, behavior: 'smooth' }); };
    $('#heroDots').addEventListener('click', function (e) { var b = e.target.closest('[data-dot]'); if (b) { go(+b.dataset.dot); restart(); } });
    var stop = function () { clearInterval(heroTimer); };
    var restart = function () { stop(); if (matchMedia('(prefers-reduced-motion: reduce)').matches || S.hero.length < 2) return; heroTimer = setInterval(function () { go((heroIdx + 1) % S.hero.length); }, 5000); };
    ['pointerdown', 'focusin', 'mouseenter'].forEach(function (ev) { tr.addEventListener(ev, stop); });
    ['pointerup', 'focusout', 'mouseleave'].forEach(function (ev) { tr.addEventListener(ev, restart); });
    restart();
  }

  /* ---------- লেয়ার ---------- */
  var scrim = $('#scrim');
  function show(el) {
    if (layers.indexOf(el) > -1) return;
    el.classList.add('open'); el.setAttribute('aria-hidden', 'false');
    if (el.id === 'cart') prefill();
    if (el.id === 'cart' && lastOfferFree && !celebrated) setTimeout(celebrate, 380);   // কার্ট খুললে অফার পাওয়া থাকলে একবার উদযাপন
    layers.push(el); scrim.classList.add('show'); document.body.classList.add('lock');
    var f = $('[data-close]', el); if (f) setTimeout(function () { try { f.focus({ preventScroll: true }); } catch (e) {} }, 380);
  }
  function hide(el) {
    el = el || layers[layers.length - 1]; if (!el) return;
    if (el.id === 'product') $('#productBody').innerHTML = '';      // ভিডিও বন্ধ করতে
    el.classList.remove('open'); el.setAttribute('aria-hidden', 'true');
    layers = layers.filter(function (l) { return l !== el; });
    if (!layers.length) { scrim.classList.remove('show'); document.body.classList.remove('lock'); }
  }
  function hideAll() { layers.slice().forEach(hide); }

  /* ---------- কার্টের হিসাব ---------- */
  function lines() { return cart.map(function (l) { var p = byId(l.id); return { key: l.id + '|' + l.v, l: l, p: p, x: vx(p, l.v) }; }); }
  function totals() {
    var L = lines(), sub = 0, count = 0, paid = [], anyFree = false;
    L.forEach(function (o) { sub += o.x.price * o.l.qty; count += o.l.qty; if (o.p.free) anyFree = true; else paid.push(o.p.charge || 0); });
    // ডেলিভারি: কার্টে একটি পণ্যও ফ্রি-ডেলিভারি হলে সব ফ্রি; নাহলে চার্জ-যুক্ত পণ্যগুলোর সর্বোচ্চ চার্জ একবারই
    var fee = anyFree || !paid.length ? 0 : Math.max.apply(null, paid);
    var d = !promoOn ? 0 : promoKind === 'loyalty' ? (sub >= S.loyalty.min ? Math.min(promoAmt, sub) : 0) : Math.round(sub * S.promo.percent / 100);
    // অফার চালু থাকলে নির্দিষ্ট অঙ্কের অর্ডারে ডেলিভারি ফ্রি
    var offer = offerOn(), offerFree = offer && fee > 0 && sub >= S.offer.minOrder;
    var offerLeft = offer && fee > 0 && !offerFree ? S.offer.minOrder - sub : 0;
    if (offerFree) fee = 0;
    return { L: L, sub: sub, count: count, fee: fee, disc: d, total: sub - d + fee, nPaid: anyFree ? 0 : paid.length, anyFree: anyFree, offerFree: offerFree, offerLeft: offerLeft };
  }
  function saveCart() { store.set('manar_cart', cart); }
  function addToCart(id, v, qty) {
    v = v || 0; qty = qty || 1;
    if (!inStock(byId(id))) { toast('Sorry, this item is out of stock'); return; }
    track('cart', id);
    var f = cart.filter(function (l) { return l.id === id && l.v === v; })[0];
    if (f) f.qty = Math.min(f.qty + qty, 99); else cart.push({ id: id, v: v, qty: qty });
    saveCart(); renderCart();
    var b = $('#cartBtn'); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump');
    toast('“' + byId(id).name + '” added to cart');
  }
  /* ---------- অফার বার (কার্টের ওপরে) ও উদযাপন অ্যানিমেশন ---------- */
  var offerWas = null, celebrated = false, lastOfferFree = false, partyTimer;
  function renderOfferBar(t) {
    var bar = $('#offerBar'), min = offerOn() ? S.offer.minOrder : 0;
    // অফার বন্ধ, কার্ট খালি, বা সব পণ্যই আগে থেকে ফ্রি ডেলিভারির হলে বারটি দেখাবে না
    bar.hidden = !(min && t.L.length && (t.nPaid || t.offerFree));
    if (bar.hidden) return;
    var pct = Math.min(100, Math.round(t.sub / min * 100));
    bar.className = 'offer-bar' + (t.offerFree ? ' done' : '');
    bar.innerHTML = '<span class="ob-ic">' + ic(t.offerFree ? 'check' : 'truck') + '</span><div class="ob-txt">' +
      (t.offerFree
        ? '<b>Free delivery unlocked!</b><small>You have achieved the ' + money(min) + ' free delivery offer.</small>'
        : '<b>Add ' + money(t.offerLeft) + ' more to get FREE delivery</b><small>Shop ' + money(min) + ' or more and delivery is on us.</small>') +
      '<span class="ob-track"><i style="width:' + pct + '%"></i></span></div>';
  }
  function celebrate() {
    celebrated = true;
    var fx = $('#partyFx'), cols = ['#F28A1E', '#DB6205', '#FFC857', '#1B8F4C', '#FFFFFF', '#FF6B6B'], h = '';
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      for (var i = 0; i < 70; i++) {
        var a = Math.random() * Math.PI * 2, r = 25 + Math.random() * 55;
        h += '<i style="--dx:' + Math.round(Math.cos(a) * r * 1.1) + 'vw;--dy:' + Math.round(Math.sin(a) * r * .8 - 8) + 'vh;--r:' + Math.round(Math.random() * 720 - 360) + 'deg;--d:' + (Math.random() * .25).toFixed(2) + 's;background:' + cols[i % cols.length] + ';' + (i % 4 === 0 ? 'border-radius:50%;width:9px;height:9px' : '') + '"></i>';
      }
    }
    fx.innerHTML = h;
    $('#partyTxt').textContent = 'You have achieved the ' + money(S.offer.minOrder) + ' free delivery offer.';
    var p = $('#party'); p.hidden = false; p.classList.remove('go'); void p.offsetWidth; p.classList.add('go');
    clearTimeout(partyTimer); partyTimer = setTimeout(function () { p.hidden = true; p.classList.remove('go'); }, 3400);
  }
  function renderCart() {
    var t = totals();
    renderOfferBar(t);
    if (offerWas === false && t.offerFree && !celebrated) celebrate();
    if (!t.offerFree) celebrated = false;
    offerWas = t.offerFree; lastOfferFree = t.offerFree;
    [['#cartDot', t.count], ['#bnDot', t.count]].forEach(function (a) { var e = $(a[0]); e.textContent = a[1]; e.hidden = !a[1]; });
    $('#cartTitle').textContent = 'Your Cart' + (t.count ? ' (' + t.count + ')' : '');
    $('#cartEmpty').hidden = !!t.L.length;
    $('#cartFull').hidden = !t.L.length;
    $('#cartLines').innerHTML = t.L.map(function (o) {
      return '<li class="line"><div class="th">' + pic(o.p) + '</div><div class="l-info"><b>' + esc(o.p.name) + '</b>' +
        (o.p.variants ? '<small>' + o.p.variants[o.l.v].name + '</small>' : '') +
        '<div class="qty"><button type="button" data-cq="' + o.key + '" data-d="-1" aria-label="Decrease quantity">' + ic('minus') + '</button><output>' + o.l.qty + '</output><button type="button" data-cq="' + o.key + '" data-d="1" aria-label="Increase quantity">' + ic('plus') + '</button></div></div>' +
        '<div class="l-end"><button type="button" data-crm="' + o.key + '" aria-label="Remove item">' + ic('trash') + '</button><b>' + money(o.x.price * o.l.qty) + '</b></div></li>';
    }).join('');
    // সামারি: প্রতিটি পণ্যের নাম ও দাম আলাদা লাইনে
    $('#sumItems').innerHTML = t.L.map(function (o) {
      return '<li><span class="n">' + esc(o.p.name) + '<small>' + (o.p.variants ? o.p.variants[o.l.v].name + ' · ' : '') + money(o.x.price) + ' × ' + o.l.qty + '</small></span><span class="p">' + money(o.x.price * o.l.qty) + '</span></li>';
    }).join('');
    $('#sumSub').textContent = money(t.sub);
    var feeTxt = t.fee ? money(t.fee) : '<span style="color:var(--good)">Free</span>';
    var note = '';
    if (t.offerFree) note = '<p class="note offer-note">Free Delivery offer applied on orders of ' + money(S.offer.minOrder) + ' or more.</p>';
    else if (t.fee && t.offerLeft > 0) note = '<p class="note offer-note">Add ' + money(t.offerLeft) + ' more to get free delivery.</p>' + (t.L.length > 1 ? '<p class="note">Delivery is charged once, even with multiple items.</p>' : '');
    else if (t.fee && t.L.length > 1) note = '<p class="note">Delivery is charged once, even with multiple items.</p>';
    else if (!t.fee && t.anyFree && t.L.length > 1) note = '<p class="note">One of your items has free delivery, so your whole order ships free.</p>';
    else if (!t.fee && t.L.length) note = '<p class="note">All your items ship free.</p>';
    $('#bill').innerHTML =
      (promoOn ? '<div class="r disc"><span>' + (promoKind === 'loyalty' ? 'Reward ' + promoCode + (t.disc ? '' : ' (needs ' + money(S.loyalty.min) + '+)') : 'Promo ' + promoCode + ' (' + S.promo.percent + '% off)') + '<button type="button" class="rm" id="rmPromo">Remove</button></span><b>−' + money(t.disc) + '</b></div>' : '') +
      '<div class="r"><span>Delivery charge</span><b>' + feeTxt + '</b></div>' + note +
      '<div class="r total"><span>Total</span><b>' + money(t.total) + '</b></div>';
    updateWa();
  }

  /* ---------- প্রোমো ---------- */
  function applyPromo() {
    var v = $('#promo').value.trim().toUpperCase(), m = $('#promoMsg');
    if (!v) { m.className = 'hint bad'; m.textContent = 'Enter a promo code.'; return; }
    if (S.api) {                                             // সার্ভারে যাচাই: কোডটা কোথাও লেখা থাকে না
      api('promo', { json: { code: v, sub: totals().sub } }).then(function (j) {
        promoOn = true; promoCode = j.code; promoKind = j.kind || 'percent';
        if (promoKind === 'loyalty') { promoAmt = j.amount; renderCart(); m.className = 'hint ok'; m.textContent = '✓ Reward applied. You get ' + money(j.amount) + ' off (one time).'; return; }
        S.promo.percent = j.percent; renderCart();
        m.className = 'hint ok'; m.textContent = '✓ Code applied. You get ' + j.percent + '% off.';
      }, function (e) { promoOn = false; m.className = 'hint bad'; m.textContent = e.message; renderCart(); });
      return;
    }
    if (v !== S.promo.code) { promoOn = false; m.className = 'hint bad'; m.textContent = 'This code is not valid. Please try again.'; renderCart(); return; }
    promoOn = true; promoCode = S.promo.code; renderCart();
    m.className = 'hint ok'; m.textContent = '✓ Code applied. You get ' + S.promo.percent + '% off.';
  }
  function removePromo() { promoOn = false; promoCode = ''; promoKind = 'percent'; $('#promo').value = ''; $('#promoMsg').className = 'hint'; $('#promoMsg').textContent = ''; renderCart(); }

  /* ---------- প্রোডাক্ট বিস্তারিত ---------- */
  function ytId(u) { var m = String(u).match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/); return m ? m[1] : null; }
  function mediaList(p) {
    var items = (p.gallery && p.gallery.length ? p.gallery : (p.img ? [p.img] : [])).map(function (src) { return { type: 'img', src: src }; });
    if (p.video) {
      var id = ytId(p.video);
      items.push({ type: 'video', yt: id, src: p.video, poster: p.videoPoster || (id ? 'https://img.youtube.com/vi/' + id + '/hqdefault.jpg' : (items[0] && items[0].src) || '') });
    }
    return items;
  }
  function openProduct(id) {
    var p = byId(id); if (!p) return;
    track('product', id);
    detail = { id: id, v: 0, qty: 1, g: 0 };
    renderDetail(); show($('#product')); $('#productBody').scrollTop = 0;
  }
  function renderDetail() {
    var p = byId(detail.id), x = vx(p, detail.v), d = disc(p, detail.v), media = mediaList(p), cur = media[detail.g];
    var main;
    if (!cur) main = '<div class="ph">' + ic(p.icon || 'grid') + '</div>';
    else if (cur.type === 'img') main = '<img src="' + cur.src + '" alt="' + esc(p.name) + '">';
    else if (cur.yt) main = '<iframe src="https://www.youtube-nocookie.com/embed/' + cur.yt + '?rel=0&autoplay=1" title="' + esc(p.name) + ' video" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>';
    else main = '<video src="' + cur.src + '" controls autoplay playsinline></video>';
    var thumbs = media.length > 1 ? '<div class="pd-thumbs">' + media.map(function (m, i) {
      return '<button data-g="' + i + '" class="' + (i === detail.g ? 'on ' : '') + (m.type === 'video' ? 'vid' : '') + '" aria-label="' + (m.type === 'video' ? 'Watch video' : 'Image ' + (i + 1)) + '"><img src="' + (m.type === 'video' ? m.poster : m.src) + '" alt="">' + (m.type === 'video' ? ic('play') : '') + '</button>';
    }).join('') + '</div>' : '';
    var vars = p.variants ? '<div><p class="opt-lbl">Choose option</p><div class="vars">' + p.variants.map(function (v, i) { return '<button type="button" data-v="' + i + '" class="' + (i === detail.v ? 'on' : '') + '">' + v.name + '</button>'; }).join('') + '</div></div>' : '';
    // প্রোডাক্টের তথ্য: যে ফিল্ডে মান দেওয়া নেই সেটা দেখাবে না
    var FIELDS = [['brand', 'Brand'], ['model', 'Model'], ['type', 'Category'], ['warranty', 'Warranty'], ['capacity', 'Capacity'], ['watt', 'Power'], ['voltage', 'Operating voltage'],
      ['material', 'Body material'], ['autoOff', 'Auto switch-off'], ['battery', 'Battery capacity'], ['light', 'Light / torch'], ['chargingTime', 'Charging time'], ['usageTime', 'Usage time'], ['eco', 'Eco friendly']];
    var specs = [];
    FIELDS.forEach(function (f) {
      var v = p[f[0]];
      if (f[0] === 'type' && !v) v = catName(p);
      if (v === true) v = 'Yes'; else if (v === false) v = 'No';
      if (v !== undefined && v !== null && String(v).trim() !== '') specs.push([f[1], v]);
    });
    specs = specs.concat((p.specs || []).filter(function (r) { return r[1] !== undefined && String(r[1]).trim() !== ''; }));
    var oos = !inStock(p), dis = oos ? ' disabled' : '';
    var stock = oos
      ? '<div class="stock out"><span class="stock-pill">' + ic('close') + 'Out of stock</span><p>This item is not available right now. Please check back soon or message us on WhatsApp.</p></div>'
      : '<div class="stock ok"><span class="stock-pill">' + ic('check') + 'In stock</span><p>Confirm your order while stock lasts so we can reserve your item.</p></div>';
    var delTxt = p.free ? 'FREE DELIVERY' : 'Delivery ' + money(p.charge || 0) + (offerOn() ? ' · free over ' + money(S.offer.minOrder) : '');
    var rel = P.filter(function (o) { return o.id !== p.id && o.tags.some(function (t) { return p.tags.indexOf(t) > -1; }); }).slice(0, 6);
    $('#productBody').innerHTML =
      '<div class="pd"><div class="pd-gal"><div class="pd-main">' + main + '</div>' + thumbs + '</div>' +
      '<div class="pd-info">' +
      '<h2>' + esc(p.name) + '</h2>' +
      '<div class="pd-price"><b>' + money(x.price) + '</b>' + (x.old ? '<s>' + money(x.old) + '</s><span class="off">' + d + '% OFF</span>' : '') + (p.badge ? '<span class="pill-badge">' + esc(p.badge) + '</span>' : '') + '</div>' +
      (x.old ? '<p class="pd-save">You save ' + money((x.old - x.price) * detail.qty) + (detail.qty > 1 ? ' on ' + detail.qty + ' items' : '') + '</p>' : '') +
      stock +
      '<div class="tags"><span class="tagpill' + (p.free ? ' good' : '') + '">' + '<i class="fd-ic"></i>' + delTxt + '</span><span class="tagpill">' + ic('cash') + 'Cash on Delivery</span></div>' +
      vars +
      '<div class="pd-buy"><div class="qty"><button type="button" data-q="-1" aria-label="Decrease quantity"' + (detail.qty <= 1 || oos ? ' disabled' : '') + '>' + ic('minus') + '</button><output>' + detail.qty + '</output><button type="button" data-q="1" aria-label="Increase quantity"' + dis + '>' + ic('plus') + '</button></div>' +
      '<b class="pd-total" style="font:700 1.1rem var(--font-display);justify-self:end">Total ' + money(x.price * detail.qty) + '</b></div>' +
      (p.about ? '<p class="pd-about">' + esc(p.about) + '</p>' : '') +
      (p.features ? '<div class="pd-sec"><h3>Highlights</h3><ul class="bullets">' + p.features.map(function (t) { return '<li>' + ic('check') + '<span>' + esc(t) + '</span></li>'; }).join('') + '</ul></div>' : '') +
      (specs.length ? '<div class="pd-sec"><h3>Product details</h3><dl class="specs">' + specs.map(function (r) { return '<div><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>'; }).join('') + '</dl></div>' : '') +
      '<div class="trust"><div>' + ic('truck') + 'Delivery all over Bangladesh</div><div>' + ic('cash') + 'Pay on delivery</div><div>' + ic('chat') + 'WhatsApp support</div></div>' +
      '</div>' +
      (rel.length ? '<div class="related pd-full"><h3>You may also like</h3><div class="scroller">' + rel.map(card).join('') + '</div></div>' : '') + '</div>' +
      '<div class="pd-sticky"><button class="btn btn-line btn-lg" data-dadd' + dis + '>Add to Cart</button><button class="btn btn-primary btn-lg" data-dbuy' + dis + '>Buy Now ' + ic('arrow') + '</button></div>';
  }

  /* ---------- আমার অর্ডার ---------- */
  function renderOrders() {
    var os = store.get('manar_orders', []);
    $('#ordersBody').innerHTML = os.length ? os.map(function (o) {
      return '<div class="ord"><div class="h"><b>' + o.id + '</b><span>' + money(o.total) + '</span></div><small>' + o.date + ' · ' + (o.via === 'whatsapp' ? 'WhatsApp' : 'Cash on Delivery') + '</small><ul>' +
        o.items.map(function (i) { return '<li>' + esc(i.name) + ' × ' + i.qty + '</li>'; }).join('') + '</ul></div>';
    }).join('') : '<div class="empty">' + ic('receipt') + '<h3>No orders yet</h3><p>Your orders will show up here.</p></div>';
  }

  /* =====================================================================
     অ্যাকাউন্ট (শুধু ব্যাকএন্ড থাকলে): সাইন আপ, লগইন, প্রোফাইল, অর্ডার ইতিহাস
     ===================================================================== */
  var me = null, myCount, myCode = '', myOrders = [], accTab = 'in', accView = 'home', accMsg = '';
  /* ---------- ভিজিটর ট্র্যাকিং (র‍্যান্ডম আইডি, নাম/ঠিকানা নয়) — অ্যাডমিন ড্যাশবোর্ডের জন্য ---------- */
  var vid = (function () { try { var v = localStorage.getItem('mb_vid'); if (!v) { v = Math.random().toString(36).slice(2, 12) + Date.now().toString(36); localStorage.setItem('mb_vid', v); } return v; } catch (e) { return 'x' + Math.random().toString(36).slice(2, 12); } })();
  function srcOf() {
    var q = location.search, r = document.referrer || '';
    if (/utm_medium=e-?mail/i.test(q)) return 'email';
    var h = ''; try { h = new URL(r).hostname; } catch (e) {}
    if (!h || h === location.hostname) return /utm_source=(facebook|fb|instagram|whatsapp|youtube|tiktok)/i.test(q) ? 'social' : 'direct';
    if (/google|bing|duckduckgo|yahoo|yandex|baidu/.test(h)) return 'search';
    if (/facebook|fb\.|instagram|twitter|t\.co|x\.com|youtube|tiktok|whatsapp|wa\.me|messenger|pinterest|linkedin|telegram/.test(h)) return 'social';
    return 'referral';
  }
  function track(t, pid) {
    if (!S.api) return;
    try { fetch('/api/track', { method: 'POST', keepalive: true, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' }, body: JSON.stringify({ t: t, pid: pid || '', vid: vid, src: t === 'visit' ? srcOf() : '' }) }); } catch (e) {}
  }
  function api(path, o) {
    o = o || {}; var h = { 'X-Requested-With': 'fetch' };
    if (o.json) h['Content-Type'] = 'application/json'; if (o.raw && o.raw.type) h['Content-Type'] = o.raw.type;
    return fetch('/api/' + path, { method: o.method || (o.json || o.raw ? 'POST' : 'GET'), headers: h, credentials: 'same-origin', body: o.json ? JSON.stringify(o.json) : o.raw, keepalive: !!o.keepalive })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (!r.ok) { var e = new Error(j.error || 'Request failed. Please try again.'); e.status = r.status; throw e; } return j;
        });
      });
  }
  var STATUS = { pending: 'Pending', confirmed: 'Confirmed', shipped: 'On the way', delivered: 'Delivered', cancelled: 'Cancelled' };
  function initials(n) { return esc(String(n || '?').trim().split(/\s+/).slice(0, 2).map(function (w) { return w.charAt(0).toUpperCase(); }).join('')); }
  function dateOf(ms) { return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
  function prefill() {
    if (!me) return;
    [['#fName', me.name], ['#fPhone', me.phone], ['#fDist', me.dist], ['#fAddr', me.address]].forEach(function (x) { var e = $(x[0]); if (e && !e.value && x[1]) e.value = x[1]; });
    updateWa();
  }
  function loadMe() {
    return api('me').then(function (j) { me = j.user; myCount = me ? (me.loyaltyProgress != null ? me.loyaltyProgress : me.orderCount) : undefined; myCode = me && me.loyaltyCode || ''; prefill(); renderReward(); pollPending(); return me; }).catch(function () { me = null; });
  }
  /* শুধু অ্যাডমিন/ওনার: নিচের Orders আইকনে নতুন (pending) অর্ডারের সংখ্যা */
  var ordTimer = 0;
  function pollPending() {
    var d = $('#bnOrd'); if (!d) return;
    if (!S.api || !me || (me.role !== 'admin' && me.role !== 'owner')) { d.hidden = true; return; }
    api('admin/stats').then(function (j) { var n = +j.pending || 0; d.textContent = n > 99 ? '99+' : n; d.hidden = !n; }).catch(function () {});
  }
  setInterval(function () { if (!document.hidden) pollPending(); }, 15000);
  function loadMyOrders() { return api('me/orders').then(function (j) { myOrders = j.orders; }).catch(function () { myOrders = []; }); }
  function openAccount() {
    accMsg = ''; accView = 'home'; $('#accBody').innerHTML = '<div class="mbl" role="status" aria-label="Loading"><i></i></div>'; hideAll(); show($('#account'));
    loadMe().then(function () { return me ? loadMyOrders() : null; }).then(renderAccount);
  }
  function msgHtml() { return accMsg ? '<p class="hint ' + (accMsg.charAt(0) === '!' ? 'bad' : 'ok') + '" role="alert">' + esc(accMsg.replace(/^!/, '')) + '</p>' : ''; }
  var EYE = '<svg class="ic eye-on" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg><svg class="ic eye-off" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 5.1A9.8 9.8 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.1 4M6.6 6.6A17 17 0 0 0 2 12s3.6 7 10 7a9.6 9.6 0 0 0 4.4-1M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
  var accLoginPre = '', accSent = false;
  function fld(id, label, type, ph, ac, val) {
    var inp = '<input id="' + id + '" name="' + id + '" type="' + type + '" placeholder="' + ph + '" autocomplete="' + ac + '"' + (val ? ' value="' + esc(val) + '"' : '') + '>';
    if (type === 'password') inp = '<div class="pw">' + inp + '<button type="button" class="pw-eye" aria-label="Show password" aria-pressed="false">' + EYE + '</button></div>';
    return '<div class="field"><label for="' + id + '">' + label + '</label>' + inp + '</div>';
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.pw-eye'); if (!b) return;
    var i = b.parentNode.querySelector('input'), show = i.type === 'password';
    i.type = show ? 'text' : 'password'; b.setAttribute('aria-pressed', show ? 'true' : 'false'); b.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  });
  function ordersHtml(list) {
    return list.length ? list.map(function (o) {
      return '<div class="ord"><div class="h"><b>' + esc(o.number) + '</b><span>' + money(o.total) + '</span></div><small>' + dateOf(o.created) + ' · <i class="st st-' + o.status + '">' + STATUS[o.status] + '</i></small><ul>' +
        o.items.map(function (i) { return '<li>' + esc(i.name) + (i.variant ? ' (' + esc(i.variant) + ')' : '') + ' × ' + i.qty + '</li>'; }).join('') + '</ul>' +
        (o.trackUrl && o.status !== 'cancelled' ? '<a class="trk" href="' + esc(o.trackUrl) + '" target="_blank" rel="noopener noreferrer"><span>Delivery update পেতে এখানে Click করুন</span>' + ic('truck') + '</a>' : '') + '</div>';
    }).join('') : '<div class="empty">' + ic('receipt') + '<h3>No orders yet</h3><p>Your orders will show up here.</p></div>';
  }
  function renderAccount() {
    var b = $('#accBody'), t = $('#accTitle');
    if (!me) {
      t.textContent = accTab === 'in' ? 'Sign in' : accTab === 'fg' ? 'Forgot password' : 'Create account';
      var local = store.get('manar_orders', []);
      if (accTab === 'fg') {
        var wm = encodeURIComponent('Hello Manar BD, I forgot my password. My account: ' + (accLoginPre || '') + '. Please help me reset it.');
        b.innerHTML = '<form class="acc-form" data-acc-form="fg" novalidate>' + msgHtml() +
          '<p class="acc-note" style="margin-top:0">আপনার account এর Email বা মোবাইল নম্বর দিন। আমরা যাচাই করে নতুন একটি temporary password দেব, তারপর Sign in করে Settings থেকে নিজের পছন্দের password দিন।</p>' +
          fld('fLogin', 'Email or mobile number', 'text', 'name@email.com or 01XXXXXXXXX', 'username', accLoginPre) +
          '<button class="btn btn-primary btn-lg btn-block" type="submit"><span class="btn-text">Send reset request</span></button>' +
          (accSent ? '<a class="btn btn-wa btn-lg btn-block" href="https://wa.me/' + S.whatsapp + '?text=' + wm + '" target="_blank" rel="noopener"><span class="btn-text">' + ic('chat') + 'Message us on WhatsApp to speed it up</span></a>' : '') +
          '<button type="button" class="link-btn" data-acc-tab="in">← Back to sign in</button></form>';
        return;
      }
      b.innerHTML = '<div class="acc-tabs" role="tablist"><button type="button" data-acc-tab="in" class="' + (accTab === 'in' ? 'on' : '') + '">Sign in</button><button type="button" data-acc-tab="up" class="' + (accTab === 'up' ? 'on' : '') + '">Create account</button></div>' +
        '<form class="acc-form" data-acc-form="' + accTab + '" novalidate>' + msgHtml() +
        (accTab === 'up' ? fld('aName', 'Your name', 'text', 'Full name', 'name') : '') +
        fld('aLogin', 'Email or mobile number', 'text', 'name@email.com or 01XXXXXXXXX', 'username', accLoginPre) +
        fld('aPass', 'Password', 'password', accTab === 'up' ? 'At least 6 characters' : 'Your password', accTab === 'up' ? 'new-password' : 'current-password') +
        (accTab === 'up' ? fld('aConf', 'Confirm password', 'password', 'Type the password again', 'new-password') : '') +
        '<button class="btn btn-primary btn-lg btn-block" type="submit"><span class="btn-text">' + (accTab === 'in' ? 'Sign in' : 'Create account') + '</span></button>' +
        (accTab === 'in' ? '<button type="button" class="link-btn fg" data-acc-tab="fg">Forgot password?</button>' : '') + '<p class="acc-note">' + (accTab === 'in' ? 'Account না থাকলে নতুন করে Sign up করুন, order দিতে account লাগবে।' : 'OTP লাগবে না। Phone নম্বর বা Email দিয়ে Sign up করলেই account তৈরি, আপনার সব order এখানে দেখতে পারবেন।') + '</p></form>' +
        (local.length ? '<h3 class="acc-h">Orders on this device</h3>' + local.slice(0, 5).map(function (o) { return '<div class="ord"><div class="h"><b>' + o.id + '</b><span>' + money(o.total) + '</span></div><small>' + o.date + '</small></div>'; }).join('') : '');
      return;
    }
    var spent = myOrders.filter(function (o) { return o.status !== 'cancelled'; }).reduce(function (a, o) { return a + o.total; }, 0);
    if (accView === 'edit') {
      t.textContent = 'Edit profile';
      b.innerHTML = '<form class="acc-form" data-acc-form="edit" novalidate>' + msgHtml() + fld('eName', 'Your name', 'text', 'Full name', 'name', me.name) + fld('eEmail', 'Email', 'email', 'name@email.com', 'email', me.email) +
        fld('ePhone', 'Mobile number', 'tel', '01XXXXXXXXX', 'tel', me.phone) + fld('eDist', 'District / Area', 'text', 'e.g. Dhaka, Mirpur', 'address-level2', me.dist) +
        '<div class="field"><label for="eAddr">Full address</label><textarea id="eAddr" rows="3" placeholder="House / road / area" autocomplete="street-address">' + esc(me.address) + '</textarea></div>' +
        '<button class="btn btn-primary btn-lg btn-block" type="submit"><span class="btn-text">Save changes</span></button>' +
        '<button class="btn btn-line btn-lg btn-block" type="button" data-acc-go="settings"><span class="btn-text">Cancel</span></button></form>';
      return;
    }
    if (accView === 'pw') {
      t.textContent = 'Change password';
      b.innerHTML = '<form class="acc-form" data-acc-form="pw" novalidate>' + msgHtml() + fld('pCur', 'Current password', 'password', 'Current password', 'current-password') + fld('pNew', 'New password', 'password', 'At least 6 characters', 'new-password') +
        fld('pConf', 'Confirm new password', 'password', 'Type it again', 'new-password') + '<button class="btn btn-primary btn-lg btn-block" type="submit"><span class="btn-text">Update password</span></button>' +
        '<button class="btn btn-line btn-lg btn-block" type="button" data-acc-go="settings"><span class="btn-text">Cancel</span></button></form>';
      return;
    }
    if (accView === 'settings') {
      t.textContent = 'Settings';
      b.innerHTML = msgHtml() + '<div class="acc-menu">' +
        '<button type="button" class="acc-item" data-acc-go="edit"><i>' + ic('user') + '</i><span><b>Edit profile</b><small>নাম, মোবাইল, ঠিকানা বদলান</small></span>' + ic('chev') + '</button>' +
        '<button type="button" class="acc-item" data-acc-go="pw"><i>' + ic('lock') + '</i><span><b>Change password</b><small>নতুন password সেট করুন</small></span>' + ic('chev') + '</button></div>' +
        '<button class="btn btn-line btn-lg btn-block" type="button" data-acc-go="home"><span class="btn-text">Back</span></button>';
      return;
    }
    t.textContent = 'My Account';
    b.innerHTML = msgHtml() + '<div class="acc-head"><label class="avatar" title="Change photo">' + (me.avatar ? '<img src="' + esc(me.avatar) + '" alt="">' : '<span>' + initials(me.name) + '</span>') +
      '<input type="file" accept="image/*" id="avatarIn" hidden><i>' + ic('plus') + '</i></label><div><h3>' + esc(me.name) + '</h3><p>' + esc(me.email || me.phone || '') + '</p>' +
      (me.role !== 'customer' ? '<span class="role">' + (me.role === 'owner' ? 'Owner' : 'Admin') + '</span>' : '') + '</div></div>' +
      '<div class="acc-stats"><div><b>' + myOrders.length + '</b><span>Orders</span></div><div><b>' + money(spent) + '</b><span>Total spent</span></div></div>' +
      (me.role !== 'customer' ? '<a class="btn btn-primary btn-block acc-admin" href="/admin/"><span class="btn-text">Open admin panel</span></a>' : '') +
      '<div class="acc-two"><button class="btn btn-line btn-block" type="button" data-acc-go="settings"><span class="btn-text">' + ic('gear') + 'Settings</span></button>' +
      '<button class="btn btn-line btn-block acc-out" type="button" data-acc-out><span class="btn-text">' + ic('out') + 'Sign out</span></button></div>' +
      '<h3 class="acc-h">My orders</h3>' + ordersHtml(myOrders);
  }
  function accSubmit(form) {
    var k = form.dataset.accForm, v = function (id) { var e = form.querySelector('#' + id); return e ? e.value.trim() : ''; }, btn = $('button[type=submit]', form);
    var run = function (p, done) {
      btn.disabled = true;
      p.then(done, function (e) {                    // ভুল হলে ফর্ম আবার আঁকি না, তাই লেখা মুছে যায় না
        var m = form.querySelector('.hint'); if (!m) { m = document.createElement('p'); form.insertBefore(m, form.firstChild); }
        m.className = 'hint bad'; m.setAttribute('role', 'alert'); m.textContent = e.message;
        if (k === 'in' && e.status === 404) { accLoginPre = v('aLogin'); var cb = document.createElement('button'); cb.type = 'button'; cb.className = 'link-btn'; cb.setAttribute('data-acc-tab', 'up'); cb.textContent = 'Create account'; m.appendChild(document.createTextNode(' ')); m.appendChild(cb); }
      }).then(function () { if (btn) btn.disabled = false; });
    };
    if (k === 'in') run(api('auth/login', { json: { login: v('aLogin'), password: form.querySelector('#aPass').value } }), authDone);
    else if (k === 'fg') { accLoginPre = v('fLogin'); run(api('auth/forgot', { json: { login: accLoginPre } }), function () { accSent = true; accMsg = 'Request sent. We will message you the temporary password soon. WhatsApp us to get it faster.'; renderAccount(); }); }
    else if (k === 'up') run(api('auth/register', { json: { name: v('aName'), login: v('aLogin'), password: form.querySelector('#aPass').value, confirm: form.querySelector('#aConf').value } }), authDone);
    else if (k === 'edit') run(api('me', { method: 'PATCH', json: { name: v('eName'), email: v('eEmail'), phone: v('ePhone'), dist: v('eDist'), address: form.querySelector('#eAddr').value } }), function (j) { me = j.user; accMsg = 'Profile saved.'; accView = 'home'; renderAccount(); });
    else if (k === 'pw') run(api('me/password', { json: { current: form.querySelector('#pCur').value, password: form.querySelector('#pNew').value, confirm: form.querySelector('#pConf').value } }), function () { accMsg = 'Password updated.'; accView = 'home'; renderAccount(); });
  }
  function authDone(j) { me = j.user; accMsg = ''; accView = 'home'; prefill(); renderReward(); loadMe(); loadMyOrders().then(function () { if (gate) { gate = false; hide($('#account')); toast('Welcome, ' + me.name.split(' ')[0] + '! এখন আপনার order confirm করুন।'); } else { renderAccount(); toast('Welcome, ' + me.name.split(' ')[0] + '!'); } }); }
  function resizeSquare(file, size) {
    return new Promise(function (res, rej) {
      var img = new Image(), u = URL.createObjectURL(file);
      img.onload = function () {
        var c = document.createElement('canvas'), s = Math.min(img.width, img.height); c.width = c.height = size;
        c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size); URL.revokeObjectURL(u);
        c.toBlob(function (b) { b ? res(b) : rej(new Error('Could not read this image.')); }, 'image/jpeg', .85);
      };
      img.onerror = function () { rej(new Error('Could not read this image.')); }; img.src = u;
    });
  }
  document.addEventListener('submit', function (e) { var f = e.target.closest && e.target.closest('[data-acc-form]'); if (f) { e.preventDefault(); accSubmit(f); } });
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-acc-tab],[data-acc-go],[data-acc-out]'); if (!t) return;
    if (t.dataset.accTab) { accTab = t.dataset.accTab; accMsg = ''; if (accTab !== 'fg') accSent = false; renderAccount(); }
    else if (t.dataset.accGo) { accView = t.dataset.accGo; accMsg = ''; renderAccount(); }
    else if (t.hasAttribute('data-acc-out')) api('auth/logout', { method: 'POST', json: {} }).then(function () { me = null; myCount = undefined; myCode = ''; renderReward(); myOrders = []; accTab = 'in'; accMsg = ''; renderAccount(); toast('Signed out'); });
  });
  document.addEventListener('change', function (e) {
    if (e.target.id !== 'avatarIn' || !e.target.files[0]) return;
    resizeSquare(e.target.files[0], 256).then(function (blob) { return api('me/avatar', { raw: blob }); })
      .then(function (j) { me.avatar = j.avatar; accMsg = 'Photo updated.'; renderAccount(); }, function (er) { accMsg = '!' + er.message; renderAccount(); });
  });
  if (S.api) { loadMe(); track('visit'); }
  /* অর্ডার কনফার্মের আগে অ্যাকাউন্ট লাগবে: না থাকলে সাইন আপ / সাইন ইন পপ-আপ আসে */
  var gate = false;
  function needAccount() {
    if (!S.api || me || S.requireLogin === false) return false;
    gate = true; accTab = 'up'; accView = 'home'; accMsg = '';
    renderAccount(); $('#accTitle').textContent = 'Account খুলুন'; show($('#account'));
    return true;
  }
  function placeOrder(via, keep) {
    return api('orders', { keepalive: keep, json: { via: via, promo: promoOn ? promoCode : '', items: cart.map(function (l) { return { id: l.id, v: l.v, qty: l.qty }; }),
      hp: ($('#fWeb') || {}).value || '', ms: Date.now() - (window.__cartAt || T0), customer: { name: fval('name'), phone: fval('phone'), dist: fval('dist'), addr: fval('addr'), note: $('#fNote').value.trim() } } });
  }

  /* ---------- ফর্ম ও অর্ডার ---------- */
  var F = { name: '#fName', phone: '#fPhone', dist: '#fDist', addr: '#fAddr' };
  function fval(k) { return $(F[k]).value.trim(); }
  function validate() {
    var errs = {}, ph = toEn(fval('phone')).replace(/[\s-]/g, '');
    if (fval('name').length < 2) errs.fName = 'Please enter your name.';
    if (!/^(\+?88)?01[3-9]\d{8}$/.test(ph)) errs.fPhone = 'Enter a valid 11-digit mobile number (e.g. 01712345678).';
    if (fval('dist').length < 2) errs.fDist = 'Enter your district or area.';
    if (fval('addr').length < 6) errs.fAddr = 'Enter your full address (house / road / area).';
    if (!$('#payCod').checked) errs.payCod = 'Tick Cash on Delivery to place your order.';
    $$('[data-err]').forEach(function (e) { var m = errs[e.dataset.err]; e.textContent = m || ''; (e.closest('.field') || e.closest('.pay')).classList.toggle('bad', !!m); });
    var first = Object.keys(errs)[0];
    if (first) { var el = $('#' + first); try { el.focus({ preventScroll: true }); } catch (x) {} el.closest('.field, .pay').scrollIntoView({ block: 'center', behavior: 'smooth' }); return false; }
    return true;
  }
  function orderText(id) {
    var t = totals(), n = 0;
    var L = t.L.map(function (o) { n++; return n + '. ' + o.p.name + (o.p.variants ? ' (' + o.x.name + ')' : '') + ' × ' + o.l.qty + ' = ' + money(o.x.price * o.l.qty); });
    return ['New order – ' + S.name + (id ? ' (' + id + ')' : ''), ''].concat(L, ['',
      'Subtotal: ' + money(t.sub)], promoOn ? ['Promo ' + promoCode + ': −' + money(t.disc)] : [], ['Delivery: ' + (t.fee ? money(t.fee) : 'Free'), 'Total: ' + money(t.total), '',
      'Name: ' + fval('name'), 'Mobile: ' + fval('phone'), 'District: ' + fval('dist'), 'Address: ' + fval('addr')], $('#fNote').value.trim() ? ['Note: ' + $('#fNote').value.trim()] : [], ['Payment: Cash on Delivery']).join('\n');
  }
  function updateWa() { $('#waBtn').href = 'https://wa.me/' + S.whatsapp + '?text=' + encodeURIComponent(orderText()); }
  function finalize(via, id) {
    var t = totals();
    id = id || ('MB-' + Math.floor(100000 + Math.random() * 900000));
    var o = { id: id, via: via, total: t.total, name: fval('name'), date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }), items: t.L.map(function (x) { return { name: x.p.name, qty: x.l.qty }; }) };
    var os = store.get('manar_orders', []); os.unshift(o); store.set('manar_orders', os.slice(0, 30));
    cart = []; saveCart(); promoOn = false; $('#promo').value = ''; $('#promoMsg').textContent = ''; $('#promoMsg').className = 'hint';
    $('#orderForm').reset(); renderCart();
    hide($('#cart'));
    $('#okName').textContent = o.name; $('#okId').textContent = o.id; $('#okTotal').textContent = money(o.total);
    $('#okPay').textContent = via === 'whatsapp' ? 'WhatsApp + Cash on Delivery' : 'Cash on Delivery';
    setTimeout(function () { show($('#success')); }, 380);
  }

  /* ব্লক করা নম্বরে অর্ডার হলে পরিষ্কার বার্তা */
  function blockedBox(msg) {
    var d = document.createElement('div'); d.className = 'mb-dlg'; d.setAttribute('role', 'alertdialog'); d.setAttribute('aria-modal', 'true');
    d.innerHTML = '<div class="mb-dlg-box"><div class="mb-dlg-ic">!</div><h3>অর্ডার করা যায়নি</h3><p>' + esc(msg && /^[^\u0980-\u09FF]*$/.test(msg) ? 'দুঃখিত, আগের ভুয়া বা বারবার অর্ডারের কারণে এই মোবাইল নম্বর দিয়ে এখন অনলাইনে অর্ডার করা যাচ্ছে না। এটা ভুল হয়ে থাকলে অনুগ্রহ করে WhatsApp-এ আমাদের জানান, আমরা দেখব।' : msg) + '</p><a class="btn btn-wa btn-block" href="https://wa.me/' + S.whatsapp + '" target="_blank" rel="noopener">WhatsApp-এ যোগাযোগ করুন</a><button class="btn btn-block mb-dlg-x" type="button">ঠিক আছে</button></div>';
    d.addEventListener('click', function (e) { if (e.target === d || e.target.closest('.mb-dlg-x')) d.remove(); });
    document.body.appendChild(d);
  }
  /* ---------- টোস্ট ও নেভিগেশন ---------- */
  var tt; function toast(m) { var e = $('#toast'); e.textContent = m; e.classList.add('show'); clearTimeout(tt); tt = setTimeout(function () { e.classList.remove('show'); }, 2400); }
  /* মাঝারি গতির মসৃণ স্ক্রল: দূরত্ব অনুযায়ী ৪২০–৮০০ms, শুরু ও শেষে ধীর */
  var scrollRaf = 0;
  function smoothTo(y) {
    var y0 = window.pageYOffset, dy = y - y0; cancelAnimationFrame(scrollRaf);
    if (!dy) return;
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) { window.scrollTo(0, y); return; }
    var dur = Math.max(420, Math.min(800, Math.abs(dy) * .45)), t0 = null;
    function stop() { cancelAnimationFrame(scrollRaf); window.removeEventListener('touchstart', stop); window.removeEventListener('wheel', stop); }
    window.addEventListener('touchstart', stop, { passive: true }); window.addEventListener('wheel', stop, { passive: true });
    function step(t) { if (t0 === null) t0 = t; var p = Math.min(1, (t - t0) / dur), e = p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; window.scrollTo(0, y0 + dy * e); if (p < 1) scrollRaf = requestAnimationFrame(step); else stop(); }
    scrollRaf = requestAnimationFrame(step);
  }
  function scrollTo(sel) { var e = $(sel); if (e) { var y = e.getBoundingClientRect().top + window.scrollY - 80; smoothTo(Math.max(0, y)); } }
  function setTag(tag) {
    st.tag = tag; st.q = ''; $('#q').value = ''; st.limit = 12; renderAll(); hideAll();
    setTimeout(function () { scrollTo('#chips'); }, 60);
  }
  function goHome() { st.tag = 'all'; st.q = ''; $('#q').value = ''; renderAll(); hideAll(); smoothTo(0); }
  function action(a) {
    if (a === 'home') goHome();
    else if (a === 'menu') show($('#menu'));
    else if (a === 'cart') { window.__cartAt = Date.now(); show($('#cart')); if (cart.length) track('checkout'); }
    else if (a === 'about' || a === 'support' || POL[a]) showInfo(a);
    else if (a === 'account') openAccount();
    else if (a === 'orders') { if (S.api) openAccount(); else { renderOrders(); hideAll(); show($('#orders')); } }
    else if (a === 'deals') { st.tag = 'all'; st.q = ''; $('#q').value = ''; renderAll(); hideAll(); setTimeout(function () { scrollTo('#deals'); }, 60); }
    else if (a === 'all') { st.tag = 'all'; st.q = ''; $('#q').value = ''; st.limit = 99; renderAll(); hideAll(); setTimeout(function () { scrollTo('#all'); }, 60); }
  }

  var T0 = Date.now();
  /* ---------- পলিসি পেজ (ইংরেজি; আপনি যা মানতে পারবেন সেই অনুযায়ী বদলে নিন) ---------- */
  var POL = {
    privacy: ['Privacy Policy', [
      ['What we collect', 'When you order or create an account we keep your name, mobile number, email (if given), delivery address and order history. We also count anonymous visits and which products are viewed, to improve the shop. If you are signed in, this activity is linked to your account.'],
      ['How we use it', 'Only to confirm and deliver your order, contact you about it, give you your rewards, prevent fake orders and improve the store. We do not sell your information.'],
      ['Who sees it', 'Our team and the courier who delivers your order (name, phone and address only). We may share information if the law requires it.'],
      ['Your choices', 'You can edit your details in My Account. To delete your account or data, message us on WhatsApp and we will do it.'],
      ['Cookies', 'We use a secure sign-in cookie and a small local ID so the cart, theme and sign-in work. Nothing else is stored for advertising.']]],
    returns: ['Return & Refund Policy', [
      ['Check on delivery', 'Please open and check the parcel in front of the delivery person. If the product is wrong, damaged or not as described, do not accept it, or message us on WhatsApp the same day with photos.'],
      ['Return window', 'You can ask for a return or exchange within 3 days of delivery for damaged, defective or wrong items. The product must be unused and in its original packaging.'],
      ['Refunds', 'Approved refunds are paid back by bKash/Nagad or bank transfer after we receive and check the item. Delivery charges are not refunded unless the mistake is ours.'],
      ['Not returnable', 'Used items, items without original packaging, and personal-care products that have been opened.']]],
    delivery: ['Delivery Information', [
      ['Where we deliver', 'All over Bangladesh through trusted couriers.'],
      ['Time', 'Dhaka usually 1–3 working days; outside Dhaka usually 2–5 working days. Holidays and bad weather can cause delays.'],
      ['Delivery charge', 'The delivery fee is shown at checkout before you confirm. Orders above the free-delivery amount on the offer banner ship free.'],
      ['Payment', 'Cash on Delivery. Pay the delivery person when you receive and check your parcel.'],
      ['Tracking', 'When your order is handed to the courier, a Delivery update button appears in My Account → My orders.']]],
    terms: ['Terms & Conditions', [
      ['Orders', 'An order is confirmed after we contact you or ship it. We may cancel orders with wrong details, out-of-stock items or suspected fake orders.'],
      ['Prices', 'Prices are in Bangladeshi Taka (৳) and may change without notice. The price at checkout is the price you pay.'],
      ['Offers', 'Promo codes and rewards have their own rules and can be changed or ended. A reward code works only on the account that earned it, once.'],
      ['Accounts', 'Keep your password safe. You are responsible for activity on your account.'],
      ['Contact', 'Questions about these terms? Message us on WhatsApp.']]]
  };
  function showInfo(kind) {
    var wa = 'https://wa.me/' + S.whatsapp;
    if (POL[kind]) {
      $('#infoTitle').textContent = POL[kind][0];
      $('#infoBody').innerHTML = '<div class="info-body pol">' + POL[kind][1].map(function (s) { return '<h3>' + esc(s[0]) + '</h3><p class="info-p">' + esc(s[1]) + '</p>'; }).join('') +
        '<p class="pol-note">Questions? WhatsApp us on <b>' + esc(S.phoneDisplay) + '</b>.</p><a class="btn btn-wa btn-lg" href="' + wa + '" target="_blank" rel="noopener">' + ic('chat') + 'Chat on WhatsApp</a></div>';
      hideAll(); show($('#info')); return;
    }
    $('#infoTitle').textContent = kind === 'about' ? 'About Us' : 'Order Support';
    $('#infoBody').innerHTML = kind === 'about'
      ? '<div class="info-body"><p class="info-p">' + esc(S.about) + '</p><ul class="info-list"><li>' + ic('truck') + '<span>Delivery all over Bangladesh</span></li><li>' + ic('cash') + '<span>Cash on Delivery</span></li><li>' + ic('chat') + '<span>WhatsApp support</span></li></ul></div>'
      : '<div class="info-body"><p class="info-p">Questions about an order or a product? Message us and include your order number if you have one.</p><ul class="info-list"><li>' + ic('chat') + '<span>WhatsApp / Call: <b>' + esc(S.phoneDisplay) + '</b></span></li>' + (S.address ? '<li>' + ic('pin') + '<span>' + esc(S.address) + '</span></li>' : '') + (S.hours ? '<li>' + ic('clock') + '<span>' + esc(S.hours) + '</span></li>' : '') + (S.email ? '<li>' + ic('mail') + '<span>' + esc(S.email) + '</span></li>' : '') + '</ul><a class="btn btn-wa btn-lg" href="' + wa + '" target="_blank" rel="noopener">' + ic('chat') + 'Chat on WhatsApp</a></div>';
    hideAll(); show($('#info'));
  }

  /* ---------- ইভেন্ট ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target;
    var el;
    if ((el = t.closest('[data-add]'))) {
      e.stopPropagation(); var p = byId(el.dataset.add);
      if (!inStock(p)) { toast('Sorry, this item is out of stock'); return; }
      if (p.variants) openProduct(p.id); else addToCart(p.id, 0, 1);
      return;
    }
    if ((el = t.closest('[data-open]'))) {
      openProduct(el.dataset.open);
      if (t.closest('#product')) { var pb = $('#productBody'); pb.scrollTop = 0; }
      return;
    }
    if ((el = t.closest('[data-sub]'))) {
      var mi = el.closest('.mi'), on = !mi.classList.contains('open');
      $$('.mi.open').forEach(function (m) { m.classList.remove('open'); $('.marrow', m).setAttribute('aria-expanded', 'false'); });
      mi.classList.toggle('open', on); el.setAttribute('aria-expanded', on); return;
    }
    if ((el = t.closest('[data-tag]'))) { setTag(el.dataset.tag); return; }
    if ((el = t.closest('[data-action]'))) { e.preventDefault(); action(el.dataset.action); return; }
    if (t.closest('[data-close]')) { hide(t.closest('.layer')); return; }
    if (t.closest('[data-dot]')) return;
    if (t.closest('#menuBtn')) { show($('#menu')); return; }
    if (t.closest('#cartBtn')) { show($('#cart')); return; }
    if (t.closest('#clearBtn')) { goHome(); return; }
    if (t.closest('#moreBtn')) { st.limit = 99; renderAll(); return; }
    if (t.closest('#promoBtn')) { applyPromo(); return; }
    if (t.closest('#rmPromo')) { removePromo(); return; }
    if ((el = t.closest('[data-cq]'))) {
      var k = el.dataset.cq.split('|'), l = cart.filter(function (c) { return c.id === k[0] && String(c.v) === k[1]; })[0];
      if (l) { l.qty += +el.dataset.d; if (l.qty < 1) l.qty = 1; if (l.qty > 99) l.qty = 99; saveCart(); renderCart(); } return;
    }
    if ((el = t.closest('[data-crm]'))) {
      var k2 = el.dataset.crm.split('|'); cart = cart.filter(function (c) { return !(c.id === k2[0] && String(c.v) === k2[1]); }); saveCart(); renderCart(); return;
    }
    if (t.closest('#sortBtn')) { var pop = $('#sortPop'); pop.hidden = !pop.hidden; $('#sortBtn').setAttribute('aria-expanded', !pop.hidden); return; }
    if ((el = t.closest('[data-sort]'))) { st.sort = el.dataset.sort; $('#sortPop').hidden = true; $('#sortBtn').setAttribute('aria-expanded', 'false'); renderAll(); return; }
    if (!t.closest('.sortwrap')) { var sp = $('#sortPop'); if (sp && !sp.hidden) { sp.hidden = true; $('#sortBtn').setAttribute('aria-expanded', 'false'); } }
    if (t.closest('#scrim')) { hide(); return; }
    // প্রোডাক্ট মডালের ভেতরের বাটন
    if (t.closest('#product')) {
      var keep = $('#productBody').scrollTop;
      if ((el = t.closest('[data-g]'))) { detail.g = +el.dataset.g; renderDetail(); $('#productBody').scrollTop = keep; }
      else if ((el = t.closest('[data-v]'))) { detail.v = +el.dataset.v; renderDetail(); $('#productBody').scrollTop = keep; }
      else if ((el = t.closest('[data-q]'))) { detail.qty = Math.max(1, Math.min(99, detail.qty + +el.dataset.q)); renderDetail(); $('#productBody').scrollTop = keep; }
      else if (t.closest('[data-dadd]') && inStock(byId(detail.id))) { addToCart(detail.id, detail.v, detail.qty); hide($('#product')); }
      else if (t.closest('[data-dbuy]') && inStock(byId(detail.id))) { addToCart(detail.id, detail.v, detail.qty); hide($('#product')); setTimeout(function () { show($('#cart')); }, 320); }
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') hide();
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.card')) { e.preventDefault(); openProduct(e.target.dataset.open); }
    if (e.key === 'Enter' && e.target.id === 'promo') { e.preventDefault(); applyPromo(); }
  });
  function searchGo() {
    var q = $('#q'); q.blur(); if (document.activeElement && document.activeElement.blur) document.activeElement.blur();   // কিবোর্ড নেমে যাবে
    [120, 450, 900].forEach(function (ms) { setTimeout(function () { scrollTo('#all'); }, ms); });                       // কিবোর্ড নামার পর ফলাফল সামনে আসবে
  }
  $('#sform').addEventListener('submit', function (e) { e.preventDefault(); searchGo(); });
  $('#sform').addEventListener('click', function (e) { if (e.target.closest && !e.target.closest('input')) $('#q').focus(); });
  $('#q').addEventListener('keyup', function (e) { if (e.keyCode === 13) searchGo(); });
  $('#q').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); searchGo(); } });
  $('#q').addEventListener('search', searchGo);
  document.addEventListener('click', function (e) { var c = e.target.closest && e.target.closest('[data-copy]'); if (!c) return; var v = c.getAttribute('data-copy'); try { navigator.clipboard.writeText(v).then(function () { toast('Code copied: ' + v); }, function () {}); } catch (x) {} });
  $('#q').addEventListener('input', function (e) { st.q = e.target.value; st.limit = 12; if (st.q.trim()) st.tag = 'all'; renderAll(); });
  $('#orderForm').addEventListener('input', updateWa);
  $('#payCod').addEventListener('change', function () { if (this.checked) { $('[data-err="payCod"]').textContent = ''; $('.pay').classList.remove('bad'); } });
  /* Web3Forms: এক বা একাধিক কি। একটার মাসিক লিমিট শেষ হলে/ব্যর্থ হলে পরেরটা চেষ্টা করে */
  function mailKeys() { return (S.mailKeys && S.mailKeys.length ? S.mailKeys : (S.web3formsKey ? [S.web3formsKey] : [])); }
  function w3send(payload) {
    var ks = mailKeys(); if (!ks.length) return Promise.reject(new Error('key'));
    var i = 0;
    function next(err) {
      if (i >= ks.length) return Promise.reject(err || new Error('fail'));
      var body = Object.assign({}, payload, { access_key: ks[i++] });
      return fetch('https://api.web3forms.com/submit', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(body) })
        .then(function (r) { return r.json(); }).then(function (j) { if (!j.success) throw new Error(j.message || 'fail'); return j; }).catch(next);
    }
    return next();
  }
  function sendEmail(id) {
    var t = totals();
    return w3send({
        subject: 'New order ' + id + ' – ' + fval('name') + ' (' + money(t.total) + ')', from_name: S.name + ' website',
        order_id: id, name: fval('name'), phone: fval('phone'), district: fval('dist'), address: fval('addr'), note: $('#fNote').value.trim() || '-',
        payment: 'Cash on Delivery', total: money(t.total), message: orderText(id)
    });
  }
  $('#subForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var em = $('#subEmail').value.trim(), m = $('#subMsg'), btn = $('#subBtn');
    var say = function (cls, txt) { m.className = 'sub-msg ' + cls; m.textContent = txt; };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)) { say('bad', 'Please enter a valid email address.'); $('#subEmail').focus(); return; }
    if (!$('#subAgree').checked) { say('bad', 'Please tick the box to agree to receive offers.'); return; }
    if (!mailKeys().length) { say('bad', 'Subscription is not set up yet.'); return; }
    btn.disabled = true; say('', 'Sending…');
    w3send({ subject: 'New offers & updates subscriber', from_name: S.name + ' website', email: em, message: 'Please add ' + em + ' to the offers and updates list.' })
      .then(function () { say('ok', 'Thank you! You are on the list.'); $('#subForm').reset(); })
      .catch(function () { say('bad', 'Could not send. Check your internet and try again.'); })
      .then(function () { btn.disabled = false; });
  });
  var sending = false;
  $('#orderForm').addEventListener('submit', function (e) {
    e.preventDefault();
    if (sending) return;
    if (!cart.length) { toast('Your cart is empty'); return; }
    if (needAccount()) return;
    if (!validate()) return;
    sending = true;
    var b = $('#orderBtn'), id = 'MB-' + Math.floor(100000 + Math.random() * 900000);
    b.classList.add('go');
    var wait = new Promise(function (r) { setTimeout(r, 1800); });
    var send = S.api
      ? placeOrder('direct').then(function (r) { if (mailKeys().length) sendEmail(r.number).catch(function () {}); if (S.api) loadMe(); return r.number; })      // ব্যাকএন্ডে সেভ + ঐচ্ছিক ইমেল
      : sendEmail(id).then(function () { return id; });
    Promise.all([send, wait]).then(function (r) {
      b.classList.remove('go'); sending = false; finalize('direct', r[0]);
    }, function (err) {
      setTimeout(function () {
        b.classList.remove('go'); sending = false;
        if (S.api && err && err.status === 403) { blockedBox(err.message); return; }
        if (S.api) { toast(err && err.message ? err.message : 'Order could not be sent. Please try again or order on WhatsApp.'); return; }
        toast(err && err.message === 'key' ? 'Order email is not set up yet.' : 'Order could not be sent. Check your internet and try again, or order on WhatsApp.');
      }, 1800);
    });
  });
  $('#waBtn').addEventListener('click', function (e) {
    if (!cart.length) { e.preventDefault(); toast('Your cart is empty'); return; }
    if (!validate()) { e.preventDefault(); return; }
    updateWa();
    var placed = S.api ? placeOrder('whatsapp', true).then(function (r) { loadMe(); return r; }).catch(function (e) { return e && e.status === 403 ? { blocked: e.message } : null; }) : Promise.resolve(null);   // WhatsApp অর্ডারও ডাটাবেসে সেভ হয়
    setTimeout(function () { placed.then(function (r) { if (r && r.blocked) { blockedBox(r.blocked); return; } if (r && mailKeys().length) sendEmail(r.number).catch(function () {}); finalize('whatsapp', r && r.number); }); }, 600);   // WhatsApp অর্ডারেও ইমেল
  });
  window.addEventListener('scroll', function () { $('#bnHome').classList.toggle('on', window.scrollY < 300); }, { passive: true });

  /* ---------- থিম (Light / Dark): ডিফল্টে ডিভাইসের সেটিং, বাটনে ক্লিক করলে নিজের পছন্দ ---------- */
  var mq = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;
  function themeNow() {
    var t = document.documentElement.getAttribute('data-theme');
    return t === 'dark' || t === 'light' ? t : (mq && mq.matches ? 'dark' : 'light');
  }
  function syncThemeBtns() {
    var cur = themeNow();
    $$('[data-theme-set]').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.themeSet === cur); });
  }
  $$('[data-theme-set]').forEach(function (b) {
    b.addEventListener('click', function () {
      document.documentElement.setAttribute('data-theme', b.dataset.themeSet);
      try { localStorage.setItem('manar_theme', b.dataset.themeSet); } catch (e) {}
      syncThemeBtns();
    });
  });
  if (mq && mq.addEventListener) mq.addEventListener('change', syncThemeBtns);

  /* ---------- শুরু ---------- */
  renderStatic(); renderHero(); renderAll(); renderCart(); syncThemeBtns();
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('/sw.js').catch(function () {});
})();
