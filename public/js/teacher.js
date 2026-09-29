(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var icon = window.icon, icoHtml = window.icoHtml;
  var RX = { like: 'thumbs-up', love: 'heart', idea: 'lightbulb', smile: 'smile', wow: 'zap' };

  /* ---- helpers ---- */
  function rankRow(r, i) {
    var d = document.createElement('div'); d.className = 'lb';
    var w = document.createElement('span'); w.className = 'who';
    var k = document.createElement('span'); k.className = 'rank r' + (i + 1); k.textContent = i + 1;
    w.appendChild(k); w.appendChild(document.createTextNode(r.name)); d.appendChild(w);
    var b = document.createElement('b'); b.textContent = r.pts; d.appendChild(b);
    return d;
  }
  var el = function (t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x !== undefined) e.textContent = x; return e; };
  var STARS = ['1 star', '2 stars', '3 stars', '4 stars', '5 stars'];
  var TYPES = [
    ['mcq',    'list-checks',  'Multiple choice'],
    ['tf',     'check-square', 'True / False'],
    ['poll',   'bar-chart',    'Poll'],
    ['rating', 'star',         'Rating'],
    ['cloud',  'cloud',        'Word cloud'],
    ['text',   'pencil',       'Open text']
  ];
  var ICON = {}; TYPES.forEach(function (t) { ICON[t[0]] = t[1]; });

  var code = sessionStorage.getItem('code');
  var es = null, type = 'mcq', deadline = 0, cur = null, last = null, hideNames = false;
  var queue = [], demoMode = false;
  try { queue = JSON.parse(localStorage.getItem('cp-queue') || '[]'); } catch (e) { queue = []; }

  /* ---- toast ---- */
  function toast(m) {
    var t = $('toast'); t.textContent = m; t.classList.add('show');
    clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove('show'); }, 2400);
  }

  /* ---- API ---- */
  function api(p, b) {
    return fetch('/api/' + p, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ code: code }, b || {}))
    }).catch(function () { toast('Connection lost — check your server'); });
  }
  function saveQ() { try { localStorage.setItem('cp-queue', JSON.stringify(queue)); } catch (e) {} renderQueue(); }

  /* ---- Mobile sidebar ---- */
  var sidebar = $('sidebar'), overlay = $('sideOverlay');
  function openSidebar() {
    sidebar.classList.add('open');
    overlay.classList.add('show');
    document.body.style.overflow = 'hidden';
  }
  function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.classList.remove('show');
    document.body.style.overflow = '';
  }
  $('menuToggle').onclick = openSidebar;
  overlay.onclick = closeSidebar;

  /* ---- Start / Connect ---- */
  function start() {
    $('startBtn').disabled = true; $('startBtn').textContent = 'Starting…';
    fetch('/api/create', { method: 'POST' })
      .then(function (r) { return r.json(); })
      .then(function (r) { code = r.code; sessionStorage.setItem('code', code); demoMode = false; connect(); })
      .catch(function () { toast('Could not start session — is the server running?'); $('startBtn').disabled = false; $('startBtn').textContent = 'Start session'; });
  }
  function connect() {
    $('startbar').hidden = true; $('app').hidden = false;
    $('code').textContent = code; $('chipCode').textContent = code; $('chipCodeMob').textContent = code;
    fetch('/api/info').then(function (r) { return r.json(); }).then(function (i) {
      var local = /^(localhost|127\.|0\.0\.0\.0)/.test(location.hostname);
      $('url').textContent = (local ? i.urls[0] : location.origin) + '/student';
    });
    es = new EventSource('/api/events?code=' + code + '&role=teacher');
    es.onmessage = function (e) { last = JSON.parse(e.data); render(last); };
    es.onerror = function () { if (es.readyState === 2) { sessionStorage.removeItem('code'); location.reload(); } };
    if (demoMode) $('demoBanner').hidden = false;
  }
  function end() {
    demoSources.forEach(function (es) { try { es.close(); } catch (e) {} });
    if (es) es.close(); sessionStorage.removeItem('code'); location.reload();
  }

  /* ---- DEMO MODE ---- */
  var demoSources = [];
  function startDemo() {
    demoMode = true;
    fetch('/api/create', { method: 'POST' })
      .then(function (r) { return r.json(); })
      .then(function (r) {
        code = r.code; sessionStorage.setItem('code', code); connect();
        // simulate students joining
        var names = ['Ali', 'Sara', 'Ahmed', 'Zara', 'Omar', 'Hina'];
        var sids = names.map(function () { return Math.random().toString(36).slice(2, 10); });
        // join students with real EventSource so they stay online
        demoSources.forEach(function (es) { try { es.close(); } catch (e) {} });
        demoSources = [];
        names.forEach(function (name, i) {
          setTimeout(function () {
            var es = new EventSource('/api/events?code=' + code + '&role=student&sid=' + sids[i] + '&name=' + encodeURIComponent(name));
            demoSources.push(es);
          }, i * 200);
        });
        // after 1.5s send a demo question and simulate answers
        setTimeout(function () {
          api('question', {
            text: 'Which of the following is a renewable energy source?',
            type: 'mcq',
            options: ['Coal', 'Solar power', 'Natural gas', 'Petroleum'],
            correct: 1,
            dur: 0
          }).then(function () {
            show('live');
            toast('Demo active! 6 students connected & answering…');
            // simulate answers
            var choices = [1, 1, 2, 1, 0, 1]; // mostly correct
            choices.forEach(function (choice, i) {
              setTimeout(function () {
                fetch('/api/answer', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ code: code, sid: sids[i], choice: choice })
                });
              }, 400 + i * 300);
            });
            // simulate pace feedback
            setTimeout(function () { api('pace', { sid: sids[0], value: 'ok' }); }, 1200);
            setTimeout(function () { api('pace', { sid: sids[1], value: 'fast' }); }, 1400);
            // simulate confused student
            setTimeout(function () { api('confused', { sid: sids[4], on: true }); }, 1700);
            // simulate a student Q
            setTimeout(function () {
              api('ask', { sid: sids[2], text: 'Can you explain why solar is considered renewable?' });
            }, 2200);
          });
        }, 1600);
      })
      .catch(function () { toast('Demo needs the server running. Run: node server.js'); });
  }

  /* ---- Composer ---- */
  function buildTypes() {
    var w = $('types'); w.innerHTML = '';
    TYPES.forEach(function (t) {
      var b = el('button', 'ghost');
      b.appendChild(icon(t[1], 20));
      b.appendChild(el('span', '', t[2]));
      b.dataset.k = t[0];
      b.onclick = function () { setType(t[0]); };
      w.appendChild(b);
    });
  }
  function setType(t) {
    type = t;
    Array.prototype.forEach.call(document.querySelectorAll('#types button'), function (b) {
      b.classList.toggle('on', b.dataset.k === t);
    });
    var o = $('opts'); o.innerHTML = '';
    if (t === 'rating' || t === 'cloud' || t === 'text') {
      var desc = t === 'rating' ? 'Students rate 1–5 stars.' :
                 t === 'cloud'  ? 'Students type a short word or phrase; a live word cloud appears.' :
                                  'Students type a short written answer.';
      o.appendChild(el('p', 'mute', desc)); return;
    }
    var defs = t === 'mcq' ? ['', '', '', ''] : t === 'tf' ? ['True', 'False'] : ['Got it', 'Somewhat', 'Lost me'];
    defs.forEach(function (d, i) {
      var r = el('div', 'opt');
      if (t !== 'poll') {
        var rd = el('input'); rd.type = 'radio'; rd.name = 'c'; rd.checked = (i === 0); rd.title = 'Mark as correct answer'; r.appendChild(rd);
      }
      var inp = el('input'); inp.type = 'text'; inp.value = d; inp.placeholder = 'Option ' + (i + 1); inp.readOnly = (t === 'tf');
      r.appendChild(inp); o.appendChild(r);
    });
    if (t !== 'poll') o.appendChild(el('p', 'mute', 'Click the radio button next to the correct answer.'));
  }
  function gather() {
    var text = $('qtext').value.trim();
    if (!text) { toast('Type a question first'); return null; }
    var options = [], correct = null;
    if (type === 'rating') options = STARS.slice();
    else if (type === 'mcq' || type === 'tf' || type === 'poll') {
      Array.prototype.forEach.call(document.querySelectorAll('#opts .opt'), function (r) {
        var v = r.querySelector('input[type=text]').value.trim(); if (!v) return;
        var rd = r.querySelector('input[type=radio]'); if (rd && rd.checked) correct = options.length;
        options.push(v);
      });
      if (options.length < 2) { toast('Add at least 2 options'); return null; }
    }
    return { text: text, type: type, options: options, correct: correct, dur: +$('dur').value };
  }
  function send(item, idx) {
    var q = item || gather(); if (!q) return;
    api('question', q).then(function () {
      toast('Question sent to class ✓'); show('live');
      if (item) { queue.splice(idx, 1); saveQ(); } else { $('qtext').value = ''; setType(type); }
    });
  }
  function exitTicket() {
    var items = [
      { text: "How well did you understand today's lesson?", type: 'poll', options: ['Totally got it', 'Pretty well', 'Not very well', 'Not at all'], correct: null, dur: 0 },
      { text: "What did you learn in today's class?", type: 'text', options: [], correct: null, dur: 0 },
      { text: 'What was the most confusing part today?', type: 'text', options: [], correct: null, dur: 0 }
    ];
    api('question', items[0]).then(function () {
      queue = items.slice(1).concat(queue); saveQ();
      toast('Exit ticket started · 2 more in queue'); show('live');
    });
  }
  function renderQueue() {
    var w = $('queue'); w.innerHTML = '';
    queue.forEach(function (q, i) {
      var r = el('div', 'qitem');
      var sp = el('span');
      sp.appendChild(icon(ICON[q.type] || 'list', 14));
      sp.appendChild(document.createTextNode(' ' + q.text));
      r.appendChild(sp);
      var s = el('button', 'sm', 'Send now'); s.onclick = function () { send(q, i); };
      var d = el('button', 'ghost sm'); d.appendChild(icon('trash', 14)); d.title = 'Remove';
      d.onclick = function () { queue.splice(i, 1); saveQ(); };
      r.appendChild(s); r.appendChild(d); w.appendChild(r);
    });
    $('qempty').hidden = queue.length > 0;
    $('qcount').textContent = queue.length ? '(' + queue.length + ')' : '';
    $('nextBtn').hidden = !queue.length;
    $('qb').hidden = !queue.length; $('qb').textContent = queue.length;
  }

  /* ---- Results renderer ---- */
  function drawResults(q, v) {
    var box = $('res'); box.innerHTML = '';
    if (q.type === 'cloud') {
      var cw = el('div', 'cloud'); var mx = v.res.length ? v.res[0][1] : 1;
      if (!v.res.length) cw.appendChild(el('span', 'mute', 'Waiting for words…'));
      v.res.forEach(function (r, i) {
        var s = el('span', '', r[0]);
        s.style.fontSize = (16 + r[1] / mx * 36) + 'px';
        s.style.color = 'var(--c' + (i % 5 + 1) + ')';
        cw.appendChild(s);
      });
      box.appendChild(cw); return;
    }
    if (q.type === 'text') {
      var hb = el('button', 'ghost sm', hideNames ? 'Show names' : 'Hide names');
      hb.onclick = function () { hideNames = !hideNames; render(last); }; box.appendChild(hb);
      if (!v.res.length) box.appendChild(el('p', 'mute', 'Waiting for answers…'));
      v.res.forEach(function (r) {
        var d = el('div', 'resp');
        d.appendChild(el('span', '', r[0]));
        d.appendChild(el('small', '', hideNames ? '' : r[1]));
        box.appendChild(d);
      }); return;
    }
    var tot = v.res.reduce(function (a, c) { return a + c; }, 0), t = tot || 1;
    q.options.forEach(function (o, i) {
      var pct = Math.round(v.res[i] / t * 100), isC = (v.correct === i);
      var row = el('div', 'bar-row'), lab = el('div', 'bar-label');
      var ls = el('span', '', o);
      if (isC && !q.open) { ls.appendChild(icon('check', 14)); }
      lab.appendChild(ls);
      lab.appendChild(el('b', '', v.res[i] + ' · ' + pct + '%'));
      var tr = el('div', 'track'), f = el('div', 'fill' + (!q.open && v.correct !== null ? (isC ? ' right' : ' wrong') : ''));
      f.style.width = pct + '%'; tr.appendChild(f);
      row.appendChild(lab); row.appendChild(tr); box.appendChild(row);
    });
    if (q.type === 'rating' && tot) {
      var avg = v.res.reduce(function (a, c, i) { return a + c * (i + 1); }, 0) / tot;
      box.appendChild(el('p', 'mute', 'Average: ' + avg.toFixed(1) + ' / 5'));
    }
  }
  function statusTag(s) { return s.confused ? ['Confused', 'warn'] : s.answered ? ['Answered', 'ok'] : ['Waiting', '']; }

  function render(v) {
    /* stats */
    $('sOnline').textContent = v.joined; $('sbOnline').textContent = v.joined;
    $('sConf').textContent = v.confused;
    $('meter').style.width = (v.joined ? v.confused / v.joined * 100 : 0) + '%';
    $('sPace').textContent = v.pace.fast + ' fast · ' + v.pace.slow + ' slow · ' + (v.pace.ok || 0) + ' ok';
    var rs = Object.keys(v.reacts).map(function (k) { return icoHtml(RX[k] || 'smile', 14) + ' ' + v.reacts[k]; }).join('&nbsp;&nbsp;');
    $('sReact').innerHTML = rs || '—';

    /* live results */
    var q = v.q; cur = q; deadline = v.left !== null ? Date.now() + v.left : 0;
    $('status').hidden = !q; $('closeBtn').hidden = !(q && q.open);
    if (q) {
      $('qt').textContent = q.text;
      $('status').textContent = q.open ? 'LIVE' : 'CLOSED';
      $('status').className = 'pill ' + (q.open ? 'live' : 'closed');
      $('sAns').textContent = v.answered + '/' + v.joined;
      $('answered').textContent = v.answered + ' of ' + v.joined + ' answered';
      drawResults(q, v);
    }

    /* students table */
    var st = $('stu'); st.innerHTML = '';
    v.students.slice()
      .sort(function (a, b) { return (b.confused - a.confused) || (a.answered - b.answered); })
      .forEach(function (s) {
        var tr = el('tr'), c = statusTag(s), td = el('td');
        td.appendChild(el('span', 'tag ' + c[1], c[0]));
        tr.appendChild(el('td', '', s.name || '—')); tr.appendChild(td);
        tr.appendChild(el('td', '', s.pace === 'fast' ? '⏩ Too fast' : s.pace === 'slow' ? '⏪ Too slow' : s.pace === 'ok' ? '✓ Just right' : ''));
        st.appendChild(tr);
      });
    $('stuEmpty').hidden = v.students.length > 0;

    /* Q&A */
    $('mod').checked = v.mod;
    var pend = v.qa.filter(function (x) { return !x.done; }).length;
    $('qn').textContent = pend; $('qn').hidden = !pend;
    var ql = $('qalist'); ql.innerHTML = '';
    $('qaEmpty').hidden = v.qa.length > 0;
    v.qa.forEach(function (x) {
      var d = el('div', 'qa' + (x.done ? ' done' : ''));
      var vb = el('span', 'votes');
      vb.appendChild(icon('chevron-up', 15));
      vb.appendChild(document.createTextNode(' ' + x.votes));
      d.appendChild(vb);
      d.appendChild(el('span', 't', x.text + (x.ok ? '' : '  ⏳ pending review')));
      if (!x.ok) { var a = el('button', 'sm', 'Approve'); a.onclick = function () { api('qa-approve', { id: x.id }); }; d.appendChild(a); }
      var m = el('button', 'ghost sm', x.done ? 'Reopen' : 'Mark answered');
      m.onclick = function () { api('qa-done', { id: x.id }); }; d.appendChild(m);
      var rm = el('button', 'ghost sm'); rm.appendChild(icon('trash', 14)); rm.title = 'Delete';
      rm.onclick = function () { api('qa-del', { id: x.id }); }; d.appendChild(rm);
      ql.appendChild(d);
    });

    /* leaderboard */
    var lb = $('lb'); lb.innerHTML = '';
    if (!v.board.length) lb.appendChild(el('p', 'mute', 'Points appear after you close a question with a correct answer.'));
    v.board.forEach(function (r, i) { lb.appendChild(rankRow(r, i)); });

    /* report */
    var h = $('hist'); h.innerHTML = '';
    $('histEmpty').hidden = v.history.length > 0;
    v.history.forEach(function (x, i) {
      var tr = el('tr');
      var c = x.correct === null ? '—' : x.answered ? Math.round(x.res[x.correct] / x.answered * 100) + '%' : '0%';
      [i + 1, x.text, x.answered + '/' + x.joined, c, x.confused].forEach(function (txt) { tr.appendChild(el('td', '', txt)); });
      h.appendChild(tr);
    });
  }

  /* ---- CSV Export ---- */
  function csv() {
    if (!last) return;
    var q = function (s) { return '"' + String(s).replace(/"/g, '""') + '"'; };
    var rows = [['#', 'Question', 'Type', 'Answered', 'Online', 'Correct %', 'Confused']];
    last.history.forEach(function (h, i) {
      rows.push([i + 1, h.text, h.type, h.answered, h.joined,
        h.correct === null ? '' : (h.answered ? Math.round(h.res[h.correct] / h.answered * 100) : 0), h.confused]);
    });
    rows.push([]); rows.push(['Student', 'Points']);
    last.board.forEach(function (b) { rows.push([b.name, b.pts]); });
    var a = el('a');
    a.href = URL.createObjectURL(new Blob([rows.map(function (r) { return r.map(q).join(','); }).join('\n')], { type: 'text/csv' }));
    a.download = 'classpulse-' + code + '.csv'; a.click();
  }

  /* ---- View navigation ---- */
  var VIEWS  = ['home', 'ask', 'live', 'queue', 'students', 'qa', 'board', 'report'];
  var TITLES = { home: 'Overview', ask: 'Ask a question', live: 'Live results', queue: 'Question queue', students: 'Students', qa: 'Q&A', board: 'Leaderboard', report: 'Report' };
  function show(v) {
    Array.prototype.forEach.call(document.querySelectorAll('#nav button'), function (x) { x.classList.toggle('on', x.dataset.v === v); });
    VIEWS.forEach(function (n) { $('v-' + n).hidden = n !== v; });
    $('title').textContent = TITLES[v];
    window.scrollTo(0, 0);
    closeSidebar();
  }
  Array.prototype.forEach.call(document.querySelectorAll('#nav button'), function (b) {
    b.onclick = function () { show(b.dataset.v); };
  });

  /* ---- Wire up all buttons ---- */
  $('startBtn').onclick = start;
  $('demoBtn').onclick = startDemo;
  $('endBtn').onclick = end;
  $('sendBtn').onclick = function () { send(); };
  $('queueBtn').onclick = function () {
    var q = gather(); if (q) { queue.push(q); saveQ(); $('qtext').value = ''; setType(type); toast('Added to queue'); }
  };
  $('exitBtn').onclick = exitTicket;
  $('closeBtn').onclick = function () { api('close'); };
  $('nextBtn').onclick = function () { if (queue.length) send(queue[0], 0); };
  $('csvBtn').onclick = csv;
  $('mod').onchange = function () { api('qa-mod', { on: $('mod').checked }); };
  $('clrReact').onclick = function (e) { e.preventDefault(); api('clear-react'); toast('Reactions cleared'); };
  $('goAsk').onclick = $('qa1').onclick = function () { show('ask'); };
  $('qa2').onclick = exitTicket;
  $('qa3').onclick = function () { show('live'); };

  /* ---- Timer countdown ---- */
  setInterval(function () {
    $('timer').innerHTML = (deadline && cur && cur.open)
      ? icoHtml('clock', 16) + ' ' + Math.max(0, Math.ceil((deadline - Date.now()) / 1000)) + 's'
      : '';
  }, 250);

  /* ---- Boot ---- */
  buildTypes(); setType('mcq'); renderQueue();
  if (code) connect();
})();
