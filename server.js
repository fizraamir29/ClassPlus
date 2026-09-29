'use strict';
// ClassPulse - real-time classroom engagement server. Zero dependencies. Run: node server.js
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const PORT = process.env.PORT || 3000, PUB = path.join(__dirname, 'public'), sessions = {};
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.json': 'application/json' };
const EMOJI = ['like', 'love', 'idea', 'smile', 'wow'];
const json = (res, o, s = 200) => { res.writeHead(s, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
const readBody = req => new Promise(r => { let d = ''; req.on('data', c => { d += c; if (d.length > 1e5) req.destroy(); }); req.on('end', () => { try { r(JSON.parse(d || '{}')); } catch { r({}); } }); });
const newCode = () => { let c; do { c = String(1000 + Math.floor(Math.random() * 9000)); } while (sessions[c]); return c; };
const studentClients = s => { const m = new Map(); for (const c of s.clients) if (c.role === 'student') m.set(c.sid, c); return [...m.values()]; };

function tally(s, teacher) {
  const q = s.q; if (!q) return [];
  if (q.type === 'text') return teacher ? Object.entries(s.answers).map(([id, t]) => [t, s.names[id] || 'Anon']) : [];
  if (q.type === 'cloud') {
    const m = {}; Object.values(s.answers).forEach(t => { const w = String(t).toLowerCase().trim(); if (w) m[w] = (m[w] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 40);
  }
  return q.options.map((_, i) => Object.values(s.answers).filter(a => a === i).length);
}
function archive(s) {
  const q = s.q; if (!q || !q.open) return;
  q.open = false;
  if (q.correct !== null) for (const [sid, a] of Object.entries(s.answers)) if (a === q.correct) {
    const frac = q.dur ? Math.max(0, 1 - (s.times[sid] - q.start) / (q.dur * 1000)) : 0.5;
    s.scores[sid] = (s.scores[sid] || 0) + 100 + Math.round(400 * frac);
  }
  s.history.push({ text: q.text, type: q.type, correct: q.correct, res: tally(s, true), answered: Object.keys(s.answers).length, confused: s.confused.size, joined: studentClients(s).length });
}
function view(s, role, sid) {
  const q = s.q, T = role === 'teacher', pace = { fast: 0, ok: 0, slow: 0 };
  Object.values(s.pace).forEach(p => pace[p]++);
  const v = {
    code: s.code, joined: studentClients(s).length, confused: s.confused.size, pace, reacts: s.reacts, n: s.n, name: s.names[sid], mod: s.mod,
    q: q ? { text: q.text, type: q.type, options: q.options, open: q.open } : null,
    left: q && q.open && q.dur ? Math.max(0, q.start + q.dur * 1000 - Date.now()) : null,
    board: Object.entries(s.scores).map(([id, pts]) => ({ name: s.names[id] || 'Anon', pts })).sort((a, b) => b.pts - a.pts).slice(0, 10),
    qa: s.qa.filter(x => T || x.ok || x.by === sid).map(x => ({ id: x.id, text: x.text, votes: x.votes.size, done: x.done, ok: x.ok, mine: x.votes.has(sid), own: x.by === sid }))
      .sort((a, b) => a.done - b.done || b.votes - a.votes)
  };
  if (T) {
    v.res = tally(s, true); v.answered = Object.keys(s.answers).length; v.correct = q ? q.correct : null; v.history = s.history;
    v.students = studentClients(s).map(c => ({ name: s.names[c.sid], answered: c.sid in s.answers, confused: s.confused.has(c.sid), pace: s.pace[c.sid] || null }));
  } else {
    v.mine = s.answers[sid] ?? null; v.confusedMe = s.confused.has(sid); v.paceMe = s.pace[sid] || null;
    if (q && !q.open) { v.res = tally(s, false); v.correct = q.correct; }
  }
  return v;
}
const push = s => { for (const c of s.clients) c.res.write(`data: ${JSON.stringify(view(s, c.role, c.sid))}\n\n`); };

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x'), p = url.pathname;
  if (p === '/healthz') return json(res, { ok: true });
  if (p === '/api/create' && req.method === 'POST') {
    const code = newCode();
    sessions[code] = { code, q: null, n: 0, answers: {}, times: {}, confused: new Set(), pace: {}, reacts: {}, history: [], clients: new Set(), qa: [], mod: false, scores: {}, names: {}, touched: Date.now() };
    return json(res, { code });
  }
  if (p === '/api/info') {
    const urls = [];
    for (const l of Object.values(os.networkInterfaces())) for (const i of l) if (i.family === 'IPv4' && !i.internal) urls.push(`http://${i.address}:${PORT}`);
    return json(res, { urls: urls.length ? urls : [`http://localhost:${PORT}`] });
  }
  if (p === '/api/events') {
    const s = sessions[url.searchParams.get('code')];
    if (!s) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    const role = url.searchParams.get('role') === 'teacher' ? 'teacher' : 'student';
    const client = { res, role, sid: (url.searchParams.get('sid') || Math.random().toString(36).slice(2)).slice(0, 24) };
    if (role === 'student') s.names[client.sid] = (url.searchParams.get('name') || '').trim().slice(0, 20) || s.names[client.sid] || 'Student ' + (Object.keys(s.names).length + 1);
    s.clients.add(client);
    const hb = setInterval(() => res.write(': ping\n\n'), 20000);
    req.on('close', () => { clearInterval(hb); s.clients.delete(client); if (!studentClients(s).some(c => c.sid === client.sid)) { s.confused.delete(client.sid); delete s.pace[client.sid]; } push(s); });
    return push(s);
  }
  if (p.startsWith('/api/') && req.method === 'POST') {
    const b = await readBody(req), s = sessions[b.code];
    if (!s) return json(res, { error: 'no session' }, 404);
    s.touched = Date.now();
    const q = s.q, qaItem = () => s.qa.find(x => x.id === b.id);
    switch (p) {
      case '/api/question': {
        archive(s); s.n++; s.answers = {}; s.times = {}; s.confused = new Set();
        const nq = s.q = { text: String(b.text || '').slice(0, 300), type: String(b.type || 'mcq'), options: (b.options || []).slice(0, 6).map(o => String(o).slice(0, 100)),
          correct: Number.isInteger(b.correct) ? b.correct : null, open: true, start: Date.now(), dur: +b.dur > 0 ? +b.dur : 0 };
        if (nq.dur) setTimeout(() => { if (s.q === nq && nq.open) { archive(s); push(s); } }, nq.dur * 1000 + 50);
        break; }
      case '/api/answer':
        if (q && q.open && (!q.dur || Date.now() < q.start + q.dur * 1000 + 300)) {
          if (q.type === 'cloud' || q.type === 'text') { const t = String(b.text || '').trim().slice(0, q.type === 'text' ? 200 : 30); if (t) { s.answers[b.sid] = t; s.times[b.sid] = Date.now(); } }
          else if (Number.isInteger(b.choice) && b.choice >= 0 && b.choice < q.options.length) { s.answers[b.sid] = b.choice; s.times[b.sid] = Date.now(); }
        }
        break;
      case '/api/confused': b.on ? s.confused.add(b.sid) : s.confused.delete(b.sid); break;
      case '/api/pace': if (['fast', 'ok', 'slow'].includes(b.value)) { s.pace[b.sid] === b.value ? delete s.pace[b.sid] : s.pace[b.sid] = b.value; } break;
      case '/api/react': if (EMOJI.includes(b.emoji)) s.reacts[b.emoji] = (s.reacts[b.emoji] || 0) + 1; break;
      case '/api/clear-react': s.reacts = {}; break;
      case '/api/close': archive(s); break;
      case '/api/ask': { const t = String(b.text || '').trim().slice(0, 200); if (t) s.qa.push({ id: Date.now() + Math.random(), text: t, votes: new Set([b.sid]), done: false, ok: !s.mod, by: b.sid }); break; }
      case '/api/vote': { const x = qaItem(); if (x) x.votes.has(b.sid) ? x.votes.delete(b.sid) : x.votes.add(b.sid); break; }
      case '/api/qa-done': { const x = qaItem(); if (x) x.done = !x.done; break; }
      case '/api/qa-approve': { const x = qaItem(); if (x) x.ok = true; break; }
      case '/api/qa-del': s.qa = s.qa.filter(x => x.id !== b.id); break;
      case '/api/qa-mod': s.mod = !!b.on; if (!s.mod) s.qa.forEach(x => x.ok = true); break;
      default: return json(res, { error: 'unknown' }, 404);
    }
    push(s);
    return json(res, { ok: true });
  }
  const file = p === '/' ? 'index.html' : p === '/teacher' ? 'teacher.html' : p === '/student' ? 'student.html' : p.slice(1);
  const fp = path.join(PUB, path.normalize(file));
  if (!fp.startsWith(PUB)) { res.writeHead(403); return res.end(); }
  fs.readFile(fp, (e, d) => { if (e) { res.writeHead(404); return res.end('Not found'); } res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'text/plain' }); res.end(d); });
}).listen(PORT, '0.0.0.0', () => {
  console.log(`\nClassPulse running on port ${PORT}\n  Teacher: http://localhost:${PORT}/teacher`);
  for (const l of Object.values(os.networkInterfaces())) for (const i of l) if (i.family === 'IPv4' && !i.internal) console.log(`  Students (same WiFi): http://${i.address}:${PORT}/student`);
});
setInterval(() => { for (const [c, s] of Object.entries(sessions)) if (!s.clients.size && Date.now() - s.touched > 6 * 3600e3) delete sessions[c]; }, 600000).unref();
