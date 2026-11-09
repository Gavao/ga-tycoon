// GA Tycoon · Corso Italia: il corso scende a terrazze verso il mare. Ogni terrazza è una bottega con i suoi commessi;
// la funicolare porta le cassette al deposito in piazza e le Ape portano la merce al mercato, dove si incassa.
import { APP_VERSION } from './version.js';
import {
  BOTTEGHE, CRESCE_BOTTEGA, TAPPE, COMMESSI, LIVELLO_GESTORI, GIRO, LAVORI, FUNICOLARE as F, APE as A,
  GRADI, ABILITA, PREZZO_GESTORI, NOMI_GESTORI, QUOTA_ASSENZA, POTENZIAMENTI, RINNOVI,
} from './dati.js';
import { omino, cabina, ape, deposito, mercato, limone } from './disegni.js';

const $ = s => document.querySelector(s);
const view = $('#view');
const sheet = $('#sheet');
const KEY = 'gatycoon';
const MODI = [1, 10, 50, 'max'];
const PIAZZA = 290, RIGA = 136;   // altezze in px della piazza e di una terrazza

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
const durata = s => {
  s = Math.max(0, Math.ceil(s));
  if (s < 60) return `0:${String(s).padStart(2, '0')}`;
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${m}:${String(ss).padStart(2, '0')}`;
};
const durataLunga = s => (s >= 3600 ? `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min` : s >= 60 ? `${Math.round(s / 60)} min` : `${Math.round(s)} s`);
const ora = () => Date.now();

// ---------------------------------------------------------------- stato
const bottegaVuota = () => ({ L: 0, g: null, cassa: 0, w: [{ fase: 'fermo', t: 0 }] });
const nuovo = (rinnovo = 0, carriera = 0) => ({
  v: 3, soldi: 0, partita: 0, carriera, rinnovo, modo: 0, upg: [], ultimo: ora(), deposito: 0, lavori: {},
  staff: { b: [], f: [], a: [] },   // squadre di gestori; nei posti (g) c'è l'id del gestore assegnato
  liv: BOTTEGHE.map((_, i) => ({ ...bottegaVuota(), L: i ? 0 : 1 })),
  funi: { L: 1, g: null, fase: 'fermo', pos: 0, carico: 0, t: 0 },
  ape: { L: 1, g: null, fase: 'fermo', x: 0, carico: 0, t: 0 },
});
function carica() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (s?.v === 3 && Array.isArray(s.liv)) {
      while (s.liv.length < BOTTEGHE.length) s.liv.push(bottegaVuota());
      if (!s.staff) {   // salvataggi di prima: il gestore stava dentro il posto, ora sta nella squadra
        s.staff = { b: [], f: [], a: [] };
        const sposta = (chi, p) => {
          if (!p.g || typeof p.g !== 'object') return;
          const m = { ...p.g, id: Math.random().toString(36).slice(2, 9), nome: NOMI_GESTORI[s.staff[chi].length % NOMI_GESTORI.length] };
          m.a = Math.min(m.a, ABILITA[chi].length - 1);
          s.staff[chi].push(m); p.g = m.id;
        };
        s.liv.forEach(l => sposta('b', l)); sposta('f', s.funi); sposta('a', s.ape);
      }
      return s;
    }
  } catch { /* salvataggio rovinato */ }
  return nuovo();
}
let S = carica();
const salva = () => { S.ultimo = ora(); try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* spazio pieno */ } };

// ---------------------------------------------------------------- regole
const molt = tipo => POTENZIAMENTI.filter(u => u.tipo === tipo && S.upg.includes(u.id)).reduce((m, u) => m * u.molt, 1);
const moltRinnovo = () => (S.rinnovo ? RINNOVI[S.rinnovo - 1].molt : 1);
const aperte = () => S.liv.filter(l => l.L > 0).length;
const tappe = L => TAPPE.filter(t => L >= t).length;
const nCommessi = L => 1 + COMMESSI.filter(t => L >= t).length;
const nApe = () => 1 + A.nuoveApe.filter(t => S.ape.L >= t).length;
const posto = (chi, i) => (chi === 'b' ? S.liv[i] : chi === 'f' ? S.funi : S.ape);
/** Gestore assegnato a un posto (oggetto della squadra) oppure null. */
const gest = (chi, i) => { const id = posto(chi, i).g; return id ? S.staff[chi].find(m => m.id === id) ?? null : null; };
/** Dove lavora un gestore: indice del posto (0 per funicolare e Ape) oppure -1 se è libero. */
const doveLavora = (chi, m) => (chi === 'b' ? S.liv.findIndex(l => l.g === m.id) : posto(chi, 0).g === m.id ? 0 : -1);
/** Effetto dell'abilità del gestore se è attiva in questo momento (altrimenti null). */
const abilita = (chi, i, id) => {
  const m = gest(chi, i);
  if (!m || ora() >= m.fino) return null;
  const ab = ABILITA[chi][m.a];
  return ab.id === id ? ab.effetto[m.r] : null;
};
const prezzoAssunzione = chi => PREZZO_GESTORI[chi].base * PREZZO_GESTORI[chi].cresce ** S.staff[chi].length;
// Valori a un dato livello L (servono anche alle schede per mostrare "adesso → dopo")
const prodL = (i, L) => BOTTEGHE[i].base * L * 2 ** tappe(L) * molt('prod') * moltRinnovo();
const velFuniL = L => Math.min(F.velocitaMax, 1 + (L - 1) * F.velocitaPerLivello) * molt('funi');
const capFuniL = L => F.cap * F.capCresce ** (L - 1);
const nApeL = L => 1 + A.nuoveApe.filter(t => L >= t).length;
const capUnaApeL = L => A.cap * A.capCresce ** (L - 1);
const prod = i => prodL(i, S.liv[i].L);
const giro = GIRO.lavora + GIRO.porta + GIRO.rientra;
// Velocità con le abilità attive: lavoro e passo dei commessi; corsa, carico e capienza di funicolare e Ape
const vLavoro = i => abilita('b', i, 'lavoro') ?? 1;
const vPasso = i => abilita('b', i, 'passo') ?? 1;
const cicloBottega = i => GIRO.lavora / vLavoro(i) + (GIRO.porta + GIRO.rientra) / vPasso(i);
const velFuni = () => velFuniL(S.funi.L) * (abilita('f', 0, 'veloce') ?? 1);
const caricoFuni = () => F.carico / (velFuniL(S.funi.L) * (abilita('f', 0, 'caricamento') ?? 1));
const capFuni = () => capFuniL(S.funi.L) * (abilita('f', 0, 'capienza') ?? 1);
const velApe = () => molt('ape') * (abilita('a', 0, 'veloce') ?? 1);
const caricoApe = () => A.carico / (molt('ape') * (abilita('a', 0, 'caricamento') ?? 1));
const capApe = () => capUnaApeL(S.ape.L) * nApe() * (abilita('a', 0, 'capienza') ?? 1);
const viaggioFuni = () => (2 * aperte() * F.perTerrazza) / velFuni() + aperte() * caricoFuni();
const viaggioApe = () => (2 * A.viaggio) / velApe() + caricoApe();
/** Euro al secondo che ogni anello della catena riesce a gestire. */
const ritmi = () => ({
  botteghe: S.liv.reduce((s, l, i) => s + (l.L ? prod(i) / cicloBottega(i) : 0), 0),
  funi: capFuni() / viaggioFuni(),
  ape: capApe() / viaggioApe(),
});
/** Guadagno al secondo con i gestori (lavora da solo solo chi ha il gestore). */
const alSecondo = () => {
  if (!S.funi.g || !S.ape.g) return 0;
  const auto = S.liv.reduce((s, l, i) => s + (l.L && l.g ? prod(i) / cicloBottega(i) : 0), 0);
  const r = ritmi();
  return Math.min(auto, r.funi, r.ape);
};
const collo = () => { const r = ritmi(); return r.botteghe <= r.funi && r.botteghe <= r.ape ? 'botteghe' : r.funi <= r.ape ? 'funi' : 'ape'; };
const gestoriAperti = () => S.liv[0].L >= LIVELLO_GESTORI;

/** Prezzo per salire di k livelli: chi = 'b' (bottega i), 'f' (funicolare), 'a' (Ape). Con lo sconto del gestore se attivo. */
function parametri(chi, i) {
  return chi === 'b' ? [BOTTEGHE[i].su, CRESCE_BOTTEGA, S.liv[i].L] : chi === 'f' ? [F.su, F.cresce, S.funi.L] : [A.su, A.cresce, S.ape.L];
}
function costo(chi, i, k) {
  const [base, g, L] = parametri(chi, i);
  return base * g ** (L - 1) * (g ** k - 1) / (g - 1) * (1 - (abilita(chi, i, 'sconto') ?? 0));
}
function quanti(chi, i) {
  const m = MODI[S.modo];
  if (m !== 'max') return m;
  const [base, g, L] = parametri(chi, i), sc = 1 - (abilita(chi, i, 'sconto') ?? 0);
  return Math.max(1, Math.floor(Math.log((S.soldi * (g - 1)) / (base * g ** (L - 1) * sc) + 1) / Math.log(g)));
}
const incassa = x => { S.soldi += x; S.partita += x; S.carriera += x; };

/** Lavori sulla scalinata prima della prossima bottega: { fine, resta } oppure null. */
function lavori() {
  const n = aperte();
  if (!(n in LAVORI) || n >= BOTTEGHE.length) return null;
  S.lavori[n] ??= ora() + LAVORI[n] * 1000;
  const resta = (S.lavori[n] - ora()) / 1000;
  return resta > 0 ? { n, resta, prezzo: BOTTEGHE[n].apri * 0.5 * (resta / LAVORI[n]) } : null;
}

// ---------------------------------------------------------------- il tempo che passa
const depositi = {}, ultimoVolo = {};   // merce appena messa in cassetta, per far volare il "+€" (non si salva)
function avanza(dt) {
  // Commessi: lavorano al bancone, portano la merce in cassetta, rientrano
  S.liv.forEach((l, i) => {
    if (!l.L) return;
    const n = nCommessi(l.L);
    while (l.w.length < n) l.w.push({ fase: 'fermo', t: -0.5 * l.w.length });
    const vl = vLavoro(i), vp = vPasso(i), quota = prod(i) / n;
    for (const w of l.w) {
      if (w.fase === 'fermo') { if (l.g) { w.fase = 'lavora'; } else continue; }
      w.t += dt * (w.fase === 'lavora' ? vl : vp);
      if (w.t < 0) continue;
      if (w.fase === 'lavora' && w.t >= GIRO.lavora) { w.fase = 'porta'; w.t = 0; }
      else if (w.fase === 'porta' && w.t >= GIRO.porta) { w.fase = 'rientra'; w.t = 0; l.cassa += quota; depositi[i] = (depositi[i] ?? 0) + quota; }
      else if (w.fase === 'rientra' && w.t >= GIRO.rientra) { w.fase = 'fermo'; w.t = 0; }
    }
  });
  // Funicolare: scende fermandosi a ogni terrazza, carica, risale e scarica al deposito
  const f = S.funi, passo = F.perTerrazza / velFuni(), n = aperte();
  if (f.fase === 'fermo' && f.g) f.fase = 'scende';
  if (f.fase === 'scende') {
    const meta = Math.floor(f.pos) + 1;
    f.pos = Math.min(meta, f.pos + dt / passo);
    if (f.pos >= meta) { f.fase = 'carica'; f.t = 0; }
  } else if (f.fase === 'carica') {
    f.t += dt;
    if (f.t >= caricoFuni()) {
      const l = S.liv[f.pos - 1], presa = Math.min(capFuni() - f.carico, l?.cassa ?? 0);
      if (l) { l.cassa -= presa; f.carico += presa; }
      f.fase = f.carico >= capFuni() - 1e-9 || f.pos >= n ? 'sale' : 'scende';
    }
  } else if (f.fase === 'sale') {
    f.pos = Math.max(0, f.pos - dt / passo);
    if (f.pos <= 0) { S.deposito += f.carico; f.carico = 0; f.fase = 'fermo'; }
  }
  // Ape: caricano al deposito, vanno al mercato, vendono, tornano
  const a = S.ape, corsa = A.viaggio / velApe();
  if (a.fase === 'fermo' && a.g && S.deposito > 0) { a.fase = 'carica'; a.t = 0; }
  if (a.fase === 'carica') {
    a.t += dt;
    if (a.t >= caricoApe()) { a.carico = Math.min(capApe(), S.deposito); S.deposito -= a.carico; a.fase = 'va'; }
  } else if (a.fase === 'va') {
    a.x = Math.min(1, a.x + dt / corsa);
    if (a.x >= 1) { incassa(a.carico); if (a.carico > 0) vola(a.carico); a.carico = 0; a.fase = 'torna'; }
  } else if (a.fase === 'torna') {
    a.x = Math.max(0, a.x - dt / corsa);
    if (a.x <= 0) a.fase = 'fermo';
  }
}

/** Guadagni mentre l'app era chiusa: lavora solo chi ha il gestore, a metà del ritmo, al passo dell'anello più lento. */
function guadagniAssenza() {
  const sec = Math.min(7 * 86400, (ora() - (S.ultimo ?? ora())) / 1000);
  if (sec < 30) return;
  const q = QUOTA_ASSENZA;
  S.liv.forEach((l, i) => { if (l.L && l.g) l.cassa += (prod(i) / giro) * q * sec; });   // ad app chiusa niente abilità
  const r = ritmi();
  if (S.funi.g) {
    const stock = S.liv.reduce((s, l) => s + l.cassa, 0), mosso = Math.min(stock, r.funi * q * sec);
    if (stock > 0) for (const l of S.liv) l.cassa -= l.cassa * (mosso / stock);
    S.deposito += mosso;
  }
  let venduto = 0;
  if (S.ape.g) { venduto = Math.min(S.deposito, r.ape * q * sec); S.deposito -= venduto; incassa(venduto); }
  if (venduto > 0 || S.liv.some(l => l.g)) {
    sheet.innerHTML = `<div style="font-size:44px">🌙</div><h3 style="margin:6px 0">Bentornato!</h3>
      <p class="note">In ${durataLunga(sec)} i gestori hanno incassato</p><div class="grande">${fmt(venduto)}</div>
      ${!S.funi.g || !S.ape.g ? '<p class="note">💡 Assumi anche i gestori della funicolare e delle Ape: senza di loro la merce resta ferma nelle cassette.</p>' : '<p class="note">Ad app chiusa i gestori lavorano a metà ritmo: con l\'app aperta guadagni di più.</p>'}
      <button class="primary" data-chiudi>Riscuoti</button>`;
    sheet.showModal();
  }
}

// ---------------------------------------------------------------- scena
let tab = 'paese', W = 360;
const xCassa = 84, xBanco = () => W - 128;
function renderPaese() {
  W = view.clientWidth || 360;
  const n = aperte(), prossima = n < BOTTEGHE.length ? n : -1, righe = n + (prossima >= 0 ? 1 : 0);
  const alt = PIAZZA + righe * RIGA + 220;
  view.innerHTML = `<div id="scena" style="height:${alt}px">
    <div class="cielo"><div class="sole"></div><div class="colle c1"></div><div class="colle c2"></div></div>
    <div class="piazza">
      <button class="dep" data-su="f:0" aria-label="Migliora la funicolare">${deposito()}<span class="bolla" id="bDep"></span><span class="targa" id="tg-f"></span></button>
      <button class="merc" data-su="a:0" aria-label="Migliora le Ape">${mercato()}<span class="targa" id="tg-a"></span></button>
      <div class="strada"></div>
      <div class="apeBox" id="ape" data-act="ape">${ape()}<span class="bolla" id="bApe"></span><span class="nApe" id="nApe"></span><span class="mano" id="mApe">👆</span></div>
      <div class="comandi">${comando('f', '🚡', 'Funicolare')}${comando('a', '🛺', 'Ape')}</div>
      <div class="collo" id="collo"></div>
      <button class="attivaTutti" id="attivaTutti" data-attiva-tutti hidden>⚡ Attiva tutti</button>
    </div>
    <div class="binario" style="height:${PIAZZA - 168 + righe * RIGA}px" data-act="funi"></div>
    ${S.liv.slice(0, n).map((l, i) => terrazza(i)).join('')}
    ${prossima >= 0 ? `<div class="terrazza chiusa" style="top:${PIAZZA + n * RIGA}px" id="prossima">
      <div class="muro" style="background:${BOTTEGHE[prossima].muro}"></div>
      <div class="lavori" id="lavori" hidden><b>🚧 Lavori sulla scalinata</b><span id="lavoriResta"></span>
        <button class="su" data-finisci><span>Finisci subito</span><small id="lavoriPrezzo"></small></button></div>
      <button class="apri" data-apri="${prossima}"><span>${BOTTEGHE[prossima].em} Apri ${BOTTEGHE[prossima].nome}</span><b>${fmt(BOTTEGHE[prossima].apri)}</b></button>
    </div>` : ''}
    <div class="mare" style="top:${PIAZZA + righe * RIGA}px"><span>⛵</span><span>🛥️</span></div>
    <div class="cabinaBox" id="cabina" data-act="funi">${cabina()}<span class="bolla" id="bFuni"></span><span class="mano" id="mFuni">👆</span></div>
  </div>`;
}
/** Il posto del gestore: lucchetto, pulsante per assumerlo, oppure il gestore con la sua abilità. */
function slotGestore(chi, i) {
  if (!gestoriAperti()) return `<span class="lucchetto" title="I gestori arrivano quando il chiosco è al livello ${LIVELLO_GESTORI}">🔒</span>`;
  const m = gest(chi, i);
  if (!m) return `<button class="assumi" data-squadra="${chi}:${i}">🧑‍💼 +</button>`;
  const ab = ABILITA[chi][m.a];
  return `<button class="gestore" data-squadra="${chi}:${i}" style="--r:${GRADI[m.r].colore}" aria-label="${m.nome}, ${GRADI[m.r].nome}">🧑‍💼</button>
    <button class="abil" data-attiva="${chi}:${i}" id="ab-${chi}${i}">${ab.em} <span></span></button>`;
}
/** Pannello di funicolare o Ape in piazza: si tocca per aprire la scheda di potenziamento. */
function comando(chi, em, nome) {
  return `<div class="cmd">
    <div class="cmdInfo" data-su="${chi}:0"><b>${em} ${nome} <i id="liv-${chi}"></i></b><small id="info-${chi}"></small>
      <span class="avanz"><i id="bar-${chi}"></i></span><small class="prox" id="prox-${chi}"></small></div>
    <div class="cmdGest">${slotGestore(chi, 0)}</div></div>`;
}
/** Prossimo traguardo di un posto: { testo, quota (0-1) } oppure null. */
function traguardo(chi, i) {
  if (chi === 'f') return null;
  const L = posto(chi, i).L;
  const eventi = chi === 'b'
    ? [...TAPPE.map(t => [t, '🎉 ×2']), ...COMMESSI.map(t => [t, '👥 +1 commesso'])]
    : A.nuoveApe.map(t => [t, '🛺 +1 Ape']);
  const prossimi = eventi.filter(([t]) => t > L).sort((x, y) => x[0] - y[0]);
  if (!prossimi.length) return null;
  const [t] = prossimi[0], cosa = prossimi.filter(([x]) => x === t).map(([, c]) => c).join(' e ');
  const prima = Math.max(0, ...eventi.map(([x]) => x).filter(x => x <= L));
  return { testo: `${cosa} al liv. ${t} · mancano ${t - L}`, quota: (L - prima) / (t - prima) };
}
function terrazza(i) {
  const b = BOTTEGHE[i], l = S.liv[i], n = nCommessi(l.L);
  return `<div class="terrazza" style="top:${PIAZZA + i * RIGA}px" data-i="${i}">
    <div class="muro" style="background:${b.muro}"></div>
    ${i % 3 === 1 ? limone(W - 46, 0.8) : ''}
    <button class="bottega" data-su="b:${i}" aria-label="Migliora ${b.nome}">
      <span class="tenda" style="--t:${b.tenda}"></span>
      <span class="insegna">${b.em} ${b.nome}</span>
      <span class="vetrina"><span>${b.em}</span></span>
      <span class="porta"></span>
      <span class="targa" id="tg-b${i}"></span>
    </button>
    <div class="gslot">${slotGestore('b', i)}</div>
    <button class="cassetta" data-act="lav:${i}" aria-label="Fai lavorare"><span class="bolla" id="bc${i}"></span></button>
    ${Array.from({ length: n }, (_, k) => `<div class="commesso" id="w${i}_${k}" data-act="lav:${i}">${omino(b.maglia, b.cappello)}${k === 0 ? `<span class="mano" id="m${i}">👆</span>` : ''}</div>`).join('')}
    <div class="pedana">
      <span class="livTxt" id="liv${i}"></span>
      <span class="prox" id="prox${i}"></span>
      <span class="avanz"><i id="bar${i}"></i></span>
    </div>
  </div>`;
}

function renderPotenzia() {
  const liberi = POTENZIAMENTI.filter(u => !S.upg.includes(u.id));
  const r = ritmi();
  view.innerHTML = `<h2>Potenziamenti</h2>
    <p class="note">Valgono fino al prossimo rinnovo del corso.</p>
    ${liberi.map(u => `<div class="voce"><span class="em">${u.em}</span><span class="t"><b>${u.nome}</b>
      <small>${u.tipo === 'prod' ? `Produzione di tutte le botteghe ×${u.molt}` : `${u.tipo === 'funi' ? 'Funicolare' : 'Ape'} più veloci ×${u.molt}`} · ${fmt(u.costo)}</small></span>
      <button data-upg="${u.id}">Compra</button></div>`).join('') || '<p class="note">Li hai comprati tutti! 🎉</p>'}
    <h2>La tua catena</h2>
    <div class="card">
      <div class="riga"><span>🏪 Le botteghe producono</span><b>${fmt(r.botteghe)}/s</b></div>
      <div class="riga"><span>🚡 La funicolare porta su</span><b>${fmt(r.funi)}/s</b></div>
      <div class="riga"><span>🛺 Le Ape vendono (${nApe()})</span><b>${fmt(r.ape)}/s</b></div>
      <p class="note">Guadagni al ritmo dell'anello più lento: potenzia quello. Le Ape aumentano ai livelli ${A.nuoveApe.join(', ')}; i commessi ai livelli ${COMMESSI.join(', ')}.</p>
    </div>`;
}
function renderRinnovo() {
  const prossimo = RINNOVI[S.rinnovo];
  view.innerHTML = `<h2>Rinnovo del corso</h2>
    <div class="card"><div class="note">Livello di rinnovo</div><div class="grande">⭐ ${S.rinnovo} / ${RINNOVI.length}</div>
      <div class="note">${S.rinnovo ? `${RINNOVI[S.rinnovo - 1].nome}: tutta la produzione <b>×${moltRinnovo()}</b> per sempre.` : 'Nessun rinnovo ancora: la produzione è normale.'}</div></div>
    ${prossimo ? `<div class="card"><div class="note">Prossimo rinnovo</div><b style="font-size:18px">${prossimo.nome}</b>
      <div class="riga"><span>Produzione per sempre</span><b>×${prossimo.molt}</b></div>
      <div class="riga"><span>Costa</span><b>${fmt(prossimo.costo)}</b></div>
      <div class="note">Paghi, il corso riparte dal chiosco delle granite (botteghe, funicolare, Ape, gestori e potenziamenti tornano a zero) ma da lì in poi produci ×${prossimo.molt}.</div>
      <button class="primary" data-rinnova ${S.soldi >= prossimo.costo ? '' : 'disabled'}>Rinnova il corso</button></div>` : '<div class="card">Hai il corso più bello d\'Italia! 🇮🇹</div>'}
    <div class="card"><div class="note">Questa partita</div><b>${fmt(S.partita)}</b> guadagnati · <b>${aperte()}</b> botteghe aperte su ${BOTTEGHE.length}<br><span class="note">In tutto: ${fmt(S.carriera)}</span></div>
    <button class="link" data-azzera>Cancella tutto e ricomincia da zero</button>
    <p class="note">Versione ${APP_VERSION}</p>`;
}
function render() {
  for (const b of document.querySelectorAll('#nav button')) b.classList.toggle('on', b.dataset.tab === tab);
  if (tab === 'paese') renderPaese(); else if (tab === 'gestori') renderGestori(); else if (tab === 'potenzia') renderPotenzia(); else renderRinnovo();
  aggiorna(true);
}

// ---------------------------------------------------------------- aggiornamento a ogni fotogramma
const txt = (el, t) => { if (el && el.textContent !== t) el.textContent = t; };
const sposta = (el, x, y, flip = false) => { if (el) el.style.transform = `translate(${x}px, ${y}px)${flip ? ' scaleX(-1)' : ''}`; };
/** Stato dell'abilità di un gestore: 'attiva' | 'ricarica' | 'pronta', con i secondi che mancano. */
const statoDi = m => { const t = ora(); return t < m.fino ? ['attiva', (m.fino - t) / 1000] : t < m.pronto ? ['ricarica', (m.pronto - t) / 1000] : ['pronta', 0]; };
function statoAbilita(chi, i, el) {
  const m = gest(chi, i);
  if (!m || !el) return;
  const [st, s] = statoDi(m), span = el.querySelector('span');
  el.className = `abil ${st}`;
  txt(span, st === 'pronta' ? 'Attiva' : durata(s));
  el.disabled = st !== 'pronta';
}
function aggiorna(forza = false) {
  txt($('#soldi'), fmt(S.soldi));
  const ps = alSecondo();
  txt($('#alSec'), (ps ? `${fmt(ps)}/s · ad app chiusa ${fmt(ps * QUOTA_ASSENZA)}/s` : (gestoriAperti() ? 'Assumi i gestori per guadagnare da solo' : `Porta il chiosco al livello ${LIVELLO_GESTORI} per i gestori`)) + (S.rinnovo ? ` · ⭐ ×${moltRinnovo()}` : ''));
  const pall = {
    potenzia: POTENZIAMENTI.some(u => !S.upg.includes(u.id) && S.soldi >= u.costo),
    rinnovo: !!RINNOVI[S.rinnovo] && S.soldi >= RINNOVI[S.rinnovo].costo,
  };
  for (const b of document.querySelectorAll('#nav button')) {
    const on = !!pall[b.dataset.tab], has = b.querySelector('.pallino');
    if (on && !has) b.insertAdjacentHTML('beforeend', '<i class="pallino"></i>'); else if (!on && has) has.remove();
  }
  if (aperta && sheet.open && performance.now() - ultimoDisegno > 400) (aperta.tipo === 'su' ? disegnaSu : disegnaSquadra)();
  if (tab === 'gestori') {
    if (performance.now() - ultimoDisegno > 1000 && !document.activeElement?.matches('select')) renderGestori();
    return;
  }
  if (tab !== 'paese') {
    if (forza || Math.random() < 0.1) {
      for (const btn of view.querySelectorAll('[data-upg]')) btn.disabled = S.soldi < POTENZIAMENTI.find(u => u.id === btn.dataset.upg).costo;
      const r = view.querySelector('[data-rinnova]');
      if (r) r.disabled = S.soldi < RINNOVI[S.rinnovo].costo;
    }
    return;
  }
  // Botteghe e commessi
  let pronti = 0;
  S.liv.forEach((l, i) => {
    if (!l.L) return;
    const xb = xBanco();
    l.w.forEach((w, k) => {
      const el = $(`#w${i}_${k}`);
      if (!el) return;
      const off = -k * 16;   // i commessi in fila al bancone
      let x = xb + off, flip = true;
      const t = Math.max(0, w.t);
      if (w.fase === 'porta') x = xb + off + (xCassa + 8 - xb - off) * Math.min(1, t / GIRO.porta);
      else if (w.fase === 'rientra') { x = xCassa + 8 + (xb + off - xCassa - 8) * Math.min(1, t / GIRO.rientra); flip = false; }
      sposta(el, x, 0, flip);
      el.classList.toggle('cammina', w.fase === 'porta' || w.fase === 'rientra');
      el.classList.toggle('porta', w.fase === 'porta');
      el.classList.toggle('lavora', w.fase === 'lavora' && w.t >= 0);
    });
    const m = $(`#m${i}`);
    if (m) m.hidden = !(!l.g && l.w.every(w => w.fase === 'fermo'));
    txt($(`#bc${i}`), l.cassa >= 1 ? fmt(l.cassa) : '');
    if (depositi[i] && performance.now() - (ultimoVolo[i] ?? 0) > 700) {   // al massimo un "+€" ogni 0,7 s per bottega
      volaDa($(`#bc${i}`)?.parentElement, depositi[i], 'piccolo'); delete depositi[i]; ultimoVolo[i] = performance.now();
    }
    const nc = nCommessi(l.L), tr = traguardo('b', i);
    txt($(`#liv${i}`), `Liv. ${l.L}${nc > 1 ? ` · 👥 ${nc}` : ''}`);
    txt($(`#prox${i}`), tr ? tr.testo : 'Livello massimo dei traguardi');
    const bar = $(`#bar${i}`); if (bar) bar.style.width = `${(tr ? tr.quota : 1) * 100}%`;
    targa($(`#tg-b${i}`), 'b', i);
    statoAbilita('b', i, $(`#ab-b${i}`));
    if (gest('b', i) && ora() >= gest('b', i).pronto) pronti++;
  });
  // Prossima bottega e lavori sulla scalinata
  const lv = lavori(), boxL = $('#lavori'), ap = view.querySelector('[data-apri]');
  if (boxL) {
    boxL.hidden = !lv;
    if (lv) { txt($('#lavoriResta'), `Finiscono tra ${durata(lv.resta)}`); txt($('#lavoriPrezzo'), fmt(lv.prezzo)); view.querySelector('[data-finisci]').disabled = S.soldi < lv.prezzo; }
  }
  if (ap) { ap.hidden = !!lv; ap.disabled = S.soldi < BOTTEGHE[+ap.dataset.apri].apri; }
  // Funicolare
  const f = S.funi, yStop = p => (p <= 0 ? 168 : PIAZZA + (p - 1) * RIGA + RIGA - 92);
  const p0 = Math.floor(f.pos), fr = f.pos - p0;
  sposta($('#cabina'), 0, yStop(p0) + (yStop(p0 + 1) - yStop(p0)) * fr);
  txt($('#bFuni'), f.carico >= 1 ? fmt(f.carico) : '');
  $('#mFuni').hidden = !(f.fase === 'fermo' && !f.g);
  txt($('#bDep'), S.deposito >= 1 ? fmt(S.deposito) : '');
  // Ape
  const a = S.ape, x0 = 96, x1 = W - 170;
  sposta($('#ape'), x0 + (x1 - x0) * a.x, 0, a.fase === 'torna');
  $('#ape').classList.toggle('carica', a.carico > 0);
  $('#ape').classList.toggle('va', a.fase === 'va' || a.fase === 'torna');
  txt($('#bApe'), a.carico >= 1 ? fmt(a.carico) : '');
  txt($('#nApe'), nApe() > 1 ? `×${nApe()}` : '');
  $('#mApe').hidden = !(a.fase === 'fermo' && !a.g && S.deposito > 0);
  // Comandi di funicolare e Ape
  for (const chi of ['f', 'a']) {
    const o = posto(chi, 0), tr = traguardo(chi, 0);
    txt($(`#liv-${chi}`), `Liv. ${o.L}`);
    txt($(`#info-${chi}`), `porta ${fmt(chi === 'f' ? capFuni() : capApe())} a viaggio`);
    txt($(`#prox-${chi}`), tr ? tr.testo : chi === 'f' ? 'Tocca il deposito per migliorarla' : 'Ape al completo');
    const bar = $(`#bar-${chi}`); if (bar) bar.style.width = `${(tr ? tr.quota : Math.min(1, (o.L % 10) / 10)) * 100}%`;
    targa($(`#tg-${chi}`), chi, 0);
    statoAbilita(chi, 0, $(`#ab-${chi}0`));
    if (gest(chi, 0) && ora() >= gest(chi, 0).pronto) pronti++;
  }
  const at = $('#attivaTutti');
  if (at) { at.hidden = pronti < 2; txt(at, `⚡ Attiva tutti (${pronti})`); }
  if (!gestoriAperti()) txt($('#collo'), '👆 Commesso → cabina → Ape. Tocca un edificio per migliorarlo');
  else {
    const c = collo();
    txt($('#collo'), `🐢 Collo di bottiglia: ${c === 'botteghe' ? 'le botteghe' : c === 'funi' ? 'la funicolare' : 'le Ape'}`);
  }
}

/** Targa del livello sull'edificio: verde con la freccia quando puoi permetterti almeno un livello. */
function targa(el, chi, i) {
  if (!el) return;
  const puoi = S.soldi >= costo(chi, i, 1);
  txt(el, `${puoi ? '⬆ ' : ''}Liv. ${posto(chi, i).L}`);
  el.classList.toggle('puoi', puoi);
}

// ---------------------------------------------------------------- effetti
function volaDa(dove, x, classe = '') {
  if (!dove || tab !== 'paese' || document.hidden) return;
  const r = dove.getBoundingClientRect();
  if (r.bottom < 0 || r.top > innerHeight) return;   // fuori dallo schermo: niente animazione
  const el = Object.assign(document.createElement('div'), { className: `volo ${classe}`, textContent: '+' + fmt(x) });
  el.style.left = `${r.left + 4}px`; el.style.top = `${r.top - 6}px`;
  document.body.append(el);
  setTimeout(() => el.remove(), 1000);
}
const vola = x => volaDa(view.querySelector('.merc'), x);

// Tenendo premuto "Sali di livello" si continua a comprare
let ripeti = null;
const smetti = () => { clearTimeout(ripeti); clearInterval(ripeti); ripeti = null; };
document.addEventListener('pointerdown', e => {
  const b = e.target.closest('[data-compra]');
  if (!b) return;
  smetti();
  ripeti = setTimeout(() => { ripeti = setInterval(() => { const x = sheet.querySelector('[data-compra]'); if (x && !x.disabled) x.click(); else smetti(); }, 120); }, 450);
});
for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) document.addEventListener(ev, smetti);
let toastT;
function toast(t) {
  const el = $('#toast');
  el.textContent = t; el.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => (el.hidden = true), 2800);
}
const vibra = p => { try { navigator.userActivation?.hasBeenActive && navigator.vibrate?.(p); } catch { /* niente vibrazione */ } };

/** Attiva l'abilità del gestore assegnato al posto (se è pronta). */
function attiva(chi, i) {
  const m = gest(chi, i);
  if (!m || ora() < m.pronto) return false;
  const gr = GRADI[m.r];
  m.fino = ora() + gr.durata * 1000;
  m.pronto = ora() + (gr.durata + gr.ricarica) * 1000;
  return true;
}
/** Assume un gestore a caso (grado e abilità) nella squadra della zona; se c'è un posto vuoto indicato, ce lo mette. */
function assumi(chi, i = null) {
  const prezzo = prezzoAssunzione(chi);
  if (S.soldi < prezzo || !gestoriAperti()) return null;
  S.soldi -= prezzo;
  let x = Math.random(), r = 0;
  while (r < GRADI.length - 1 && x > GRADI[r].prob) { x -= GRADI[r].prob; r++; }
  const usati = new Set(Object.values(S.staff).flat().map(m => m.nome));
  const liberi = NOMI_GESTORI.filter(n => !usati.has(n));
  const nome = (liberi.length ? liberi : NOMI_GESTORI)[Math.floor(Math.random() * (liberi.length || NOMI_GESTORI.length))];
  const m = { id: Math.random().toString(36).slice(2, 9), nome, r, a: Math.floor(Math.random() * ABILITA[chi].length), fino: 0, pronto: 0, pagato: prezzo };
  S.staff[chi].push(m);
  if (i != null && !posto(chi, i).g) posto(chi, i).g = m.id;
  return m;
}
/** Mette il gestore al posto i (lo toglie da dove era; chi era al posto i resta libero nella squadra). */
function assegna(chi, id, i) {
  if (chi === 'b') S.liv.forEach(l => { if (l.g === id) l.g = null; });
  else if (posto(chi, 0).g === id) posto(chi, 0).g = null;
  if (i >= 0) posto(chi, i).g = id;
}
function vendi(chi, id) {
  const m = S.staff[chi].find(x => x.id === id);
  if (!m) return;
  assegna(chi, id, -1);
  S.staff[chi] = S.staff[chi].filter(x => x !== m);
  S.soldi += m.pagato / 2;
}
const nomeZona = chi => (chi === 'b' ? 'Botteghe' : chi === 'f' ? 'Funicolare' : 'Ape');
const nomePosto = (chi, i) => (chi === 'b' ? BOTTEGHE[i].nome : nomeZona(chi));
/** Una riga di gestore: nome, grado, abilità, stato; con i pulsanti adatti al contesto. */
function rigaGestore(chi, m, posto_ = null) {
  const ab = ABILITA[chi][m.a], gr = GRADI[m.r], dove = doveLavora(chi, m), [st, s] = statoDi(m);
  const qui = posto_ != null && dove === posto_;
  const stato = st === 'attiva' ? `<b class="st attiva">attiva ${durata(s)}</b>` : st === 'ricarica' ? `<b class="st ricarica">ricarica ${durata(s)}</b>` : '<b class="st pronta">pronta</b>';
  const scelta = chi === 'b'
    ? `<select data-assegna="b:${m.id}">${['<option value="-1">Libero</option>', ...S.liv.map((l, i) => (l.L ? `<option value="${i}" ${dove === i ? 'selected' : ''}>${BOTTEGHE[i].em} ${BOTTEGHE[i].nome}</option>` : '')).filter(Boolean)].join('')}</select>`
    : dove === 0 ? '<small class="dove">al lavoro</small>' : `<button class="mini" data-assegna-qui="${chi}:${m.id}:0">Metti al lavoro</button>`;
  return `<div class="gRiga ${qui ? 'qui' : ''}">
    <span class="gAv" style="--r:${gr.colore}">🧑‍💼</span>
    <span class="gT"><b>${m.nome}</b> <span class="grado" style="--r:${gr.colore}">${gr.nome}</span>
      <small>${ab.em} ${ab.nome}: ${ab.testo(ab.effetto[m.r])} · dura ${durataLunga(gr.durata)}, ricarica ${durataLunga(gr.ricarica)}</small>
      <small>${stato} · ${dove >= 0 ? (chi === 'b' ? `alla ${nomePosto(chi, dove)}` : 'al lavoro') : 'libero'}</small></span>
    <span class="gAz">
      ${posto_ != null && !qui ? `<button class="mini" data-assegna-qui="${chi}:${m.id}:${posto_}">Metti qui</button>` : ''}
      ${posto_ == null ? scelta : ''}
      ${dove >= 0 && st === 'pronta' ? `<button class="mini verde" data-attiva="${chi}:${dove}">${ab.em} Attiva</button>` : ''}
      <button class="mini rosso" data-vendi="${chi}:${m.id}">Vendi ${fmt(m.pagato / 2)}</button>
    </span></div>`;
}
// ---------------------------------------------------------------- scheda di potenziamento (bottega, funicolare, Ape)
let aperta = null;   // scheda aperta che si aggiorna da sola: { tipo: 'su', chi, i }
let ultimoDisegno = 0;
sheet.addEventListener('close', () => { aperta = null; });
function schedaSu(chi, i) {
  aperta = { tipo: 'su', chi, i };
  disegnaSu();
  if (!sheet.open) sheet.showModal();
}
function disegnaSu() {
  const { chi, i } = aperta, o = posto(chi, i), k = quanti(chi, i), c = costo(chi, i, k), L = o.L, L2 = L + k;
  const riga = (nome, a, b) => `<tr><td>${nome}</td><td>${a}</td><td class="dopo">${a === b ? '' : `→ ${b}`}</td></tr>`;
  let titolo, em, righe, prossimi;
  if (chi === 'b') {
    const b = BOTTEGHE[i];
    titolo = b.nome; em = b.em;
    righe = riga('Merce per giro', fmt(prodL(i, L)), fmt(prodL(i, L2)))
      + riga('Commessi', nCommessi(L), nCommessi(L2))
      + riga('Al secondo', `${fmt(prodL(i, L) / cicloBottega(i))}/s`, `${fmt(prodL(i, L2) / cicloBottega(i))}/s`);
    const t = TAPPE.find(x => x > L), cm = COMMESSI.find(x => x > L);
    prossimi = [t && `🎉 Livello ${t}: produzione ×2`, cm && `👥 Livello ${cm}: un commesso in più`].filter(Boolean);
  } else if (chi === 'f') {
    titolo = 'Funicolare'; em = '🚡';
    const viaggio = L => (2 * aperte() * F.perTerrazza + aperte() * F.carico) / velFuniL(L);   // senza abilità attive
    righe = riga('Porta a viaggio', fmt(capFuniL(L)), fmt(capFuniL(L2)))
      + riga('Velocità', `×${velFuniL(L).toLocaleString('it-IT', { maximumFractionDigits: 2 })}`, `×${velFuniL(L2).toLocaleString('it-IT', { maximumFractionDigits: 2 })}`)
      + riga('Al secondo', `${fmt(capFuniL(L) / viaggio(L))}/s`, `${fmt(capFuniL(L2) / viaggio(L2))}/s`);
    prossimi = [`Un viaggio completo (${aperte()} terrazze) dura ${Math.round(viaggio(L))} s`];
  } else {
    titolo = 'Ape'; em = '🛺';
    const vg = (2 * A.viaggio + A.carico) / molt('ape');
    righe = riga('Porta ogni Ape', fmt(capUnaApeL(L)), fmt(capUnaApeL(L2)))
      + riga('Ape', nApeL(L), nApeL(L2))
      + riga('Al secondo', `${fmt((capUnaApeL(L) * nApeL(L)) / vg)}/s`, `${fmt((capUnaApeL(L2) * nApeL(L2)) / vg)}/s`);
    const na = A.nuoveApe.find(x => x > L);
    prossimi = [na && `🛺 Livello ${na}: una Ape in più`].filter(Boolean);
  }
  const sc = abilita(chi, i, 'sconto');
  sheet.innerHTML = `<div class="scheda">
    <div class="sTitolo"><span>${em}</span><div><b>${titolo}</b><small>Livello ${L}${k ? ` → ${L2}` : ''}</small></div><button class="chiudi" data-chiudi aria-label="Chiudi">✕</button></div>
    <table class="stat"><tbody>${righe}</tbody></table>
    ${prossimi.length ? `<ul class="prossimi">${prossimi.map(p => `<li>${p}</li>`).join('')}</ul>` : ''}
    <div class="seg">${MODI.map((m, j) => `<button data-modo="${j}" class="${S.modo === j ? 'on' : ''}">${m === 'max' ? 'Max' : `×${m}`}</button>`).join('')}</div>
    <button class="primary" data-compra="${chi}:${i}" ${S.soldi >= c ? '' : 'disabled'}>Sali di ${k} ${k === 1 ? 'livello' : 'livelli'} · ${fmt(c)}${sc ? ` <small>(−${Math.round(sc * 100)}%)</small>` : ''}</button>
    <div class="sGest">${slotGestore(chi, i)}<span class="note">${gest(chi, i) ? `${gest(chi, i).nome} (${GRADI[gest(chi, i).r].nome}): ${ABILITA[chi][gest(chi, i).a].testo(ABILITA[chi][gest(chi, i).a].effetto[gest(chi, i).r])}` : gestoriAperti() ? 'Nessun gestore: tocca 🧑‍💼 per sceglierne o assumerne uno' : `Gestori dal livello ${LIVELLO_GESTORI} del chiosco`}</span></div>
  </div>`;
  statoAbilita(chi, i, sheet.querySelector(`#ab-${chi}${i}`));
  ultimoDisegno = performance.now();
}

// ---------------------------------------------------------------- pagina dei gestori
function renderGestori() {
  if (!gestoriAperti()) {
    view.innerHTML = `<h2>Gestori</h2><div class="card">🔒 I gestori arrivano quando il chiosco delle granite raggiunge il <b>livello ${LIVELLO_GESTORI}</b>.<p class="note">Un gestore resta fisso al suo posto e lo fa lavorare da solo, anche ad app chiusa. In più ha un'abilità speciale da attivare.</p></div>`;
    ultimoDisegno = performance.now();
    return;
  }
  const zona = (chi, em) => `<h2>${em} ${nomeZona(chi)} <small>${S.staff[chi].length} ${S.staff[chi].length === 1 ? 'gestore' : 'gestori'}</small></h2>
    ${chi === 'b' ? `<p class="note">Posti con il gestore: ${S.liv.filter(l => l.L && l.g).length} su ${aperte()}.</p>` : ''}
    <div class="card squadra">${S.staff[chi].map(m => rigaGestore(chi, m)).join('') || '<p class="note">Nessun gestore in squadra.</p>'}
      <button class="primary" data-assumi="${chi}" ${S.soldi >= prezzoAssunzione(chi) ? '' : 'disabled'}>🧑‍💼 Assumi un gestore · ${fmt(prezzoAssunzione(chi))}</button></div>`;
  view.innerHTML = `<h2>Gestori</h2>
    <p class="note">Il gestore resta fisso al suo posto e lo fa lavorare da solo (anche ad app chiusa, a metà ritmo). Ha anche un'<b>abilità speciale</b>: la attivi tu, dura qualche minuto e poi si ricarica. La ricarica è del gestore: se hai più gestori puoi scambiarli e usare quello con l'abilità pronta.</p>
    <div class="card legenda">${GRADI.map(g => `<span><span class="grado" style="--r:${g.colore}">${g.nome}</span> dura ${durataLunga(g.durata)} · ricarica ${durataLunga(g.ricarica)} · esce ${Math.round(g.prob * 100)}%</span>`).join('')}</div>
    <button class="primary" data-attiva-tutti style="margin:0 16px 6px;width:calc(100% - 32px)">⚡ Attiva tutte le abilità pronte</button>
    ${zona('f', '🚡')}${zona('a', '🛺')}${zona('b', '🏪')}`;
  ultimoDisegno = performance.now();
}

/** Scheda della squadra di una zona, aperta dal posto i: si sceglie chi mettere lì, si assume, si vende. */
function schedaSquadra(chi, i) {
  aperta = { tipo: 'squadra', chi, i };
  disegnaSquadra();
  if (!sheet.open) sheet.showModal();
}
function disegnaSquadra() {
  const { chi, i } = aperta, m = gest(chi, i);
  const lista = [...S.staff[chi]].sort((x, y) => (doveLavora(chi, y) === i) - (doveLavora(chi, x) === i) || (doveLavora(chi, x) >= 0) - (doveLavora(chi, y) >= 0));
  sheet.innerHTML = `<div class="scheda">
    <div class="sTitolo"><span>🧑‍💼</span><div><b>Gestore · ${nomePosto(chi, i)}</b><small>${m ? `${m.nome} lavora qui` : 'Nessun gestore a questo posto'}</small></div><button class="chiudi" data-chiudi aria-label="Chiudi">✕</button></div>
    <div class="squadra">${lista.map(x => rigaGestore(chi, x, i)).join('') || '<p class="note">La squadra è vuota: assumi il primo gestore.</p>'}</div>
    <button class="primary" data-assumi="${chi}:${i}" ${S.soldi >= prezzoAssunzione(chi) ? '' : 'disabled'}>🧑‍💼 Assumi un gestore · ${fmt(prezzoAssunzione(chi))}</button>
    <p class="note">Esce a caso: Junior 65%, Senior 27%, Executive 8%. Il prezzo sale a ogni gestore in squadra; vendendo ti ridanno metà di quanto l'hai pagato.</p>
  </div>`;
  ultimoDisegno = performance.now();
}

// ---------------------------------------------------------------- tocchi
document.addEventListener('click', e => {
  const on = s => e.target.closest(s);
  let el;
  if (on('[data-chiudi]')) { sheet.close(); return; }
  if ((el = on('#nav button'))) { tab = el.dataset.tab; render(); scrollTo(0, 0); return; }
  if ((el = on('[data-su]'))) { const [chi, i] = el.dataset.su.split(':'); schedaSu(chi, +i); return; }
  if ((el = on('[data-modo]'))) { S.modo = +el.dataset.modo; if (aperta) disegnaSu(); aggiorna(); return; }
  if ((el = on('[data-compra]'))) {
    const [chi, si] = el.dataset.compra.split(':'), i = +si, k = quanti(chi, i), c = costo(chi, i, k);
    if (S.soldi < c) return;
    S.soldi -= c;
    const o = posto(chi, i), primaT = tappe(o.L), primaN = chi === 'b' ? nCommessi(o.L) : nApe();
    o.L += k;
    if (chi === 'b') {
      if (nCommessi(o.L) > primaN) { toast(`👥 ${BOTTEGHE[i].nome}: arriva un commesso in più!`); render(); }
      else if (tappe(o.L) > primaT) toast(`🎉 ${BOTTEGHE[i].nome}: produzione raddoppiata!`);
      if (i === 0 && o.L >= LIVELLO_GESTORI && o.L - k < LIVELLO_GESTORI) { toast('🧑‍💼 Ora puoi assumere i gestori!'); render(); }
    } else if (chi === 'a' && nApe() > primaN) toast(`🛺 Una Ape in più: ora sono ${nApe()}!`);
    vibra(8);
    if (aperta) disegnaSu();
    aggiorna(); salva(); return;
  }
  const ridisegna = () => { if (aperta) (aperta.tipo === 'su' ? disegnaSu : disegnaSquadra)(); render(); salva(); };
  if ((el = on('[data-squadra]'))) { const [chi, i] = el.dataset.squadra.split(':'); if (gestoriAperti()) schedaSquadra(chi, +i); return; }
  if ((el = on('[data-assumi]'))) {
    const [chi, si] = el.dataset.assumi.split(':'), m = assumi(chi, si == null ? null : +si);
    if (!m) return;
    const ab = ABILITA[chi][m.a];
    toast(`${m.r === 2 ? '🌟 ' : ''}${m.nome}, ${GRADI[m.r].nome}: ${ab.em} ${ab.nome}`);
    vibra(m.r === 2 ? [30, 60, 30] : 15);
    ridisegna(); return;
  }
  if ((el = on('[data-assegna-qui]'))) { const [chi, id, i] = el.dataset.assegnaQui.split(':'); assegna(chi, id, +i); ridisegna(); return; }
  if ((el = on('[data-vendi]'))) {
    const [chi, id] = el.dataset.vendi.split(':'), m = S.staff[chi].find(x => x.id === id);
    if (!m || !confirm(`Vendere ${m.nome} (${GRADI[m.r].nome})? Ti ridanno ${fmt(m.pagato / 2)}.`)) return;
    vendi(chi, id); toast(`${m.nome} è andato via: +${fmt(m.pagato / 2)}`); ridisegna(); return;
  }
  if ((el = on('[data-attiva]'))) {
    const [chi, i] = el.dataset.attiva.split(':');
    if (attiva(chi, +i)) {
      const m = gest(chi, +i), ab = ABILITA[chi][m.a];
      vibra(15); toast(`${ab.em} ${m.nome}: ${ab.nome} per ${durataLunga(GRADI[m.r].durata)}!`);
      if (aperta) (aperta.tipo === 'su' ? disegnaSu : disegnaSquadra)();
      if (tab === 'gestori') renderGestori();
      aggiorna(); salva();
    }
    return;
  }
  if (on('[data-attiva-tutti]')) {
    let n = 0;
    S.liv.forEach((l, i) => { if (l.L && attiva('b', i)) n++; });
    if (attiva('f', 0)) n++;
    if (attiva('a', 0)) n++;
    if (n) { vibra(20); toast(`⚡ ${n} abilità attivate!`); if (tab === 'gestori') renderGestori(); aggiorna(); salva(); }
    else toast('Nessuna abilità pronta in questo momento');
    return;
  }
  if ((el = on('[data-apri]'))) {
    const i = +el.dataset.apri, b = BOTTEGHE[i];
    if (S.soldi < b.apri || lavori()) return;
    S.soldi -= b.apri; S.liv[i].L = 1;
    toast(`${b.em} Hai aperto: ${b.nome}`); render(); salva(); return;
  }
  if (on('[data-finisci]')) {
    const lv = lavori();
    if (!lv || S.soldi < lv.prezzo) return;
    S.soldi -= lv.prezzo; S.lavori[lv.n] = ora();
    toast('🚧 Lavori finiti: la scalinata è aperta!'); aggiorna(); salva(); return;
  }
  if ((el = on('[data-act]'))) {
    const act = el.dataset.act;
    if (act.startsWith('lav:')) {
      const l = S.liv[+act.slice(4)];
      if (l.L && !l.g && l.w.every(w => w.fase === 'fermo')) { l.w.forEach((w, k) => { w.fase = 'lavora'; w.t = -0.35 * k; }); vibra(10); }
    } else if (act === 'funi') {
      if (S.funi.fase === 'fermo' && !S.funi.g) { S.funi.fase = 'scende'; vibra(10); }
    } else if (act === 'ape') {
      if (S.ape.fase === 'fermo' && !S.ape.g) {
        if (S.deposito <= 0) toast('Il deposito è vuoto: prima la funicolare deve portare su la merce');
        else { S.ape.fase = 'carica'; S.ape.t = 0; vibra(10); }
      }
    }
    return;
  }
  if ((el = on('[data-upg]'))) {
    const u = POTENZIAMENTI.find(x => x.id === el.dataset.upg);
    if (!u || S.soldi < u.costo) return;
    S.soldi -= u.costo; S.upg.push(u.id);
    toast(`${u.em} ${u.nome}!`); render(); salva(); return;
  }
  if (on('[data-rinnova]')) {
    const p = RINNOVI[S.rinnovo];
    if (!p || S.soldi < p.costo) return;
    sheet.innerHTML = `<div style="font-size:44px">⭐</div><h3 style="margin:6px 0">${p.nome}</h3>
      <p class="note">Paghi ${fmt(p.costo)} e il corso riparte dal chiosco delle granite, ma da ora la produzione è <b>×${p.molt}</b> per sempre.</p>
      <button class="primary" data-conferma-rinnovo>Sì, rinnova il corso</button><button class="link" data-chiudi>Annulla</button>`;
    sheet.showModal(); return;
  }
  if (on('[data-conferma-rinnovo]')) {
    const r = S.rinnovo + 1, car = S.carriera;
    S = nuovo(r, car); sheet.close(); tab = 'paese'; render(); salva(); toast(`⭐ ${RINNOVI[r - 1].nome}: produzione ×${RINNOVI[r - 1].molt}!`); return;
  }
  if (on('[data-azzera]')) {
    sheet.innerHTML = `<h3>Cancellare tutto?</h3><p class="note">Perdi anche i rinnovi. Non si può annullare.</p>
      <button class="primary" data-conferma-azzera style="background:var(--rosso)">Cancella tutto</button><button class="link" data-chiudi>Annulla</button>`;
    sheet.showModal(); return;
  }
  if (on('[data-conferma-azzera]')) { S = nuovo(); sheet.close(); tab = 'paese'; render(); salva(); }
});
// Scelta del posto dalla pagina Gestori (menu a tendina per le botteghe)
document.addEventListener('change', e => {
  const s = e.target.closest('[data-assegna]');
  if (!s) return;
  const [chi, id] = s.dataset.assegna.split(':');
  assegna(chi, id, +s.value);
  s.blur(); render(); salva();
});
addEventListener('resize', () => { if (tab === 'paese' && Math.abs((view.clientWidth || 360) - W) > 4) render(); });

// ---------------------------------------------------------------- ciclo
let last = performance.now(), daSalvare = 0;
function frame(now) {
  const dt = Math.min(0.5, (now - last) / 1000);
  last = now;
  avanza(dt);
  aggiorna();
  daSalvare += dt;
  if (daSalvare > 3) { daSalvare = 0; salva(); }
  requestAnimationFrame(frame);
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) salva();
  else { guadagniAssenza(); last = performance.now(); salva(); }
});
addEventListener('pagehide', salva);

// Aggiornamenti dell'APK (guscio Android): se su GitHub c'è una release più nuova, si propone di installarla.
const native = window.Android;
let apkNuovo = null;
const piuNuova = (a, b) => {
  const pa = a.split('.').map(Number), pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) > (pb[i] ?? 0);
  return false;
};
async function controllaApk() {
  if (!native?.appVersion) return;
  try {
    const rel = await (await fetch('https://api.github.com/repos/Gavao/ga-tycoon/releases/latest')).json();
    const v = rel.tag_name?.replace(/^v/, ''), file = rel.assets?.find(a => a.name.endsWith('.apk'));
    apkNuovo = v && file && piuNuova(v, native.appVersion()) ? { v, url: file.browser_download_url } : null;
    const b = $('#aggiornaApk');
    if (b) { b.hidden = !apkNuovo; if (apkNuovo) b.textContent = `⬆️ Aggiorna l'app alla versione ${apkNuovo.v}`; }
  } catch { /* offline */ }
}
document.addEventListener('click', e => {
  if (!e.target.closest('#aggiornaApk') || !apkNuovo) return;
  native.installUpdate(apkNuovo.url);
  toast('Download in corso: al termine si apre l\'installazione');
});

async function controllaVersione() {
  try {
    const v = (await (await fetch('version.txt', { cache: 'no-store' })).text()).trim();
    if (v && APP_VERSION !== 'dev' && v !== APP_VERSION) { salva(); location.reload(); }
  } catch { /* offline */ }
}
setInterval(controllaVersione, 120000);
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js');

guadagniAssenza();
render();
requestAnimationFrame(frame);
controllaApk();
window.gioco = { get S() { return S; }, fmt, avanza, render, salva, guadagniAssenza, ritmi, aggiorna };   // per le prove
