/* PuntuaJocs — jocs de taula, partides i estadístiques. Sense dependències; dades a localStorage. */
(() => {
'use strict';

/* ====================== Constants ====================== */
const KEY = 'puntuajocs.v1';
const COLORS = ['#e4572e', '#f3a712', '#29a37a', '#2e86ab', '#6a4c93', '#d6336c', '#5c7080', '#8a5a44'];
const TYPES = {
  rounds:     { n: 'Rondes (suma de punts)',      d: "A cada ronda s'apunten punts i se sumen. Ex.: Uno, Rummy, jocs de cartes." },
  categories: { n: 'Categories (full de puntuació)', d: 'Cada jugador omple una taula amb categories fixes. Ex.: Catan, 7 Wonders, Yahtzee.' },
  single:     { n: 'Puntuació final',             d: 'Una sola xifra per jugador al final. Ex.: Carcassonne, Dixit.' },
  rank:       { n: 'Només classificació',         d: 'Indiques la posició de cada jugador. Ex.: Parxís, curses.' },
  winlose:    { n: 'Guanya / perd',               d: 'Un o més guanyadors, sense punts. Ex.: Escacs, Risk.' },
  coop:       { n: 'Cooperatiu',                  d: 'Tots junts guanyen o perden. Ex.: Pandèmia, Hanabi.' }
};
const GRID = t => t === 'rounds' || t === 'categories' || t === 'single';
const PERIODS = { all: 'Tot el temps', year: 'Aquest any', month: 'Aquest mes', '30': 'Últims 30 dies' };

/* ====================== Dades ====================== */
let S = load();
function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && d.v === 1) return d;
  } catch (e) { /* res */ }
  return { v: 1, games: [], players: [], matches: [], settings: {} };
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); }
  catch (e) { toast("⚠️ No s'ha pogut desar. Fes una còpia de seguretat!"); }
}
const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
const G = id => S.games.find(g => g.id === id);
const P = id => S.players.find(p => p.id === id);
const M = id => S.matches.find(m => m.id === id);
const pname = p => (p.id && P(p.id)) ? P(p.id).name : p.name;
const pcolor = p => (p.id && P(p.id)) ? P(p.id).color : (p.color || '#8a96a0');

/* ====================== Utilitats ====================== */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => n == null || isNaN(n) ? '–' : String(Math.round(n * 10) / 10).replace('.', ',');
const pct = (a, b) => b ? Math.round(a * 100 / b) + '%' : '–';
const fdate = iso => new Date(iso).toLocaleDateString('ca-ES', { day: 'numeric', month: 'short', year: 'numeric' });
const fdur = min => !min ? '–' : (min >= 60 ? Math.floor(min / 60) + ' h ' + (Math.round(min % 60) ? Math.round(min % 60) + ' min' : '') : Math.round(min) + ' min');
const av = (name, color, big) => `<span class="av${big ? ' big' : ''}" style="background:${esc(color)}">${esc((name || '?').trim().charAt(0).toUpperCase())}</span>`;
let toastT;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2400);
}
function sheet(html) {
  closeSheet();
  const bg = document.createElement('div');
  bg.className = 'sheet-bg';
  bg.innerHTML = `<div class="sheet" role="dialog">${html}</div>`;
  bg.addEventListener('click', e => { if (e.target === bg) closeSheet(); });
  document.body.appendChild(bg);
  document.body.classList.add('noscroll');
  return bg.firstChild;
}
function closeSheet() {
  const b = $('.sheet-bg'); if (b) b.remove();
  document.body.classList.remove('noscroll');
}
const go = h => { location.hash = h; };

/* ====================== Resultats d'una partida ====================== */
const rnd = n => Math.round(n * 10000) / 10000;
function total(m, i) { return rnd(m.grid.reduce((a, r) => a + (Number(r[i]) || 0), 0)); }
function assignRank(items, high) {
  const s = items.slice().sort((a, b) => high ? b.v - a.v : a.v - b.v);
  let r = 0;
  s.forEach((x, k) => { if (k === 0 || x.v !== s[k - 1].v) r = k + 1; x.r.rank = r; });
}
/* Retorna, per a cada jugador de la partida: {i, gone, score, rank, win} */
function result(m) {
  const g = G(m.gameId) || { type: 'single', highWins: true };
  const res = m.players.map((p, i) => ({ i, gone: !!p.gone, score: null, rank: null, win: false }));
  const act = res.filter(r => !r.gone);
  if (GRID(g.type)) {
    res.forEach(r => r.score = total(m, r.i));
    assignRank(act.map(r => ({ r, v: r.score })), g.highWins !== false);
    act.forEach(r => r.win = r.rank === 1);
  } else if (g.type === 'rank') {
    act.forEach(r => { r.rank = m.ranks[r.i]; r.score = r.rank; r.win = r.rank === 1; });
  } else if (g.type === 'winlose') {
    act.forEach(r => { r.win = !!m.wins[r.i]; r.rank = r.win ? 1 : 2; });
  } else if (g.type === 'coop') {
    act.forEach(r => { r.win = m.coopWin === true; r.rank = m.coopWin == null ? null : (r.win ? 1 : 2); });
  }
  return res;
}
const winners = m => result(m).filter(r => r.win).map(r => pname(m.players[r.i]));

function assignRoles(m, g) {
  if (g && g.roles && g.roles.length) m.players.forEach((p, i) => { p.role = g.roles[i]; });
}
function newMatch(gid, plist, kind, stats) {
  const g = G(gid);
  const m = { id: uid(), gameId: gid, date: new Date().toISOString(), started: Date.now(), players: plist,
    status: 'live', kind, stats, notes: '', minutes: null };
  const n = plist.length;
  assignRoles(m, g);
  if (g.type === 'rounds' || g.type === 'single') m.grid = [Array(n).fill(null)];
  else if (g.type === 'categories') { m.catNames = g.cats.slice(); m.grid = g.cats.map(() => Array(n).fill(null)); }
  else if (g.type === 'rank') m.ranks = Array(n).fill(null);
  else if (g.type === 'winlose') m.wins = Array(n).fill(false);
  else if (g.type === 'coop') m.coopWin = null;
  return m;
}
function addPlayerToMatch(m, pl) {
  m.players.push(pl);
  assignRoles(m, G(m.gameId));
  if (m.grid) m.grid.forEach(r => r.push(null));
  if (m.ranks) m.ranks.push(null);
  if (m.wins) m.wins.push(false);
}
function removePlayerFromMatch(m, i) {
  m.players.splice(i, 1);
  assignRoles(m, G(m.gameId));
  if (m.grid) m.grid.forEach(r => r.splice(i, 1));
  if (m.ranks) m.ranks.splice(i, 1);
  if (m.wins) m.wins.splice(i, 1);
}

/* ====================== Estadístiques ====================== */
const st = { tab: 'gen', game: '', period: 'all', n: '', player: '', sgame: '' };
function inPeriod(m, p) {
  const d = new Date(m.date), now = new Date();
  if (p === 'year') return d.getFullYear() === now.getFullYear();
  if (p === 'month') return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  if (p === '30') return now - d <= 30 * 864e5;
  return true;
}
function statMatches(f = {}) {
  return S.matches.filter(m => m.status === 'done' && m.stats !== false && G(m.gameId)
    && (!f.game || m.gameId === f.game) && inPeriod(m, f.period || 'all')
    && (!f.n || m.players.length === Number(f.n)));
}
function pStats(pid, ms) {
  const o = { games: 0, wins: 0, gone: 0, rkS: 0, rkN: 0, seq: [], cur: 0, max: 0, byGame: {}, h2h: {} };
  ms.slice().sort((a, b) => a.date < b.date ? -1 : 1).forEach(m => {
    const idx = m.players.findIndex(p => p.id === pid); if (idx < 0) return;
    const g = G(m.gameId), rs = result(m), x = rs[idx];
    o.games++; if (x.gone) o.gone++; if (x.win) o.wins++;
    o.seq.push(x.gone ? 'A' : x.win ? 'W' : 'L');
    if (x.win) { o.cur++; o.max = Math.max(o.max, o.cur); } else o.cur = 0;
    if (x.rank != null && !x.gone && g.type !== 'coop') { o.rkS += x.rank; o.rkN++; }
    const gs = o.byGame[m.gameId] || (o.byGame[m.gameId] = { games: 0, wins: 0, scS: 0, scN: 0, best: null });
    gs.games++; if (x.win) gs.wins++;
    if (GRID(g.type) && !x.gone) {
      gs.scS += x.score; gs.scN++;
      gs.best = gs.best == null ? x.score : (g.highWins !== false ? Math.max : Math.min)(gs.best, x.score);
    }
    if (g.type !== 'coop') rs.forEach((y, j) => {
      const op = m.players[j]; if (j === idx || !op.id) return;
      const h = o.h2h[op.id] || (o.h2h[op.id] = { g: 0, w: 0, l: 0, t: 0 });
      const a = x.gone ? 1e9 : (x.rank ?? 1e8), b = y.gone ? 1e9 : (y.rank ?? 1e8);
      h.g++; if (a < b) h.w++; else if (a > b) h.l++; else h.t++;
    });
  });
  return o;
}
function gStats(gid, ms) {
  const g = G(gid), list = ms.filter(m => m.gameId === gid);
  const hi = g.highWins !== false;
  const better = (a, b) => hi ? a > b : a < b;
  const o = { g, games: list.length, np: 0, min: 0, minN: 0, rec: null, wS: 0, wN: 0, aS: 0, aN: 0, pl: {}, byN: {}, byRole: {}, byEnd: {} };
  list.forEach(m => {
    const rs = result(m), n = m.players.length;
    o.np += n; if (m.minutes) { o.min += m.minutes; o.minN++; }
    if (m.ending) o.byEnd[m.ending] = (o.byEnd[m.ending] || 0) + 1;
    const bn = o.byN[n] || (o.byN[n] = { games: 0, wS: 0, wN: 0 }); bn.games++;
    rs.forEach((x, i) => {
      const p = m.players[i], key = p.id || ('g:' + p.name);
      const e = o.pl[key] || (o.pl[key] = { name: pname(p), color: pcolor(p), games: 0, wins: 0, scS: 0, scN: 0, best: null });
      e.games++; if (x.win) e.wins++;
      if (p.role) { const br = o.byRole[p.role] || (o.byRole[p.role] = { games: 0, wins: 0, sS: 0, sN: 0 }); br.games++; if (x.win) br.wins++; if (GRID(g.type) && !x.gone) { br.sS += x.score; br.sN++; } }
      if (GRID(g.type) && !x.gone) {
        const v = x.score;
        e.scS += v; e.scN++; if (e.best == null || better(v, e.best)) e.best = v;
        o.aS += v; o.aN++;
        if (x.win) { o.wS += v; o.wN++; bn.wS += v; bn.wN++; }
        if (!o.rec || better(v, o.rec.v)) o.rec = { v, name: pname(p), date: m.date, id: m.id };
      }
    });
  });
  return o;
}
const bar = (label, val, max, text, color) =>
  `<div class="bar"${color ? ` style="--c:${esc(color)}"` : ''}><div class="l">${esc(label)}</div><div class="b"><i style="width:${max ? Math.max(3, val * 100 / max) : 0}%"></i></div><div class="v">${text}</div></div>`;

function playerStatsHTML(pid, f) {
  const p = P(pid); if (!p) return '';
  const ms = statMatches(f), s = pStats(pid, ms);
  if (!s.games) return `<div class="empty">Encara no hi ha partides amb estadístiques d'aquest jugador${f && (f.game || f.period !== 'all' || f.n) ? ' amb aquests filtres' : ''}.</div>`;
  let h = `<div class="stats">
    <div class="stat"><b>${s.games}</b><span>partides</span></div>
    <div class="stat"><b>${s.wins}</b><span>victòries</span></div>
    <div class="stat"><b>${pct(s.wins, s.games)}</b><span>% victòries</span></div>
    <div class="stat"><b>${fmt(s.rkN ? s.rkS / s.rkN : null)}</b><span>posició mitjana</span></div>
    <div class="stat"><b>${s.cur}</b><span>ratxa actual</span></div>
    <div class="stat"><b>${s.max}</b><span>millor ratxa</span></div></div>`;
  if (s.gone) h += `<p class="hint">Ha abandonat ${s.gone} ${s.gone === 1 ? 'partida' : 'partides'} (comptades com a derrota).</p>`;
  h += `<h3>Últimes partides</h3><div class="hist">${s.seq.slice(-15).map(x => `<i class="${x}">${x === 'W' ? 'V' : x === 'L' ? 'D' : 'A'}</i>`).join('')}</div>
    <p class="hint">V = victòria · D = derrota · A = abandonament</p>`;
  const gids = Object.keys(s.byGame).sort((a, b) => s.byGame[b].games - s.byGame[a].games);
  h += `<h2>Per joc</h2><div class="scroll"><table class="tbl"><tr><th>Joc</th><th>Part.</th><th>Vict.</th><th>%</th><th>Mitjana</th><th>Millor</th></tr>`
    + gids.map(id => { const x = s.byGame[id], g = G(id);
      return `<tr><td>${esc(g.emoji)} ${esc(g.name)}</td><td>${x.games}</td><td>${x.wins}</td><td>${pct(x.wins, x.games)}</td><td>${fmt(x.scN ? x.scS / x.scN : null)}</td><td>${fmt(x.best)}</td></tr>`; }).join('')
    + `</table></div>`;
  const hs = Object.keys(s.h2h).filter(id => P(id));
  if (hs.length) h += `<h2>Cara a cara</h2><div class="scroll"><table class="tbl"><tr><th>Rival</th><th>Part.</th><th>Guanya</th><th>Perd</th><th>Empat</th></tr>`
    + hs.sort((a, b) => s.h2h[b].g - s.h2h[a].g).map(id => { const x = s.h2h[id];
      return `<tr><td>${esc(P(id).name)}</td><td>${x.g}</td><td>${x.w}</td><td>${x.l}</td><td>${x.t}</td></tr>`; }).join('')
    + `</table></div><p class="hint">Es compara la posició final a les partides que heu jugat junts.</p>`;
  return h;
}
function gameStatsHTML(gid, f) {
  const ms = statMatches(Object.assign({}, f, { game: gid })), s = gStats(gid, ms), g = s.g;
  if (!s.games) return `<div class="empty">Encara no hi ha partides finalitzades amb estadístiques d'aquest joc.</div>`;
  let h = `<div class="stats">
    <div class="stat"><b>${s.games}</b><span>partides</span></div>
    <div class="stat"><b>${fmt(s.np / s.games)}</b><span>jugadors de mitjana</span></div>
    <div class="stat"><b>${s.minN ? fdur(s.min / s.minN) : '–'}</b><span>durada mitjana</span></div></div>`;
  if (GRID(g.type) && s.rec) {
    h += `<div class="card plain">🏅 <b>Rècord${g.highWins === false ? ' (mínim)' : ''}:</b> ${fmt(s.rec.v)} punts — ${esc(s.rec.name)} <span class="s">(${fdate(s.rec.date)})</span><br>
      <span class="s">Mitjana del guanyador: ${fmt(s.wN ? s.wS / s.wN : null)} · Mitjana de tots: ${fmt(s.aN ? s.aS / s.aN : null)}</span></div>`;
  }
  const pl = Object.values(s.pl).sort((a, b) => b.wins - a.wins || (b.wins / b.games) - (a.wins / a.games));
  h += `<h2>Classificació</h2><div class="scroll"><table class="tbl"><tr><th>Jugador</th><th>Part.</th><th>Vict.</th><th>%</th>${GRID(g.type) ? '<th>Mitjana</th><th>Millor</th>' : ''}</tr>`
    + pl.map(x => `<tr><td>${esc(x.name)}</td><td>${x.games}</td><td>${x.wins}</td><td>${pct(x.wins, x.games)}</td>${GRID(g.type) ? `<td>${fmt(x.scN ? x.scS / x.scN : null)}</td><td>${fmt(x.best)}</td>` : ''}</tr>`).join('')
    + `</table></div>`;
  const rl = Object.keys(s.byRole);
  if (rl.length) h += `<h2>Per bàndol</h2><div class="scroll"><table class="tbl"><tr><th>Bàndol</th><th>Part.</th><th>Vict.</th><th>%</th>${GRID(g.type) ? '<th>Mitjana</th>' : ''}</tr>`
    + rl.map(k => { const x = s.byRole[k]; return `<tr><td>${esc(k)}</td><td>${x.games}</td><td>${x.wins}</td><td>${pct(x.wins, x.games)}</td>${GRID(g.type) ? `<td>${fmt(x.sN ? x.sS / x.sN : null)}</td>` : ''}</tr>`; }).join('') + `</table></div>`;
  const el = Object.keys(s.byEnd);
  if (el.length) h += `<h2>Com han acabat</h2>` + el.sort((a, b) => s.byEnd[b] - s.byEnd[a]).map(k => bar(k, s.byEnd[k], s.games, s.byEnd[k], g.color)).join('');
  const ns = Object.keys(s.byN).sort((a, b) => a - b);
  if (ns.length > 1 || GRID(g.type)) h += `<h2>Per nombre de jugadors</h2><div class="scroll"><table class="tbl"><tr><th>Jugadors</th><th>Partides</th>${GRID(g.type) ? '<th>Punts guanyador</th>' : ''}</tr>`
    + ns.map(n => `<tr><td>${n}</td><td>${s.byN[n].games}</td>${GRID(g.type) ? `<td>${fmt(s.byN[n].wN ? s.byN[n].wS / s.byN[n].wN : null)}</td>` : ''}</tr>`).join('') + `</table></div>`;
  return h;
}
function generalStatsHTML(f) {
  const ms = statMatches(f);
  if (!ms.length) return `<div class="empty"><div class="big">📊</div>Encara no hi ha partides finalitzades amb estadístiques${f.game || f.period !== 'all' || f.n ? ' amb aquests filtres' : ''}.</div>`;
  const mins = ms.reduce((a, m) => a + (m.minutes || 0), 0);
  const gc = {}; ms.forEach(m => gc[m.gameId] = (gc[m.gameId] || 0) + 1);
  const gl = Object.keys(gc).sort((a, b) => gc[b] - gc[a]).slice(0, 8);
  const pls = S.players.map(p => ({ p, s: pStats(p.id, ms) })).filter(x => x.s.games).sort((a, b) => b.s.wins - a.s.wins || (b.s.wins / b.s.games) - (a.s.wins / a.s.games));
  const months = []; const now = new Date();
  for (let i = 5; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); months.push({ y: d.getFullYear(), m: d.getMonth(), n: 0, l: d.toLocaleDateString('ca-ES', { month: 'short' }) }); }
  ms.forEach(m => { const d = new Date(m.date); const x = months.find(z => z.y === d.getFullYear() && z.m === d.getMonth()); if (x) x.n++; });
  const mx = Math.max(1, ...months.map(x => x.n));
  return `<div class="stats">
    <div class="stat"><b>${ms.length}</b><span>partides</span></div>
    <div class="stat"><b>${Object.keys(gc).length}</b><span>jocs diferents</span></div>
    <div class="stat"><b>${mins ? fdur(mins) : '–'}</b><span>temps jugat</span></div></div>
  <h2>Jocs més jugats</h2>${gl.map(id => bar(G(id).emoji + ' ' + G(id).name, gc[id], gc[gl[0]], gc[id], G(id).color)).join('')}
  <h2>Rànquing de jugadors</h2><div class="scroll"><table class="tbl"><tr><th>Jugador</th><th>Part.</th><th>Vict.</th><th>%</th><th>Ratxa</th></tr>
    ${pls.map(x => `<tr><td>${esc(x.p.name)}</td><td>${x.s.games}</td><td>${x.s.wins}</td><td>${pct(x.s.wins, x.s.games)}</td><td>${x.s.max}</td></tr>`).join('')}</table></div>
  <h2>Activitat (6 mesos)</h2>${months.map(x => bar(x.l, x.n, mx, x.n)).join('')}`;
}

/* ====================== Disseny de pàgina ====================== */
function page(title, body, o = {}) {
  return `<header class="top">${o.back ? `<a class="ib" href="${o.back}" aria-label="Enrere">‹</a>` : ''}<h1>${title}</h1><div class="acts">${o.acts || ''}</div></header><main>${body}</main>`;
}
function renderNav(sec) {
  const items = [['inici', '🏠', 'Inici', '#/'], ['jocs', '🎲', 'Jocs', '#/jocs'], ['jugadors', '👥', 'Jugadors', '#/jugadors'],
    ['historial', '📜', 'Historial', '#/historial'], ['stats', '📊', 'Estadístiques', '#/stats']];
  $('#nav').innerHTML = items.map(i => `<a href="${i[3]}" class="${i[0] === sec ? 'on' : ''}"><span>${i[1]}</span>${i[2]}</a>`).join('');
}
const notFound = () => page('No trobat', `<div class="empty"><div class="big">🤷</div>Aquesta pàgina ja no existeix.<div class="btns"><a class="btn" href="#/">Torna a l'inici</a></div></div>`, { back: '#/' });
const matchBadges = m => (m.status === 'live' ? '<span class="badge live">En curs</span>' : '')
  + (m.status === 'abandoned' ? '<span class="badge gone">Aturada</span>' : '')
  + (m.kind === 'prova' ? '<span class="badge prova">Prova</span>' : '')
  + (m.stats === false && m.status !== 'abandoned' ? '<span class="badge nostat">Sense estadístiques</span>' : '')
  + (m.players.some(p => p.gone) ? '<span class="badge gone">Abandonament</span>' : '');
function matchCard(m) {
  const g = G(m.gameId); if (!g) return '';
  const rs = result(m);
  const ps = m.players.map((p, i) => `${rs[i].win && m.status === 'done' ? '🏆 ' : ''}<span${p.gone ? ' style="text-decoration:line-through"' : ''}>${esc(pname(p))}</span>`).join(', ');
  return `<a class="card" style="--c:${esc(g.color)}" href="#/partida/${m.id}"><div class="row"><div class="emo">${esc(g.emoji)}</div>
    <div class="grow"><div class="t ell">${esc(g.name)}</div><div class="s">${fdate(m.date)} · ${m.players.length} jug.</div>
    <div class="s">${ps}</div><div style="margin-top:4px">${matchBadges(m)}</div></div></div></a>`;
}

/* ====================== Vistes ====================== */
function vHome() {
  const live = S.matches.filter(m => m.status === 'live').sort((a, b) => b.started - a.started);
  const last = S.matches.filter(m => m.status !== 'live').sort((a, b) => a.date < b.date ? 1 : -1).slice(0, 5);
  const nodone = !S.matches.length;
  let h = `<button class="btn big" data-a="new-match">🎲 Nova partida</button>`;
  const lb = S.settings.lastBackup;
  if (S.matches.length >= 3 && (!lb || Date.now() - lb > 30 * 864e5))
    h += `<div class="banner warn" style="margin-top:12px">💾 Fa temps que no fas una còpia de seguretat. <a href="#/config"><b>Fes-la ara</b></a></div>`;
  if (live.length) h += `<h2>Partides en curs</h2>` + live.map(matchCard).join('');
  if (!S.games.length) h += `<div class="empty"><div class="big">📦</div>Encara no tens cap joc.<div class="btns"><button class="btn" data-a="seed">Carrega els jocs per defecte</button><a class="btn sec" href="#/jocs">Afegeix-ne un</a></div></div>`;
  else if (nodone && !live.length) h += `<div class="empty"><div class="big">🃏</div>Toca «Nova partida» per començar.</div>`;
  if (last.length) h += `<h2>Últimes partides</h2>` + last.map(matchCard).join('') + `<a class="btn sec block" href="#/historial">Veure tot l'historial</a>`;
  return page('PuntuaJocs', h, { acts: `<a class="ib" href="#/config" aria-label="Configuració">⚙️</a>` });
}

function vGames() {
  const gs = S.games.slice().sort((a, b) => (a.archived ? 1 : 0) - (b.archived ? 1 : 0) || a.name.localeCompare(b.name, 'ca'));
  let h = gs.map(g => { const n = S.matches.filter(m => m.gameId === g.id).length;
    return `<a class="card" style="--c:${esc(g.color)}" href="#/joc/${g.id}"><div class="row"><div class="emo">${esc(g.emoji)}</div>
      <div class="grow"><div class="t ell">${esc(g.name)}${g.archived ? ' <span class="badge">arxivat</span>' : ''}</div>
      <div class="s">${TYPES[g.type].n}</div></div><div class="s">${n} part.</div></div></a>`; }).join('');
  if (!gs.length) h = `<div class="empty"><div class="big">🎲</div>Cap joc encara.<div class="btns"><button class="btn" data-a="seed">Carrega els jocs per defecte</button></div></div>`;
  return page('Jocs', h, { acts: `<button class="ib" data-a="game-edit" aria-label="Afegeix joc">＋</button>` });
}

function vGame(id) {
  const g = G(id); if (!g) return notFound();
  const ms = S.matches.filter(m => m.gameId === id).sort((a, b) => a.date < b.date ? 1 : -1);
  let h = `<div class="card" style="--c:${esc(g.color)}"><div class="row"><div class="emo">${esc(g.emoji)}</div><div class="grow"><div class="t">${esc(g.name)}</div>
    <div class="s">${TYPES[g.type].n}${GRID(g.type) ? ' · guanya qui en té ' + (g.highWins === false ? 'menys' : 'més') : ''}</div>
    <div class="s">${g.minP || g.maxP ? `Jugadors: ${g.minP || '?'}–${g.maxP || '?'}` : ''}${g.target ? ` · Objectiu: ${g.target} punts` : ''}</div></div></div>
    ${g.roles && g.roles.length ? `<div class="s" style="margin-top:6px">Bàndols: ${g.roles.map(esc).join(' · ')}</div>` : ''}
    ${g.endings && g.endings.length ? `<div class="s">Finals possibles: ${g.endings.map(esc).join(' · ')}</div>` : ''}
    ${g.type === 'categories' ? `<div class="s" style="margin-top:6px">Categories: ${g.cats.map(esc).join(', ')}</div>` : ''}
    ${g.notes ? `<div class="s" style="margin-top:6px">${esc(g.notes).replace(/\n/g, '<br>')}</div>` : ''}</div>
    <div class="btns"><button class="btn" data-a="new-match" data-g="${g.id}">🎲 Nova partida</button><button class="btn sec" data-a="game-edit" data-id="${g.id}">✏️ Edita</button></div>`;
  h += `<h2>Estadístiques</h2>` + gameStatsHTML(id, {});
  h += `<h2>Partides (${ms.length})</h2>` + (ms.slice(0, 15).map(matchCard).join('') || '<p class="hint">Cap partida encara.</p>');
  return page(esc(g.name), h, { back: '#/jocs' });
}

function vPlayers() {
  const ps = S.players.slice().sort((a, b) => (a.archived ? 1 : 0) - (b.archived ? 1 : 0) || a.name.localeCompare(b.name, 'ca'));
  const ms = statMatches();
  let h = ps.map(p => { const s = pStats(p.id, ms);
    return `<a class="card plain" href="#/jugador/${p.id}"><div class="row">${av(p.name, p.color)}<div class="grow"><div class="t ell">${esc(p.name)}${p.archived ? ' <span class="badge">arxivat</span>' : ''}</div>
      <div class="s">${s.games} partides · ${s.wins} victòries (${pct(s.wins, s.games)})</div></div></div></a>`; }).join('');
  if (!ps.length) h = `<div class="empty"><div class="big">👥</div>Afegeix els teus jugadors habituals amb el botó ＋.</div>`;
  return page('Jugadors', h, { acts: `<button class="ib" data-a="player-edit" aria-label="Afegeix jugador">＋</button>` });
}

function vPlayer(id) {
  const p = P(id); if (!p) return notFound();
  const mine = S.matches.filter(m => m.players.some(x => x.id === id)).sort((a, b) => a.date < b.date ? 1 : -1);
  let h = `<div class="row" style="margin-bottom:8px">${av(p.name, p.color, true)}<div class="grow"><div class="t" style="font-size:1.2rem">${esc(p.name)}</div><div class="s">${mine.length} partides registrades</div></div>
    <button class="btn sec sm" data-a="player-edit" data-id="${id}">✏️ Edita</button></div>`;
  h += playerStatsHTML(id, {});
  h += `<h2>Partides</h2>` + (mine.slice(0, 15).map(matchCard).join('') || '<p class="hint">Cap partida encara.</p>');
  return page(esc(p.name), h, { back: '#/jugadors' });
}

function vHistory() {
  const f = st.hist || (st.hist = { game: '', filter: 'all' });
  const filters = { all: 'Totes', live: 'En curs', done: 'Finalitzades', prova: 'Proves', nostat: 'Sense estad.', gone: 'Amb abandons', abandoned: 'Aturades' };
  let ms = S.matches.filter(m => G(m.gameId) && (!f.game || m.gameId === f.game));
  ms = ms.filter(m => ({ all: true, live: m.status === 'live', done: m.status === 'done', prova: m.kind === 'prova',
    nostat: m.stats === false, gone: m.players.some(p => p.gone), abandoned: m.status === 'abandoned' }[f.filter]));
  ms.sort((a, b) => a.date < b.date ? 1 : -1);
  let h = `<select data-c="hist" data-k="game" class="chip" style="width:100%;margin-bottom:8px"><option value="">Tots els jocs</option>${S.games.map(g => `<option value="${g.id}"${f.game === g.id ? ' selected' : ''}>${esc(g.emoji + ' ' + g.name)}</option>`).join('')}</select>
    <div class="chips" style="margin-bottom:12px">${Object.keys(filters).map(k => `<button class="chip${f.filter === k ? ' on' : ''}" data-a="hist-f" data-v="${k}">${filters[k]}</button>`).join('')}</div>`;
  h += ms.map(matchCard).join('') || `<div class="empty"><div class="big">📜</div>No hi ha cap partida amb aquest filtre.</div>`;
  return page('Historial', h);
}

function vStats() {
  const sel = (key, opts, label) => `<select data-c="st" data-k="${key}" class="chip">${opts.map(o => `<option value="${o[0]}"${String(st[key]) === String(o[0]) ? ' selected' : ''}>${esc(o[1])}</option>`).join('')}</select>`;
  const counts = [...new Set(S.matches.filter(m => m.status === 'done').map(m => m.players.length))].sort((a, b) => a - b);
  const tabs = [['gen', 'General'], ['jug', 'Jugadors'], ['joc', 'Jocs']];
  let h = `<div class="chips" style="margin-bottom:10px">${tabs.map(t => `<button class="chip${st.tab === t[0] ? ' on' : ''}" data-a="st-tab" data-v="${t[0]}">${t[1]}</button>`).join('')}</div>
    <div class="chips" style="margin-bottom:12px">`
    + sel('period', Object.entries(PERIODS))
    + (st.tab === 'gen' ? sel('game', [['', 'Tots els jocs']].concat(S.games.map(g => [g.id, g.emoji + ' ' + g.name]))) : '')
    + sel('n', [['', 'Qualsevol nre. jugadors']].concat(counts.map(n => [n, n + ' jugadors'])))
    + `</div>`;
  const f = { game: st.game, period: st.period, n: st.n };
  if (st.tab === 'gen') h += generalStatsHTML(f);
  else if (st.tab === 'jug') {
    if (!S.players.length) h += `<div class="empty">Afegeix jugadors per veure'n les estadístiques.</div>`;
    else {
      if (!P(st.player)) st.player = S.players[0].id;
      h += `<select data-c="st" data-k="player" class="chip" style="width:100%;margin-bottom:10px">${S.players.map(p => `<option value="${p.id}"${st.player === p.id ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</select>` + playerStatsHTML(st.player, f);
    }
  } else {
    if (!S.games.length) h += `<div class="empty">Afegeix jocs per veure'n les estadístiques.</div>`;
    else {
      if (!G(st.sgame)) st.sgame = S.games[0].id;
      h += `<select data-c="st" data-k="sgame" class="chip" style="width:100%;margin-bottom:10px">${S.games.map(g => `<option value="${g.id}"${st.sgame === g.id ? ' selected' : ''}>${esc(g.emoji + ' ' + g.name)}</option>`).join('')}</select>` + gameStatsHTML(st.sgame, f);
    }
  }
  h += `<p class="hint" style="margin-top:16px">Només es compten les partides <b>finalitzades</b> i marcades «compta a les estadístiques» (les proves i les aturades en queden fora, tret que ho canviïs a l'opció de la partida).</p>`;
  return page('Estadístiques', h);
}

function vConfig() {
  const sz = (JSON.stringify(S).length / 1024).toFixed(1);
  const lb = S.settings.lastBackup;
  return page('Configuració', `
    <h2 style="margin-top:4px">Còpia de seguretat</h2>
    <p class="hint">Les dades només són en aquest telèfon. Fes còpies de tant en tant i guarda-les al núvol o envia-te-les.<br>Última còpia: <b>${lb ? fdate(new Date(lb).toISOString()) : 'mai'}</b> · Mida de les dades: ${sz} KB</p>
    <div class="btns"><button class="btn" data-a="export">⬇️ Exporta còpia (.json)</button><button class="btn sec" data-a="export-csv">📄 Exporta partides (.csv)</button></div>
    <div class="btns"><button class="btn sec" data-a="import" data-mode="replace">⬆️ Restaura còpia</button><button class="btn sec" data-a="import" data-mode="merge">➕ Fusiona còpia</button></div>
    <p class="hint">«Restaura» substitueix tot el que hi ha. «Fusiona» afegeix el que falti (per ajuntar dades de dos telèfons).</p>
    <input type="file" id="file" accept=".json,application/json" hidden>
    <h2>Dades</h2>
    <div class="btns"><button class="btn sec" data-a="seed">🎲 Restaura els jocs per defecte</button><button class="btn danger" data-a="wipe">🗑️ Esborra-ho tot</button></div>
    <h2>Sobre</h2><p class="hint">PuntuaJocs · versió 1.0 · Funciona sense connexió. Les dades no surten mai del teu telèfon.</p>`, { back: '#/' });
}

/* ---------- Partida ---------- */
function vMatch(id) {
  const m = M(id); if (!m) return notFound();
  const g = G(m.gameId); if (!g) return notFound();
  const rs = result(m), done = m.status === 'done', live = m.status === 'live';
  let h = `<div style="margin-bottom:8px">${matchBadges(m)} <span class="s">${fdate(m.date)}${m.minutes ? ' · ' + fdur(m.minutes) : ''}</span></div>`;
  if (m.kind === 'prova') h += `<div class="banner warn">🧪 Partida de prova${m.stats === false ? ': no compta a les estadístiques.' : ' (compta a les estadístiques).'}</div>`;
  else if (m.stats === false && m.status !== 'abandoned') h += `<div class="banner info">Aquesta partida no compta a les estadístiques.</div>`;
  if (m.status === 'abandoned') h += `<div class="banner warn">Partida aturada sense resultat. No compta a les estadístiques.</div>`;
  if (done) {
    const w = winners(m);
    const endTxt = m.ending ? `<div class="s" style="font-weight:400">Final: ${esc(m.ending)}</div>` : '';
    h += `<div class="banner win">${g.type === 'coop' ? (m.coopWin ? '🎉 Victòria cooperativa!' : '💥 Derrota cooperativa') : w.length ? '🏆 ' + (w.length > 1 ? 'Guanyen: ' : 'Guanya: ') + esc(w.join(', ')) : 'Cap guanyador'}${endTxt}</div>`;
  }
  if (GRID(g.type)) {
    const order = rs.slice().sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
    h += `<div class="lead">${order.map(r => `<div>${r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : (r.rank || '–') + '.'} ${esc(pname(m.players[r.i]))}${m.players[r.i].role ? ' <span class="s">(' + esc(m.players[r.i].role) + ')</span>' : ''}<b>${r.gone ? '(abandona)' : fmt(r.score)}</b></div>`).join('')}</div>`;
    if (g.target && live) {
      const hit = rs.filter(r => !r.gone && r.score >= g.target);
      if (hit.length) h += `<div class="banner info">🎯 ${esc(hit.map(r => pname(m.players[r.i])).join(', '))} ${hit.length > 1 ? 'han' : 'ha'} arribat a ${g.target} punts. Pots finalitzar la partida.</div>`;
    }
    const lead = order.length && order[0].rank === 1 ? order.filter(r => r.rank === 1).map(r => r.i) : [];
    const rowLabel = r => g.type === 'rounds' ? 'R' + (r + 1) : g.type === 'categories' ? esc(m.catNames[r]) : 'Punts';
    h += `<div class="gridwrap"><table class="grid"><thead><tr><th></th>${m.players.map((p, i) => `<th data-a="pl" data-i="${i}" class="${p.gone ? 'gone' : ''}">${av(pname(p), pcolor(p))}<br>${esc(pname(p))}${p.role ? `<br><span class="s">${esc(p.role)}</span>` : ''}</th>`).join('')}</tr></thead><tbody>`
      + m.grid.map((row, r) => `<tr><th>${rowLabel(r)}</th>${row.map((v, i) => `<td data-a="cell" data-r="${r}" data-i="${i}" class="${v == null ? 'empty-c' : ''}${m.players[i].gone ? ' gone' : ''}">${v == null ? '·' : fmt(v)}</td>`).join('')}</tr>`).join('')
      + `</tbody><tfoot><tr><th>Total</th>${m.players.map((p, i) => `<td class="${lead.includes(i) ? 'lead1' : ''}">${fmt(rs[i].score)}</td>`).join('')}</tr></tfoot></table></div>`;
    if (g.type === 'rounds') h += `<div class="btns"><button class="btn sec" data-a="add-round">＋ Afegeix ronda</button></div>`;
  } else if (g.type === 'rank') {
    const n = m.players.length;
    h += m.players.map((p, i) => `<div class="pickrow${p.gone ? ' gone' : ''}" data-a="pl" data-i="${i}" style="cursor:pointer">${av(pname(p), pcolor(p))}<div class="t">${esc(pname(p))}</div></div>
      <div class="chips" style="margin:-4px 0 10px 12px">${p.gone ? '<span class="badge gone">Abandona</span>' : Array.from({ length: n }, (_, k) => `<button class="chip${m.ranks[i] === k + 1 ? ' on' : ''}" data-a="rk" data-i="${i}" data-v="${k + 1}">${k + 1}r</button>`).join('')}</div>`).join('');
  } else if (g.type === 'winlose') {
    h += `<p class="hint">Marca qui ha guanyat (pot ser més d'un jugador, o cap en cas d'empat).</p>`
      + m.players.map((p, i) => `<div class="pickrow${p.gone ? ' gone' : ''}">${av(pname(p), pcolor(p))}<div class="t grow" data-a="pl" data-i="${i}">${esc(pname(p))}</div>
        ${p.gone ? '<span class="badge gone">Abandona</span>' : `<button class="chip${m.wins[i] ? ' on' : ''}" data-a="wl" data-i="${i}">${m.wins[i] ? '🏆 Guanya' : 'Guanya?'}</button>`}</div>`).join('');
  } else if (g.type === 'coop') {
    h += `<div class="chips" style="margin-bottom:10px">${m.players.map((p, i) => `<span class="chip" data-a="pl" data-i="${i}" style="${p.gone ? 'text-decoration:line-through;opacity:.5' : ''}">${esc(pname(p))}</span>`).join('')}</div>
      <div class="btns"><button class="btn${m.coopWin === true ? '' : ' sec'}" data-a="coop" data-v="1">🎉 Hem guanyat</button><button class="btn${m.coopWin === false ? ' danger' : ' sec'}" data-a="coop" data-v="0">💥 Hem perdut</button></div>`;
  }
  if (m.notes) h += `<h3>Notes</h3><div class="card plain">${esc(m.notes).replace(/\n/g, '<br>')}</div>`;
  h += `<div class="btns" style="margin-top:16px">${live ? `<button class="btn big" data-a="finish">✅ Finalitza la partida</button>` : `<button class="btn sec" data-a="reopen">↩️ Reobre la partida</button>`}</div>`;
  return page(esc(g.emoji + ' ' + g.name), h, { back: live ? '#/' : '#/historial', acts: `<button class="ib" data-a="mmenu" aria-label="Opcions">⋯</button>` });
}

/* ====================== Router ====================== */
function render() {
  const parts = location.hash.replace(/^#\/?/, '').split('/');
  const [a, b] = parts; let html, sec = '';
  switch (a) {
    case 'jocs': html = vGames(); sec = 'jocs'; break;
    case 'joc': html = vGame(b); sec = 'jocs'; break;
    case 'jugadors': html = vPlayers(); sec = 'jugadors'; break;
    case 'jugador': html = vPlayer(b); sec = 'jugadors'; break;
    case 'historial': html = vHistory(); sec = 'historial'; break;
    case 'partida': html = vMatch(b); sec = 'historial'; break;
    case 'stats': html = vStats(); sec = 'stats'; break;
    case 'config': html = vConfig(); break;
    default: html = vHome(); sec = 'inici';
  }
  const y = window.scrollY, same = render.last === location.hash;
  $('#app').innerHTML = html; renderNav(sec);
  render.last = location.hash;
  window.scrollTo(0, same ? y : 0);
}
window.addEventListener('hashchange', () => { closeSheet(); render(); });

/* ====================== Formularis (full inferior) ====================== */
let formColor = COLORS[0];
const swatches = cur => `<div class="sw">${COLORS.map(c => `<button type="button" data-a="color" data-v="${c}" class="${c === cur ? 'on' : ''}" style="background:${c}" aria-label="Color"></button>`).join('')}</div>`;

function gameForm(id) {
  const g = id ? G(id) : { name: '', emoji: '🎲', color: COLORS[Math.floor(Math.random() * COLORS.length)], type: 'rounds', highWins: true, target: '', cats: [], minP: '', maxP: '', notes: '' };
  formColor = g.color;
  const s = sheet(`<h2>${id ? 'Edita el joc' : 'Nou joc'}</h2><div class="form" data-id="${id || ''}">
    <label>Nom</label><input type="text" id="f-name" value="${esc(g.name)}" placeholder="Ex.: Catan">
    <div class="two"><div><label>Icona (emoji)</label><input type="text" id="f-emoji" value="${esc(g.emoji)}" maxlength="4"></div>
    <div><label>Color</label>${swatches(g.color)}</div></div>
    <label>Sistema de còmput de punts</label>
    <select id="f-type" data-c="gtype">${Object.keys(TYPES).map(k => `<option value="${k}"${g.type === k ? ' selected' : ''}>${TYPES[k].n}</option>`).join('')}</select>
    <div class="hint" id="f-tdesc"></div>
    <div data-for="rounds categories single"><label>Qui guanya?</label>
      <div class="seg"><label><input type="radio" name="f-hw" value="1"${g.highWins !== false ? ' checked' : ''}><span>Qui té més punts</span></label>
      <label><input type="radio" name="f-hw" value="0"${g.highWins === false ? ' checked' : ''}><span>Qui en té menys</span></label></div>
      <label>Punts objectiu (opcional)</label><input type="number" inputmode="numeric" id="f-target" value="${g.target || ''}" placeholder="Ex.: 500">
      <div class="hint">T'avisarà quan algú arribi a aquesta xifra.</div></div>
    <div data-for="categories"><label>Categories (una per línia)</label><textarea id="f-cats" placeholder="Poblats&#10;Ciutats&#10;Carretera més llarga">${esc((g.cats || []).join('\n'))}</textarea></div>
    <div class="two"><div><label>Mínim de jugadors</label><input type="number" inputmode="numeric" id="f-min" value="${g.minP || ''}"></div>
    <div><label>Màxim de jugadors</label><input type="number" inputmode="numeric" id="f-max" value="${g.maxP || ''}"></div></div>
    <label>Bàndols / rols (un per línia, opcional)</label><textarea id="f-roles" placeholder="EUA&#10;URSS">${esc((g.roles || []).join('\n'))}</textarea>
    <div class="hint">S'assignen als jugadors segons l'ordre d'assegut de la partida i en surten estadístiques per bàndol.</div>
    <label>Maneres d'acabar la partida (una per línia, opcional)</label><textarea id="f-ends" placeholder="Punts al final&#10;Victòria automàtica">${esc((g.endings || []).join('\n'))}</textarea>
    <label>Notes</label><textarea id="f-notes" placeholder="Regles especials, edició, expansions…">${esc(g.notes || '')}</textarea>
    <div class="btns"><button class="btn sec" data-a="close">Cancel·la</button><button class="btn" data-a="game-save">Desa</button></div>
    ${id ? `<div class="btns"><button class="btn sec" data-a="game-dup" data-id="${id}">📄 Duplica</button></div><div class="btns"><button class="btn sec" data-a="game-arch" data-id="${id}">${g.archived ? '📤 Desarxiva' : '📥 Arxiva'}</button><button class="btn danger" data-a="game-del" data-id="${id}">🗑️ Elimina</button></div>` : ''}</div>`);
  syncGameForm(s);
}
function syncGameForm(root) {
  const t = $('#f-type', root).value;
  $('#f-tdesc', root).textContent = TYPES[t].d;
  root.querySelectorAll('[data-for]').forEach(el => el.style.display = el.dataset.for.split(' ').includes(t) ? '' : 'none');
}
function saveGame() {
  const f = $('.sheet .form'), id = f.dataset.id, name = $('#f-name').value.trim();
  if (!name) return toast('Posa-li un nom al joc');
  const type = $('#f-type').value;
  const cats = $('#f-cats').value.split('\n').map(x => x.trim()).filter(Boolean);
  if (type === 'categories' && !cats.length) return toast('Afegeix almenys una categoria');
  const o = { name, emoji: $('#f-emoji').value.trim() || '🎲', color: formColor, type,
    highWins: (document.querySelector('input[name=f-hw]:checked') || { value: '1' }).value === '1',
    target: Number($('#f-target').value) || null, cats: type === 'categories' ? cats : [],
    roles: $('#f-roles').value.split('\n').map(x => x.trim()).filter(Boolean), endings: $('#f-ends').value.split('\n').map(x => x.trim()).filter(Boolean),
    minP: Number($('#f-min').value) || null, maxP: Number($('#f-max').value) || null, notes: $('#f-notes').value.trim() };
  if (id) {
    const g = G(id);
    if (g.type !== o.type && S.matches.some(m => m.gameId === id) && !confirm("Canviar el sistema de còmput pot fer que les partides ja guardades es mostrin malament. Vols continuar?")) return;
    Object.assign(g, o);
  } else S.games.push(Object.assign({ id: uid(), created: Date.now() }, o));
  save(); closeSheet(); render(); toast('Joc desat');
}

function playerForm(id) {
  const p = id ? P(id) : { name: '', color: COLORS[S.players.length % COLORS.length] };
  formColor = p.color;
  sheet(`<h2>${id ? 'Edita el jugador' : 'Nou jugador'}</h2><div class="form" data-id="${id || ''}">
    <label>Nom</label><input type="text" id="f-name" value="${esc(p.name)}" placeholder="Ex.: Anna"><label>Color</label>${swatches(p.color)}
    <div class="btns"><button class="btn sec" data-a="close">Cancel·la</button><button class="btn" data-a="player-save">Desa</button></div>
    ${id ? `<div class="btns"><button class="btn sec" data-a="player-arch" data-id="${id}">${p.archived ? '📤 Desarxiva' : '📥 Arxiva'}</button><button class="btn danger" data-a="player-del" data-id="${id}">🗑️ Elimina</button></div>
    <p class="hint">Arxivar l'amaga de les noves partides però en conserva l'historial i les estadístiques.</p>` : ''}</div>`);
}
function savePlayer() {
  const id = $('.sheet .form').dataset.id, name = $('#f-name').value.trim();
  if (!name) return toast('Posa-li un nom');
  if (S.players.some(p => p.id !== id && p.name.toLowerCase() === name.toLowerCase())) return toast('Ja hi ha un jugador amb aquest nom');
  if (id) Object.assign(P(id), { name, color: formColor });
  else S.players.push({ id: uid(), name, color: formColor });
  save(); closeSheet(); render(); toast('Jugador desat');
}

/* ---------- Nova partida ---------- */
let setup = null;
function openSetup(gid) {
  const games = S.games.filter(g => !g.archived);
  if (!games.length) { toast('Primer afegeix un joc'); return go('#/jocs'); }
  setup = { gid: gid && G(gid) ? gid : games[0].id, list: [], kind: 'normal', stats: true };
  sheet(''); drawSetup();
}
function drawSetup() {
  const g = G(setup.gid), games = S.games.filter(x => !x.archived || x.id === setup.gid);
  const pl = S.players.filter(p => !p.archived);
  const n = setup.list.length;
  const warn = g.minP && n < g.minP ? `Aquest joc demana mínim ${g.minP} jugadors.` : g.maxP && n > g.maxP ? `Aquest joc admet màxim ${g.maxP} jugadors.` : '';
  $('.sheet').innerHTML = `<h2>Nova partida</h2><div class="form">
    <label>Joc</label><select data-c="sm-game">${games.map(x => `<option value="${x.id}"${x.id === setup.gid ? ' selected' : ''}>${esc(x.emoji + ' ' + x.name)}</option>`).join('')}</select>
    <label>Jugadors (toca per afegir; l'ordre és el d'assegut)</label>
    <div class="chips">${pl.map(p => { const k = setup.list.findIndex(x => x.id === p.id);
      return `<button class="chip${k >= 0 ? ' on' : ''}" data-a="sm-toggle" data-id="${p.id}">${k >= 0 ? `<span class="n">${k + 1}</span>` : ''}${esc(p.name)}</button>`; }).join('')}
      ${setup.list.map((x, k) => x.id ? '' : `<button class="chip on" data-a="sm-rm" data-k="${k}"><span class="n">${k + 1}</span>${esc(x.name)} ✕</button>`).join('')}</div>
    <div class="row" style="margin-top:8px"><input type="text" id="sm-guest" placeholder="Convidat (nom)" style="flex:1;padding:10px 12px;border-radius:12px;border:1px solid var(--line);background:var(--card);color:var(--ink);font:inherit">
      <button class="btn sec sm" data-a="sm-guest">＋ Convidat</button></div>
    <div class="row" style="margin-top:8px;justify-content:space-between"><span class="hint">${n} ${n === 1 ? 'jugador' : 'jugadors'}${warn ? ' · ⚠️ ' + warn : ''}${g.roles && g.roles.length ? '<br>Bàndols per ordre: ' + esc(g.roles.join(' → ')) : ''}</span><button class="btn sec sm" data-a="sm-shuffle">🔀 Barreja l'ordre</button></div>
    <label>Tipus de partida</label>
    <div class="seg"><label><input type="radio" name="sm-kind" value="normal"${setup.kind === 'normal' ? ' checked' : ''} data-c="sm-kind"><span>Normal</span></label>
      <label><input type="radio" name="sm-kind" value="prova"${setup.kind === 'prova' ? ' checked' : ''} data-c="sm-kind"><span>🧪 De prova</span></label></div>
    <div class="inl" style="margin-top:12px"><input type="checkbox" id="sm-stats" data-c="sm-stats"${setup.stats ? ' checked' : ''}><label for="sm-stats">Compta a les estadístiques</label></div>
    <div class="hint">Pots canviar-ho després des del menú ⋯ de la partida.</div>
    <div class="btns"><button class="btn sec" data-a="close">Cancel·la</button><button class="btn" data-a="sm-start">Comença</button></div></div>`;
}
function startMatch() {
  if (!setup.list.length) return toast('Escull almenys un jugador');
  const plist = setup.list.map(x => x.id ? { id: x.id, name: P(x.id).name, color: P(x.id).color } : { id: null, name: x.name, color: '#8a96a0' });
  const m = newMatch(setup.gid, plist, setup.kind, setup.stats);
  S.matches.push(m); save(); closeSheet(); go('#/partida/' + m.id);
}

/* ---------- Teclat numèric ---------- */
let kp = null;
function openKp(mid, r, i) {
  const m = M(mid), g = G(m.gameId); if (!m.grid[r] || i >= m.players.length) return closeSheet();
  const v = m.grid[r][i];
  kp = { mid, r, i, buf: v == null ? '' : String(v), fresh: true };
  const rl = g.type === 'rounds' ? 'Ronda ' + (r + 1) : g.type === 'categories' ? m.catNames[r] : 'Puntuació';
  sheet(`<div class="row">${av(pname(m.players[i]), pcolor(m.players[i]))}<div class="grow"><div class="t">${esc(pname(m.players[i]))}</div><div class="s">${esc(rl)}</div></div><button class="btn sec sm" data-a="close">✕</button></div>
    <div class="kp-disp" id="kp-d"></div>
    <div class="quick">${[-5, -1, 1, 5, 10].map(q => `<button data-a="kp-add" data-v="${q}">${q > 0 ? '+' : '−'}${Math.abs(q)}</button>`).join('')}</div>
    <div class="kp">${['7', '8', '9', '4', '5', '6', '1', '2', '3', '±', '0', ','].map(k => `<button data-a="kp" data-k="${k}" class="${k === '±' || k === ',' ? 'f' : ''}">${k}</button>`).join('')}</div>
    <div class="btns"><button class="btn sec" data-a="kp" data-k="⌫">⌫ Esborra</button><button class="btn sec" data-a="kp" data-k="C">Buida</button></div>
    <div class="btns"><button class="btn" data-a="kp-save">Desa</button>${i < m.players.length - 1 ? `<button class="btn" data-a="kp-next">Desa i següent →</button>` : ''}</div>
    ${g.type === 'rounds' && m.grid.length > 1 ? `<button class="btn danger block sm" data-a="kp-delrow">Esborra aquesta ronda</button>` : ''}`);
  drawKp();
}
function drawKp() { $('#kp-d').textContent = (kp.buf === '' ? '—' : kp.buf.replace('.', ',')); }
function kpKey(k) {
  if (k === '⌫') kp.buf = kp.buf.slice(0, -1);
  else if (k === 'C') kp.buf = '';
  else if (k === '±') kp.buf = kp.buf.startsWith('-') ? kp.buf.slice(1) : '-' + kp.buf;
  else {
    if (kp.fresh) kp.buf = '';
    if (k === ',') { if (!kp.buf.includes('.')) kp.buf = (kp.buf === '' || kp.buf === '-') ? kp.buf + '0.' : kp.buf + '.'; }
    else if (kp.buf.replace('-', '').length < 9) kp.buf += k;
  }
  kp.fresh = false; drawKp();
}
function kpCommit() {
  const m = M(kp.mid), v = kp.buf === '' || kp.buf === '-' ? null : parseFloat(kp.buf);
  m.grid[kp.r][kp.i] = isNaN(v) ? null : v; save();
}

/* ---------- Menús de partida ---------- */
function playerMenu(mid, i) {
  const m = M(mid), p = m.players[i];
  sheet(`<h2>${esc(pname(p))}</h2><div class="menu">
    <button data-a="pl-gone" data-i="${i}">${p.gone ? '↩️ Torna a la partida' : '🚪 Ha abandonat la partida'}</button>
    <button class="red" data-a="pl-remove" data-i="${i}">🗑️ Treu-lo de la partida</button></div>
    <p class="hint">Un jugador que abandona queda fora de la classificació i compta com a derrota a les estadístiques (si la partida hi compta).</p>`);
}
function matchMenu(mid) {
  const m = M(mid);
  sheet(`<h2>Opcions de la partida</h2><div class="menu">
    <button data-a="mopts">⚙️ Tipus, estadístiques, data i notes</button>
    <button data-a="addp">➕ Afegeix un jugador</button>
    ${G(m.gameId).type === 'categories' ? '<button data-a="addcat">➕ Afegeix una categoria (extensió, norma extra…)</button>' : ''}
    ${m.status === 'live' ? '<button data-a="cancel-m">⏹️ Atura la partida sense resultat</button>' : ''}
    <button class="red" data-a="del-m">🗑️ Elimina la partida</button></div>`);
}
function matchOpts(mid) {
  const m = M(mid);
  sheet(`<h2>Opcions</h2><div class="form" data-id="${mid}">
    <label>Tipus de partida</label><select id="o-kind"><option value="normal"${m.kind !== 'prova' ? ' selected' : ''}>Normal</option><option value="prova"${m.kind === 'prova' ? ' selected' : ''}>🧪 De prova</option></select>
    <div class="inl" style="margin-top:12px"><input type="checkbox" id="o-stats"${m.stats !== false ? ' checked' : ''}><label for="o-stats">Compta a les estadístiques</label></div>
    <div class="two"><div><label>Data</label><input type="date" id="o-date" value="${new Date(m.date).toLocaleDateString('sv-SE')}"></div>
    <div><label>Durada (minuts)</label><input type="number" inputmode="numeric" id="o-min" value="${m.minutes || ''}"></div></div>
    <label>Notes</label><textarea id="o-notes">${esc(m.notes || '')}</textarea>
    <div class="btns"><button class="btn sec" data-a="close">Cancel·la</button><button class="btn" data-a="mopts-ok">Desa</button></div></div>`);
}
function finishSheet(mid) {
  const m = M(mid), g = G(m.gameId);
  if (g.type === 'rank' && result(m).some(r => !r.gone && r.rank == null)) return toast('Indica la posició de tots els jugadors');
  if (g.type === 'coop' && m.coopWin == null) return toast('Indica si heu guanyat o perdut');
  const rs = result(m), w = winners(m);
  const el = Math.round((Date.now() - (m.started || Date.now())) / 60000);
  sheet(`<h2>Finalitza la partida</h2><div class="form" data-id="${mid}">
    <div class="banner win">${g.type === 'coop' ? (m.coopWin ? '🎉 Victòria cooperativa' : '💥 Derrota cooperativa') : w.length ? '🏆 ' + esc(w.join(', ')) : 'Sense guanyador'}</div>
    ${m.players.some(p => p.gone) ? `<p class="hint">Abandonaments: ${esc(m.players.filter(p => p.gone).map(pname).join(', '))}</p>` : ''}
    ${g.endings && g.endings.length ? `<label>Com ha acabat?</label><select id="o-end"><option value="">—</option>${g.endings.map(x => `<option${m.ending === x ? ' selected' : ''}>${esc(x)}</option>`).join('')}</select>` : ''}
    <label>Durada (minuts, opcional)</label><input type="number" inputmode="numeric" id="o-min" value="${m.minutes || (el > 0 && el < 720 ? el : '')}">
    <label>Notes (opcional)</label><textarea id="o-notes">${esc(m.notes || '')}</textarea>
    <div class="btns"><button class="btn sec" data-a="close">Cancel·la</button><button class="btn" data-a="finish-ok">Desa i finalitza</button></div></div>`);
}
function addPlayerSheet(mid) {
  const m = M(mid), ids = m.players.map(p => p.id);
  const pl = S.players.filter(p => !p.archived && !ids.includes(p.id));
  sheet(`<h2>Afegeix un jugador</h2><div class="form" data-id="${mid}"><div class="chips">${pl.map(p => `<button class="chip" data-a="addp-ok" data-id="${p.id}">${esc(p.name)}</button>`).join('') || '<span class="hint">Tots els jugadors ja hi són.</span>'}</div>
    <label>O un convidat</label><div class="row"><input type="text" id="g-name" placeholder="Nom" style="flex:1;padding:10px 12px;border-radius:12px;border:1px solid var(--line);background:var(--card);color:var(--ink);font:inherit"><button class="btn sm" data-a="addp-ok">Afegeix</button></div></div>`);
}

/* ---------- Còpies de seguretat ---------- */
async function saveFile(name, text, mime) {
  const file = new File([text], name, { type: mime });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); return; }
  } catch (e) { if (e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
const stamp = () => new Date().toLocaleDateString('sv-SE');
function exportJSON() {
  S.settings.lastBackup = Date.now(); save();
  saveFile(`puntuajocs-${stamp()}.json`, JSON.stringify(S, null, 1), 'application/json'); render();
}
function exportCSV() {
  const rows = [['Data', 'Joc', 'Estat', 'Tipus', 'Compta a estadístiques', 'Durada (min)', 'Jugador', 'Posició', 'Puntuació', 'Guanya', 'Abandona', 'Notes']];
  S.matches.slice().sort((a, b) => a.date < b.date ? -1 : 1).forEach(m => {
    const g = G(m.gameId), rs = result(m); if (!g) return;
    m.players.forEach((p, i) => rows.push([new Date(m.date).toLocaleDateString('sv-SE'), g.name, m.status, m.kind, m.stats === false ? 'no' : 'sí', m.minutes || '',
      pname(p), rs[i].rank ?? '', GRID(g.type) ? rs[i].score : '', rs[i].win ? 'sí' : 'no', p.gone ? 'sí' : 'no', m.notes || '']));
  });
  const csv = '﻿' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
  saveFile(`puntuajocs-partides-${stamp()}.csv`, csv, 'text/csv');
}
function importJSON(file, mode) {
  const rd = new FileReader();
  rd.onload = () => {
    let d; try { d = JSON.parse(rd.result); } catch (e) { return toast('Fitxer no vàlid'); }
    if (!d || d.v !== 1 || !Array.isArray(d.games) || !Array.isArray(d.players) || !Array.isArray(d.matches)) return toast('Aquest fitxer no és una còpia de PuntuaJocs');
    if (mode === 'replace') {
      if (!confirm(`Es substituiran les dades actuals per les de la còpia (${d.games.length} jocs, ${d.players.length} jugadors, ${d.matches.length} partides). Continuar?`)) return;
      S = d; if (!S.settings) S.settings = {};
    } else {
      ['games', 'players', 'matches'].forEach(k => d[k].forEach(x => { if (!S[k].some(y => y.id === x.id)) S[k].push(x); }));
    }
    save(); render(); toast('Dades importades');
  };
  rd.readAsText(file);
}
function seed(quiet) {
  const def = (name, emoji, type, highWins, o = {}) => Object.assign({ name, emoji, color: '', type, highWins, target: null, cats: [], minP: null, maxP: null, roles: [], endings: [], notes: '' }, o);
  const ex = [
    def('Twilight Struggle', '☢️', 'single', true, {
      minP: 2, maxP: 2, roles: ['EUA', 'URSS'],
      endings: ['Punts de victòria (final del torn 10)', 'Victòria automàtica (20 PV)', "Control d'Europa", 'Guerra nuclear (DEFCON 1)', 'Final anticipat per abandonament'],
      notes: "Punts de victòria (PV): a cada jugador, apunta la diferència de PV des del seu punt de vista: qui va al davant +N i l'altre −N (p. ex. EUA +8 / URSS −8). Si la partida acaba per victòria automàtica, control d'Europa o guerra nuclear, posa +20 al guanyador i −20 al perdedor, i tria com ha acabat. El primer jugador de la llista juga EUA i el segon URSS." }),
    def('Agricola', '🌾', 'categories', true, { minP: 1, maxP: 5,
      cats: ['Camps', 'Prats', 'Cereals', 'Hortalisses', 'Ovelles', 'Porcs', 'Vaques', 'Espais sense usar (negatiu)', 'Estables tancades', 'Habitacions de fang', 'Habitacions de pedra', 'Membres de la família', 'Cartes (punts)', 'Bonificacions'],
      notes: "Apunta els punts de cada categoria segons la taula de puntuació (les categories que no tens a 0 compten −1: posa-ho en negatiu)." }),
    def('Root', '🦊', 'single', true, { minP: 2, maxP: 4, target: 30, endings: ['30 punts', 'Dominació', 'Coalició'],
      notes: "Gairebé sempre guanya qui arriba als 30 punts; si algú juga Dominació, tria-ho com a final. Pots escriure la facció a les notes." }),
    def('Istanbul', '🕌', 'single', true, { minP: 2, maxP: 5, notes: "Apunta els robins (rubís). En cas d'empat, desempata qui té més diners (anota-ho a les notes)." }),
    def('Through the Ages', '🏺', 'categories', true, { minP: 2, maxP: 4,
      cats: ['Cultura', 'Meravelles i edificis', 'Bonificacions finals', 'Penalitzacions (negatiu)'] }),
    def('Arnak', '🗿', 'categories', true, { minP: 1, maxP: 4,
      cats: ['Pista de recerca', 'Artefactes', 'Objectes', 'Temple', 'Guardians vençuts', 'Cartes de por (negatiu)', 'Punts de cartes i extres'] }),
    def('Costa Rica', '🌴', 'single', true, { notes: "Puntuació final. Edita el joc per afegir categories quan vulguis." }),
    def('Jerusalem', '🕍', 'single', true, { notes: "Puntuació final. Edita el joc per afegir categories quan vulguis." }),
    def('Caverna', '⛏️', 'categories', true, { minP: 1, maxP: 7,
      cats: ['Animals de granja', 'Cereals i hortalisses', 'Rubís', 'Nans', 'Pastures', 'Coves i habitacions', 'Monedes', 'Animals que falten (negatiu)', 'Bonificacions'] }),
    def('Carcassonne', '🏰', 'categories', true, { minP: 2, maxP: 5,
      cats: ['Ciutats', 'Camins', 'Monestirs', 'Camps', 'Extensions i extres'] }),
    def('Aventureros al Tren', '🚂', 'categories', true, { minP: 2, maxP: 5,
      cats: ['Rutes', 'Bitllets completats', 'Bitllets no completats (negatiu)', 'Ruta més llarga', 'Estacions sobrants'] }),
    def('Civilization: Un Nuevo Amanecer', '🌍', 'winlose', true, { minP: 2, maxP: 4,
      endings: ['Victòria cultural', 'Victòria econòmica', 'Victòria científica', 'Victòria militar'],
      notes: "Marca qui guanya i tria el tipus de victòria al finalitzar la partida." }),
    def('Azul', '🔷', 'categories', true, { minP: 2, maxP: 4,
      cats: ['Punts per rajoles col·locades', 'Terra (negatiu)', 'Files completes', 'Columnes completes', 'Colors complets'] }),
    def('Brass', '🏭', 'categories', true, { minP: 2, maxP: 4,
      cats: ['Canals: enllaços', 'Canals: indústries', 'Ferrocarril: enllaços', 'Ferrocarril: indústries'],
      notes: "En cas d'empat, guanya qui té més ingressos, després més diners i després menys torns restants." }),
    def('Le Havre', '⚓', 'categories', true, { minP: 1, maxP: 5,
      cats: ['Diners', 'Edificis', 'Vaixells', 'Préstecs (negatiu)'] }),
    def('Ark Nova', '🦒', 'categories', true, { minP: 1, maxP: 4,
      cats: ['Atractiu', 'Conservació', 'Bonificacions finals'],
      notes: "Ajusta les categories si en tens una forma pròpia de comptar." }),
    def('Food Chain Magnate', '🍔', 'single', true, { minP: 2, maxP: 5, notes: "Apunta els diners al final de la partida (guanya qui en té més)." }),
    def('Kanban', '🚗', 'single', true, { minP: 2, maxP: 4, notes: "Puntuació final. Edita el joc per afegir categories quan vulguis." }),
    def('Scythe', '⚙️', 'categories', true, { minP: 1, maxP: 5,
      cats: ['Monedes en mà', 'Monedes per estrelles', 'Monedes per territoris', 'Monedes per recursos', 'Bonificació d’estructura'] }),
    def('Terraforming Mars', '🚀', 'categories', true, { minP: 1, maxP: 5,
      cats: ['Terraformació (TR)', 'Premis', 'Fites', 'Ciutats', 'Verds (boscos)', 'Cartes (PV)'] }),
    def('Sabika', '🧩', 'single', true, { notes: "Puntuació final. Edita el joc per afegir categories quan vulguis." }),
    def('Catan', '🏝️', 'single', true, { target: 10, minP: 3, maxP: 4 }),
    def('7 Wonders', '🏛️', 'categories', true, { minP: 3, maxP: 7, cats: ['Militar', 'Monedes', 'Meravella', 'Civil', 'Comerç', 'Gremis', 'Ciència'] }),
    def('Uno', '🃏', 'rounds', false, { target: 500, minP: 2, maxP: 10 }),
    def('Parxís', '🎯', 'rank', true, { minP: 2, maxP: 4 }),
    def('Escacs', '♟️', 'winlose', true, { minP: 2, maxP: 2 }),
    def('Pandèmia', '🦠', 'coop', true, { minP: 2, maxP: 4 })
  ];
  let n = 0;
  ex.forEach(e => {
    if (S.games.some(g => g.name.toLowerCase() === e.name.toLowerCase())) return;
    e.color = COLORS[S.games.length % COLORS.length]; n++;
    S.games.push(Object.assign({ id: uid(), created: Date.now() }, e));
  });
  if (quiet) return;
save(); render(); toast(n ? n + ' jocs afegits' : 'Ja hi són tots');
}

/* ====================== Esdeveniments ====================== */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-a]'); if (!el) return;
  const d = el.dataset, a = d.a, mid = (location.hash.match(/#\/partida\/(\w+)/) || [])[1];
  const m = mid ? M(mid) : null;
  switch (a) {
    case 'close': return closeSheet();
    case 'new-match': return openSetup(d.g);
    case 'seed': return seed();
    case 'color': formColor = d.v; el.parentNode.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === el)); return;
    /* jocs i jugadors */
    case 'game-edit': return gameForm(d.id);
    case 'game-save': return saveGame();
    case 'game-dup': { const g = G(d.id), c = JSON.parse(JSON.stringify(g)); c.id = uid(); c.name = g.name + ' (còpia)'; c.archived = false; c.created = Date.now(); S.games.push(c); save(); closeSheet(); return gameForm(c.id); }
    case 'game-arch': { const g = G(d.id); g.archived = !g.archived; save(); closeSheet(); render(); return; }
    case 'game-del': {
      const n = S.matches.filter(x => x.gameId === d.id).length;
      if (!confirm(`Eliminar «${G(d.id).name}»${n ? ` i les seves ${n} partides` : ''}? No es pot desfer. (Pots arxivar-lo si només vols amagar-lo.)`)) return;
      S.matches = S.matches.filter(x => x.gameId !== d.id); S.games = S.games.filter(x => x.id !== d.id); save(); closeSheet(); go('#/jocs'); return;
    }
    case 'player-edit': return playerForm(d.id);
    case 'player-save': return savePlayer();
    case 'player-arch': { const p = P(d.id); p.archived = !p.archived; save(); closeSheet(); render(); return; }
    case 'player-del':
      if (!confirm(`Eliminar «${P(d.id).name}»? Les partides en conservaran el nom, però ja no sortirà a les estadístiques de jugadors. (Pots arxivar-lo en lloc d'eliminar-lo.)`)) return;
      S.players = S.players.filter(x => x.id !== d.id); S.matches.forEach(x => x.players.forEach(p => { if (p.id === d.id) p.id = null; })); save(); closeSheet(); go('#/jugadors'); return;
    /* nova partida */
    case 'sm-toggle': { const k = setup.list.findIndex(x => x.id === d.id); if (k >= 0) setup.list.splice(k, 1); else setup.list.push({ id: d.id }); return drawSetup(); }
    case 'sm-rm': setup.list.splice(Number(d.k), 1); return drawSetup();
    case 'sm-guest': { const v = $('#sm-guest').value.trim(); if (!v) return toast('Escriu el nom del convidat'); setup.list.push({ name: v }); return drawSetup(); }
    case 'sm-shuffle': for (let i = setup.list.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [setup.list[i], setup.list[j]] = [setup.list[j], setup.list[i]]; } return drawSetup();
    case 'sm-start': return startMatch();
    /* partida */
    case 'cell': return openKp(mid, Number(d.r), Number(d.i));
    case 'kp': return kpKey(d.k);
    case 'kp-add': { const cur = parseFloat(kp.buf) || 0; kp.buf = String(rnd(cur + Number(d.v))); kp.fresh = true; return drawKp(); }
    case 'kp-save': kpCommit(); closeSheet(); return render();
    case 'kp-next': { kpCommit(); const { r, i } = kp; render(); return openKp(mid, r, i + 1); }
    case 'kp-delrow': m.grid.splice(kp.r, 1); save(); closeSheet(); return render();
    case 'add-round': m.grid.push(Array(m.players.length).fill(null)); save(); render(); return window.scrollTo(0, document.body.scrollHeight);
    case 'rk': { const i = Number(d.i), v = Number(d.v); m.ranks[i] = m.ranks[i] === v ? null : v; save(); return render(); }
    case 'wl': m.wins[Number(d.i)] = !m.wins[Number(d.i)]; save(); return render();
    case 'coop': m.coopWin = d.v === '1'; save(); return render();
    case 'pl': return playerMenu(mid, Number(d.i));
    case 'pl-gone': { const p = m.players[Number(d.i)]; p.gone = !p.gone; save(); closeSheet(); render(); return toast(p.gone ? pname(p) + ' ha abandonat' : pname(p) + ' torna a jugar'); }
    case 'pl-remove':
      if (m.players.length <= 1) return toast("No pots treure l'únic jugador");
      if (!confirm('Treure aquest jugador i les seves puntuacions de la partida?')) return;
      removePlayerFromMatch(m, Number(d.i)); save(); closeSheet(); return render();
    case 'mmenu': return matchMenu(mid);
    case 'mopts': return matchOpts(mid);
    case 'mopts-ok': {
      m.kind = $('#o-kind').value; m.stats = $('#o-stats').checked; m.minutes = Number($('#o-min').value) || null; m.notes = $('#o-notes').value.trim();
      const dv = $('#o-date').value; if (dv) m.date = new Date(dv + 'T12:00:00').toISOString();
      save(); closeSheet(); return render();
    }
    case 'addp': return addPlayerSheet(mid);
    case 'addcat': { const v = (prompt('Nom de la nova categoria:') || '').trim(); if (!v) return; m.catNames.push(v); m.grid.push(Array(m.players.length).fill(null)); save(); closeSheet(); return render(); }
    case 'addp-ok': {
      let pl;
      if (d.id) pl = { id: d.id, name: P(d.id).name, color: P(d.id).color };
      else { const v = $('#g-name').value.trim(); if (!v) return toast('Escriu un nom'); pl = { id: null, name: v, color: '#8a96a0' }; }
      addPlayerToMatch(m, pl); save(); closeSheet(); return render();
    }
    case 'finish': return finishSheet(mid);
    case 'finish-ok': m.status = 'done'; m.ended = Date.now(); if ($('#o-end')) m.ending = $('#o-end').value || null; m.minutes = Number($('#o-min').value) || null; m.notes = $('#o-notes').value.trim(); save(); closeSheet(); render(); return toast('Partida desada ✔');
    case 'reopen': m.status = 'live'; save(); return render();
    case 'cancel-m':
      if (!confirm("Aturar la partida sense resultat? Quedarà a l'historial però no comptarà a les estadístiques.")) return;
      m.status = 'abandoned'; save(); closeSheet(); return render();
    case 'del-m':
      if (!confirm('Eliminar aquesta partida definitivament?')) return;
      S.matches = S.matches.filter(x => x.id !== mid); save(); closeSheet(); return go('#/historial');
    /* historial i estadístiques */
    case 'hist-f': st.hist.filter = d.v; return render();
    case 'st-tab': st.tab = d.v; return render();
    /* configuració */
    case 'export': return exportJSON();
    case 'export-csv': return exportCSV();
    case 'import': { const f = $('#file'); f.dataset.mode = d.mode; f.value = ''; return f.click(); }
    case 'wipe':
      if (!confirm('Esborrar TOTES les dades (jocs, jugadors i partides)? No es pot desfer.')) return;
      if (!confirm('Segur? Millor fer abans una còpia de seguretat.')) return;
      S = { v: 1, games: [], players: [], matches: [], settings: {} }; save(); render(); return toast('Dades esborrades');
  }
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.id === 'file' && el.files[0]) return importJSON(el.files[0], el.dataset.mode);
  const c = el.dataset.c; if (!c) return;
  if (c === 'st') { st[el.dataset.k] = el.value; render(); }
  else if (c === 'hist') { st.hist[el.dataset.k] = el.value; render(); }
  else if (c === 'gtype') syncGameForm($('.sheet'));
  else if (c === 'sm-game') { setup.gid = el.value; drawSetup(); }
  else if (c === 'sm-kind') { setup.kind = el.value; setup.stats = el.value !== 'prova'; drawSetup(); }
  else if (c === 'sm-stats') setup.stats = el.checked;
});

/* ====================== Inici ====================== */
if (!S.settings.seeded) { if (!S.games.length) seed(true); S.settings.seeded = true; save(); }
render();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* sense mode offline */ });
}
})();
