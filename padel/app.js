const API = '/api/padel';
const DP = 'https://www.padelution.com/users/antti-ryynanen.15459';
const DT = 'https://www.padelution.com/clubleagues/sarjapadel/kausi-2026-27-miehet/vitonen/rosters/183417';
const qs = new URLSearchParams(location.search), LS = localStorage;
const P = qs.get('p') || LS.padelP || DP;
const T = qs.get('team') || LS.padelT || DT;
const $ = (s) => document.querySelector(s);
const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
const link = (x, u, c) => { const a = el('a', c, x); a.href = u; a.target = '_blank'; a.rel = 'noopener'; return a; };
let FRESH = false; try { FRESH = sessionStorage.padelFresh === '1'; sessionStorage.removeItem('padelFresh'); } catch {}
const api = async (q) => { const r = await fetch(API + '?' + new URLSearchParams(FRESH ? { ...q, r: Date.now() } : q)); const d = await r.json(); if (d.error) throw new Error(d.error); return d; };
// näytä edellinen tulos heti, päivitä taustalla
const lsGet = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
async function swr(key, fetcher, render, m) {
  const c = lsGet('padelC:' + key); let had = false;
  if (c) { try { render(c.d); had = true; } catch {} }
  try { const d = await fetcher(); lsSet('padelC:' + key, { d }); render(d); }
  catch (e) { if (!had) err(m, e); }
}
const WD = ['Su', 'Ma', 'Ti', 'Ke', 'To', 'Pe', 'La'];
const day = (d) => { const x = new Date(d + 'T12:00:00'); return WD[x.getDay()] + ' ' + x.getDate() + '.' + (x.getMonth() + 1) + '.'; };
const short = (d) => { const x = new Date(d + 'T12:00:00'); return x.getDate() + '.' + (x.getMonth() + 1) + '.'; };
const today = () => new Date().toISOString().slice(0, 10);
const court = (c) => (c || '').replace(/^(\d+)\.\s*/, '$1 · ');
const svg = (p) => `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${p}"/></svg>`;
const NAVS = [['index', 'Etusivu', 'M4 11l8-7 8 7v9H4z'], ['turnaukset', 'Turnaukset', 'M7 4h10v5a5 5 0 0 1-10 0zM12 14v5M8 20h8'], ['sarjapadel', 'Sarjapadel', 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z'], ['halli', 'Halli', 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z'], ['naficon', 'Naficon', 'M5 21V4M5 5h12l-2 4 2 4H5']];
const page = document.body.dataset.page;
NAVS.forEach(([id, t, p]) => { const a = el('a', 'ni' + (id === page ? ' on' : '')); a.href = id + '.html'; a.innerHTML = svg(p); a.append(t); $('#nav').append(a); });

const sec = (m, t) => m.append(el('h2', 'sec', t));
const err = (m, e) => { m.replaceChildren(); m.append(Object.assign(el('div', 'c err', 'Tietojen haku ei onnistunut: ' + e.message))); };
const header = (title, sub, chip) => {
  const h = el('div', 'hd'), d = el('div');
  if (sub) d.append(el('div', 'sm', sub));
  d.append(el('h1', '', title));
  if (chip) d.append(Object.assign(el('span', 'pill', chip), { style: 'background:#FFE08A;margin-top:8px' }));
  const b = el('button', 'ib'); b.setAttribute('aria-label', 'Päivitä'); b.onclick = () => { try { sessionStorage.padelFresh = '1'; } catch {} location.reload(); };
  b.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#33291C" stroke-width="2.2" stroke-linecap="round"><path d="M20 12a8 8 0 1 1-2.5-5.8"/><path d="M20 4v5h-5"/></svg>';
  h.append(d, b); return h;
};
function search(m, ph) {
  const s = el('div', 'srch'), i = el('input'); i.placeholder = ph; i.setAttribute('aria-label', ph); i.enterKeyHint = 'search';
  s.append(i); const res = el('div'); m.append(s, res);
  i.addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter') return;
    const v = i.value.trim(); if (!v) return;
    if (/\/rosters\/\d+$/.test(v)) { location.href = 'sarjapadel.html?team=' + encodeURIComponent(v); return; }
    res.replaceChildren(el('div', 'c sm', 'Haetaan joukkueita…'));
    try {
      const r = await api({ view: 'teams', q: v }); res.replaceChildren();
      if (!r.teams.length) res.append(el('div', 'c sm', 'Ei osumia. Kokeile toista nimeä tai liitä joukkueen Padelution-osoite.'));
      r.teams.forEach((t) => { const a = el('a', 'c r'); a.href = 'sarjapadel.html?team=' + encodeURIComponent(t.url); a.style.cssText = 'margin-top:8px;gap:12px'; const d = el('div'); d.style.flex = 1; d.append(el('div', 'b', t.name), el('div', 'sm', t.div + ' · ' + t.group + ' · ' + t.season.replace('kausi-', '').replace('-', '–'))); a.append(d, el('span', 'b', t.rec)); res.append(a); });
    } catch (x) { res.replaceChildren(el('div', 'c err', x.message)); }
  });
}
const dotRow = (win, title, sub, score) => {
  const c = el('div', 'c r'); c.style.gap = '14px';
  const d = el('div', 'dot', win === true ? 'V' : win === false ? 'H' : '–'); d.style.background = win === true ? 'var(--ok)' : win === false ? 'var(--bad)' : 'var(--mute)';
  const w = el('div'); w.style.flex = 1; w.append(el('div', 'b', title), el('div', 'sm', sub));
  const s = el('div', 'd b', score); s.style.cssText = 'font-size:16px;text-align:right;white-space:nowrap'; c.append(d, w, s); return c;
};
const item = (bg, a, b, title, sub) => {
  const c = el('div', 'c r'); c.style.gap = '14px';
  const k = el('div', 'blk'); k.style.background = bg; const x = el('div', 'd b', a); x.style.fontSize = '20px'; k.append(x, Object.assign(el('div', 'sm', b), { style: 'font-size:12px;margin-top:4px' }));
  const w = el('div'); w.append(Object.assign(el('div', 'b', title), { style: 'font-size:17px' }), el('div', 'sm', sub)); c.append(k, w); return c;
};
const nextNaf = (n) => {
  const y = new Date().getFullYear();
  for (const d of n.days) {
    const m = d.days.match(/^(\d+)\.(\d+)\.[-–]/) || d.days.match(/^(\d+)[-–]\d+\.(\d+)\./); if (!m) continue;
    const iso = y + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[1]).padStart(2, '0');
    if (iso >= today()) return { ...d, iso };
  } return null;
};

/* ---------- etusivu ---------- */
const pHome = (m) => swr('home:' + P + '|' + T, () => api({ view: 'dash', p: P, url: T }), (d) => renderHome(m, d), m);
function ratingChart(m, pl) {
  if (pl.rating == null) return;
  const k = 'padelH:' + pl.id, iso = new Date().toISOString().slice(0, 10);
  let hs = lsGet(k) || []; const last = hs[hs.length - 1];
  if (!last || last.d !== iso) hs.push({ d: iso, r: pl.rating, k: pl.rank }); else { last.r = pl.rating; last.k = pl.rank; }
  hs = hs.slice(-120); lsSet(k, hs);
  if (hs.length < 2) return;
  sec(m, 'Rating-kehitys');
  const W = 300, H = 70, rs = hs.map((x) => x.r), lo = Math.min(...rs), hi = Math.max(...rs), sp = hi - lo || 1;
  const pts = hs.map((x, i) => (6 + (W - 12) * i / (hs.length - 1)).toFixed(1) + ',' + (H - 8 - (H - 16) * (x.r - lo) / sp).toFixed(1)).join(' ');
  const c = el('div', 'c'); c.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="Rating-kehitys"><polyline fill="none" stroke="#E8A317" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" points="' + pts + '"/></svg>';
  c.append(el('div', 'sm', hs[0].r + ' → ' + hs[hs.length - 1].r + ' · ' + hs.length + ' mittauskertaa tällä laitteella'));
  m.append(c);
}
function renderHome(m, d) {
  const h = d.home, t = d.team, n = d.naficon, br = d.halli || { leagues: [] }, pl = h.player;
  m.replaceChildren();
  m.append(header(pl.name, 'Hei, tervetuloa takaisin', [pl.rank && '#' + pl.rank, pl.rating != null && 'rating ' + pl.rating].filter(Boolean).join(' · ')));
  if (h.warn && h.warn.length) { const w = el('div', 'note', '⚠ Osa tiedoista puuttuu: ' + h.warn.join(' · ')); w.style.cssText = 'background:#FFE3D6;color:#7A2E12;border-radius:12px;padding:8px 12px;margin:8px 0;text-align:left'; m.append(w); }
  const nx = h.next, tn = t && t.upcoming && t.upcoming[0];
  const hero = el('a', 'hero'); hero.style.cssText = 'display:block;padding:14px 16px';
  const pathRow = (lbl, x, bg) => { const r = el('div', 'r'); r.style.cssText = 'justify-content:space-between;gap:8px;padding:6px 0;font-size:14px'; r.append(el('b', '', lbl), el('span', '', x ? (x.time ? day(x.date) + ' ' + x.time + ' · ' : '') + x.opp : 'ei tiedossa')); return r; };
  if (nx) {
    hero.href = nx.url; hero.target = '_blank'; hero.rel = 'noopener';
    hero.append(el('div', 'b', 'Seuraava peli'), Object.assign(el('div', 'd', day(nx.date) + (nx.untimed ? ' · aika ei tiedossa' : ' klo ' + nx.time)), { style: 'font-size:20px;font-weight:700' }), Object.assign(el('div', 'd', nx.mine), { style: 'font-size:22px;font-weight:700;line-height:1.1;margin-top:8px' }), Object.assign(el('div', 'd', 'vs ' + nx.opp), { style: 'font-size:17px;margin-top:2px' }));
    const ch = el('div', 'r'); ch.style.cssText = 'gap:6px;margin-top:10px;flex-wrap:wrap';
    if (nx.court) ch.append(el('span', 'pill', 'Kenttä ' + court(nx.court))); ch.append(el('span', 'pill', nx.class));
    hero.append(ch);
    const pr = el('div'); pr.style.cssText = 'margin-top:10px;border-top:1px solid rgba(51,41,28,.2);padding-top:4px';
    pr.append(pathRow('Jos voitat', nx.win), pathRow('Jos häviät', nx.lose && { ...nx.lose, opp: nx.lose.label + ': ' + nx.lose.opp }));
    hero.append(pr, Object.assign(el('div', 'sm', nx.event + ' · avaa kaavio ›'), { style: 'color:#5C4B2E;margin-top:4px;font-size:13px' }));
  } else if (tn) {
    hero.href = t.url; hero.target = '_blank'; hero.rel = 'noopener';
    const opp = tn.home === t.name ? tn.away : tn.home;
    hero.append(el('div', 'b', 'Seuraava peli'), Object.assign(el('div', 'd', day(tn.date) + ' klo ' + tn.time), { style: 'font-size:20px;font-weight:700' }), Object.assign(el('div', 'd', t.name + ' vs ' + opp), { style: 'font-size:20px;font-weight:700;margin-top:6px' }));
    if (tn.court) hero.append(Object.assign(el('span', 'pill', 'Kenttä ' + tn.court), { style: 'margin-top:8px' }));
  } else hero.append(el('div', 'b', 'Seuraava peli'), el('div', 'd t1', 'Ei tiedossa'));
  m.append(hero);
  (h.later || []).forEach((x) => {
    const c = el('a', 'c'); c.href = x.url; c.target = '_blank'; c.rel = 'noopener'; c.style.cssText = 'display:flex;gap:12px;align-items:baseline;margin-top:10px;padding:10px 14px';
    const w = el('div'); w.style.flex = 1; w.append(el('div', 'b', x.mine + ' vs ' + x.opp), el('div', 'sm', x.class + (x.court ? ' · kenttä ' + court(x.court) : '')));
    c.append(Object.assign(el('span', 'd b', day(x.date) + (x.untimed ? ' · aika ei tiedossa' : ' ' + x.time)), { style: 'font-size:15px;white-space:nowrap' }), w); m.append(c);
  });

  sec(m, 'Seuraavat');
  const items = [];
  const nf = n && nextNaf(n); if (nf) items.push([nf.iso, ['var(--sage)', short(nf.iso), '–' + nf.days.split(/[-–]/).pop().replace(/\.$/, ''), 'Naficon Liiga · kierros ' + nf.n, 'Naficon Arena', n.url]]);
  if (tn) { const rd = t.standing && t.standing.rounds.find((r) => tn.date >= r.from && tn.date <= r.to); items.push([tn.date, ['var(--apr)', short(tn.date), tn.time, 'Sarjapadel · ' + (tn.home === t.name ? tn.away : tn.home), t.name + (tn.court ? ' · kenttä ' + tn.court : '') + (rd ? ' · ' + rd.place.split('/').pop().trim() : ''), t.url]]); }
  const nt = h.events.filter((e) => e.date >= today() && (!nx || e.title !== nx.event)).sort((a, b) => a.date.localeCompare(b.date))[0];
  items.push([nt ? nt.date : '9999', nt ? ['var(--sky)', short(nt.date), 'turnaus', nt.title, 'Seuraava turnaus', nt.url] : ['var(--sky)', '–', 'turnaus', 'Seuraava turnaus', 'ei tiedossa', null]]);
  items.sort((a, b) => a[0].localeCompare(b[0])).forEach(([, a]) => { const c = item(...a.slice(0, 5)); if (a[5]) { c.style.cursor = 'pointer'; c.onclick = () => window.open(a[5], '_blank'); } m.append(c); });
  const bl = br.leagues[0]; if (bl) { const c = item('var(--sand,#FFF1C4)', String(bl.left), 'ottelua', 'Boost-liiga · pelaamatta', bl.league + ' · ' + bl.group + ' · ei sovittua aikaa'); c.style.cursor = 'pointer'; c.onclick = () => window.open(bl.url, '_blank'); m.append(c); }

  sec(m, 'Viimeksi pelatut');
  h.recent.slice(0, 3).forEach((r) => { const c = dotRow(r.win, r.opp || '?', r.title, r.score.replace(/\s*\|\s*/g, ' · ')); c.style.cursor = 'pointer'; c.onclick = () => window.open(r.url, '_blank'); m.append(c); });
  ratingChart(m, pl);
  m.append(el('div', 'note', 'Päivitetty ' + new Date(h.fetchedAt).toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' })));
}

/* ---------- sarjapadel ---------- */
const pTeam = (m) => swr('team:' + T, () => api({ view: 'team', url: T }), (d) => { const i = m.querySelector('input'); if (i && i.value) return; renderTeam(m, d); }, m);
function renderTeam(m, t) {
  m.replaceChildren();
  m.append(header('Sarjapadel', t.season.replace('kausi-', 'Kausi ').replace('-', '–')));
  search(m, 'Hae joukkue, esim. Boost');
  const st = t.standing, own = t.name;
  const pr = el('div', 'r'); pr.style.cssText = 'gap:8px;margin:12px 20px 0;flex-wrap:wrap'; pr.append(Object.assign(el('span', 'pill', own), { style: 'background:var(--sun)' }));
  if (LS.padelT && LS.padelT !== t.url) pr.append(Object.assign(link('Oma joukkue', 'sarjapadel.html?team=' + encodeURIComponent(LS.padelT), 'pill o'), { target: '_self' }));
  if (LS.padelT !== t.url) { const b = el('button', 'pill o', 'Tallenna omaksi'); b.onclick = () => { LS.padelT = t.url; location.reload(); }; pr.append(b); }
  m.append(pr);
  const hero = el('div', 'hero'); hero.append(el('div', 'd', own), Object.assign(el('div', '', t.division[0].toUpperCase() + t.division.slice(1) + (st ? ' · ' + st.group.toLowerCase() + ' · ' + st.size + ' joukkuetta' : '')), { style: 'color:#5C4B2E' }));
  hero.firstChild.style.cssText = 'font-size:30px;font-weight:700;line-height:1.1';
  if (st) { const r = el('div', 'r'); r.style.cssText = 'gap:10px;margin-top:14px'; [['Sija', st.rank + '.'], ['Ottelut', st.rec.replace(/\s/g, '').replace('-', '–')], ['Pisteet', st.pts]].forEach(([a, b]) => { const s = el('div', 'stat'); s.append(el('div', 'sm', a), el('div', 'd', b)); r.append(s); }); hero.append(r); }
  m.append(hero);
  sec(m, 'Kierrokset');
  const all = [...t.played, ...t.upcoming]; let nextDone = false;
  (st ? st.rounds : []).forEach((r) => {
    const ts = all.filter((x) => x.date >= r.from && x.date <= r.to).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    const done = ts.length && ts.every((x) => x.score), isNext = !done && !nextDone && r.to >= today(); if (isNext) nextDone = true;
    const c = el('div', 'c'); if (done) c.style.background = 'var(--sage)'; if (isNext) c.style.border = '3px solid var(--sun)';
    const hd = el('div', 'r'); hd.style.justifyContent = 'space-between'; hd.append(Object.assign(el('span', 'b', r.name + ' · ' + (r.from === r.to ? day(r.from) : short(r.from) + '–' + short(r.to))), { style: 'font-size:17px' }));
    if (done || isNext) hd.append(Object.assign(el('span', 'pill', done ? 'Pelattu' : 'Seuraava'), { style: done ? 'background:var(--ok);color:#fff' : 'background:var(--sun2)' }));
    c.append(hd, el('div', 'sm', r.place));
    const ls = el('div'); ls.style.cssText = 'margin-top:8px;display:flex;flex-direction:column;gap:8px';
    ts.forEach((x) => {
      const opp = x.home === own ? x.away : x.home, row = el('div', 'r'); row.style.gap = '12px';
      if (x.score) { const [a, b] = x.score.split('-').map((n) => +n), me = x.home === own ? a : b, ot = x.home === own ? b : a; row.append(Object.assign(el('span', '', opp), { style: 'flex:1' }), el('span', 'b', me + '–' + ot + (me > ot ? ' voitto' : me < ot ? ' tappio' : ''))); }
      else { const tm = el('span', 'd b', x.time); tm.style.cssText = 'font-size:' + (isNext ? 22 : 16) + 'px;width:' + (isNext ? 62 : 48) + 'px'; row.append(tm, Object.assign(el('span', 'b', opp), { style: 'flex:1' })); if (x.court) row.append(Object.assign(el('span', 'pill', 'Kenttä ' + x.court), { style: 'background:var(--sun3)' })); }
      ls.append(row);
    });
    if (!ts.length) ls.append(el('div', 'sm', 'Ottelut julkaistaan myöhemmin.')); c.append(ls); m.append(c);
  });
  if (st) {
    sec(m, st.group[0] + st.group.slice(1).toLowerCase());
    const c = el('div', 'c'); c.style.padding = '6px 12px'; const tb = el('div'); c.append(tb);
    const draw = (full) => {
      tb.replaceChildren(); const h = el('div', 'row tbl sm'); ['#', 'Joukkue', 'Ottelut'].forEach((x) => h.append(el('span', '', x))); h.style.borderTop = '0'; tb.append(h);
      st.rows.forEach((r) => { const me = r.url === t.url; if (!full && r.rank > 7 && !me) return; const w = el('div', 'row tbl' + (me ? ' me' : '')); [r.rank, r.name, (r.c[0] || '').replace(/\(.*?\)/g, '').replace(/\s/g, '').replace('-', '–')].forEach((x) => w.append(el('span', '', String(x)))); tb.append(w); });
      if (st.rows.length > 7) { const b = el('button', 'pill', full ? 'Näytä vähemmän' : 'Näytä kaikki ' + st.rows.length); b.style.cssText = 'display:block;margin:8px auto;background:none;color:#8A5A00'; b.onclick = () => draw(!full); tb.append(b); }
    };
    draw(false); m.append(c);
  }
  sec(m, 'Kokoonpano');
  const c = el('div', 'c'), w = el('div', 'r'); w.style.cssText = 'gap:8px;flex-wrap:wrap';
  t.players.forEach((p) => w.append(Object.assign(link(p.name + (p.captain ? ' (kapteeni)' : ''), p.url, 'pill'), { style: 'background:' + (p.captain ? 'var(--sun2)' : 'var(--sun3)') })));
  c.append(w); m.append(c);
  m.append(link('Joukkue Padelutionissa', t.url, 'note')); m.lastChild.style.display = 'block';
}

/* ---------- turnaukset ---------- */
async function pEvents(m) {
  let h; try { h = await api({ view: 'home', p: P, tt: 1 }); } catch (e) { return err(m, e); }
  m.replaceChildren(); m.append(header('Turnaukset', h.player.name));
  const up = h.events.filter((e) => e.date >= today()).reverse(), past = h.events.filter((e) => e.date < today());
  sec(m, 'Tulevat');
  if (!up.length) m.append(el('div', 'c sm', 'Ei tulevia turnauksia.'));
  up.forEach((e) => { const c = item('var(--apr)', short(e.date), '', e.title, 'Avaa Padelutionissa'); c.style.cursor = 'pointer'; c.onclick = () => window.open(e.url, '_blank'); m.append(c); h.upcoming.filter((x) => x.event === e.title).forEach((x) => m.append(Object.assign(el('div', 'c sm', day(x.date) + ' ' + x.time + ' · ' + x.teams + (x.court ? ' · kenttä ' + court(x.court) : '')), { style: 'margin:-4px 20px 10px;background:var(--sun3)' }))); });
  sec(m, 'Pelatut');
  past.forEach((e) => { const c = item('var(--sun3)', short(e.date), '', e.title, ''); c.style.cursor = 'pointer'; c.onclick = () => window.open(e.url, '_blank'); m.append(c); });
}

/* ---------- halli ---------- */
async function pHalli(m) {
  let h, b; try { const d = await api({ view: 'dash', p: P, parts: 'halli' }); h = d.home; b = d.halli; if (!b) throw new Error('Boost-liigan haku epäonnistui'); } catch (e) { return err(m, e); }
  m.replaceChildren(); m.append(header('Halliliigat', 'Boost Padel League'));
  if (!b.leagues.length) m.append(el('div', 'c sm', 'Pelaajaa ei löytynyt Boost-liigan lohkoista.'));
  b.leagues.forEach((l) => {
    sec(m, l.league[0].toUpperCase() + l.league.slice(1) + ' · ' + l.group.toLowerCase());
    const c = el('div', 'c'); c.style.padding = '6px 12px';
    l.rows.forEach((r, i) => { const w = el('div', 'row' + (i === l.me ? ' me' : '')); [i + 1, r.name, r.w + '–' + r.l, r.p].forEach((x) => w.append(el('span', '', String(x)))); c.append(w); });
    c.append(el('div', 'sm', 'Pelaamatta: ' + l.left + ' ottelua. Ajat sovitaan parien kesken.')); c.lastChild.style.padding = '8px 4px'; m.append(c, link('Avaa Padelutionissa', l.url, 'note')); m.lastChild.style.display = 'block';
  });
}

/* ---------- naficon ---------- */
async function pNaf(m) {
  let h, n; try { const d = await api({ view: 'dash', p: P, parts: 'naficon' }); h = d.home; n = d.naficon; if (!n) throw new Error('Naficon-haku epäonnistui'); } catch (e) { return err(m, e); }
  m.replaceChildren(); m.append(header('Naficon Liiga', 'Naficon Arena'));
  sec(m, 'Pelipäivät ' + n.label); const nx = nextNaf(n);
  n.days.forEach((d) => { const c = el('div', 'c r'); c.style.justifyContent = 'space-between'; if (nx && nx.n === d.n) c.style.border = '3px solid var(--sun)'; c.append(el('span', 'b', 'Kierros ' + d.n), el('span', '', d.days)); m.append(c); });
  sec(m, 'Sinun kierroksesi');
  h.leagues.filter((l) => /Naficon/.test(l.title)).slice(0, 6).forEach((l) => { const c = el('div', 'c'); c.append(link(l.title.replace(/^Naficon Liiga - (Naficon Liiga - )?/, ''), l.url)); m.append(c); });
}
({ index: pHome, sarjapadel: pTeam, turnaukset: pEvents, halli: pHalli, naficon: pNaf })[page]($('#m'));
