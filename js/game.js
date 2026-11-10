// GA Tycoon · il paese: mappa vista dall'alto. Auto, autobus e traghetti portano clienti; i clienti vanno a piedi
// nei negozi e nelle attrazioni, fanno la fila e pagano alla cassa. I soldi restano in cassa finché non li raccogli.
// In più: reputazione del paese, prezzi regolabili, commessi, parcheggio da allargare, eventi a sorpresa,
// missioni con premi, giorno e notte, traffico, zoom della mappa.
import { APP_VERSION } from './version.js';
import {
  CORSO, QUARTIERI, EDIFICI, ORDINE_V4, CRESCE, LENTEZZA, TAPPE, CASSE, COMMESSI, INGRESSO, FILA_MAX, CASSA_PIENA,
  LIVELLO_GESTORI, QUOTA_ASSENZA, LISTINI, REPUTAZIONE, arriviDaReputazione, PARCHEGGIO, EVENTI, EVENTO_OGNI, GIORNATA,
  GRADI, ABILITA, PREZZO_GESTORI, NOMI_GESTORI, POTENZIAMENTI, RINNOVI,
} from './dati.js';
import * as D from './disegni.js';

const $ = s => document.querySelector(s);
const view = $('#view');
const sheet = $('#sheet');
const KEY = 'gatycoon';
const MODI = [1, 10, 50, 'max'];
const ZOOM = [1, 1.5, 2];

// ---------------------------------------------------------------- numeri e tempi
const UNITA = [[1e6, 'mln'], [1e9, 'mld'], [1e12, 'bln'], [1e15, 'bld'], [1e18, 'trl'], [1e21, 'trd'], [1e24, 'qdl'], [1e27, 'qdd'], [1e30, 'qnl'], [1e33, 'qnd']];
export function fmt(x) {
  if (!isFinite(x)) return '€∞';
  if (x < 10) return '€' + (Math.floor(x * 10) / 10).toLocaleString('it-IT', { maximumFractionDigits: 1 });
  if (x < 1e6) return '€' + Math.floor(x).toLocaleString('it-IT');
  for (let k = UNITA.length - 1; k >= 0; k--) {
    const [u, n] = UNITA[k];
    if (x >= u) { const v = x / u; return '€' + v.toLocaleString('it-IT', { maximumFractionDigits: v < 100 ? 2 : 1 }) + ' ' + n; }
  }
  return '€' + x.toExponential(2).replace('.', ',');
}
const num = (x, d = 1) => x.toLocaleString('it-IT', { maximumFractionDigits: d });
const durata = s => {
  s = Math.max(0, Math.ceil(s));
  if (s < 60) return `0:${String(s).padStart(2, '0')}`;
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${m}:${String(ss).padStart(2, '0')}`;
};
const durataLunga = s => (s >= 3600 ? `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min` : s >= 60 ? `${Math.round(s / 60)} min` : `${Math.round(s)} s`);
const ora = () => Date.now();
const caso = a => a[Math.floor(Math.random() * a.length)];
const KID = id => EDIFICI.findIndex(e => e.id === id);
const K_PARCHEGGIO = KID('parcheggio'), K_BUS = KID('bus'), K_PORTO = KID('porto'), K_GRANITE = KID('granite');

// ---------------------------------------------------------------- stato salvato
const edNuovo = e => ({ id: e.id, L: e.apri === 0 ? 1 : 0, g: null, cassa: 0, ema: 0, listino: 1, commessi: 0, n: 0 });
const nuovo = (rinnovo = 0, carriera = 0, resta = {}) => ({
  v: 5, soldi: 0, partita: 0, carriera, rinnovo, modo: 0, upg: [], ultimo: ora(), lavori: {},
  staff: { n: [], i: [] },   // squadre di gestori; negli edifici (g) c'è l'id del gestore assegnato
  rep: REPUTAZIONE.inizio, park: { ampl: 0, piani: 0 },
  miss: 0, mg: null, cnt: { raccolte: 0, oro: 0, abil: 0, listino: 0 },
  stat: { serviti: 0, persi: { fila: 0, caro: 0, parcheggio: 0, cassa: 0 } },
  zoom: 1, ...resta,
  ed: EDIFICI.map(edNuovo),
});
function carica() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (s?.v === 4 && Array.isArray(s.ed)) {   // prima del Borgo antico: gli edifici erano in un altro ordine
      s.ed.forEach((e, i) => { e.id = ORDINE_V4[i]; });
      const vecchiLavori = s.lavori ?? {};
      const base = nuovo(s.rinnovo ?? 0, s.carriera ?? 0);
      Object.assign(base, { soldi: s.soldi, partita: s.partita, modo: s.modo ?? 0, upg: s.upg ?? [], staff: s.staff ?? base.staff, ultimo: s.ultimo });
      base.lavori = { 1: vecchiLavori[1], 2: vecchiLavori[2] };
      base.ed = EDIFICI.map(e => ({ ...edNuovo(e), ...(s.ed.find(x => x.id === e.id) ?? {}) }));
      base.park.ampl = 3;   // chi aveva già giocato tiene tutti i posti all'aperto
      return base;
    }
    if (s?.v === 5 && Array.isArray(s.ed)) {
      const base = nuovo(s.rinnovo, s.carriera);
      const st = { ...base, ...s, cnt: { ...base.cnt, ...s.cnt }, stat: { ...base.stat, ...s.stat, persi: { ...base.stat.persi, ...s.stat?.persi } }, park: { ...base.park, ...s.park } };
      st.ed = EDIFICI.map(e => ({ ...edNuovo(e), ...(s.ed.find(x => x.id === e.id) ?? {}) }));
      return st;
    }
    if (s?.v) return { ...nuovo(s.rinnovo ?? 0, s.carriera ?? 0), vecchia: true };   // partita del gioco a terrazze
  } catch { /* salvataggio rovinato */ }
  return nuovo();
}
let S = carica();
const salva = () => { S.ultimo = ora(); try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* spazio pieno */ } };

// ---------------------------------------------------------------- regole
const zona = k => (EDIFICI[k].tipo === 'ingresso' ? 'i' : 'n');
const molt = tipo => POTENZIAMENTI.filter(u => u.tipo === tipo && S.upg.includes(u.id)).reduce((m, u) => m * u.molt, 1);
const moltRinnovo = () => (S.rinnovo ? RINNOVI[S.rinnovo - 1].molt : 1);
const aperto = k => S.ed[k].L > 0;
const negozio = k => EDIFICI[k].tipo !== 'ingresso';
const tappe = L => TAPPE.filter(t => L >= t).length;
const casseL = L => 1 + CASSE.filter(t => L >= t).length;
const casse = k => casseL(S.ed[k].L) + (S.ed[k].commessi ?? 0);
const costoApri = k => EDIFICI[k].apri * LENTEZZA.apri;
const gest = k => { const id = S.ed[k].g; return id ? S.staff[zona(k)].find(m => m.id === id) ?? null : null; };
const abilita = (k, id) => {
  const m = gest(k);
  if (!m || ora() >= m.fino) return null;
  const ab = ABILITA[zona(k)][m.a];
  return ab.id === id ? ab.effetto[m.r] : null;
};
const evento = id => (R.evento?.def.id === id ? R.evento : null);
// Negozi e attrazioni
const prezzoL = (k, L) => EDIFICI[k].prezzo * L * 2 ** tappe(L) * molt('prezzo') * moltRinnovo();
const listino = k => LISTINI[S.ed[k].listino ?? 1];
const prezzo = k => prezzoL(k, S.ed[k].L) * listino(k).molt * (abilita(k, 'prezzo') ?? 1) * (evento('influencer')?.k === k ? 4 : 1);
const servizio = k => EDIFICI[k].servizio / (molt('veloce') * (abilita(k, 'veloce') ?? 1));
const capacita = (k, L, extra = S.ed[k].commessi ?? 0) => (casseL(L) + extra) / (EDIFICI[k].servizio / molt('veloce'));   // clienti al secondo
const cassaMax = k => prezzo(k) * (casse(k) / servizio(k)) * CASSA_PIENA;
const costoCommesso = k => Math.max(costoApri(k), EDIFICI[k].su * LENTEZZA.su * 30) * COMMESSI.base * COMMESSI.cresce ** (S.ed[k].commessi ?? 0);
// Ingressi
const fattoreArrivi = () => arriviDaReputazione(S.rep) * (evento('festa') ? 3 : evento('pioggia') ? 0.5 : 1);
const ogniL = (k, L) => EDIFICI[k].ogni / Math.min(INGRESSO.maxSpesso, 1 + INGRESSO.piuSpesso * (L - 1)) / molt('arrivi');
const genteL = (k, L) => EDIFICI[k].gente * (1 + INGRESSO.piuGente * (L - 1));
const ogni = k => ogniL(k, S.ed[k].L) / (abilita(k, 'arrivi') ?? 1) / fattoreArrivi();
const gente = k => genteL(k, S.ed[k].L) * (abilita(k, 'gente') ?? 1);
// Parcheggio: posti all'aperto (si allargano) più i piani del multipiano
const postiAperto = () => Math.min(PARCHEGGIO.maxAperto, PARCHEGGIO.posti + 2 * S.park.ampl);
const posti = () => postiAperto() + 12 * S.park.piani;
const costoAmplia = () => PARCHEGGIO.ampliamento.base * PARCHEGGIO.ampliamento.cresce ** S.park.ampl;
const costoPiano = () => PARCHEGGIO.piano.base * PARCHEGGIO.piano.cresce ** S.park.piani;
/** Clienti che arrivano al secondo (tutti gli ingressi aperti). */
const arriviAlSec = () => EDIFICI.reduce((s, e, k) => s + (e.tipo === 'ingresso' && aperto(k) ? gente(k) / ogni(k) : 0), 0);
/** Clienti al secondo che i negozi riescono a servire. */
const servibiliAlSec = () => EDIFICI.reduce((s, e, k) => s + (negozio(k) && aperto(k) ? casse(k) / servizio(k) : 0), 0);
const gestoriAperti = () => S.ed[K_GRANITE].L >= LIVELLO_GESTORI;
const cambiaRep = d => { S.rep = Math.max(0, Math.min(1, S.rep + d * 0.3)); };

function parametri(k) { const e = EDIFICI[k]; return [e.su * LENTEZZA.su, CRESCE[e.tipo], S.ed[k].L]; }
function costo(k, n) { const [b, g, L] = parametri(k); return b * g ** (L - 1) * (g ** n - 1) / (g - 1) * (1 - (abilita(k, 'sconto') ?? 0)); }
function quanti(k) {
  const m = MODI[S.modo];
  if (m !== 'max') return m;
  const [b, g, L] = parametri(k), sc = 1 - (abilita(k, 'sconto') ?? 0);
  return Math.max(1, Math.floor(Math.log((S.soldi * (g - 1)) / (b * g ** (L - 1) * sc) + 1) / Math.log(g)));
}
const incassa = x => { S.soldi += x; S.partita += x; S.carriera += x; };

/** Prossimo edificio da aprire. */
const prossimo = () => { const k = S.ed.findIndex(e => !e.L); return k < 0 ? null : k; };
const quartieriAperti = () => Math.max(1, ...EDIFICI.map((e, k) => (aperto(k) ? e.q + 1 : 1)));
/** Lavori per aprire un quartiere nuovo: { q, resta, prezzo } oppure null. */
function lavori() {
  const k = prossimo();
  if (k == null) return null;
  const q = EDIFICI[k].q;
  if (q < quartieriAperti() || !QUARTIERI[q].lavori) return null;
  S.lavori[q] ??= ora() + QUARTIERI[q].lavori * 1000;
  const resta = (S.lavori[q] - ora()) / 1000;
  return resta > 0 ? { q, resta, prezzo: costoApri(k) * 0.6 * (resta / QUARTIERI[q].lavori) } : null;
}
const altezzaMappa = () => {
  const q = Math.min(QUARTIERI.length - 1, quartieriAperti());   // i quartieri aperti più il prossimo, ancora in grigio
  return QUARTIERI[q].fine + (q === QUARTIERI.length - 1 ? 90 : 0);
};

// ---------------------------------------------------------------- geometria
const lotto = k => { const e = EDIFICI[k]; return { x: e.lato === 'L' ? 12 : 214, y: e.y, w: 134, h: e.h }; };
/** Porta dell'edificio (sul lato del corso) e punto del marciapiede davanti. */
const porta = k => {
  const e = EDIFICI[k], l = lotto(k), y = e.tipo === 'attrazione' ? l.y + l.h / 2 : l.y + l.h - 28;
  return e.lato === 'L' ? { x: l.x + l.w, y, mx: CORSO.marcL } : { x: l.x, y, mx: CORSO.marcR };
};
/** Dove si ferma l'auto: lo stallo all'aperto o la rampa del multipiano. */
const postoAuto = j => {
  const lp = lotto(K_PARCHEGGIO);
  return j < 12 ? D.stallo(lp.x, lp.y, lp.w, lp.h, j) : { x: lp.x + 23, y: lp.y + 64, su: true };
};
const fineParcheggioY = () => lotto(K_PARCHEGGIO).y + 65;

// ---------------------------------------------------------------- mondo animato (non si salva)
const R = {
  persone: [], auto: [], bus: null, traghetto: null, nave: null, voli: [], fumetti: [], traffico: [],
  code: EDIFICI.map(() => ({ fila: [], serviti: [] })),
  timer: EDIFICI.map(() => Math.random() * 3),
  stalli: Array(12 + 12 * PARCHEGGIO.piano.max).fill(null),
  calcio: null, incassiSec: EDIFICI.map(() => 0), persi: 0, busExtra: 0,
  evento: null, prossEvento: 90, timerTraffico: 2, luci: [],
};
const MAGLIE = ['#e8503a', '#2f7fbf', '#2e7d4f', '#d6487e', '#7d55c7', '#f2b134', '#1f3d6b', '#c9822b', '#555', '#ffffff', '#45b5a6', '#ff8c42'];
const CAPELLI = ['#2b1d12', '#6b4423', '#d9b26f', '#9a9a9a', '#111', '#b5542c', '#3b2a1a'];
const PELLI = ['#f2c79a', '#e0ac7e', '#c68b59', '#8d5a3b', '#f7d7b5'];
const OMBRELLI = ['#e8503a', '#2f7fbf', '#ffd23f', '#2e7d4f', '#7d55c7', '#222'];
const AUTO = ['#e8503a', '#2f7fbf', '#f2f2f2', '#2b2b2b', '#f2b134', '#3ea86b', '#9b59b6', '#8a8f98'];
const aspetto = (oro = false) => ({ colore: caso(MAGLIE), capelli: caso(CAPELLI), pelle: caso(PELLI), s: Math.random() < 0.18 ? 0.75 : 1, omb: caso(OMBRELLI), oro });

/** Sceglie dove andrà un cliente: tra due negozi aperti a caso, quello con meno fila (e prezzi più bassi). */
function scegliMeta() {
  const aperti = EDIFICI.map((e, k) => k).filter(k => negozio(k) && aperto(k));
  if (!aperti.length) return null;
  const a = caso(aperti), b = caso(aperti);
  const occ = k => R.code[k].fila.length - casse(k) + R.code[k].serviti.length + (S.ed[k].listino ?? 1) * 1.2 - (evento('influencer')?.k === k ? 4 : 0);
  return occ(a) <= occ(b) ? a : b;
}
/** Strada a piedi da un punto a una porta: marciapiede, eventuale attraversamento sulle strisce, porta. */
function strada(da, k) {
  const p = porta(k), latoDa = da.x < 180 ? CORSO.marcL : CORSO.marcR, pts = [{ x: da.x, y: da.y }, { x: latoDa, y: da.y }];
  if (latoDa !== p.mx) pts.push({ x: latoDa, y: p.y }, { x: p.mx, y: p.y }); else pts.push({ x: p.mx, y: p.y });
  pts.push({ x: p.x + (p.mx < p.x ? -2 : 2), y: p.y });
  return pts;
}
const ritorno = pts => [...pts].reverse();
/** Fa scendere n persone (gruppi) da un mezzo in un punto. */
function scendono(quanti, da, origine, oro = false) {
  // per non affollare lo schermo ogni personaggio può valere più clienti
  const gruppo = Math.max(1, Math.ceil((arriviAlSec() * 40) / 70));
  const n = oro ? 1 : Math.max(1, Math.round(quanti / gruppo)), ciascuno = quanti / n;
  for (let j = 0; j < n; j++) {
    const k = scegliMeta();
    if (k == null) return;
    const pts = strada({ x: da.x + (Math.random() - 0.5) * 8, y: da.y + (Math.random() - 0.5) * 6 }, k);
    R.persone.push({ k, pts, i: 0, x: pts[0].x, y: pts[0].y, v: (oro ? 14 : 17) + Math.random() * 7, n: ciascuno, fase: 'va', passo: Math.random() * 6, a: aspetto(oro), origine, ritardo: j * 0.45, carrello: false, triste: false, attesa: 0 });
    if (origine) origine.dentro++;
  }
}
function nuovoArrivo(k) {
  const e = EDIFICI[k], quanti = gente(k);
  if (e.mezzo === 'auto') {
    const libero = R.stalli.findIndex((x, j) => x == null && (j < postiAperto() || (j >= 12 && j < 12 + 12 * S.park.piani)));
    if (R.auto.length > 22) return;
    const car = { x: 190, y: -20, fase: libero < 0 ? 'passa' : 'arriva', stallo: libero, colore: caso(AUTO), dentro: 0, quanti, t: 0 };
    if (libero >= 0) R.stalli[libero] = car;
    R.auto.push(car);
  } else if (e.mezzo === 'bus') {
    if (!R.bus) { R.bus = { x: 190, y: -40, fase: 'arriva', quanti: quanti + R.busExtra, t: 0, gita: R.busExtra > 0 }; R.busExtra = 0; }
  } else if (!R.traghetto) {
    R.traghetto = { x: 420, y: lotto(k).y + lotto(k).h + 26, fase: 'arriva', quanti, t: 0 };
  }
}
const fumetto = (x, y, testo) => { if (R.fumetti.length < 30) R.fumetti.push({ x, y, testo, t: 0 }); };

// ---------------------------------------------------------------- eventi a sorpresa
function nuovoEvento() {
  const negozi = EDIFICI.map((e, k) => k).filter(k => negozio(k) && aperto(k));
  const possibili = EVENTI.filter(ev => (ev.serve !== 'porto' || aperto(K_PORTO)) && (ev.id !== 'gita' || aperto(K_BUS)) && (ev.id !== 'influencer' || negozi.length >= 2));
  const def = caso(possibili), ev = { def, fine: ora() + def.durata * 1000 };
  if (def.id === 'influencer') ev.k = caso(negozi);
  if (def.id === 'gita') { R.busExtra = Math.max(20, gente(K_BUS) * 4); R.timer[K_BUS] = 999; }
  if (def.id === 'oro') { const lp = lotto(K_PARCHEGGIO); scendono(1, { x: CORSO.marcL, y: lp.y + 20 }, null, true); }
  if (def.id === 'crociera') { const lt = lotto(K_PORTO); R.nave = { x: 470, y: lt.y + lt.h + 34, fase: 'arriva', quanti: Math.max(80, gente(K_PORTO) * 6), t: 0 }; }
  R.evento = ev;
  toast(`${def.em} ${def.nome}: ${def.testo}`);
}

// ---------------------------------------------------------------- il tempo che passa
function avanza(dt) {
  // Eventi
  if (R.evento && ora() > R.evento.fine) R.evento = null;
  if (!R.evento && S.ed.filter(e => e.L).length >= 3) { R.prossEvento -= dt; if (R.prossEvento <= 0) { R.prossEvento = EVENTO_OGNI[0] + Math.random() * (EVENTO_OGNI[1] - EVENTO_OGNI[0]); nuovoEvento(); } }
  // Ingressi: arrivano auto, autobus e traghetti
  EDIFICI.forEach((e, k) => {
    if (e.tipo !== 'ingresso' || !aperto(k)) return;
    R.timer[k] += dt;
    if (R.timer[k] >= ogni(k)) { R.timer[k] = 0; nuovoArrivo(k); }
  });
  // Auto: scendono il corso, entrano nel parcheggio, aspettano i passeggeri, ripartono. Se è pieno tirano dritto.
  const lp = lotto(K_PARCHEGGIO), vAuto = 45;
  for (const a of R.auto) {
    if (a.fase === 'passa') {
      a.y += vAuto * dt;
      if (!a.detto && a.y >= fineParcheggioY()) { a.detto = true; fumetto(a.x, a.y, '😠'); S.stat.persi.parcheggio += a.quanti; R.persi += a.quanti; cambiaRep(REPUTAZIONE.parcheggio); }
      if (a.y > QUARTIERI[1].y + 4 || a.y > altezzaMappa()) a.fine = true;
      continue;
    }
    const st = postoAuto(a.stallo);
    if (a.fase === 'arriva') {
      a.y += vAuto * dt;
      if (a.y >= fineParcheggioY()) { a.fase = 'entra'; a.y = fineParcheggioY(); }
    } else if (a.fase === 'entra') {
      a.x -= vAuto * dt;
      if (a.x <= st.x) { a.x = st.x; a.y = st.y; a.fase = 'ferma'; scendono(a.quanti, { x: st.x, y: st.y }, a); }
    } else if (a.fase === 'ferma') {
      if (a.dentro <= 0) { a.t += dt; if (a.t > 1) { a.fase = 'esce'; a.x = lp.x + lp.w; a.y = fineParcheggioY(); } }
    } else if (a.fase === 'esce') {
      a.x += vAuto * dt;
      if (a.x >= 170) { a.x = 170; a.fase = 'via'; }
    } else if (a.fase === 'via') {
      a.y -= vAuto * dt;
      if (a.y < -30) { a.fine = true; R.stalli[a.stallo] = null; }
    }
  }
  R.auto = R.auto.filter(a => !a.fine);
  // Autobus
  const b = R.bus, lb = lotto(K_BUS);
  if (b) {
    if (b.fase === 'arriva') { b.y += 40 * dt; if (b.y >= lb.y + 62) { b.y = lb.y + 62; b.x = 208; b.fase = 'ferma'; scendono(b.quanti, { x: 222, y: lb.y + 62 }, null); } }
    else if (b.fase === 'ferma') { b.t += dt; if (b.t > 3) { b.fase = 'riparte'; b.x = 190; } }
    else if (b.fase === 'riparte') { b.y += 45 * dt; if (b.y > QUARTIERI[1].y - 20) R.bus = null; }
  }
  // Traghetto e nave da crociera
  for (const nome of ['traghetto', 'nave']) {
    const f = R[nome];
    if (!f || !aperto(K_PORTO)) { R[nome] = null; continue; }
    const lt = lotto(K_PORTO), meta = nome === 'nave' ? lt.x + 40 : lt.x + 70, v = nome === 'nave' ? 22 : 30;
    if (f.fase === 'arriva') { f.x -= v * dt; if (f.x <= meta) { f.x = meta; f.fase = 'ferma'; scendono(f.quanti, { x: lt.x + 40, y: lt.y + lt.h - 26 }, null); } }
    else if (f.fase === 'ferma') { f.t += dt; if (f.t > (nome === 'nave' ? 8 : 5)) f.fase = 'riparte'; }
    else if (f.fase === 'riparte') { f.x += v * dt; if (f.x > 480) R[nome] = null; }
  }
  // Persone: camminano, fanno la fila, vengono servite, tornano
  for (const p of R.persone) {
    if (p.ritardo > 0) { p.ritardo -= dt; continue; }
    if (p.fase === 'fila') { p.attesa += dt; continue; }
    if (p.fase === 'va' || p.fase === 'torna') {
      let passo = p.v * dt;
      while (passo > 0 && p.i < p.pts.length - 1) {
        const q = p.pts[p.i + 1], dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy);
        if (d <= passo) { p.x = q.x; p.y = q.y; p.i++; passo -= d; } else { p.x += (dx / d) * passo; p.y += (dy / d) * passo; passo = 0; }
      }
      p.passo += dt * 9;
      if (p.i >= p.pts.length - 1) {
        if (p.fase === 'va') {
          const c = R.code[p.k];
          if (!p.a.oro && Math.random() < listino(p.k).caro) {   // guarda i prezzi e se ne va
            p.triste = true; R.persi += p.n; S.stat.persi.caro += p.n; cambiaRep(REPUTAZIONE.caro); fumetto(p.x, p.y, '💸'); avviaRitorno(p);
          } else if (c.fila.length >= FILA_MAX || !aperto(p.k)) {
            p.triste = true; R.persi += p.n; S.stat.persi.fila += p.n; cambiaRep(REPUTAZIONE.fila); fumetto(p.x, p.y, '😠'); avviaRitorno(p);
          } else { p.fase = 'fila'; p.attesa = 0; c.fila.push(p); }
        } else { p.fine = true; if (p.origine) p.origine.dentro--; }
      }
    }
  }
  // Casse: servono i clienti in fila
  R.code.forEach((c, k) => {
    if (!aperto(k)) return;
    const nc = casse(k), sv = servizio(k);
    while (c.serviti.length < nc && c.fila.length) { const p = c.fila.shift(); p.fase = 'servito'; p.t = sv * Math.max(1, p.n * 0.25); c.serviti.push(p); }
    for (const p of c.serviti) {
      p.t -= dt;
      if (p.t > 0) continue;
      const ed = S.ed[k], incasso = prezzo(k) * p.n, max = cassaMax(k);
      if (ed.g) incassa(incasso);                            // il gestore raccoglie la cassa da solo
      else if (ed.cassa < max) ed.cassa = Math.min(max, ed.cassa + incasso);
      else { p.triste = true; R.persi += p.n; S.stat.persi.cassa += p.n; }   // cassa piena: niente vendita
      if (!p.triste) {
        R.incassiSec[k] += incasso; voloSoldi(k, incasso);
        ed.n = (ed.n ?? 0) + p.n; S.stat.serviti += p.n;
        cambiaRep(listino(k).rep + (p.attesa > REPUTAZIONE.attesaLunga ? REPUTAZIONE.attesa : 0));
        if (Math.random() < 0.12) fumetto(p.x, p.y, p.attesa > REPUTAZIONE.attesaLunga ? '😐' : '😊');
      }
      p.carrello = !!EDIFICI[k].carrelli;
      p.fatto = true;
      avviaRitorno(p);
    }
    c.serviti = c.serviti.filter(p => !p.fatto);
  });
  R.persone = R.persone.filter(p => !p.fine);
  // Traffico di passaggio: auto sul corso e sulle strade trasversali
  R.timerTraffico -= dt;
  if (R.timerTraffico <= 0) {
    R.timerTraffico = 3 + Math.random() * 4;
    const alt = altezzaMappa(), strade = QUARTIERI.slice(1, quartieriAperti()).filter(q => q.y < alt);
    if (strade.length && Math.random() < 0.65) {
      const q = caso(strade), dx = Math.random() < 0.5;
      R.traffico.push({ x: dx ? -20 : 380, y: q.y + (dx ? -2 : 8), vx: dx ? 40 : -40, vy: 0, colore: caso(AUTO) });
    } else if (quartieriAperti() > 1) {
      const su = Math.random() < 0.5, fine = Math.min(alt, QUARTIERI[quartieriAperti() - 1].fine);
      R.traffico.push({ x: su ? 170 : 190, y: su ? fine : QUARTIERI[1].y - 30, vx: 0, vy: su ? -42 : 42, fine, colore: caso(AUTO) });
    }
  }
  for (const t of R.traffico) { t.x += t.vx * dt; t.y += t.vy * dt; }
  R.traffico = R.traffico.filter(t => t.x > -30 && t.x < 390 && (t.vy === 0 || (t.y > QUARTIERI[1].y - 40 && t.y < (t.fine ?? 9e9) + 10)));
  // Soldi che volano e faccine
  for (const v of R.voli) v.t += dt;
  R.voli = R.voli.filter(v => v.t < 1);
  for (const f of R.fumetti) f.t += dt;
  R.fumetti = R.fumetti.filter(f => f.t < 1.6);
}
/** Dopo la cassa (o se se ne va): torna al suo mezzo. */
function avviaRitorno(p) {
  const lb = lotto(K_BUS);
  let fine;
  if (p.origine) fine = postoAuto(p.origine.stallo);
  else if (aperto(K_BUS) && Math.random() < 0.5) fine = { x: 222, y: lb.y + 62 };
  else if (aperto(K_PORTO) && Math.random() < 0.5) { const lt = lotto(K_PORTO); fine = { x: lt.x + 40, y: lt.y + lt.h - 26 }; }
  else fine = { x: CORSO.marcL, y: -10 };
  const verso = strada(fine, p.k);
  p.pts = [{ x: p.x, y: p.y }, ...ritorno(verso).slice(1)]; p.i = 0; p.fase = 'torna'; p.ritardo = 0;
}
const ultimoVoloK = {};
function voloSoldi(k, x) {
  const t = performance.now();
  if (t - (ultimoVoloK[k] ?? 0) < 900) return;
  ultimoVoloK[k] = t;
  const p = porta(k);
  R.voli.push({ k, x: p.x + (EDIFICI[k].lato === 'L' ? -40 : 40), y: lotto(k).y + 18, testo: '+' + fmt(x), t: 0 });
}

/** Ogni secondo: media degli incassi per edificio (per gli incassi ad app chiusa e per il "€ al secondo"). */
setInterval(() => {
  S.ed.forEach((e, k) => { e.ema = e.ema * 0.9 + R.incassiSec[k] * 0.1; R.incassiSec[k] = 0; });
}, 1000);
const alSecondo = () => S.ed.reduce((s, e) => s + e.ema, 0);
const alSecondoAssente = () => (EDIFICI.some((e, k) => e.tipo === 'ingresso' && S.ed[k].g) ? S.ed.reduce((s, e) => s + (e.g ? e.ema : 0), 0) * QUOTA_ASSENZA : 0);

/** Incassi mentre l'app era chiusa: lavora solo chi ha il gestore, a metà ritmo (serve un gestore a un ingresso). */
function guadagniAssenza() {
  const sec = Math.min(7 * 86400, (ora() - (S.ultimo ?? ora())) / 1000);
  if (sec < 30) return;
  const rit = alSecondoAssente(), x = rit * sec;
  if (EDIFICI.some((e, k) => e.tipo === 'ingresso' && S.ed[k].g)) S.ed.forEach((e, k) => { if (!e.g && e.L && negozio(k)) e.cassa = Math.min(cassaMax(k), e.cassa + e.ema * QUOTA_ASSENZA * sec); });
  if (x > 0) incassa(x);
  if (x > 0 || S.ed.some(e => e.g)) {
    sheet.innerHTML = `<div style="font-size:44px">🌙</div><h3 style="margin:6px 0">Bentornato!</h3>
      <p class="note">In ${durataLunga(sec)} i gestori hanno incassato</p><div class="grande">${fmt(x)}</div>
      ${rit ? '<p class="note">Ad app chiusa i gestori lavorano a metà ritmo. Le casse dei negozi senza gestore si sono riempite: raccoglile!</p>' : '<p class="note">💡 Metti un gestore al parcheggio (o a un altro ingresso): senza di lui ad app chiusa non arriva nessuno.</p>'}
      <button class="primary" data-chiudi>Riscuoti</button>`;
    sheet.showModal();
  }
}

// ---------------------------------------------------------------- missioni
const M = (testo, prova, extra = {}) => ({ testo, prova, min: 10, sec: 60, ...extra });
const maxLivNegozi = () => Math.max(0, ...S.ed.map((e, k) => (negozio(k) ? e.L : 0)));
const MISSIONI = [
  M('Tocca la bolla 💰 sul chiosco per incassare', () => [S.cnt.raccolte, 1], { punta: () => `#cs${K_GRANITE}`, min: 5 }),
  M('Tocca il chiosco e portalo al livello 3', () => [S.ed[K_GRANITE].L, 3], { punta: () => `#tg${K_GRANITE}`, min: 10 }),
  M('Apri l\'edicola', () => [S.ed[KID('edicola')].L, 1], { punta: () => '[data-apri]', min: 30 }),
  M('Porta il parcheggio al livello 5', () => [S.ed[K_PARCHEGGIO].L, 5], { punta: () => `#tg${K_PARCHEGGIO}`, min: 40 }),
  M('Allarga il parcheggio: tocca il parcheggio, poi "Allarga"', () => [S.park.ampl, 1], { punta: () => `#tg${K_PARCHEGGIO}`, min: 50 }),
  M('Porta il chiosco al livello 5: arrivano i gestori', () => [S.ed[K_GRANITE].L, 5], { punta: () => `#tg${K_GRANITE}`, min: 60 }),
  M('Assumi un gestore per il chiosco', () => [S.ed[K_GRANITE].g ? 1 : 0, 1], { punta: () => `[data-squadra="${K_GRANITE}"]`, min: 80 }),
  M('Apri la fermata dell\'autobus', () => [S.ed[K_BUS].L, 1], { punta: () => '[data-apri]', min: 200 }),
  M('Servi 300 clienti', () => [S.stat.serviti, 300], { min: 300 }),
  M('Cambia i prezzi di un negozio (toccalo e scegli il listino)', () => [S.cnt.listino, 1], { min: 300 }),
  M('Apri il bar del corso', () => [S.ed[KID('bar')].L, 1], { punta: () => '[data-apri]', min: 800 }),
  M('Porta la reputazione del paese all\'85%', () => [Math.round(S.rep * 100), 85], { min: 1500 }),
  M('Porta un negozio al livello 10: avrà una cassa in più', () => [maxLivNegozi(), 10], { min: 2000 }),
  M('Apri la gelateria', () => [S.ed[KID('gelateria')].L, 1], { punta: () => '[data-apri]', min: 5000 }),
  M('Compra un potenziamento (scheda ⚡ Potenzia)', () => [S.upg.length, 1], { min: 6000 }),
  M('Attiva l\'abilità speciale di un gestore', () => [S.cnt.abil, 1], { min: 8000 }),
  M('Assumi un commesso in un negozio', () => [S.ed.some(e => e.commessi > 0) ? 1 : 0, 1], { min: 1e4 }),
  M('Apri il Centro: la pizzeria', () => [S.ed[KID('pizzeria')].L, 1], { punta: () => '[data-apri]', min: 3e4 }),
  M('Tocca un turista con la valigia d\'oro', () => [S.cnt.oro, 1], { min: 5e4 }),
  M('Guadagna €1 mln in questa partita', () => [S.partita, 1e6], { min: 2e5 }),
];
/** La missione in corso: le prime sono fisse, poi si alternano "apri il prossimo" e "porta un negozio alla prossima tappa". */
function missione() {
  if (S.miss < MISSIONI.length) return MISSIONI[S.miss];
  if (!S.mg) {
    const k0 = prossimo();
    if (k0 != null && S.miss % 2 === 0) S.mg = { tipo: 'apri', k: k0 };
    else {
      const ns = EDIFICI.map((e, k) => k).filter(k => negozio(k) && aperto(k)).sort((a, b) => S.ed[a].L - S.ed[b].L);
      if (!ns.length) return null;
      const k = ns[0], L = TAPPE.find(t => t > S.ed[k].L) ?? S.ed[k].L + 100;
      S.mg = { tipo: 'liv', k, L };
    }
  }
  const { tipo, k, L } = S.mg, e = EDIFICI[k];
  return tipo === 'apri'
    ? M(`Apri ${e.nome.toLowerCase()} ${e.em}`, () => [S.ed[k].L, 1], { punta: () => '[data-apri]', min: costoApri(k) * 0.15, sec: 120 })
    : M(`Porta ${e.nome.toLowerCase()} ${e.em} al livello ${L}`, () => [S.ed[k].L, L], { punta: () => `#tg${k}`, min: costo(k, 1) * 3, sec: 120 });
}
const premio = m => Math.max(m.min, alSecondo() * m.sec);

// ---------------------------------------------------------------- disegno della mappa
let tab = 'paese', W = 360, scala = 1, canvas = null, ctx = null, fondo = null, altMappa = 0, dprMappa = 1;
const dprPer = z => Math.min(2, devicePixelRatio || 1, 2 / z);
function preparaFondo() {
  altMappa = altezzaMappa();
  const dpr = dprMappa;
  fondo = document.createElement('canvas');
  fondo.width = Math.round(360 * scala * dpr); fondo.height = Math.round(altMappa * scala * dpr);
  const c = fondo.getContext('2d');
  c.setTransform(dpr * scala, 0, 0, dpr * scala, 0, 0);
  D.sfondo(c, altMappa, quartieriAperti());
  // alberi e lampioni lungo il corso
  for (let y = 80; y < altMappa - 20; y += 80) D.albero(c, 151, y, 5);
  for (let y = 40; y < altMappa - 20; y += 80) D.albero(c, 209, y, 5);
  const lamp = D.lampioni(altMappa);
  for (const l of lamp) D.lampione(c, l.x, l.y);
  R.luci = lamp.map(l => ({ x: l.x, y: l.y, r: 22 }));
  const k0 = prossimo();
  EDIFICI.forEach((e, k) => {
    const l = lotto(k);
    if (l.y > altMappa) return;
    if (!aperto(k)) { D.lottoChiuso(c, l.x, l.y, l.w, l.h); if (k !== k0) { c.font = '18px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.globalAlpha = 0.5; c.fillText(e.em, l.x + l.w / 2, l.y + l.h / 2); c.globalAlpha = 1; } return; }
    if (e.id === 'parcheggio') D.parcheggio(c, l.x, l.y, l.w, l.h, posti(), S.park.piani);
    else if (e.id === 'bus') D.fermata(c, l.x, l.y, l.w, l.h);
    else if (e.id === 'porto') D.porto(c, l.x, l.y, l.w, l.h, altMappa);
    else if (e.id === 'calcio') D.campo(c, l.x, l.y, l.w, l.h);
    else if (e.id === 'gokart') D.pista(c, l.x, l.y, l.w, l.h);
    else if (e.id === 'ruota') { D.ruotaBase(c, l.x, l.y, l.w, l.h); R.luci.push({ x: l.x + l.w / 2, y: l.y + 90, r: 70 }); }
    else { D.negozio(c, e, l.x, l.y, l.w, l.h, Math.min(4, tappe(S.ed[k].L)), casse(k)); const v = D.vetrina(e, l.x, l.y, l.w, l.h); R.luci.push({ x: v.x, y: v.y, r: 26 }); }
    if (e.id === 'calcio' || e.id === 'gokart') R.luci.push({ x: l.x + l.w / 2, y: l.y + l.h / 2, r: 60 });
  });
  if (altMappa > QUARTIERI.at(-1).fine - 10 && !aperto(K_PORTO)) { c.fillStyle = '#2f8fc9'; c.fillRect(0, QUARTIERI.at(-1).fine, 360, 90); }
}
/** Quanto è buio (0-1): giornata di GIORNATA secondi, con tramonto, notte e alba. */
function buio() {
  if (R.buioFisso != null) return R.buioFisso;   // per le prove
  const f = (ora() / 1000 % GIORNATA) / GIORNATA;
  if (f < 0.62) return 0;
  if (f < 0.72) return (f - 0.62) / 0.1;
  if (f < 0.94) return 1;
  return 1 - (f - 0.94) / 0.06;
}
const inizioMare = () => (aperto(K_PORTO) ? lotto(K_PORTO).y + lotto(K_PORTO).h : altMappa > QUARTIERI.at(-1).fine - 10 ? QUARTIERI.at(-1).fine : Infinity);
function disegna(now) {
  if (!ctx) return;
  // si disegna solo la parte della mappa che si vede
  const r = canvas.getBoundingClientRect(), wrap = $('#mappaWrap');
  const top = Math.max(0, -r.top), bot = Math.min(r.height, innerHeight - r.top);
  if (bot <= top) return;
  const vy0 = Math.max(0, top / scala - 4), vy1 = Math.min(altMappa, bot / scala + 4);
  const vx0 = Math.max(0, (wrap?.scrollLeft ?? 0) / scala - 4), vx1 = Math.min(360, vx0 + (wrap?.clientWidth ?? r.width) / scala + 8);
  const dpr = dprMappa, k = scala * dpr;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const sx = Math.floor(vx0 * k), sy = Math.floor(vy0 * k), sw = Math.ceil((vx1 - vx0) * k), sh = Math.ceil((vy1 - vy0) * k);
  ctx.drawImage(fondo, sx, sy, sw, sh, sx, sy, sw, sh);
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.save(); ctx.beginPath(); ctx.rect(vx0, vy0, vx1 - vx0, vy1 - vy0); ctx.clip();
  const t = now / 1000, nb = buio(), vede = y => y > vy0 - 30 && y < vy1 + 30;
  // mare che si muove
  const ym = inizioMare();
  if (ym < vy1) D.onde(ctx, Math.max(ym, vy0 - 20), Math.min(altMappa, vy1), t);
  // attrazioni animate
  const kc = KID('calcio');
  if (aperto(kc) && vede(lotto(kc).y + 100)) {
    const l = lotto(kc), a = D.areaCampo(l.x, l.y, l.w, l.h);
    R.calcio ??= { gioc: Array.from({ length: 10 }, (_, j) => ({ x: a.x1 + Math.random() * (a.x2 - a.x1), y: a.y1 + Math.random() * (a.y2 - a.y1), sq: j % 2 })), palla: { x: (a.x1 + a.x2) / 2, y: (a.y1 + a.y2) / 2, vx: 16, vy: 11 } };
    const pl = R.calcio.palla;
    pl.x += pl.vx * 0.016; pl.y += pl.vy * 0.016;
    if (pl.x < a.x1 || pl.x > a.x2) pl.vx *= -1;
    if (pl.y < a.y1 || pl.y > a.y2) pl.vy *= -1;
    if (Math.random() < 0.01) { pl.vx = (Math.random() - 0.5) * 50; pl.vy = (Math.random() - 0.5) * 50; }
    for (const g of R.calcio.gioc) {
      g.x += (pl.x - g.x) * 0.005 + (Math.random() - 0.5) * 0.5; g.y += (pl.y - g.y) * 0.005 + (Math.random() - 0.5) * 0.5;
      D.giocatore(ctx, g.x, g.y, g.sq ? '#e8503a' : '#2f7fbf');
    }
    D.palla(ctx, pl.x, pl.y);
  }
  const kk = KID('gokart');
  if (aperto(kk) && vede(lotto(kk).y + 100)) {
    const l = lotto(kk), n = Math.min(6, 2 + R.code[kk].serviti.length);
    for (let j = 0; j < n; j++) { const p = D.puntoPista(l.x, l.y, l.w, l.h, t * (0.05 + j * 0.005) + j / n); D.kart(ctx, p.x, p.y, p.a, AUTO[j % AUTO.length]); }
  }
  const kr = KID('ruota');
  if (aperto(kr) && vede(lotto(kr).y + 100)) { const l = lotto(kr); D.ruotaGiro(ctx, l.x, l.y, l.w, l.h, t, nb); }
  // riflettore sul negozio dell'influencer
  const inf = evento('influencer');
  if (inf) { const l = lotto(inf.k); ctx.strokeStyle = `rgba(255,215,0,${0.6 + 0.4 * Math.sin(t * 6)})`; ctx.lineWidth = 3; ctx.strokeRect(l.x - 2, l.y - 2, l.w + 4, l.h + 4); ctx.font = '16px system-ui'; ctx.textAlign = 'center'; ctx.fillText('📸', l.x + l.w / 2, l.y + 12); }
  // mezzi
  for (const a of R.auto) {
    if (!vede(a.y)) continue;
    if (a.fase === 'ferma') { if (!postoAuto(a.stallo).su) D.autoParcheggiata(ctx, a.x, a.y, a.colore); }
    else if (a.fase === 'entra' || a.fase === 'esce') D.automobile(ctx, a.x, a.y, a.colore, true, a.fase === 'entra' ? Math.PI / 2 : -Math.PI / 2, nb);
    else D.automobile(ctx, a.x, a.y, a.colore, a.fase !== 'via', null, nb);
  }
  for (const c of R.traffico) {
    if (!vede(c.y)) continue;
    D.automobile(ctx, c.x, c.y, c.colore, true, c.vx > 0 ? -Math.PI / 2 : c.vx < 0 ? Math.PI / 2 : c.vy > 0 ? 0 : Math.PI, nb);
  }
  if (R.bus && vede(R.bus.y)) D.autobus(ctx, R.bus.x, R.bus.y, true);
  if (R.traghetto && aperto(K_PORTO)) D.traghetto(ctx, R.traghetto.x, R.traghetto.y);
  if (R.nave && aperto(K_PORTO)) D.nave(ctx, R.nave.x, R.nave.y);
  // persone in fila: in coda lungo il marciapiede
  R.code.forEach((c, k) => {
    const p = porta(k);
    c.fila.forEach((q, j) => { q.x = p.mx; q.y = p.y + 9 + j * 8; });
  });
  const piove = !!evento('pioggia');
  for (const p of R.persone) {
    if (p.ritardo > 0 || p.fase === 'servito' || !vede(p.y)) continue;
    p.a.ombrello = piove ? p.a.omb : null;
    D.persona(ctx, p.x, p.y, p.a, p.fase === 'fila' ? 0 : p.passo, p.carrello, p.triste);
  }
  for (const f of R.fumetti) if (vede(f.y)) D.fumetto(ctx, f.x, f.y, f.testo, f.t);
  // meteo, festa, notte
  if (evento('festa')) { D.festa(ctx, vy0, vy1 - vy0, t); if (nb > 0.3) D.fuochi(ctx, vy0, vy1 - vy0, t); }
  D.notte(ctx, vx0, vy0, vx1 - vx0, vy1 - vy0, nb, R.luci);
  if (piove) D.pioggia(ctx, vx0, vy0, vx1 - vx0, vy1 - vy0, t);
  // soldi che volano dalle casse
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const v of R.voli) {
    if (!vede(v.y)) continue;
    ctx.globalAlpha = 1 - v.t; ctx.font = 'bold 11px system-ui'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.55)';
    ctx.strokeText(v.testo, v.x, v.y - v.t * 22); ctx.fillStyle = '#ffe066'; ctx.fillText(v.testo, v.x, v.y - v.t * 22);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

// ---------------------------------------------------------------- schermata del paese (mappa + comandi sopra)
function renderPaese() {
  const scrollRel = $('#mappaWrap') ? { x: $('#mappaWrap').scrollLeft / ($('#mappa')?.clientWidth || 1) } : null;
  W = Math.min(view.clientWidth || 360, 640);
  const z = S.zoom ?? 1;
  scala = (W * z) / 360; dprMappa = dprPer(z);
  preparaFondo();
  const H = altMappa * scala, MW = 360 * scala, dpr = dprMappa;
  const k0 = prossimo(), lv = lavori();
  view.innerHTML = `<div class="avviso" id="avviso"></div><div class="missione" id="missione"></div>
    <div id="mappaWrap"><div id="mappa" style="width:${MW}px;height:${H}px">
    <canvas id="tela" width="${Math.round(MW * dpr)}" height="${Math.round(H * dpr)}" style="width:${MW}px;height:${H}px"></canvas>
    ${EDIFICI.map((e, k) => (aperto(k) ? sovrapposizione(k) : '')).join('')}
    ${k0 != null && lotto(k0).y < altMappa ? prossimoHtml(k0, lv) : ''}
    <div class="mano" id="mano" hidden>👆</div>
  </div></div>
  <div class="comandiMappa"><button data-zoom="-1" aria-label="Allontana">－</button><button data-zoom="1" aria-label="Avvicina">＋</button></div>
  <button class="raccogliTutto" id="raccogliTutto" data-raccogli-tutto hidden></button>`;
  canvas = $('#tela'); ctx = canvas.getContext('2d');
  if (scrollRel) $('#mappaWrap').scrollLeft = scrollRel.x * MW;
  ultimaMissione = '';
}
const px = v => `${v * scala}px`;
function sovrapposizione(k) {
  const e = EDIFICI[k], l = lotto(k);
  return `<button class="hit" data-su="${k}" style="left:${px(l.x)};top:${px(l.y)};width:${px(l.w)};height:${px(l.h)}" aria-label="Migliora ${e.nome}"></button>
    <div class="targhe" style="left:${px(l.x + 4)};top:${px(l.y + 4)};width:${px(l.w - 8)}">
      <button class="targa" data-su="${k}" id="tg${k}"></button>
      ${slotGestore(k)}
    </div>
    ${negozio(k) ? `<button class="cassaB" data-raccogli="${k}" id="cs${k}" style="left:${px(l.x + l.w / 2)};top:${px(l.y + l.h - 22)}" hidden></button>` : ''}`;
}
function prossimoHtml(k, lv) {
  const e = EDIFICI[k], l = lotto(k);
  return `<div class="prossimo" style="left:${px(l.x)};top:${px(l.y)};width:${px(l.w)};height:${px(Math.min(l.h, 110))}">
    ${lv ? `<div class="lavori"><b>🚧 Lavori: ${QUARTIERI[lv.q].nome}</b><span id="lavoriResta"></span><button class="mini" data-finisci><span>Finisci</span> <small id="lavoriPrezzo"></small></button></div>`
    : `<button class="apri" data-apri="${k}"><span>${e.em} Apri</span><small>${e.nome}</small><b>${fmt(costoApri(k))}</b></button>`}
  </div>`;
}
/** Il posto del gestore sull'edificio: lucchetto, "+" per sceglierne uno, oppure il gestore con la sua abilità. */
function slotGestore(k) {
  if (!gestoriAperti()) return '<span class="lucchetto" title="Gestori dal livello 5 del chiosco">🔒</span>';
  const m = gest(k);
  if (!m) return `<button class="assumi" data-squadra="${k}" aria-label="Gestore">🧑‍💼+</button>`;
  const ab = ABILITA[zona(k)][m.a];
  return `<button class="gestore" data-squadra="${k}" style="--r:${GRADI[m.r].colore}" aria-label="${m.nome}">🧑‍💼</button><button class="abil" data-attiva="${k}" id="ab${k}">${ab.em}<span></span></button>`;
}

// ---------------------------------------------------------------- altre pagine
function renderPotenzia() {
  const liberi = POTENZIAMENTI.filter(u => !S.upg.includes(u.id));
  view.innerHTML = `<div class="pagina"><h2>Potenziamenti</h2><p class="note">Valgono fino al prossimo rinnovo.</p>
    ${liberi.map(u => `<div class="voce"><span class="em">${u.em}</span><span class="t"><b>${u.nome}</b>
      <small>${u.tipo === 'prezzo' ? `Tutti i clienti pagano ×${u.molt}` : u.tipo === 'arrivi' ? `Arriva gente ×${u.molt} più spesso` : `Tutte le casse ×${u.molt} più veloci`} · ${fmt(u.costo)}</small></span>
      <button data-upg="${u.id}">Compra</button></div>`).join('') || '<p class="note">Li hai comprati tutti! 🎉</p>'}
    <button class="primary" data-riepilogo>📊 Riepilogo del paese</button></div>`;
}
function renderRinnovo() {
  const p = RINNOVI[S.rinnovo];
  view.innerHTML = `<div class="pagina"><h2>Rinnovo del paese</h2>
    <div class="card"><div class="note">Livello di rinnovo</div><div class="grande">⭐ ${S.rinnovo} / ${RINNOVI.length}</div>
      <div class="note">${S.rinnovo ? `${RINNOVI[S.rinnovo - 1].nome}: tutti gli incassi <b>×${moltRinnovo()}</b> per sempre.` : 'Nessun rinnovo ancora.'}</div></div>
    ${p ? `<div class="card"><div class="note">Prossimo rinnovo</div><b style="font-size:18px">${p.nome}</b>
      <div class="riga"><span>Incassi per sempre</span><b>×${p.molt}</b></div><div class="riga"><span>Costa</span><b>${fmt(p.costo)}</b></div>
      <div class="note">Paghi e il paese riparte dal chiosco delle granite (negozi, ingressi, gestori e potenziamenti tornano a zero), ma da lì in poi incassi ×${p.molt}.</div>
      <button class="primary" data-rinnova ${S.soldi >= p.costo ? '' : 'disabled'}>Rinnova il paese</button></div>` : '<div class="card">Hai il paese più bello d\'Italia! 🇮🇹</div>'}
    <div class="card"><div class="note">Questa partita</div><b>${fmt(S.partita)}</b> guadagnati · <b>${S.ed.filter(e => e.L).length}</b> edifici su ${EDIFICI.length}<br><span class="note">In tutto: ${fmt(S.carriera)}</span></div>
    <button class="link" data-azzera>Cancella tutto e ricomincia da zero</button><p class="note">Versione ${APP_VERSION}</p></div>`;
}
/** Riepilogo: incassi per edificio, clienti, reputazione, clienti persi e perché. */
function schedaRiepilogo() {
  aperta = { tipo: 'riepilogo' };
  const arr = arriviAlSec() * 60, serv = servibiliAlSec() * 60, pe = S.stat.persi, tot = alSecondo() || 1;
  const righe = EDIFICI.map((e, k) => (aperto(k) && negozio(k) ? `<tr><td>${e.em} ${e.nome}</td><td>${S.ed[k].L}</td><td>${fmt(S.ed[k].ema)}/s</td><td><i class="barra" style="width:${Math.round((S.ed[k].ema / tot) * 100)}%"></i></td></tr>` : '')).join('');
  sheet.innerHTML = `<div class="scheda">
    <div class="sTitolo"><span>📊</span><div><b>Riepilogo del paese</b><small>${fmt(alSecondo())} al secondo</small></div><button class="chiudi" data-chiudi aria-label="Chiudi">✕</button></div>
    <div class="riga"><span>⭐ Reputazione</span><b>${Math.round(S.rep * 100)}%</b></div>
    <div class="repBar"><i style="width:${S.rep * 100}%"></i></div>
    <p class="note">Più è alta, più gente arriva (ora ×${num(arriviDaReputazione(S.rep), 2)}). Sale con prezzi bassi o giusti e file corte; scende con file lunghe, prezzi alti e parcheggio pieno.</p>
    <div class="riga"><span>🚗 Clienti che arrivano</span><b>${num(arr)} al minuto</b></div>
    <div class="riga"><span>🛍️ Clienti che i negozi servono</span><b>${num(serv)} al minuto</b></div>
    <div class="riga"><span>🙂 Clienti serviti in tutto</span><b>${num(S.stat.serviti, 0)}</b></div>
    <h4>😞 Clienti persi</h4>
    <div class="riga"><span>Troppa fila</span><b>${num(pe.fila, 0)}</b></div>
    <div class="riga"><span>Troppo caro</span><b>${num(pe.caro, 0)}</b></div>
    <div class="riga"><span>Parcheggio pieno</span><b>${num(pe.parcheggio, 0)}</b></div>
    <div class="riga"><span>Cassa piena</span><b>${num(pe.cassa, 0)}</b></div>
    <h4>💶 Incassi per negozio</h4>
    <table class="stat riep"><tbody>${righe}</tbody></table>
    <p class="note">${arr > serv * 0.9 ? '🐢 Arriva più gente di quanta ne servite: migliora i negozi o assumi commessi (casse in più).' : '🚗 I negozi potrebbero servire più clienti: migliora parcheggio, fermata e porto.'}</p>
  </div>`;
  if (!sheet.open) sheet.showModal();
  ultimoDisegno = performance.now();
}

// ---------------------------------------------------------------- gestori
const statoDi = m => { const t = ora(); return t < m.fino ? ['attiva', (m.fino - t) / 1000] : t < m.pronto ? ['ricarica', (m.pronto - t) / 1000] : ['pronta', 0]; };
const prezzoAssunzione = z => PREZZO_GESTORI[z].base * PREZZO_GESTORI[z].cresce ** S.staff[z].length;
const doveLavora = (z, m) => S.ed.findIndex((e, k) => zona(k) === z && e.g === m.id);
function attiva(k) {
  const m = gest(k);
  if (!m || ora() < m.pronto) return false;
  const gr = GRADI[m.r];
  m.fino = ora() + gr.durata * 1000; m.pronto = ora() + (gr.durata + gr.ricarica) * 1000;
  S.cnt.abil++;
  return true;
}
function assumi(z, k = null) {
  const prezzo_ = prezzoAssunzione(z);
  if (S.soldi < prezzo_ || !gestoriAperti()) return null;
  S.soldi -= prezzo_;
  let x = Math.random(), r = 0;
  while (r < GRADI.length - 1 && x > GRADI[r].prob) { x -= GRADI[r].prob; r++; }
  const usati = new Set([...S.staff.n, ...S.staff.i].map(m => m.nome)), liberi = NOMI_GESTORI.filter(n => !usati.has(n));
  const m = { id: Math.random().toString(36).slice(2, 9), nome: caso(liberi.length ? liberi : NOMI_GESTORI), r, a: Math.floor(Math.random() * ABILITA[z].length), fino: 0, pronto: 0, pagato: prezzo_ };
  S.staff[z].push(m);
  if (k != null && !S.ed[k].g) assegna(z, m.id, k);
  return m;
}
function assegna(z, id, k) {
  S.ed.forEach((e, j) => { if (zona(j) === z && e.g === id) e.g = null; });
  if (k >= 0) { if (S.ed[k].cassa > 0 && zona(k) === 'n') { incassa(S.ed[k].cassa); S.ed[k].cassa = 0; } S.ed[k].g = id; }
}
function vendi(z, id) { const m = S.staff[z].find(x => x.id === id); if (!m) return; assegna(z, id, -1); S.staff[z] = S.staff[z].filter(x => x !== m); S.soldi += m.pagato / 2; }
function rigaGestore(z, m, qui = null) {
  const ab = ABILITA[z][m.a], gr = GRADI[m.r], dove = doveLavora(z, m), [st, s] = statoDi(m);
  const stato = st === 'attiva' ? `<b class="st attiva">attiva ${durata(s)}</b>` : st === 'ricarica' ? `<b class="st ricarica">ricarica ${durata(s)}</b>` : '<b class="st pronta">pronta</b>';
  const scelta = `<select data-assegna="${z}:${m.id}"><option value="-1">Libero</option>${EDIFICI.map((e, k) => (zona(k) === z && aperto(k) ? `<option value="${k}" ${dove === k ? 'selected' : ''}>${e.em} ${e.nome}</option>` : '')).join('')}</select>`;
  return `<div class="gRiga ${qui != null && dove === qui ? 'qui' : ''}">
    <span class="gAv" style="--r:${gr.colore}">🧑‍💼</span>
    <span class="gT"><b>${m.nome}</b> <span class="grado" style="--r:${gr.colore}">${gr.nome}</span>
      <small>${ab.em} ${ab.nome}: ${ab.testo(ab.effetto[m.r])} · dura ${durataLunga(gr.durata)}, ricarica ${durataLunga(gr.ricarica)}</small>
      <small>${stato} · ${dove >= 0 ? `${EDIFICI[dove].em} ${EDIFICI[dove].nome}` : 'libero'}</small></span>
    <span class="gAz">
      ${qui != null ? (dove !== qui ? `<button class="mini" data-assegna-qui="${z}:${m.id}:${qui}">Metti qui</button>` : '') : scelta}
      ${dove >= 0 && st === 'pronta' ? `<button class="mini verde" data-attiva="${dove}">${ab.em} Attiva</button>` : ''}
      <button class="mini rosso" data-vendi="${z}:${m.id}">Vendi ${fmt(m.pagato / 2)}</button>
    </span></div>`;
}
let ultimoDisegno = 0;
function renderGestori() {
  ultimoDisegno = performance.now();
  if (!gestoriAperti()) {
    view.innerHTML = `<div class="pagina"><h2>Gestori</h2><div class="card">🔒 I gestori arrivano quando il chiosco delle granite raggiunge il <b>livello ${LIVELLO_GESTORI}</b>.<p class="note">Il gestore resta fisso al suo edificio: in un negozio raccoglie da solo la cassa, a un ingresso fa arrivare gente anche ad app chiusa. In più ha un'abilità speciale.</p></div></div>`;
    return;
  }
  const squadra = (z, titolo) => `<h2>${titolo} <small>${S.staff[z].length} in squadra</small></h2>
    <div class="card squadra">${S.staff[z].map(m => rigaGestore(z, m)).join('') || '<p class="note">Nessun gestore.</p>'}
    <button class="primary" data-assumi="${z}" ${S.soldi >= prezzoAssunzione(z) ? '' : 'disabled'}>🧑‍💼 Assumi · ${fmt(prezzoAssunzione(z))}</button></div>`;
  view.innerHTML = `<div class="pagina"><h2>Gestori</h2>
    <p class="note">Il gestore resta fisso al suo edificio e lo fa lavorare da solo: nei negozi <b>raccoglie la cassa</b> (anche ad app chiusa, a metà ritmo), agli ingressi <b>fa arrivare gente</b> anche ad app chiusa. L'<b>abilità speciale</b> la attivi tu: dura qualche minuto e poi si ricarica. La ricarica è del gestore: con più gestori puoi scambiarli.</p>
    <div class="card legenda">${GRADI.map(g => `<span><span class="grado" style="--r:${g.colore}">${g.nome}</span> dura ${durataLunga(g.durata)} · ricarica ${durataLunga(g.ricarica)} · esce ${Math.round(g.prob * 100)}%</span>`).join('')}</div>
    <button class="primary" data-attiva-tutti>⚡ Attiva tutte le abilità pronte</button>
    ${squadra('i', '🚗 Ingressi')}${squadra('n', '🏪 Negozi e attrazioni')}</div>`;
}

// ---------------------------------------------------------------- schede (potenziamento e squadra)
let aperta = null;
sheet.addEventListener('close', () => { aperta = null; });
function schedaSu(k) { aperta = { tipo: 'su', k }; disegnaSu(); if (!sheet.open) sheet.showModal(); }
function disegnaSu() {
  const { k } = aperta, e = EDIFICI[k], ed = S.ed[k], L = ed.L, n = quanti(k), c = costo(k, n), L2 = L + n;
  const riga = (nome, a, b) => `<tr><td>${nome}</td><td>${a}</td><td class="dopo">${a === b ? '' : `→ ${b}`}</td></tr>`;
  let righe, prossimi, extra = '';
  if (e.tipo === 'ingresso') {
    righe = riga(e.mezzo === 'auto' ? 'Arriva un\'auto ogni' : e.mezzo === 'bus' ? 'Passa un autobus ogni' : 'Arriva un traghetto ogni', `${num(ogniL(k, L))} s`, `${num(ogniL(k, L2))} s`)
      + riga('Persone per arrivo', num(genteL(k, L)), num(genteL(k, L2)))
      + riga('Clienti al minuto', num((genteL(k, L) / ogniL(k, L)) * 60), num((genteL(k, L2) / ogniL(k, L2)) * 60));
    prossimi = ['Più clienti arrivano, più i negozi lavorano', 'La reputazione del paese moltiplica gli arrivi'];
    if (e.mezzo === 'auto') {
      const occ = R.stalli.filter(Boolean).length;
      extra = `<div class="sezione"><b>🅿️ Posti auto: ${posti()}</b> <span class="note">(${occ} occupati ora)</span>
        <p class="note">Se il parcheggio è pieno le auto tirano dritto: clienti persi e reputazione giù.</p>
        ${postiAperto() < PARCHEGGIO.maxAperto ? `<button class="mini" data-amplia ${S.soldi >= costoAmplia() ? '' : 'disabled'}>Allarga: +2 posti · ${fmt(costoAmplia())}</button>`
          : S.park.piani < PARCHEGGIO.piano.max ? `<button class="mini" data-piano ${S.soldi >= costoPiano() ? '' : 'disabled'}>Costruisci un piano: +12 posti · ${fmt(costoPiano())}</button>` : '<span class="note">Multipiano completo!</span>'}</div>`;
    }
  } else {
    righe = riga('Ogni cliente paga', fmt(prezzoL(k, L) * listino(k).molt), fmt(prezzoL(k, L2) * listino(k).molt))
      + riga('Casse', casseL(L) + ed.commessi, casseL(L2) + ed.commessi)
      + riga('Clienti serviti al minuto', num(capacita(k, L) * 60), num(capacita(k, L2) * 60))
      + riga('Incasso massimo', `${fmt(prezzoL(k, L) * listino(k).molt * capacita(k, L))}/s`, `${fmt(prezzoL(k, L2) * listino(k).molt * capacita(k, L2))}/s`);
    const t = TAPPE.find(x => x > L), cs = CASSE.find(x => x > L);
    prossimi = [t && `🎉 Livello ${t}: prezzo ×2`, cs && `🧾 Livello ${cs}: una cassa in più`].filter(Boolean);
    extra = `<div class="sezione"><b>🏷️ Prezzi</b>
      <div class="seg listini">${LISTINI.map((x, j) => `<button data-listino="${k}:${j}" class="${(ed.listino ?? 1) === j ? 'on' : ''}">${x.em} ${x.nome}<small>×${num(x.molt, 2)}</small></button>`).join('')}</div>
      <p class="note">${listino(k).caro ? `Il ${Math.round(listino(k).caro * 100)}% dei clienti lo trova caro e se ne va.` : 'Nessuno se ne va per i prezzi.'} ${listino(k).rep > 0 ? 'La reputazione sale.' : listino(k).rep < 0 ? 'La reputazione scende.' : ''}</p>
      <b>👩‍💼 Commessi: ${ed.commessi}/${COMMESSI.max}</b> <span class="note">ognuno apre una cassa in più</span><br>
      ${ed.commessi < COMMESSI.max ? `<button class="mini" data-commesso="${k}" ${S.soldi >= costoCommesso(k) ? '' : 'disabled'}>Assumi un commesso · ${fmt(costoCommesso(k))}</button>` : '<span class="note">Banco al completo!</span>'}</div>`;
  }
  const sc = abilita(k, 'sconto'), m = gest(k);
  sheet.innerHTML = `<div class="scheda">
    <div class="sTitolo"><span>${e.em}</span><div><b>${e.nome}</b><small>Livello ${L}${n ? ` → ${L2}` : ''}${negozio(k) ? ` · ${num(ed.n ?? 0, 0)} clienti serviti` : ''}</small></div><button class="chiudi" data-chiudi aria-label="Chiudi">✕</button></div>
    <table class="stat"><tbody>${righe}</tbody></table>
    ${prossimi.length ? `<ul class="prossimi">${prossimi.map(p => `<li>${p}</li>`).join('')}</ul>` : ''}
    <div class="seg">${MODI.map((x, j) => `<button data-modo="${j}" class="${S.modo === j ? 'on' : ''}">${x === 'max' ? 'Max' : `×${x}`}</button>`).join('')}</div>
    <button class="primary" data-compra="${k}" ${S.soldi >= c ? '' : 'disabled'}>Sali di ${n} ${n === 1 ? 'livello' : 'livelli'} · ${fmt(c)}${sc ? ` <small>(−${Math.round(sc * 100)}%)</small>` : ''}</button>
    ${extra}
    <div class="sGest">${slotGestore(k)}<span class="note">${m ? `${m.nome} (${GRADI[m.r].nome}): ${ABILITA[zona(k)][m.a].testo(ABILITA[zona(k)][m.a].effetto[m.r])}` : gestoriAperti() ? 'Nessun gestore: tocca 🧑‍💼 per sceglierne uno' : `Gestori dal livello ${LIVELLO_GESTORI} del chiosco`}</span></div>
  </div>`;
  statoAbilita(k, sheet.querySelector(`#ab${k}`));
  ultimoDisegno = performance.now();
}
function schedaSquadra(k) { aperta = { tipo: 'squadra', k }; disegnaSquadra(); if (!sheet.open) sheet.showModal(); }
function disegnaSquadra() {
  const { k } = aperta, z = zona(k), m = gest(k);
  const lista = [...S.staff[z]].sort((a, b) => (doveLavora(z, b) === k) - (doveLavora(z, a) === k) || (doveLavora(z, a) >= 0) - (doveLavora(z, b) >= 0));
  sheet.innerHTML = `<div class="scheda">
    <div class="sTitolo"><span>🧑‍💼</span><div><b>Gestore · ${EDIFICI[k].nome}</b><small>${m ? `${m.nome} lavora qui` : 'Nessun gestore qui'}</small></div><button class="chiudi" data-chiudi aria-label="Chiudi">✕</button></div>
    <div class="squadra">${lista.map(x => rigaGestore(z, x, k)).join('') || '<p class="note">La squadra è vuota: assumi il primo gestore.</p>'}</div>
    <button class="primary" data-assumi="${z}:${k}" ${S.soldi >= prezzoAssunzione(z) ? '' : 'disabled'}>🧑‍💼 Assumi un gestore · ${fmt(prezzoAssunzione(z))}</button>
    <p class="note">Esce a caso: Junior 65%, Senior 27%, Executive 8%. Il prezzo sale a ogni gestore in squadra; vendendo ti ridanno metà.</p></div>`;
  ultimoDisegno = performance.now();
}
const ridisegnaScheda = () => { if (!aperta || !sheet.open) return; ({ su: disegnaSu, squadra: disegnaSquadra, riepilogo: schedaRiepilogo })[aperta.tipo]?.(); };

// ---------------------------------------------------------------- aggiornamento dell'interfaccia
const txt = (el, t) => { if (el && el.textContent !== t) el.textContent = t; };
function statoAbilita(k, el) {
  const m = gest(k);
  if (!m || !el) return;
  const [st, s] = statoDi(m), span = el.querySelector('span');
  el.className = `abil ${st}`; txt(span, st === 'pronta' ? '' : durata(s)); el.disabled = st !== 'pronta';
}
let ultimaMissione = '';
function aggiornaMissione() {
  const box = $('#missione'), m = missione();
  if (!box) return;
  if (!m) { box.hidden = true; return; }
  const [a, b] = m.prova(), fatto = a >= b, pr = premio(m);
  const html = `<span class="mT"><small>🎯 Missione ${S.miss + 1}</small><b>${m.testo}</b>
    ${b > 1 && !fatto ? `<i class="mBar"><i style="width:${Math.min(100, (a / b) * 100)}%"></i></i><small>${b >= 1000 ? `${fmt(a).replace('€', '')} / ${fmt(b).replace('€', '')}` : `${Math.floor(a)} / ${b}`}</small>` : ''}</span>
    ${fatto ? `<button class="mini verde" data-premio>Riscuoti ${fmt(pr)}</button>` : `<small class="mP">premio ${fmt(pr)}</small>`}`;
  if (html !== ultimaMissione) { box.innerHTML = html; ultimaMissione = html; box.classList.toggle('fatta', fatto); }
  // la manina indica cosa toccare
  const mano = $('#mano'), mappa = $('#mappa'), sel = !fatto && m.punta?.(), el = sel && mappa?.querySelector(sel);
  if (mano) {
    if (el && !el.hidden && el.offsetParent) {
      const r = el.getBoundingClientRect(), rm = mappa.getBoundingClientRect();
      mano.hidden = false; mano.style.left = `${r.left - rm.left + r.width / 2}px`; mano.style.top = `${r.bottom - rm.top}px`;
    } else mano.hidden = true;
  }
}
function aggiorna() {
  txt($('#soldi'), fmt(S.soldi));
  const ps = alSecondo(), pa = alSecondoAssente();
  txt($('#alSec'), `${fmt(ps)}/s · 👥 ${num(arriviAlSec() * 60, 0)}/min · ⭐ ${Math.round(S.rep * 100)}%${pa ? ` · ad app chiusa ${fmt(pa)}/s` : ''}${S.rinnovo ? ` · ×${moltRinnovo()}` : ''}`);
  const pall = { potenzia: POTENZIAMENTI.some(u => !S.upg.includes(u.id) && S.soldi >= u.costo), rinnovo: !!RINNOVI[S.rinnovo] && S.soldi >= RINNOVI[S.rinnovo].costo };
  for (const b of document.querySelectorAll('#nav button')) {
    const on = !!pall[b.dataset.tab], has = b.querySelector('.pallino');
    if (on && !has) b.insertAdjacentHTML('beforeend', '<i class="pallino"></i>'); else if (!on && has) has.remove();
  }
  if (aperta && sheet.open && performance.now() - ultimoDisegno > 500 && !document.activeElement?.matches('select')) ridisegnaScheda();
  if (tab === 'gestori') { if (performance.now() - ultimoDisegno > 1000 && !document.activeElement?.matches('select')) renderGestori(); return; }
  if (tab !== 'paese') return;
  EDIFICI.forEach((e, k) => {
    if (!aperto(k)) return;
    const tg = $(`#tg${k}`), puoi = S.soldi >= costo(k, 1);
    txt(tg, `${puoi ? '⬆ ' : ''}${e.em} Liv. ${S.ed[k].L}`); tg?.classList.toggle('puoi', puoi);
    statoAbilita(k, $(`#ab${k}`));
    const cs = $(`#cs${k}`);
    if (cs) {
      const c = S.ed[k].cassa, piena = c >= cassaMax(k) * 0.999;
      cs.hidden = c < 1; txt(cs, `${piena ? '⚠️ ' : '💰 '}${fmt(c)}`); cs.classList.toggle('piena', piena);
    }
  });
  const lv = lavori(), ap = view.querySelector('[data-apri]');
  if (lv && $('#lavoriResta')) { txt($('#lavoriResta'), `pronti tra ${durata(lv.resta)}`); txt($('#lavoriPrezzo'), fmt(lv.prezzo)); view.querySelector('[data-finisci]').disabled = S.soldi < lv.prezzo; }
  else if (!lv && $('#lavoriResta')) render();
  if (ap) ap.disabled = S.soldi < costoApri(+ap.dataset.apri);
  // raccogli tutto
  const piene = S.ed.filter((x, k) => negozio(k) && x.L && x.cassa >= 1), somma = piene.reduce((s, x) => s + x.cassa, 0), rt = $('#raccogliTutto');
  if (rt) { rt.hidden = piene.length < 2; txt(rt, `💰 Raccogli tutto · ${fmt(somma)}`); }
  // avviso in alto: evento in corso, oppure il consiglio del momento
  const ev = R.evento, arr = arriviAlSec(), serv = servibiliAlSec(), nPiene = S.ed.filter((x, k) => !x.g && negozio(k) && x.L && x.cassa >= cassaMax(k) * 0.999).length;
  const av = $('#avviso');
  txt(av, ev ? `${ev.def.em} ${ev.def.nome}: ${ev.def.testo} · ${durata((ev.fine - ora()) / 1000)}`
    : nPiene ? `⚠️ ${nPiene === 1 ? 'Una cassa è piena' : `${nPiene} casse sono piene`}: toccale per incassare (o metti un gestore)`
    : R.stalli.filter(Boolean).length >= posti() && aperto(K_PARCHEGGIO) ? '🅿️ Parcheggio pieno: allargalo (tocca il parcheggio)'
    : S.rep < 0.5 ? '⭐ Reputazione bassa: abbassa i prezzi e accorcia le file'
    : arr > serv * 0.9 ? '🐢 Troppa fila: migliora i negozi o assumi commessi' : '🚗 I negozi possono servire di più: migliora gli ingressi');
  av?.classList.toggle('evento', !!ev);
  aggiornaMissione();
}

// ---------------------------------------------------------------- tocchi
let toastT;
function toast(t) { const el = $('#toast'); el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (el.hidden = true), 3000); }
const vibra = p => { try { navigator.userActivation?.hasBeenActive && navigator.vibrate?.(p); } catch { /* niente */ } };
function render() {
  for (const b of document.querySelectorAll('#nav button')) b.classList.toggle('on', b.dataset.tab === tab);
  if (tab !== 'paese') { canvas = ctx = null; }
  if (tab === 'paese') renderPaese(); else if (tab === 'gestori') renderGestori(); else if (tab === 'potenzia') renderPotenzia(); else renderRinnovo();
  aggiorna();
  if (ctx) disegna(performance.now());
}
const ridisegna = () => { ridisegnaScheda(); render(); salva(); };
function raccogli(k) {
  const c = S.ed[k].cassa;
  if (c <= 0) return 0;
  incassa(c); S.ed[k].cassa = 0; S.cnt.raccolte++;
  const p = porta(k); R.voli.push({ k, x: p.x + (EDIFICI[k].lato === 'L' ? -50 : 50), y: lotto(k).y + lotto(k).h - 30, testo: '+' + fmt(c), t: 0 });
  return c;
}
/** Tocco sulla mappa: il turista con la valigia d'oro. */
function toccaTurista(e) {
  const tela = $('#tela');
  if (!tela) return false;
  const r = tela.getBoundingClientRect(), x = (e.clientX - r.left) / scala, y = (e.clientY - r.top) / scala;
  const p = R.persone.find(q => q.a.oro && q.ritardo <= 0 && q.fase !== 'servito' && Math.hypot(q.x - x, q.y - y) < 16);
  if (!p) return false;
  const bonus = Math.max(60, alSecondo() * 150);
  incassa(bonus); S.cnt.oro++; p.a.oro = false; fumetto(p.x, p.y, '🤑');
  R.voli.push({ k: 0, x: p.x, y: p.y - 10, testo: '+' + fmt(bonus), t: 0 });
  if (evento('oro')) R.evento = null;
  toast(`💼 Il turista ti lascia una mancia d'oro: +${fmt(bonus)}`); vibra([20, 40, 20]); salva();
  return true;
}
document.addEventListener('click', e => {
  const on = s => e.target.closest(s);
  let el;
  if (on('#mappa') && toccaTurista(e)) return;
  if (on('[data-chiudi]')) { sheet.close(); return; }
  if ((el = on('#nav button'))) { tab = el.dataset.tab; render(); scrollTo(0, 0); return; }
  if (on('#top')) { schedaRiepilogo(); return; }
  if (on('[data-riepilogo]')) { schedaRiepilogo(); return; }
  if ((el = on('[data-raccogli]'))) { if (raccogli(+el.dataset.raccogli)) { vibra(10); aggiorna(); salva(); } return; }
  if (on('[data-raccogli-tutto]')) {
    let tot = 0; S.ed.forEach((x, k) => { if (negozio(k)) tot += raccogli(k); });
    if (tot) { toast(`💰 Raccolti ${fmt(tot)}`); vibra(15); aggiorna(); salva(); }
    return;
  }
  if ((el = on('[data-zoom]'))) {
    const i = ZOOM.indexOf(S.zoom ?? 1), j = Math.max(0, Math.min(ZOOM.length - 1, (i < 0 ? 0 : i) + +el.dataset.zoom));
    cambiaZoom(ZOOM[j]); return;
  }
  if (on('[data-premio]')) {
    const m = missione(); if (!m) return;
    const [a, b] = m.prova(); if (a < b) return;
    const pr = premio(m); incassa(pr); S.miss++; S.mg = null;
    toast(`🎯 Missione compiuta! +${fmt(pr)}`); vibra([20, 40, 20]); ultimaMissione = ''; aggiorna(); salva(); return;
  }
  if ((el = on('[data-su]'))) { schedaSu(+el.dataset.su); return; }
  if ((el = on('[data-modo]'))) { S.modo = +el.dataset.modo; if (aperta) disegnaSu(); return; }
  if ((el = on('[data-listino]'))) {
    const [k, j] = el.dataset.listino.split(':').map(Number);
    if (S.ed[k].listino !== j) { S.ed[k].listino = j; S.cnt.listino++; }
    disegnaSu(); salva(); return;
  }
  if ((el = on('[data-commesso]'))) {
    const k = +el.dataset.commesso, c = costoCommesso(k);
    if (S.soldi < c || S.ed[k].commessi >= COMMESSI.max) return;
    S.soldi -= c; S.ed[k].commessi++; toast(`👩‍💼 ${EDIFICI[k].nome}: un commesso e una cassa in più!`); vibra(15); disegnaSu(); render(); salva(); return;
  }
  if (on('[data-amplia]')) { const c = costoAmplia(); if (S.soldi < c || postiAperto() >= PARCHEGGIO.maxAperto) return; S.soldi -= c; S.park.ampl++; toast(`🅿️ Parcheggio allargato: ${posti()} posti`); disegnaSu(); render(); salva(); return; }
  if (on('[data-piano]')) { const c = costoPiano(); if (S.soldi < c || S.park.piani >= PARCHEGGIO.piano.max) return; S.soldi -= c; S.park.piani++; toast(`🏗️ Nuovo piano del multipiano: ${posti()} posti`); disegnaSu(); render(); salva(); return; }
  if ((el = on('[data-compra]'))) {
    const k = +el.dataset.compra, n = quanti(k), c = costo(k, n);
    if (S.soldi < c) return;
    const ed = S.ed[k], primaT = tappe(ed.L), primaC = casseL(ed.L);
    S.soldi -= c; ed.L += n;
    if (negozio(k)) {
      if (casseL(ed.L) > primaC) { toast(`🧾 ${EDIFICI[k].nome}: una cassa in più!`); render(); }
      else if (tappe(ed.L) > primaT) { toast(`🎉 ${EDIFICI[k].nome}: prezzo raddoppiato!`); render(); }
      if (k === K_GRANITE && ed.L >= LIVELLO_GESTORI && ed.L - n < LIVELLO_GESTORI) { toast('🧑‍💼 Ora puoi assumere i gestori!'); render(); }
    }
    vibra(8); disegnaSu(); aggiorna(); salva(); return;
  }
  if ((el = on('[data-squadra]'))) { if (gestoriAperti()) schedaSquadra(+el.dataset.squadra); return; }
  if ((el = on('[data-assumi]'))) {
    const [z, sk] = el.dataset.assumi.split(':'), m = assumi(z, sk == null ? null : +sk);
    if (!m) return;
    const ab = ABILITA[z][m.a];
    toast(`${m.r === 2 ? '🌟 ' : ''}${m.nome}, ${GRADI[m.r].nome}: ${ab.em} ${ab.nome}`); vibra(m.r === 2 ? [30, 60, 30] : 15);
    ridisegna(); return;
  }
  if ((el = on('[data-assegna-qui]'))) { const [z, id, k] = el.dataset.assegnaQui.split(':'); assegna(z, id, +k); ridisegna(); return; }
  if ((el = on('[data-vendi]'))) {
    const [z, id] = el.dataset.vendi.split(':'), m = S.staff[z].find(x => x.id === id);
    if (!m || !confirm(`Vendere ${m.nome} (${GRADI[m.r].nome})? Ti ridanno ${fmt(m.pagato / 2)}.`)) return;
    vendi(z, id); toast(`${m.nome} è andato via: +${fmt(m.pagato / 2)}`); ridisegna(); return;
  }
  if ((el = on('[data-attiva]'))) {
    const k = +el.dataset.attiva;
    if (attiva(k)) { const m = gest(k), ab = ABILITA[zona(k)][m.a]; vibra(15); toast(`${ab.em} ${m.nome}: ${ab.nome} per ${durataLunga(GRADI[m.r].durata)}!`); ridisegnaScheda(); if (tab === 'gestori') renderGestori(); aggiorna(); salva(); }
    return;
  }
  if (on('[data-attiva-tutti]')) {
    let n = 0; S.ed.forEach((x, k) => { if (x.L && attiva(k)) n++; });
    toast(n ? `⚡ ${n} abilità attivate!` : 'Nessuna abilità pronta in questo momento'); if (n) { vibra(20); renderGestori(); salva(); }
    return;
  }
  if ((el = on('[data-apri]'))) {
    const k = +el.dataset.apri, ed = EDIFICI[k];
    if (S.soldi < costoApri(k) || lavori()) return;
    S.soldi -= costoApri(k); S.ed[k].L = 1; toast(`${ed.em} Hai aperto: ${ed.nome}`); vibra([20, 40, 20]); render(); salva(); return;
  }
  if (on('[data-finisci]')) { const lv = lavori(); if (!lv || S.soldi < lv.prezzo) return; S.soldi -= lv.prezzo; S.lavori[lv.q] = ora(); toast('🚧 Lavori finiti!'); render(); salva(); return; }
  if ((el = on('[data-upg]'))) { const u = POTENZIAMENTI.find(x => x.id === el.dataset.upg); if (!u || S.soldi < u.costo) return; S.soldi -= u.costo; S.upg.push(u.id); toast(`${u.em} ${u.nome}!`); render(); salva(); return; }
  if (on('[data-rinnova]')) {
    const p = RINNOVI[S.rinnovo]; if (!p || S.soldi < p.costo) return;
    sheet.innerHTML = `<div style="font-size:44px">⭐</div><h3 style="margin:6px 0">${p.nome}</h3><p class="note">Paghi ${fmt(p.costo)} e il paese riparte da capo, ma da ora incassi <b>×${p.molt}</b> per sempre.</p>
      <button class="primary" data-conferma-rinnovo>Sì, rinnova</button><button class="link" data-chiudi>Annulla</button>`;
    sheet.showModal(); return;
  }
  if (on('[data-conferma-rinnovo]')) {
    const r = S.rinnovo + 1;
    S = nuovo(r, S.carriera, { zoom: S.zoom, miss: S.miss, mg: null, cnt: S.cnt, stat: S.stat });
    azzeraMondo(); sheet.close(); tab = 'paese'; render(); salva(); toast(`⭐ ${RINNOVI[r - 1].nome}: incassi ×${RINNOVI[r - 1].molt}!`); return;
  }
  if (on('[data-azzera]')) {
    sheet.innerHTML = '<h3>Cancellare tutto?</h3><p class="note">Perdi anche i rinnovi. Non si può annullare.</p><button class="primary" data-conferma-azzera style="background:var(--rosso)">Cancella tutto</button><button class="link" data-chiudi>Annulla</button>';
    sheet.showModal(); return;
  }
  if (on('[data-conferma-azzera]')) { S = nuovo(); azzeraMondo(); sheet.close(); tab = 'paese'; render(); salva(); }
});
document.addEventListener('change', e => {
  const s = e.target.closest('[data-assegna]'); if (!s) return;
  const [z, id] = s.dataset.assegna.split(':'); assegna(z, id, +s.value); s.blur(); render(); salva();
});
function azzeraMondo() {
  R.persone = []; R.auto = []; R.bus = null; R.traghetto = null; R.nave = null; R.voli = []; R.fumetti = []; R.traffico = []; R.calcio = null; R.persi = 0;
  R.code = EDIFICI.map(() => ({ fila: [], serviti: [] })); R.stalli.fill(null); R.evento = null; R.prossEvento = 90; R.busExtra = 0;
}

// ---------------------------------------------------------------- zoom (pulsanti e due dita)
function cambiaZoom(z) {
  const wrap = $('#mappaWrap');
  if (!wrap || z === S.zoom) return;
  // tiene al centro dello schermo lo stesso punto della mappa
  const r = $('#mappa').getBoundingClientRect(), cx = (wrap.scrollLeft + wrap.clientWidth / 2) / scala, cy = (innerHeight / 2 - r.top) / scala;
  S.zoom = z; render();
  const w2 = $('#mappaWrap'), r2 = $('#mappa').getBoundingClientRect();
  w2.scrollLeft = cx * scala - w2.clientWidth / 2;
  scrollBy(0, r2.top + cy * scala - innerHeight / 2);
  salva();
}
let pizzico = null;
document.addEventListener('touchstart', e => {
  if (e.touches.length !== 2 || !e.target.closest('#mappaWrap')) return;
  const [a, b] = e.touches;
  pizzico = { d0: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), z0: S.zoom ?? 1, f: 1 };
}, { passive: true });
document.addEventListener('touchmove', e => {
  if (!pizzico || e.touches.length !== 2) return;
  e.preventDefault();
  const [a, b] = e.touches, d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  pizzico.f = Math.max(1 / pizzico.z0, Math.min(2.5 / pizzico.z0, d / pizzico.d0));
  const m = $('#mappa'); if (m) { m.style.transformOrigin = 'center top'; m.style.transform = `scale(${pizzico.f})`; }
}, { passive: false });
document.addEventListener('touchend', () => {
  if (!pizzico) return;
  const z = pizzico.z0 * pizzico.f, scelto = ZOOM.reduce((a, b) => (Math.abs(b - z) < Math.abs(a - z) ? b : a));
  pizzico = null;
  const m = $('#mappa'); if (m) m.style.transform = '';
  cambiaZoom(scelto);
});

// Tenendo premuto "Sali di livello" si continua a comprare
let ripeti = null;
const smetti = () => { clearTimeout(ripeti); clearInterval(ripeti); ripeti = null; };
document.addEventListener('pointerdown', e => {
  if (!e.target.closest('[data-compra]')) return;
  smetti(); ripeti = setTimeout(() => { ripeti = setInterval(() => { const x = sheet.querySelector('[data-compra]'); if (x && !x.disabled) x.click(); else smetti(); }, 120); }, 450);
});
for (const ev of ['pointerup', 'pointercancel']) document.addEventListener(ev, smetti);
addEventListener('resize', () => { if (tab === 'paese' && Math.abs(Math.min(view.clientWidth || 360, 640) - W) > 4) render(); });

// ---------------------------------------------------------------- ciclo
let last = performance.now(), daSalvare = 0, mappaCheck = 0;
function frame(now) {
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  avanza(dt);
  if (tab === 'paese') {
    mappaCheck += dt;
    if (mappaCheck > 1) { mappaCheck = 0; if (Math.abs(altezzaMappa() - altMappa) > 1) render(); }
    disegna(now);
  }
  aggiorna();
  daSalvare += dt;
  if (daSalvare > 3) { daSalvare = 0; salva(); }
  requestAnimationFrame(frame);
}
document.addEventListener('visibilitychange', () => { if (document.hidden) salva(); else { guadagniAssenza(); last = performance.now(); salva(); } });
addEventListener('pagehide', salva);

// Aggiornamenti: contenuti dell'app (version.txt) e guscio Android (release su GitHub)
async function controllaVersione() {
  try { const v = (await (await fetch('version.txt', { cache: 'no-store' })).text()).trim(); if (v && APP_VERSION !== 'dev' && v !== APP_VERSION) { salva(); location.reload(); } } catch { /* offline */ }
}
setInterval(controllaVersione, 120000);
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js');
const native = window.Android;
let apkNuovo = null;
const piuNuova = (a, b) => { const pa = a.split('.').map(Number), pb = b.split('.').map(Number); for (let i = 0; i < Math.max(pa.length, pb.length); i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) > (pb[i] ?? 0); return false; };
async function controllaApk() {
  if (!native?.appVersion) return;
  try {
    const rel = await (await fetch('https://api.github.com/repos/Gavao/ga-tycoon/releases/latest')).json();
    const v = rel.tag_name?.replace(/^v/, ''), file = rel.assets?.find(a => a.name.endsWith('.apk'));
    apkNuovo = v && file && piuNuova(v, native.appVersion()) ? { v, url: file.browser_download_url } : null;
    const b = $('#aggiornaApk'); if (b) { b.hidden = !apkNuovo; if (apkNuovo) b.textContent = `⬆️ Aggiorna l'app alla versione ${apkNuovo.v}`; }
  } catch { /* offline */ }
}
document.addEventListener('click', e => { if (e.target.closest('#aggiornaApk') && apkNuovo) { native.installUpdate(apkNuovo.url); toast('Download in corso: al termine si apre l\'installazione'); } });

if (S.vecchia) {
  delete S.vecchia;
  sheet.innerHTML = '<div style="font-size:44px">🏘️</div><h3>GA Tycoon è diventato un paese!</h3><p class="note">Ora c\'è la mappa vista dall\'alto: auto e autobus portano i clienti, che fanno la fila nei negozi e pagano alla cassa. La partita a terrazze riparte da capo (i rinnovi restano).</p><button class="primary" data-chiudi>Iniziamo</button>';
  sheet.showModal();
} else guadagniAssenza();
render();
requestAnimationFrame(frame);
controllaApk();
window.gioco = { get S() { return S; }, R, fmt, avanza, render, salva, aggiorna, arriviAlSec, servibiliAlSec, nuovoEvento, disegna: () => disegna(performance.now()) };   // per le prove
