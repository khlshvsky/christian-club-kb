/* ============================================================
   Вкладки «Карта» и «Хронология».
   Данные: data/land.js (очертания суши), data/events.js (города и события).
   Клик по городу на карте открывает хронологию этого города (#chrono/<город>).
   Зависит от assets/app.js (KB.*), data/*.js и D3.
   ============================================================ */
(function(){
  "use strict";
  if(typeof EVENTS === 'undefined' || typeof CITIES === 'undefined') return;
  var KB = window.KB; KB.hooks = KB.hooks || {};
  var norm = KB.norm || function(s){ return String(s).toLowerCase().replace(/ё/g,'е'); };
  function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function goHash(h){ if(location.hash === h){ KB.route(); } else { location.hash = h; } }
  function plural(n, a, b, c){ var m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? a : (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? b : c); }

  /* ---------- Данные ---------- */
  var CAT = {}; EVENT_CATS.forEach(function(c){ CAT[c.id] = c; });
  var catOn = {}; EVENT_CATS.forEach(function(c){ catOn[c.id] = true; });
  var CITY = {};
  Object.keys(CITIES).forEach(function(id){ var c = CITIES[id]; CITY[id] = {id:id, name:c[0], lat:c[1], lon:c[2], reg:c[3]}; });
  var EV = EVENTS.map(function(e, i){
    return {i:i, y:e[0], yl:e[1], city:e[2], cat:e[3], t:e[4], d:e[5],
      links:(e[6] || '').split(';').filter(Boolean).map(function(l){ return {k:l.charAt(0), v:l.slice(2)}; })};
  });
  EV.sort(function(a, b){ return a.y - b.y || a.i - b.i; });
  EV.forEach(function(e){ e.n = norm([e.t, e.d, e.yl, CITY[e.city].name, CAT[e.cat].t].join(' ')); });
  KB.events = EV; KB.cities = CITY; KB.eventCats = CAT;

  var qSlug = {}; (KB.qaIndex || []).forEach(function(x){ qSlug[x.q] = x.slug; });
  var bookName = {};
  if(typeof BIBLE !== 'undefined') Object.keys(BIBLE).forEach(function(g){ BIBLE[g].forEach(function(r){ bookName[r[0]] = r[1]; }); });
  var creedArt = {}; if(typeof CREED !== 'undefined') CREED.forEach(function(a){ creedArt[a.n] = a; });

  function linkHtml(l){
    if(l.k === 'q' && qSlug[l.v]) return '<a class="ev-l" href="#q/' + qSlug[l.v] + '"><span>Вопрос</span>' + esc(l.v) + '</a>';
    if(l.k === 't') return '<a class="ev-l" href="#terms/tree/t:' + encodeURIComponent(l.v) + '"><span>Термин</span>' + esc(l.v) + '</a>';
    if(l.k === 'c' && creedArt[l.v]) return '<a class="ev-l" href="#creed/' + l.v + '"><span>Символ веры</span>Член ' + l.v + ': ' + esc(creedArt[l.v].theme) + '</a>';
    if(l.k === 'b' && bookName[l.v]) return '<a class="ev-l" href="#bible/' + encodeURIComponent(l.v) + '"><span>Книга</span>' + esc(bookName[l.v]) + '</a>';
    return '';
  }
  function visible(e){ return catOn[e.cat]; }

  // Категории — общие для карты и хронологии
  function catsHtml(){
    return EVENT_CATS.map(function(c){
      return '<button class="ev-cat" type="button" data-cat="' + c.id + '" aria-pressed="' + (catOn[c.id] ? 'true' : 'false') + '" style="--cc:var(--c' + c.c + ')">' + esc(c.t) + '</button>';
    }).join('') + (EVENT_CATS.every(function(c){ return catOn[c.id]; }) ? '' : '<button class="ev-cat-all" type="button">Все категории</button>');
  }
  function renderCats(){
    document.querySelectorAll('.ev-cats').forEach(function(box){ box.innerHTML = catsHtml(); });
  }
  document.addEventListener('click', function(e){
    var b = e.target.closest('.ev-cat'); if(!b) return;
    var id = b.getAttribute('data-cat');
    var allOn = EVENT_CATS.every(function(c){ return catOn[c.id]; });
    if(allOn && !e.altKey){ EVENT_CATS.forEach(function(c){ catOn[c.id] = (c.id === id); }); }  // первый клик — только эта категория
    else {
      catOn[id] = !catOn[id];
      if(!EVENT_CATS.some(function(c){ return catOn[c.id]; })) EVENT_CATS.forEach(function(c){ catOn[c.id] = true; });
    }
    renderCats();
    if(mapBuilt) updateMap();
    if(chronoBuilt) renderChrono();
  });
  document.addEventListener('click', function(e){
    if(!e.target.closest('.ev-cat-all')) return;
    EVENT_CATS.forEach(function(c){ catOn[c.id] = true; });
    renderCats(); if(mapBuilt) updateMap(); if(chronoBuilt) renderChrono();
  });

  /* ============================================================
     Карта
     ============================================================ */
  var ERAS = [
    {id:'all', t:'Все века', a:-1e4, b:1e4},
    {id:'bc',  t:'До Р. Х.', a:-1e4, b:-1},
    {id:'e1',  t:'I–III вв.', a:0, b:300},
    {id:'e2',  t:'IV–VIII вв.', a:301, b:800},
    {id:'e3',  t:'IX–XVII вв.', a:801, b:1700},
    {id:'e4',  t:'XVIII–XXI вв.', a:1701, b:1e4}
  ];
  var PRESETS = [
    {id:'all',   t:'Вся карта'},
    {id:'holy',  t:'Святая Земля', box:[34.1, 31.2, 36.5, 33.7]},
    {id:'aegean',t:'Греция и Малая Азия', box:[20.5, 36.0, 36.5, 42.0]},
    {id:'rus',   t:'Русь', box:[22.5, 44.0, 44.5, 66.0]}
  ];
  var SEAS = [
    ['Средиземное море', 34.2, 19.5], ['Чёрное море', 43.3, 34.6], ['Балтийское море', 57.6, 19.4],
    ['Каспийское море', 42.2, 50.8], ['Красное море', 26.0, 35.6], ['Белое море', 66.0, 38.6], ['Адриатическое море', 42.9, 15.6]
  ];
  // Внутренние воды Святой Земли (в контуре суши 1:50m их нет)
  var LAKES = [
    ['Галилейское море', [[35.52,32.70],[35.58,32.70],[35.64,32.75],[35.65,32.83],[35.61,32.89],[35.55,32.88],[35.51,32.81],[35.52,32.70]], [35.67,32.60]],
    ['Мёртвое море', [[35.45,31.77],[35.53,31.76],[35.58,31.60],[35.57,31.35],[35.55,31.13],[35.48,31.05],[35.40,31.15],[35.41,31.40],[35.42,31.60],[35.45,31.77]], [35.78,31.40]]
  ];
  var JORDAN = [[35.57,32.70],[35.58,32.55],[35.56,32.40],[35.55,32.25],[35.53,32.10],[35.54,31.95],[35.55,31.77]];
  var era = 'all', mapBuilt = false, hiCity = null, TW = {};
  var svg, gLand, gMarks, gNums, gLabels, proj, path, zoom, T = null, W = 0, H = 0, data = [];
  var wrap, tip;

  function eraOf(id){ for(var i = 0; i < ERAS.length; i++) if(ERAS[i].id === id) return ERAS[i]; return ERAS[0]; }
  function cityStats(){
    var er = eraOf(era), m = {};
    EV.forEach(function(e){
      if(!visible(e) || e.y < er.a || e.y > er.b) return;
      var s = m[e.city] || (m[e.city] = {c:CITY[e.city], n:0, cats:{}, ev:[]});
      s.n++; s.cats[e.cat] = (s.cats[e.cat] || 0) + 1; s.ev.push(e);
    });
    return Object.keys(m).map(function(k){
      var s = m[k], best = null;
      Object.keys(s.cats).forEach(function(c){ if(!best || s.cats[c] > s.cats[best]) best = c; });
      s.cat = best; return s;
    }).sort(function(a, b){ return b.n - a.n; });
  }
  function radius(n){ return 4.5 + Math.sqrt(n) * 2.6; }

  function buildMap(){
    wrap = document.getElementById('mapWrap'); tip = document.getElementById('mapTip');
    var host = document.getElementById('mapSvgHost');
    W = Math.max(300, wrap.clientWidth);
    H = Math.round(Math.max(380, Math.min(W * 0.78, 720)));
    host.innerHTML = '';
    proj = d3.geoConicConformal().parallels([34, 58]).rotate([-24, 0]);
    var pts = {type:'MultiPoint', coordinates:Object.keys(CITY).map(function(k){ return [CITY[k].lon, CITY[k].lat]; })};
    var pad = W < 560 ? 18 : 34;
    proj.fitExtent([[pad, pad], [W - pad, H - pad]], pts);
    path = d3.geoPath(proj);
    svg = d3.select(host).append('svg').attr('class', 'map-svg').attr('width', W).attr('height', H)
      .attr('viewBox', '0 0 ' + W + ' ' + H).attr('role', 'img')
      .attr('aria-label', 'Карта городов, где происходили события священной и церковной истории');
    svg.append('rect').attr('class', 'm-sea').attr('width', W).attr('height', H);
    gLand = svg.append('g').attr('class', 'm-land-g');
    gLand.append('path').attr('class', 'm-grat').attr('d', path(d3.geoGraticule().step([10, 10])()));
    gLand.append('path').attr('class', 'm-land').attr('d', path(LAND));
    var water = LAKES.map(function(l){
      var f = {type:'Feature', geometry:{type:'Polygon', coordinates:[l[1].slice()]}};
      if(d3.geoArea(f) > 2 * Math.PI) f.geometry.coordinates[0].reverse();
      return f;
    });
    gLand.append('path').attr('class', 'm-lake').attr('d', path({type:'FeatureCollection', features:water}));
    gLand.append('path').attr('class', 'm-river').attr('d', path({type:'LineString', coordinates:JORDAN}));
    var sea = gLand.append('g').attr('class', 'm-seas');
    SEAS.forEach(function(s){ var p = proj([s[2], s[1]]); sea.append('text').attr('x', p[0]).attr('y', p[1]).text(s[0]); });
    gMarks = svg.append('g').attr('class', 'm-marks');
    gNums = svg.append('g').attr('class', 'm-nums');   // числа поверх всех кружков (соседний город не закрывает)
    gLabels = svg.append('g').attr('class', 'm-labels');
    zoom = d3.zoom().scaleExtent([1, 18]).translateExtent([[-W * 0.1, -H * 0.1], [W * 1.1, H * 1.1]])
      .on('zoom', function(ev){ T = ev.transform; place(); hideTip(); });
    svg.call(zoom).on('dblclick.zoom', null);
    T = d3.zoomIdentity;
    mapBuilt = true;
    updateMap();
  }

  function updateMap(){
    data = cityStats();
    var sel = gMarks.selectAll('g.m-city').data(data, function(d){ return d.c.id; });
    sel.exit().remove();
    var en = sel.enter().append('g').attr('class', 'm-city').attr('tabindex', 0).attr('role', 'link');
    en.append('circle').attr('class', 'm-halo');
    en.append('circle').attr('class', 'm-dot');
    en.on('mouseenter', function(ev, d){ showTip(d); })
      .on('mouseleave', hideTip)
      .on('focus', function(ev, d){ showTip(d); })
      .on('blur', hideTip)
      .on('click', function(ev, d){ pickCity(d.c.id); })
      .on('keydown', function(ev, d){ if(ev.key === 'Enter' || ev.key === ' '){ ev.preventDefault(); pickCity(d.c.id); } });
    var all = en.merge(sel);
    all.order();
    all.attr('aria-label', function(d){ return d.c.name + ': ' + d.n + ' ' + plural(d.n, 'событие', 'события', 'событий') + ' — открыть карточку города'; })
      .classed('is-hi', function(d){ return d.c.id === hiCity; })
      .style('--cc', function(d){ return 'var(--c' + CAT[d.cat].c + ')'; });
    all.select('.m-dot').attr('r', function(d){ return radius(d.n); });
    all.select('.m-halo').attr('r', function(d){ return radius(d.n) + 6; });
    var nums = gNums.selectAll('text').data(data.filter(function(d){ return radius(d.n) >= 9; }), function(d){ return d.c.id; });
    nums.exit().remove();
    nums.enter().append('text').attr('class', 'm-n').attr('dy', '0.35em').merge(nums).text(function(d){ return d.n; });
    // подписи
    // Подпись = два текста: обводка-«ореол» снизу и сам текст сверху.
    // (paint-order в Safari иногда рисует обводку поверх букв — подписи становились тёмными пятнами.)
    var lab = gLabels.selectAll('g.m-lab').data(data, function(d){ return d.c.id; });
    lab.exit().remove();
    var le = lab.enter().append('g').attr('class', 'm-lab');
    le.append('text').attr('class', 'm-lh').text(function(d){ return d.c.name; });
    le.append('text').attr('class', 'm-lt').text(function(d){ return d.c.name; })
      .each(function(d){ var w = this.getComputedTextLength(); if(w) TW[d.c.id] = w; });
    renderCityList();
    renderCityCard();
    place();
  }

  function place(){
    if(!gMarks) return;
    var k = T ? T.k : 1;
    gLand.attr('transform', T);
    gLand.select('.m-seas').style('font-size', (13 / k) + 'px').style('display', k > 5 ? 'none' : null);
    data.forEach(function(d){ var p = proj([d.c.lon, d.c.lat]); d.x = T.applyX(p[0]); d.y = T.applyY(p[1]); });
    gMarks.selectAll('g.m-city').attr('transform', function(d){ return 'translate(' + d.x + ',' + d.y + ')'; });
    gNums.selectAll('text').attr('x', function(d){ return d.x; }).attr('y', function(d){ return d.y; });
    // раскладка подписей без наложений: сначала крупные города
    var boxes = [];
    data.forEach(function(d){ var r = radius(d.n); boxes.push([d.x - r, d.y - r, d.x + r, d.y + r, d.c.id]); });
    var order = data.slice().sort(function(a, b){ return (b.c.id === hiCity) - (a.c.id === hiCity) || b.n - a.n; });
    var placed = {};
    order.forEach(function(d){
      var r = radius(d.n), w = TW[d.c.id] || d.c.name.length * 7.4, h = 15, cands = [
        [d.x + r + 4, d.y + 4.5, 'start', d.x + r + 3, d.y - 7, d.x + r + 6 + w, d.y + 7],
        [d.x - r - 4, d.y + 4.5, 'end', d.x - r - 6 - w, d.y - 7, d.x - r - 3, d.y + 7],
        [d.x, d.y - r - 5, 'middle', d.x - w / 2 - 2, d.y - r - 5 - h + 3, d.x + w / 2 + 2, d.y - r - 3],
        [d.x, d.y + r + 14, 'middle', d.x - w / 2 - 2, d.y + r + 2, d.x + w / 2 + 2, d.y + r + 16]
      ];
      for(var i = 0; i < cands.length; i++){
        var c = cands[i];
        if(c[3] < 2 || c[5] > W - 2 || c[4] < 2 || c[6] > H - 2) continue;
        var hit = boxes.some(function(b){ return b[4] !== d.c.id && !(c[5] < b[0] || c[3] > b[2] || c[6] < b[1] || c[4] > b[3]); });
        if(!hit){ placed[d.c.id] = c; boxes.push([c[3], c[4], c[5], c[6], '_']); break; }
      }
    });
    gLabels.selectAll('g.m-lab').each(function(d){
      var c = placed[d.c.id], el = d3.select(this);
      if(!c){ el.style('display', 'none'); return; }
      el.style('display', null).classed('is-hi', d.c.id === hiCity);
      el.selectAll('text').attr('x', c[0]).attr('y', c[1]).attr('text-anchor', c[2]);
    });
  }

  function showTip(d){
    var list = d.ev.slice(0, 4).map(function(e){ return '<li><b>' + esc(e.yl) + '</b> ' + esc(e.t) + '</li>'; }).join('');
    tip.innerHTML = '<div class="mt-h">' + esc(d.c.name) + '</div><div class="mt-s">' + esc(d.c.reg) + ' · ' + d.n + ' ' + plural(d.n, 'событие', 'события', 'событий') + '</div><ul>' + list + '</ul>' +
      (d.n > 4 ? '<div class="mt-more">и ещё ' + (d.n - 4) + '…</div>' : '') + '<div class="mt-go">Нажмите, чтобы открыть карточку города</div>';
    tip.hidden = false;
    var tw = tip.offsetWidth, th = tip.offsetHeight, x = d.x + radius(d.n) + 12, y = d.y - 16;
    if(x + tw > W - 6) x = d.x - radius(d.n) - 12 - tw;
    if(x < 6) x = 6;
    if(y + th > H - 6) y = H - 6 - th;
    if(y < 6) y = 6;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  }
  function hideTip(){ if(tip) tip.hidden = true; }

  function zoomToBox(box, dur){
    if(!box){ svg.transition().duration(dur == null ? 600 : dur).call(zoom.transform, d3.zoomIdentity); return; }
    var c = [[box[0], box[1]], [box[2], box[1]], [box[0], box[3]], [box[2], box[3]], [(box[0] + box[2]) / 2, box[3]]].map(proj);
    var x0 = d3.min(c, function(p){ return p[0]; }), x1 = d3.max(c, function(p){ return p[0]; });
    var y0 = d3.min(c, function(p){ return p[1]; }), y1 = d3.max(c, function(p){ return p[1]; });
    var k = Math.min(18, 0.9 / Math.max((x1 - x0) / W, (y1 - y0) / H));
    var t = d3.zoomIdentity.translate(W / 2, H / 2).scale(k).translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
    svg.transition().duration(dur == null ? 700 : dur).call(zoom.transform, t);
  }
  function zoomToCity(id){
    var c = CITY[id]; if(!c) return;
    var p = proj([c.lon, c.lat]), k = Math.max(T ? T.k : 1, 4);
    var t = d3.zoomIdentity.translate(W / 2, H / 2).scale(k).translate(-p[0], -p[1]);
    svg.transition().duration(700).call(zoom.transform, t);
  }

  function renderCityList(){
    var ul = document.getElementById('cityList'); if(!ul) return;
    var tot = data.reduce(function(s, d){ return s + d.n; }, 0);
    document.getElementById('mapCount').textContent = data.length + ' ' + plural(data.length, 'город', 'города', 'городов') + ' · ' + tot + ' ' + plural(tot, 'событие', 'события', 'событий');
    ul.innerHTML = data.map(function(d){
      return '<li><a href="#map/' + d.c.id + '" style="--cc:var(--c' + CAT[d.cat].c + ')"' + (d.c.id === hiCity ? ' aria-current="true"' : '') + '>' +
        '<span class="cl-name">' + esc(d.c.name) + '<small>' + esc(d.c.reg) + '</small></span><span class="cl-n">' + d.n + '</span></a></li>';
    }).join('');
  }

  /* ---------- Карточка города (справа от карты, как карточка термина) ---------- */
  function pickCity(id){
    hideTip();
    if(location.hash !== '#map/' + id) history.pushState(null, '', '#map/' + id);
    hiCity = id;
    gMarks.selectAll('g.m-city').classed('is-hi', function(d){ return d.c.id === hiCity; });
    renderCityList(); renderCityCard(); place();
  }
  function renderCityCard(){
    var side = document.getElementById('mapSide'), body = document.getElementById('cityBody');
    if(!side) return;
    if(!hiCity || !CITY[hiCity]){ side.classList.remove('has-city'); body.hidden = true; body.innerHTML = ''; return; }
    var c = CITY[hiCity];
    var allEv = EV.filter(function(e){ return e.city === hiCity; });
    var st = null; data.forEach(function(d){ if(d.c.id === hiCity) st = d; });
    var ev = st ? st.ev : [];
    var cats = {}; ev.forEach(function(e){ cats[e.cat] = (cats[e.cat] || 0) + 1; });
    var main = st ? CAT[st.cat] : CAT[allEv[0].cat];
    var html =
      '<button class="cc-close" type="button" aria-label="Закрыть карточку города">×</button>' +
      '<div class="tb-path"><button type="button" data-cact="list">← Все города</button><span class="sep">·</span>' +
        '<span class="dot" style="background:var(--c' + main.c + ')"></span>' + esc(c.reg) + '</div>' +
      '<h2 class="tb-title">' + esc(c.name) + '</h2>' +
      '<p class="cc-sum">' + allEv.length + ' ' + plural(allEv.length, 'событие', 'события', 'событий') +
        (allEv.length > 1 ? ' · ' + esc(allEv[0].yl) + ' — ' + esc(allEv[allEv.length - 1].yl) : '') + '</p>' +
      (ev.length ? '<div class="cc-cats">' + EVENT_CATS.filter(function(k){ return cats[k.id]; }).map(function(k){
          return '<span style="--cc:var(--c' + k.c + ')">' + esc(k.t) + ' <b>' + cats[k.id] + '</b></span>'; }).join('') + '</div>' : '') +
      (ev.length < allEv.length ? '<p class="cc-note">С учётом выбранных эпохи и категорий показано ' + ev.length + ' из ' + allEv.length + '. <button type="button" data-cact="reset">Показать все</button></p>' : '') +
      (ev.length ? '<h3 class="tb-h">События</h3><ol class="cc-ev">' + ev.map(function(e){
          return '<li style="--cc:var(--c' + CAT[e.cat].c + ')"><a href="#chrono/e' + e.i + '"><span class="cc-y">' + esc(e.yl) + '</span>' +
            '<span class="cc-t">' + esc(e.t) + '</span></a><p>' + esc(e.d) + '</p></li>';
        }).join('') + '</ol>' : '') +
      '<div class="tb-actions"><a href="#chrono/' + hiCity + '">Хронология города</a>' +
        '<button type="button" data-cact="zoom">Приблизить на карте</button></div>';
    body.innerHTML = html;
    if(KB.linkTerms) body.querySelectorAll('.cc-ev p').forEach(function(p){ KB.linkTerms(p, {max:2}); });
    body.hidden = false; side.classList.add('has-city');
    body.scrollTop = 0; side.scrollTop = 0;
  }
  document.addEventListener('click', function(e){
    var b = e.target.closest('#cityBody [data-cact], #cityBody .cc-close'); if(!b) return;
    var act = b.getAttribute('data-cact');
    if(act === 'zoom'){ zoomToCity(hiCity); return; }
    if(act === 'reset'){
      era = 'all';
      document.querySelectorAll('#eraBtns [data-era]').forEach(function(x){ x.setAttribute('aria-checked', x.getAttribute('data-era') === 'all' ? 'true' : 'false'); });
      EVENT_CATS.forEach(function(c){ catOn[c.id] = true; }); renderCats();
      updateMap(); if(chronoBuilt) renderChrono(); return;
    }
    // «Все города» и крестик — закрыть карточку
    history.pushState(null, '', '#map');
    hiCity = null;
    gMarks.selectAll('g.m-city').classed('is-hi', false);
    renderCityList(); renderCityCard(); place();
  });

  function initMapUi(){
    document.getElementById('eraBtns').innerHTML = ERAS.map(function(e){
      return '<button class="view-btn" type="button" role="radio" data-era="' + e.id + '" aria-checked="' + (e.id === era ? 'true' : 'false') + '">' + e.t + '</button>';
    }).join('');
    document.getElementById('mapPresets').innerHTML = PRESETS.map(function(p){
      return '<button class="mp-btn" type="button" data-preset="' + p.id + '">' + p.t + '</button>';
    }).join('');
    document.getElementById('eraBtns').addEventListener('click', function(e){
      var b = e.target.closest('[data-era]'); if(!b) return;
      era = b.getAttribute('data-era');
      this.querySelectorAll('[data-era]').forEach(function(x){ x.setAttribute('aria-checked', x === b ? 'true' : 'false'); });
      updateMap();
    });
    document.getElementById('mapPresets').addEventListener('click', function(e){
      var b = e.target.closest('[data-preset]'); if(!b) return;
      var p = PRESETS.filter(function(x){ return x.id === b.getAttribute('data-preset'); })[0];
      zoomToBox(p.box);
    });
    document.getElementById('mapZoomIn').addEventListener('click', function(){ svg.transition().duration(300).call(zoom.scaleBy, 1.8); });
    document.getElementById('mapZoomOut').addEventListener('click', function(){ svg.transition().duration(300).call(zoom.scaleBy, 1 / 1.8); });
    var rt, lastW = 0;
    window.addEventListener('resize', function(){
      clearTimeout(rt);
      rt = setTimeout(function(){
        var p = document.getElementById('panel-map');
        if(!mapBuilt || p.hidden) return;
        if(Math.abs(wrap.clientWidth - lastW) < 8) return;
        lastW = wrap.clientWidth; buildMap();
      }, 150);
    });
  }
  var uiReady = false;
  function ensureMap(){
    if(!uiReady){ uiReady = true; initMapUi(); renderCats(); }
    if(!mapBuilt) buildMap();
  }

  KB.hooks.map = {
    activate: function(){ setTimeout(ensureMap, 0); },
    hash: function(){ return '#map' + (hiCity ? '/' + hiCity : ''); },
    route: function(rest){
      setTimeout(function(){
        ensureMap();
        var prev = hiCity;
        hiCity = CITY[rest] ? rest : null;
        updateMap();
        if(hiCity && hiCity !== prev) zoomToCity(hiCity);
      }, 0);
    }
  };

  /* ============================================================
     Хронология
     ============================================================ */
  var chronoBuilt = false, city = null, cq = '';
  var ROMAN = ['', 'I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV','XVI','XVII','XVIII','XIX','XX','XXI'];
  function century(y){ return y < 0 ? 0 : Math.max(1, Math.ceil(y / 100)); }
  function centTitle(c){ return c === 0 ? 'До Рождества Христова' : ROMAN[c] + ' век'; }

  function renderChrono(){
    var head = document.getElementById('chronoHead'), list = document.getElementById('chronoList');
    var q = norm(cq.trim());
    var arr = EV.filter(function(e){ return visible(e) && (!city || e.city === city) && (!q || e.n.indexOf(q) !== -1); });
    var cityTotal = city ? EV.filter(function(e){ return e.city === city; }).length : EV.length;
    if(city){
      var c = CITY[city];
      head.innerHTML = '<div class="ch-k">Хронология города</div><h2>' + esc(c.name) + '</h2>' +
        '<p>' + esc(c.reg) + ' · ' + cityTotal + ' ' + plural(cityTotal, 'событие', 'события', 'событий') + (arr.length !== cityTotal ? ' (показано ' + arr.length + ')' : '') + '</p>' +
        '<div class="ch-actions"><a class="ch-btn" href="#chrono">← Вся хронология</a><a class="ch-btn" href="#map/' + city + '">Показать на карте</a></div>';
    } else {
      head.innerHTML = '<h2>Хронология</h2><p>События священной и церковной истории, о которых говорится в вопросах и ответах, словаре терминов, Символе веры и путеводителе по Библии, — от призвания Авраама до наших дней. ' +
        'Город у каждого события открывает его хронологию; на <a href="#map">карте</a> можно выбрать город сразу. Даты древнейших событий приблизительны.</p>' +
        (arr.length !== EV.length ? '<p class="ch-cnt">Показано ' + arr.length + ' из ' + EV.length + '</p>' : '');
    }
    if(!arr.length){ list.innerHTML = '<p class="ch-empty">Нет событий по выбранным условиям. <button type="button" class="ch-reset">Сбросить фильтры</button></p>'; return; }
    var html = '', cur = null;
    arr.forEach(function(e){
      var cn = century(e.y);
      if(cn !== cur){
        if(cur !== null) html += '</ol></section>';
        cur = cn;
        var n = arr.filter(function(x){ return century(x.y) === cn; }).length;
        html += '<section class="cent"><h3 class="cent-h">' + centTitle(cn) + ' <span>' + n + '</span></h3><ol class="ev-list">';
      }
      var cat = CAT[e.cat];
      html += '<li class="ev" id="ev-' + e.i + '" style="--cc:var(--c' + cat.c + ')">' +
        '<div class="ev-date">' + esc(e.yl) + '</div>' +
        '<div class="ev-body"><div class="ev-meta"><span class="ev-cat-l">' + esc(cat.t) + '</span>' +
        (city ? '' : '<a class="ev-city" href="#chrono/' + e.city + '">' + esc(CITY[e.city].name) + '</a>') +
        '<a class="ev-map" href="#map/' + e.city + '" aria-label="' + esc(CITY[e.city].name) + ' на карте" title="Показать на карте">' +
        '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg></a></div>' +
        '<h4 class="ev-t">' + esc(e.t) + '</h4><p class="ev-d">' + esc(e.d) + '</p>' +
        (e.links.length ? '<div class="ev-links">' + e.links.map(linkHtml).join('') + '</div>' : '') +
        '</div></li>';
    });
    html += '</ol></section>';
    list.innerHTML = html;
    if(KB.linkTerms) list.querySelectorAll('.ev-d').forEach(function(p){ KB.linkTerms(p, {max:3}); });
  }

  function initChronoUi(){
    var eq = document.getElementById('eq'), eclr = document.getElementById('eclr'), t;
    eq.addEventListener('input', function(){
      eclr.style.display = eq.value ? 'block' : 'none';
      clearTimeout(t); t = setTimeout(function(){ cq = eq.value; renderChrono(); }, 120);
    });
    eclr.addEventListener('click', function(){ eq.value = ''; cq = ''; eclr.style.display = 'none'; renderChrono(); eq.focus(); });
    document.getElementById('chronoList').addEventListener('click', function(e){
      if(!e.target.closest('.ch-reset')) return;
      eq.value = ''; cq = ''; eclr.style.display = 'none';
      EVENT_CATS.forEach(function(c){ catOn[c.id] = true; }); renderCats();
      if(mapBuilt) updateMap();
      goHash('#chrono');
    });
  }
  var chronoUi = false;
  function ensureChrono(){
    if(!chronoUi){ chronoUi = true; initChronoUi(); renderCats(); }
    chronoBuilt = true;
  }

  KB.hooks.chrono = {
    activate: function(){ ensureChrono(); },
    hash: function(){ return '#chrono' + (city ? '/' + city : ''); },
    route: function(rest){
      ensureChrono();
      var m = /^e(\d+)$/.exec(rest || '');
      if(m){
        city = null; cq = ''; document.getElementById('eq').value = ''; document.getElementById('eclr').style.display = 'none';
        var ev = EV.filter(function(e){ return e.i === +m[1]; })[0];
        if(ev && !catOn[ev.cat]){ EVENT_CATS.forEach(function(c){ catOn[c.id] = true; }); renderCats(); }
        renderChrono();
        var el = document.getElementById('ev-' + m[1]);
        if(el){ setTimeout(function(){ KB.scrollToEl(el); }, 30); el.classList.add('flash'); setTimeout(function(){ el.classList.remove('flash'); }, 1600); }
        return;
      }
      var prev = city;
      city = CITY[rest] ? rest : null;
      hiCity = city;
      renderChrono();
      if(prev !== city) window.scrollTo({top:0});
    }
  };

  // Счётчики во вкладках
  var mn = document.getElementById('tabMapN'), cn = document.getElementById('tabChronoN');
  if(mn) mn.textContent = Object.keys(CITY).length;
  if(cn) cn.textContent = EV.length;
})();
