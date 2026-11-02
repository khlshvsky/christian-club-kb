/* ============================================================
   База знаний Христианского клуба — вопросы и ответы, вкладки
   Зависит от data/knowledge.js (глобальные BOOKS, SRC, DATA)
   ============================================================ */
(function(){
  "use strict";

  /* ---- Ссылки на Писание в «Викитеку» (синодальный перевод) ---- */
  // [[Ин 3:5]] или [[Ин 3:5|текст]]
  function bibleReplace(text){
    return text.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, function(m, ref, disp){
      ref = ref.trim();
      var parts = ref.split(/\s+/);
      var ci = parts.findIndex(function(p){ return p.indexOf(":") !== -1; });
      var chVerse, book;
      if(ci === -1){ chVerse = parts[parts.length-1]; book = parts.slice(0,-1).join(" "); }
      else { chVerse = parts[ci]; book = parts.slice(0,ci).join(" "); }
      var chapter = chVerse.split(":")[0].replace(/[^\d]/g,"");
      var title = (typeof BOOKS !== "undefined") ? BOOKS[book] : null;
      var label = disp ? disp : (book + " " + chVerse);
      if(!title) return label;
      var url = "https://ru.wikisource.org/wiki/" + encodeURI(title.replace(/ /g,"_")) + (chapter ? ("#"+chapter) : "");
      return '<a class="ref" href="'+url+'" target="_blank" rel="noopener" title="Открыть в Викитеке (синодальный перевод)">'+
             label.replace(/ /g," ")+'<span class="ext" aria-hidden="true"></span></a>';
    });
  }
  window.KB = window.KB || {};
  KB.bibleReplace = bibleReplace;

  document.querySelectorAll('.js-ref').forEach(function(el){
    el.outerHTML = bibleReplace('[[' + el.getAttribute('data-ref') + ']]');
  });

  function plural(n, one, few, many){
    var m10 = n % 10, m100 = n % 100;
    if(m10 === 1 && m100 !== 11) return one;
    if(m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  }
  KB.plural = plural;

  var PLUS = '<svg class="mark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';

  var content = document.getElementById('content');
  var discIndex = document.getElementById('discIndex');
  var totalQ = 0;

  /* ---- Какие ветви терминов относятся к разделу вопросов ---- */
  var branchesByQa = {};
  if(typeof TERMS_DATA !== 'undefined'){
    TERMS_DATA.branches.forEach(function(b){ (branchesByQa[b.qa] = branchesByQa[b.qa] || []).push(b); });
  }

  /* ---- Оглавление и разделы ---- */
  DATA.forEach(function(cl, ci){
    var qn = cl.qa.length; totalQ += qn;

    var li = document.createElement('li');
    li.innerHTML = '<a href="#'+cl.id+'" data-sec="'+cl.id+'"><span class="tn">'+cl.title+'</span><span class="qn">'+qn+'</span></a>';
    discIndex.appendChild(li);

    var sec = document.createElement('section');
    sec.className = 'cluster';
    sec.id = cl.id;
    var brs = branchesByQa[cl.id] || [];
    var termsLink = brs.length ? '<div class="cl-terms">Термины раздела: ' + brs.map(function(b){
        return '<a href="#terms/tree/'+b.id+'" data-branch="'+b.id+'">'+b.title+'</a>';
      }).join(', ') + '</div>' : '';
    sec.innerHTML = '<div class="cluster-head"><h2>'+cl.title+'</h2><div class="cl-sub">'+cl.sub+'</div>'+termsLink+'</div>';

    cl.qa.forEach(function(item, qi){
      var wrap = document.createElement('div');
      wrap.className = 'qa';
      wrap.id = 'q-'+ci+'-'+qi;
      wrap.setAttribute('data-open','0');
      wrap.innerHTML =
        '<button class="q" aria-expanded="false" id="qb-'+ci+'-'+qi+'">'+item.q+PLUS+'</button>'+
        '<div class="a-wrap" role="region" aria-labelledby="qb-'+ci+'-'+qi+'">'+
          '<div class="a">'+bibleReplace(item.a)+
            '<div class="src"><span class="lbl">Источник:</span><span>'+item.s+'</span></div>'+
          '</div>'+
        '</div>';
      sec.appendChild(wrap);
    });
    content.appendChild(sec);
  });

  document.getElementById('totalCount').textContent =
    DATA.length + ' ' + plural(DATA.length,'раздел','раздела','разделов') + ', ' +
    totalQ + ' ' + plural(totalQ,'вопрос','вопроса','вопросов');
  document.getElementById('tabQaN').textContent = totalQ;
  if(typeof TERMS_DATA !== 'undefined') document.getElementById('tabTermsN').textContent = TERMS_DATA.terms.length;

  /* ---- Аккордеон ---- */
  function setOpen(wrap, open){
    var inner = wrap.querySelector('.a-wrap');
    var btn = wrap.querySelector('.q');
    if(open){
      wrap.setAttribute('data-open','1');
      btn.setAttribute('aria-expanded','true');
      inner.style.height = inner.scrollHeight + 'px';
      var done = function(){ if(wrap.getAttribute('data-open')==='1') inner.style.height='auto'; inner.removeEventListener('transitionend',done); };
      inner.addEventListener('transitionend', done);
    } else {
      if(wrap.getAttribute('data-open') === '0' && inner.style.height !== 'auto') { inner.style.height = '0px'; return; }
      wrap.setAttribute('data-open','0');
      btn.setAttribute('aria-expanded','false');
      inner.style.height = inner.scrollHeight + 'px';
      requestAnimationFrame(function(){ inner.style.height = '0px'; });
    }
  }
  content.addEventListener('click', function(e){
    var btn = e.target.closest('.q');
    if(!btn) return;
    var wrap = btn.closest('.qa');
    setOpen(wrap, wrap.getAttribute('data-open')==='0');
  });
  document.getElementById('expandAll').addEventListener('click', function(){
    document.querySelectorAll('.qa:not(.hidden)').forEach(function(w){ setOpen(w,true); });
  });
  document.getElementById('collapseAll').addEventListener('click', function(){
    document.querySelectorAll('.qa').forEach(function(w){ setOpen(w,false); });
  });

  /* ---- Поиск ---- */
  var input = document.getElementById('q');
  var clr = document.getElementById('clr');
  var countEl = document.getElementById('count');
  var noRes = document.getElementById('noResults');

  function norm(s){ return s.toLowerCase().replace(/ё/g,'е'); }
  KB.norm = norm;

  function clearMarks(el){
    el.querySelectorAll('mark').forEach(function(m){
      m.parentNode.replaceChild(document.createTextNode(m.textContent), m);
    });
    el.normalize();
  }
  function highlight(node, term){
    if(node.nodeType === 3){
      var txt = node.nodeValue, i = norm(txt).indexOf(term);
      if(i >= 0){
        var frag = document.createDocumentFragment();
        frag.appendChild(document.createTextNode(txt.slice(0,i)));
        var mk = document.createElement('mark'); mk.textContent = txt.slice(i, i+term.length);
        frag.appendChild(mk);
        frag.appendChild(document.createTextNode(txt.slice(i+term.length)));
        node.parentNode.replaceChild(frag, node);
        return true;
      }
      return false;
    }
    if(node.nodeType === 1 && node.tagName !== 'A' && node.tagName !== 'MARK' && node.tagName !== 'svg'){
      var found = false;
      Array.prototype.slice.call(node.childNodes).forEach(function(ch){ if(highlight(ch, term)) found = true; });
      return found;
    }
    return false;
  }
  function updateCount(){
    var vis = document.querySelectorAll('.qa:not(.hidden)').length;
    countEl.textContent = (vis === totalQ) ? '' : ('Найдено: ' + vis);
  }

  var t;
  input.addEventListener('input', function(){
    clr.style.display = input.value ? 'block' : 'none';
    clearTimeout(t); t = setTimeout(runSearch, 110);
  });
  clr.addEventListener('click', function(){ input.value=''; clr.style.display='none'; runSearch(); input.focus(); });

  function runSearch(){
    var term = norm(input.value.trim());
    document.querySelectorAll('.qa').forEach(function(w){
      clearMarks(w.querySelector('.q'));
      clearMarks(w.querySelector('.a'));
    });
    if(!term){
      document.querySelectorAll('.qa,.cluster').forEach(function(el){ el.classList.remove('hidden'); if(el.classList.contains('qa')) setOpen(el,false); });
      noRes.style.display = 'none';
      updateCount();
      return;
    }
    var anyGlobal = false;
    document.querySelectorAll('.cluster').forEach(function(sec){
      var anyInSec = false;
      sec.querySelectorAll('.qa').forEach(function(w){
        var hit = norm(w.querySelector('.q').textContent).indexOf(term) !== -1 ||
                  norm(w.querySelector('.a').textContent).indexOf(term) !== -1;
        w.classList.toggle('hidden', !hit);
        if(hit){
          anyInSec = true; anyGlobal = true;
          highlight(w.querySelector('.q'), term);
          highlight(w.querySelector('.a'), term);
          setOpen(w, true);
        } else {
          setOpen(w, false);
        }
      });
      sec.classList.toggle('hidden', !anyInSec);
    });
    noRes.style.display = anyGlobal ? 'none' : 'block';
    updateCount();
  }
  updateCount();

  /* ---- Подсветка текущего раздела в оглавлении ---- */
  var tocLinks = {};
  discIndex.querySelectorAll('a').forEach(function(a){ tocLinks[a.getAttribute('data-sec')] = a; });
  if('IntersectionObserver' in window){
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if(en.isIntersecting){
          Object.keys(tocLinks).forEach(function(k){ tocLinks[k].classList.remove('active'); });
          var a = tocLinks[en.target.id];
          if(a){ a.classList.add('active'); if(window.innerWidth <= 860) a.scrollIntoView({block:'nearest',inline:'nearest'}); }
        }
      });
    }, {rootMargin:'-90px 0px -70% 0px'});
    document.querySelectorAll('.cluster').forEach(function(s){ io.observe(s); });
  }

  /* ---- Вкладки ---- */
  var tabs = document.querySelectorAll('.tab');
  var panels = { qa: document.getElementById('panel-qa'), terms: document.getElementById('panel-terms') };
  var current = 'qa';
  function showTab(name, opts){
    opts = opts || {};
    if(!panels[name]) return;
    var changed = current !== name;
    current = name;
    tabs.forEach(function(b){ b.setAttribute('aria-selected', b.getAttribute('data-tab') === name ? 'true' : 'false'); });
    Object.keys(panels).forEach(function(k){ panels[k].hidden = (k !== name); });
    if(name === 'terms' && KB.terms) KB.terms.activate();
    if(changed && !opts.keepScroll) window.scrollTo({top:0});
  }
  KB.showTab = showTab;
  tabs.forEach(function(b){
    b.addEventListener('click', function(){
      var name = b.getAttribute('data-tab');
      if(name === 'terms'){ location.hash = KB.terms ? KB.terms.hash() : '#terms'; }
      else { history.pushState(null, '', location.pathname + location.search); showTab('qa'); }
    });
  });
  // клавиши ← → между вкладками
  document.querySelector('.tabs').addEventListener('keydown', function(e){
    if(e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    var arr = Array.prototype.slice.call(tabs);
    var i = arr.indexOf(document.activeElement);
    if(i < 0) return;
    var n = arr[(i + (e.key === 'ArrowRight' ? 1 : arr.length - 1)) % arr.length];
    n.focus(); n.click();
  });
  document.querySelector('.brand').addEventListener('click', function(e){
    e.preventDefault(); history.pushState(null, '', location.pathname + location.search); showTab('qa'); window.scrollTo({top:0, behavior:'smooth'});
  });

  function route(){
    var h = decodeURIComponent(location.hash || '');
    if(h.indexOf('#terms') === 0){
      showTab('terms', {keepScroll:true});
      if(KB.terms) KB.terms.route(h);
      return;
    }
    showTab('qa', {keepScroll:true});
    if(h.length > 1){
      var el = document.getElementById(h.slice(1));
      if(el){
        if(el.classList.contains('qa')) setOpen(el, true);
        setTimeout(function(){ el.scrollIntoView(); }, 0);
      }
    }
  }
  KB.route = route;
  window.addEventListener('hashchange', route);

  /* ---- Наверх ---- */
  var toTop = document.getElementById('toTop');
  window.addEventListener('scroll', function(){ toTop.classList.toggle('show', window.scrollY > 600); }, {passive:true});
  toTop.addEventListener('click', function(){ window.scrollTo({top:0, behavior:'smooth'}); });

  // начальный маршрут — после загрузки модуля терминов
  window.addEventListener('DOMContentLoaded', route);
})();
