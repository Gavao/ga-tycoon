// GA Tycoon · Corso Italia: il corso scende a terrazze verso il mare. Ogni terrazza è una bottega con i suoi commessi;
// la funicolare porta le cassette al deposito in piazza e le Ape portano la merce al mercato, dove si incassa.
import { APP_VERSION } from './version.js';
import {
  BOTTEGHE, CRESCE_BOTTEGA, TAPPE, COMMESSI, LIVELLO_GESTORI, GIRO, LAVORI, FUNICOLARE as F, APE as A,
  GRADI, ABILITA, QUOTA_ASSENZA, POTENZIAMENTI, RINNOVI,
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
  liv: BOTTEGHE.map((_, i) => ({ ...bottegaVuota(), L: i ? 0 : 1 })),
  funi: { L: 1, g: null, fase: 'fermo', pos: 0, carico: 0, t: 0 },
  ape: { L: 1, g: null, fase: 'fermo', x: 0, carico: 0, t: 0 },
});
function carica() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (s?.v === 3 && Array.isArray(s.liv)) {
      while (s.liv.length < BOTTEGHE.length) s.liv.push(bottegaVuota());
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
/** Effetto dell'abilità del gestore se è attiva in questo momento (altrimenti null). */
const abilita = (chi, i, id) => {
  const g = posto(chi, i).g;
  if (!g || ora() >= g.fino) return null;
  const ab = ABILITA[chi][g.a];
  return ab.id === id ? ab.effetto[g.r] : null;
};
// Valori a un dato livello L (servono anche alle schede per mostrare "adesso → dopo")
const prodL = (i, L) => BOTTEGHE[i].base * L * 2 ** tappe(L) * molt('prod') * moltRinnovo();
const velFuniL = L => Math.min(F.velocitaMax, 1 + (L - 1) * F.velocitaPerLivello) * molt('funi');
const capFuniL = L => F.cap * F.capCresce ** (L - 1);
const nApeL = L => 1 + A.nuoveApe.filter(t => L >= t).length;
const capUnaApeL = L => A.cap * A.capCresce ** (L - 1);
const prod = i => prodL(i, S.liv[i].L);
const giro = GIRO.lavora + GIRO.porta + GIRO.rientra;
const velCommessi = i => abilita('b', i, 'veloce') ?? 1;
const velFuni = () => velFuniL(S.funi.L) * (abilita('f', 0, 'veloce') ?? 1);
const capFuni = () => capFuniL(S.funi.L) * (abilita('f', 0, 'carico') ?? 1);
const velApe = () => molt('ape') * (abilita('a', 0, 'veloce') ?? 1);
const capApe = () => capUnaApeL(S.ape.L) * nApe() * (abilita('a', 0, 'carico') ?? 1);
const viaggioFuni = () => (2 * aperte() * F.perTerrazza + aperte() * F.carico) / velFuni();
const viaggioApe = () => (2 * A.viaggio + A.carico) / velApe();
/** Euro al secondo che ogni anello della catena riesce a gestire. */
const ritmi = () => ({
  botteghe: S.liv.reduce((s, l, i) => s + (l.L ? (prod(i) / giro) * velCommessi(i) : 0), 0),
  funi: capFuni() / viaggioFuni(),
  ape: capApe() / viaggioApe(),
});
/** Guadagno al secondo con i gestori (lavora da solo solo chi ha il gestore). */
const alSecondo = () => {
  if (!S.funi.g || !S.ape.g) return 0;
  const auto = S.liv.reduce((s, l, i) => s + (l.L && l.g ? (prod(i) / giro) * velCommessi(i) : 0), 0);
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
const prezzoGestore = (chi, i) => (chi === 'b' ? BOTTEGHE[i].gestore : chi === 'f' ? F.gestore : A.gestore);
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
function avanza(dt) {
  // Commessi: lavorano al bancone, portano la merce in cassetta, rientrano
  S.liv.forEach((l, i) => {
    if (!l.L) return;
    const n = nCommessi(l.L);
    while (l.w.length < n) l.w.push({ fase: l.g ? 'fermo' : 'fermo', t: -0.5 * l.w.length });
    const v = velCommessi(i), quota = prod(i) / n;
    for (const w of l.w) {
      if (w.fase === 'fermo') { if (l.g) { w.fase = 'lavora'; } else continue; }
      w.t += dt * v;
      if (w.t < 0) continue;
      if (w.fase === 'lavora' && w.t >= GIRO.lavora) { w.fase = 'porta'; w.t = 0; }
      else if (w.fase === 'porta' && w.t >= GIRO.porta) { w.fase = 'rientra'; w.t = 0; l.cassa += quota; }
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
    if (f.t >= F.carico / velFuni()) {
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
    if (a.t >= A.carico / velApe()) { a.carico = Math.min(capApe(), S.deposito); S.deposito -= a.carico; a.fase = 'va'; }
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
  S.liv.forEach((l, i) => { if (l.L && l.g) l.cassa += (prod(i) / giro) * q * sec; });
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
      <div class="dep" data-act="ape">${deposito()}<span class="bolla" id="bDep"></span></div>
      <div class="merc">${mercato()}</div>
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
  const g = posto(chi, i).g;
  if (!g) return `<button class="assumi" data-gest="${chi}:${i}">🧑‍💼 ${fmt(prezzoGestore(chi, i))}</button>`;
  const ab = ABILITA[chi][g.a];
  return `<button class="gestore" data-info="${chi}:${i}" style="--r:${GRADI[g.r].colore}">🧑‍💼</button>
    <button class="abil" data-attiva="${chi}:${i}" id="ab-${chi}${i}">${ab.em} <span></span></button>`;
}
function comando(chi, em, nome) {
  return `<div class="cmd"><b>${em} ${nome} <i id="liv-${chi}"></i></b><small id="info-${chi}"></small>
    <div class="cmdRiga"><button class="su" data-su="${chi}:0"><span>⬆</span><small id="prezzo-${chi}"></small></button>${slotGestore(chi, 0)}</div></div>`;
}
function terrazza(i) {
  const b = BOTTEGHE[i], l = S.liv[i], n = nCommessi(l.L);
  return `<div class="terrazza" style="top:${PIAZZA + i * RIGA}px" data-i="${i}">
    <div class="muro" style="background:${b.muro}"></div>
    ${i % 3 === 1 ? limone(W - 46, 0.8) : ''}
    <div class="bottega" data-act="lav:${i}">
      <div class="tenda" style="--t:${b.tenda}"></div>
      <div class="insegna">${b.em} ${b.nome}</div>
      <div class="vetrina"><span>${b.em}</span></div>
      <div class="porta"></div>
    </div>
    <div class="cassetta"><span class="bolla" id="bc${i}"></span></div>
    ${Array.from({ length: n }, (_, k) => `<div class="commesso" id="w${i}_${k}" data-act="lav:${i}">${omino(b.maglia, b.cappello)}${k === 0 ? `<span class="mano" id="m${i}">👆</span>` : ''}</div>`).join('')}
    <div class="pedana">
      ${slotGestore('b', i)}
      <span class="liv" id="liv${i}"></span>
      <button class="su" data-su="b:${i}"><span>⬆</span><small id="prezzo${i}"></small></button>
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
  $('#modo').hidden = tab !== 'paese';
  if (tab === 'paese') renderPaese(); else if (tab === 'gestori') renderGestori(); else if (tab === 'potenzia') renderPotenzia(); else renderRinnovo();
  aggiorna(true);
}

// ---------------------------------------------------------------- aggiornamento a ogni fotogramma
const txt = (el, t) => { if (el && el.textContent !== t) el.textContent = t; };
const sposta = (el, x, y, flip = false) => { if (el) el.style.transform = `translate(${x}px, ${y}px)${flip ? ' scaleX(-1)' : ''}`; };
function statoAbilita(chi, i, el) {
  const g = posto(chi, i).g;
  if (!g || !el) return;
  const t = ora(), span = el.querySelector('span');
  if (t < g.fino) { el.className = 'abil attiva'; txt(span, durata((g.fino - t) / 1000)); el.disabled = true; }
  else if (t < g.pronto) { el.className = 'abil ricarica'; txt(span, durata((g.pronto - t) / 1000)); el.disabled = true; }
  else { el.className = 'abil pronta'; txt(span, 'Attiva'); el.disabled = false; }
}
function aggiorna(forza = false) {
  txt($('#soldi'), fmt(S.soldi));
  const ps = alSecondo();
  txt($('#alSec'), (ps ? `${fmt(ps)}/s · ad app chiusa ${fmt(ps * QUOTA_ASSENZA)}/s` : (gestoriAperti() ? 'Assumi i gestori per guadagnare da solo' : `Porta il chiosco al livello ${LIVELLO_GESTORI} per i gestori`)) + (S.rinnovo ? ` · ⭐ ×${moltRinnovo()}` : ''));
  txt($('#modo'), MODI[S.modo] === 'max' ? 'Max' : `×${MODI[S.modo]}`);
  const pall = {
    potenzia: POTENZIAMENTI.some(u => !S.upg.includes(u.id) && S.soldi >= u.costo),
    rinnovo: !!RINNOVI[S.rinnovo] && S.soldi >= RINNOVI[S.rinnovo].costo,
  };
  for (const b of document.querySelectorAll('#nav button')) {
    const on = !!pall[b.dataset.tab], has = b.querySelector('.pallino');
    if (on && !has) b.insertAdjacentHTML('beforeend', '<i class="pallino"></i>'); else if (!on && has) has.remove();
  }
  if (aperta && sheet.open && performance.now() - ultimoDisegno > 300) disegnaSu();
  else if (sheet.open && !aperta) for (const el of sheet.querySelectorAll('[data-attiva]')) { const [c, i] = el.dataset.attiva.split(':'); if (el.id) statoAbilita(c, +i, el); }
  if (tab === 'gestori') {
    for (const el of view.querySelectorAll('.abil[data-attiva]')) { const [c, i] = el.dataset.attiva.split(':'); statoAbilita(c, +i, el); }
    for (const el of view.querySelectorAll('[data-gest]')) { const [c, i] = el.dataset.gest.split(':'); el.disabled = S.soldi < prezzoGestore(c, +i); }
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
    const k = quanti('b', i), c = costo('b', i, k), nc = nCommessi(l.L);
    txt($(`#liv${i}`), `Liv. ${l.L}${k > 1 ? ` → ${l.L + k}` : ''}${nc > 1 ? ` · 👥${nc}` : ''}`);
    txt($(`#prezzo${i}`), fmt(c));
    const su = view.querySelector(`[data-su="b:${i}"]`);
    if (su) { su.disabled = S.soldi < c; su.classList.toggle('scontato', !!abilita('b', i, 'sconto')); }
    const gb = view.querySelector(`[data-gest="b:${i}"]`);
    if (gb) gb.disabled = S.soldi < prezzoGestore('b', i);
    statoAbilita('b', i, $(`#ab-b${i}`));
    if (l.g && ora() >= l.g.pronto) pronti++;
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
    const o = posto(chi, 0), k = quanti(chi, 0), c = costo(chi, 0, k);
    txt($(`#liv-${chi}`), `Liv. ${o.L}${k > 1 ? ` → ${o.L + k}` : ''}`);
    txt($(`#prezzo-${chi}`), fmt(c));
    txt($(`#info-${chi}`), `porta ${fmt(chi === 'f' ? capFuni() : capApe())} a viaggio`);
    const su = view.querySelector(`[data-su="${chi}:0"]`);
    if (su) { su.disabled = S.soldi < c; su.classList.toggle('scontato', !!abilita(chi, 0, 'sconto')); }
    const gb = view.querySelector(`[data-gest="${chi}:0"]`);
    if (gb) gb.disabled = S.soldi < prezzoGestore(chi, 0);
    statoAbilita(chi, 0, $(`#ab-${chi}0`));
    if (o.g && ora() >= o.g.pronto) pronti++;
  }
  const at = $('#attivaTutti');
  if (at) { at.hidden = pronti < 2; txt(at, `⚡ Attiva tutti (${pronti})`); }
  if (!gestoriAperti()) txt($('#collo'), '👆 Tocca il commesso, poi la funicolare, poi l\'Ape');
  else {
    const c = collo();
    txt($('#collo'), `🐢 Collo di bottiglia: ${c === 'botteghe' ? 'le botteghe' : c === 'funi' ? 'la funicolare' : 'le Ape'}`);
  }
}

// ---------------------------------------------------------------- effetti
function vola(x) {
  if (tab !== 'paese' || document.hidden) return;
  const m = view.querySelector('.merc');
  if (!m) return;
  const r = m.getBoundingClientRect();
  const el = Object.assign(document.createElement('div'), { className: 'volo', textContent: '+' + fmt(x) });
  el.style.left = `${r.left + 20}px`; el.style.top = `${r.top + 10}px`;
  document.body.append(el);
  setTimeout(() => el.remove(), 1000);
}
let toastT;
function toast(t) {
  const el = $('#toast');
  el.textContent = t; el.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => (el.hidden = true), 2800);
}
const vibra = p => { try { navigator.userActivation?.hasBeenActive && navigator.vibrate?.(p); } catch { /* niente vibrazione */ } };

function attiva(chi, i) {
  const g = posto(chi, i).g;
  if (!g || ora() < g.pronto) return false;
  const gr = GRADI[g.r];
  g.fino = ora() + gr.durata * 1000;
  g.pronto = ora() + (gr.durata + gr.ricarica) * 1000;
  return true;
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
      + riga('Al secondo', `${fmt(prodL(i, L) / giro)}/s`, `${fmt(prodL(i, L2) / giro)}/s`);
    const t = TAPPE.find(x => x > L), cm = COMMESSI.find(x => x > L);
    prossimi = [t && `🎉 Livello ${t}: produzione ×2`, cm && `👥 Livello ${cm}: un commesso in più`].filter(Boolean);
  } else if (chi === 'f') {
    titolo = 'Funicolare'; em = '🚡';
    const viaggio = L => (2 * aperte() * F.perTerrazza + aperte() * F.carico) / velFuniL(L);
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
    <div class="sGest">${slotGestore(chi, i)}<span class="note">${posto(chi, i).g ? `${GRADI[posto(chi, i).g.r].nome}: ${ABILITA[chi][posto(chi, i).g.a].testo(ABILITA[chi][posto(chi, i).g.a].effetto[posto(chi, i).g.r])}` : gestoriAperti() ? 'Un gestore lavora per te e ha un\'abilità speciale' : `Gestori dal livello ${LIVELLO_GESTORI} del chiosco`}</span></div>
  </div>`;
  statoAbilita(chi, i, sheet.querySelector(`#ab-${chi}${i}`));
  ultimoDisegno = performance.now();
}

// ---------------------------------------------------------------- pagina dei gestori
function renderGestori() {
  const posti = [['f', 0, '🚡', 'Funicolare'], ['a', 0, '🛺', 'Ape'], ...S.liv.map((l, i) => (l.L ? ['b', i, BOTTEGHE[i].em, BOTTEGHE[i].nome] : null)).filter(Boolean)];
  view.innerHTML = `<h2>Gestori</h2>
    <p class="note">${gestoriAperti() ? 'Un gestore fa lavorare il suo posto da solo (anche ad app chiusa, a metà ritmo) e ha un\'abilità da attivare: dura qualche minuto, poi si ricarica. I gradi: Apprendista, Esperto, Maestro (più raro, più forte).' : `I gestori arrivano quando il chiosco delle granite raggiunge il livello ${LIVELLO_GESTORI}.`}</p>
    ${gestoriAperti() ? '<button class="primary" data-attiva-tutti style="margin:0 16px 6px;width:calc(100% - 32px)">⚡ Attiva tutte le abilità pronte</button>' : ''}
    ${posti.map(([chi, i, em, nome]) => {
      const g = posto(chi, i).g, ab = g && ABILITA[chi][g.a];
      return `<div class="voce gv"><span class="em">${em}</span><span class="t"><b>${nome}</b>
        <small>${g ? `<span class="grado" style="--r:${GRADI[g.r].colore}">${GRADI[g.r].nome}</span> ${ab.em} ${ab.testo(ab.effetto[g.r])} · ${durataLunga(GRADI[g.r].durata)}` : 'Nessun gestore'}</small>
        ${g ? `<button class="link" data-licenzia="${chi}:${i}">Licenzia (rimborso ${fmt(g.pagato / 2)})</button>` : ''}</span>
        <span class="azione">${slotGestore(chi, i)}</span></div>`;
    }).join('')}`;
}

function schedaGestore(chi, i) {
  aperta = null;
  const g = posto(chi, i).g, gr = GRADI[g.r], ab = ABILITA[chi][g.a], dove = chi === 'b' ? BOTTEGHE[i].nome : chi === 'f' ? 'Funicolare' : 'Ape';
  sheet.innerHTML = `<div style="font-size:44px">🧑‍💼</div>
    <h3 style="margin:4px 0">${gr.nome} · ${dove}</h3>
    <p style="margin:4px 0"><b>${ab.em} ${ab.nome}</b>: ${ab.testo(ab.effetto[g.r])}</p>
    <p class="note">Dura ${durataLunga(gr.durata)}, poi si ricarica in ${durataLunga(gr.ricarica)}. Intanto il gestore fa lavorare ${chi === 'b' ? 'i commessi' : chi === 'f' ? 'la funicolare' : 'le Ape'} da solo.</p>
    <button class="primary" data-attiva="${chi}:${i}" ${ora() >= g.pronto ? '' : 'disabled'}>${ora() >= g.pronto ? `${ab.em} Attiva ${ab.nome}` : `Si ricarica: ${durata((g.pronto - ora()) / 1000)}`}</button>
    <button class="link" data-licenzia="${chi}:${i}">Licenzia (ti ridanno ${fmt(g.pagato / 2)}) e assumine un altro</button>
    <button class="link" data-chiudi>Chiudi</button>`;
  sheet.showModal();
}

// ---------------------------------------------------------------- tocchi
document.addEventListener('click', e => {
  const on = s => e.target.closest(s);
  let el;
  if (on('[data-chiudi]')) { sheet.close(); return; }
  if ((el = on('#nav button'))) { tab = el.dataset.tab; render(); scrollTo(0, 0); return; }
  if (on('#modo')) { S.modo = (S.modo + 1) % MODI.length; aggiorna(); return; }
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
  if ((el = on('[data-gest]'))) {
    const [chi, si] = el.dataset.gest.split(':'), i = +si, prezzo = prezzoGestore(chi, i);
    if (S.soldi < prezzo || !gestoriAperti()) return;
    S.soldi -= prezzo;
    let x = Math.random(), r = 0;
    while (r < GRADI.length - 1 && x > GRADI[r].prob) { x -= GRADI[r].prob; r++; }
    const g = { r, a: Math.floor(Math.random() * ABILITA[chi].length), fino: 0, pronto: 0, pagato: prezzo };
    posto(chi, i).g = g;
    render(); salva(); schedaGestore(chi, i); return;
  }
  if ((el = on('[data-info]'))) { const [chi, i] = el.dataset.info.split(':'); schedaGestore(chi, +i); return; }
  if ((el = on('[data-attiva]'))) {
    const [chi, i] = el.dataset.attiva.split(':');
    if (attiva(chi, +i)) { vibra(15); toast('⚡ Abilità attivata!'); if (aperta) disegnaSu(); else if (sheet.open) sheet.close(); aggiorna(); salva(); }
    return;
  }
  if (on('[data-attiva-tutti]')) {
    let n = 0;
    S.liv.forEach((l, i) => { if (l.L && attiva('b', i)) n++; });
    if (attiva('f', 0)) n++;
    if (attiva('a', 0)) n++;
    if (n) { vibra(20); toast(`⚡ ${n} abilità attivate!`); aggiorna(); salva(); }
    return;
  }
  if ((el = on('[data-licenzia]'))) {
    const [chi, i] = el.dataset.licenzia.split(':'), o = posto(chi, +i);
    S.soldi += o.g.pagato / 2; o.g = null;
    sheet.close(); render(); salva(); toast('Gestore licenziato: puoi assumerne un altro'); return;
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
