/* ============================================================
   Вкладка «Персоналии»: сетка портретов и карточка справа
   (по образцу карточки термина). Данные — data/people.js.
   Адреса: #people, #people/<id>.
   ============================================================ */
(function(){
  "use strict";
  if(typeof PEOPLE === 'undefined') return;
  var KB = window.KB; KB.hooks = KB.hooks || {};
  var norm = KB.norm || function(s){ return String(s).toLowerCase().replace(/ё/g,'е'); };
  function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function goHash(h){ if(location.hash === h){ KB.route(); } else { location.hash = h; } }

  var GROUP = {}; PEOPLE_GROUPS.forEach(function(g){ GROUP[g.id] = g; });
  var BY = {}; PEOPLE.forEach(function(p, i){ p.i = i; BY[p.id] = p; });
  var T = (typeof TERMS_DATA !== 'undefined') ? TERMS_DATA.terms : [];
  var termByName = {}; T.forEach(function(t){ termByName[t.t] = t; });
  var EXTRA_PERSONAL = {'Константин Великий':1, 'Иоанн Предтеча':1};

  // Личный термин персоны (статья в словаре о самом человеке) — для связи «термин ↔ персоналия»
  var personByTerm = {};
  PEOPLE.forEach(function(p){
    p.terms = p.terms.filter(function(n){ return termByName[n]; });
    p.terms.forEach(function(n){ if(!personByTerm[n] && (termByName[n].b === 'otcy' || EXTRA_PERSONAL[n])) personByTerm[n] = p.id; });
    p.n_ = norm([p.n, p.r, p.y, GROUP[p.g].t].join(' '));
    p.b_ = norm(p.bio.join(' ') + ' ' + p.th.join(' '));
  });
  KB.personByTerm = function(name){ return personByTerm[name] ? BY[personByTerm[name]] : null; };
  KB.people = BY;

  // События хронологии, связанные с персоной
  var evIdx = {};   // индекс события → [id персон]
  PEOPLE.forEach(function(p){
    p.events = [];
    if(!p.ev || typeof EVENTS === 'undefined') return;
    var re = new RegExp(p.ev);
    EVENTS.forEach(function(e, i){ if(re.test(e[4] + ' ' + e[5])){ p.events.push(i); (evIdx[i] = evIdx[i] || []).push(p.id); } });
    p.events.sort(function(a, b){ return EVENTS[a][0] - EVENTS[b][0]; });
  });
  KB.peopleForEvent = function(i){ return (evIdx[i] || []).map(function(id){ return BY[id]; }); };

  function img(p){ return (typeof PEOPLE_IMG !== 'undefined' && PEOPLE_IMG[p.id]) || null; }
  function initials(p){
    var w = p.n.replace(/^(Апостол|Сщмч\.|Мч\.|Свт\.|Прп\.|Блж\.|Прав\.|Равноапп?\.|царь|княгиня|князь)\s+/g, '').replace(/^(царь|княгиня|князь)\s+/, '');
    return w.charAt(0);
  }
  function portrait(p, cls){
    var im = img(p), g = GROUP[p.g];
    var fb = '<span class="pp-mono" style="--cc:var(--c' + g.c + ')" aria-hidden="true">' + esc(initials(p)) + '</span>';
    if(!im) return '<span class="' + cls + '">' + fb + '</span>';
    return '<span class="' + cls + '">' + fb + '<img src="assets/people/' + p.id + '.jpg?v=1" data-src="' + esc(im[0]) + '" data-try="0" alt="' + esc(p.n) + '" loading="lazy" decoding="async" onerror="KB.imgRetry(this)"></span>';
  }
  /* Портреты хранятся на сайте (assets/people/<id>.jpg, уменьшенные копии с Викисклада).
     Если файла нет, один раз пробуем миниатюру Викисклада, затем оставляем буквицу. */
  KB.imgRetry = function(el){
    var t = +el.getAttribute('data-try');
    if(t >= 1){ el.remove(); return; }
    el.setAttribute('data-try', 1);
    el.referrerPolicy = 'no-referrer';
    el.src = el.getAttribute('data-src').replace('/500px-', '/330px-');
  };
  function workHref(w){
    var u = w[1];
    if(u.indexOf('az:') === 0) return {href:'https://azbyka.ru/otechnik/' + u.slice(3) + '/', src:'Азбука веры', ext:1};
    if(u.indexOf('w:') === 0) return {href:'https://ru.wikipedia.org/wiki/' + encodeURIComponent(u.slice(2)), src:'Википедия', ext:1};
    if(u.indexOf('b:') === 0) return {href:'#bible/' + encodeURIComponent(u.slice(2)), src:'Библия на сайте', ext:0};
    var host = u.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
    return {href:u, src:host === 'azbyka.ru' ? 'Азбука веры' : host, ext:1};
  }

  /* ---------- Сетка ---------- */
  var grid = document.getElementById('peopleGrid'), card = document.getElementById('personCard');
  var body = document.getElementById('personBody'), empty = document.getElementById('personEmpty');
  var pq = document.getElementById('pq'), pclr = document.getElementById('pclr'), chips = document.getElementById('peopleGroups');
  var group = 'all', q = '', sel = null, built = false;

  function renderChips(){
    var html = '<button class="pg-chip" type="button" data-pg="all" aria-pressed="' + (group === 'all') + '">Все <b>' + PEOPLE.length + '</b></button>';
    PEOPLE_GROUPS.forEach(function(g){
      var n = PEOPLE.filter(function(p){ return p.g === g.id; }).length;
      html += '<button class="pg-chip" type="button" data-pg="' + g.id + '" aria-pressed="' + (group === g.id) + '" style="--cc:var(--c' + g.c + ')">' + esc(g.t) + ' <b>' + n + '</b></button>';
    });
    chips.innerHTML = html;
  }
  function match(p){
    if(group !== 'all' && p.g !== group) return 0;
    if(!q) return 1;
    return p.n_.indexOf(q) !== -1 ? 2 : (p.b_.indexOf(q) !== -1 ? 1 : 0);
  }
  function renderGrid(){
    var html = '', total = 0;
    PEOPLE_GROUPS.forEach(function(g){
      var arr = PEOPLE.filter(function(p){ return p.g === g.id && match(p); });
      if(!arr.length) return;
      total += arr.length;
      html += '<section class="pg-sec"><h3 class="pg-h" style="--cc:var(--c' + g.c + ')">' + esc(g.t) + ' <span>' + arr.length + '</span></h3><div class="pg-grid">';
      arr.forEach(function(p){
        html += '<a class="pp' + (p.x ? ' is-x' : '') + '" href="#people/' + p.id + '" data-pid="' + p.id + '"' + (p.id === sel ? ' aria-current="true"' : '') + ' style="--cc:var(--c' + g.c + ')">' +
          portrait(p, 'pp-img') +
          '<span class="pp-n">' + (p.x ? '<span class="x-mark" title="Учение отвергнуто Церковью">⊘</span> ' : '') + esc(p.n) + '</span>' +
          '<span class="pp-y">' + esc(p.y) + '</span></a>';
      });
      html += '</div></section>';
    });
    grid.innerHTML = total ? html : '<p class="pg-empty">Никого не найдено. Попробуйте другое имя или слово — например, «икон», «Никея», «молитв».</p>';
    document.getElementById('peopleCount').textContent = total === PEOPLE.length ? '' : 'Найдено: ' + total;
  }

  /* ---------- Карточка ---------- */
  function renderCard(){
    if(!sel || !BY[sel]){ body.hidden = true; empty.hidden = false; card.classList.remove('open'); return; }
    var p = BY[sel], g = GROUP[p.g], im = img(p);
    var html = '<button class="tb-close" type="button" aria-label="Закрыть карточку">×</button>' +
      '<div class="pc-top">' + portrait(p, 'pc-img') +
        '<div class="pc-head"><div class="tb-path"><span class="dot" style="background:var(--c' + g.c + ')"></span>' + esc(g.t) + '</div>' +
        '<h2 class="tb-title">' + esc(p.n) + '</h2>' +
        '<p class="pc-r">' + esc(p.r) + '</p><p class="pc-y">' + esc(p.y) + '</p>' +
        (p.x ? '<div class="tb-x">⊘ Учение отвергнуто Церковью</div>' : '') + '</div></div>' +
      '<h3 class="tb-h">' + (p.x ? 'Жизнь и роль в истории Церкви' : 'Жизнь и значение для Церкви') + '</h3>' +
      '<div class="pc-bio">' + p.bio.map(function(t){ return '<p>' + KB.bibleReplace(esc(t)) + '</p>'; }).join('') + '</div>' +
      '<h3 class="tb-h">' + (p.x ? 'Что он утверждал — и что отвергла Церковь' : 'Главные мысли') + '</h3>' +
      '<ul class="pc-th' + (p.x ? ' is-x' : '') + '">' + p.th.map(function(t){ return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>';
    if(p.w.length){
      html += '<h3 class="tb-h">' + (p.w.some(function(w){ return w[1].indexOf('az:') === 0; }) ? 'Труды' : 'Где прочитать') + '</h3><ul class="pc-w">' + p.w.map(function(w){
        var h = workHref(w);
        return '<li><a href="' + esc(h.href) + '"' + (h.ext ? ' target="_blank" rel="noopener"' : '') + '>' + esc(w[0]) + '</a><span>' + esc(h.src) + (h.ext ? ' ↗' : '') + '</span></li>';
      }).join('') + '</ul>';
    }
    var site = '';
    if(p.terms.length) site += '<div class="chips">' + p.terms.map(function(n){
      var t = termByName[n];
      return '<a class="chip' + (t.x ? ' is-x' : '') + '" href="#terms/tree/t:' + encodeURIComponent(n) + '">' + esc(n) + '</a>';
    }).join('') + '</div>';
    if(p.events.length) site += '<ol class="pc-ev">' + p.events.map(function(i){
      var e = EVENTS[i];
      return '<li><a href="#chrono/e' + i + '"><span>' + esc(e[1]) + '</span>' + esc(e[4]) + '</a></li>';
    }).join('') + '</ol>';
    if(site) html += '<h3 class="tb-h">На сайте</h3>' + site;
    html += '<div class="tb-actions">' +
      (p.city && typeof CITIES !== 'undefined' && CITIES[p.city] ? '<a href="#map/' + p.city + '">На карте: ' + esc(CITIES[p.city][0]) + '</a>' : '') +
      (im ? '<a href="https://ru.wikipedia.org/wiki/' + encodeURIComponent(im[4]) + '" target="_blank" rel="noopener">Статья в Википедии ↗</a>' : '') +
      '<button type="button" data-pshare="' + p.id + '">Ссылка на персоналию</button></div>';
    if(im) html += '<p class="pc-credit">Изображение: <a href="https://commons.wikimedia.org/wiki/File:' + encodeURIComponent(im[1]) + '" target="_blank" rel="noopener">Викисклад</a>' +
      (im[3] ? ' · ' + esc(im[3]) : '') + ' · ' + esc(im[2] === 'Public domain' ? 'общественное достояние' : im[2]) + '</p>';
    body.innerHTML = html;
    if(KB.linkTerms){
      var ex = null; p.terms.forEach(function(n){ if(personByTerm[n] === p.id && ex == null) ex = T.indexOf(termByName[n]); });
      KB.linkTerms(body.querySelector('.pc-bio'), {exclude:ex, max:8});
    }
    body.hidden = false; empty.hidden = true;
    card.classList.add('open'); card.scrollTop = 0;
  }
  card.addEventListener('click', function(e){
    if(e.target.closest('.tb-close')){ card.classList.remove('open'); return; }
    var s = e.target.closest('[data-pshare]');
    if(s){ var p = BY[s.getAttribute('data-pshare')]; KB.shareLink('#people/' + p.id, p.n); }
  });
  function markSel(){
    grid.querySelectorAll('.pp').forEach(function(a){ if(a.getAttribute('data-pid') === sel) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
  }

  function build(){
    if(built) return; built = true;
    renderChips(); renderGrid();
    chips.addEventListener('click', function(e){
      var b = e.target.closest('[data-pg]'); if(!b) return;
      group = b.getAttribute('data-pg'); renderChips(); renderGrid();
    });
    var t;
    pq.addEventListener('input', function(){
      pclr.style.display = pq.value ? 'block' : 'none';
      clearTimeout(t); t = setTimeout(function(){ q = norm(pq.value.trim()); renderGrid(); }, 120);
    });
    pclr.addEventListener('click', function(){ pq.value = ''; q = ''; pclr.style.display = 'none'; renderGrid(); pq.focus(); });
  }

  KB.hooks.people = {
    activate: build,
    hash: function(){ return '#people' + (sel ? '/' + sel : ''); },
    route: function(rest){
      build();
      sel = BY[rest] ? rest : null;
      if(sel && group !== 'all' && BY[sel].g !== group){ group = 'all'; renderChips(); renderGrid(); }
      markSel(); renderCard();
      if(sel){
        var a = grid.querySelector('[data-pid="' + sel + '"]');
        if(a && window.innerWidth > 1100){
          var r = a.getBoundingClientRect();
          if(r.top < 90 || r.bottom > window.innerHeight) KB.scrollToEl(a, 24);
        }
      }
    }
  };

  var n = document.getElementById('tabPeopleN'); if(n) n.textContent = PEOPLE.length;
})();
