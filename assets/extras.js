/* ============================================================
   Дополнения: термины в тексте ответов, единый поиск по сайту,
   вкладки «Символ веры» и «Библия».
   Зависит от data/*.js, assets/app.js (KB.*) и assets/terms.js.
   ============================================================ */
(function(){
  "use strict";
  var T = (typeof TERMS_DATA !== 'undefined') ? TERMS_DATA.terms : [];
  var norm = KB.norm, plural = KB.plural;
  function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function strip(s){ return String(s).replace(/<[^>]+>/g,' ').replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, function(m,a,b){ return b || a; }).replace(/\s+/g,' ').trim(); }
  function goHash(h){ if(location.hash === h){ KB.route(); } else { location.hash = h; } }
  var byName = {};
  T.forEach(function(t, i){ byName[t.t] = i; });

  /* ============================================================
     1. Термины в тексте
     ============================================================ */
  var STOP = ['Бог','Вера','Любовь','Надежда','Церковь','Грех','Душа','Тело','Сердце','Отец','Пост','Молитва','Храм','Крест',
    'Смерть','Зло','Чудо','Святые','Пророк','Апостолы','Неделя','Аминь','Подвиг','Плач','Икона','Брак','Евангелие','Завет',
    'Библия','Рай','Помысл','Мощи','Добродетель','Заповедь','Христос','Иисус','Господь','Мессия','Сущность','Лицо','Святость',
    'Благочестие','Терпение','Кротость','Совесть','Милостыня','Послушание','Смирение','Гордость','Гнев','Печаль','Уныние',
    'Святыня','Канон (правило)','Страх Божий','Знамение','Пророчество','Притча','Пятидесятница','Пасха','Тропарь','Глас'];
  var stop = {}; STOP.forEach(function(s){ stop[s] = 1; });
  var END = '(?:ами|ями|ого|его|ому|ему|ыми|ими|ой|ей|ою|ею|ом|ем|ам|ям|ах|ях|ов|ев|ью|ия|ие|ии|ию|ий|ым|им|ых|их|ую|юю|ая|яя|ое|ее|ые|а|я|о|е|ы|и|у|ю|ь|й)?';
  function wordPat(w){
    w = w.toLowerCase().replace(/ё/g,'е');
    var e = function(x){ return x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/е/g, '[её]'); };
    if(/^[ivx]+$/.test(w) || w.length < 4) return e(w);
    var stem;
    if(/(ый|ой|ая|ое|ые|ого|ому)$/.test(w)) stem = w.replace(/(ый|ой|ая|ое|ые|ого|ому)$/, '');
    else if(/[аяоеыиуюьй]$/.test(w)) stem = w.slice(0, -1);
    else stem = w;
    return e(stem) + END;
  }
  var SKIP = {'Власти':1,'Начала':1,'Силы':1,'Господства':1,'Престолы':1,'Служение (латрия)':1,'Праведные':1,'Апостол (книга)':1,'Пророки (лик)':1,'Агнец (литургический)':1,'Собор (церковный)':1,'Непорочное зачатие (латинский догмат)':1,'Мантия (малая схима)':1,'Троица ветхозаветная (икона)':1};
  var cands = [];
  var baseCount = {};
  T.forEach(function(t){ var b = t.t.replace(/\s*\(.*?\)\s*$/, ''); baseCount[b] = (baseCount[b] || 0) + 1; });
  T.forEach(function(t, i){
    if(stop[t.t] || SKIP[t.t]) return;
    var base = t.t.replace(/\s*\(.*?\)\s*$/, '');
    if(baseCount[base] > 1 || stop[base] || base.length < 5) return;
    if(/[^а-яА-ЯёЁ\s\-IVX.]/.test(base)) return;
    var pat = base.split(/\s+/).map(wordPat).join('\\s+');
    cands.push({i:i, len:base.length, pat:pat, re:new RegExp('^(?:' + pat + ')$', 'i')});
  });
  cands.sort(function(a, b){ return b.len - a.len; });
  var BIG = cands.length ? new RegExp('(^|[^а-яёa-z])(' + cands.map(function(c){ return c.pat; }).join('|') + ')(?![а-яёa-z])', 'gi') : null;

  KB.linkTerms = function(root, opts){
    if(!root || !BIG) return;
    opts = opts || {};
    var used = {}, count = 0, max = opts.max || 14;
    if(opts.exclude != null) used[opts.exclude] = 1;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function(n){
        var p = n.parentNode;
        while(p && p !== root){ if(/^(A|MARK|BUTTON|H1|H2|H3|H4|DT)$/.test(p.tagName) || (p.classList && (p.classList.contains('term-link') || p.classList.contains('src')))) return NodeFilter.FILTER_REJECT; p = p.parentNode; }
        return n.nodeValue.trim().length > 3 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    var nodes = []; while(walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function(node){
      if(count >= max) return;
      var text = node.nodeValue, out = [], last = 0, m;
      BIG.lastIndex = 0;
      while((m = BIG.exec(text)) && count < max){
        var word = m[2], start = m.index + m[1].length, hit = null;
        for(var k = 0; k < cands.length; k++){ if(cands[k].re.test(word)){ hit = cands[k]; break; } }
        if(!hit || used[hit.i]) continue;
        used[hit.i] = 1; count++;
        out.push(document.createTextNode(text.slice(last, start)));
        var span = document.createElement('span');
        span.className = 'term-link' + (T[hit.i].x ? ' is-x' : '');
        span.setAttribute('data-ti', hit.i); span.setAttribute('tabindex', '0'); span.setAttribute('role', 'button');
        span.textContent = word;
        out.push(span);
        last = start + word.length;
      }
      if(out.length){
        out.push(document.createTextNode(text.slice(last)));
        var frag = document.createDocumentFragment(); out.forEach(function(x){ frag.appendChild(x); });
        node.parentNode.replaceChild(frag, node);
      }
    });
  };

  /* ---- Всплывающая карточка термина ---- */
  var pop = document.getElementById('tpop'), popFor = null, hoverT, hideT;
  function firstSentences(s, n){
    var parts = strip(s).match(/[^.!?]+[.!?»)]*(\s|$)/g) || [strip(s)];
    var r = parts.slice(0, n).join('').trim();
    return r.length > 360 ? r.slice(0, 358).replace(/\s\S*$/, '') + '…' : r;
  }
  function showPop(el){
    var i = +el.getAttribute('data-ti'), t = T[i];
    if(!t) return;
    popFor = el;
    pop.innerHTML = '<div class="tp-name">' + (t.x ? '<span class="x-mark">⊘</span> ' : '') + esc(t.t) + '</div>' +
      (t.g ? '<div class="tp-g">' + esc(t.g) + '</div>' : '') +
      (t.x ? '<div class="tp-x">Учение, отвергнутое Церковью</div>' : '') +
      '<p class="tp-d">' + esc(firstSentences(t.d, 2)) + '</p>' +
      '<button type="button" class="tp-go" data-go="' + i + '">Подробнее в дереве терминов</button>';
    pop.hidden = false;
    var r = el.getBoundingClientRect(), pw = Math.min(340, window.innerWidth - 24);
    pop.style.width = pw + 'px';
    var x = Math.min(Math.max(12, r.left + r.width / 2 - pw / 2), window.innerWidth - pw - 12);
    var ph = pop.offsetHeight, y = r.bottom + 8;
    if(y + ph > window.innerHeight - 8 && r.top - ph - 8 > 8) y = r.top - ph - 8;
    pop.style.left = x + 'px'; pop.style.top = (y + window.scrollY) + 'px';
  }
  function hidePop(){ pop.hidden = true; popFor = null; }
  document.addEventListener('mouseover', function(e){
    var el = e.target.closest && e.target.closest('.term-link');
    if(el && window.matchMedia('(hover:hover)').matches){
      clearTimeout(hideT); clearTimeout(hoverT);
      hoverT = setTimeout(function(){ showPop(el); }, 260);
    }
  });
  document.addEventListener('mouseout', function(e){
    var el = e.target.closest && (e.target.closest('.term-link') || e.target.closest('#tpop'));
    if(el){ clearTimeout(hoverT); hideT = setTimeout(function(){ if(!pop.matches(':hover')) hidePop(); }, 280); }
  });
  pop.addEventListener('mouseenter', function(){ clearTimeout(hideT); });
  document.addEventListener('click', function(e){
    var go = e.target.closest('.tp-go');
    if(go){ hidePop(); goHash('#terms/tree/t:' + encodeURIComponent(T[+go.getAttribute('data-go')].t)); return; }
    var el = e.target.closest('.term-link');
    if(el){
      e.preventDefault();
      if(el.closest('#termCard')){ hidePop(); return; }
      if(popFor === el && !pop.hidden) hidePop(); else showPop(el);
      return;
    }
    if(!e.target.closest('#tpop')) hidePop();
  });
  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape') hidePop();
    if(e.key === 'Enter' && document.activeElement && document.activeElement.classList.contains('term-link')) showPop(document.activeElement);
  });
  window.addEventListener('scroll', function(){ if(!pop.hidden && popFor && !popFor.closest('#termCard')) hidePop(); }, {passive:true});

  /* ============================================================
     2. Вкладка «Символ веры»
     ============================================================ */
  var creedLang = 'slav';
  try { creedLang = localStorage.getItem('kb-creed-lang') || 'slav'; } catch(e){}
  var creedList = document.getElementById('creedList'), creedMain = document.getElementById('creedMain');
  var creedCur = 0;
  function qaBySlugText(q){ for(var i = 0; i < KB.qaIndex.length; i++){ if(KB.qaIndex[i].q === q) return KB.qaIndex[i]; } return null; }
  function termChip(name){
    var i = byName[name]; if(i == null) return '';
    var t = T[i];
    return '<a class="chip' + (t.x ? ' is-x' : '') + '" href="#terms/tree/t:' + encodeURIComponent(t.t) + '">' + esc(t.t) + '</a>';
  }
  function renderCreedList(){
    var lang = creedLang;
    creedList.innerHTML = '<li><a href="#creed" data-n="0"' + (creedCur === 0 ? ' aria-current="true"' : '') + '><span class="cn">✦</span><span class="ct">Весь Символ веры</span></a></li>' +
      CREED.map(function(a){
        var words = a[lang].split(' ').slice(0, 5).join(' ').replace(/[,;:.]$/, '');
        return '<li><a href="#creed/' + a.n + '" data-n="' + a.n + '"' + (creedCur === a.n ? ' aria-current="true"' : '') + '><span class="cn">' + a.n + '</span><span class="ct">' + esc(words) + '…<small>' + esc(a.theme) + '</small></span></a></li>';
      }).join('');
  }
  function renderCreedAll(){
    var lang = creedLang;
    creedMain.innerHTML =
      '<header class="cr-head"><h2>Никео-Цареградский Символ веры</h2>' +
      '<p class="cr-sub">Члены 1–7 составлены на I Вселенском Соборе в Никее (325), члены 8–12 — на II Вселенском Соборе в Константинополе (381). Символ читается при Крещении и за каждой Божественной литургией. Щёлкните по члену, чтобы открыть толкование.</p></header>' +
      '<ol class="cr-full ' + lang + '">' + CREED.map(function(a){
        return '<li><a href="#creed/' + a.n + '"><span class="cn">' + a.n + '</span><span>' + esc(a[lang]) + '</span></a></li>';
      }).join('') + '</ol>';
  }
  function renderCreedArticle(n){
    var a = CREED[n - 1]; if(!a) return renderCreedAll();
    var lang = creedLang, other = lang === 'slav' ? 'rus' : 'slav';
    var qas = a.qa.map(qaBySlugText).filter(Boolean);
    var html =
      '<header class="cr-head"><div class="cr-num">Член ' + a.n + '</div>' +
      '<blockquote class="cr-text ' + lang + '">' + esc(a[lang]) + '</blockquote>' +
      '<p class="cr-alt">' + esc(a[other]) + '</p>' +
      '<p class="cr-meta">' + esc(a.theme) + '. ' + esc(a.council) + '.</p></header>' +
      '<section class="cr-sec"><h3>Толкование</h3><div class="cr-body">' + a.body.map(function(p){ return '<p>' + KB.bibleReplace(p) + '</p>'; }).join('') + '</div>' +
      '<p class="cr-src">По Пространному христианскому катихизису свт. Филарета (Дроздова).</p></section>' +
      '<section class="cr-sec"><h3>Разбор слов</h3><dl class="cr-words">' + a.words.map(function(w){ return '<dt>' + esc(w[0]) + '</dt><dd>' + KB.bibleReplace(w[1]) + '</dd>'; }).join('') + '</dl></section>' +
      (a.against.length ? '<section class="cr-sec"><h3>От каких заблуждений ограждает</h3><div class="chips">' + a.against.map(termChip).join('') + '</div></section>' : '') +
      '<section class="cr-sec"><h3>Термины</h3><div class="chips">' + a.terms.map(termChip).join('') + '</div></section>' +
      (qas.length ? '<section class="cr-sec"><h3>Вопросы по теме</h3><ul class="cr-qa">' + qas.map(function(x){ return '<li><a href="#q/' + x.slug + '">' + esc(x.q) + '</a><span>' + esc(x.secTitle) + '</span></li>'; }).join('') + '</ul></section>' : '') +
      '<nav class="cr-pager">' +
        (a.n > 1 ? '<a href="#creed/' + (a.n - 1) + '">‹ Член ' + (a.n - 1) + '</a>' : '<a href="#creed">‹ Весь Символ веры</a>') +
        (a.n < 12 ? '<a href="#creed/' + (a.n + 1) + '">Член ' + (a.n + 1) + ' ›</a>' : '<span></span>') +
      '</nav>';
    creedMain.innerHTML = html;
    KB.linkTerms(creedMain.querySelector('.cr-body'));
  }
  function renderCreed(){
    renderCreedList();
    var cur = creedList.querySelector('[aria-current="true"]');
    if(cur && creedList.scrollWidth > creedList.clientWidth) creedList.scrollLeft = cur.parentNode.offsetLeft - 16;
    if(creedCur === 0) renderCreedAll(); else renderCreedArticle(creedCur);
  }
  document.querySelectorAll('.creed-mode button').forEach(function(b){
    b.setAttribute('aria-checked', b.dataset.lang === creedLang ? 'true' : 'false');
    b.addEventListener('click', function(){
      creedLang = b.dataset.lang;
      try { localStorage.setItem('kb-creed-lang', creedLang); } catch(e){}
      document.querySelectorAll('.creed-mode button').forEach(function(x){ x.setAttribute('aria-checked', x === b ? 'true' : 'false'); });
      renderCreed();
    });
  });
  var creedBuilt = false;
  KB.hooks.creed = {
    activate: function(){ if(!creedBuilt){ creedBuilt = true; renderCreed(); } },
    hash: function(){ return creedCur ? '#creed/' + creedCur : '#creed'; },
    route: function(rest){
      var n = parseInt(rest, 10) || 0;
      creedCur = (n >= 1 && n <= 12) ? n : 0;
      creedBuilt = true; renderCreed();
      if(creedCur) window.scrollTo({top:0});
    }
  };

  /* ============================================================
     3. Вкладка «Библия»
     ============================================================ */
  var bibleContent = document.getElementById('bibleContent'), bibleIntro = document.getElementById('bibleIntro');
  var bq = document.getElementById('bq'), bclr = document.getElementById('bclr');
  var bFilter = 'all', bibleBuilt = false;
  var ALLBOOKS = [];
  BIBLE_GROUPS.forEach(function(g){ (BIBLE[g.id] || []).forEach(function(b){ ALLBOOKS.push({g:g, abbr:b[0], name:b[1], canon:b[2], ch:b[3], author:b[4], time:b[5], about:b[6], keys:b[7]}); }); });
  document.getElementById('tabBibleN').textContent = ALLBOOKS.length;
  function wsUrl(abbr){ var t = BOOKS[abbr]; return t ? 'https://ru.wikisource.org/wiki/' + encodeURI(t.replace(/ /g, '_')) : null; }
  function bookId(abbr){ return 'b-' + abbr.replace(/\s+/g, ''); }
  function renderBible(){
    var vz = ALLBOOKS.filter(function(b){ return b.g.t === 'Ветхий Завет'; });
    var vzc = vz.filter(function(b){ return b.canon; }).length;
    bibleIntro.innerHTML = '<h2>Путеводитель по книгам Священного Писания</h2>' +
      '<p>' + ALLBOOKS.length + ' книг: в Ветхом Завете ' + vz.length + ' (' + vzc + ' канонических и ' + (vz.length - vzc) + ' неканонических), в Новом — ' + (ALLBOOKS.length - vz.length) + '. Разряды — по Пространному катихизису свт. Филарета. Неканонические книги Церковь предлагает для чтения как полезные и назидательные; они отмечены особо. Автор и время указаны по церковному преданию. Ссылки ведут на синодальный перевод в «Викитеке».</p>';
    var html = '';
    BIBLE_GROUPS.forEach(function(g){
      var books = BIBLE[g.id] || [];
      html += '<section class="bg" data-testament="' + (g.t === 'Ветхий Завет' ? 'vz' : 'nz') + '"><header class="bg-head"><div class="bg-t">' + esc(g.t) + '</div><h3>' + esc(g.g) + ' <span class="bg-n">' + books.length + '</span></h3><p>' + esc(g.d) + '</p></header><div class="bg-list">';
      books.forEach(function(b){
        var keys = b[7].split(';').map(function(k){ var p = k.split('|'); return '<li>' + KB.bibleReplace('[[' + p[0] + ']]') + ' — ' + esc(p[1]) + '</li>'; }).join('');
        var url = wsUrl(b[0]);
        html += '<details class="bk' + (b[2] ? '' : ' noncanon') + '" id="' + bookId(b[0]) + '" data-search="' + esc(norm(b[0] + ' ' + b[1] + ' ' + b[4] + ' ' + b[6])) + '">' +
          '<summary><span class="bk-abbr">' + esc(b[0]) + '</span><span class="bk-name">' + esc(b[1]) + '</span>' +
          (b[2] ? '' : '<span class="bk-tag">неканоническая</span>') +
          '<span class="bk-ch">' + b[3] + ' ' + plural(b[3], 'глава', 'главы', 'глав') + '</span></summary>' +
          '<div class="bk-body"><dl class="bk-meta"><dt>Автор</dt><dd>' + esc(b[4]) + '</dd><dt>Время</dt><dd>' + esc(b[5]) + '</dd></dl>' +
          '<p class="bk-about">' + esc(b[6]) + '</p>' +
          '<h4>Ключевые места</h4><ul class="bk-keys">' + keys + '</ul>' +
          '<div class="bk-actions">' + (url ? '<a href="' + url + '" target="_blank" rel="noopener">Читать книгу в «Викитеке»</a>' : '') +
          '<button type="button" class="share" data-bshare="' + esc(b[0]) + '">Ссылка на книгу</button></div></div></details>';
      });
      html += '</div></section>';
    });
    bibleContent.innerHTML = html;
    bibleContent.querySelectorAll('.bk-about').forEach(function(p){ KB.linkTerms(p, {max:6}); });
    applyBibleFilter();
  }
  function applyBibleFilter(){
    var q = norm(bq.value.trim());
    bibleContent.querySelectorAll('.bg').forEach(function(sec){
      var okT = bFilter === 'all' || sec.getAttribute('data-testament') === bFilter, any = false;
      sec.querySelectorAll('.bk').forEach(function(d){
        var ok = okT && (!q || d.getAttribute('data-search').indexOf(q) !== -1);
        d.hidden = !ok; if(ok) any = true;
      });
      sec.hidden = !any;
    });
  }
  bq.addEventListener('input', function(){ bclr.style.display = bq.value ? 'block' : 'none'; applyBibleFilter(); });
  bclr.addEventListener('click', function(){ bq.value = ''; bclr.style.display = 'none'; applyBibleFilter(); bq.focus(); });
  document.querySelectorAll('[data-bf]').forEach(function(b){
    b.addEventListener('click', function(){
      bFilter = b.getAttribute('data-bf');
      document.querySelectorAll('[data-bf]').forEach(function(x){ x.setAttribute('aria-checked', x === b ? 'true' : 'false'); });
      applyBibleFilter();
    });
  });
  bibleContent.addEventListener('click', function(e){
    var s = e.target.closest('[data-bshare]');
    if(s){ KB.shareLink('#bible/' + encodeURIComponent(s.getAttribute('data-bshare')), s.closest('.bk').querySelector('.bk-name').textContent); }
  });
  KB.hooks.bible = {
    activate: function(){ if(!bibleBuilt){ bibleBuilt = true; renderBible(); } },
    hash: function(){ return '#bible'; },
    route: function(rest){
      if(!bibleBuilt){ bibleBuilt = true; renderBible(); }
      var abbr = decodeURIComponent(rest || '');
      if(!abbr) return;
      bq.value = ''; bclr.style.display = 'none'; bFilter = 'all';
      document.querySelectorAll('[data-bf]').forEach(function(x){ x.setAttribute('aria-checked', x.getAttribute('data-bf') === 'all' ? 'true' : 'false'); });
      applyBibleFilter();
      var d = document.getElementById(bookId(abbr));
      if(d){ d.open = true; setTimeout(function(){ KB.scrollToEl(d); }, 30); d.classList.add('flash'); setTimeout(function(){ d.classList.remove('flash'); }, 1600); }
    }
  };

  /* ============================================================
     4. Единый поиск по сайту
     ============================================================ */
  var gq = document.getElementById('gq'), gres = document.getElementById('gres');
  var IDX = [];
  KB.qaIndex.forEach(function(x){ IDX.push({k:'q', title:x.q, sub:x.secTitle, body:strip(x.a), go:'#q/' + x.slug}); });
  T.forEach(function(t){ IDX.push({k:'t', title:t.t, sub:t.g || '', body:strip(t.d + ' ' + (t.r || []).map(function(p){ return p[1]; }).join(' ')), go:'#terms/tree/t:' + encodeURIComponent(t.t), x:t.x}); });
  CREED.forEach(function(a){ IDX.push({k:'c', title:'Член ' + a.n + ': ' + a.theme, sub:a.slav, body:a.rus + ' ' + strip(a.body.join(' ')), go:'#creed/' + a.n}); });
  ALLBOOKS.forEach(function(b){ IDX.push({k:'b', title:b.name, sub:b.g.g, body:b.author + ' ' + b.about, go:'#bible/' + encodeURIComponent(b.abbr), abbr:b.abbr}); });
  if(typeof EVENTS !== 'undefined') EVENTS.forEach(function(e, i){ IDX.push({k:'e', title:e[4], sub:e[1] + ' · ' + CITIES[e[2]][0], body:e[5], go:'#chrono/e' + i}); });
  IDX.forEach(function(x){ x.nt = norm(x.title); x.nb = norm(x.body); x.ns = norm(x.sub); });
  var GROUPS = {q:'Вопросы и ответы', t:'Термины', e:'События', c:'Символ веры', b:'Книги Библии'};
  var LIMIT = {q:6, t:6, e:4, c:3, b:4};
  var active = -1, flat = [];

  function score(x, q, words){
    var s = 0;
    if(x.nt === q) s += 200;
    if(x.nt.indexOf(q) === 0) s += 120;
    else if(x.nt.indexOf(' ' + q) !== -1) s += 90;
    else if(x.nt.indexOf(q) !== -1) s += 70;
    if(x.abbr && norm(x.abbr) === q) s += 150;
    if(x.ns.indexOf(q) !== -1) s += 25;
    if(x.nb.indexOf(q) !== -1) s += 15;
    if(!s && words.length > 1){
      var all = words.every(function(w){ return x.nt.indexOf(w) !== -1 || x.nb.indexOf(w) !== -1; });
      if(all) s += 10 + words.filter(function(w){ return x.nt.indexOf(w) !== -1; }).length * 10;
    }
    return s;
  }
  function snippet(x, q){
    var i = x.nb.indexOf(q); if(i < 0 || x.nt.indexOf(q) !== -1) return '';
    var from = Math.max(0, i - 40), to = Math.min(x.body.length, i + q.length + 70);
    var s = (from ? '…' : '') + esc(x.body.slice(from, i)) + '<mark>' + esc(x.body.slice(i, i + q.length)) + '</mark>' + esc(x.body.slice(i + q.length, to)) + (to < x.body.length ? '…' : '');
    return '<span class="gr-snip">' + s + '</span>';
  }
  function hl(text, q){
    var i = norm(text).indexOf(q); if(i < 0) return esc(text);
    return esc(text.slice(0, i)) + '<mark>' + esc(text.slice(i, i + q.length)) + '</mark>' + esc(text.slice(i + q.length));
  }
  function runG(){
    var q = norm(gq.value.trim());
    if(q.length < 2){ closeG(); return; }
    var words = q.split(/\s+/).filter(function(w){ return w.length > 1; });
    var res = {q:[], t:[], e:[], c:[], b:[]};
    IDX.forEach(function(x){ var s = score(x, q, words); if(s) res[x.k].push({x:x, s:s}); });
    flat = []; var html = '', total = 0;
    ['t','q','e','c','b'].forEach(function(k){
      var arr = res[k].sort(function(a, b){ return b.s - a.s; });
      total += arr.length;
      if(!arr.length) return;
      html += '<div class="gr-group"><div class="gr-h">' + GROUPS[k] + ' <span>' + arr.length + '</span></div>';
      arr.slice(0, LIMIT[k]).forEach(function(r){
        var idx = flat.length; flat.push(r.x.go);
        html += '<a class="gr-item" role="option" id="gr-' + idx + '" href="' + r.x.go + '" data-i="' + idx + '">' +
          '<span class="gr-t">' + (r.x.x ? '<span class="x-mark">⊘</span> ' : '') + hl(r.x.title, q) + '</span>' +
          (r.x.sub && k !== 'c' ? '<span class="gr-sub">' + esc(r.x.sub) + '</span>' : '') + snippet(r.x, q) + '</a>';
      });
      if(k === 'q' && arr.length > LIMIT.q){
        var idx2 = flat.length; flat.push('filter-qa');
        html += '<a class="gr-item gr-more" role="option" id="gr-' + idx2 + '" href="#" data-i="' + idx2 + '" data-filter="1">Показать все вопросы с «' + esc(gq.value.trim()) + '» (' + arr.length + ')</a>';
      }
      html += '</div>';
    });
    if(!total) html = '<div class="gr-empty">Ничего не найдено. Попробуйте другую форму слова — например, «крещ» вместо «крещением».</div>';
    gres.innerHTML = html; gres.hidden = false; gq.setAttribute('aria-expanded', 'true');
    active = -1;
  }
  function closeG(){ gres.hidden = true; gq.setAttribute('aria-expanded', 'false'); active = -1; }
  function setActive(i){
    var items = gres.querySelectorAll('.gr-item');
    if(!items.length) return;
    active = (i + items.length) % items.length;
    items.forEach(function(el, k){ el.classList.toggle('on', k === active); });
    items[active].scrollIntoView({block:'nearest'});
    gq.setAttribute('aria-activedescendant', items[active].id);
  }
  function pick(i){
    var target = flat[i]; if(!target) return;
    closeG(); gq.blur();
    if(target === 'filter-qa'){ KB.filterQa(gq.value.trim()); history.pushState(null, '', location.pathname + location.search); window.scrollTo({top:0}); return; }
    goHash(target);
  }
  var gt;
  gq.addEventListener('input', function(){ clearTimeout(gt); gt = setTimeout(runG, 90); });
  gq.addEventListener('focus', function(){ if(gq.value.trim().length >= 2) runG(); });
  gq.addEventListener('keydown', function(e){
    if(e.key === 'ArrowDown'){ e.preventDefault(); if(gres.hidden) runG(); setActive(active + 1); }
    else if(e.key === 'ArrowUp'){ e.preventDefault(); setActive(active - 1); }
    else if(e.key === 'Enter'){ e.preventDefault(); if(gres.hidden) runG(); pick(active >= 0 ? active : 0); }
    else if(e.key === 'Escape'){ closeG(); gq.blur(); }
  });
  gres.addEventListener('mousedown', function(e){ e.preventDefault(); });
  gres.addEventListener('click', function(e){
    var a = e.target.closest('.gr-item'); if(!a) return;
    e.preventDefault(); pick(+a.getAttribute('data-i'));
  });
  document.addEventListener('click', function(e){ if(!e.target.closest('.gsearch')) closeG(); });
  document.addEventListener('keydown', function(e){
    if(e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)){ e.preventDefault(); gq.focus(); gq.select(); }
  });
})();
