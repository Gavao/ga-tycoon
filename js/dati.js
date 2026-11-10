// I numeri del paese: edifici (negozi, attrazioni, ingressi), quartieri, gestori, potenziamenti e rinnovi.
//
// I clienti arrivano dagli ingressi (parcheggio, fermata dell'autobus, porto), vanno a piedi in un negozio o in
// un'attrazione, fanno la fila e pagano alla cassa. I soldi restano nella cassa finché non li raccogli (o lo fa il gestore).

/**
 * Mappa in coordinate "logiche": larghezza 360, scalata sullo schermo. Il corso è la strada verticale al centro
 * (x 160-200); i lotti sono a sinistra (x 12-146) e a destra (x 214-348). y è l'alto del lotto, h l'altezza.
 */
export const LARGHEZZA = 360;
export const CORSO = { x1: 160, x2: 200, marcL: 154, marcR: 206 };
export const QUARTIERI = [
  { nome: 'Piazza', y: 0, fine: 410, lavori: 0 },
  { nome: 'Centro', y: 410, fine: 790, lavori: 10 * 60 },
  { nome: 'Lungomare', y: 790, fine: 1170, lavori: 60 * 60 },
  { nome: 'Porto', y: 1170, fine: 1470, lavori: 3 * 3600 },
];

/**
 * Edifici in ordine di apertura. tipo: negozio | attrazione | ingresso. lato: L/R; y,h: lotto.
 * Negozi e attrazioni: prezzo = euro per cliente al livello 1, servizio = secondi per cliente, su = primo potenziamento.
 * Ingressi: ogni = secondi tra un arrivo e l'altro, gente = persone per arrivo (crescono con il livello).
 */
export const EDIFICI = [
  { id: 'parcheggio', tipo: 'ingresso', mezzo: 'auto', nome: 'Parcheggio', em: '🅿️', lato: 'L', y: 18, h: 128, q: 0, apri: 0, ogni: 7, gente: 1.6, su: 25 },
  { id: 'granite', tipo: 'negozio', nome: 'Chiosco delle granite', em: '🍧', lato: 'R', y: 170, h: 100, q: 0, apri: 0, prezzo: 2, servizio: 3, su: 8, muro: '#f7d774', tetto: '#e8503a' },
  { id: 'edicola', tipo: 'negozio', nome: 'Edicola', em: '📰', lato: 'L', y: 170, h: 100, q: 0, apri: 60, prezzo: 6, servizio: 3.5, su: 40, muro: '#f4b9a6', tetto: '#2f7fbf' },
  { id: 'bus', tipo: 'ingresso', mezzo: 'bus', nome: 'Fermata dell\'autobus', em: '🚌', lato: 'R', y: 18, h: 128, q: 0, apri: 500, ogni: 22, gente: 6, su: 300 },
  { id: 'bar', tipo: 'negozio', nome: 'Bar del corso', em: '☕', lato: 'L', y: 290, h: 100, q: 0, apri: 1.5e3, prezzo: 25, servizio: 4, su: 600, muro: '#cfe6c4', tetto: '#2e7d4f' },
  { id: 'gelateria', tipo: 'negozio', nome: 'Gelateria', em: '🍦', lato: 'R', y: 290, h: 100, q: 0, apri: 8e3, prezzo: 70, servizio: 4, su: 3e3, muro: '#f9c6d8', tetto: '#d6487e' },
  { id: 'pizzeria', tipo: 'negozio', nome: 'Pizzeria', em: '🍕', lato: 'L', y: 440, h: 100, q: 1, apri: 5e4, prezzo: 260, servizio: 5, su: 2e4, muro: '#f1e3c8', tetto: '#c0392b' },
  { id: 'pasticceria', tipo: 'negozio', nome: 'Pasticceria', em: '🧁', lato: 'R', y: 440, h: 100, q: 1, apri: 2.5e5, prezzo: 900, servizio: 5, su: 1e5, muro: '#d9c9f0', tetto: '#7d55c7' },
  { id: 'supermercato', tipo: 'negozio', carrelli: true, nome: 'Supermercato', em: '🛒', lato: 'R', y: 560, h: 110, q: 1, apri: 1.2e6, prezzo: 3e3, servizio: 6, su: 5e5, muro: '#e3eef7', tetto: '#e8503a' },
  { id: 'calcio', tipo: 'attrazione', nome: 'Campo da calcio', em: '⚽', lato: 'L', y: 560, h: 215, q: 1, apri: 6e6, prezzo: 1.2e4, servizio: 8, su: 2.4e6, muro: '#5fa65a', tetto: '#fff' },
  { id: 'trattoria', tipo: 'negozio', nome: 'Trattoria', em: '🍝', lato: 'R', y: 680, h: 100, q: 1, apri: 3e7, prezzo: 4e4, servizio: 6, su: 1.2e7, muro: '#f6d6a8', tetto: '#2e7d4f' },
  { id: 'pescheria', tipo: 'negozio', nome: 'Pescheria', em: '🐟', lato: 'L', y: 820, h: 100, q: 2, apri: 2e8, prezzo: 1.5e5, servizio: 6, su: 8e7, muro: '#cde7ee', tetto: '#1f6fa8' },
  { id: 'gokart', tipo: 'attrazione', nome: 'Pista go-kart', em: '🏎️', lato: 'R', y: 820, h: 215, q: 2, apri: 1.2e9, prezzo: 6e5, servizio: 9, su: 5e8, muro: '#7a7a7a', tetto: '#e8503a' },
  { id: 'cantina', tipo: 'negozio', nome: 'Cantina dei vini', em: '🍷', lato: 'L', y: 935, h: 100, q: 2, apri: 7e9, prezzo: 2.2e6, servizio: 7, su: 3e9, muro: '#e8cfc0', tetto: '#7b1e3a' },
  { id: 'boutique', tipo: 'negozio', nome: 'Boutique di sandali', em: '👡', lato: 'L', y: 1050, h: 100, q: 2, apri: 4e10, prezzo: 8e6, servizio: 7, su: 1.6e10, muro: '#fbe3c4', tetto: '#c9822b' },
  { id: 'hotel', tipo: 'negozio', nome: 'Hotel sul mare', em: '🏨', lato: 'R', y: 1050, h: 100, q: 2, apri: 2.5e11, prezzo: 3e7, servizio: 9, su: 1e11, muro: '#bfe3f2', tetto: '#1f6fa8' },
  { id: 'lido', tipo: 'negozio', nome: 'Lido', em: '⛱️', lato: 'L', y: 1200, h: 100, q: 3, apri: 1.5e12, prezzo: 1.2e8, servizio: 8, su: 6e11, muro: '#fff1b8', tetto: '#e8503a' },
  { id: 'porto', tipo: 'ingresso', mezzo: 'traghetto', nome: 'Porto', em: '⛴️', lato: 'R', y: 1200, h: 230, q: 3, apri: 6e12, ogni: 45, gente: 30, su: 2e12 },
  { id: 'yacht', tipo: 'negozio', nome: 'Yacht club', em: '🛥️', lato: 'L', y: 1320, h: 100, q: 3, apri: 4e13, prezzo: 6e8, servizio: 10, su: 1.6e13, muro: '#e3f1fb', tetto: '#1f3d6b' },
];
/** Crescita dei prezzi dei potenziamenti a ogni livello (negozi e attrazioni / ingressi). */
export const CRESCE = { negozio: 1.12, attrazione: 1.12, ingresso: 1.15 };
/** A questi livelli il prezzo per cliente raddoppia. */
export const TAPPE = [10, 25, 50, 100, 200, 300, 400, 500, 600, 700, 800];
/** A questi livelli il negozio apre una cassa in più (massimo 6). */
export const CASSE = [10, 25, 50, 100, 200];
/** Ingressi: a ogni livello arrivano più spesso (fino a 3 volte) e con più gente. */
export const INGRESSO = { piuSpesso: 0.02, maxSpesso: 3, piuGente: 0.12 };
/** I clienti se ne vanno se la fila supera questa lunghezza (in gruppi di persone). */
export const FILA_MAX = 7;
/** La cassa di un negozio si riempie in questi secondi di vendite: poi il negozio non incassa più finché non la svuoti. */
export const CASSA_PIENA = 90;
/** I gestori si possono assumere quando il chiosco delle granite arriva a questo livello. */
export const LIVELLO_GESTORI = 5;
/** Ad app chiusa i gestori incassano questa frazione del ritmo normale. */
export const QUOTA_ASSENZA = 0.5;

/**
 * Gestori. Due squadre: negozi (anche le attrazioni) e ingressi. Si assumono a caso, il prezzo sale a ogni
 * assunzione, si assegnano agli edifici e si possono scambiare o vendere (metà del prezzo). Il gestore resta fisso:
 * nei negozi raccoglie da solo la cassa, negli ingressi fa arrivare gente anche ad app chiusa. L'abilità speciale
 * si attiva a mano, dura un po' e poi si ricarica (la ricarica è del gestore, non dell'edificio).
 */
export const GRADI = [
  { nome: 'Junior', prob: 0.65, durata: 60, ricarica: 300, colore: '#8fd3a5' },
  { nome: 'Senior', prob: 0.27, durata: 180, ricarica: 900, colore: '#7fb5ff' },
  { nome: 'Executive', prob: 0.08, durata: 600, ricarica: 3000, colore: '#ffc24b' },
];
const SCONTO = { id: 'sconto', nome: 'Sconto', em: '💸', effetto: [0.4, 0.7, 0.8], testo: x => `potenziamenti scontati del ${Math.round(x * 100)}%` };
export const ABILITA = {
  n: [
    { id: 'veloce', nome: 'Cassa veloce', em: '⚡', effetto: [3, 5, 7], testo: x => `serve i clienti ×${x} più in fretta` },
    { id: 'prezzo', nome: 'Prezzi d\'oro', em: '💶', effetto: [2, 3, 5], testo: x => `ogni cliente paga ×${x}` },
    SCONTO,
  ],
  i: [
    { id: 'arrivi', nome: 'Pienone', em: '🚗', effetto: [2, 3, 4], testo: x => `arriva gente ×${x} più spesso` },
    { id: 'gente', nome: 'Gita organizzata', em: '👨‍👩‍👧', effetto: [2, 3, 5], testo: x => `ogni arrivo porta ×${x} persone` },
    SCONTO,
  ],
};
export const PREZZO_GESTORI = { n: { base: 100, cresce: 3.5 }, i: { base: 150, cresce: 6 } };
export const NOMI_GESTORI = ['Peppe', 'Carmela', 'Totò', 'Nunzia', 'Gennaro', 'Assunta', 'Ciro', 'Filomena', 'Salvatore', 'Rosaria', 'Tonino', 'Concetta', 'Enzo', 'Lucia', 'Pasquale', 'Titina', 'Vincenzo', 'Teresa', 'Gigi', 'Annarella', 'Mimmo', 'Pina', 'Rocco', 'Graziella'];

/** Potenziamenti fino al prossimo rinnovo. tipo: prezzo (tutti i negozi), arrivi (tutti gli ingressi), veloce (servizio). */
export const POTENZIAMENTI = [
  { id: 'p1', nome: 'Insegne luminose', em: '✨', tipo: 'prezzo', molt: 2, costo: 5e3 },
  { id: 'a1', nome: 'Cartelli stradali', em: '🪧', tipo: 'arrivi', molt: 1.5, costo: 2e4 },
  { id: 'v1', nome: 'Registratori di cassa', em: '🧾', tipo: 'veloce', molt: 1.5, costo: 1e5 },
  { id: 'p2', nome: 'Festa del patrono', em: '🎆', tipo: 'prezzo', molt: 2, costo: 2e6 },
  { id: 'a2', nome: 'Pubblicità alla radio', em: '📻', tipo: 'arrivi', molt: 1.5, costo: 1e7 },
  { id: 'v2', nome: 'Pagamento col telefono', em: '📱', tipo: 'veloce', molt: 1.5, costo: 5e8 },
  { id: 'p3', nome: 'Turisti in crociera', em: '🛳️', tipo: 'prezzo', molt: 3, costo: 2e10 },
  { id: 'a3', nome: 'Strada nuova', em: '🛣️', tipo: 'arrivi', molt: 2, costo: 1e11 },
  { id: 'p4', nome: 'Corso pedonale', em: '🚶', tipo: 'prezzo', molt: 3, costo: 5e12 },
  { id: 'v3', nome: 'Casse automatiche', em: '🤖', tipo: 'veloce', molt: 2, costo: 2e13 },
  { id: 'p5', nome: 'Bandiera blu', em: '🏖️', tipo: 'prezzo', molt: 3, costo: 3e15 },
  { id: 'a4', nome: 'Aeroporto vicino', em: '✈️', tipo: 'arrivi', molt: 2, costo: 1e17 },
];

/** Rinnovi del paese: si paga, si riparte da zero e gli incassi restano moltiplicati per sempre. */
export const RINNOVI = [
  { nome: 'Facciate ridipinte', costo: 1e12, molt: 3 },
  { nome: 'Pavimento in pietra', costo: 1e15, molt: 10 },
  { nome: 'Lampioni d\'epoca', costo: 1e18, molt: 25 },
  { nome: 'Giardini pensili', costo: 1e21, molt: 50 },
  { nome: 'Teatro all\'aperto', costo: 1e24, molt: 100 },
  { nome: 'Il paese più bello d\'Italia', costo: 1e27, molt: 200 },
];
