/* ============================================================
   База знаний Христианского клуба — логика приложения
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
             label+'<span class="ext" aria-hidden="true"></span></a>';
    });
  }

  var STAR = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 1.6l2.1 6.9 7.2.1-5.8 4.3 2.1 6.9L12 16.9l-5.7 4.9 2.1-6.9L2.6 8.6l7.2-.1z"/></svg>';
  var PLUS = '<svg class="mark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';

  var content = document.getElementById('content');
  var discIndex = document.getElementById('discIndex');
  var totalQ = 0;

  /* ---- Отрисовка указателя разделов и самих разделов ---- */
  DATA.forEach(function(cl, ci){
    var qn = cl.qa.length; totalQ += qn;

    var card = document.createElement('a');
    card.className = 'disc-card';
    card.href = '#' + cl.id;
    card.innerHTML =
      '<span class="star">'+STAR+'</span>'+
      '<span class="tt"><b>'+cl.title+'</b><span>'+cl.sub+'</span></span>'+
      '<span class="qn">'+qn+'</span>';
    discIndex.appendChild(card);

    var sec = document.createElement('section');
    sec.className = 'cluster';
    sec.id = cl.id;
    var head = '<div class="cluster-head"><div class="star">'+STAR+'</div>'+
               '<div><h2>'+cl.title+'</h2><div class="cl-sub">'+cl.sub+'</div></div></div>'+
               '<div class="cluster-rule"></div>';
    sec.innerHTML = head;

    cl.qa.forEach(function(item, qi){
      var wrap = document.createElement('div');
      wrap.className = 'qa';
      wrap.setAttribute('data-open','0');
      wrap.innerHTML =
        '<button class="q" aria-expanded="false" id="q-'+ci+'-'+qi+'">'+item.q+PLUS+'</button>'+
        '<div class="a-wrap" role="region" aria-labelledby="q-'+ci+'-'+qi+'">'+
          '<div class="a">'+bibleReplace(item.a)+
            '<div class="src"><span class="lbl">Источник:</span><span>'+item.s+'</span></div>'+
          '</div>'+
        '</div>';
      sec.appendChild(wrap);
    });
    content.appendChild(sec);
  });

  document.getElementById('totalCount').textContent = totalQ + ' вопросов · ' + DATA.length + ' разделов';

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

  function clearMarks(el){
    el.querySelectorAll('mark').forEach(function(m){
      var t = document.createTextNode(m.textContent);
      m.parentNode.replaceChild(t, m);
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
    if(node.nodeType === 1 && node.tagName !== 'A' && node.tagName !== 'MARK'){
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
      document.querySelectorAll('.qa,.cluster').forEach(function(el){ el.classList.remove('hidden'); setOpenIfQa(el,false); });
      discIndex.classList.remove('hidden');
      noRes.style.display = 'none';
      updateCount();
      return;
    }
    discIndex.classList.add('hidden');
    var anyGlobal = false;
    document.querySelectorAll('.cluster').forEach(function(sec){
      var anyInSec = false;
      sec.querySelectorAll('.qa').forEach(function(w){
        var qt = norm(w.querySelector('.q').textContent);
        var at = norm(w.querySelector('.a').textContent);
        var hit = qt.indexOf(term) !== -1 || at.indexOf(term) !== -1;
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
  function setOpenIfQa(el, open){ if(el.classList.contains('qa')) setOpen(el, open); }

  updateCount();

  /* ---- Наверх ---- */
  var toTop = document.getElementById('toTop');
  window.addEventListener('scroll', function(){
    toTop.classList.toggle('show', window.scrollY > 600);
  }, {passive:true});
  toTop.addEventListener('click', function(){ window.scrollTo({top:0, behavior:'smooth'}); });

  /* ---- Открыть вопрос по якорю ---- */
  window.addEventListener('load', function(){
    if(location.hash){
      var el = document.querySelector(location.hash);
      if(el && el.classList.contains('qa')) setOpen(el, true);
    }
  });
})();
