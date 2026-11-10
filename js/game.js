// GA Tycoon · il paese: mappa vista dall'alto. Auto, autobus e traghetti portano clienti; i clienti vanno a piedi
// nei negozi e nelle attrazioni, fanno la fila e pagano alla cassa. I soldi restano in cassa finché non li raccogli.
import { APP_VERSION } from './version.js';
import {
  CORSO, QUARTIERI, EDIFICI, CRESCE, TAPPE, CASSE, INGRESSO, FILA_MAX, CASSA_PIENA, LIVELLO_GESTORI, QUOTA_ASSENZA,
  GRADI, ABILITA, PREZZO_GESTORI, NOMI_GESTORI, POTENZIAMENTI, RINNOVI,
} from './dati.js';
import * as D from './disegni.js';

const $ = s => document.querySelector(s);
const view = $('#view');
const sheet = $('#sheet');
const KEY = 'gatycoon';
const MODI = [1, 10, 50, 'max'];

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

// ---------------------------------------------------------------- stato salvato
const nuovo = (rinnovo = 0, carriera = 0) => ({
  v: 4, soldi: 0, partita: 0, carriera, rinnovo, modo: 0, upg: [], ultimo: ora(), lavori: {},
  staff: { n: [], i: [] },   // squadre di gestori; negli edifici (g) c'è l'id del gestore assegnato
  ed: EDIFICI.map(e => ({ L: e.apri === 0 ? 1 : 0, g: null, cassa: 0, ema: 0 })),
});
function carica() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (s?.v === 4 && Array.isArray(s.ed)) {
      while (s.ed.length < EDIFICI.length) s.ed.push({ L: 0, g: null, cassa: 0, ema: 0 });
      return s;
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
const tappe = L => TAPPE.filter(t => L >= t).length;
const casseL = L => 1 + CASSE.filter(t => L >= t).length;
const gest = k => { const id = S.ed[k].g; return id ? S.staff[zona(k)].find(m => m.id === id) ?? null : null; };
const abilita = (k, id) => {
  const m = gest(k);
  if (!m || ora() >= m.fino) return null;
  const ab = ABILITA[zona(k)][m.a];
  return ab.id === id ? ab.effetto[m.r] : null;
};
// Negozi e attrazioni
const prezzoL = (k, L) => EDIFICI[k].prezzo * L * 2 ** tappe(L) * molt('prezzo') * moltRinnovo();
const prezzo = k => prezzoL(k, S.ed[k].L) * (abilita(k, 'prezzo') ?? 1);
const servizio = k => EDIFICI[k].servizio / (molt('veloce') * (abilita(k, 'veloce') ?? 1));
const capacitaL = (k, L) => casseL(L) / (EDIFICI[k].servizio / molt('veloce'));   // clienti al secondo
const cassaMax = k => prezzo(k) * (casseL(S.ed[k].L) / servizio(k)) * CASSA_PIENA;
// Ingressi
const ogniL = (k, L) => EDIFICI[k].ogni / Math.min(INGRESSO.maxSpesso, 1 + INGRESSO.piuSpesso * (L - 1)) / molt('arrivi');
const genteL = (k, L) => EDIFICI[k].gente * (1 + INGRESSO.piuGente * (L - 1));
const ogni = k => ogniL(k, S.ed[k].L) / (abilita(k, 'arrivi') ?? 1);
const gente = k => genteL(k, S.ed[k].L) * (abilita(k, 'gente') ?? 1);
const postiParcheggio = L => Math.min(12, 4 + Math.floor(L / 5));
/** Clienti che arrivano al secondo (tutti gli ingressi aperti). */
const arriviAlSec = () => EDIFICI.reduce((s, e, k) => s + (e.tipo === 'ingresso' && aperto(k) ? gente(k) / ogni(k) : 0), 0);
/** Clienti al secondo che i negozi riescono a servire. */
const servibiliAlSec = () => EDIFICI.reduce((s, e, k) => s + (e.tipo !== 'ingresso' && aperto(k) ? casseL(S.ed[k].L) / servizio(k) : 0), 0);
const gestoriAperti = () => S.ed[1].L >= LIVELLO_GESTORI;   // il chiosco delle granite

function parametri(k) { const e = EDIFICI[k]; return [e.su, CRESCE[e.tipo], S.ed[k].L]; }
function costo(k, n) { const [b, g, L] = parametri(k); return b * g ** (L - 1) * (g ** n - 1) / (g - 1) * (1 - (abilita(k, 'sconto') ?? 0)); }
function quanti(k) {
  const m = MODI[S.modo];
  if (m !== 'max') return m;
  const [b, g, L] = parametri(k), sc = 1 - (abilita(k, 'sconto') ?? 0);
  return Math.max(1, Math.floor(Math.log((S.soldi * (g - 1)) / (b * g ** (L - 1) * sc) + 1) / Math.log(g)));
}
const incassa = x => { S.soldi += x; S.partita += x; S.carriera += x; };

/** Prossimo edificio da aprire e quartiere in cui sta. */
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
  return resta > 0 ? { q, resta, prezzo: EDIFICI[k].apri * 0.6 * (resta / QUARTIERI[q].lavori) } : null;
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
const ingressoK = id => EDIFICI.findIndex(e => e.id === id);
const K_PARCHEGGIO = ingressoK('parcheggio'), K_BUS = ingressoK('bus'), K_PORTO = ingressoK('porto');

// ---------------------------------------------------------------- mondo animato (non si salva)
const R = {
  persone: [], auto: [], bus: null, traghetto: null, voli: [],
  code: EDIFICI.map(() => ({ fila: [], serviti: [] })),
  timer: EDIFICI.map(() => Math.random() * 3),
  stalli: Array(12).fill(null),
  calcio: null, kart: [], incassiSec: EDIFICI.map(() => 0), persi: 0,
};
const COLORI = ['#e8503a', '#2f7fbf', '#2e7d4f', '#d6487e', '#7d55c7', '#f2b134', '#1f3d6b', '#c9822b', '#555', '#ffffff'];
const AUTO = ['#e8503a', '#2f7fbf', '#f2f2f2', '#2b2b2b', '#f2b134', '#3ea86b', '#9b59b6'];

/** Sceglie dove andrà un cliente: tra due negozi aperti a caso, quello con meno fila. */
function scegliMeta() {
  const aperti = EDIFICI.map((e, k) => k).filter(k => EDIFICI[k].tipo !== 'ingresso' && aperto(k));
  if (!aperti.length) return null;
  const a = caso(aperti), b = caso(aperti), occ = k => R.code[k].fila.length - casseL(S.ed[k].L) + R.code[k].serviti.length;
  return occ(a) <= occ(b) ? a : b;
}
/** Strada a piedi da un punto a una porta: marciapiede, eventuale attraversamento sulle strisce, porta. */
function strada(da, k) {
  const p = porta(k), latoDa = da.x < 180 ? CORSO.marcL : CORSO.marcR, pts = [{ x: da.x, y: da.y }, { x: latoDa, y: da.y }];
  if (latoDa !== p.mx) pts.push({ x: latoDa, y: p.y }, { x: p.mx, y: p.y }); else pts.push({ x: p.mx, y: p.y });
  pts.push({ x: p.x + (p.mx < p.x ? -2 : 2), y: p.y });
  return pts;
}
const ritorno = (pts) => [...pts].reverse();
/** Fa scendere n persone (gruppi) da un mezzo in un punto. */
function scendono(quanti, da, origine) {
  // per non affollare lo schermo ogni personaggio può valere più clienti
  const gruppo = Math.max(1, Math.ceil((arriviAlSec() * 30) / 70));
  const n = Math.max(1, Math.round(quanti / gruppo)), ciascuno = quanti / n;
  for (let j = 0; j < n; j++) {
    const k = scegliMeta();
    if (k == null) return;
    const pts = strada({ x: da.x + (Math.random() - 0.5) * 8, y: da.y + (Math.random() - 0.5) * 6 }, k);
    R.persone.push({ k, pts, i: 0, x: pts[0].x, y: pts[0].y, v: 26 + Math.random() * 10, n: ciascuno, fase: 'va', passo: Math.random() * 6, colore: caso(COLORI), origine, ritardo: j * 0.35, carrello: false, triste: false });
    if (origine) origine.dentro++;
  }
}
function nuovoArrivo(k) {
  const e = EDIFICI[k], quanti = gente(k);
  if (e.mezzo === 'auto') {
    const libero = R.stalli.findIndex((x, j) => x == null && j < postiParcheggio(S.ed[k].L));
    if (libero < 0 || R.auto.length > 14) { scendono(quanti, { x: CORSO.marcL, y: 4 }, null); return; }   // parcheggio pieno: arrivano a piedi
    const car = { x: 190, y: -20, fase: 'arriva', stallo: libero, colore: caso(AUTO), dentro: 0, quanti, t: 0 };
    R.stalli[libero] = car; R.auto.push(car);
  } else if (e.mezzo === 'bus') {
    if (!R.bus) R.bus = { x: 190, y: -40, fase: 'arriva', quanti, t: 0 };
  } else if (!R.traghetto) {
    R.traghetto = { x: 420, y: lotto(k).y + lotto(k).h + 26, fase: 'arriva', quanti, t: 0 };
  }
}

// ---------------------------------------------------------------- il tempo che passa
function avanza(dt) {
  // Ingressi: arrivano auto, autobus e traghetti
  EDIFICI.forEach((e, k) => {
    if (e.tipo !== 'ingresso' || !aperto(k)) return;
    R.timer[k] += dt;
    if (R.timer[k] >= ogni(k)) { R.timer[k] = 0; nuovoArrivo(k); }
  });
  // Auto: scendono il corso, entrano nel parcheggio, aspettano i passeggeri, ripartono
  const lp = lotto(K_PARCHEGGIO);
  for (const a of R.auto) {
    const st = D.stallo(lp.x, lp.y, lp.w, lp.h, a.stallo);
    if (a.fase === 'arriva') {
      a.y += 60 * dt;
      if (a.y >= lp.y + 65) { a.fase = 'entra'; a.y = lp.y + 65; }
    } else if (a.fase === 'entra') {
      a.x -= 60 * dt;
      if (a.x <= st.x) { a.x = st.x; a.y = st.y; a.fase = 'ferma'; scendono(a.quanti, { x: st.x, y: st.y }, a); }
    } else if (a.fase === 'ferma') {
      if (a.dentro <= 0) { a.t += dt; if (a.t > 0.8) { a.fase = 'esce'; a.x = lp.x + lp.w; a.y = lp.y + 65; } }
    } else if (a.fase === 'esce') {
      a.x += 60 * dt;
      if (a.x >= 170) { a.x = 170; a.fase = 'via'; }
    } else if (a.fase === 'via') {
      a.y -= 70 * dt;
      if (a.y < -30) { a.fine = true; R.stalli[a.stallo] = null; }
    }
  }
  R.auto = R.auto.filter(a => !a.fine);
  // Autobus
  const b = R.bus, lb = lotto(K_BUS);
  if (b) {
    if (b.fase === 'arriva') { b.y += 55 * dt; if (b.y >= lb.y + 62) { b.y = lb.y + 62; b.x = 208; b.fase = 'ferma'; b.dentro = 0; scendono(b.quanti, { x: 222, y: lb.y + 62 }, null); } }
    else if (b.fase === 'ferma') { b.t += dt; if (b.t > 2.5) { b.fase = 'riparte'; b.x = 190; } }
    else if (b.fase === 'riparte') { b.y += 60 * dt; if (b.y > (aperto(K_PORTO) ? lotto(K_PORTO).y + lotto(K_PORTO).h - 20 : altezzaMappa() + 40)) R.bus = null; }
  }
  // Traghetto
  const f = R.traghetto;
  if (f && aperto(K_PORTO)) {
    const lt = lotto(K_PORTO), meta = lt.x + 70;
    if (f.fase === 'arriva') { f.x -= 40 * dt; if (f.x <= meta) { f.x = meta; f.fase = 'ferma'; scendono(f.quanti, { x: lt.x + 40, y: lt.y + lt.h - 26 }, null); } }
    else if (f.fase === 'ferma') { f.t += dt; if (f.t > 4) f.fase = 'riparte'; }
    else if (f.fase === 'riparte') { f.x += 40 * dt; if (f.x > 440) R.traghetto = null; }
  }
  // Persone: camminano, fanno la fila, vengono servite, tornano
  for (const p of R.persone) {
    if (p.ritardo > 0) { p.ritardo -= dt; continue; }
    if (p.fase === 'va' || p.fase === 'torna') {
      let passo = p.v * dt;
      while (passo > 0 && p.i < p.pts.length - 1) {
        const q = p.pts[p.i + 1], dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy);
        if (d <= passo) { p.x = q.x; p.y = q.y; p.i++; passo -= d; } else { p.x += (dx / d) * passo; p.y += (dy / d) * passo; passo = 0; }
      }
      p.passo += dt * 12;
      if (p.i >= p.pts.length - 1) {
        if (p.fase === 'va') {
          const c = R.code[p.k];
          if (c.fila.length >= FILA_MAX || !aperto(p.k)) { p.triste = true; R.persi += p.n; avviaRitorno(p); }
          else { p.fase = 'fila'; c.fila.push(p); }
        } else { p.fine = true; if (p.origine) p.origine.dentro--; }
      }
    }
  }
  // Casse: servono i clienti in fila
  R.code.forEach((c, k) => {
    if (!aperto(k)) return;
    const nc = casseL(S.ed[k].L), sv = servizio(k);
    while (c.serviti.length < nc && c.fila.length) { const p = c.fila.shift(); p.fase = 'servito'; p.t = sv * Math.max(1, p.n * 0.25); c.serviti.push(p); }
    for (const p of c.serviti) {
      p.t -= dt;
      if (p.t > 0) continue;
      const ed = S.ed[k], incasso = prezzo(k) * p.n, max = cassaMax(k);
      if (ed.g) { incassa(incasso); }                       // il gestore raccoglie la cassa da solo
      else if (ed.cassa < max) ed.cassa = Math.min(max, ed.cassa + incasso);
      else { p.triste = true; R.persi += p.n; }               // cassa piena: niente vendita
      if (!p.triste) { R.incassiSec[k] += incasso; voloSoldi(k, incasso); }
      p.carrello = !!EDIFICI[k].carrelli;
      p.fatto = true;
      avviaRitorno(p);
    }
    c.serviti = c.serviti.filter(p => !p.fatto);
  });
  R.persone = R.persone.filter(p => !p.fine);
  // Animazioni delle attrazioni e voli dei soldi
  for (const v of R.voli) v.t += dt;
  R.voli = R.voli.filter(v => v.t < 1);
}
/** Dopo la cassa (o se se ne va): torna al suo mezzo. */
function avviaRitorno(p) {
  const lp = lotto(K_PARCHEGGIO), lb = lotto(K_BUS);
  let fine;
  if (p.origine) fine = D.stallo(lp.x, lp.y, lp.w, lp.h, p.origine.stallo);
  else if (aperto(K_BUS) && Math.random() < 0.5) fine = { x: 222, y: lb.y + 62 };
  else if (aperto(K_PORTO) && Math.random() < 0.5) { const lt = lotto(K_PORTO); fine = { x: lt.x + 40, y: lt.y + lt.h - 26 }; }
  else fine = { x: CORSO.marcL, y: -10 };
  const verso = strada(fine, p.k);
  p.pts = [{ x: p.x, y: p.y }, ...ritorno(verso).slice(1)]; p.i = 0; p.fase = 'torna'; p.ritardo = 0;
}
let ultimoVoloK = {};
function voloSoldi(k, x) {
  const t = performance.now();
  if (t - (ultimoVoloK[k] ?? 0) < 900) { R.voli.at(-1)?.k === k && (R.voli.at(-1).x2 = x); return; }
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
  // le casse dei negozi senza gestore si riempiono
  if (EDIFICI.some((e, k) => e.tipo === 'ingresso' && S.ed[k].g)) S.ed.forEach((e, k) => { if (!e.g && e.L && EDIFICI[k].tipo !== 'ingresso') e.cassa = Math.min(cassaMax(k), e.cassa + e.ema * QUOTA_ASSENZA * sec); });
  if (x > 0) incassa(x);
  if (x > 0 || S.ed.some(e => e.g)) {
    sheet.innerHTML = `<div style="font-size:44px">🌙</div><h3 style="margin:6px 0">Bentornato!</h3>
      <p class="note">In ${durataLunga(sec)} i gestori hanno incassato</p><div class="grande">${fmt(x)}</div>
      ${rit ? '<p class="note">Ad app chiusa i gestori lavorano a metà ritmo. Le casse dei negozi senza gestore si sono riempite: raccoglile!</p>' : '<p class="note">💡 Metti un gestore al parcheggio (o a un altro ingresso): senza di lui ad app chiusa non arriva nessuno.</p>'}
      <button class="primary" data-chiudi>Riscuoti</button>`;
    sheet.showModal();
  }
}

// ---------------------------------------------------------------- disegno della mappa
let tab = 'paese', W = 360, scala = 1, canvas = null, ctx = null, fondo = null, altMappa = 0;
function preparaFondo() {
  altMappa = altezzaMappa();
  const dpr = Math.min(2, devicePixelRatio || 1);
  fondo = document.createElement('canvas');
  fondo.width = Math.round(W * dpr); fondo.height = Math.round(altMappa * scala * dpr);
  const c = fondo.getContext('2d');
  c.setTransform(dpr * scala, 0, 0, dpr * scala, 0, 0);
  D.sfondo(c, altMappa, quartieriAperti());
  // alberi lungo il corso
  for (let y = 30; y < altMappa - 20; y += 64) { D.albero(c, 151, y, 5); D.albero(c, 209, y + 32, 5); }
  const k0 = prossimo();
  EDIFICI.forEach((e, k) => {
    const l = lotto(k);
    if (l.y > altMappa) return;
    if (!aperto(k)) { D.lottoChiuso(c, l.x, l.y, l.w, l.h); if (k !== k0) { c.font = '18px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.globalAlpha = 0.5; c.fillText(e.em, l.x + l.w / 2, l.y + l.h / 2); c.globalAlpha = 1; } return; }
    if (e.id === 'parcheggio') D.parcheggio(c, l.x, l.y, l.w, l.h, postiParcheggio(S.ed[k].L));
    else if (e.id === 'bus') D.fermata(c, l.x, l.y, l.w, l.h);
    else if (e.id === 'porto') D.porto(c, l.x, l.y, l.w, l.h, altMappa);
    else if (e.id === 'calcio') D.campo(c, l.x, l.y, l.w, l.h);
    else if (e.id === 'gokart') D.pista(c, l.x, l.y, l.w, l.h);
    else D.negozio(c, e, l.x, l.y, l.w, l.h);
  });
  if (altMappa > QUARTIERI.at(-1).fine - 10 && !aperto(K_PORTO)) { c.fillStyle = '#2f8fc9'; c.fillRect(0, QUARTIERI.at(-1).fine, 360, 90); }
}
function disegna(now) {
  if (!ctx) return;
  const dpr = Math.min(2, devicePixelRatio || 1);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(fondo, 0, 0);
  ctx.setTransform(dpr * scala, 0, 0, dpr * scala, 0, 0);
  const t = now / 1000;
  // attrazioni animate
  const kc = ingressoK('calcio');
  if (aperto(kc)) {
    const l = lotto(kc), a = D.areaCampo(l.x, l.y, l.w, l.h);
    R.calcio ??= { gioc: Array.from({ length: 10 }, (_, j) => ({ x: a.x1 + Math.random() * (a.x2 - a.x1), y: a.y1 + Math.random() * (a.y2 - a.y1), sq: j % 2 })), palla: { x: (a.x1 + a.x2) / 2, y: (a.y1 + a.y2) / 2, vx: 20, vy: 14 } };
    const pl = R.calcio.palla;
    pl.x += pl.vx * 0.016; pl.y += pl.vy * 0.016;
    if (pl.x < a.x1 || pl.x > a.x2) pl.vx *= -1;
    if (pl.y < a.y1 || pl.y > a.y2) pl.vy *= -1;
    if (Math.random() < 0.01) { pl.vx = (Math.random() - 0.5) * 60; pl.vy = (Math.random() - 0.5) * 60; }
    for (const g of R.calcio.gioc) {
      g.x += (pl.x - g.x) * 0.006 + (Math.random() - 0.5) * 0.6; g.y += (pl.y - g.y) * 0.006 + (Math.random() - 0.5) * 0.6;
      D.giocatore(ctx, g.x, g.y, g.sq ? '#e8503a' : '#2f7fbf');
    }
    D.palla(ctx, pl.x, pl.y);
  }
  const kk = ingressoK('gokart');
  if (aperto(kk)) {
    const l = lotto(kk), n = Math.min(6, 2 + R.code[kk].serviti.length);
    for (let j = 0; j < n; j++) { const p = D.puntoPista(l.x, l.y, l.w, l.h, t * (0.07 + j * 0.006) + j / n); D.kart(ctx, p.x, p.y, p.a, AUTO[j % AUTO.length]); }
  }
  // mezzi
  const lp = lotto(K_PARCHEGGIO);
  for (const a of R.auto) {
    if (a.fase === 'ferma') D.autoParcheggiata(ctx, a.x, a.y, a.colore);
    else if (a.fase === 'entra' || a.fase === 'esce') { ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(a.fase === 'entra' ? Math.PI / 2 : -Math.PI / 2); D.automobile(ctx, 0, 0, a.colore, true); ctx.restore(); }
    else D.automobile(ctx, a.x, a.y, a.colore, a.fase === 'arriva');
  }
  void lp;
  if (R.bus) D.autobus(ctx, R.bus.x, R.bus.y, true);
  if (R.traghetto && aperto(K_PORTO)) D.traghetto(ctx, R.traghetto.x, R.traghetto.y);
  // persone in fila: in coda lungo il marciapiede
  R.code.forEach((c, k) => {
    const p = porta(k);
    c.fila.forEach((q, j) => { q.x = p.mx; q.y = p.y + 9 + j * 8; });
  });
  for (const p of R.persone) {
    if (p.ritardo > 0 || p.fase === 'servito') continue;
    D.persona(ctx, p.x, p.y, p.colore, p.fase === 'fila' ? 0 : p.passo, p.carrello, p.triste);
  }
  // soldi che volano dalle casse
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const v of R.voli) {
    ctx.globalAlpha = 1 - v.t; ctx.font = 'bold 11px system-ui'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.55)';
    ctx.strokeText(v.testo, v.x, v.y - v.t * 22); ctx.fillStyle = '#ffe066'; ctx.fillText(v.testo, v.x, v.y - v.t * 22);
  }
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------- schermata del paese (mappa + comandi sopra)
function renderPaese() {
  W = Math.min(view.clientWidth || 360, 640); scala = W / 360;
  preparaFondo();
  const H = altMappa * scala, dpr = Math.min(2, devicePixelRatio || 1);
  const k0 = prossimo(), lv = lavori();
  view.innerHTML = `<div class="avviso" id="avviso"></div><div id="mappa" style="height:${H}px">
    <canvas id="tela" width="${Math.round(W * dpr)}" height="${Math.round(H * dpr)}" style="width:${W}px;height:${H}px"></canvas>
    ${EDIFICI.map((e, k) => (aperto(k) ? sovrapposizione(k) : '')).join('')}
    ${k0 != null && lotto(k0).y < altMappa ? prossimoHtml(k0, lv) : ''}
  </div>`;
  canvas = $('#tela'); ctx = canvas.getContext('2d');
}
const px = v => `${v * scala}px`;
function sovrapposizione(k) {
  const e = EDIFICI[k], l = lotto(k);
  return `<button class="hit" data-su="${k}" style="left:${px(l.x)};top:${px(l.y)};width:${px(l.w)};height:${px(l.h)}" aria-label="Migliora ${e.nome}"></button>
    <div class="targhe" style="left:${px(l.x + 4)};top:${px(l.y + 4)};width:${px(l.w - 8)}">
      <button class="targa" data-su="${k}" id="tg${k}"></button>
      ${slotGestore(k)}
    </div>
    ${e.tipo !== 'ingresso' ? `<button class="cassaB" data-raccogli="${k}" id="cs${k}" style="left:${px(l.x + l.w / 2)};top:${px(l.y + l.h - 22)}" hidden></button>` : ''}`;
}
function prossimoHtml(k, lv) {
  const e = EDIFICI[k], l = lotto(k);
  return `<div class="prossimo" style="left:${px(l.x)};top:${px(l.y)};width:${px(l.w)};height:${px(l.h)}">
    ${lv ? `<div class="lavori"><b>🚧 Lavori: ${QUARTIERI[lv.q].nome}</b><span id="lavoriResta"></span><button class="mini" data-finisci><span>Finisci</span> <small id="lavoriPrezzo"></small></button></div>`
    : `<button class="apri" data-apri="${k}"><span>${e.em} Apri</span><small>${e.nome}</small><b>${fmt(e.apri)}</b></button>`}
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
  const arr = arriviAlSec() * 60, serv = servibiliAlSec() * 60;
  view.innerHTML = `<div class="pagina"><h2>Potenziamenti</h2><p class="note">Valgono fino al prossimo rinnovo.</p>
    ${liberi.map(u => `<div class="voce"><span class="em">${u.em}</span><span class="t"><b>${u.nome}</b>
      <small>${u.tipo === 'prezzo' ? `Tutti i clienti pagano ×${u.molt}` : u.tipo === 'arrivi' ? `Arriva gente ×${u.molt} più spesso` : `Tutte le casse ×${u.molt} più veloci`} · ${fmt(u.costo)}</small></span>
      <button data-upg="${u.id}">Compra</button></div>`).join('') || '<p class="note">Li hai comprati tutti! 🎉</p>'}
    <h2>Il tuo paese</h2>
    <div class="card">
      <div class="riga"><span>🚗 Clienti che arrivano</span><b>${num(arr)} al minuto</b></div>
      <div class="riga"><span>🛍️ Clienti che i negozi servono</span><b>${num(serv)} al minuto</b></div>
      <div class="riga"><span>💶 Incasso</span><b>${fmt(alSecondo())}/s</b></div>
      <div class="riga"><span>😞 Clienti persi</span><b>${num(R.persi, 0)}</b></div>
      <p class="note">${arr > serv * 0.9 ? 'Arriva più gente di quanta ne servite: migliora i negozi (a 10, 25, 50… livelli aprono una cassa in più).' : 'I negozi potrebbero servire più clienti: migliora parcheggio, fermata e porto per farne arrivare di più.'}</p>
    </div></div>`;
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

// ---------------------------------------------------------------- gestori
const statoDi = m => { const t = ora(); return t < m.fino ? ['attiva', (m.fino - t) / 1000] : t < m.pronto ? ['ricarica', (m.pronto - t) / 1000] : ['pronta', 0]; };
const prezzoAssunzione = z => PREZZO_GESTORI[z].base * PREZZO_GESTORI[z].cresce ** S.staff[z].length;
const doveLavora = (z, m) => S.ed.findIndex((e, k) => zona(k) === z && e.g === m.id);
function attiva(k) {
  const m = gest(k);
  if (!m || ora() < m.pronto) return false;
  const gr = GRADI[m.r];
  m.fino = ora() + gr.durata * 1000; m.pronto = ora() + (gr.durata + gr.ricarica) * 1000;
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
  if (k != null && !S.ed[k].g) S.ed[k].g = m.id;
  return m;
}
function assegna(z, id, k) {
  S.ed.forEach((e, j) => { if (zona(j) === z && e.g === id) e.g = null; });
  if (k >= 0) { if (S.ed[k].g === null && S.ed[k].cassa > 0 && zona(k) === 'n') { incassa(S.ed[k].cassa); S.ed[k].cassa = 0; } S.ed[k].g = id; }
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
  const { k } = aperta, e = EDIFICI[k], L = S.ed[k].L, n = quanti(k), c = costo(k, n), L2 = L + n;
  const riga = (nome, a, b) => `<tr><td>${nome}</td><td>${a}</td><td class="dopo">${a === b ? '' : `→ ${b}`}</td></tr>`;
  let righe, prossimi;
  if (e.tipo === 'ingresso') {
    righe = riga(e.mezzo === 'auto' ? 'Arriva un\'auto ogni' : e.mezzo === 'bus' ? 'Passa un autobus ogni' : 'Arriva un traghetto ogni', `${num(ogniL(k, L))} s`, `${num(ogniL(k, L2))} s`)
      + riga('Persone per arrivo', num(genteL(k, L)), num(genteL(k, L2)))
      + riga('Clienti al minuto', num((genteL(k, L) / ogniL(k, L)) * 60), num((genteL(k, L2) / ogniL(k, L2)) * 60))
      + (e.mezzo === 'auto' ? riga('Posti auto', postiParcheggio(L), postiParcheggio(L2)) : '');
    prossimi = [e.mezzo === 'auto' && L < 40 ? `🅿️ Un posto auto in più ogni 5 livelli` : null, 'Più clienti arrivano, più i negozi lavorano'].filter(Boolean);
  } else {
    righe = riga('Ogni cliente paga', fmt(prezzoL(k, L)), fmt(prezzoL(k, L2)))
      + riga('Casse', casseL(L), casseL(L2))
      + riga('Clienti serviti al minuto', num(capacitaL(k, L) * 60), num(capacitaL(k, L2) * 60))
      + riga('Incasso massimo', `${fmt(prezzoL(k, L) * capacitaL(k, L))}/s`, `${fmt(prezzoL(k, L2) * capacitaL(k, L2))}/s`);
    const t = TAPPE.find(x => x > L), cs = CASSE.find(x => x > L);
    prossimi = [t && `🎉 Livello ${t}: prezzo ×2`, cs && `🧾 Livello ${cs}: una cassa in più`].filter(Boolean);
  }
  const sc = abilita(k, 'sconto'), m = gest(k);
  sheet.innerHTML = `<div class="scheda">
    <div class="sTitolo"><span>${e.em}</span><div><b>${e.nome}</b><small>Livello ${L}${n ? ` → ${L2}` : ''}</small></div><button class="chiudi" data-chiudi aria-label="Chiudi">✕</button></div>
    <table class="stat"><tbody>${righe}</tbody></table>
    ${prossimi.length ? `<ul class="prossimi">${prossimi.map(p => `<li>${p}</li>`).join('')}</ul>` : ''}
    <div class="seg">${MODI.map((x, j) => `<button data-modo="${j}" class="${S.modo === j ? 'on' : ''}">${x === 'max' ? 'Max' : `×${x}`}</button>`).join('')}</div>
    <button class="primary" data-compra="${k}" ${S.soldi >= c ? '' : 'disabled'}>Sali di ${n} ${n === 1 ? 'livello' : 'livelli'} · ${fmt(c)}${sc ? ` <small>(−${Math.round(sc * 100)}%)</small>` : ''}</button>
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

// ---------------------------------------------------------------- aggiornamento dell'interfaccia
const txt = (el, t) => { if (el && el.textContent !== t) el.textContent = t; };
function statoAbilita(k, el) {
  const m = gest(k);
  if (!m || !el) return;
  const [st, s] = statoDi(m), span = el.querySelector('span');
  el.className = `abil ${st}`; txt(span, st === 'pronta' ? '' : durata(s)); el.disabled = st !== 'pronta';
}
function aggiorna() {
  txt($('#soldi'), fmt(S.soldi));
  const ps = alSecondo(), pa = alSecondoAssente();
  txt($('#alSec'), `${fmt(ps)}/s · 👥 ${num(arriviAlSec() * 60, 0)} clienti/min${pa ? ` · ad app chiusa ${fmt(pa)}/s` : ''}${S.rinnovo ? ` · ⭐×${moltRinnovo()}` : ''}`);
  const pall = { potenzia: POTENZIAMENTI.some(u => !S.upg.includes(u.id) && S.soldi >= u.costo), rinnovo: !!RINNOVI[S.rinnovo] && S.soldi >= RINNOVI[S.rinnovo].costo };
  for (const b of document.querySelectorAll('#nav button')) {
    const on = !!pall[b.dataset.tab], has = b.querySelector('.pallino');
    if (on && !has) b.insertAdjacentHTML('beforeend', '<i class="pallino"></i>'); else if (!on && has) has.remove();
  }
  if (aperta && sheet.open && performance.now() - ultimoDisegno > 400) (aperta.tipo === 'su' ? disegnaSu : disegnaSquadra)();
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
  if (ap) ap.disabled = S.soldi < EDIFICI[+ap.dataset.apri].apri;
  // suggerimento in alto sulla mappa
  const arr = arriviAlSec(), serv = servibiliAlSec(), piene = S.ed.filter((x, k) => !x.g && EDIFICI[k].tipo !== 'ingresso' && x.L && x.cassa >= cassaMax(k) * 0.999).length;
  txt($('#avviso'), S.ed[1].L < 3 ? '👆 Tocca un edificio per migliorarlo · 💰 tocca la cassa per incassare'
    : piene ? `⚠️ ${piene === 1 ? 'Una cassa è piena' : `${piene} casse sono piene`}: toccale per incassare (o metti un gestore)`
    : arr > serv * 0.9 ? '🐢 Troppa fila: migliora i negozi (più casse)' : '🚗 I negozi possono servire di più: migliora gli ingressi');
}

// ---------------------------------------------------------------- tocchi
let toastT;
function toast(t) { const el = $('#toast'); el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (el.hidden = true), 2800); }
const vibra = p => { try { navigator.userActivation?.hasBeenActive && navigator.vibrate?.(p); } catch { /* niente */ } };
function render() {
  for (const b of document.querySelectorAll('#nav button')) b.classList.toggle('on', b.dataset.tab === tab);
  if (tab !== 'paese') { canvas = ctx = null; }
  if (tab === 'paese') renderPaese(); else if (tab === 'gestori') renderGestori(); else if (tab === 'potenzia') renderPotenzia(); else renderRinnovo();
  aggiorna();
}
const ridisegna = () => { if (aperta) (aperta.tipo === 'su' ? disegnaSu : disegnaSquadra)(); render(); salva(); };
document.addEventListener('click', e => {
  const on = s => e.target.closest(s);
  let el;
  if (on('[data-chiudi]')) { sheet.close(); return; }
  if ((el = on('#nav button'))) { tab = el.dataset.tab; render(); scrollTo(0, 0); return; }
  if ((el = on('[data-raccogli]'))) {
    const k = +el.dataset.raccogli, c = S.ed[k].cassa;
    if (c <= 0) return;
    incassa(c); S.ed[k].cassa = 0;
    const p = porta(k); R.voli.push({ k, x: p.x + (EDIFICI[k].lato === 'L' ? -50 : 50), y: lotto(k).y + lotto(k).h - 30, testo: '+' + fmt(c), t: 0 });
    vibra(10); aggiorna(); salva(); return;
  }
  if ((el = on('[data-su]'))) { schedaSu(+el.dataset.su); return; }
  if ((el = on('[data-modo]'))) { S.modo = +el.dataset.modo; if (aperta) disegnaSu(); return; }
  if ((el = on('[data-compra]'))) {
    const k = +el.dataset.compra, n = quanti(k), c = costo(k, n);
    if (S.soldi < c) return;
    const ed = S.ed[k], primaT = tappe(ed.L), primaC = casseL(ed.L), primaP = postiParcheggio(ed.L);
    S.soldi -= c; ed.L += n;
    if (EDIFICI[k].tipo !== 'ingresso') {
      if (casseL(ed.L) > primaC) toast(`🧾 ${EDIFICI[k].nome}: una cassa in più!`);
      else if (tappe(ed.L) > primaT) toast(`🎉 ${EDIFICI[k].nome}: prezzo raddoppiato!`);
      if (k === 1 && ed.L >= LIVELLO_GESTORI && ed.L - n < LIVELLO_GESTORI) { toast('🧑‍💼 Ora puoi assumere i gestori!'); render(); }
    } else if (EDIFICI[k].mezzo === 'auto' && postiParcheggio(ed.L) > primaP) { toast('🅿️ Un posto auto in più!'); render(); }
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
    if (attiva(k)) { const m = gest(k), ab = ABILITA[zona(k)][m.a]; vibra(15); toast(`${ab.em} ${m.nome}: ${ab.nome} per ${durataLunga(GRADI[m.r].durata)}!`); if (aperta) (aperta.tipo === 'su' ? disegnaSu : disegnaSquadra)(); if (tab === 'gestori') renderGestori(); aggiorna(); salva(); }
    return;
  }
  if (on('[data-attiva-tutti]')) {
    let n = 0; S.ed.forEach((x, k) => { if (x.L && attiva(k)) n++; });
    toast(n ? `⚡ ${n} abilità attivate!` : 'Nessuna abilità pronta in questo momento'); if (n) { vibra(20); renderGestori(); salva(); }
    return;
  }
  if ((el = on('[data-apri]'))) {
    const k = +el.dataset.apri, ed = EDIFICI[k];
    if (S.soldi < ed.apri || lavori()) return;
    S.soldi -= ed.apri; S.ed[k].L = 1; toast(`${ed.em} Hai aperto: ${ed.nome}`); vibra([20, 40, 20]); render(); salva(); return;
  }
  if (on('[data-finisci]')) { const lv = lavori(); if (!lv || S.soldi < lv.prezzo) return; S.soldi -= lv.prezzo; S.lavori[lv.q] = ora(); toast('🚧 Lavori finiti!'); render(); salva(); return; }
  if ((el = on('[data-upg]'))) { const u = POTENZIAMENTI.find(x => x.id === el.dataset.upg); if (!u || S.soldi < u.costo) return; S.soldi -= u.costo; S.upg.push(u.id); toast(`${u.em} ${u.nome}!`); render(); salva(); return; }
  if (on('[data-rinnova]')) {
    const p = RINNOVI[S.rinnovo]; if (!p || S.soldi < p.costo) return;
    sheet.innerHTML = `<div style="font-size:44px">⭐</div><h3 style="margin:6px 0">${p.nome}</h3><p class="note">Paghi ${fmt(p.costo)} e il paese riparte da capo, ma da ora incassi <b>×${p.molt}</b> per sempre.</p>
      <button class="primary" data-conferma-rinnovo>Sì, rinnova</button><button class="link" data-chiudi>Annulla</button>`;
    sheet.showModal(); return;
  }
  if (on('[data-conferma-rinnovo]')) { const r = S.rinnovo + 1, car = S.carriera; S = nuovo(r, car); azzeraMondo(); sheet.close(); tab = 'paese'; render(); salva(); toast(`⭐ ${RINNOVI[r - 1].nome}: incassi ×${RINNOVI[r - 1].molt}!`); return; }
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
  R.persone = []; R.auto = []; R.bus = null; R.traghetto = null; R.voli = []; R.calcio = null; R.persi = 0;
  R.code = EDIFICI.map(() => ({ fila: [], serviti: [] })); R.stalli = Array(12).fill(null);
}
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
window.gioco = { get S() { return S; }, R, fmt, avanza, render, salva, aggiorna, arriviAlSec, servibiliAlSec, disegna: () => disegna(performance.now()) };   // per le prove
