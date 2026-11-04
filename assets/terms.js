/* ============================================================
   Дерево терминов — шесть видов одного словаря:
   раскрывающееся дерево, схема, круг, граф связей, карта, А–Я.
   Зависит от data/terms.js (TERMS_DATA), assets/vendor/d3.min.js
   и assets/app.js (KB.bibleReplace, KB.norm, KB.plural, KB.showTab).
   ============================================================ */
(function(){
  "use strict";
  if(typeof TERMS_DATA === 'undefined') return;

  var D = TERMS_DATA, T = D.terms;
  var norm = KB.norm, plural = KB.plural;
  var hasD3 = typeof d3 !== 'undefined';

  /* ---------- Справочники ---------- */
  var branchById = {}, partByBranch = {}, partById = {};
  D.branches.forEach(function(b){ branchById[b.id] = b; });
  D.parts.forEach(function(p){
    partById[p.id] = p;
    p.branches.forEach(function(bid){ partByBranch[bid] = p; });
  });
  var byName = {};
  T.forEach(function(t, i){ t.i = i; t.p = partByBranch[t.b].id; byName[norm(t.t)] = i; });

  // связи — неориентированные: rel + обратные ссылки
  var nb = T.map(function(){ return new Set(); });
  T.forEach(function(t, i){ t.rel.forEach(function(j){ nb[i].add(j); nb[j].add(i); }); });
  T.forEach(function(t, i){ t.deg = nb[i].size; });

  function col(pid){ return 'var(--c' + partById[pid].c + ')'; }
  function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function stripRefs(s){ return s.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, function(m,a,b){ return b || a; }); }

  /* ---------- Состояние ---------- */
  var state = { view:'tree', sel:null, q:'', hidden:new Set() };
  var VIEWS = ['tree','scheme','sun','graph','map','abc'];
  var HINTS = {
    tree:'Раскрывайте части, ветви и подгруппы. Поиск сверху отбирает термины по названию и определению.',
    scheme:'Щёлкните по ветви или подгруппе, чтобы раскрыть её. Колесо мыши или щипок — масштаб, перетаскивание — сдвиг.',
    sun:'Щёлкните по сектору, чтобы приблизить его; щелчок по центру — шаг назад. Внешнее кольцо — отдельные термины.',
    graph:'Линии — перекрёстные связи между понятиями. Выберите термин, чтобы увидеть его окружение; надписи появляются при приближении.',
    map:'Площадь пропорциональна числу терминов. Щёлкните по ветви, чтобы раскрыть её подробно.',
    abc:'Все термины по алфавиту.'
  };
  var visible = function(t){ return !state.hidden.has(t.p); };
  function matches(t){
    if(!state.q) return true;
    return norm(t.t).indexOf(state.q) !== -1 || norm(t.g).indexOf(state.q) !== -1 || norm(t.d).indexOf(state.q) !== -1;
  }

  /* ---------- Иерархия для d3 ---------- */
  function hierarchyData(withGroups){
    return {
      name:'Православное богословие', kind:'root',
      children: D.parts.filter(function(p){ return !state.hidden.has(p.id); }).map(function(p){
        return { name:p.title, kind:'part', pid:p.id, children: p.branches.map(function(bid){
          var b = branchById[bid];
          var leaves = function(items){ return items.map(function(it){
            var ref = typeof it === 'object'; var i = ref ? it.ref : it;
            return { name:T[i].t, kind:'term', ti:i, ref:ref, pid:p.id };
          }); };
          if(!withGroups){
            var all = [];
            b.groups.forEach(function(g){ all = all.concat(leaves(g.items)); });
            return { name:b.title, kind:'branch', bid:bid, pid:p.id, children:all };
          }
          return { name:b.title, kind:'branch', bid:bid, pid:p.id, children: b.groups.map(function(g){
            return { name:g.name, kind:'group', bid:bid, pid:p.id, children: leaves(g.items) };
          })};
        })};
      })
    };
  }

  /* ---------- Подсказка ---------- */
  var tip = document.createElement('div'); tip.className = 'tip'; tip.hidden = true;
  function showTip(e, html, host){
    if(tip.parentNode !== host) host.appendChild(tip);
    tip.innerHTML = html; tip.hidden = false;
    var r = host.getBoundingClientRect();
    var x = e.clientX - r.left + 14, y = e.clientY - r.top + 14;
    var w = tip.offsetWidth, h = tip.offsetHeight;
    if(x + w > r.width - 6) x = e.clientX - r.left - w - 14;
    if(y + h > r.height - 6) y = e.clientY - r.top - h - 14;
    tip.style.left = Math.max(4,x) + 'px'; tip.style.top = Math.max(4,y) + 'px';
  }
  function hideTip(){ tip.hidden = true; }
  function termTip(i){
    var t = T[i];
    var d = stripRefs(t.d); if(d.length > 150) d = d.slice(0,148).replace(/\s\S*$/,'') + '…';
    return '<b>' + (t.x ? '⊘ ' : '') + esc(t.t) + '</b>' + esc(d);
  }

  /* ---------- Легенда (фильтр частей) ---------- */
  var legend = document.getElementById('legend');
  D.parts.forEach(function(p){
    var n = 0; p.branches.forEach(function(bid){ T.forEach(function(t){ if(t.b === bid) n++; }); });
    var b = document.createElement('button');
    b.type = 'button'; b.setAttribute('aria-pressed','true'); b.dataset.pid = p.id;
    b.title = 'Показать или скрыть часть «' + p.title + '»';
    b.innerHTML = '<span class="sw" style="background:'+col(p.id)+'"></span>' + esc(p.title) + ' <span class="ln">' + n + '</span>';
    b.addEventListener('click', function(e){
      if(e.altKey || e.metaKey || e.shiftKey){ // показать только эту часть
        state.hidden = new Set(D.parts.map(function(x){ return x.id; }).filter(function(x){ return x !== p.id; }));
      } else if(state.hidden.has(p.id)) state.hidden.delete(p.id);
      else if(state.hidden.size < D.parts.length - 1) state.hidden.add(p.id);
      legend.querySelectorAll('button').forEach(function(x){ x.setAttribute('aria-pressed', state.hidden.has(x.dataset.pid) ? 'false' : 'true'); });
      Object.keys(views).forEach(function(k){ views[k].dirty = true; });
      renderView();
    });
    legend.appendChild(b);
  });

  /* ---------- Карточка термина ---------- */
  var card = document.getElementById('termCard');
  var cardBody = document.getElementById('termBody');
  var cardEmpty = document.getElementById('termEmpty');

  function chip(i){
    var t = T[i];
    return '<button type="button" class="chip' + (t.x ? ' is-x' : '') + '" data-ti="'+i+'" style="--cc:'+col(t.p)+'">' + esc(t.t) + '</button>';
  }
  function renderCard(){
    var i = state.sel;
    if(i == null){ cardBody.hidden = true; cardEmpty.hidden = false; card.classList.remove('open'); return; }
    var t = T[i], b = branchById[t.b], p = partById[t.p];
    var rel = Array.from(nb[i]).sort(function(a,c){ return T[a].t.localeCompare(T[c].t,'ru'); });
    var sib = [];
    b.groups.forEach(function(g){ if(g.name === t.grp) g.items.forEach(function(it){ var j = typeof it === 'object' ? it.ref : it; if(j !== i && !nb[i].has(j)) sib.push(j); }); });
    var qaSec = null;
    if(typeof DATA !== 'undefined') DATA.forEach(function(s){ if(s.id === b.qa) qaSec = s; });

    var html =
      '<button class="tb-close" type="button" aria-label="Закрыть карточку">×</button>' +
      '<div class="tb-path"><span class="dot" style="background:'+col(p.id)+'"></span>' + esc(p.title) +
        '<span class="sep">›</span><button type="button" data-goto-branch="'+b.id+'">' + esc(b.title) + '</button>' +
        '<span class="sep">›</span>' + esc(t.grp) + '</div>' +
      '<h2 class="tb-title">' + esc(t.t) + '</h2>' +
      (t.g ? '<p class="tb-greek">' + esc(t.g) + '</p>' : '') +
      (t.x ? '<div class="tb-x">⊘ Учение, отвергнутое Церковью</div>' : '') +
      '<p class="tb-def">' + KB.bibleReplace(esc(t.d)) + '</p>' +
      (t.r ? '<section class="tb-ref"><h3 class="tb-h">Опровержение</h3>' + t.r.map(function(p){
        return '<h4>' + esc(p[0]) + '</h4><p>' + KB.bibleReplace(esc(p[1])) + '</p>';
      }).join('') + '</section>' : '') +
      (rel.length ? '<h3 class="tb-h">Связанные понятия</h3><div class="chips">' + rel.map(chip).join('') + '</div>' : '') +
      (sib.length ? '<h3 class="tb-h">В той же подгруппе</h3><div class="chips">' + sib.map(chip).join('') + '</div>' : '') +
      '<div class="tb-actions">' +
        (state.view !== 'tree' ? '<button type="button" data-act="tree">Показать в дереве</button>' : '') +
        (state.view !== 'graph' && rel.length ? '<button type="button" data-act="graph">Показать на графе</button>' : '') +
        (state.view !== 'scheme' ? '<button type="button" data-act="scheme">Показать на схеме</button>' : '') +
        (qaSec ? '<a href="#'+qaSec.id+'">Вопросы раздела «' + esc(qaSec.title) + '»</a>' : '') +
        (KB.personByTerm && KB.personByTerm(t.t) ? '<a href="#people/' + KB.personByTerm(t.t).id + '">Биография и труды</a>' : '') +
      '</div>';
    cardBody.innerHTML = html;
    if(KB.linkTerms) KB.linkTerms(cardBody.querySelector('.tb-def'), {exclude:i, max:8});
    if(KB.linkTerms && t.r) KB.linkTerms(cardBody.querySelector('.tb-ref'), {exclude:i, max:10});
    cardBody.hidden = false; cardEmpty.hidden = true;
    card.classList.add('open');
    card.scrollTop = 0;
  }
  card.addEventListener('click', function(e){
    var c = e.target.closest('[data-ti]');
    if(c){ select(+c.getAttribute('data-ti'), {reveal:true}); return; }
    var g = e.target.closest('[data-goto-branch]');
    if(g){ setView('tree'); views.tree.openBranch(g.getAttribute('data-goto-branch')); return; }
    var a = e.target.closest('[data-act]');
    if(a){ setView(a.getAttribute('data-act')); return; }
    if(e.target.closest('.tb-close')){ card.classList.remove('open'); }
  });

  function select(i, opts){
    opts = opts || {};
    if(i != null && state.hidden.has(T[i].p)){
      state.hidden.delete(T[i].p);
      legend.querySelector('[data-pid="'+T[i].p+'"]').setAttribute('aria-pressed','true');
      Object.keys(views).forEach(function(k){ views[k].dirty = true; });
      renderView();
    }
    state.sel = i;
    renderCard();
    var v = views[state.view];
    if(v.onSelect) v.onSelect(i, opts);
    writeHash();
  }

  /* ---------- Адрес ---------- */
  function hashFor(){
    var h = '#terms/' + state.view;
    if(state.sel != null) h += '/t:' + encodeURIComponent(T[state.sel].t);
    return h;
  }
  var writing = false;
  function writeHash(){
    var h = hashFor();
    if(location.hash !== h){ writing = true; history.replaceState(null, '', h); writing = false; }
  }

  /* ---------- Переключение видов ---------- */
  var viewBtns = document.querySelectorAll('.view-btn');
  var hint = document.getElementById('viewHint');
  var activated = false;
  function setView(v){
    if(VIEWS.indexOf(v) === -1) v = 'tree';
    state.view = v;
    viewBtns.forEach(function(b){ b.setAttribute('aria-checked', b.dataset.view === v ? 'true' : 'false'); });
    VIEWS.forEach(function(k){ document.getElementById('view-'+k).hidden = (k !== v); });
    hint.textContent = HINTS[v];
    renderView();
    renderCard();
    writeHash();
  }
  function renderView(){
    var v = views[state.view];
    if(!v.built){ v.build(); v.built = true; v.dirty = false; }
    else if(v.dirty){ v.refresh(); v.dirty = false; }
    if(v.applyQuery) v.applyQuery();
    if(state.sel != null && v.onSelect) v.onSelect(state.sel, {reveal:true, quiet:true});
  }
  viewBtns.forEach(function(b){
    b.addEventListener('click', function(){ setView(b.dataset.view); });
  });

  /* ---------- Поиск ---------- */
  var tq = document.getElementById('tq'), tclr = document.getElementById('tclr');
  var dl = document.getElementById('termList');
  dl.innerHTML = T.map(function(t){ return '<option value="'+esc(t.t)+'">'; }).join('');
  var qTimer;
  tq.addEventListener('input', function(){
    tclr.style.display = tq.value ? 'block' : 'none';
    var exact = byName[norm(tq.value.trim())];
    clearTimeout(qTimer);
    qTimer = setTimeout(function(){
      state.q = norm(tq.value.trim());
      var v = views[state.view]; if(v.applyQuery) v.applyQuery();
      if(exact != null && state.view !== 'tree' && state.view !== 'abc') select(exact, {reveal:true});
    }, 140);
  });
  tq.addEventListener('keydown', function(e){
    if(e.key !== 'Enter') return;
    var q = norm(tq.value.trim()); if(!q) return;
    var exact = byName[q];
    if(exact == null){ for(var i = 0; i < T.length; i++){ if(visible(T[i]) && norm(T[i].t).indexOf(q) === 0){ exact = i; break; } } }
    if(exact == null){ for(var j = 0; j < T.length; j++){ if(visible(T[j]) && matches(T[j])){ exact = j; break; } } }
    if(exact != null) select(exact, {reveal:true});
  });
  tclr.addEventListener('click', function(){ tq.value=''; tclr.style.display='none'; state.q=''; var v = views[state.view]; if(v.applyQuery) v.applyQuery(); tq.focus(); });

  /* ---------- Масштаб: кнопки ---------- */
  function zoomButtons(host, svg, zoom, resetFn){
    var z = document.createElement('div'); z.className = 'zoom-ctl';
    z.innerHTML = '<button type="button" aria-label="Приблизить">+</button><button type="button" aria-label="Отдалить">−</button><button type="button" aria-label="Вернуть исходный вид" style="font-size:14px">⟲</button>';
    var bs = z.querySelectorAll('button');
    bs[0].onclick = function(){ svg.transition().duration(250).call(zoom.scaleBy, 1.4); };
    bs[1].onclick = function(){ svg.transition().duration(250).call(zoom.scaleBy, 1/1.4); };
    bs[2].onclick = resetFn;
    host.appendChild(z);
  }
  function noD3(host){ host.innerHTML = '<p style="padding:24px;color:var(--ink-faint)">Не удалось загрузить библиотеку диаграмм. Откройте вид «Дерево» или «А–Я».</p>'; }

  var views = {};

  /* ============================================================
     1. Раскрывающееся дерево
     ============================================================ */
  views.tree = (function(){
    var host = document.getElementById('view-tree');
    var CAR = '<svg class="car" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';
    var termEls = [], info;
    function termBtn(i, ref){
      var t = T[i];
      var d = stripRefs(t.d);
      return '<li><button type="button" class="tt-term' + (t.x ? ' is-x' : '') + (ref ? ' is-ref' : '') + '" data-ti="'+i+'"' + (ref ? ' title="Описано в ветви «'+esc(branchById[t.b].title)+'»"' : '') + '>' +
        '<span class="nm">' + esc(t.t) + '</span>' + (t.g ? '<span class="g">' + esc(t.g) + '</span>' : '') +
        '<span class="def">' + esc(d) + '</span></button></li>';
    }
    function build(){
      var html = '<div class="tt-tools"><button class="btn" type="button" data-tt="open">Развернуть всё</button><button class="btn" type="button" data-tt="close">Свернуть всё</button><span class="info"></span></div><ul class="tt" role="tree">';
      D.parts.forEach(function(p){
        var pn = 0, bhtml = '';
        p.branches.forEach(function(bid){
          var b = branchById[bid], bn = 0, ghtml = '';
          b.groups.forEach(function(g){
            ghtml += '<li class="tt-group"><button type="button" class="tt-row" aria-expanded="false">' + CAR + '<span class="nm">' + esc(g.name) + '</span><span class="cnt">' + g.items.length + '</span></button><ul hidden>' +
              g.items.map(function(it){ return typeof it === 'object' ? termBtn(it.ref, true) : termBtn(it, false); }).join('') + '</ul></li>';
            bn += g.items.length;
          });
          pn += bn;
          bhtml += '<li class="tt-branch" data-bid="'+bid+'"><button type="button" class="tt-row" aria-expanded="false">' + CAR + '<span class="nm">' + esc(b.title) + '<span class="sub">' + esc(b.sub) + '</span></span><span class="cnt">' + bn + '</span></button><ul hidden>' + ghtml + '</ul></li>';
        });
        html += '<li class="tt-part" data-pid="'+p.id+'"><button type="button" class="tt-row" aria-expanded="true">' + CAR + '<span class="sw" style="background:'+col(p.id)+'"></span><span class="nm">' + esc(p.title) + '</span><span class="cnt">' + pn + '</span></button><ul>' + bhtml + '</ul></li>';
      });
      html += '</ul>';
      host.innerHTML = html;
      info = host.querySelector('.tt-tools .info');
      termEls = host.querySelectorAll('.tt-term');
      host.addEventListener('click', function(e){
        var tb = e.target.closest('.tt-term');
        if(tb){ select(+tb.dataset.ti); return; }
        var row = e.target.closest('.tt-row');
        if(row){ toggle(row); return; }
        var tool = e.target.closest('[data-tt]');
        if(tool){
          var open = tool.dataset.tt === 'open';
          host.querySelectorAll('.tt-row').forEach(function(r){ setRow(r, open || r.parentNode.classList.contains('tt-part')); });
        }
      });
      refresh();
    }
    function setRow(row, open){ row.setAttribute('aria-expanded', open ? 'true' : 'false'); row.nextElementSibling.hidden = !open; }
    function toggle(row){ setRow(row, row.getAttribute('aria-expanded') !== 'true'); }
    function refresh(){
      host.querySelectorAll('.tt-part').forEach(function(li){ li.classList.toggle('tt-hidden', state.hidden.has(li.dataset.pid)); });
    }
    function applyQuery(){
      var q = state.q, shown = 0;
      termEls.forEach(function(el){
        var t = T[+el.dataset.ti];
        var ok = !q || (matches(t) && !el.classList.contains('is-ref'));
        el.parentNode.classList.toggle('tt-hidden', !ok);
        if(ok && visible(t) && !el.classList.contains('is-ref')) shown++;
      });
      ['.tt-group','.tt-branch','.tt-part'].forEach(function(sel){
        host.querySelectorAll(sel).forEach(function(li){
          var any = li.querySelector(':scope li:not(.tt-hidden) > .tt-term');
          li.classList.toggle('tt-nomatch', !!q && !any);
          if(q && any) setRow(li.firstElementChild, true);
        });
      });
      if(!q && !applyQuery.wasEmpty){
        host.querySelectorAll('.tt-group>.tt-row,.tt-branch>.tt-row').forEach(function(r){ setRow(r, false); });
      }
      applyQuery.wasEmpty = !q;
      var total = T.filter(visible).length;
      info.textContent = q ? ('Найдено ' + shown + ' ' + plural(shown,'термин','термина','терминов')) : (total + ' ' + plural(total,'термин','термина','терминов'));
      if(state.sel != null) mark(state.sel);
    }
    applyQuery.wasEmpty = true;
    function mark(i){
      host.querySelectorAll('.tt-term.sel').forEach(function(el){ el.classList.remove('sel'); });
      var el = host.querySelector('.tt-term[data-ti="'+i+'"]:not(.is-ref)');
      if(el) el.classList.add('sel');
      return el;
    }
    function onSelect(i, opts){
      var el = mark(i);
      if(!el || !opts.reveal) return;
      var li = el.parentNode;
      if(li.classList.contains('tt-hidden')){ tq.value=''; tclr.style.display='none'; state.q=''; applyQuery(); }
      var p = el.parentNode.parentNode;
      while(p && p !== host){
        if(p.tagName === 'UL' && p.previousElementSibling && p.previousElementSibling.classList.contains('tt-row')) setRow(p.previousElementSibling, true);
        p = p.parentNode;
      }
      if(!opts.quiet || true) el.scrollIntoView({block:'center', behavior: opts.quiet ? 'auto' : 'smooth'});
    }
    function openBranch(bid){
      var li = host.querySelector('.tt-branch[data-bid="'+bid+'"]');
      if(!li) return;
      var pid = partByBranch[bid].id;
      if(state.hidden.has(pid)){ state.hidden.delete(pid); legend.querySelector('[data-pid="'+pid+'"]').setAttribute('aria-pressed','true'); refresh(); }
      setRow(li.closest('.tt-part').firstElementChild, true);
      setRow(li.firstElementChild, true);
      li.querySelectorAll('.tt-group>.tt-row').forEach(function(r){ setRow(r, true); });
      setTimeout(function(){ li.scrollIntoView({block:'start', behavior:'smooth'}); }, 30);
    }
    return { build:build, refresh:refresh, applyQuery:applyQuery, onSelect:onSelect, openBranch:openBranch };
  })();

  /* ============================================================
     2. Схема — раскрываемое горизонтальное дерево
     ============================================================ */
  views.scheme = (function(){
    var host = document.getElementById('view-scheme');
    var svg, g, gLink, gNode, zoom, root, uid = 0, W, H;
    var dx = 24, dy = 250;
    function build(){
      if(!hasD3) return noD3(host);
      host.innerHTML = '<div class="svgwrap"></div>';
      var wrap = host.firstChild;
      W = wrap.clientWidth || 900; H = wrap.clientHeight || 640;
      svg = d3.select(wrap).append('svg').attr('viewBox', [0,0,W,H]).attr('aria-label','Схема дерева терминов');
      g = svg.append('g');
      gLink = g.append('g').attr('fill','none').style('stroke','var(--line-strong)').attr('stroke-width',1.4);
      gNode = g.append('g');
      zoom = d3.zoom().scaleExtent([0.2, 3]).on('zoom', function(e){ g.attr('transform', e.transform); });
      svg.call(zoom).on('dblclick.zoom', null);
      zoomButtons(host, svg, zoom, reset);
      refresh();
    }
    function reset(){ svg.transition().duration(400).call(zoom.transform, d3.zoomIdentity.translate(40, H/2).scale(0.85)); }
    function refresh(){
      root = d3.hierarchy(hierarchyData(true));
      root.x0 = 0; root.y0 = 0;
      root.descendants().forEach(function(d){
        d.n = d.data.kind === 'term' ? 0 : d.leaves().filter(function(l){ return l.data.kind === 'term' && !l.data.ref; }).length;
      });
      root.descendants().forEach(function(d){ d.id = ++uid; d._children = d.children; if(d.depth >= 2) d.children = null; });
      gLink.selectAll('*').remove(); gNode.selectAll('*').remove();
      update(root);
      svg.call(zoom.transform, d3.zoomIdentity.translate(40, H/2).scale(0.85));
    }
    function colorOf(d){ var a = d; while(a.depth > 1) a = a.parent; return a.depth === 1 ? col(a.data.pid) : 'var(--ink-faint)'; }
    function update(source){
      var tree = d3.tree().nodeSize([dx, dy]).separation(function(a,b){ return a.parent === b.parent ? 1 : 1.25; });
      tree(root);
      var nodes = root.descendants().reverse(), links = root.links();
      var t = svg.transition().duration(320);

      var node = gNode.selectAll('g.nd').data(nodes, function(d){ return d.id; });
      var enter = node.enter().append('g').attr('class','nd')
        .attr('transform', function(){ return 'translate(' + source.y0 + ',' + source.x0 + ')'; })
        .attr('fill-opacity', 0).attr('stroke-opacity', 0)
        .style('cursor','pointer')
        .on('click', function(e, d){
          if(d.data.kind === 'term'){ select(d.data.ti); return; }
          d.children = d.children ? null : d._children;
          update(d);
        })
        .on('mousemove', function(e, d){ if(d.data.kind === 'term') showTip(e, termTip(d.data.ti), host); })
        .on('mouseleave', hideTip);
      enter.append('circle').attr('r', function(d){ return d.data.kind === 'term' ? 3.5 : 5.5; }).attr('stroke-width', 1.6);
      enter.append('text')
        .attr('dy','0.32em')
        .attr('x', 9)
        .attr('text-anchor', 'start')
        .attr('dy', function(d){ return d.data.kind === 'term' ? '0.32em' : '-0.5em'; })
        .style('font-size', function(d){ return d.depth <= 1 ? '15px' : d.depth === 2 ? '14px' : '13px'; })
        .style('font-weight', 400)
        .style('font-family', function(d){ return d.depth <= 2 ? 'var(--display)' : 'var(--sans)'; })
        .style('paint-order','stroke').style('stroke','var(--panel)').attr('stroke-width',4).attr('stroke-linejoin','round')
        .text(function(d){
          var n = d.data.name;
          if(d.data.kind === 'term' && T[d.data.ti].x) n = '⊘ ' + n;
          if(d.data.kind !== 'root' && d.data.kind !== 'term') n += ' (' + d.n + ')';
          return n;
        });

      var merged = node.merge(enter);
      merged.transition(t)
        .attr('transform', function(d){ return 'translate(' + d.y + ',' + d.x + ')'; })
        .attr('fill-opacity', 1).attr('stroke-opacity', 1);
      merged.select('circle')
        .style('fill', function(d){ return (d._children && !d.children) ? colorOf(d) : 'var(--panel)'; })
        .style('stroke', colorOf);
      merged.select('text').style('fill', function(d){ return d.data.kind === 'term' && T[d.data.ti].x ? 'var(--cinnabar)' : 'var(--ink)'; });
      markSel();

      node.exit().transition(t).remove()
        .attr('transform', function(){ return 'translate(' + source.y + ',' + source.x + ')'; })
        .attr('fill-opacity', 0).attr('stroke-opacity', 0);

      var diag = d3.linkHorizontal().x(function(d){ return d.y; }).y(function(d){ return d.x; });
      var link = gLink.selectAll('path').data(links, function(d){ return d.target.id; });
      var lEnter = link.enter().append('path').attr('d', function(){ var o = {x:source.x0, y:source.y0}; return diag({source:o, target:o}); });
      link.merge(lEnter).transition(t).attr('d', diag);
      link.exit().transition(t).remove().attr('d', function(){ var o = {x:source.x, y:source.y}; return diag({source:o, target:o}); });

      root.eachBefore(function(d){ d.x0 = d.x; d.y0 = d.y; });
    }
    function markSel(){
      gNode.selectAll('g.nd').select('circle').attr('r', function(d){
        return d.data.kind === 'term' ? (d.data.ti === state.sel && !d.data.ref ? 7 : 3.5) : 5.5;
      }).style('fill', function(d){
        if(d.data.kind === 'term' && d.data.ti === state.sel) return 'var(--cinnabar)';
        return (d._children && !d.children) ? colorOf(d) : 'var(--panel)';
      });
    }
    function onSelect(i, opts){
      if(!root) return;
      var target = null;
      root.each(function(d){ if(!target && d.data.kind === 'term' && d.data.ti === i && !d.data.ref) target = d; });
      if(!target){ // узел мог быть скрыт свёрткой
        var all = []; (function walk(d){ all.push(d); (d._children || []).forEach(walk); })(root);
        all.forEach(function(d){ if(!target && d.data.kind === 'term' && d.data.ti === i && !d.data.ref) target = d; });
      }
      if(!target) return;
      var chain = []; for(var a = target.parent; a; a = a.parent) chain.unshift(a);
      var src = null;
      chain.forEach(function(n){ if(!n.children){ if(!src) src = n.parent || n; n.children = n._children; } });
      if(src){ if(src.x0 == null){ src.x0 = 0; src.y0 = 0; } update(src); }
      else markSel();
      if(opts.reveal){
        var k = d3.zoomTransform(svg.node()).k;
        svg.transition().duration(450).call(zoom.translateTo, target.y + W/(4*k), target.x);
      }
    }
    return { build:build, refresh:refresh, onSelect:onSelect };
  })();

  /* ============================================================
     3. Круг — приближаемая кольцевая диаграмма
     ============================================================ */
  views.sun = (function(){
    var host = document.getElementById('view-sun');
    var svg, g, path, label, center, centerText, root, radius, arc, size;
    function build(){
      if(!hasD3) return noD3(host);
      host.innerHTML = '<div class="svgwrap"></div>';
      refresh();
    }
    function refresh(){
      var wrap = host.firstChild; wrap.innerHTML = '';
      var w = wrap.clientWidth || 800, h = wrap.clientHeight || 700;
      size = Math.min(w, h); radius = size / 6.4;
      var data = hierarchyData(true);
      root = d3.hierarchy(data).sum(function(d){ return d.kind === 'term' && !d.ref ? 1 : 0; });
      d3.partition().size([2 * Math.PI, root.height + 1])(root);
      root.each(function(d){ d.current = d; });
      arc = d3.arc()
        .startAngle(function(d){ return d.x0; }).endAngle(function(d){ return d.x1; })
        .padAngle(function(d){ return Math.min((d.x1 - d.x0) / 2, 0.004); }).padRadius(radius * 1.5)
        .innerRadius(function(d){ return d.y0 * radius; })
        .outerRadius(function(d){ return Math.max(d.y0 * radius, d.y1 * radius - 1.5); });

      svg = d3.select(wrap).append('svg').attr('viewBox', [-w/2, -h/2, w, h]).attr('aria-label','Круговая диаграмма терминов').style('cursor','default');
      g = svg.append('g');
      var depthOp = [0, 1, .8, .6, .42];
      path = g.append('g').selectAll('path').data(root.descendants().slice(1)).join('path')
        .style('fill', function(d){ var a = d; while(a.depth > 1) a = a.parent; return col(a.data.pid); })
        .attr('fill-opacity', function(d){ return arcVisible(d.current) ? depthOp[d.depth] : 0; })
        .style('stroke','var(--panel)').attr('stroke-width', .6)
        .attr('pointer-events', function(d){ return arcVisible(d.current) ? 'auto' : 'none'; })
        .attr('d', function(d){ return arc(d.current); })
        .style('cursor','pointer')
        .on('click', function(e, p){
          if(p.data.kind === 'term'){ select(p.data.ti); return; }
          clicked(p);
        })
        .on('mousemove', function(e, d){
          if(d.data.kind === 'term') showTip(e, termTip(d.data.ti), host);
          else { var n = d.value; showTip(e, '<b>' + esc(d.data.name) + '</b><span>' + n + ' ' + plural(n,'термин','термина','терминов') + '</span>', host); }
        })
        .on('mouseleave', hideTip);
      path.each(function(d){ d.depthOp = depthOp[d.depth]; });

      label = g.append('g').attr('pointer-events','none').attr('text-anchor','middle').style('user-select','none')
        .selectAll('text').data(root.descendants().slice(1)).join('text')
        .attr('dy','0.35em')
        .style('font-size', function(d){ return d.depth === 1 ? '13px' : '11.5px'; })
        .style('font-weight', function(d){ return d.depth <= 2 ? 700 : 400; })
        .style('fill', function(d){ return d.depth <= 2 ? '#fff' : 'var(--ink)'; })
        .attr('fill-opacity', function(d){ return +labelVisible(d.current); })
        .attr('transform', function(d){ return labelTransform(d.current); })
        .text(function(d){ return fit(d); });

      center = g.append('circle').attr('r', radius).style('fill','var(--panel)').attr('pointer-events','all').style('cursor','pointer')
        .on('click', function(){ clicked(root.focus && root.focus.parent ? root.focus.parent : root); });
      centerText = g.append('text').attr('text-anchor','middle').attr('class','sun-center').style('fill','var(--ink)').attr('pointer-events','none');
      root.focus = root;
      setCenter(root);
      if(state.sel != null) markSel();
    }
    function fit(d){
      var n = d.data.name; if(d.data.kind === 'term' && T[d.data.ti].x) n = '⊘ ' + n;
      var max = Math.max(4, Math.floor((radius - 12) / (d.depth === 1 ? 7.4 : 6.6)));
      return n.length > max ? n.slice(0, max - 1) + '…' : n;
    }
    function setCenter(p){
      centerText.selectAll('*').remove();
      var words = (p === root ? 'Православное богословие' : p.data.name).split(' ');
      var lines = [], cur = '';
      words.forEach(function(w){ if((cur + ' ' + w).trim().length > 14 && cur){ lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); });
      lines.push(cur);
      var y0 = -(lines.length - 1) * 9 - (p === root ? 0 : 8);
      lines.forEach(function(l, k){ centerText.append('tspan').attr('x',0).attr('y', y0 + k*18).style('font-size','18px').text(l); });
      centerText.append('tspan').attr('x',0).attr('y', y0 + lines.length*18 + 2).style('font-size','12.5px').style('fill','var(--ink-faint)').style('font-family','var(--sans)')
        .text(p === root ? (p.value + ' ' + plural(p.value,'термин','термина','терминов')) : 'щёлкните, чтобы вернуться');
    }
    function clicked(p){
      root.focus = p;
      setCenter(p);
      root.each(function(d){
        d.target = {
          x0: Math.max(0, Math.min(1, (d.x0 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
          x1: Math.max(0, Math.min(1, (d.x1 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
          y0: Math.max(0, d.y0 - p.depth),
          y1: Math.max(0, d.y1 - p.depth)
        };
      });
      var t = g.transition().duration(600);
      path.transition(t)
        .tween('data', function(d){ var i = d3.interpolate(d.current, d.target); return function(tt){ d.current = i(tt); }; })
        .filter(function(d){ return +this.getAttribute('fill-opacity') || arcVisible(d.target); })
        .attr('fill-opacity', function(d){ return arcVisible(d.target) ? d.depthOp : 0; })
        .attr('pointer-events', function(d){ return arcVisible(d.target) ? 'auto' : 'none'; })
        .attrTween('d', function(d){ return function(){ return arc(d.current); }; });
      label.filter(function(d){ return +this.getAttribute('fill-opacity') || labelVisible(d.target); }).transition(t)
        .attr('fill-opacity', function(d){ return +labelVisible(d.target); })
        .attrTween('transform', function(d){ return function(){ return labelTransform(d.current); }; });
    }
    function arcVisible(d){ return d.y1 <= 3 && d.y0 >= 1 && d.x1 > d.x0; }
    function labelVisible(d){ return d.y1 <= 3 && d.y0 >= 1 && (d.y1 - d.y0) * (d.x1 - d.x0) > 0.045; }
    function labelTransform(d){
      var x = (d.x0 + d.x1) / 2 * 180 / Math.PI, y = (d.y0 + d.y1) / 2 * radius;
      return 'rotate(' + (x - 90) + ') translate(' + y + ',0) rotate(' + (x < 180 ? 0 : 180) + ')';
    }
    function markSel(){
      path.style('stroke', function(d){ return d.data.kind === 'term' && d.data.ti === state.sel ? 'var(--ink)' : 'var(--panel)'; })
          .attr('stroke-width', function(d){ return d.data.kind === 'term' && d.data.ti === state.sel ? 2 : .6; });
    }
    function onSelect(i, opts){
      if(!root) return;
      markSel();
      if(!opts.reveal) return;
      var target = null;
      root.each(function(d){ if(!target && d.data.kind === 'term' && d.data.ti === i && !d.data.ref) target = d; });
      if(target && target.parent && target.parent.parent && root.focus !== target.parent.parent) clicked(target.parent.parent);
    }
    return { build:build, refresh:refresh, onSelect:onSelect };
  })();

  /* ============================================================
     4. Граф связей
     ============================================================ */
  views.graph = (function(){
    var host = document.getElementById('view-graph');
    var svg, g, linkSel, nodeSel, labelSel, zoom, nodes, links, W, H, k = 1, focusSet = null, fit;
    function build(){
      if(!hasD3) return noD3(host);
      host.innerHTML = '<div class="svgwrap"></div><div class="graph-tools"><button class="btn" type="button" data-g="clear">Снять выделение</button><select aria-label="Глубина окружения"><option value="1">Ближайшие связи</option><option value="2">Связи второго порядка</option></select></div>';
      host.querySelector('[data-g="clear"]').onclick = function(){ state.sel = null; renderCard(); focusSet = null; paint(); writeHash(); };
      host.querySelector('select').onchange = function(){ if(state.sel != null){ focusOn(state.sel); paint(); } };
      refresh();
    }
    function refresh(){
      var wrap = host.querySelector('.svgwrap'); wrap.innerHTML = '';
      W = wrap.clientWidth || 900; H = wrap.clientHeight || 700;
      nodes = T.filter(visible).map(function(t){ return { i:t.i, p:t.p, r: 3 + Math.sqrt(t.deg) * 1.5 }; });
      var idx = {}; nodes.forEach(function(n, j){ idx[n.i] = j; });
      links = [];
      T.forEach(function(t){ if(!visible(t)) return; nb[t.i].forEach(function(j){ if(j > t.i && idx[j] != null) links.push({ source: idx[t.i], target: idx[j] }); }); });
      // центры частей — по кругу, чтобы части читались как облака
      var vp = D.parts.filter(function(p){ return !state.hidden.has(p.id); });
      var cx = {}, cy = {}, R = Math.min(W, H) * 0.34;
      vp.forEach(function(p, j){ var a = j / vp.length * 2 * Math.PI - Math.PI/2; cx[p.id] = W/2 + (vp.length > 1 ? R * Math.cos(a) : 0); cy[p.id] = H/2 + (vp.length > 1 ? R * Math.sin(a) : 0); });
      nodes.forEach(function(n){ n.x = cx[n.p] + (Math.random() - .5) * 40; n.y = cy[n.p] + (Math.random() - .5) * 40; });
      var sim = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(links).distance(34).strength(0.25))
        .force('charge', d3.forceManyBody().strength(-34).distanceMax(260))
        .force('x', d3.forceX(function(n){ return cx[n.p]; }).strength(0.07))
        .force('y', d3.forceY(function(n){ return cy[n.p]; }).strength(0.07))
        .force('collide', d3.forceCollide(function(n){ return n.r + 1.5; }))
        .stop();
      for(var s = 0; s < 260; s++) sim.tick();

      svg = d3.select(wrap).append('svg').attr('viewBox', [0,0,W,H]).attr('aria-label','Граф связей между терминами');
      g = svg.append('g');
      linkSel = g.append('g').style('stroke','var(--ink-faint)').selectAll('line').data(links).join('line')
        .attr('x1', function(d){ return d.source.x; }).attr('y1', function(d){ return d.source.y; })
        .attr('x2', function(d){ return d.target.x; }).attr('y2', function(d){ return d.target.y; });
      nodeSel = g.append('g').selectAll('circle').data(nodes).join('circle')
        .attr('cx', function(d){ return d.x; }).attr('cy', function(d){ return d.y; }).attr('r', function(d){ return d.r; })
        .style('fill', function(d){ return col(d.p); }).style('stroke','var(--panel)').attr('stroke-width', 1.2)
        .style('cursor','pointer')
        .on('click', function(e, d){ select(d.i); })
        .on('mousemove', function(e, d){ showTip(e, termTip(d.i) + '<span><br>' + T[d.i].deg + ' ' + plural(T[d.i].deg,'связь','связи','связей') + '</span>', host); })
        .on('mouseleave', hideTip);
      labelSel = g.append('g').attr('pointer-events','none').selectAll('text').data(nodes).join('text')
        .attr('x', function(d){ return d.x + d.r + 3; }).attr('y', function(d){ return d.y; }).attr('dy','0.33em')
        .style('font-size','11.5px').style('paint-order','stroke').style('stroke','var(--panel)').attr('stroke-width',3).attr('stroke-linejoin','round')
        .style('fill','var(--ink)')
        .text(function(d){ return (T[d.i].x ? '⊘ ' : '') + T[d.i].t; });
      zoom = d3.zoom().scaleExtent([0.3, 6]).on('zoom', function(e){
        g.attr('transform', e.transform);
        if(Math.abs(e.transform.k - k) > 0.05){ k = e.transform.k; paintLabels(); }
        labelSel.style('font-size', (11.5 / Math.sqrt(k)) + 'px');
      });
      svg.call(zoom);
      var x0 = d3.min(nodes, function(n){ return n.x - n.r; }), x1 = d3.max(nodes, function(n){ return n.x + n.r; });
      var y0 = d3.min(nodes, function(n){ return n.y - n.r; }), y1 = d3.max(nodes, function(n){ return n.y + n.r; });
      var fk = Math.min(1.4, 0.94 * Math.min(W / (x1 - x0), H / (y1 - y0)));
      fit = d3.zoomIdentity.translate(W/2, H/2).scale(fk).translate(-(x0 + x1)/2, -(y0 + y1)/2);
      zoomButtons(host, svg, zoom, function(){ svg.transition().duration(400).call(zoom.transform, fit); });
      k = 0; svg.call(zoom.transform, fit);
      if(state.sel != null) focusOn(state.sel);
      paint();
    }
    function focusOn(i){
      var depth = +(host.querySelector('select') || {value:1}).value;
      focusSet = new Set([i]);
      var frontier = [i];
      for(var d = 0; d < depth; d++){
        var next = [];
        frontier.forEach(function(x){ nb[x].forEach(function(y){ if(!focusSet.has(y)){ focusSet.add(y); next.push(y); } }); });
        frontier = next;
      }
    }
    function paintLabels(){
      if(!labelSel) return;
      var thr = k < 0.8 ? 14 : k < 1.3 ? 8 : k < 2 ? 4 : k < 3 ? 2 : 0;
      labelSel.attr('display', function(d){
        if(focusSet) return focusSet.has(d.i) ? null : 'none';
        if(state.q) return matches(T[d.i]) && (T[d.i].deg >= Math.min(thr, 2) || k > 1.6 || true) ? null : 'none';
        return T[d.i].deg >= thr ? null : 'none';
      }).style('font-weight', function(d){ return d.i === state.sel ? 700 : 400; });
    }
    function paint(){
      if(!nodeSel) return;
      var q = state.q;
      nodeSel.attr('opacity', function(d){
        if(focusSet) return focusSet.has(d.i) ? 1 : 0.12;
        if(q) return matches(T[d.i]) ? 1 : 0.12;
        return 1;
      }).style('stroke', function(d){ return d.i === state.sel ? 'var(--ink)' : 'var(--panel)'; })
        .attr('stroke-width', function(d){ return d.i === state.sel ? 2.5 : 1.2; });
      linkSel.attr('stroke-opacity', function(d){
        if(focusSet) return focusSet.has(d.source.i) && focusSet.has(d.target.i) ? 0.75 : 0.03;
        if(q) return 0.05;
        return 0.22;
      }).attr('stroke-width', function(d){ return focusSet && (d.source.i === state.sel || d.target.i === state.sel) ? 1.6 : 1; });
      paintLabels();
    }
    function onSelect(i, opts){
      if(!nodeSel) return;
      focusOn(i); paint();
      nodeSel.filter(function(d){ return focusSet.has(d.i); }).raise();
      labelSel.filter(function(d){ return d.i === i; }).raise();
      if(!opts.reveal) return;
      var n = nodes.find(function(x){ return x.i === i; });
      if(!n) return;
      var kk = Math.max(d3.zoomTransform(svg.node()).k, 2.4);
      svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity.translate(W/2, H/2).scale(kk).translate(-n.x, -n.y));
    }
    return { build:build, refresh:refresh, onSelect:onSelect, applyQuery:paint };
  })();

  /* ============================================================
     5. Карта — treemap с раскрытием ветви
     ============================================================ */
  views.map = (function(){
    var host = document.getElementById('view-map');
    var focusBranch = null, W, H;
    function build(){
      if(!hasD3) return noD3(host);
      host.innerHTML = '<div class="svgwrap" style="cursor:default"></div>';
      refresh();
    }
    function refresh(){
      var wrap = host.firstChild; wrap.innerHTML = '';
      W = wrap.clientWidth || 900; H = wrap.clientHeight || 680;
      if(focusBranch && state.hidden.has(partByBranch[focusBranch].id)) focusBranch = null;
      var svg = d3.select(wrap).append('svg').attr('viewBox',[0,0,W,H]).attr('aria-label','Карта терминов').style('cursor','default');
      if(!focusBranch) drawAll(svg); else drawBranch(svg, focusBranch);
      if(state.sel != null) markSel();
    }
    function drawAll(svg){
      var root = d3.hierarchy(hierarchyData(false)).sum(function(d){ return d.kind === 'term' && !d.ref ? 1 : 0; });
      d3.treemap().size([W, H]).paddingOuter(3).paddingTop(function(d){ return d.depth === 1 ? 24 : d.depth === 2 ? 20 : 0; }).paddingInner(2).round(true)(root);
      var parts = svg.selectAll('g.pt').data(root.children || []).join('g');
      parts.append('rect').attr('x', function(d){ return d.x0; }).attr('y', function(d){ return d.y0; })
        .attr('width', function(d){ return d.x1 - d.x0; }).attr('height', function(d){ return d.y1 - d.y0; })
        .attr('rx', 6).style('fill', function(d){ return col(d.data.pid); }).attr('fill-opacity', .13);
      parts.append('text').attr('x', function(d){ return d.x0 + 8; }).attr('y', function(d){ return d.y0 + 17; })
        .style('font-family','var(--display)').style('font-size','15.5px').style('fill','var(--ink)')
        .text(function(d){ return clip(d.data.name + ' (' + d.value + ')', d.x1 - d.x0 - 14, 7.6); });
      var brs = svg.selectAll('g.br').data(root.descendants().filter(function(d){ return d.depth === 2; })).join('g')
        .style('cursor','pointer')
        .on('click', function(e, d){ focusBranch = d.data.bid; refresh(); })
        .on('mousemove', function(e, d){ showTip(e, '<b>' + esc(d.data.name) + '</b><span>' + d.value + ' ' + plural(d.value,'термин','термина','терминов') + '. Щёлкните, чтобы раскрыть</span>', host); })
        .on('mouseleave', hideTip);
      brs.append('rect').attr('x', function(d){ return d.x0; }).attr('y', function(d){ return d.y0; })
        .attr('width', function(d){ return d.x1 - d.x0; }).attr('height', function(d){ return d.y1 - d.y0; })
        .attr('rx', 4).style('fill','var(--panel)').style('stroke', function(d){ return col(d.data.pid); }).attr('stroke-opacity', .5);
      brs.append('text').attr('x', function(d){ return d.x0 + 6; }).attr('y', function(d){ return d.y0 + 14; })
        .style('font-size','12.5px').style('font-weight',700).style('fill','var(--ink)')
        .text(function(d){ return clip(d.data.name, d.x1 - d.x0 - 10, 6.6); });
      svg.selectAll('rect.cell').data(root.leaves()).join('rect').attr('class','cell')
        .attr('x', function(d){ return d.x0; }).attr('y', function(d){ return d.y0; })
        .attr('width', function(d){ return Math.max(0, d.x1 - d.x0); }).attr('height', function(d){ return Math.max(0, d.y1 - d.y0); })
        .attr('rx', 2).style('fill', function(d){ return col(d.data.pid); })
        .attr('fill-opacity', function(d){ return T[d.data.ti].x ? .25 : .55; })
        .style('cursor','pointer')
        .on('click', function(e, d){ e.stopPropagation(); hideTip(); focusBranch = d.parent.data.bid; refresh(); select(d.data.ti); })
        .on('mousemove', function(e, d){ e.stopPropagation(); showTip(e, termTip(d.data.ti), host); })
        .on('mouseleave', hideTip);
    }
    function drawBranch(svg, bid){
      var b = branchById[bid], p = partByBranch[bid];
      var data = hierarchyData(true).children.filter(function(x){ return x.pid === p.id; })[0].children.filter(function(x){ return x.bid === bid; })[0];
      var root = d3.hierarchy(data).sum(function(d){ return d.kind === 'term' && !d.ref ? 1 : 0; });
      d3.treemap().size([W, H - 40]).paddingOuter(3).paddingTop(function(d){ return d.depth === 1 ? 22 : 0; }).paddingInner(3).round(true)(root);
      var head = svg.append('g').style('cursor','pointer').on('click', function(){ focusBranch = null; refresh(); });
      head.append('rect').attr('x',6).attr('y',6).attr('width',120).attr('height',28).attr('rx',7).style('fill','var(--panel-2)').style('stroke','var(--line-strong)');
      head.append('text').attr('x',66).attr('y',25).attr('text-anchor','middle').style('font-size','13.5px').style('font-weight',700).style('fill','var(--link)').text('‹ Вся карта');
      svg.append('text').attr('x',140).attr('y',26).style('font-family','var(--display)').style('font-size','21px').style('fill','var(--ink)')
        .text(b.title + ' — ' + b.sub);
      var gg = svg.append('g').attr('transform','translate(0,40)');
      var groups = gg.selectAll('g.gr').data(root.children || []).join('g');
      groups.append('rect').attr('x', function(d){ return d.x0; }).attr('y', function(d){ return d.y0; })
        .attr('width', function(d){ return d.x1 - d.x0; }).attr('height', function(d){ return d.y1 - d.y0; })
        .attr('rx', 6).style('fill', col(p.id)).attr('fill-opacity', .12);
      groups.append('text').attr('x', function(d){ return d.x0 + 7; }).attr('y', function(d){ return d.y0 + 15; })
        .style('font-size','13px').style('font-weight',700).style('fill','var(--ink)')
        .text(function(d){ return clip(d.data.name, d.x1 - d.x0 - 12, 6.8); });
      var cells = gg.selectAll('g.cell').data(root.leaves()).join('g').attr('class','cell').style('cursor','pointer')
        .on('click', function(e, d){ select(d.data.ti); })
        .on('mousemove', function(e, d){ showTip(e, termTip(d.data.ti), host); })
        .on('mouseleave', hideTip);
      cells.append('rect').attr('x', function(d){ return d.x0; }).attr('y', function(d){ return d.y0; })
        .attr('width', function(d){ return Math.max(0, d.x1 - d.x0); }).attr('height', function(d){ return Math.max(0, d.y1 - d.y0); })
        .attr('rx', 4).style('fill','var(--panel)').style('stroke', col(p.id)).attr('stroke-opacity', .55);
      cells.each(function(d){
        var w = d.x1 - d.x0, h = d.y1 - d.y0, t = T[d.data.ti];
        var txt = d3.select(this).append('text').style('font-size','12.5px').style('fill', t.x ? 'var(--cinnabar)' : 'var(--ink)');
        var words = ((t.x ? '⊘ ' : '') + t.t).split(' '), line = '', lines = [], maxCh = Math.max(4, Math.floor((w - 10) / 6.6));
        words.forEach(function(wd){ if((line + ' ' + wd).trim().length > maxCh && line){ lines.push(line); line = wd; } else line = (line + ' ' + wd).trim(); });
        lines.push(line);
        var maxLines = Math.max(0, Math.floor((h - 6) / 14));
        if(lines.length > maxLines){ lines = lines.slice(0, maxLines); if(lines.length) lines[lines.length-1] = clip(lines[lines.length-1] + '…', w - 10, 6.6); }
        lines.forEach(function(l, k){ txt.append('tspan').attr('x', d.x0 + 5).attr('y', d.y0 + 15 + k*14).text(l); });
      });
    }
    function clip(s, px, cw){ var n = Math.floor(px / cw); return n <= 1 ? '' : (s.length > n ? s.slice(0, n - 1) + '…' : s); }
    function markSel(){
      d3.select(host).selectAll('.cell').each(function(d){
        var el = d3.select(this); var r = this.tagName === 'rect' ? el : el.select('rect');
        var on = d.data.ti === state.sel;
        r.style('stroke', on ? 'var(--ink)' : (this.tagName === 'rect' ? null : col(d.data.pid))).attr('stroke-width', on ? 2.5 : 1);
      });
    }
    function onSelect(i, opts){
      if(opts.reveal && !opts.quiet && focusBranch !== T[i].b && focusBranch){ focusBranch = T[i].b; refresh(); return; }
      markSel();
    }
    return { build:build, refresh:refresh, onSelect:onSelect };
  })();

  /* ============================================================
     6. Алфавитный указатель
     ============================================================ */
  views.abc = (function(){
    var host = document.getElementById('view-abc');
    var body, letters;
    function build(){
      host.innerHTML = '<nav class="abc-letters" aria-label="Буквы"></nav><div class="abc-body"></div>';
      letters = host.firstChild; body = host.lastChild;
      body.addEventListener('click', function(e){ var b = e.target.closest('.tt-term'); if(b) select(+b.dataset.ti); });
      letters.addEventListener('click', function(e){
        var a = e.target.closest('a'); if(!a) return; e.preventDefault();
        var h = body.querySelector('[data-letter="'+a.dataset.l+'"]'); if(h) body.scrollTo({top: h.offsetTop - body.offsetTop - 4, behavior:'smooth'});
      });
      refresh();
    }
    function refresh(){
      var list = T.filter(function(t){ return visible(t) && matches(t); })
        .sort(function(a, b){ return a.t.localeCompare(b.t, 'ru'); });
      var by = {}, order = [];
      list.forEach(function(t){ var L = t.t[0].toUpperCase().replace('Ё','Е'); if(!/[А-ЯA-Z]/.test(L)) L = '#'; if(!by[L]){ by[L] = []; order.push(L); } by[L].push(t); });
      letters.innerHTML = order.map(function(L){ return '<a href="#" data-l="'+L+'">' + L + '</a>'; }).join('');
      body.innerHTML = order.length ? order.map(function(L){
        return '<h3 data-letter="'+L+'">' + L + '</h3>' + by[L].map(function(t){
          return '<button type="button" class="tt-term' + (t.x ? ' is-x' : '') + (t.i === state.sel ? ' sel' : '') + '" data-ti="'+t.i+'"><span class="sw" style="background:'+col(t.p)+'"></span><span class="nm">' + esc(t.t) + '</span></button>';
        }).join('');
      }).join('') : '<p style="color:var(--ink-faint);font-style:italic">Ничего не найдено. Попробуйте другое слово.</p>';
    }
    function onSelect(i, opts){
      body.querySelectorAll('.tt-term.sel').forEach(function(el){ el.classList.remove('sel'); });
      var el = body.querySelector('.tt-term[data-ti="'+i+'"]');
      if(el){ el.classList.add('sel'); if(opts.reveal) body.scrollTo({top: el.offsetTop - body.offsetTop - 60, behavior: opts.quiet ? 'auto' : 'smooth'}); }
    }
    return { build:build, refresh:refresh, applyQuery:refresh, onSelect:onSelect };
  })();

  /* ---------- Перерисовка при изменении ширины ---------- */
  var rw, lastW = window.innerWidth;
  window.addEventListener('resize', function(){
    clearTimeout(rw);
    rw = setTimeout(function(){
      if(Math.abs(window.innerWidth - lastW) < 40) return;
      lastW = window.innerWidth;
      ['scheme','sun','graph','map'].forEach(function(k){ if(views[k].built) views[k].dirty = true; });
      if(activated && !document.getElementById('panel-terms').hidden) renderView();
    }, 250);
  });

  /* ---------- Внешний интерфейс для app.js ---------- */
  KB.terms = {
    activate: function(){ if(!activated){ activated = true; setView(state.view); } },
    hash: hashFor,
    route: function(h){
      if(writing) return;
      var segs = h.replace(/^#terms\/?/, '').split('/');
      var v = VIEWS.indexOf(segs[0]) !== -1 ? segs[0] : state.view;
      var rest = segs.slice(1).join('/');
      activated = true;
      if(v !== state.view || !views[v].built) setView(v);
      if(rest.indexOf('t:') === 0){
        var i = byName[norm(decodeURIComponent(rest.slice(2)))];
        if(i != null && i !== state.sel) select(i, {reveal:true});
      } else if(rest && branchById[rest]){
        setView('tree'); views.tree.openBranch(rest);
      }
    }
  };
})();
