// I numeri del gioco: botteghe sulle terrazze, funicolare, Ape, gestori, lavori sulla scalinata, potenziamenti e rinnovi.
//
// Ogni bottega produce a ogni giro `base × livello` euro di merce (moltiplicati a ogni tappa), divisi tra i suoi commessi.
// La funicolare raccoglie le cassette e le porta al deposito in piazza; le Ape portano la merce al mercato e la vendono.

/** Botteghe, dall'alto (piazza) verso il mare. apri = prezzo per aprirla; su = prezzo del primo potenziamento. */
export const BOTTEGHE = [
  { id: 'granite', nome: 'Chiosco delle granite', em: '🍧', apri: 0, base: 3, su: 10, gestore: 100, muro: '#f7d774', tenda: '#e8503a', cappello: 'coppola', maglia: '#e8503a' },
  { id: 'edicola', nome: 'Edicola', em: '📰', apri: 150, base: 30, su: 150, gestore: 1.5e3, muro: '#f4b9a6', tenda: '#2f7fbf', cappello: 'coppola', maglia: '#2f7fbf' },
  { id: 'bar', nome: 'Bar del corso', em: '☕', apri: 3e3, base: 300, su: 2e3, gestore: 2e4, muro: '#cfe6c4', tenda: '#2e7d4f', cappello: 'nessuno', maglia: '#ffffff' },
  { id: 'gelateria', nome: 'Gelateria', em: '🍦', apri: 5e4, base: 3e3, su: 3e4, gestore: 3e5, muro: '#f9c6d8', tenda: '#d6487e', cappello: 'cuoco', maglia: '#f9c6d8' },
  { id: 'pizzeria', nome: 'Pizzeria', em: '🍕', apri: 8e5, base: 3e4, su: 4.5e5, gestore: 5e6, muro: '#f1e3c8', tenda: '#c0392b', cappello: 'cuoco', maglia: '#ffffff' },
  { id: 'pasticceria', nome: 'Pasticceria', em: '🧁', apri: 1.3e7, base: 3e5, su: 7e6, gestore: 8e7, muro: '#d9c9f0', tenda: '#7d55c7', cappello: 'cuoco', maglia: '#ffffff' },
  { id: 'trattoria', nome: 'Trattoria', em: '🍝', apri: 2e8, base: 3e6, su: 1.1e8, gestore: 1.2e9, muro: '#f6d6a8', tenda: '#2e7d4f', cappello: 'cuoco', maglia: '#ffffff' },
  { id: 'pescheria', nome: 'Pescheria', em: '🐟', apri: 3.2e9, base: 3e7, su: 1.7e9, gestore: 2e10, muro: '#cde7ee', tenda: '#1f6fa8', cappello: 'marinaio', maglia: '#1f6fa8' },
  { id: 'cantina', nome: 'Cantina dei vini', em: '🍷', apri: 5e10, base: 3e8, su: 2.7e10, gestore: 3e11, muro: '#e8cfc0', tenda: '#7b1e3a', cappello: 'coppola', maglia: '#7b1e3a' },
  { id: 'boutique', nome: 'Boutique di sandali', em: '👡', apri: 8e11, base: 3e9, su: 4.3e11, gestore: 5e12, muro: '#fbe3c4', tenda: '#c9822b', cappello: 'nessuno', maglia: '#c9822b' },
  { id: 'hotel', nome: 'Hotel sul mare', em: '🏨', apri: 1.3e13, base: 3e10, su: 7e12, gestore: 8e13, muro: '#bfe3f2', tenda: '#1f6fa8', cappello: 'nessuno', maglia: '#1f3d6b' },
  { id: 'lido', nome: 'Lido', em: '⛱️', apri: 2e14, base: 3e11, su: 1.1e14, gestore: 1.2e15, muro: '#fff1b8', tenda: '#e8503a', cappello: 'marinaio', maglia: '#e8503a' },
  { id: 'cantiere', nome: 'Cantiere navale', em: '⚓', apri: 3.2e15, base: 3e12, su: 1.7e15, gestore: 2e16, muro: '#d8dde3', tenda: '#34495e', cappello: 'marinaio', maglia: '#34495e' },
  { id: 'yacht', nome: 'Yacht club', em: '🛥️', apri: 5e16, base: 3e13, su: 2.7e16, gestore: 3e17, muro: '#e3f1fb', tenda: '#1f3d6b', cappello: 'marinaio', maglia: '#ffffff' },
  { id: 'porto', nome: 'Porto turistico', em: '⛵', apri: 8e17, base: 3e14, su: 4.3e17, gestore: 5e18, muro: '#f2f2ee', tenda: '#1f6fa8', cappello: 'marinaio', maglia: '#1f3d6b' },
];
/** Quanto aumenta il prezzo del potenziamento di una bottega a ogni livello. */
export const CRESCE_BOTTEGA = 1.13;
/** A questi livelli la bottega fa un salto di produzione (×2). */
export const TAPPE = [10, 25, 50, 100, 200, 300, 400, 500, 600, 700, 800];
/** A questi livelli la bottega assume un commesso in più (massimo 6 commessi). */
export const COMMESSI = [10, 50, 100, 200, 400];
/** I gestori si possono assumere quando il chiosco delle granite arriva a questo livello. */
export const LIVELLO_GESTORI = 5;
/** Secondi di un giro del commesso: lavora al bancone, porta la merce alla cassetta, rientra. */
export const GIRO = { lavora: 2.2, porta: 1.4, rientra: 1.4 };
/** Lavori sulla scalinata: prima della bottega con questo indice bisogna aspettare (secondi). */
export const LAVORI = { 5: 15 * 60, 10: 2 * 3600 };

/** Funicolare: capienza e velocità crescono con il livello. */
export const FUNICOLARE = { cap: 25, capCresce: 1.2, su: 60, cresce: 1.18, gestore: 150, perTerrazza: 0.6, carico: 0.4, velocitaPerLivello: 0.01, velocitaMax: 2 };
/** Ape: capienza per livello; il numero di Ape cresce ai livelli `nuoveApe` (massimo 5). */
export const APE = { cap: 30, capCresce: 1.2, su: 50, cresce: 1.18, gestore: 120, viaggio: 3, carico: 0.6, nuoveApe: [10, 50, 100, 200] };

/** Gradi dei gestori: probabilità di uscire, durata dell'abilità e ricarica (secondi). */
export const GRADI = [
  { nome: 'Apprendista', prob: 0.65, durata: 60, ricarica: 300, colore: '#8fd3a5' },
  { nome: 'Esperto', prob: 0.27, durata: 180, ricarica: 900, colore: '#7fb5ff' },
  { nome: 'Maestro', prob: 0.08, durata: 600, ricarica: 3000, colore: '#ffc24b' },
];
/** Abilità dei gestori per tipo di posto, con l'effetto per ogni grado. */
export const ABILITA = {
  b: [
    { id: 'veloce', nome: 'Turbo', em: '⚡', effetto: [3, 5, 7], testo: x => `commessi ×${x} più veloci` },
    { id: 'sconto', nome: 'Sconto', em: '💸', effetto: [0.4, 0.7, 0.8], testo: x => `potenziamenti −${Math.round(x * 100)}%` },
  ],
  f: [
    { id: 'veloce', nome: 'Turbo', em: '⚡', effetto: [2, 4, 6], testo: x => `funicolare ×${x} più veloce` },
    { id: 'carico', nome: 'Carico', em: '📦', effetto: [3, 5, 7], testo: x => `porta ×${x} merce` },
    { id: 'sconto', nome: 'Sconto', em: '💸', effetto: [0.4, 0.7, 0.8], testo: x => `potenziamenti −${Math.round(x * 100)}%` },
  ],
  a: [
    { id: 'veloce', nome: 'Turbo', em: '⚡', effetto: [3, 5, 7], testo: x => `Ape ×${x} più veloci` },
    { id: 'carico', nome: 'Carico', em: '📦', effetto: [3, 5, 8], testo: x => `portano ×${x} merce` },
    { id: 'sconto', nome: 'Sconto', em: '💸', effetto: [0.4, 0.7, 0.8], testo: x => `potenziamenti −${Math.round(x * 100)}%` },
  ],
};
/** Ad app chiusa i gestori incassano questa frazione del ritmo normale. */
export const QUOTA_ASSENZA = 0.5;

/** Potenziamenti che durano fino al prossimo rinnovo. tipo: produzione di tutte le botteghe, velocità di funicolare o Ape. */
export const POTENZIAMENTI = [
  { id: 'funi-1', nome: 'Funicolare elettrica', em: '🚡', tipo: 'funi', molt: 1.5, costo: 5e3 },
  { id: 'ape-1', nome: 'Ape con il turbo', em: '🛺', tipo: 'ape', molt: 1.5, costo: 5e3 },
  { id: 'tutti-1', nome: 'Luminarie sul corso', em: '✨', tipo: 'prod', molt: 2, costo: 2e5 },
  { id: 'funi-2', nome: 'Binari nuovi', em: '🚡', tipo: 'funi', molt: 1.5, costo: 3e6 },
  { id: 'ape-2', nome: 'Ape Calessino', em: '🛺', tipo: 'ape', molt: 1.5, costo: 3e6 },
  { id: 'tutti-2', nome: 'Festa del patrono', em: '🎆', tipo: 'prod', molt: 2, costo: 5e7 },
  { id: 'tutti-3', nome: 'Turisti in crociera', em: '🛳️', tipo: 'prod', molt: 3, costo: 2e10 },
  { id: 'funi-3', nome: 'Doppia cabina', em: '🚡', tipo: 'funi', molt: 2, costo: 5e10 },
  { id: 'ape-3', nome: 'Strade nuove', em: '🛺', tipo: 'ape', molt: 2, costo: 5e10 },
  { id: 'tutti-4', nome: 'Corso pedonale', em: '🚶', tipo: 'prod', molt: 3, costo: 8e12 },
  { id: 'tutti-5', nome: 'Bandiera blu', em: '🏖️', tipo: 'prod', molt: 3, costo: 3e15 },
  { id: 'tutti-6', nome: 'Patrimonio UNESCO', em: '🏛️', tipo: 'prod', molt: 3, costo: 1e18 },
];

/** Rinnovi del corso: si paga, si riparte da zero e la produzione resta moltiplicata per sempre. */
export const RINNOVI = [
  { nome: 'Facciate ridipinte', costo: 1e12, molt: 3 },
  { nome: 'Pavimento in pietra', costo: 1e15, molt: 10 },
  { nome: 'Lampioni d\'epoca', costo: 1e18, molt: 25 },
  { nome: 'Giardini pensili', costo: 1e21, molt: 50 },
  { nome: 'Teatro all\'aperto', costo: 1e24, molt: 100 },
  { nome: 'Il corso più bello d\'Italia', costo: 1e27, molt: 200 },
];
