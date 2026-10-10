// Netlify Function /api/padel
// views: home | team | teams | halli | naficon   (lisää &debug=1 home/team-näkymään: palauttaa sivun raakatekstin)
const B = 'https://www.padelution.com';
const SEAS = ['kausi-2026-27-miehet', 'kausi-2026-27-naiset'];
const DP = B + '/users/antti-ryynanen.15459';
const BOOST = ['boost-league-avoin-fall-edition', 'boost-league-mixty-fall-edition', 'boost-league-senior-fall-edition'];
const cache = new Map();

const inflight = new Map();
const get = async (u, ttl = 9e4) => {
  const c = cache.get(u);
  if (c && Date.now() - c.t < ttl) return c.v;
  if (inflight.has(u)) return inflight.get(u);
  const pr = (async () => {
    const ac = new AbortController(), to = setTimeout(() => ac.abort(), 8000);
    try {
      const r = await fetch(u, { headers: { 'user-agent': 'padel-dashboard/1.0 (personal use)' }, signal: ac.signal });
      if (!r.ok) throw new Error(r.status + ' ' + u);
      const v = await r.text();
      cache.set(u, { t: Date.now(), v });
      return v;
    } catch (e) { if (c) return c.v; throw e; } // verkkovirhe: käytä vanhaa kopiota
    finally { clearTimeout(to); inflight.delete(u); }
  })();
  inflight.set(u, pr);
  return pr;
};
const ent = (s) => s.replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&#0?39;/g, "'").replace(/&quot;/g, '"');
const txt = (h) => ent(h.replace(/<(script|style)[\s\S]*?<\/\1>/g, '').replace(/<[^>]+>/g, '\n')).replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
const flat = (h) => txt(h).replace(/\n/g, ' ').trim();
const abs = (u) => (u.startsWith('http') ? u : B + u);
const anchors = (h) => [...h.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => ({ u: m[1], t: flat(m[2]), s: m.index, e: m.index + m[0].length }));
const uid = (u) => (u.match(/\.(\d+)(?:[/?#].*)?$/) || [])[1];
const norm = (p) => {
  p = (p || '').trim();
  if (/^\d+$/.test(p)) return `${B}/users/${p}`;
  if (p.startsWith('http')) return p.split('#')[0].split('?')[0];
  return `${B}/users/${p.replace(/^\/?users\//, '')}`;
};
const fmt = (d) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Helsinki', dateStyle: 'short', timeStyle: 'short' }).format(d).replace(' ', 'T');
const addDays = (d, n) => new Date(Date.parse(d + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const isoDM = (dd, mm) => {
  const n = new Date(); let d = new Date(Date.UTC(n.getFullYear(), mm - 1, dd));
  if (d < n - 120 * 864e5) d = new Date(Date.UTC(n.getFullYear() + 1, mm - 1, dd));
  return d.toISOString().slice(0, 10);
};

// ---------- jaettu: sarjataulukot (sarjapadel-sarja ja Boost-liiga) ----------
function groups(h) {
  return h.split('<table').slice(1).map((p) => {
    const trs = p.split('<tr').slice(1);
    const name = flat('<tr' + (trs[0] || '')).replace(/\s*(Matches|M)\s+(P|W).*$/, '').trim();
    const rows = trs.slice(1).map((r) => {
      const c = [...r.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => flat(m[1]));
      if (!c.length) return null;
      const a = r.match(/<a[^>]+href="([^"]*\/rosters\/\d+)"/);
      return { url: a ? abs(a[1]) : '', name: c[0], c: c.slice(1) };
    }).filter(Boolean);
    rows.forEach((r, i) => (r.rank = i + 1));
    const L = txt((p.split('</table>')[1] || '')).split('\n'), rounds = [];
    L.forEach((l, i) => {
      const m = (L[i + 1] || '').match(/^\((\d\d)\.(\d\d)\.(\d{4}) - (\d\d)\.(\d\d)\.(\d{4}),?\s*(.*)\)$/);
      if (/^(Kierros|Jatkosarjat|Play-Offs|Putoamiskarsinnat)/.test(l) && m)
        rounds.push({ name: l, from: `${m[3]}-${m[2]}-${m[1]}`, to: `${m[6]}-${m[5]}-${m[4]}`, place: m[7] });
    });
    return { name, rows, rounds };
  });
}

// ---------- joukkuesivu: ottelut ----------
const half = (l) => { const n = l.length, k = (n - 1) / 2; return n % 2 && l[k] === ' ' && l.slice(0, k) === l.slice(k + 1) ? l.slice(0, k) : l; };
const DTRE = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) (\d\d)\.(\d\d) (\d\d:\d\d)(?: - Court (\d+))?/;
function ties(lines) {
  const joined = lines.some((l) => half(l) !== l), L = lines.map(half);
  let T = L;
  if (!joined) { T = []; for (let i = 0; i < L.length;) { let j = i; while (j < L.length && L[j] === L[i]) j++; for (let x = 0; x < Math.max(1, Math.round((j - i) / 2)); x++) T.push(L[i]); i = j; } }
  const out = [];
  T.forEach((t, i) => {
    const m = t.match(DTRE); if (!m) return;
    let a = i - 1, score = '';
    while (a >= 0 && (T[a] === 'Details' || /^\d+\s*-\s*\d+$/.test(T[a]))) { if (/\d/.test(T[a])) score = T[a]; a--; }
    out.push({ date: isoDM(+m[2], +m[3]), time: m[4], court: m[5] || '', home: T[a] || '', away: T[i + 1] || '', score });
  });
  return out;
}
async function team(url, dbg) {
  if (!url.startsWith(B) || !/\/rosters\/\d+$/.test(url)) throw new Error('Virheellinen joukkueen osoite');
  const h = await get(url), L = txt(h).split('\n');
  if (dbg) return L.join('\n').slice(0, 9000);
  const name = flat((h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [, ''])[1]);
  const A = anchors(h), mi = h.search(/>\s*Matches\s*</), seen = new Set();
  const players = A.filter((a) => /\/users\//.test(a.u) && a.t && (mi < 0 || a.s < mi) && !seen.has(a.u) && seen.add(a.u)).map((a) => {
    const nx = A.find((x) => x.s > a.e);
    return { name: a.t, url: abs(a.u), captain: /Captain/.test(h.slice(a.e, nx ? nx.s : a.e + 300)) };
  });
  const iM = L.indexOf('Matches'), iU = L.indexOf('Upcoming'), iE = L.findIndex((l) => l === 'Your location');
  const end = iE < 0 ? L.length : iE;
  const played = iM < 0 ? [] : ties(L.slice(iM + 1, iU < 0 ? end : iU));
  const upcoming = iU < 0 ? [] : ties(L.slice(iU + 1, end));
  const divUrl = url.replace(/\/rosters\/\d+$/, '');
  let standing = null;
  try {
    for (const g of groups(await get(divUrl, 3e5))) {
      const r = g.rows.find((x) => x.url === url);
      if (r) standing = { group: g.name, rank: r.rank, size: g.rows.length, rec: r.c[0], pts: r.c[1], rows: g.rows, rounds: g.rounds };
    }
  } catch {}
  return { name, url, division: decodeURIComponent(divUrl.split('/').pop()), season: divUrl.split('/').slice(-2)[0], players, played, upcoming, standing };
}
async function teamIndex() {
  const out = new Map();
  await Promise.all(SEAS.map(async (s) => {
    try {
      const base = `${B}/clubleagues/sarjapadel/${s}`, h0 = await get(base, 6 * 36e5);
      const divs = [...new Set(anchors(h0).map((a) => abs(a.u).split('#')[0]).filter((u) => u.startsWith(base + '/') && !u.slice(base.length + 1).includes('/')))];
      await Promise.all(divs.map(async (u) => {
        const dv = decodeURIComponent(u.split('/').pop());
        groups(await get(u, 6 * 36e5).catch(() => '')).forEach((g) => g.rows.forEach((r) => r.url && out.set(r.url, { name: r.name, url: r.url, season: s, div: dv, group: g.name, rec: r.c[0], pts: r.c[1] })));
      }));
    } catch {}
  }));
  return [...out.values()];
}

// ---------- Boost-liiga ----------
async function halli(name) {
  const res = [];
  for (const slug of BOOST) {
    try {
      const u = `${B}/leagues/boost-padel-league/boost-padel-liiga/${slug}`;
      for (const g of groups(await get(u, 3e5))) {
        const me = g.rows.findIndex((r) => name && r.name.toLowerCase().includes(name.toLowerCase()));
        if (me >= 0) res.push({ league: slug.replace('boost-league-', '').replace('-fall-edition', ''), url: u, group: g.name, rows: g.rows.map((r) => ({ name: r.name, m: +r.c[0], w: +r.c[1], l: +r.c[2], p: +r.c[3] })), me, left: g.rows.length - 1 - (+g.rows[me].c[0]) });
      }
    } catch {}
  }
  return { leagues: res };
}

// ---------- Naficon ----------
async function naficon() {
  const t = flat(await get(B + '/leagues/naficon-liiga', 36e5));
  const sec = (t.split('Pelipäivät')[1] || '').split('Categories')[0];
  const label = ((sec.match(/^[,\s]*([^\d]*\d{4})/) || [, ''])[1] || '').replace(/^[,\s]+/, '');
  const days = [...sec.matchAll(/[Kk]ierros\s+(\d[\d.\-–]*)/g)].map((m, i) => ({ n: i + 1, days: m[1] }));
  return { label, days, url: B + '/leagues/naficon-liiga' };
}

// ---------- kaavio: seuraava ottelu, voitto- ja häviöpolku ----------
function parseBracket(h) {
  const m = h.replace(/<a[^>]+href="[^"]*\/users\/[^"]*\.(\d+)[^"]*"[^>]*>([\s\S]*?)<\/a>/g, (_, id, t) => `\n@@${id}@@${flat(t)}\n`);
  const L = txt(m).split('\n'), start = L.indexOf('Main');
  if (start < 0) return [];
  const secs = []; let sec = null, cur = { p: [], time: '', court: '' };
  const close = () => { if (cur.p.length && sec) sec.matches.push(cur); cur = { p: [], time: '', court: '' }; };
  const part = (x) => { if (cur.p.length >= 2) close(); cur.p.push(x); };
  for (let i = start; i < L.length; i++) {
    const l = L[i];
    if (l === 'Your location') break;
    if (l === 'Main' || /^Places \d/.test(l)) { close(); secs.push(sec = { label: l, matches: [] }); continue; }
    const a = l.match(/^@@(\d+)@@(.*)$/);
    if (a) {
      const b = (L[i + 1] || '').match(/^@@(\d+)@@(.*)$/);
      if (b) { part({ ids: [a[1], b[1]], name: a[2].split(' ').pop() + ' / ' + b[2].split(' ').pop() }); i++; } else part({ ids: [a[1]], name: a[2] });
      continue;
    }
    if (l === 'BYE' || l === 'Pending') { part({ tag: l }); continue; }
    if (/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d{1,2}:\d{2}$/.test(l)) { cur.time = l; continue; }
    if (/^(\d+\.\s*.+|Court \?)$/.test(l)) { cur.court = l === 'Court ?' ? '' : l; close(); }
  }
  close();
  return secs;
}
const WDN = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const wdDate = (start, w) => { for (let k = 0; k < 7; k++) { const d = addDays(start, k); if (new Date(d + 'T12:00:00Z').getUTCDay() === WDN[w]) return d; } return start; };
const byTime = (a, b) => (a.time ? a.date + a.time : '9999' + a.date).localeCompare(b.time ? b.date + b.time : '9999' + b.date);
const idRe = (id) => new RegExp('/users/[^"\\s]*\\.' + id + '(?!\\d)');
function analyze(secs, ev, cname, curl, id, cut) {
  const M = secs[0] ? secs[0].matches : [], sizes = [], off = [];
  for (let n = (M.length + 1) / 2, o = 0; n >= 1; n /= 2) { sizes.push(n); off.push(o); o += n; }
  const nm = (p) => (p && p.ids ? p.name : p && p.tag === 'BYE' ? 'ei vastustajaa' : 'ei tiedossa');
  const pair = (m) => m.p.map(nm).join(' – ');
  const mk = (m, date, time, o) => ({ date, time, court: m.court, opp: o });
  const mine = [];
  secs.forEach((sc, si) => sc.matches.forEach((m, mi) => {
    if (!m.p.some((p) => p.ids && p.ids.includes(id))) return;
    if (m.time) { const [w, t] = m.time.split(' '); mine.push({ si, mi, m, date: wdDate(ev.date, w), time: t.padStart(5, '0') }); }
  }));
  return mine.filter((x) => !x.time || x.date + 'T' + x.time >= cut).sort(byTime).map((cur) => {
    const slot = cur.m.p.findIndex((p) => p.ids && p.ids.includes(id)), opp = cur.m.p[1 - slot] || { tag: 'Pending' };
    let r = -1, j = 0;
    if (cur.si === 0) for (let k = 0; k < sizes.length; k++) if (cur.mi >= off[k] && cur.mi < off[k] + sizes[k]) { r = k; j = cur.mi - off[k]; }
    const feeder = (k, jj) => (k >= 0 && M[off[k] + jj] ? 'voittaja: ' + pair(M[off[k] + jj]) : 'ei tiedossa');
    const oppTxt = opp.ids || opp.tag === 'BYE' ? nm(opp) : r > 0 ? feeder(r - 1, 2 * j + (1 - slot)) : 'ei tiedossa';
    let win = null, lose = null;
    if (r >= 0 && r < sizes.length - 1) {
      const nx = M[off[r + 1] + Math.floor(j / 2)];
      if (nx && nx.time) { const [w, t] = nx.time.split(' '); const os = nx.p[1 - (j % 2)] || {}; win = mk(nx, wdDate(ev.date, w), t.padStart(5, '0'), os.ids || os.tag === 'BYE' ? nm(os) : feeder(r, 2 * Math.floor(j / 2) + (1 - (j % 2)))); }
      // häviäjä siirtyy sijoituskaavion ottelun r-kierroksen häviäjien osioon: vastustajana sisarottelun häviäjä
      const sib = M[off[r] + (j ^ 1)], sibLoser = sib ? 'häviäjä: ' + pair(sib) : 'ei tiedossa';
      const sc = secs.slice(1).find((x) => { const mm = x.label.match(/(\d+)-(\d+)/); return mm && +mm[2] - +mm[1] + 1 === sizes[r]; });
      if (sc) {
        const pm = sc.matches[Math.floor(j / 2)], label = sc.label.replace('Places ', 'sijat ');
        if (pm && pm.time) { const [w, t] = pm.time.split(' '); lose = { ...mk(pm, wdDate(ev.date, w), t.padStart(5, '0'), sibLoser), label }; }
        else lose = { date: '', time: '', court: '', opp: sibLoser, label };
      }
    }
    return { class: cname, url: curl, eventUrl: ev.url, event: ev.title, date: cur.date, time: cur.time, untimed: !cur.time, court: cur.m.court, mine: nm(cur.m.p[slot]), opp: oppTxt, win, lose };
  });
}
async function bracketsFor(ev, id, warn) {
  const h0 = await get(ev.url + '/brackets');
  let cls = [...new Map(anchors(h0).filter((a) => /\/brackets\/\d+/.test(a.u) && a.t).map((a) => { const u = abs(a.u).split('#')[0]; return [u, { url: u, name: a.t }]; })).values()];
  if (!cls.length) cls = [{ url: ev.url + '/brackets', name: '' }];
  const cut = fmt(new Date(Date.now() - 90 * 6e4)), re = idRe(id);
  const out = await Promise.all(cls.slice(0, 14).map(async (c) => {
    const h = await get(c.url).catch(() => '');
    if (!re.test(h)) return [];
    const secs = parseBracket(h);
    if (!secs.length) { warn.push('Kaavion luku epäonnistui: ' + ev.title + (c.name ? ' / ' + c.name : '')); return []; }
    return analyze(secs, ev, c.name, c.url + '#bracket', id, cut);
  }));
  return out.flat();
}

// ---------- etusivu: pelaajan profiili ----------
async function timetable(ev, sur) {
  let h; try { h = await get(ev.url + '/timetable'); } catch { return []; }
  const first = h.indexOf('<table');
  const courts = txt(h.slice(0, first < 0 ? 0 : first)).split('\n').map((l) => l.match(/^\d+\.\s+(\D.*)$/)).filter(Boolean).map((m) => m[0]);
  const re = new RegExp(sur, 'i'), out = [];
  h.split('<table').slice(1).forEach((tb, i) => {
    let r = -1;
    tb.split(/<tr/).slice(1).forEach((row) => {
      const cells = row.split(/<td/).slice(1); if (!cells.length) return; r++;
      cells.forEach((c) => {
        const m = flat(c).match(/(\d{1,2}:\d{2})\s+(.+?)\s*\(\s*([\d\s-]*)\)\s*(.+)/);
        if (m && re.test(m[4])) out.push({ date: addDays(ev.date, i), time: m[1].padStart(5, '0'), cls: m[2], round: m[3].trim(), teams: m[4], court: '', event: ev.title, url: ev.url + '/timetable', bracket: ev.url + '/brackets' });
      });
    });
  });
  return out;
}
async function profile(p, dbg) {
  const h = await get(p);
  if (dbg) return txt(h).slice(0, 8000);
  const t = flat(h);
  const name = flat((h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [, ''])[1]);
  const id = uid(p), sur = name.split(' ').pop();
  const num = (k) => { const m = t.match(new RegExp(k + '\\s+(-?\\d+)')); return m ? +m[1] : null; };
  const rk = t.match(/#(\d+) \(([\d.]+)\)/);
  const player = { id, name, url: p, rating: num('Rating'), matches: num('Matches'), sets: num('Sets \\+-'), games: num('Games \\+-'), rank: rk ? +rk[1] : null, rankPts: rk ? rk[2] : null };
  const A = anchors(h), seen = new Set();
  const events = A.filter((a) => /\/events\/[^/#?]+$/.test(a.u)).map((a) => {
    const m = a.t.match(/^(\d\d)\.(\d\d)\.(\d{4})\s+(.+)/);
    return m && { url: abs(a.u), date: `${m[3]}-${m[2]}-${m[1]}`, title: m[4] };
  }).filter((e) => e && !seen.has(e.url) && seen.add(e.url));
  const ls = new Set();
  const leagues = A.filter((a) => /\/leagues\/|\/clubleagues\//.test(a.u) && a.t).map((a) => ({ url: abs(a.u), title: a.t })).filter((l) => !ls.has(l.url) && ls.add(l.url));
  const sec = h.split(/Latest Matches/)[1] || '', SA = anchors(sec);
  const T = SA.filter((a) => /\/(leagues|events|clubleagues)\//.test(a.u) && a.t);
  const recent = T.map((a, i) => {
    const end = T[i + 1] ? T[i + 1].s : sec.length, seg = sec.slice(a.e, end);
    const pl = SA.filter((x) => x.s >= a.e && x.e <= end && /\/users\//.test(x.u) && x.t).map((x) => ({ id: uid(x.u), name: x.t }));
    const rest = flat(seg.replace(/<a[\s\S]*?<\/a>/g, ' '));
    const score = (rest.match(/\d+\s*-\s*\d+(?:\s*\|\s*\d+\s*-\s*\d+)*/) || [''])[0] || (/WO/.test(rest) ? 'WO' : '');
    const mine = pl.findIndex((x) => x.id === id), tm = mine < 0 ? 0 : mine < 2 ? 1 : 2;
    let win = null;
    if (tm && /\d/.test(score)) {
      let w1 = 0, w2 = 0;
      score.split('|').forEach((s) => { const [x, y] = s.split('-').map((n) => parseInt(n, 10)); if (x > y) w1++; else if (y > x) w2++; });
      win = w1 === w2 ? null : tm === 1 ? w1 > w2 : w2 > w1;
    }
    const nm = (arr) => arr.map((x) => x.name).join(' / ');
    return { title: a.t, url: abs(a.u), opp: nm(tm === 2 ? pl.slice(0, 2) : pl.slice(2)), score, win };
  }).slice(0, 12);
  return { player, id, sur, recent, events, leagues };
}
async function matchesFor(prof, tt) {
  const lim = new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10), soon = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);
  const evs = prof.events.filter((e) => e.date >= lim && e.date <= soon).slice(0, 4);
  const warn = [];
  const [br, tts] = await Promise.all([
    Promise.allSettled(evs.map((e) => bracketsFor(e, prof.id, warn))),
    tt ? Promise.all(evs.map((e) => timetable(e, prof.sur))) : Promise.resolve([]),
  ]);
  br.forEach((r, i) => { if (r.status === 'rejected') warn.push('Tapahtuman haku epäonnistui: ' + evs[i].title); });
  const list = br.flatMap((r) => (r.status === 'fulfilled' ? r.value : [])).sort(byTime);
  const cut = fmt(new Date(Date.now() - 90 * 6e4));
  const upcoming = tts.flat().filter((m) => m.date + 'T' + m.time >= cut).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  return { next: list[0] || null, later: list.slice(1, 5), upcoming, warn };
}
const shape = (prof, x) => ({ player: prof.player, recent: prof.recent, events: prof.events.slice(0, 10), leagues: prof.leagues, next: null, later: [], upcoming: [], warn: [], ...x, fetchedAt: new Date().toISOString() });
async function home(p, dbg, tt) {
  const prof = await profile(p, dbg);
  if (typeof prof === 'string') return prof;
  return shape(prof, await matchesFor(prof, tt));
}
// yksi kutsu hakee kaiken rinnakkain
async function dash(q) {
  const p = norm(q.get('p') || DP);
  if (!p.startsWith(B + '/users/')) throw new Error('Anna Padelution-profiilin osoite.');
  const parts = (q.get('parts') || 'home,team,naficon,halli').split(','), url = q.get('url') || '', tt = q.has('tt');
  const prof = await profile(p);
  const [hm, tm, nf, hl] = await Promise.allSettled([
    parts.includes('home') ? matchesFor(prof, tt) : Promise.resolve({}),
    parts.includes('team') && url ? team(url) : Promise.resolve(null),
    parts.includes('naficon') ? naficon() : Promise.resolve(null),
    parts.includes('halli') ? halli(prof.player.name) : Promise.resolve(null),
  ]);
  const ok = (r) => (r.status === 'fulfilled' ? r.value : null);
  const home = shape(prof, ok(hm) || {});
  const names = ['Ottelut', 'Sarjapadel', 'Naficon', 'Boost-liiga'];
  [hm, tm, nf, hl].forEach((r, i) => { if (r.status === 'rejected') home.warn.push(names[i] + ': haku epäonnistui'); });
  if (!prof.player.name || (!prof.recent.length && !prof.events.length)) home.warn.push('Profiilin tietoja ei löytynyt – Padelutionin sivu on voinut muuttua');
  return { home, team: ok(tm), naficon: ok(nf), halli: ok(hl), fetchedAt: new Date().toISOString() };
}

export default async (req) => {
  const q = new URL(req.url).searchParams, v = q.get('view') || 'home', dbg = q.has('debug');
  const fresh = q.has('r') || dbg;
  const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: s === 200 && !fresh ? { 'content-type': 'application/json', 'cache-control': 'public, max-age=0, must-revalidate', 'netlify-cdn-cache-control': 'public, s-maxage=45, stale-while-revalidate=300' } : { 'content-type': 'application/json', 'cache-control': 'no-store' } });
  try {
    let d;
    if (v === 'dash') d = await dash(q);
    else if (v === 'home') {
      const p = norm(q.get('p') || DP);
      if (!p.startsWith(B + '/users/')) throw new Error('Anna Padelution-profiilin osoite.');
      d = await home(p, dbg, q.has('tt'));
    } else if (v === 'team') d = await team(q.get('url') || '', dbg);
    else if (v === 'teams') {
      const s = (q.get('q') || '').toLowerCase().replace(/\s+/g, ' ').trim();
      d = { teams: s ? (await teamIndex()).filter((t) => t.name.toLowerCase().includes(s)).slice(0, 30) : [] };
    } else if (v === 'halli') d = await halli(q.get('n') || '');
    else if (v === 'naficon') d = await naficon();
    else throw new Error('Tuntematon näkymä');
    if (typeof d === 'string') return new Response(d, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
    return json(d);
  } catch (e) { return json({ error: String(e.message || e) }, 502); }
};
export const config = { path: '/api/padel' };
