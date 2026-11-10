// Disegni della mappa del paese su canvas, in coordinate logiche (larghezza 360). Tutto vista dall'alto.
import { CORSO, QUARTIERI } from './dati.js';

const rr = (c, x, y, w, h, r) => { c.beginPath(); c.roundRect(x, y, w, h, r); };

/** Sfondo fisso: prati, corso con marciapiedi, strade trasversali, strisce pedonali, alberi, mare. */
export function sfondo(c, alt, quartieriAperti) {
  c.fillStyle = '#8cc56b'; c.fillRect(0, 0, 360, alt);
  // ciuffi d'erba
  c.fillStyle = '#7fb85f';
  for (let y = 6; y < alt; y += 23) for (let x = (y * 7) % 31; x < 360; x += 37) c.fillRect(x, y, 3, 2);
  // corso e marciapiedi
  c.fillStyle = '#d9cfbf'; c.fillRect(CORSO.x1 - 10, 0, CORSO.x2 - CORSO.x1 + 20, alt);
  c.fillStyle = '#5b5f66'; c.fillRect(CORSO.x1, 0, CORSO.x2 - CORSO.x1, alt);
  c.strokeStyle = '#f2f2f2'; c.lineWidth = 1.4; c.setLineDash([8, 8]);
  c.beginPath(); c.moveTo(180, 0); c.lineTo(180, alt); c.stroke(); c.setLineDash([]);
  // strade trasversali tra i quartieri, con le strisce
  for (const q of QUARTIERI.slice(1)) {
    if (q.y >= alt) break;
    c.fillStyle = '#d9cfbf'; c.fillRect(0, q.y - 14, 360, 34);
    c.fillStyle = '#5b5f66'; c.fillRect(0, q.y - 8, 360, 22);
    c.fillStyle = '#f2f2f2';
    for (let k = 0; k < 6; k++) c.fillRect(CORSO.x1 + 3 + k * 6.3, q.y - 22, 3.5, 12);
  }
  // quartieri ancora chiusi: grigi
  QUARTIERI.forEach((q, i) => {
    if (i < quartieriAperti || q.y >= alt) return;
    c.fillStyle = 'rgba(70,60,50,.45)'; c.fillRect(0, q.y + 22, 360, Math.min(q.fine, alt) - q.y - 22);
  });
}

export function albero(c, x, y, r = 9) {
  c.fillStyle = 'rgba(0,0,0,.15)'; c.beginPath(); c.ellipse(x + 3, y + 4, r, r * 0.8, 0, 0, 7); c.fill();
  c.fillStyle = '#3d8b3d'; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
  c.fillStyle = '#4fa34f'; c.beginPath(); c.arc(x - r * 0.3, y - r * 0.3, r * 0.55, 0, 7); c.fill();
}

/** Lotto chiuso (prato con cartello) o in costruzione. */
export function lottoChiuso(c, x, y, w, h) {
  c.fillStyle = '#a9cf8f'; rr(c, x, y, w, h, 8); c.fill();
  c.strokeStyle = '#ffffff99'; c.setLineDash([5, 4]); c.lineWidth = 1.5; rr(c, x + 3, y + 3, w - 6, h - 6, 6); c.stroke(); c.setLineDash([]);
}

/**
 * Negozio visto dall'alto: tetto colorato con i dettagli, tenda sul lato del corso, insegna con l'emoji.
 * liv = quante "tappe" ha raggiunto (più tavolini, insegna sul tetto, bandierine); casse = commessi al bancone.
 */
export function negozio(c, e, x, y, w, h, liv = 0, casse = 1) {
  const versoCorso = e.lato === 'L' ? 1 : -1;
  const dehors = e.tavoli ? 30 : 0;   // tavolini all'aperto verso il corso
  const bx = versoCorso > 0 ? x : x + dehors, bw = w - dehors;
  c.fillStyle = 'rgba(0,0,0,.18)'; rr(c, bx + 4, y + 5, bw, h, 6); c.fill();
  c.fillStyle = e.muro; rr(c, bx, y, bw, h, 6); c.fill();
  // tetto a falde con i comignoli e (dal livello 25) i pannelli solari
  c.fillStyle = e.tetto; rr(c, bx + 6, y + 6, bw - 12, h - 30, 4); c.fill();
  c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(bx + 6, y + 6, bw - 12, (h - 30) / 2);
  c.strokeStyle = 'rgba(0,0,0,.2)'; c.lineWidth = 1;
  c.beginPath(); c.moveTo(bx + 6, y + 6 + (h - 30) / 2); c.lineTo(bx + bw - 6, y + 6 + (h - 30) / 2); c.stroke();
  c.fillStyle = '#7a4a3a'; c.fillRect(bx + 14, y + 10, 6, 6);
  c.fillStyle = '#bfc5cc'; c.fillRect(bx + bw - 24, y + h - 44, 10, 8);   // condizionatore
  if (liv >= 2) { c.fillStyle = '#2b3f63'; for (let k = 0; k < 3; k++) c.fillRect(bx + 26 + k * 9, y + 10, 8, 12); }
  // finestre sui lati
  c.fillStyle = '#bfe3f2';
  for (let k = 0; k < 3; k++) c.fillRect(bx + 10 + k * ((bw - 26) / 3), y + h - 20, 10, 5);
  // tenda a righe verso il corso
  const tx = versoCorso > 0 ? bx + bw - 10 : bx, ty = y + h - 50;
  for (let k = 0; k < 6; k++) { c.fillStyle = k % 2 ? '#fff' : e.tetto; c.fillRect(tx, ty + k * 6, 10, 6); }
  // ingresso e commessi al bancone (uno per cassa)
  c.fillStyle = '#8a5a2b'; c.fillRect(versoCorso > 0 ? bx + bw - 3 : bx, y + h - 36, 3, 16);
  for (let k = 0; k < Math.min(6, casse); k++) {
    const px = versoCorso > 0 ? bx + bw - 18 : bx + 18, py = y + h - 60 + k * 7;
    c.fillStyle = '#fff'; c.beginPath(); c.arc(px, py, 2.6, 0, 7); c.fill();
    c.fillStyle = '#f2c79a'; c.beginPath(); c.arc(px, py - 0.4, 1.5, 0, 7); c.fill();
  }
  // insegna
  c.font = '22px system-ui, "Segoe UI Emoji", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(e.em, bx + bw / 2, y + (h - 30) / 2 + 6);
  if (liv >= 3) {   // insegna luminosa sul tetto
    c.fillStyle = '#1a1208'; rr(c, bx + bw / 2 - 22, y + h - 34, 44, 9, 3); c.fill();
    c.fillStyle = '#ffd23f'; c.font = 'bold 6px system-ui'; c.fillText(e.nome.split(' ')[0].toUpperCase().slice(0, 10), bx + bw / 2, y + h - 29.5);
  }
  if (liv >= 4) {   // bandierine sul tetto
    for (let k = 0; k < 5; k++) { c.fillStyle = ['#e8503a', '#ffd23f', '#2f7fbf', '#2e7d4f', '#d6487e'][k]; c.beginPath(); c.moveTo(bx + 8 + k * (bw - 16) / 4, y + 3); c.lineTo(bx + 12 + k * (bw - 16) / 4, y + 3); c.lineTo(bx + 10 + k * (bw - 16) / 4, y + 8); c.fill(); }
  }
  if (dehors) {   // tavolini con l'ombrellone: più livello, più tavolini
    const dx = versoCorso > 0 ? x + w - dehors : x;
    c.fillStyle = '#d8c3a0'; rr(c, dx + 2, y + 4, dehors - 4, h - 8, 4); c.fill();
    const n = Math.min(4, 2 + liv);
    for (let k = 0; k < n; k++) {
      const ty2 = y + 14 + k * ((h - 28) / Math.max(1, n - 1)) * (n > 1 ? 1 : 0), tx2 = dx + dehors / 2;
      c.fillStyle = 'rgba(0,0,0,.15)'; c.beginPath(); c.arc(tx2 + 2, ty2 + 2, 9, 0, 7); c.fill();
      for (let s = 0; s < 6; s++) { c.fillStyle = s % 2 ? '#fff' : e.tetto; c.beginPath(); c.moveTo(tx2, ty2); c.arc(tx2, ty2, 9, s * Math.PI / 3, (s + 1) * Math.PI / 3); c.fill(); }
    }
  }
  if (e.carrelli) {   // rastrelliera dei carrelli
    c.fillStyle = '#c9ced6'; const cx = versoCorso > 0 ? x + 8 : x + w - 40;
    for (let k = 0; k < 4; k++) { c.fillRect(cx + k * 8, y + h - 18, 6, 9); }
  }
  if (e.id === 'cinema') {   // lampadine della locandina
    c.fillStyle = '#ffe066'; for (let k = 0; k < 10; k++) { c.beginPath(); c.arc(bx + 12 + k * (bw - 24) / 9, y + h - 26, 1.4, 0, 7); c.fill(); }
  }
}
/** Punto in cui la porta del negozio "si illumina" di notte. */
export const vetrina = (e, x, y, w, h) => {
  const dehors = e.tavoli ? 30 : 0;
  return e.lato === 'L' ? { x: x + w - dehors, y: y + h - 28 } : { x: x + dehors, y: y + h - 28 };
};

/** Parcheggio con gli stalli (quanti ne servono al livello). */
export function parcheggio(c, x, y, w, h, posti, piani = 0) {
  c.fillStyle = '#6c7078'; rr(c, x, y, w, h, 8); c.fill();
  const aperti = Math.min(12, posti), col = 6, sw = (w - 16) / col;
  // stalli disponibili in bianco, quelli ancora da costruire sono prato
  for (let k = 0; k < 12; k++) {
    if (k < aperti) continue;
    const s = stallo(x, y, w, h, k);
    c.fillStyle = '#8cc56b'; c.fillRect(s.x - sw / 2 + 1, s.y - 15, sw - 2, 30);
  }
  c.strokeStyle = '#f2f2f2'; c.lineWidth = 1.2;
  for (let k = 0; k <= col; k++) {
    c.beginPath(); c.moveTo(x + 8 + k * sw, y + 8); c.lineTo(x + 8 + k * sw, y + 40); c.stroke();
    c.beginPath(); c.moveTo(x + 8 + k * sw, y + h - 40); c.lineTo(x + 8 + k * sw, y + h - 8); c.stroke();
  }
  if (piani) {   // multipiano: rampa e numero dei piani
    c.fillStyle = '#4a4e55'; rr(c, x + 8, y + 46, 30, 36, 4); c.fill();
    c.fillStyle = '#ffd23f'; c.font = 'bold 9px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(`▲${piani}`, x + 23, y + 64);
  }
  c.fillStyle = '#fff'; c.font = 'bold 12px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(`P · ${posti} posti`, x + w / 2 + (piani ? 14 : 0), y + h / 2);
  // ingresso sul corso
  c.fillStyle = '#6c7078'; c.fillRect(x + w, y + 54, CORSO.x1 - x - w, 22);
}
/** Posizione dello stallo k (0-11) del parcheggio. */
export const stallo = (x, y, w, h, k) => {
  const col = 6, sw = (w - 16) / col, riga = Math.floor(k / col) % 2, j = k % col;
  return { x: x + 8 + sw * (j + 0.5), y: riga ? y + h - 24 : y + 24 };
};

export function fermata(c, x, y, w, h) {
  c.fillStyle = '#c9b89c'; rr(c, x, y, w, h, 8); c.fill();
  // pensilina
  c.fillStyle = '#2f7fbf'; rr(c, x + 10, y + 50, 60, 22, 4); c.fill();
  c.fillStyle = '#bfe3f2'; c.fillRect(x + 14, y + 54, 52, 8);
  c.fillStyle = '#fff'; c.font = 'bold 11px system-ui'; c.textAlign = 'center'; c.fillText('BUS', x + 40, y + 66);
  // aiuola con alberi
  c.fillStyle = '#7fb85f'; rr(c, x + 80, y + 10, w - 90, h - 20, 10); c.fill();
  albero(c, x + 100, y + 40); albero(c, x + 118, y + 90, 8);
  // corsia della fermata
  c.fillStyle = '#5b5f66'; c.fillRect(CORSO.x2, y + 40, x - CORSO.x2, 46);
}

export function campo(c, x, y, w, h) {
  c.fillStyle = '#e7dcc6'; rr(c, x, y, w, h, 8); c.fill();
  c.fillStyle = '#4c9a47'; rr(c, x + 8, y + 22, w - 16, h - 44, 4); c.fill();
  for (let k = 0; k < 8; k++) { c.fillStyle = k % 2 ? '#56a650' : '#4c9a47'; c.fillRect(x + 8, y + 22 + k * (h - 44) / 8, w - 16, (h - 44) / 8); }
  c.strokeStyle = '#fff'; c.lineWidth = 1.5;
  c.strokeRect(x + 14, y + 28, w - 28, h - 56);
  c.beginPath(); c.moveTo(x + 14, y + h / 2); c.lineTo(x + w - 14, y + h / 2); c.stroke();
  c.beginPath(); c.arc(x + w / 2, y + h / 2, 16, 0, 7); c.stroke();
  c.strokeRect(x + w / 2 - 24, y + 28, 48, 22); c.strokeRect(x + w / 2 - 24, y + h - 50, 48, 22);
  // tribune
  c.fillStyle = '#c0392b'; c.fillRect(x + 10, y + 4, w - 20, 12); c.fillRect(x + 10, y + h - 16, w - 20, 12);
}
/** Area di gioco del campo, per muovere i giocatori. */
export const areaCampo = (x, y, w, h) => ({ x1: x + 18, y1: y + 32, x2: x + w - 18, y2: y + h - 32 });

export function pista(c, x, y, w, h) {
  c.fillStyle = '#9bc77f'; rr(c, x, y, w, h, 8); c.fill();
  c.lineWidth = 16; c.strokeStyle = '#555'; rr(c, x + 18, y + 18, w - 36, h - 36, 36); c.stroke();
  c.lineWidth = 2; c.strokeStyle = '#fff'; c.setLineDash([6, 6]); rr(c, x + 18, y + 18, w - 36, h - 36, 36); c.stroke(); c.setLineDash([]);
  // cordoli
  c.lineWidth = 3; c.strokeStyle = '#e8503a'; c.setLineDash([4, 4]); rr(c, x + 9, y + 9, w - 18, h - 18, 42); c.stroke(); c.setLineDash([]);
  // traguardo
  c.fillStyle = '#fff'; for (let k = 0; k < 4; k++) c.fillRect(x + w / 2 - 2 + (k % 2) * 4, y + 10 + k * 4, 4, 4);
  c.font = '26px system-ui, "Segoe UI Emoji"'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('🏁', x + w / 2, y + h / 2);
}
/** Punto del giro di pista alla frazione t (0-1). */
export function puntoPista(x, y, w, h, t) {
  const x1 = x + 18, y1 = y + 18, ww = w - 36, hh = h - 36, per = 2 * (ww + hh);
  let d = ((t % 1) + 1) % 1 * per;
  if (d < ww) return { x: x1 + d, y: y1, a: 0 };
  d -= ww; if (d < hh) return { x: x1 + ww, y: y1 + d, a: Math.PI / 2 };
  d -= hh; if (d < ww) return { x: x1 + ww - d, y: y1 + hh, a: Math.PI };
  d -= ww; return { x: x1, y: y1 + hh - d, a: -Math.PI / 2 };
}

export function porto(c, x, y, w, h, alt) {
  // mare dal porto in giù
  c.fillStyle = '#2f8fc9'; c.fillRect(0, y + h, 360, alt - (y + h));
  c.fillStyle = '#3a9ad3'; for (let yy = y + h; yy < alt; yy += 18) for (let xx = (yy * 3) % 40; xx < 360; xx += 46) c.fillRect(xx, yy, 14, 2);
  // banchina
  c.fillStyle = '#b08c62'; rr(c, x, y, w, h + 6, 6); c.fill();
  c.strokeStyle = '#8a6a44'; c.lineWidth = 1; for (let k = 0; k < Math.floor(h / 11); k++) { c.beginPath(); c.moveTo(x, y + 8 + k * 11); c.lineTo(x + w, y + 8 + k * 11); c.stroke(); }
  c.fillStyle = '#6d4c2a'; for (let k = 0; k < 4; k++) c.fillRect(x + 12 + k * 36, y + h - 2, 6, 8);
}

/**
 * Una persona vista dall'alto, con i piedi che si muovono. a: { colore, capelli, pelle, s (scala), ombrello, oro }.
 */
export function persona(c, x, y, a, passo, carrello, triste) {
  const s = a.s ?? 1;
  if (carrello) { c.fillStyle = '#c9ced6'; c.fillRect(x + 4, y - 3, 7, 6); c.strokeStyle = '#8a8f98'; c.lineWidth = 0.8; c.strokeRect(x + 4, y - 3, 7, 6); }
  if (a.oro) { c.fillStyle = 'rgba(255,215,0,.35)'; c.beginPath(); c.arc(x, y, 9, 0, 7); c.fill(); c.fillStyle = '#d4a017'; c.fillRect(x + 3, y + 1, 5, 4); }
  const p = Math.sin(passo) * 1.6 * s;
  c.fillStyle = '#333'; c.fillRect(x - 2.5 * s, y + 1 + p, 2 * s, 2.4 * s); c.fillRect(x + 0.5 * s, y + 1 - p, 2 * s, 2.4 * s);
  c.fillStyle = a.oro ? '#ffd700' : a.colore; c.beginPath(); c.ellipse(x, y, 3.6 * s, 2.8 * s, 0, 0, 7); c.fill();
  if (a.ombrello) {
    c.fillStyle = a.ombrello; c.beginPath(); c.arc(x, y - 1, 6, 0, 7); c.fill();
    c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 0.6; for (let k = 0; k < 4; k++) { c.beginPath(); c.moveTo(x, y - 1); c.lineTo(x + Math.cos(k * 1.57) * 6, y - 1 + Math.sin(k * 1.57) * 6); c.stroke(); }
    return;
  }
  c.fillStyle = triste ? '#8fa0b3' : a.pelle ?? '#f2c79a'; c.beginPath(); c.arc(x, y - 0.6, 2 * s, 0, 7); c.fill();
  c.fillStyle = a.capelli ?? '#3b2a1a'; c.beginPath(); c.arc(x, y - 1.3 * s, 1.7 * s, Math.PI, 0); c.fill();
}
/** Auto vista dall'alto; ang 0 = verso il basso. Di notte con i fari accesi. */
export function automobile(c, x, y, colore, giu, ang = null, fari = 0) {
  c.save(); c.translate(x, y); c.rotate(ang ?? (giu ? 0 : Math.PI));
  if (fari > 0.05) {
    c.globalAlpha = fari * 0.5; c.fillStyle = '#fff3b0';
    c.beginPath(); c.moveTo(-4, 9); c.lineTo(-9, 30); c.lineTo(9, 30); c.lineTo(4, 9); c.fill(); c.globalAlpha = 1;
  }
  c.fillStyle = 'rgba(0,0,0,.2)'; rr(c, -5, -8, 12, 18, 3); c.fill();
  c.fillStyle = colore; rr(c, -6, -9, 12, 18, 3); c.fill();
  c.fillStyle = '#bfe3f2'; c.fillRect(-4.5, 1.5, 9, 4); c.fillRect(-4.5, -6.5, 9, 3);
  c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(-4.5, -2.5, 9, 3.5);
  c.restore();
}
export function autoParcheggiata(c, x, y, colore) {
  c.fillStyle = colore; rr(c, x - 5.5, y - 9, 11, 18, 3); c.fill();
  c.fillStyle = '#bfe3f2'; c.fillRect(x - 4, y - 6, 8, 3);
}
export function autobus(c, x, y, giu) {
  c.save(); c.translate(x, y); if (!giu) c.rotate(Math.PI);
  c.fillStyle = 'rgba(0,0,0,.2)'; rr(c, -7, -21, 16, 44, 3); c.fill();
  c.fillStyle = '#f2b134'; rr(c, -8, -22, 16, 44, 3); c.fill();
  c.fillStyle = '#bfe3f2'; c.fillRect(-6, 14, 12, 5); for (let k = 0; k < 5; k++) c.fillRect(-7, -16 + k * 6, 2, 4);
  c.restore();
}
export function traghetto(c, x, y) {
  c.fillStyle = 'rgba(0,0,0,.2)'; rr(c, x - 44, y - 12, 92, 30, 12); c.fill();
  c.fillStyle = '#ffffff'; rr(c, x - 46, y - 15, 92, 30, 12); c.fill();
  c.fillStyle = '#1f6fa8'; rr(c, x - 30, y - 9, 56, 18, 5); c.fill();
  c.fillStyle = '#e8503a'; c.fillRect(x + 14, y - 6, 8, 12);
}
export function kart(c, x, y, a, colore) {
  c.save(); c.translate(x, y); c.rotate(a);
  c.fillStyle = colore; rr(c, -6, -3.5, 12, 7, 2); c.fill();
  c.fillStyle = '#222'; c.fillRect(-5, -5, 3, 1.6); c.fillRect(2, -5, 3, 1.6); c.fillRect(-5, 3.4, 3, 1.6); c.fillRect(2, 3.4, 3, 1.6);
  c.fillStyle = '#ffd23f'; c.beginPath(); c.arc(0, 0, 2, 0, 7); c.fill();
  c.restore();
}
export function giocatore(c, x, y, colore) {
  c.fillStyle = colore; c.beginPath(); c.arc(x, y, 3, 0, 7); c.fill();
  c.fillStyle = '#f2c79a'; c.beginPath(); c.arc(x, y - 0.5, 1.6, 0, 7); c.fill();
}
export function palla(c, x, y) { c.fillStyle = '#fff'; c.beginPath(); c.arc(x, y, 2, 0, 7); c.fill(); c.strokeStyle = '#333'; c.lineWidth = 0.5; c.stroke(); }

// ---------------------------------------------------------------- Borgo antico: ruota panoramica
export function ruotaBase(c, x, y, w, h) {
  c.fillStyle = '#9bc77f'; rr(c, x, y, w, h, 8); c.fill();
  c.fillStyle = '#d8c3a0'; rr(c, x + 6, y + h - 40, w - 12, 34, 6); c.fill();   // piazzale
  // biglietteria e aiuole
  c.fillStyle = '#e8503a'; rr(c, x + w - 40, y + h - 36, 30, 22, 3); c.fill();
  c.fillStyle = '#fff'; c.fillRect(x + w - 36, y + h - 30, 22, 6);
  albero(c, x + 16, y + 18, 8); albero(c, x + w - 16, y + 18, 8); albero(c, x + 14, y + h - 60, 7);
  // basamento e sostegni
  const cx = x + w / 2, cy = y + (h - 40) / 2 + 4;
  c.strokeStyle = '#555'; c.lineWidth = 3;
  c.beginPath(); c.moveTo(cx - 22, y + h - 40); c.lineTo(cx, cy); c.lineTo(cx + 22, y + h - 40); c.stroke();
}
/** La ruota che gira (t in secondi). */
export function ruotaGiro(c, x, y, w, h, t, notte = 0) {
  const cx = x + w / 2, cy = y + (h - 40) / 2 + 4, r = Math.min(w, h - 40) / 2 - 8, a0 = t * 0.12;
  c.strokeStyle = '#d0d4da'; c.lineWidth = 2.2; c.beginPath(); c.arc(cx, cy, r, 0, 7); c.stroke();
  c.lineWidth = 1; c.beginPath(); c.arc(cx, cy, r * 0.55, 0, 7); c.stroke();
  const n = 10, colori = ['#e8503a', '#ffd23f', '#2f7fbf', '#2e7d4f', '#d6487e'];
  for (let k = 0; k < n; k++) {
    const a = a0 + (k / n) * Math.PI * 2, px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
    c.strokeStyle = '#d0d4da'; c.lineWidth = 1; c.beginPath(); c.moveTo(cx, cy); c.lineTo(px, py); c.stroke();
    c.fillStyle = colori[k % colori.length]; rr(c, px - 5, py - 4, 10, 8, 2); c.fill();
    if (notte > 0.1) { c.fillStyle = `rgba(255,240,150,${notte})`; c.beginPath(); c.arc(px, py, 1.6, 0, 7); c.fill(); }
  }
  c.fillStyle = '#888'; c.beginPath(); c.arc(cx, cy, 4, 0, 7); c.fill();
}

// ---------------------------------------------------------------- mare, cielo e luci
/** Riflessi delle onde che si muovono e una barca a vela al largo. */
export function onde(c, y0, y1, t) {
  if (y1 <= y0) return;
  c.fillStyle = 'rgba(255,255,255,.28)';
  for (let yy = y0 + 8; yy < y1; yy += 16) {
    const off = ((t * 9 + yy * 3) % 46);
    for (let xx = -46 + off; xx < 360; xx += 46) c.fillRect(xx, yy + Math.sin(t + xx * 0.05) * 1.5, 12, 1.5);
  }
  const bx = ((t * 6) % 460) - 50, by = y0 + Math.min(60, (y1 - y0) / 2);
  c.fillStyle = '#fff'; c.beginPath(); c.moveTo(bx, by - 12); c.lineTo(bx + 9, by); c.lineTo(bx, by); c.fill();
  c.fillStyle = '#8a5a2b'; rr(c, bx - 8, by, 20, 5, 2); c.fill();
  // gabbiani
  c.strokeStyle = '#fff'; c.lineWidth = 1;
  for (let k = 0; k < 3; k++) {
    const gx = (t * (14 + k * 3) + k * 120) % 400 - 20, gy = y0 + 20 + k * 22 + Math.sin(t * 2 + k) * 4, ali = Math.sin(t * 8 + k) * 2;
    c.beginPath(); c.moveTo(gx - 4, gy - ali); c.lineTo(gx, gy); c.lineTo(gx + 4, gy - ali); c.stroke();
  }
}
/** Lampioni lungo il corso (per il disegno e per le luci di notte). */
export const lampioni = alt => {
  const out = [];
  for (let y = 40; y < alt - 20; y += 80) { out.push({ x: CORSO.x1 - 3, y }); out.push({ x: CORSO.x2 + 3, y: y + 40 }); }
  return out;
};
export function lampione(c, x, y) {
  c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.arc(x + 1.5, y + 1.5, 2.6, 0, 7); c.fill();
  c.fillStyle = '#3a3a3a'; c.beginPath(); c.arc(x, y, 2.4, 0, 7); c.fill();
  c.fillStyle = '#ffe9a8'; c.beginPath(); c.arc(x, y, 1.2, 0, 7); c.fill();
}
/** Buio della sera (0-1) e luci calde accese sopra. luci: [{ x, y, r }]. */
export function notte(c, x0, y0, w, h, buio, luci) {
  if (buio <= 0.01) return;
  c.fillStyle = `rgba(16,24,64,${buio * 0.55})`; c.fillRect(x0, y0, w, h);
  c.save(); c.globalCompositeOperation = 'lighter';
  for (const l of luci) {
    if (l.y < y0 - 40 || l.y > y0 + h + 40) continue;
    const g = c.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
    g.addColorStop(0, `rgba(255,214,120,${0.4 * buio})`); g.addColorStop(1, 'rgba(255,214,120,0)');
    c.fillStyle = g; c.beginPath(); c.arc(l.x, l.y, l.r, 0, 7); c.fill();
  }
  c.restore();
}
/** Pioggia che cade (t in secondi). */
export function pioggia(c, x0, y0, w, h, t) {
  c.fillStyle = 'rgba(40,60,90,.18)'; c.fillRect(x0, y0, w, h);
  c.strokeStyle = 'rgba(210,230,255,.55)'; c.lineWidth = 1;
  c.beginPath();
  for (let k = 0; k < 140; k++) {
    const px = (k * 53.7 + t * 40) % w + x0, py = (k * 97.3 + t * 420) % h + y0;
    c.moveTo(px, py); c.lineTo(px - 2, py + 7);
  }
  c.stroke();
}
/** Festa: bandierine sopra il corso e coriandoli. */
export function festa(c, y0, h, t) {
  const colori = ['#e8503a', '#ffd23f', '#2f7fbf', '#2e7d4f', '#d6487e'];
  for (let y = Math.floor(y0 / 90) * 90 + 30; y < y0 + h; y += 90) {
    c.strokeStyle = '#555'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(CORSO.x1 - 6, y); c.quadraticCurveTo(180, y + 10, CORSO.x2 + 6, y); c.stroke();
    for (let k = 0; k < 7; k++) {
      const fx = CORSO.x1 - 2 + k * 7, fy = y + Math.sin((k / 6) * Math.PI) * 5;
      c.fillStyle = colori[k % 5]; c.beginPath(); c.moveTo(fx, fy); c.lineTo(fx + 5, fy); c.lineTo(fx + 2.5, fy + 6); c.fill();
    }
  }
  for (let k = 0; k < 60; k++) {
    const px = (k * 61.3 + Math.sin(t + k) * 20) % 360, py = y0 + (k * 83.1 + t * 30) % h;
    c.fillStyle = colori[k % 5]; c.fillRect(px, py, 2, 3);
  }
}
/** Fuochi d'artificio (di notte durante la festa). */
export function fuochi(c, y0, h, t) {
  for (let k = 0; k < 3; k++) {
    const fase = (t * 0.6 + k / 3) % 1, cx = 60 + k * 120, cy = y0 + 60 + k * 50 % Math.max(60, h - 120);
    const r = fase * 34, colore = ['#ff6b6b', '#ffd23f', '#7fb5ff'][k];
    c.globalAlpha = 1 - fase; c.fillStyle = colore;
    for (let s = 0; s < 12; s++) { const a = s * Math.PI / 6; c.beginPath(); c.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 1.6, 0, 7); c.fill(); }
    c.globalAlpha = 1;
  }
}
/** Nave da crociera (più grande del traghetto). */
export function nave(c, x, y) {
  c.fillStyle = 'rgba(0,0,0,.2)'; rr(c, x - 86, y - 18, 176, 44, 20); c.fill();
  c.fillStyle = '#ffffff'; rr(c, x - 88, y - 22, 176, 44, 20); c.fill();
  c.fillStyle = '#1f3d6b'; rr(c, x - 70, y - 14, 120, 28, 8); c.fill();
  c.fillStyle = '#bfe3f2'; for (let k = 0; k < 10; k++) c.fillRect(x - 64 + k * 11, y - 8, 7, 4);
  c.fillStyle = '#e8503a'; c.fillRect(x + 54, y - 10, 12, 20);
}
/** Faccina sopra la testa (😊 / 😠 / 💸) che sale e sparisce. */
export function fumetto(c, x, y, testo, t) {
  c.globalAlpha = Math.max(0, 1 - t / 1.6);
  c.font = '9px system-ui, "Segoe UI Emoji"'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(testo, x, y - 8 - t * 8);
  c.globalAlpha = 1;
}
