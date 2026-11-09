// Disegni del gioco in SVG: personaggi, funicolare, Ape, deposito, mercato, alberi e barche.

const PELLE = '#f2c79a';
/** Un commesso visto di lato. cappello: coppola | cuoco | marinaio | nessuno. Le gambe si muovono con la classe .cammina. */
export function omino(maglia, cappello, grembiule = '#ffffff') {
  const testa = {
    coppola: '<path d="M8 9 Q15 2 22 9 L24 10 L8 10 Z" fill="#4a3426"/>',
    cuoco: '<rect x="9" y="0" width="12" height="7" rx="3" fill="#fff" stroke="#ddd"/><rect x="8" y="6" width="14" height="3" fill="#fff" stroke="#ddd"/>',
    marinaio: '<path d="M8 9 Q15 3 22 9 Z" fill="#fff"/><rect x="8" y="8" width="14" height="2" fill="#1f3d6b"/>',
    nessuno: '<path d="M8 11 Q9 4 15 4 Q21 4 22 11 Q19 7 15 7 Q11 7 8 11 Z" fill="#5a3b25"/>',
  }[cappello] ?? '';
  return `<svg class="omino" viewBox="0 0 30 46" aria-hidden="true">
    <g class="gamba gs"><rect x="11" y="31" width="4" height="12" rx="2" fill="#2b2b3a"/><rect x="10" y="41" width="7" height="3" rx="1.5" fill="#222"/></g>
    <g class="gamba gd"><rect x="16" y="31" width="4" height="12" rx="2" fill="#38384a"/><rect x="15" y="41" width="7" height="3" rx="1.5" fill="#222"/></g>
    <rect x="8" y="18" width="15" height="16" rx="5" fill="${maglia}" stroke="#0002"/>
    <rect x="10" y="22" width="11" height="12" rx="2" fill="${grembiule}" opacity=".9"/>
    <rect class="braccio" x="19" y="20" width="4" height="11" rx="2" fill="${PELLE}"/>
    <circle cx="15" cy="12" r="7" fill="${PELLE}"/>
    <circle cx="18" cy="11" r="1" fill="#2b1a10"/><path d="M17 15 Q19 16 20 14" stroke="#a0522d" stroke-width="1" fill="none"/>
    ${testa}
    <g class="cassa"><rect x="18" y="20" width="12" height="9" rx="1.5" fill="#c98b4a" stroke="#8a5a2b"/><circle cx="22" cy="23" r="1.6" fill="#ffd23f"/><circle cx="26" cy="25" r="1.6" fill="#ffd23f"/></g>
  </svg>`;
}

export const cabina = () => `<svg class="cabina" viewBox="0 0 44 52" aria-hidden="true">
  <rect x="20" y="0" width="4" height="8" fill="#555"/>
  <rect x="3" y="7" width="38" height="40" rx="7" fill="#d9412b" stroke="#8c2416" stroke-width="2"/>
  <rect x="8" y="12" width="12" height="12" rx="2" fill="#bfe3f2"/><rect x="24" y="12" width="12" height="12" rx="2" fill="#bfe3f2"/>
  <rect x="3" y="30" width="38" height="4" fill="#f7d774"/>
  <circle cx="12" cy="48" r="3" fill="#333"/><circle cx="32" cy="48" r="3" fill="#333"/>
</svg>`;

export const ape = () => `<svg class="ape" viewBox="0 0 80 52" aria-hidden="true">
  <rect x="2" y="14" width="40" height="26" rx="3" fill="#c98b4a" stroke="#8a5a2b" stroke-width="2"/>
  <g class="merce"><circle cx="12" cy="13" r="5" fill="#ffd23f"/><circle cx="22" cy="11" r="5" fill="#ffb347"/><circle cx="32" cy="13" r="5" fill="#ffd23f"/></g>
  <path d="M42 40 L42 12 Q42 6 50 6 L62 6 Q72 6 74 18 L76 40 Z" fill="#3ea86b" stroke="#22704a" stroke-width="2"/>
  <path d="M52 10 L62 10 Q69 10 70 20 L52 20 Z" fill="#bfe3f2"/>
  <circle class="ruota" cx="16" cy="42" r="7" fill="#2b2b2b"/><circle cx="16" cy="42" r="3" fill="#888"/>
  <circle class="ruota" cx="64" cy="42" r="7" fill="#2b2b2b"/><circle cx="64" cy="42" r="3" fill="#888"/>
</svg>`;

export const deposito = () => `<svg class="deposito" viewBox="0 0 110 96" aria-hidden="true">
  <path d="M4 34 L55 6 L106 34 Z" fill="#b5523b"/>
  <rect x="10" y="32" width="90" height="62" fill="#f1e3c8" stroke="#c9b48e" stroke-width="2"/>
  <rect x="34" y="52" width="42" height="42" rx="3" fill="#8a5a2b"/>
  <path d="M34 60 H76 M34 70 H76 M34 80 H76" stroke="#6d4520" stroke-width="2"/>
  <rect x="22" y="38" width="66" height="11" rx="2" fill="#fff"/><text x="55" y="46.5" font-size="8" font-weight="800" text-anchor="middle" fill="#8a5a2b" font-family="system-ui">DEPOSITO</text>
</svg>`;

export const mercato = () => `<svg class="mercato" viewBox="0 0 110 96" aria-hidden="true">
  <rect x="12" y="30" width="5" height="62" fill="#8a5a2b"/><rect x="93" y="30" width="5" height="62" fill="#8a5a2b"/>
  ${[0, 1, 2, 3, 4].map(k => `<path d="M${6 + k * 20} 20 h20 v14 a10 10 0 0 1 -20 0 Z" fill="${k % 2 ? '#fff4e2' : '#2f7fbf'}"/>`).join('')}
  <rect x="6" y="12" width="100" height="10" rx="2" fill="#2f7fbf"/>
  <text x="56" y="20" font-size="8" font-weight="800" text-anchor="middle" fill="#fff" font-family="system-ui">MERCATO</text>
  <rect x="8" y="64" width="94" height="28" rx="3" fill="#c98b4a" stroke="#8a5a2b" stroke-width="2"/>
  <circle cx="26" cy="62" r="7" fill="#ffd23f"/><circle cx="40" cy="60" r="7" fill="#ff8c42"/><circle cx="56" cy="62" r="7" fill="#7ac74f"/><circle cx="72" cy="60" r="7" fill="#e8503a"/><circle cx="86" cy="62" r="7" fill="#ffd23f"/>
</svg>`;

export const limone = (x, s = 1) => `<svg class="albero" style="left:${x}px;transform:scale(${s})" viewBox="0 0 40 50" aria-hidden="true">
  <rect x="18" y="30" width="4" height="18" fill="#7a4e2a"/>
  <circle cx="20" cy="20" r="16" fill="#3d8b3d"/><circle cx="12" cy="18" r="3" fill="#ffd23f"/><circle cx="26" cy="14" r="3" fill="#ffd23f"/><circle cx="22" cy="26" r="3" fill="#ffd23f"/>
</svg>`;
