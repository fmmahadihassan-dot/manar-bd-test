/* Manar BD – অ্যাডমিন প্যানেল (সাধারণ JavaScript, কোনো লাইব্রেরি নেই) */
(function () {
  'use strict';
  var S = window.STORE, app = document.getElementById('app'), me = null;
  var money = function (n) { return '৳' + Number(n || 0).toLocaleString('en-IN'); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var when = function (ms) { return new Date(ms).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); };
  var STATUS = { pending: 'Pending', confirmed: 'Confirmed', shipped: 'On the way', delivered: 'Delivered', cancelled: 'Cancelled' };

  /* ---------- API ---------- */
  function api(path, o) {
    o = o || {}; var h = { 'X-Requested-With': 'fetch' };
    if (o.json) h['Content-Type'] = 'application/json'; if (o.raw && o.raw.type) h['Content-Type'] = o.raw.type;
    return fetch('/api/' + path, { method: o.method || (o.json || o.raw ? 'POST' : 'GET'), headers: h, credentials: 'same-origin', body: o.json ? JSON.stringify(o.json) : o.raw })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) { var e = new Error(j.error || 'Request failed'); e.status = r.status; throw e; } return j; }); });
  }
  var tt; function toast(m, bad) { var e = $('#toast'); e.textContent = m; e.className = 'toast show' + (bad ? ' bad' : ''); clearTimeout(tt); tt = setTimeout(function () { e.className = 'toast'; }, 2600); }
  var fail = function (e) { toast(e.message || 'Something went wrong', true); };

  /* ---------- ছবি ছোট করা (ব্রাউজারেই) ---------- */
  function resize(file, maxW, q) {
    return new Promise(function (res, rej) {
      var img = new Image(), u = URL.createObjectURL(file);
      img.onload = function () {
        var k = Math.min(1, maxW / img.width), c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(u);
        c.toBlob(function (b) { b ? res(b) : rej(new Error('Could not read this image')); }, 'image/jpeg', q);
      };
      img.onerror = function () { rej(new Error('Could not read this image')); }; img.src = u;
    });
  }
  function upload(blob) { return api('admin/upload', { raw: blob }).then(function (j) { return j.url; }); }

  /* ---------- কাঠামো ---------- */
  var TABS = [['', 'Dashboard'], ['orders', 'Orders'], ['products', 'Products'], ['banners', 'Banners'], ['settings', 'Offers'], ['users', 'Users'], ['setup', 'Setup']];
  function shell(active, html, pending) {
    var oldTabs = app.querySelector('.tabs'), keep = oldTabs ? oldTabs.scrollLeft : 0;
    app.innerHTML = '<header class="bar"><div class="wrap bar-row"><a class="brand" href="#/">Manar <b>BD</b> Admin</a><div class="bar-actions"><a class="btn line sm" href="/">View shop</a><button class="btn line sm" id="out">Sign out</button></div></div>' +
      '<nav class="tabs">' + TABS.map(function (t) { return '<a href="#/' + t[0] + '" class="' + (t[0] === active ? 'on' : '') + '">' + t[1] + (t[0] === 'orders' && pending ? '<span class="cnt">' + pending + '</span>' : '') + '</a>'; }).join('') + '</nav></header>' +
      '<main class="wrap">' + html + '</main>';
    var nv = $('.tabs'), on = nv && nv.querySelector('a.on');   // ট্যাব-বার যেখানে ছিল সেখানেই থাকবে, বাছাই করা ট্যাব দেখা যাবে
    if (nv) { nv.scrollLeft = keep; if (on) { var l = on.offsetLeft, r = l + on.offsetWidth; if (l < nv.scrollLeft + 8) nv.scrollLeft = l - 16; else if (r > nv.scrollLeft + nv.clientWidth - 8) nv.scrollLeft = r - nv.clientWidth + 16; } }
    $('#out').onclick = function () { api('auth/logout', { method: 'POST', json: {} }).then(function () { me = null; route(); }); };
  }
  var pendingCount = 0;
  var LOADER = '<div class="mbl" role="status" aria-label="Loading"><i></i></div>';
  function loading() { app.innerHTML = LOADER; }

  /* ---------- লগইন ---------- */
  function loginView(msg) {
    app.innerHTML = '<div class="login"><h2>Manar <span style="color:var(--accent-strong)">BD</span> Admin</h2>' + (msg ? '<p class="msg bad">' + esc(msg) + '</p>' : '') +
      '<form class="card" id="lf"><label class="f">Email or mobile<input id="l1" autocomplete="username" placeholder="name@email.com or 01XXXXXXXXX"></label>' +
      '<label class="f">Password<input id="l2" type="password" autocomplete="current-password"></label><button class="btn" type="submit">Sign in</button><p class="muted" style="margin:0;font-size:.85rem">Use the same account you use on the shop. Only admins can enter.</p></form><a href="/">← Back to shop</a></div>';
    $('#lf').onsubmit = function (e) {
      e.preventDefault(); var b = $('button', e.target); b.disabled = true;
      api('auth/login', { json: { login: $('#l1').value, password: $('#l2').value } }).then(function (j) { me = j.user; route(); }, function (er) { loginView(er.message); });
    };
  }

  /* ---------- ড্যাশবোর্ড ---------- */
  var dashRange = 7;
  var num = function (n) { return Number(n || 0).toLocaleString('en-IN'); };
  var chg = function (a, b) {                                   // আগের সময়ের চেয়ে কত % বেশি/কম
    if (!b) return a ? '<em class="chg up">new</em>' : '<em class="chg">–</em>';
    var d = (a - b) / b * 100; return '<em class="chg ' + (d >= 0 ? 'up' : 'dn') + '">' + (d >= 0 ? '+' : '') + d.toFixed(1) + '%</em>';
  };
  var ago = function (ms) { var m = Math.max(1, Math.round((Date.now() - ms) / 6e4)); return m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' d ago'; };
  var niceMax = function (v) { if (v <= 0) return 4; var p = Math.pow(10, Math.floor(Math.log10(v))), n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 4 ? 4 : n <= 5 ? 5 : 10) * p; };
  function smooth(pts) {                                       // মসৃণ বাঁকা লাইন
    if (pts.length < 2) return pts.length ? 'M' + pts[0][0] + ' ' + pts[0][1] : '';
    var d = 'M' + pts[0][0] + ' ' + pts[0][1];
    for (var k = 0; k < pts.length - 1; k++) {
      var p0 = pts[k - 1] || pts[k], p1 = pts[k], p2 = pts[k + 1], p3 = pts[k + 2] || p2;
      var lo = Math.min(p1[1], p2[1]), hi = Math.max(p1[1], p2[1]), cl = function (y) { return Math.max(lo, Math.min(hi, y)).toFixed(1); };   // লাইন দুই বিন্দুর মাঝেই থাকবে, শূন্যের নিচে নামবে না
      d += ' C' + (p1[0] + (p2[0] - p0[0]) / 6).toFixed(1) + ' ' + cl(p1[1] + (p2[1] - p0[1]) / 6) + ',' + (p2[0] - (p3[0] - p1[0]) / 6).toFixed(1) + ' ' + cl(p2[1] - (p3[1] - p1[1]) / 6) + ',' + p2[0] + ' ' + p2[1];
    }
    return d;
  }
  function lineChart(d) {
    var W = 600, H = 230, L = 46, R = 10, T = 12, B = 28, n = d.days.length, max = niceMax(Math.max.apply(null, d.revenue)), omax = Math.max(1, Math.max.apply(null, d.orders));
    var X = function (i) { return L + (n === 1 ? (W - L - R) / 2 : i * (W - L - R) / (n - 1)); }, Y = function (v, m) { return T + (H - T - B) * (1 - v / m); };
    var rp = d.revenue.map(function (v, i) { return [X(i), Y(v, max)]; }), op = d.orders.map(function (v, i) { return [X(i), Y(v, omax)]; });
    var grid = [0, 1, 2, 3, 4].map(function (k) { var y = T + (H - T - B) * k / 4, v = max * (4 - k) / 4; return '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y + '" y2="' + y + '" class="gl"/><text x="' + (L - 6) + '" y="' + (y + 4) + '" text-anchor="end" class="gt">' + (v >= 1000 ? (v / 1000) + 'K' : v) + '</text>'; }).join('');
    var step = Math.ceil(n / 8), xl = d.days.map(function (day, i) { return i % step === 0 || i === n - 1 ? '<text x="' + X(i) + '" y="' + (H - 8) + '" text-anchor="middle" class="gt">' + day.slice(8) + '/' + day.slice(5, 7) + '</text>' : ''; }).join('');
    var area = smooth(rp) + ' L' + X(n - 1) + ' ' + (H - B) + ' L' + X(0) + ' ' + (H - B) + ' Z';
    return '<svg class="lc" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Revenue chart"><defs><linearGradient id="rg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#F28A1E" stop-opacity=".28"/><stop offset="1" stop-color="#F28A1E" stop-opacity="0"/></linearGradient></defs>' + grid + xl +
      '<path d="' + area + '" fill="url(#rg)"/><path d="' + smooth(op) + '" class="ol"/><path d="' + smooth(rp) + '" class="rl"/><g id="lcHit"></g><g id="lcTip" hidden><line id="lcV" y1="' + T + '" y2="' + (H - B) + '" class="gl hot"/><circle id="lcD" r="5" class="dot"/></g></svg><div class="tip" id="tip" hidden></div>';
  }
  function gauge(pct) {
    var p = Math.max(0, Math.min(1, pct)), len = Math.PI * 80;
    return '<svg class="gauge" viewBox="0 0 200 118"><path d="M20 100 A80 80 0 0 1 180 100" class="g-bg"/><path d="M20 100 A80 80 0 0 1 180 100" class="g-fg" stroke-dasharray="' + (len * p).toFixed(1) + ' ' + len.toFixed(1) + '"/><text x="100" y="88" text-anchor="middle" class="g-pct">' + Math.round(pct * 100) + '%</text></svg>';
  }
  var PAL = ['#F28A1E', '#F6A950', '#F9C487', '#FCDDB8'];
  function donut(list, total) {
    var sum = list.reduce(function (x, c) { return x + c.value; }, 0) || 1, C = 2 * Math.PI * 70, off = 0;
    var seg = list.map(function (c, i) { var l = c.value / sum * C, s = '<circle cx="100" cy="100" r="70" fill="none" stroke="' + PAL[i] + '" stroke-width="22" stroke-dasharray="' + Math.max(0, l - 3).toFixed(1) + ' ' + C.toFixed(1) + '" stroke-dashoffset="' + (-off).toFixed(1) + '" transform="rotate(-90 100 100)"/>'; off += l; return s; }).join('');
    return '<svg class="donut" viewBox="0 0 200 200">' + (list.length ? seg : '<circle cx="100" cy="100" r="70" fill="none" stroke="var(--line)" stroke-width="22"/>') + '<text x="100" y="94" text-anchor="middle" class="dn-s">Total sales</text><text x="100" y="118" text-anchor="middle" class="dn-v">' + money(total) + '</text></svg>';
  }
  function dashboard() {
    Promise.all([api('admin/stats'), api('admin/dashboard?range=' + dashRange)]).then(function (r) {
      var s = r[0], d = r[1]; pendingCount = s.pending;
      var f = d.funnel, fp = d.funnelPrev, mp = d.month.target ? d.month.revenue / d.month.target : 0;
      var cols = [['Product views', f.views, fp.views], ['Add to cart', f.carts, fp.carts], ['Checkout opened', f.checkouts, fp.checkouts], ['Completed orders', f.purchases, fp.purchases], ['Abandoned carts', f.abandoned, fp.abandoned]], fmax = Math.max(1, f.views, f.carts, f.checkouts, f.purchases);
      var stot = d.sources.reduce(function (x, y) { return x + y.n; }, 0), SRC = { direct: 'Direct', search: 'Search engines', social: 'Social media', referral: 'Other websites', email: 'Email' }, SC = ['#F28A1E', '#F6A950', '#F9C487', '#FCDDB8', '#EAD3BC'];
      shell('', '<div class="head"><h2>Dashboard</h2><select id="dr" class="mini" aria-label="Date range"><option value="7"' + (dashRange === 7 ? ' selected' : '') + '>Last 7 days</option><option value="30"' + (dashRange === 30 ? ' selected' : '') + '>Last 30 days</option><option value="90"' + (dashRange === 90 ? ' selected' : '') + '>Last 90 days</option></select></div>' +
        (s.pending ? '<a class="alert" href="#/orders">' + s.pending + ' pending order' + (s.pending > 1 ? 's' : '') + ' waiting. <b>Open →</b></a>' : '') +
        '<div class="dg">' +
        '<div class="kpi hl"><span>Total Sales</span><b>' + money(d.totals.sales) + '</b>' + chg(d.totals.sales, d.prev.sales) + '<small>vs previous ' + d.range + ' days</small></div>' +
        '<div class="kpi"><span>Total Orders</span><b>' + num(d.totals.orders) + '</b>' + chg(d.totals.orders, d.prev.orders) + '<small>vs previous ' + d.range + ' days</small></div>' +
        '<div class="kpi"><span>Total Visitors</span><b>' + num(d.totals.visitors) + '</b>' + chg(d.totals.visitors, d.prev.visitors) + '<small>vs previous ' + d.range + ' days</small></div>' +
        '<section class="card wide"><div class="head"><h3>Revenue Analytics</h3><span class="lg"><i class="a"></i>Revenue <i class="b"></i>Orders</span></div>' + lineChart(d) + '</section>' +
        '<section class="card"><h3>Monthly Target</h3>' + gauge(mp) + '<p class="gnote"><b>' + (mp >= 1 ? 'Target reached! 🎉' : mp >= .5 ? 'Great progress!' : 'Keep going!') + '</b><br><small>' + money(Math.max(0, d.month.target - d.month.revenue)) + ' left to reach this month’s target.</small></p>' +
        '<div class="two"><div class="box"><small>Target</small><b>' + money(d.month.target) + '</b></div><div class="box"><small>Revenue</small><b>' + money(d.month.revenue) + '</b></div></div>' +
        '<form id="tgf" class="inl"><input id="tg" type="number" inputmode="numeric" min="0" placeholder="New monthly target (৳)"><button class="btn line" type="submit">Set</button></form></section>' +
        '<section class="card"><h3>Top Categories</h3>' + donut(d.categories, d.salesTotal) + '<ul class="leg">' + (d.categories.length ? d.categories.map(function (c, i) { return '<li><i style="background:' + PAL[i] + '"></i><span>' + esc(c.name) + '</span><b>' + money(c.value) + '</b></li>'; }).join('') : '<li class="muted">No sales in this period.</li>') + '</ul></section>' +
        '<section class="card"><div class="head"><h3>Customers</h3><span class="pill good">+' + d.users.fresh + ' new</span></div><b class="big">' + num(d.users.total) + '</b><small class="muted">registered accounts</small>' +
        '<h4>Top areas (orders)</h4>' + (d.users.areas.length ? d.users.areas.map(function (a) { return '<div class="abar"><span>' + esc(a.name) + '</span><b>' + a.pct + '%</b><i style="--w:' + a.pct + '%"></i></div>'; }).join('') : '<p class="muted">No orders yet.</p>') + '</section>' +
        '<section class="card wide"><div class="head"><h3>Conversion Rate</h3><small class="muted">' + d.range + ' days · unique visitors</small></div><div class="fun">' +
        cols.map(function (c, i) { var h = i === 4 ? Math.min(100, c[1] / fmax * 100) : c[1] / fmax * 100; return '<div class="fc' + (i === 4 ? ' ab' : '') + '"><small>' + c[0] + '</small><b>' + num(c[1]) + '</b>' + chg(c[1], c[2]) + '<i style="--h:' + Math.max(6, h).toFixed(0) + '%"></i></div>'; }).join('') + '</div></section>' +
        '<section class="card"><h3>Traffic Sources</h3><div class="stack">' + (stot ? d.sources.map(function (x, i) { return x.n ? '<i style="flex:' + x.n + ';background:' + SC[i] + '"></i>' : ''; }).join('') : '<i style="flex:1;background:var(--line)"></i>') + '</div><ul class="leg">' + d.sources.map(function (x, i) { return '<li><i style="background:' + SC[i] + '"></i><span>' + SRC[x.name] + '</span><b>' + (stot ? Math.round(x.n / stot * 100) : 0) + '%</b></li>'; }).join('') + '</ul></section>' +
        '<section class="card wide"><div class="head"><h3>Customer activity</h3><small class="muted">logged-in customers · last 30 days</small></div>' +
        (d.activity.length ? '<div class="act">' + d.activity.map(function (a) {
          return '<div class="ar"><div class="av">' + esc((a.name || '?').charAt(0).toUpperCase()) + '</div><div class="grow"><b>' + esc(a.name) + '</b> <small class="muted">' + esc(a.contact) + ' · ' + ago(a.last) + '</small>' +
            '<div class="chips"><span>👁 ' + a.views + ' viewed</span><span>🛒 ' + a.carts + ' added</span><span>✅ ' + a.checkouts + ' checkout</span></div>' +
            (a.pending ? '<small class="warn">In cart, not ordered: ' + esc(a.carted.join(', ')) + '</small>' : '') + (a.viewed.length ? '<small class="muted">Recently viewed: ' + esc(a.viewed.join(', ')) + '</small>' : '') + '</div></div>';
        }).join('') + '</div>' : '<p class="muted">No logged-in customer activity yet. It appears once customers sign in and browse.</p>') + '</section>' +
        '</div>', pendingCount);
      $('#dr').onchange = function () { dashRange = +this.value; dashboard(); };
      $('#tgf').onsubmit = function (e) { e.preventDefault(); var v = $('#tg').value; if (v === '') return; api('admin/target', { method: 'PUT', json: { monthly: v } }).then(dashboard, fail); };
      // চার্টে আঙুল/মাউস রাখলে সেই দিনের সংখ্যা
      var svg = $('.lc'), tip = $('#tip'); if (svg) {
        var show = function (ev) {
          var r = svg.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width * 600, n = d.days.length, i = Math.max(0, Math.min(n - 1, Math.round((x - 46) / ((600 - 56) / Math.max(1, n - 1)))));
          var max = niceMax(Math.max.apply(null, d.revenue)), px = 46 + (n === 1 ? 272 : i * 544 / (n - 1)), py = 12 + 190 * (1 - d.revenue[i] / max);
          $('#lcTip').removeAttribute('hidden'); $('#lcV').setAttribute('x1', px); $('#lcV').setAttribute('x2', px); $('#lcD').setAttribute('cx', px); $('#lcD').setAttribute('cy', py);
          tip.hidden = false; tip.innerHTML = '<b>' + money(d.revenue[i]) + '</b><small>' + d.orders[i] + ' order(s) · ' + d.days[i].slice(8) + '/' + d.days[i].slice(5, 7) + '</small>';
          tip.style.left = Math.min(Math.max(px / 600 * 100, 14), 86) + '%';
        };
        // ট্যাপ করলে সেখানেই তথ্য থাকে (আঙুল তুললেও); অন্য জায়গায় ট্যাপ বা আবার ট্যাপ করলে বদলায়/মোছে। মাউসে hover করলেও দেখায়
        var hide = function () { tip.hidden = true; $('#lcTip').setAttribute('hidden', ''); };
        svg.addEventListener('pointerdown', show);
        svg.addEventListener('pointermove', function (ev) { if (ev.pointerType === 'mouse' || ev.buttons) show(ev); });
        svg.addEventListener('pointerleave', function (ev) { if (ev.pointerType === 'mouse') hide(); });
        document.addEventListener('pointerdown', function oc(ev) { if (!document.body.contains(svg)) { document.removeEventListener('pointerdown', oc); return; } if (!svg.contains(ev.target)) hide(); });
      }
    }, fail);
  }
  function riskPill(o) { return o.risk >= 60 ? ' <span class="pill risk hi" title="' + esc(o.riskNote) + '">High risk</span>' : o.risk >= 30 ? ' <span class="pill risk md" title="' + esc(o.riskNote) + '">Check</span>' : ''; }
  function orderRows(list) {
    return list.length ? '<div class="rows">' + list.map(function (o) {
      return '<a class="row" href="#/orders/' + o.id + '"><div class="grow"><b>' + esc(o.number) + ' · ' + esc(o.name) + '</b><small>' + when(o.created) + ' · ' + o.items.length + ' item(s) · ' + (o.via === 'whatsapp' ? 'WhatsApp' : 'Website') + '</small></div><div style="text-align:right"><b>' + money(o.total) + '</b><br><span class="pill ' + o.status + '">' + STATUS[o.status] + '</span>' + riskPill(o) + '</div></a>';
    }).join('') + '</div>' : '<p class="muted">No orders yet.</p>';
  }

  /* ---------- অর্ডার ---------- */
  var ordFilter = { status: '', q: '' };
  function orders() {
    var qs = 'admin/orders?status=' + encodeURIComponent(ordFilter.status) + '&q=' + encodeURIComponent(ordFilter.q);
    api(qs).then(function (j) {
      shell('orders', '<div class="head"><h2>Orders</h2></div><div class="card"><div class="grid2"><label class="f">Status<select id="fs"><option value="">All</option>' +
        Object.keys(STATUS).map(function (k) { return '<option value="' + k + '"' + (ordFilter.status === k ? ' selected' : '') + '>' + STATUS[k] + '</option>'; }).join('') + '</select></label>' +
        '<label class="f">Search<input id="fq" placeholder="Order no, name or mobile" value="' + esc(ordFilter.q) + '"></label></div></div>' + orderRows(j.orders) + (j.more ? '<p class="muted">Showing the latest 30. Use search to find older orders.</p>' : ''), pendingCount);
      $('#fs').onchange = function () { ordFilter.status = this.value; orders(); };
      var t; $('#fq').oninput = function () { var v = this.value; clearTimeout(t); t = setTimeout(function () { ordFilter.q = v; orders(); }, 450); };
      var f = $('#fq'); if (ordFilter.q) { f.focus(); f.setSelectionRange(f.value.length, f.value.length); }
    }, fail);
  }
  function orderDetail(id) {
    var find = function () { return api('admin/orders/' + id).then(function (j) { return j.order; }); };
    api('admin/orders/' + id).then(function (j) { var o = j.order, blocked = j.blocked;
      if (!o) { shell('orders', '<p class="msg bad">Order not found.</p><a href="#/orders">← Back</a>', pendingCount); return; }
      var wa = '88' + o.phone;
      shell('orders', '<a href="#/orders">← All orders</a><div class="card"><div class="head"><h2>' + esc(o.number) + '</h2><span class="pill ' + o.status + '">' + STATUS[o.status] + '</span></div><small class="muted">' + when(o.created) + ' · ' + (o.via === 'whatsapp' ? 'WhatsApp order' : 'Website order') + '</small>' +
        '<ul class="items">' + o.items.map(function (i) { return '<li><span>' + esc(i.name) + (i.variant ? ' (' + esc(i.variant) + ')' : '') + ' × ' + i.qty + '</span><b>' + money(i.price * i.qty) + '</b></li>'; }).join('') + '</ul>' +
        '<div class="sum"><div><span>Subtotal</span><span>' + money(o.subtotal) + '</span></div>' + (o.discount ? '<div><span>Promo ' + esc(o.promo) + '</span><span>−' + money(o.discount) + '</span></div>' : '') + '<div><span>Delivery</span><span>' + (o.delivery ? money(o.delivery) : 'Free') + '</span></div><div class="t"><span>Total (Cash on Delivery)</span><span>' + money(o.total) + '</span></div></div></div>' +
        '<div class="card"><h3>Customer</h3><div><b>' + esc(o.name) + '</b><br>' + esc(o.phone) + '<br>' + esc(o.dist) + '<br>' + esc(o.address) + (o.note ? '<br><i class="muted">Note: ' + esc(o.note) + '</i>' : '') + '</div>' +
        '<div class="stat-btns"><a class="btn line sm" href="tel:' + esc(o.phone) + '">Call</a><a class="btn line sm" target="_blank" rel="noopener" href="https://wa.me/' + esc(wa) + '">WhatsApp</a>' + (o.userId ? '<span class="pill">Has account</span>' : '<span class="pill off">Guest</span>') + '</div></div>' +
        ''+ (o.risk >= 30 ? '<div class="card risk-card ' + (o.risk >= 60 ? 'hi' : 'md') + '"><h3>' + (o.risk >= 60 ? '⚠ High fake-order risk' : '⚠ Please check this order') + ' (' + o.risk + '/100)</h3><p class="muted" style="margin:0">' + esc(o.riskNote || '') + '</p><p class="muted" style="margin:6px 0 0">Call the customer to confirm before sending the parcel.</p></div>' : '') + '<div class="card"><h3>Update status</h3><div class="stat-btns">' + Object.keys(STATUS).map(function (k) { return '<button class="btn sm ' + (o.status === k ? '' : 'line') + '" data-st="' + k + '">' + STATUS[k] + '</button>'; }).join('') + '</div>' +
        '<label class="f">Courier tracking link<small>Pathao / Steadfast / যেকোনো কুরিয়ারের লিঙ্ক। Customer এর My Account এ "Delivery update" বাটন হয়ে দেখা যাবে।</small><input id="tu" type="url" inputmode="url" placeholder="https://..." value="' + esc(o.trackUrl) + '"></label><button class="btn line" id="stu">Save link</button>' +
        '<label class="f">Private note<small>Only admins can see this</small><textarea id="an">' + esc(o.adminNote) + '</textarea></label><button class="btn line" id="san">Save note</button></div>', pendingCount);
      var bl = document.createElement('div'); bl.className = 'card'; bl.innerHTML = '<h3>Block this number</h3><p class="muted" style="margin:0 0 8px">' + (blocked ? 'This number is blocked: new online orders from it are refused.' : 'If this is a fake/prank order, block the number so it cannot order again.') + '</p><button class="btn ' + (blocked ? 'line' : 'danger') + '" id="blk">' + (blocked ? 'Unblock ' : 'Block ') + esc(o.phone) + '</button>';
      $('main').appendChild(bl);
      $('#blk').onclick = function () { (blocked ? api('admin/block/' + o.phone, { method: 'DELETE' }) : api('admin/block', { json: { phone: o.phone, note: o.number } })).then(function () { toast(blocked ? 'Unblocked' : 'Blocked'); orderDetail(id); }, fail); };
      var patch = function (body) { api('admin/orders/' + o.id, { method: 'PATCH', json: body }).then(function () { toast('Saved'); orderDetail(id); }, fail); };
      $$('[data-st]').forEach(function (b) { b.onclick = function () { patch({ status: b.dataset.st }); }; });
      $('#san').onclick = function () { patch({ adminNote: $('#an').value }); };
      $('#stu').onclick = function () { patch({ trackUrl: $('#tu').value.trim() }); };
    }, fail);
  }

  /* ---------- প্রোডাক্ট তালিকা ---------- */
  var prodQ = '';
  function products() {
    api('admin/products').then(function (j) {
      var draw = function () {
        var list = j.products.filter(function (p) { return !prodQ || p.name.toLowerCase().indexOf(prodQ.toLowerCase()) > -1; });
        $('#plist').innerHTML = list.length ? list.map(function (p) {
          var price = p.variants ? Math.min.apply(null, p.variants.map(function (v) { return v.price; })) : p.price;
          return '<div class="row">' + (p.imgSm || p.img ? '<img class="thumb" src="' + esc(fileUrl(p.imgSm || p.img)) + '" alt="">' : '<div class="thumb">' + esc(p.name.charAt(0)) + '</div>') +
            '<a class="grow" href="#/product/' + esc(p.id) + '" style="color:inherit;text-decoration:none"><b>' + esc(p.name) + '</b><small>' + (p.variants ? 'from ' : '') + money(price) + (p.active ? '' : ' · <span class="pill off">Hidden</span>') + '</small></a>' +
            '<div class="pact"><label class="tg" title="Stock on / off"><input type="checkbox" data-stock="' + esc(p.id) + '"' + (p.inStock !== false ? ' checked' : '') + '><i><span class="t-on">In stock</span><span class="t-off">Out</span><b></b></i></label><button type="button" class="cpy" data-copy="' + esc(p.id) + '">⧉ Copy</button></div></div>';
        }).join('') : '<p class="muted">No products found.</p>';
        $$('[data-copy]').forEach(function (b) { b.onclick = function () {
          var src = j.products.filter(function (x) { return x.id === b.dataset.copy; })[0]; if (!src) return;
          var base = src.name.replace(/\s+\d+$/, ''), n = 0;
          j.products.forEach(function (x) { var m = x.name.indexOf(base) === 0 ? /^\s*(\d+)$/.exec(x.name.slice(base.length)) : null; if (m) n = Math.max(n, +m[1]); });
          var copy = JSON.parse(JSON.stringify(src)); delete copy.id; copy.name = base + ' ' + (n + 1);
          b.disabled = true; api('admin/products', { json: copy }).then(function (r) { toast('Copied as "' + copy.name + '"'); location.hash = '#/product/' + encodeURIComponent(r.product.id); }, function (e) { b.disabled = false; fail(e); });
        }; });
        $$('[data-stock]').forEach(function (c) { c.onchange = function () { api('admin/products/' + c.dataset.stock, { method: 'PATCH', json: { inStock: c.checked } }).then(function () { toast(c.checked ? 'In stock' : 'Marked out of stock'); }, function (e) { fail(e); c.checked = !c.checked; }); }; });
      };
      shell('products', '<div class="head"><h2>Products (' + j.products.length + ')</h2><a class="btn" href="#/product/new">+ Add product</a></div><input id="pq" placeholder="Search products" value="' + esc(prodQ) + '"><div class="rows" id="plist"></div>', pendingCount);
      draw(); $('#pq').oninput = function () { prodQ = this.value; draw(); };
    }, fail);
  }

  /* ---------- প্রোডাক্ট ফর্ম ---------- */
  var SPEC_FIELDS = [['model', 'Model'], ['type', 'Type / category name'], ['warranty', 'Warranty (e.g. 12 months)'], ['capacity', 'Capacity (e.g. 1.8 L)'], ['watt', 'Power (e.g. 1500 W)'], ['voltage', 'Operating voltage'],
    ['material', 'Body material'], ['battery', 'Battery capacity (e.g. 1000 mAh)'], ['light', 'Light / torch'], ['chargingTime', 'Charging time'], ['usageTime', 'Usage time']];
  var fileUrl = function (u) { return /^(images|\/api)/.test(u) ? '/' + u.replace(/^\//, '') : u; };
  function productForm(id) {
    var isNew = id === 'new';
    (isNew ? Promise.resolve({ products: [] }) : api('admin/products')).then(function (j) {
      var p = isNew ? { inStock: true, free: true, tags: [], gallery: [] } : j.products.filter(function (x) { return x.id === id; })[0];
      if (!p) { shell('products', '<p class="msg bad">Product not found.</p>', pendingCount); return; }
      var imgs = (p.gallery && p.gallery.length ? p.gallery : (p.img ? [p.img] : [])).map(function (u, i) { return { full: u, sm: i === 0 && p.imgSm ? p.imgSm : u }; });
      var vars = (p.variants || []).map(function (v) { return { name: v.name, price: v.price, old: v.old || '' }; });
      var tagList = Object.keys(S.tagNames);
      var tg = function (k, label, on) { return '<label class="chk"><input type="checkbox" data-k="' + k + '"' + (on ? ' checked' : '') + '> ' + label + '</label>'; };
      var tri = function (k, label) { var v = p[k] === true ? 'y' : p[k] === false ? 'n' : ''; return '<label class="f">' + label + '<select data-k="' + k + '"><option value="">Not shown</option><option value="y"' + (v === 'y' ? ' selected' : '') + '>Yes</option><option value="n"' + (v === 'n' ? ' selected' : '') + '>No</option></select></label>'; };
      shell('products', '<a href="#/products">← Products</a><h2>' + (isNew ? 'Add product' : 'Edit product') + '</h2><form id="pf" novalidate>' +
        '<div class="card"><h3>Basic</h3><label class="f">Product name<input data-k="name" value="' + esc(p.name) + '" maxlength="120"></label>' +
        '<label class="f">Short line<small>Shown under the name on the card</small><input data-k="short" value="' + esc(p.short) + '" maxlength="90"></label>' +
        '<div class="grid2"><label class="f">Brand<input data-k="brand" value="' + esc(p.brand) + '"></label><label class="f">Badge<small>e.g. Bestseller, New</small><input data-k="badge" value="' + esc(p.badge) + '" maxlength="30"></label></div>' +
        '<div><b style="font-size:.88rem">Categories</b><div class="chks" id="tags" style="margin-top:6px">' + tagList.map(function (t) { return '<label class="chk"><input type="checkbox" value="' + t + '"' + ((p.tags || []).indexOf(t) > -1 ? ' checked' : '') + '> ' + esc(S.tagNames[t]) + '</label>'; }).join('') + '</div></div></div>' +
        '<div class="card"><h3>Images</h3><p class="muted" style="margin:0">The first image is the main one. Square photos (about 1000 × 1000) look best.</p><div class="imgs" id="imgs"></div><input type="file" id="fi" accept="image/*" multiple hidden>' +
        '<label class="f">Video link <small>Optional. YouTube link or a direct .mp4 link</small><input data-k="video" value="' + esc(p.video) + '" placeholder="https://youtu.be/..."></label></div>' +
        '<div class="card"><h3>Price</h3><div id="pricebox"></div>' +
        '<label class="chk"><input type="checkbox" data-k="free"' + (p.free !== false ? ' checked' : '') + '> Free delivery for this product</label><label class="f" id="chg">Delivery charge (৳)<input data-k="charge" type="number" min="0" inputmode="numeric" value="' + esc(p.charge || '') + '"></label></div>' +
        '<div class="card"><h3>Stock & visibility</h3><label class="chk"><input type="checkbox" data-k="inStock"' + (p.inStock !== false ? ' checked' : '') + '> In stock</label><label class="chk"><input type="checkbox" data-k="active"' + (p.active !== false ? ' checked' : '') + '> Show in shop</label>' +
        '<label class="chk"><input type="checkbox" data-k="hot"' + (p.hot ? ' checked' : '') + '> Hot deal</label><label class="chk"><input type="checkbox" data-k="popular"' + (p.popular ? ' checked' : '') + '> Popular</label></div>' +
        '<div class="card"><h3>Description</h3><label class="f">About<textarea data-k="about" maxlength="1500">' + esc(p.about) + '</textarea></label>' +
        '<label class="f">Highlights<small>One per line</small><textarea data-k="features">' + esc((p.features || []).join('\n')) + '</textarea></label></div>' +
        '<div class="card"><h3>Product details</h3><p class="muted" style="margin:0">Fill only what applies. Empty fields are hidden on the shop.</p><div class="grid2">' +
        SPEC_FIELDS.map(function (f) { return '<label class="f">' + f[1] + '<input data-k="' + f[0] + '" value="' + esc(p[f[0]]) + '" maxlength="60"></label>'; }).join('') + tri('autoOff', 'Auto switch-off') + tri('eco', 'Eco friendly') + '</div>' +
        '<div class="f"><b>Extra details</b><small>নিজের মতো যেকোনো তথ্য যোগ করুন (যেমন Colour: Black, Weight: 1.2 kg)। Shop-এ উপরের তথ্যগুলোর মতোই দেখাবে।</small><div id="sp"></div><datalist id="spl"><option value="Colour"><option value="Size"><option value="Weight"><option value="Dimensions"><option value="Length"><option value="Power source"><option value="Country of origin"><option value="Package includes"><option value="Speed settings"><option value="Water resistance"></datalist><button type="button" class="btn line sm" id="spadd">+ Add detail</button></div></div>' +
        '<p class="msg bad" id="perr" hidden></p><div class="sticky-save"><button class="btn" type="submit">' + (isNew ? 'Add product' : 'Save changes') + '</button>' + (isNew ? '' : '<button class="btn danger" type="button" id="pdel">Delete</button>') + '</div></form>', pendingCount);

      var F = $('#pf'), val = function (k) { var e = $('[data-k="' + k + '"]', F); return e ? (e.type === 'checkbox' ? e.checked : e.value.trim()) : ''; };
      var specs = (p.specs || []).map(function (r) { return [r[0], r[1]]; });
      function drawSpecs() {
        $('#sp').innerHTML = specs.map(function (r, i) { return '<div class="sprow"><input list="spl" data-sk="' + i + '" value="' + esc(r[0]) + '" placeholder="Name (e.g. Colour)" maxlength="40"><input data-sv="' + i + '" value="' + esc(r[1]) + '" placeholder="Value (e.g. Black)" maxlength="100"><button type="button" class="x" data-sx="' + i + '" aria-label="Remove">✕</button></div>'; }).join('');
        $$('[data-sk]').forEach(function (e) { e.oninput = function () { specs[+e.dataset.sk][0] = e.value; }; });
        $$('[data-sv]').forEach(function (e) { e.oninput = function () { specs[+e.dataset.sv][1] = e.value; }; });
        $$('[data-sx]').forEach(function (e) { e.onclick = function () { specs.splice(+e.dataset.sx, 1); drawSpecs(); }; });
      }
      drawSpecs(); $('#spadd').onclick = function () { specs.push(['', '']); drawSpecs(); var l = $$('[data-sk]'); if (l.length) l[l.length - 1].focus(); };
      function drawImgs() {
        $('#imgs').innerHTML = imgs.map(function (m, i) { return '<div class="im"><img src="' + esc(fileUrl(m.sm || m.full)) + '" alt="">' + (i === 0 ? '<span class="tag">Main</span>' : '') +
          '<div class="acts">' + (i > 0 ? '<button type="button" data-main="' + i + '" title="Make main">★</button>' : '') + '<button type="button" data-rm="' + i + '" title="Remove">✕</button></div></div>'; }).join('') +
          '<label class="add-im" for="fi">+ Add<br>photo</label>';
        $$('[data-main]').forEach(function (b) { b.onclick = function () { var m = imgs.splice(+b.dataset.main, 1)[0]; imgs.unshift(m); drawImgs(); }; });
        $$('[data-rm]').forEach(function (b) { b.onclick = function () { imgs.splice(+b.dataset.rm, 1); drawImgs(); }; });
      }
      drawImgs();
      $('#fi').onchange = function () {
        var files = Array.prototype.slice.call(this.files).slice(0, 10 - imgs.length); this.value = ''; if (!files.length) return;
        toast('Uploading ' + files.length + ' photo(s)…');
        files.reduce(function (chain, f) {
          return chain.then(function () { return Promise.all([resize(f, 1100, .82), resize(f, 560, .8)]).then(function (b) { return Promise.all([upload(b[0]), upload(b[1])]); }).then(function (u) { imgs.push({ full: u[0], sm: u[1] }); drawImgs(); }); });
        }, Promise.resolve()).then(function () { toast('Photos added'); }, fail);
      };
      function drawPrice() {
        var hasV = vars.length > 0;
        $('#pricebox').innerHTML = hasV
          ? '<p class="muted" style="margin:0">This product has options (like sizes). Each option has its own price.</p>' + vars.map(function (v, i) {
            return '<div class="vr"><input data-vn="' + i + '" placeholder="Option name" value="' + esc(v.name) + '"><input data-vp="' + i + '" type="number" inputmode="numeric" placeholder="Price" value="' + esc(v.price) + '"><input data-vo="' + i + '" type="number" inputmode="numeric" placeholder="Old price" value="' + esc(v.old) + '"><button type="button" class="btn danger sm" data-vr="' + i + '">✕</button></div>'; }).join('') + '<button type="button" class="btn line sm" id="vadd">+ Add option</button> <button type="button" class="btn line sm" id="vnone">Use a single price instead</button>'
          : '<div class="grid2 keep"><label class="f">Price (৳)<input data-k="price" type="number" inputmode="numeric" min="1" value="' + esc(p.price || '') + '"></label><label class="f">Old price (৳)<small>Optional. Shows the discount %</small><input data-k="old" type="number" inputmode="numeric" min="0" value="' + esc(p.old || '') + '"></label></div><div id="dpv" class="muted"></div><button type="button" class="btn line sm" id="vadd">Has options (sizes, colours…)?</button>';
        $$('[data-vn]').forEach(function (e) { e.oninput = function () { vars[+e.dataset.vn].name = e.value; }; });
        $$('[data-vp]').forEach(function (e) { e.oninput = function () { vars[+e.dataset.vp].price = e.value; }; });
        $$('[data-vo]').forEach(function (e) { e.oninput = function () { vars[+e.dataset.vo].old = e.value; }; });
        $$('[data-vr]').forEach(function (e) { e.onclick = function () { vars.splice(+e.dataset.vr, 1); drawPrice(); }; });
        var add = $('#vadd'); if (add) add.onclick = function () { if (!hasV) { var pr = val('price'), od = val('old'); vars.push({ name: '', price: pr, old: od }); } vars.push({ name: '', price: '', old: '' }); drawPrice(); };
        var none = $('#vnone'); if (none) none.onclick = function () { var v = vars[0] || {}; p.price = v.price; p.old = v.old; vars = []; drawPrice(); };
        var pe = $('[data-k="price"]'), oe = $('[data-k="old"]');
        if (pe) { var show = function () { var a = +pe.value, b = +oe.value; $('#dpv').textContent = b > a && a > 0 ? 'Discount shown: ' + Math.round((1 - a / b) * 100) + '% OFF (You save ' + money(b - a) + ')' : ''; }; pe.oninput = oe.oninput = show; show(); }
      }
      drawPrice();
      var chg = function () { $('#chg').hidden = $('[data-k="free"]').checked; }; $('[data-k="free"]').onchange = chg; chg();

      F.onsubmit = function (e) {
        e.preventDefault(); var err = $('#perr'); err.hidden = true;
        var body = { name: val('name'), short: val('short'), brand: val('brand'), badge: val('badge'), video: val('video'), about: val('about'), free: val('free'), charge: val('charge'), inStock: val('inStock'), active: val('active'), hot: val('hot'), popular: val('popular'),
          tags: $$('#tags input:checked').map(function (c) { return c.value; }), gallery: imgs.map(function (m) { return m.full; }), img: imgs[0] && imgs[0].full, imgSm: imgs[0] && imgs[0].sm,
          features: val('features').split('\n'), specs: specs.map(function (r) { return [String(r[0]).trim(), String(r[1]).trim()]; }).filter(function (r) { return r[0] && r[1]; }) };
        SPEC_FIELDS.forEach(function (f) { body[f[0]] = val(f[0]); });
        ['autoOff', 'eco'].forEach(function (k) { var v = val(k); if (v === 'y') body[k] = true; else if (v === 'n') body[k] = false; });
        if (vars.length) body.variants = vars.map(function (v) { return { name: v.name, price: v.price, old: v.old }; }); else { body.price = val('price'); body.old = val('old'); }
        var b = $('button[type=submit]', F); b.disabled = true;
        api('admin/products' + (isNew ? '' : '/' + encodeURIComponent(id)), { method: isNew ? 'POST' : 'PUT', json: body }).then(function () { toast('Saved'); location.hash = '#/products'; },
          function (er) { err.textContent = er.message; err.hidden = false; err.scrollIntoView({ block: 'center', behavior: 'smooth' }); b.disabled = false; });
      };
      var del = $('#pdel'); if (del) del.onclick = function () { if (confirm('Delete "' + p.name + '" permanently? To only hide it, untick "Show in shop" instead.')) api('admin/products/' + encodeURIComponent(id), { method: 'DELETE' }).then(function () { toast('Deleted'); location.hash = '#/products'; }, fail); };
    }, fail);
  }

  /* ---------- ব্যানার ---------- */
  function banners() {
    Promise.all([api('admin/settings'), api('admin/products')]).then(function (r) {
      var hero = r[0].hero.slice(), prods = r[1].products;
      var draw = function () {
        $('#blist').innerHTML = hero.map(function (h, i) {
          return '<div class="card"><img class="banner-im" src="' + esc(fileUrl(h.img)) + '" alt=""><label class="f">Opens this product when tapped<select data-bp="' + i + '"><option value="">— none —</option>' +
            prods.map(function (p) { return '<option value="' + esc(p.id) + '"' + (h.product === p.id ? ' selected' : '') + '>' + esc(p.name) + '</option>'; }).join('') + '</select></label>' +
            '<label class="f">Short description <small>For screen readers</small><input data-ba="' + i + '" value="' + esc(h.alt) + '"></label><div class="stat-btns"><button type="button" class="btn line sm" data-bu="' + i + '"' + (i === 0 ? ' disabled' : '') + '>↑ Up</button><button type="button" class="btn line sm" data-bd="' + i + '"' + (i === hero.length - 1 ? ' disabled' : '') + '>↓ Down</button><button type="button" class="btn danger sm" data-br="' + i + '">Remove</button></div></div>';
        }).join('') || '<p class="muted">No banners yet. The banner section is hidden on the shop.</p>';
        $$('[data-bp]').forEach(function (e) { e.onchange = function () { hero[+e.dataset.bp].product = e.value; }; });
        $$('[data-ba]').forEach(function (e) { e.oninput = function () { hero[+e.dataset.ba].alt = e.value; }; });
        $$('[data-bu]').forEach(function (e) { e.onclick = function () { var i = +e.dataset.bu, t = hero[i]; hero[i] = hero[i - 1]; hero[i - 1] = t; draw(); }; });
        $$('[data-bd]').forEach(function (e) { e.onclick = function () { var i = +e.dataset.bd, t = hero[i]; hero[i] = hero[i + 1]; hero[i + 1] = t; draw(); }; });
        $$('[data-br]').forEach(function (e) { e.onclick = function () { hero.splice(+e.dataset.br, 1); draw(); }; });
      };
      shell('banners', '<h2>Banners</h2><div class="card"><p class="muted" style="margin:0">Use one image per banner, 16:9 (for example 1920 × 1080 px). The same image shows on mobile and desktop.</p><input type="file" id="bf" accept="image/*" hidden><label class="btn line" for="bf">+ Add banner image</label></div><div id="blist" class="rows"></div><div class="sticky-save"><button class="btn" id="bsave">Save banners</button></div>', pendingCount);
      draw();
      $('#bf').onchange = function () { var f = this.files[0]; this.value = ''; if (!f) return; toast('Uploading…'); resize(f, 1920, .85).then(upload).then(function (u) { hero.push({ img: u, product: '', alt: '' }); draw(); toast('Image added. Remember to save.'); }, fail); };
      $('#bsave').onclick = function () { api('admin/settings', { method: 'PUT', json: { hero: hero } }).then(function () { toast('Banners saved'); }, fail); };
    }, fail);
  }

  /* ---------- অফার ও প্রোমো ---------- */
  function settings() {
    api('admin/settings').then(function (s) {
      var o = s.offer, pr = s.promo, lo = s.loyalty;
      shell('settings', '<h2>Offers</h2><form id="sf"><div class="card"><h3>Free delivery offer</h3><label class="chk"><input type="checkbox" id="oe"' + (o.enabled ? ' checked' : '') + '> Offer is ON</label>' +
        '<div class="grid2 keep"><label class="f">Minimum order (৳)<input id="om" type="number" inputmode="numeric" value="' + esc(o.minOrder) + '"></label></div>' +
        '<label class="f">Scrolling text at the top<input id="ot" maxlength="160" value="' + esc(o.text) + '"></label>' +
        '<div class="grid2 keep"><label class="f">Start date <small>Optional</small><input id="os" type="date" value="' + esc(o.startDate) + '"></label><label class="f">End date <small>Optional</small><input id="oz" type="date" value="' + esc(o.endDate) + '"></label></div></div>' +
        '<div class="card"><h3>Promo code</h3><div class="grid2 keep"><label class="f">Code<input id="pc" maxlength="20" value="' + esc(pr.code) + '" style="text-transform:uppercase"></label><label class="f">Discount %<input id="pp" type="number" inputmode="numeric" min="1" max="90" value="' + esc(pr.percent) + '"></label></div></div>' +
        '<div class="card"><h3>Buy ' + esc(lo.orders) + ' get ৳' + esc(lo.reward) + ' discount</h3><label class="chk"><input type="checkbox" id="le"' + (lo.enabled ? ' checked' : '') + '> Reward is ON</label>' +
        '<div class="grid2 keep"><label class="f">Orders needed<input id="ln" type="number" inputmode="numeric" value="' + esc(lo.orders) + '"></label><label class="f">Discount (৳)<input id="lr" type="number" inputmode="numeric" value="' + esc(lo.reward) + '"></label></div>' +
        '<div class="grid2 keep"><label class="f">Minimum order (৳)<input id="lm" type="number" inputmode="numeric" value="' + esc(lo.min) + '"></label><label class="f">Promo code <small>যোগ্য customer নিজের card এ এই কোড দেখবে</small><input id="lc" maxlength="20" value="' + esc(lo.code) + '" style="text-transform:uppercase"></label></div>' +
        '<p class="muted">Customer এর ' + esc(lo.orders) + 'টি অর্ডার <b>Delivered</b> হলে card এ কোডটা দেখা যাবে, আর শুধু ওই account এ কাজ করবে। একবার ব্যবহারের পর আবার শূন্য থেকে শুরু। অন্য কেউ কোড জানলেও তার ' + esc(lo.orders) + 'টি delivered অর্ডার না থাকলে কাজ করবে না। অর্ডার Cancel করলে reward ফিরে আসে।</p></div>' +
        '<div class="sticky-save"><button class="btn" type="submit">Save</button></div></form>', pendingCount);
      $('#sf').onsubmit = function (e) {
        e.preventDefault();
        api('admin/settings', { method: 'PUT', json: { offer: { enabled: $('#oe').checked, minOrder: $('#om').value, text: $('#ot').value, startDate: $('#os').value, endDate: $('#oz').value }, loyalty: { enabled: $('#le').checked, orders: $('#ln').value, reward: $('#lr').value, min: $('#lm').value, code: $('#lc').value }, promo: { code: $('#pc').value, percent: $('#pp').value } } }).then(function () { toast('Saved'); }, fail);
      };
    }, fail);
  }

  /* ---------- ইউজার ---------- */
  var userQ = '';
  function users() {
    api('admin/users?q=' + encodeURIComponent(userQ)).then(function (j) {
      var owner = me.role === 'owner';
      shell('users', '<h2>Users</h2>' + (owner ? '' : '<p class="muted">Only the owner can make admins or reset passwords.</p>') + '<input id="uq" placeholder="Search name, email or mobile" value="' + esc(userQ) + '"><div class="rows">' +
        j.users.map(function (u) {
          return '<div class="row urow"><div class="thumb">' + esc((u.name || '?').charAt(0).toUpperCase()) + '</div><div class="grow"><b>' + esc(u.name) + '</b><small>' + esc(u.email || u.phone) + ' · ' + u.orders + ' order(s)</small>' + (u.pw_req ? '<small class="fgchip">🔑 Forgot password — asked ' + ago(u.pw_req) + '</small>' : '') + '</div>' +
            '<span class="pill ' + (u.role === 'customer' ? 'off' : '') + '">' + u.role + '</span>' +
            (owner && u.role !== 'owner' ? '<div class="stat-btns"><button class="btn line sm" data-role="' + u.id + '" data-to="' + (u.role === 'admin' ? 'customer' : 'admin') + '">' + (u.role === 'admin' ? 'Remove admin' : 'Make admin') + '</button><button class="btn line sm" data-rs="' + u.id + '">Reset password</button></div>' : '') + '</div>';
        }).join('') + '</div>', pendingCount);
      var t; $('#uq').oninput = function () { var v = this.value; clearTimeout(t); t = setTimeout(function () { userQ = v; users(); }, 450); };
      var f = $('#uq'); if (userQ) { f.focus(); f.setSelectionRange(f.value.length, f.value.length); }
      $$('[data-role]').forEach(function (b) { b.onclick = function () { api('admin/users/' + b.dataset.role, { method: 'PATCH', json: { role: b.dataset.to } }).then(function () { toast('Updated'); users(); }, fail); }; });
      $$('[data-rs]').forEach(function (b) { b.onclick = function () { var pw = prompt('Type a new temporary password (at least 6 characters). Tell the customer to change it after signing in.'); if (pw) api('admin/users/' + b.dataset.rs + '/reset', { json: { password: pw } }).then(function () { toast('Password changed'); }, fail); }; });
    }, fail);
  }

  /* ---------- সেটআপ: সাইন-ইন টিক, নোটিফিকেশন, ব্লক লিস্ট ---------- */
  function setup() {
    var owner = me.role === 'owner';
    Promise.all([api('admin/settings'), owner ? api('admin/notify') : Promise.resolve(null), api('admin/blocked'), owner ? api('admin/mail') : Promise.resolve({ keys: [] })]).then(function (r) {
      var g = r[0].gate || { requireLogin: true }, n = r[1], bl = r[2].blocked, mk = r[3].keys || [];
      var perm = window.Notification ? Notification.permission : 'unsupported';
      shell('setup', '<h2>Setup</h2>' +
        '<div class="card"><h3>Order sign-in</h3><label class="chk"><input type="checkbox" id="gl"' + (g.requireLogin ? ' checked' : '') + '> Customers must sign up / sign in before ordering</label>' +
        '<p class="muted">ON: order দিতে account লাগবে (reward, tracking ও history ভালো কাজ করে, fake order কমে)। OFF: customer সাইন-ইন ছাড়াই Cash on Delivery অর্ডার দিতে পারবে (অর্ডার বেশি আসতে পারে)। Reward code নিতে সবসময় account লাগবে।</p><button class="btn" id="gs">Save</button></div>' +
        '<div class="card"><h3>Alerts in this browser</h3><p class="muted" style="margin:0 0 8px">Admin page খোলা থাকলে নতুন অর্ডার এলে শব্দ ও Chrome notification আসবে। (পেজ বন্ধ থাকলে নিচের Telegram ব্যবহার করুন।)</p><button class="btn line" id="pn">' + (perm === 'granted' ? 'Alerts are ON ✓' : perm === 'denied' ? 'Blocked in browser settings' : perm === 'unsupported' ? 'Not supported here' : 'Turn on alerts') + '</button></div>' +
        (owner ? '<div class="card"><h3>Telegram order alerts (free)</h3><ol class="muted steps"><li>Telegram এ <b>@BotFather</b> খুলে <b>/newbot</b> দিন, নাম দিন। সে একটি <b>token</b> দেবে।</li><li>আপনার নতুন bot এ গিয়ে <b>Start</b> চাপুন।</li><li><b>@userinfobot</b> এ Start দিলে আপনার <b>Chat ID</b> (সংখ্যা) দেবে।</li><li>নিচে দুটো বসিয়ে Save, তারপর Send test চাপুন।</li></ol>' +
          '<label class="f">Bot token<input id="tt" autocomplete="off" placeholder="123456789:ABC..." value="' + esc(n.tgToken) + '"></label><label class="f">Chat ID<input id="tc" inputmode="numeric" autocomplete="off" placeholder="e.g. 123456789" value="' + esc(n.tgChat) + '"></label>' +
          '<div class="stat-btns"><button class="btn" id="ts">Save</button><button class="btn line" id="tt2">Send test</button></div></div>' : '<div class="card"><p class="muted" style="margin:0">Only the owner can set up Telegram alerts.</p></div>') +
        (owner ? '<div class="card"><h3>Order & subscriber emails (Web3Forms)</h3><p class="muted" style="margin:0 0 8px">অর্ডার ও subscribe ইমেইল যে Web3Forms access key দিয়ে যাবে। ফ্রি প্ল্যানে প্রতি <b>মাসে ২৫০টা</b> ইমেইল (মাস শেষে আবার ০ থেকে শুরু)। একাধিক key দিলে একটার লিমিট শেষ হলে সাইট নিজেই পরেরটা দিয়ে পাঠায়। প্রতি লাইনে একটা key (সর্বোচ্চ ৫টা)।</p>' +
          '<label class="f">Access keys<textarea id="mk" rows="3" autocomplete="off" spellcheck="false" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx">' + esc(mk.join('\n')) + '</textarea></label>' +
          '<div class="stat-btns"><button class="btn" id="mks">Save</button><button class="btn line" id="mkt">Send test email</button></div><p class="muted" id="mkr" style="margin:8px 0 0"></p></div>' : '') +
        '<div class="card"><h3>Blocked numbers (' + bl.length + ')</h3>' + (bl.length ? '<div class="rows">' + bl.map(function (b) { return '<div class="row"><div class="grow"><b>' + esc(b.phone) + '</b><small>' + esc(b.note || '') + '</small></div><button class="btn line sm" data-ub="' + esc(b.phone) + '">Unblock</button></div>'; }).join('') + '</div>' : '<p class="muted" style="margin:0">None. Open a suspicious order and tap Block.</p>') + '</div>', pendingCount);
      $('#gs').onclick = function () { api('admin/settings', { method: 'PUT', json: { gate: { requireLogin: $('#gl').checked } } }).then(function () { toast($('#gl').checked ? 'Sign-in is required' : 'Guests can order now'); }, fail); };
      $('#pn').onclick = function () { if (window.Notification && Notification.permission === 'default') Notification.requestPermission().then(function () { setup(); }); };
      $$('[data-ub]').forEach(function (b) { b.onclick = function () { api('admin/block/' + b.dataset.ub, { method: 'DELETE' }).then(function () { toast('Unblocked'); setup(); }, fail); }; });
      if (owner) {
        $('#mks').onclick = function () { api('admin/mail', { method: 'PUT', json: { keys: $('#mk').value } }).then(function () { toast('Saved. New orders will use these keys.'); }, fail); };
        $('#mkt').onclick = function () {
          var ks = $('#mk').value.split(/[\s,]+/).filter(Boolean), out = $('#mkr'); if (!ks.length) { out.textContent = 'Add a key first.'; return; }
          out.textContent = 'Sending…'; var res = [], i = 0;
          (function next() { if (i >= ks.length) { out.textContent = res.join('  ·  '); return; } var k = ks[i++];
            fetch('https://api.web3forms.com/submit', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ access_key: k, subject: 'Manar BD test email', from_name: 'Manar BD', message: 'Test email from Setup. Orders will arrive like this.' }) })
              .then(function (x) { return x.json(); }).then(function (j) { res.push('Key ' + i + ': ' + (j.success ? 'OK, check inbox' : (j.message || 'failed'))); }, function () { res.push('Key ' + i + ': no connection'); }).then(next); })();
        };
        $('#ts').onclick = function () { api('admin/notify', { method: 'PUT', json: { tgToken: $('#tt').value.trim(), tgChat: $('#tc').value.trim() } }).then(function () { toast('Saved'); }, fail); };
        $('#tt2').onclick = function () { api('admin/notify/test', { json: {} }).then(function (j) { toast(j.ok ? 'Test sent. Check Telegram.' : 'Telegram says: ' + (j.err || 'unknown error')); }, fail); };
      }
    }, fail);
  }
  /* নতুন অর্ডার এলে শব্দ + Chrome notification (admin পেজ খোলা থাকলে) */
  var lastTop = null;
  function beep() { try { var c = new (window.AudioContext || window.webkitAudioContext)(), o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination); o.frequency.value = 880; g.gain.value = .15; o.start(); setTimeout(function () { o.frequency.value = 1175; }, 150); setTimeout(function () { o.stop(); c.close(); }, 320); } catch (e) {} }
  setInterval(function () {
    if (!me || me.role === 'customer' || document.hidden && !window.Notification) return;
    api('admin/stats').then(function (j) {
      var top = j.recent && j.recent[0] ? j.recent[0].id : 0, was = pendingCount; pendingCount = j.pending;
      if (lastTop !== null && top > lastTop) {
        var o = j.recent[0]; beep(); toast('New order ' + o.number);
        try { if (window.Notification && Notification.permission === 'granted') new Notification('New order ' + o.number, { body: o.name + ' · ৳' + o.total, icon: '/images/brand/favicon.png' }); } catch (e) {}
        var c = document.querySelector('.tabs a[href="#/orders"]'); if (c) { var b = c.querySelector('.cnt'); if (!b) { b = document.createElement('span'); b.className = 'cnt'; c.appendChild(b); } b.textContent = pendingCount; }
      }
      lastTop = top;
    }, function () {});
  }, 25000);

  /* ---------- রাউটার ---------- */
  function route() {
    if (!me) { loginView(); return; }
    if (me.role === 'customer') { app.innerHTML = '<div class="login"><h2>No admin access</h2><p class="msg bad">This account (' + esc(me.name) + ') is not an admin.</p><a class="btn" href="/">Back to shop</a><button class="btn line" id="o2">Sign out</button></div>'; $('#o2').onclick = function () { api('auth/logout', { method: 'POST', json: {} }).then(function () { me = null; route(); }); }; return; }
    var h = location.hash.replace(/^#\/?/, '').split('/'), a = h[0] || '';
    window.scrollTo(0, 0);
    var mw = app.querySelector('main.wrap'); if (mw) mw.innerHTML = '<div class="mbl in" role="status" aria-label="Loading"><i></i></div>';
    if (a === '') dashboard(); else if (a === 'orders') h[1] ? orderDetail(h[1]) : orders(); else if (a === 'products') products();
    else if (a === 'product') productForm(decodeURIComponent(h[1] || 'new')); else if (a === 'banners') banners(); else if (a === 'settings') settings(); else if (a === 'users') users(); else if (a === 'setup') setup(); else dashboard();
  }
  var started = false;
  window.addEventListener('hashchange', function () { if (started) route(); });
  loading(); api('me').then(function (j) { me = j.user; started = true; route(); }, function () { started = true; loginView(); });
})();
