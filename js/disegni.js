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

/** Negozio visto dall'alto: tetto colorato, tenda sul lato del corso, insegna con l'emoji. */
export function negozio(c, e, x, y, w, h) {
  const versoCorso = e.lato === 'L' ? 1 : -1;
  c.fillStyle = 'rgba(0,0,0,.18)'; rr(c, x + 4, y + 5, w, h, 6); c.fill();
  c.fillStyle = e.muro; rr(c, x, y, w, h, 6); c.fill();
  // tetto a falde
  c.fillStyle = e.tetto; rr(c, x + 6, y + 6, w - 12, h - 30, 4); c.fill();
  c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = 1;
  c.beginPath(); c.moveTo(x + 6, y + 6 + (h - 30) / 2); c.lineTo(x + w - 6, y + 6 + (h - 30) / 2); c.stroke();
  // tenda a righe verso il corso
  const tx = versoCorso > 0 ? x + w - 10 : x, ty = y + h - 50;
  for (let k = 0; k < 6; k++) { c.fillStyle = k % 2 ? '#fff' : e.tetto; c.fillRect(tx, ty + k * 6, 10, 6); }
  // ingresso
  c.fillStyle = '#8a5a2b'; c.fillRect(versoCorso > 0 ? x + w - 3 : x, y + h - 36, 3, 16);
  // insegna
  c.font = '22px system-ui, "Segoe UI Emoji", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(e.em, x + w / 2, y + (h - 30) / 2 + 6);
  if (e.carrelli) {   // rastrelliera dei carrelli
    c.fillStyle = '#c9ced6'; const cx = versoCorso > 0 ? x + 8 : x + w - 40;
    for (let k = 0; k < 4; k++) { c.fillRect(cx + k * 8, y + h - 18, 6, 9); }
  }
}

/** Parcheggio con gli stalli (quanti ne servono al livello). */
export function parcheggio(c, x, y, w, h, posti) {
  c.fillStyle = '#6c7078'; rr(c, x, y, w, h, 8); c.fill();
  c.strokeStyle = '#f2f2f2'; c.lineWidth = 1.2;
  const col = 6, sw = (w - 16) / col;
  for (let k = 0; k <= col; k++) {
    c.beginPath(); c.moveTo(x + 8 + k * sw, y + 8); c.lineTo(x + 8 + k * sw, y + 40); c.stroke();
    c.beginPath(); c.moveTo(x + 8 + k * sw, y + h - 40); c.lineTo(x + 8 + k * sw, y + h - 8); c.stroke();
  }
  c.fillStyle = '#fff'; c.font = 'bold 13px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(`P · ${posti} posti`, x + w / 2, y + h / 2);
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

/** Una persona vista dall'alto, con i piedi che si muovono. */
export function persona(c, x, y, colore, passo, carrello, triste) {
  if (carrello) { c.fillStyle = '#c9ced6'; c.fillRect(x + 4, y - 3, 7, 6); c.strokeStyle = '#8a8f98'; c.lineWidth = 0.8; c.strokeRect(x + 4, y - 3, 7, 6); }
  const p = Math.sin(passo) * 1.6;
  c.fillStyle = '#333'; c.fillRect(x - 2.5, y + 1 + p, 2, 2.4); c.fillRect(x + 0.5, y + 1 - p, 2, 2.4);
  c.fillStyle = colore; c.beginPath(); c.ellipse(x, y, 3.6, 2.8, 0, 0, 7); c.fill();
  c.fillStyle = triste ? '#8fa0b3' : '#f2c79a'; c.beginPath(); c.arc(x, y - 0.6, 2, 0, 7); c.fill();
}
export function automobile(c, x, y, colore, giu) {
  c.save(); c.translate(x, y); if (!giu) c.rotate(Math.PI);
  c.fillStyle = 'rgba(0,0,0,.2)'; rr(c, -5, -8, 12, 18, 3); c.fill();
  c.fillStyle = colore; rr(c, -6, -9, 12, 18, 3); c.fill();
  c.fillStyle = '#bfe3f2'; c.fillRect(-4.5, 1.5, 9, 4); c.fillRect(-4.5, -6.5, 9, 3);
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
