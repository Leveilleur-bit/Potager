/* ============================================================
   Le plan « vrai jardin » : bordures des bacs, gazon, maison,
   orientation. Tout est dessiné en SVG dans dessinerPlan().
   ============================================================ */

const BORDURES = {
  "bois": "Bois naturel",
  "bois-noir": "Bois noir (brûlé)",
  "pierre-seche": "Pierre sèche",
  "parpaing": "Parpaings",
  "blocs": "Blocs de pierre"
};
const COTES_MAISON = {
  aucune: "Pas de maison", "haut-gauche": "En haut à gauche", haut: "En haut", "haut-droite": "En haut à droite",
  "bas-gauche": "En bas à gauche", bas: "En bas", "bas-droite": "En bas à droite", gauche: "À gauche", droite: "À droite"
};
const DIRECTIONS_SUD = { haut: "En haut", bas: "En bas", gauche: "À gauche", droite: "À droite" };

function reglagesJardin() {
  const j = (etat.reglages && etat.reglages.jardin) || {};
  return {
    sud: DIRECTIONS_SUD[j.sud] ? j.sud : null,
    maison: COTES_MAISON[j.maison] ? j.maison : "aucune",
    croquis: j.croquis || null
  };
}
function bordureDe(parcelle) { return BORDURES[parcelle.bordure] ? parcelle.bordure : "bois"; }

// Motifs SVG (bordures, gazon). Les identifiants sont propres à chaque dessin.
function motifsJardin(prefixe) {
  const pat = (id, w, h, contenu, extra = "") => `<pattern id="${prefixe}${id}" width="${w}" height="${h}" patternUnits="userSpaceOnUse"${extra}>${contenu}</pattern>`;
  return pat("gazon", 24, 24, `<rect width="24" height="24" fill="#7eae5c"/><path d="M3 20 l2 -6 M9 23 l1 -7 M15 18 l2 -6 M20 24 l1 -6 M6 9 l1 -6 M13 10 l2 -7 M19 8 l1 -6" stroke="#6b9a4b" stroke-width="1.6" stroke-linecap="round"/><path d="M1 13 l1 -4 M11 4 l1 -4 M22 15 l1 -4" stroke="#93c06f" stroke-width="1.4" stroke-linecap="round"/>`)
    + pat("bois", 30, 12, `<rect width="30" height="12" fill="#8b6f4e"/><path d="M0 6 Q8 4 15 6 T30 6" stroke="#7a5f40" stroke-width="1.2" fill="none"/><path d="M0 11.5 H30" stroke="#6e5539" stroke-width="1"/>`)
    + pat("bois-noir", 30, 12, `<rect width="30" height="12" fill="#2b2622"/><path d="M0 6 Q8 4.5 15 6 T30 6" stroke="#3e3631" stroke-width="1.4" fill="none"/><path d="M0 11.5 H30" stroke="#16130f" stroke-width="1.2"/><circle cx="22" cy="3" r="1" fill="#4a403a"/>`)
    + pat("pierre-seche", 44, 28, `<rect width="44" height="28" fill="#8a7a5c"/><rect x="1" y="1" width="20" height="12" rx="4" fill="#d9c8a0"/><rect x="23" y="1" width="20" height="12" rx="5" fill="#cbb88f"/><rect x="-10" y="15" width="20" height="12" rx="5" fill="#e3d4ae"/><rect x="12" y="15" width="21" height="12" rx="4" fill="#d4c398"/><rect x="35" y="15" width="20" height="12" rx="5" fill="#e3d4ae"/>`)
    + pat("parpaing", 40, 20, `<rect width="40" height="20" fill="#9c9c96"/><rect x="1" y="1" width="38" height="18" rx="1.5" fill="#d3d3ce"/><rect x="7" y="6" width="9" height="8" rx="2" fill="#b4b4ae"/><rect x="24" y="6" width="9" height="8" rx="2" fill="#b4b4ae"/>`)
    + pat("blocs", 48, 24, `<rect width="48" height="24" fill="#8f8b80"/><rect x="1" y="1" width="30" height="10" rx="2" fill="#cfc8b6"/><rect x="33" y="1" width="14" height="10" rx="2" fill="#c3bba7"/><rect x="1" y="13" width="14" height="10" rx="2" fill="#c3bba7"/><rect x="17" y="13" width="30" height="10" rx="2" fill="#d7d0bf"/>`)
    + pat("ardoise", 18, 12, `<rect width="18" height="12" fill="#5d6873"/><path d="M0 11.5 H18 M9 0 V6 M0 6 H18 M4 6 V12 M13 6 V12" stroke="#4a545e" stroke-width="1"/>`);
}

// Marges à ajouter autour des parcelles pour la maison (en mètres)
function margesMaison(maison) {
  const m = { haut: 0, bas: 0, gauche: 0, droite: 0 };
  if (maison.startsWith("haut")) m.haut = 3;
  else if (maison.startsWith("bas")) m.bas = 3;
  else if (maison === "gauche") m.gauche = 3.5;
  else if (maison === "droite") m.droite = 3.5;
  return m;
}

// Dessin de la maison (vue de dessus : toit d'ardoise) dans la zone de marge
function maisonSVG(maison, prefixe, zone) {
  const { x0, y0, x1, y1 } = zone; // limites du jardin, en unités SVG
  let x, y, w, h;
  const L = Math.min(5 * U, x1 - x0), P = 2.2 * U;
  if (maison.startsWith("haut") || maison.startsWith("bas")) {
    w = maison === "haut" || maison === "bas" ? Math.min(6 * U, x1 - x0) : L; h = P;
    x = maison.endsWith("gauche") ? x0 : maison.endsWith("droite") ? x1 - w : (x0 + x1 - w) / 2;
    y = maison.startsWith("haut") ? y0 - P - 0.5 * U : y1 + 0.5 * U;
  } else {
    w = P; h = Math.min(6 * U, y1 - y0);
    x = maison === "gauche" ? x0 - P - 0.5 * U : x1 + 0.5 * U;
    y = (y0 + y1 - h) / 2;
  }
  const horizontal = w >= h;
  const faitage = horizontal ? `M${x + 10} ${y + h / 2} H${x + w - 10}` : `M${x + w / 2} ${y + 10} V${y + h - 10}`;
  return `<g class="plan-maison"><rect x="${x + 6}" y="${y + 8}" width="${w}" height="${h}" rx="6" fill="#000" opacity=".15"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="url(#${prefixe}ardoise)"/>
    <path d="${faitage}" stroke="#3a434c" stroke-width="7" stroke-linecap="round"/>
    <text x="${x + w / 2}" y="${y + h / 2 + (horizontal ? 34 : 0)}" class="plan-maison-nom">Maison</text></g>`;
}

// Petite rose des vents : indique où est le sud
function boussoleSVG(sud, x, y) {
  const angle = { haut: 0, droite: 90, bas: 180, gauche: 270 }[sud];
  return `<g class="plan-boussole" transform="translate(${x} ${y})">
    <circle r="34" fill="#fffdf6" opacity=".88"/>
    <g transform="rotate(${angle})"><path d="M0 -26 L8 0 L0 -5 L-8 0Z" fill="#d9480f"/><path d="M0 26 L8 0 L0 5 L-8 0Z" fill="#6b7a86"/>
      <text y="-30" class="plan-boussole-l">S</text><text y="44" class="plan-boussole-l">N</text></g></g>`;
}

/* ---------- Réglages du jardin (orientation, maison, bordures) ---------- */

function ouvrirReglagesJardin() {
  const j = reglagesJardin();
  ouvrirFenetre(`
    <h2>Mon jardin</h2>
    <p class="texte-doux petit">Pour que le plan ressemble à ton jardin : où est le sud, où est la maison, et en quoi sont faits tes bacs.</p>
    <h3 class="sous-titre-section">Le sud est…</h3>
    <div class="chips">${Object.entries(DIRECTIONS_SUD).map(([k, l]) => `<button class="chip${j.sud === k ? " actif" : ""}" data-sud="${k}">${l}</button>`).join("")}</div>
    <h3 class="sous-titre-section">La maison est…</h3>
    <div class="chips">${Object.entries(COTES_MAISON).map(([k, l]) => `<button class="chip${j.maison === k ? " actif" : ""}" data-maison="${k}">${l}</button>`).join("")}</div>
    <h3 class="sous-titre-section">Bordure des bacs</h3>
    ${etat.parcelles.map(p => `<div class="ligne-bordure"><label for="bd-${p.id}">${esc(p.nom)}</label>
      <select id="bd-${p.id}" data-bordure="${p.id}">${Object.entries(BORDURES).map(([k, l]) => `<option value="${k}"${bordureDe(p) === k ? " selected" : ""}>${l}</option>`).join("")}</select></div>`).join("")}
    <div class="actions-fenetre"><button class="btn" id="rj-ok">Terminé</button></div>`, fen => {
    const changer = fn => { fn(); sauvegarder(); rendre(); ouvrirReglagesJardin(); };
    const jardin = () => (etat.reglages.jardin = Object.assign({}, etat.reglages.jardin || {}));
    fen.querySelectorAll("[data-sud]").forEach(b => b.addEventListener("click", () => changer(() => { jardin().sud = b.dataset.sud; })));
    fen.querySelectorAll("[data-maison]").forEach(b => b.addEventListener("click", () => changer(() => { jardin().maison = b.dataset.maison; })));
    fen.querySelectorAll("[data-bordure]").forEach(s => s.addEventListener("change", () => changer(() => {
      const p = etat.parcelles.find(x => x.id === s.dataset.bordure); if (p) p.bordure = s.value;
    })));
    fen.querySelector("#rj-ok").addEventListener("click", fermerFenetre);
  });
}

/* ---------- Disposition du croquis envoyé (propre à ce potager) ---------- */

// Retrouve les 4 parcelles du croquis par leur nom et leurs dimensions
function parcellesDuCroquis() {
  const trouver = (re, l, h) => etat.parcelles.find(p => re.test(p.nom) && p.largeur === l && p.hauteur === h);
  const r = {
    haute: trouver(/haute/i, 7, 1), mediane: trouver(/m[ée]diane/i, 5, 1),
    retour: trouver(/retour/i, 1, 3), basse: trouver(/basse/i, 5, 1)
  };
  return Object.values(r).every(Boolean) ? r : null;
}
function croquisDisponible() {
  return reglagesJardin().croquis === null && !!parcellesDuCroquis();
}
function appliquerCroquis() {
  const r = parcellesDuCroquis();
  if (!r) return;
  avecAnnulation("Le plan suit maintenant ton croquis.", () => {
    Object.assign(r.haute, { posX: 0, posY: 0, bordure: "bois-noir" });
    Object.assign(r.mediane, { posX: 0.5, posY: 1.5, bordure: "pierre-seche" });
    Object.assign(r.retour, { posX: 6, posY: 1, bordure: "blocs" });
    Object.assign(r.basse, { posX: 1, posY: 3, bordure: "parpaing" });
    etat.reglages.jardin = Object.assign({}, etat.reglages.jardin || {}, { sud: "haut", maison: "bas-gauche", croquis: "applique" });
    normaliserPositions();
  });
}
function refuserCroquis() {
  etat.reglages.jardin = Object.assign({}, etat.reglages.jardin || {}, { croquis: "refuse" });
  sauvegarder();
  rendre();
}
