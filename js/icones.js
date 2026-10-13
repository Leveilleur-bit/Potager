/* ============================================================
   Icônes dessinées des plantes (SVG, style homogène et lisible).
   Chaque icône tient dans un carré de 48 × 48.
   ============================================================ */

const COUL = {
  v1: "#2f6b3a", v2: "#4e8a3e", v3: "#6fae4f", v4: "#9ccc65", v5: "#c8e3a3",
  rouge: "#dc4436", rouge2: "#b9302a", orange: "#ef8a2c", jaune: "#f4c430", jaune2: "#e0a100",
  violet: "#7b4fa8", lavande: "#9a7fdc", rose: "#ea7aa0", creme: "#f4eedd", brun: "#8b5a2b", bleu: "#4f7fd6"
};

const ombreSol = (cx = 24, rx = 14) => `<ellipse cx="${cx}" cy="44" rx="${rx}" ry="2.6" fill="#000" opacity=".13"/>`;
const reflet = (cx, cy, r) => `<ellipse cx="${(cx - r * 0.35).toFixed(1)}" cy="${(cy - r * 0.4).toFixed(1)}" rx="${(r * 0.3).toFixed(1)}" ry="${(r * 0.2).toFixed(1)}" fill="#fff" opacity=".42"/>`;
const rond = (cx, cy, r, c, brillant = true) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${c}"/>` + (brillant ? reflet(cx, cy, r) : "");
const trait = (d, c, w = 2) => `<path d="${d}" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;

// Feuille en amande : base en (x, y), longueur l, demi-largeur w, angle a (0 = vers le haut)
function feuille(x, y, l, w, a, c, nervure = true) {
  return `<g transform="translate(${x} ${y}) rotate(${a})"><path d="M0 0 C${w} ${-l * 0.3} ${w * 0.8} ${-l * 0.8} 0 ${-l} C${-w * 0.8} ${-l * 0.8} ${-w} ${-l * 0.3} 0 0Z" fill="${c}"/>`
    + (nervure ? `<path d="M0 -1 L0 ${-l * 0.82}" stroke="#fff" stroke-opacity=".35" stroke-width="1" fill="none"/>` : "") + `</g>`;
}
// Fleur à n pétales
function fleur(cx, cy, r, n, cp, cc, largeur = 0.42, coeur = 0.32) {
  let s = "";
  for (let i = 0; i < n; i++) s += `<ellipse cx="${cx}" cy="${cy - r * 0.55}" rx="${r * largeur}" ry="${r * 0.55}" fill="${cp}" transform="rotate(${(360 / n) * i} ${cx} ${cy})"/>`;
  return s + `<circle cx="${cx}" cy="${cy}" r="${r * coeur}" fill="${cc}"/>`;
}
// Calice étoilé (tomate, fraise)
function calice(cx, cy, r, c) {
  let s = "";
  for (let i = 0; i < 5; i++) s += feuille(cx, cy, r, r * 0.32, i * 72, c, false);
  return s;
}
// Touffe de brins
function touffe(cx, base, n, h, c, ecart = 10, w = 2) {
  let s = "";
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1) - 0.5;
    s += trait(`M${cx + t * 3} ${base} Q${cx + t * ecart * 0.8} ${base - h * 0.6} ${cx + t * ecart * 2} ${base - h + Math.abs(t) * h * 0.4}`, c, w);
  }
  return s;
}
// Épi de petites fleurs le long d'une tige
function epi(x, y, h, a, c, tige = COUL.v3) {
  let s = `<g transform="translate(${x} ${y}) rotate(${a})">` + trait(`M0 0 L0 ${-h}`, tige, 1.6);
  for (let k = 0; k < 6; k++) { const yy = -h + k * 2.6; s += `<ellipse cx="-1.4" cy="${yy}" rx="1.8" ry="1.5" fill="${c}"/><ellipse cx="1.4" cy="${yy + 1.2}" rx="1.8" ry="1.5" fill="${c}"/>`; }
  return s + `</g>`;
}
// Brin couvert de petites feuilles (thym, romarin, sarriette)
function brin(x, y, h, a, cTige, cFeuille, taille = 2.2, serre = 3) {
  let s = `<g transform="translate(${x} ${y}) rotate(${a})">` + trait(`M0 0 L0 ${-h}`, cTige, 1.5);
  for (let yy = -4; yy > -h; yy -= serre) s += `<ellipse cx="${-taille}" cy="${yy}" rx="${taille}" ry="${taille * 0.55}" fill="${cFeuille}" transform="rotate(-25 ${-taille} ${yy})"/><ellipse cx="${taille}" cy="${yy - 1}" rx="${taille}" ry="${taille * 0.55}" fill="${cFeuille}" transform="rotate(25 ${taille} ${yy - 1})"/>`;
  return s + `</g>`;
}
// Bulbe (oignon, ail, échalote)
function bulbe(cx, base, r, c, raies) {
  const h = r * 2.5;
  return `<path d="M${cx} ${base - h} C${cx + r * 0.5} ${base - h + r * 0.8} ${cx + r} ${base - r * 1.4} ${cx + r} ${base - r * 0.8} C${cx + r} ${base - r * 0.1} ${cx + r * 0.5} ${base} ${cx} ${base} C${cx - r * 0.5} ${base} ${cx - r} ${base - r * 0.1} ${cx - r} ${base - r * 0.8} C${cx - r} ${base - r * 1.4} ${cx - r * 0.5} ${base - h + r * 0.8} ${cx} ${base - h}Z" fill="${c}"/>`
    + (raies ? trait(`M${cx - r * 0.45} ${base - r * 1.5} Q${cx - r * 0.6} ${base - r * 0.6} ${cx - r * 0.3} ${base - r * 0.15}`, raies, 1) + trait(`M${cx + r * 0.45} ${base - r * 1.5} Q${cx + r * 0.6} ${base - r * 0.6} ${cx + r * 0.3} ${base - r * 0.15}`, raies, 1) : "")
    + reflet(cx, base - r * 0.9, r * 0.8);
}

const DESSINS = {
  "tomate": () => ombreSol() + rond(19, 29, 11, COUL.rouge) + rond(33, 33, 8, "#e65a3f") + calice(19, 19.5, 6, COUL.v2) + calice(33, 26, 4.5, COUL.v2) + trait("M19 19 L18 14", COUL.v2, 2),
  "courgette": () => `<g transform="rotate(-38 24 26)"><rect x="6" y="20" width="32" height="11" rx="5.5" fill="#3d7a2c"/><rect x="9" y="22" width="26" height="2.4" rx="1.2" fill="#fff" opacity=".28"/><rect x="37" y="22.5" width="5" height="6" rx="1.8" fill="#7a9a3a"/></g>` + fleur(11, 36, 9, 5, COUL.jaune, COUL.orange, 0.5),
  "salade": () => ombreSol() + feuille(24, 40, 22, 10, -55, COUL.v3) + feuille(24, 40, 22, 10, 55, COUL.v3) + feuille(24, 40, 25, 10, -25, "#86c25a") + feuille(24, 40, 25, 10, 25, "#86c25a") + feuille(24, 40, 22, 9, 0, COUL.v5),
  "carotte": () => touffe(24, 17, 5, 13, COUL.v3, 6, 2.4) + `<path d="M16.5 16 L31.5 16 L25.2 43.5 Q24 45.5 22.8 43.5Z" fill="${COUL.orange}"/>` + trait("M19 22 L22 22.5 M27 28 L29.5 27.5 M21 33 L23.5 33.4", "#c9661a", 1.2) + `<path d="M18 16 L24 16 L23 24Z" fill="#fff" opacity=".2"/>`,
  "poireau": () => feuille(24, 21, 19, 4.5, -28, COUL.v2) + feuille(24, 21, 21, 4.5, 18, COUL.v1) + feuille(24, 21, 17, 4, -6, COUL.v3) + `<rect x="20" y="19" width="8" height="10" rx="2" fill="#cfe3a8"/><rect x="20" y="26" width="8" height="15" rx="3.5" fill="#f3efe2"/>` + trait("M21 41 L19 45 M24 41 L24 45.5 M27 41 L29 45", "#b9a88a", 1.1),
  "pomme-de-terre": () => ombreSol() + `<ellipse cx="21" cy="29" rx="13" ry="10" fill="#cfa064"/><ellipse cx="33" cy="35" rx="9" ry="7" fill="#bb8a4f"/>` + rond(18, 26, 1.3, "#8b5a2b", false) + rond(25, 31, 1.2, "#8b5a2b", false) + rond(15, 32, 1, "#8b5a2b", false) + rond(35, 33, 1.1, "#7a4b22", false) + reflet(21, 29, 11),
  "haricot-vert": () => trait("M15 9 Q9 25 17 41", COUL.v3, 5) + trait("M25 7 Q20 25 26 43", COUL.v2, 5) + trait("M35 9 Q31 25 35 40", COUL.v3, 5),
  "petit-pois": () => `<path d="M6 31 Q22 12 42 21 Q28 37 6 31Z" fill="${COUL.v2}"/><path d="M9 30 Q24 17 39 22 Q28 33 9 30Z" fill="#cde7a0"/>` + rond(16, 27.5, 3.6, COUL.v3) + rond(23.5, 25, 3.8, COUL.v3) + rond(31, 23.6, 3.6, COUL.v3) + trait("M42 21 Q45 16 43 12", COUL.v2, 1.6),
  "feve": () => `<path d="M10 38 Q8 18 24 9 Q30 7 31 12 Q22 22 20 40 Q16 44 10 38Z" fill="${COUL.v2}"/>` + `<ellipse cx="16.5" cy="31" rx="3" ry="4.2" fill="#a9d27a"/><ellipse cx="19" cy="22" rx="3" ry="4" fill="#a9d27a" transform="rotate(25 19 22)"/><ellipse cx="25" cy="14.5" rx="2.6" ry="3.4" fill="#a9d27a" transform="rotate(50 25 14.5)"/>` + fleur(35, 31, 8, 5, "#f7f3ea", "#2b2b2b", 0.45, 0.28),
  "epinard": () => ombreSol() + feuille(24, 41, 26, 11, -38, COUL.v1) + feuille(24, 41, 26, 11, 38, COUL.v1) + feuille(24, 41, 29, 11, 0, COUL.v2),
  "chou": () => ombreSol() + feuille(24, 40, 18, 11, -62, "#5f8f6a") + feuille(24, 40, 18, 11, 62, "#5f8f6a") + rond(24, 28, 12.5, "#86b98a") + trait("M24 16 Q18 26 22 39 M24 16 Q31 25 27 39 M14 25 Q22 28 34 25", "#6a9f73", 1.3),
  "chou-fleur": () => ombreSol() + feuille(24, 40, 19, 10, -58, COUL.v2) + feuille(24, 40, 19, 10, 58, COUL.v2) + feuille(24, 40, 16, 9, -25, COUL.v3) + feuille(24, 40, 16, 9, 25, COUL.v3)
    + [[24, 23, 6], [17, 26, 5], [31, 26, 5], [20, 19, 4.5], [28, 19, 4.5], [24, 29, 5]].map(([x, y, r]) => rond(x, y, r, "#f5efda", false)).join("") + reflet(22, 22, 8),
  "radis": () => feuille(24, 25, 14, 5.5, -32, COUL.v3) + feuille(24, 25, 15, 5.5, 26, COUL.v2) + feuille(24, 25, 13, 4.5, 0, COUL.v4) + rond(24, 32, 9, "#e2435f") + `<path d="M21 39 L24 46.5 L27 39Z" fill="#f4efe2"/>`,
  "betterave": () => trait("M24 24 L18 12 M24 24 L24 9 M24 24 L30 12", "#a8204b", 1.8) + feuille(18, 13, 9, 4.5, -25, COUL.v2) + feuille(24, 10, 9, 4.5, 0, COUL.v1) + feuille(30, 13, 9, 4.5, 25, COUL.v2) + rond(24, 32, 10, "#8e1f4f") + `<path d="M21.5 40 L24 47 L26.5 40Z" fill="#8e1f4f"/>`,
  "navet": () => touffe(24, 22, 4, 12, COUL.v3, 6, 2.6) + rond(24, 32, 10, "#f3efe2", false) + `<path d="M14 31 A10 10 0 0 1 34 31 Q24 28 14 31Z" fill="#9b5fb0"/>` + reflet(24, 32, 9) + `<path d="M22 41 L24 46 L26 41Z" fill="#f3efe2"/>`,
  "oignon": () => ombreSol(24, 11) + trait("M24 13 L22 6 M24 13 L27 7", COUL.v3, 1.8) + bulbe(24, 43, 11, "#d9973a", "#b8752a"),
  "ail": () => ombreSol(24, 11) + trait("M24 13 L24 6", COUL.v4, 2) + bulbe(24, 43, 11, "#f1eadb", "#cfc3a5") + trait("M24 20 L24 42", "#d9cfb4", 1),
  "echalote": () => ombreSol(24, 15) + bulbe(18, 43, 8, "#b8644a", "#94482f") + bulbe(30, 43, 8.5, "#c97758", "#a1553a") + trait("M18 23 L17 17 M30 22 L31 16", COUL.v3, 1.6),
  "poivron": () => ombreSol() + `<path d="M13 21 Q13 14 19.5 15 Q24 12.5 28.5 15 Q35 14 35 21 L33.5 35 Q31 43 24 42.5 Q17 43 14.5 35Z" fill="${COUL.rouge}"/>` + trait("M24 16 L24 40", "#b62d24", 1.3) + `<path d="M21 15 Q24 11 27 15Z" fill="${COUL.v2}"/>` + trait("M24 13 Q25 8 28 7", COUL.v2, 2.2) + reflet(19, 24, 7),
  "concombre": () => `<g transform="rotate(32 24 24)"><rect x="5" y="18" width="38" height="12" rx="6" fill="#2f6b2a"/><rect x="8" y="20" width="31" height="2.4" rx="1.2" fill="#fff" opacity=".22"/></g>` + [[13, 15], [20, 20], [27, 25], [34, 30], [16, 23], [30, 33]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1" fill="#cfe6a8"/>`).join(""),
  "courge": () => ombreSol(24, 17) + `<ellipse cx="24" cy="31" rx="17" ry="12" fill="${COUL.orange}"/><ellipse cx="24" cy="31" rx="9" ry="12" fill="#f39b45"/><ellipse cx="24" cy="31" rx="3" ry="12" fill="#e57d1f"/>` + trait("M24 20 Q24 14 28 12", "#6b4a22", 3) + feuille(29, 15, 9, 5, 60, COUL.v2) + reflet(18, 29, 9),
  "artichaut": () => ombreSol(24, 10) + trait("M24 44 L24 36", COUL.v2, 3.2) + feuille(24, 42, 12, 4, -65, COUL.v3) + feuille(24, 42, 12, 4, 65, COUL.v3)
    + `<path d="M24 8 Q35 15 35 25 Q35 36 24 37 Q13 36 13 25 Q13 15 24 8Z" fill="#557a4a"/>`
    + [[24, 12, [0]], [18, 0, [-5, 5]], [24, 0, []]].slice(0, 0).join("")
    + [[17, [24]], [23, [19, 29]], [29, [16, 24, 32]], [35, [20, 28]]].map(([y, xs]) => xs.map(x => `<path d="M${x - 5} ${y} Q${x - 4.5} ${y - 6} ${x} ${y - 8} Q${x + 4.5} ${y - 6} ${x + 5} ${y} Q${x} ${y + 2} ${x - 5} ${y}Z" fill="#86ad72"/><path d="M${x - 1.6} ${y - 6.6} L${x} ${y - 8.6} L${x + 1.6} ${y - 6.6}" fill="#8a5aa0"/>`).join("")).join(""),
  "engrais-vert": () => ombreSol() + [[16, 30], [32, 30], [24, 22]].map(([x, y]) => trait(`M24 43 L${x} ${y + 4}`, COUL.v2, 1.6) + rond(x - 3, y, 3.6, COUL.v3, false) + rond(x + 3, y, 3.6, COUL.v3, false) + rond(x, y - 3.5, 3.6, COUL.v4, false)).join("") + rond(24, 12, 4, "#9b7fd4", false),
  "fraise": () => `<path d="M24 44 C12 36 9 26 13 20 C16 16 21 17 24 18 C27 17 32 16 35 20 C39 26 36 36 24 44Z" fill="${COUL.rouge}"/>`
    + [[19, 24], [25, 23], [30, 25], [17, 30], [23, 29], [29, 31], [21, 35], [26, 37], [32, 29]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx=".9" ry="1.3" fill="#f6d36b"/>`).join("") + calice(24, 17.5, 7, COUL.v2) + reflet(18, 25, 6),
  "framboise": () => trait("M24 15 L24 8", COUL.v2, 2) + feuille(24, 12, 9, 4, -60, COUL.v3) + `<path d="M15 21 Q24 14 33 21 Q33 33 24 42 Q15 33 15 21Z" fill="#c42b5a"/>`
    + [[19, 21], [24, 20], [29, 21], [17, 26], [22, 25.5], [27, 25.5], [31, 26], [19.5, 31], [24.5, 30.5], [29, 31], [22, 36], [26.5, 36]].map(([x, y]) => rond(x, y, 2.6, "#e2416f")).join(""),
  "cassis": () => trait("M10 8 Q22 12 30 20", COUL.v2, 1.8) + feuille(14, 9, 9, 5, -70, COUL.v3)
    + [[17, 17], [22, 21], [27, 25], [20, 28], [26, 32], [31, 30], [24, 37]].map(([x, y]) => rond(x, y, 4, "#2f1f3f")).join(""),
  "myrtille": () => ombreSol(24, 15) + feuille(30, 18, 11, 4.5, 40, COUL.v2) + [[17, 27, 7], [30, 31, 7.5], [22, 37, 6]].map(([x, y, r]) => rond(x, y, r, "#4c62b0") + `<path d="M${x - 1.6} ${y - r + 1.6} L${x} ${y - r + 3} L${x + 1.6} ${y - r + 1.6}" stroke="#2c3a72" stroke-width="1.1" fill="none"/>`).join(""),
  "rhubarbe": () => trait("M17 44 L20 22", "#c2334d", 4) + trait("M25 44 L25 20", "#d24660", 4) + trait("M33 44 L30 23", "#b52b45", 4)
    + `<path d="M8 22 Q6 10 16 9 Q20 4 26 7 Q33 4 37 10 Q44 13 40 21 Q34 26 24 23 Q14 27 8 22Z" fill="${COUL.v2}"/>` + trait("M24 22 L24 9 M24 18 L15 12 M24 18 L34 12", "#7fb56a", 1.2),
  "asperge": () => ombreSol() + [[16, -6], [24, 0], [32, 6]].map(([x, a], i) => `<g transform="rotate(${a} ${x} 44)"><rect x="${x - 3}" y="${12 + i * 2}" width="6" height="${32 - i * 2}" rx="3" fill="#7fae4f"/><path d="M${x - 3} ${16 + i * 2} Q${x} ${7 + i * 2} ${x + 3} ${16 + i * 2}Z" fill="#8a5aa0"/><path d="M${x - 3} ${25 + i * 2} L${x} ${22 + i * 2} L${x + 3} ${25 + i * 2}" stroke="#5f8a3a" stroke-width="1" fill="none"/><path d="M${x - 3} ${33 + i * 2} L${x} ${30 + i * 2} L${x + 3} ${33 + i * 2}" stroke="#5f8a3a" stroke-width="1" fill="none"/></g>`).join(""),

  "aubergine": () => ombreSol() + `<path d="M17 18 Q10 30 16 40 Q23 46 31 40 Q37 33 31 22 Q27 15 22 15Z" fill="#5b2a6e"/>` + reflet(21, 28, 7) + `<path d="M17 18 Q22 12 28 17 L25 20 L22 17 L19 20Z" fill="${COUL.v2}"/>` + trait("M22 15 Q23 9 27 8", COUL.v2, 2.2),
  "piment": () => `<path d="M14 12 Q30 14 34 30 Q36 40 28 44 Q31 34 24 26 Q19 20 14 18Z" fill="#d7262b"/>` + reflet(26, 24, 5) + `<path d="M11 11 Q15 9 17 13 L15 17 Q12 16 11 11Z" fill="${COUL.v2}"/>` + trait("M12 11 Q9 7 11 4", COUL.v2, 2),
  "panais": () => touffe(24, 17, 5, 13, COUL.v3, 6, 2.2) + `<path d="M16.5 16 L31.5 16 L25.2 43.5 Q24 45.5 22.8 43.5Z" fill="#efe3bf"/>` + trait("M19 22 L22 22.5 M27 28 L29.5 27.5 M21 33 L23.5 33.4", "#c8b88f", 1.2),
  "celeri": () => trait("M18 44 L15 18 M22 44 L21 16 M26 44 L27 16 M30 44 L33 18", "#a8cf7a", 3.2) + [[15, 15], [21, 12], [27, 12], [33, 15]].map(([x, y]) => feuille(x, y + 3, 9, 4.5, x < 24 ? -20 : 20, COUL.v2, false)).join(""),
  "gingembre": () => ombreSol(24, 15) + `<path d="M9 38 Q8 32 14 32 Q15 27 21 29 Q25 25 29 29 Q35 28 37 33 Q41 35 39 40 Q35 43 27 41 Q19 44 13 42 Q9 42 9 38Z" fill="#d9b27a"/>` + trait("M14 34 Q16 36 15 39 M24 31 Q25 35 23 39 M33 33 Q32 36 34 39", "#b98d55", 1.2) + trait("M20 29 L18 12 M27 29 L29 10", COUL.v3, 2) + feuille(18, 18, 9, 2.6, -15, COUL.v2, false) + feuille(29, 16, 10, 2.6, 15, COUL.v2, false),
  "verveine": () => trait("M24 44 L24 12", "#7d9a5a", 1.8) + [[38, -60], [38, 60], [30, -50], [30, 50], [22, -40], [22, 40]].map(([y, a]) => feuille(24, y, 13, 2.6, a, "#9cc65a")).join("") + feuille(24, 15, 9, 2.4, 0, "#b5d870"),
  "laurier": () => trait("M14 42 Q22 30 34 10", "#6b5236", 2) + [[17, 37, -70], [20, 32, 60], [23, 28, -65], [26, 23, 55], [29, 18, -60], [32, 14, 50]].map(([x, y, a]) => feuille(x, y, 11, 4.2, a, "#2f5b33")).join(""),
  "glaieul": () => trait("M24 44 L24 8", COUL.v2, 2) + feuille(24, 44, 22, 2.4, -12, COUL.v3, false) + feuille(24, 44, 20, 2.4, 14, COUL.v3, false) + [[10, -1], [16, 1], [22, -1], [28, 1]].map(([y, s]) => `<path d="M24 ${y} q${s * 8} 2 ${s * 6} 7 q${-s * 4} 1 ${-s * 6} -3Z" fill="#f08cae"/><circle cx="${24 + s * 3}" cy="${y + 3}" r="2.6" fill="#f6a8c2"/>`).join(""),
  // --- Aromatiques
  "persil": () => trait("M24 44 L16 24 M24 44 L24 18 M24 44 L32 24", COUL.v2, 1.6)
    + [[16, 21], [24, 15], [32, 21]].map(([x, y]) => [[0, 0], [-4, 2], [4, 2], [-2.5, -3.5], [2.5, -3.5], [0, 4]].map(([dx, dy]) => rond(x + dx, y + dy, 3, COUL.v1, false)).join("")).join(""),
  "ciboulette": () => ombreSol(24, 10) + touffe(24, 43, 7, 30, COUL.v2, 9, 2.2) + rond(15, 13, 4.5, "#b07fd0", false) + rond(31, 15, 4, "#b07fd0", false) + rond(14, 12, 1.4, "#d4b6e8", false) + rond(30, 14, 1.3, "#d4b6e8", false),
  "basilic": () => trait("M24 44 L24 14", COUL.v2, 2) + feuille(24, 38, 15, 8, -60, "#43a047") + feuille(24, 38, 15, 8, 60, "#43a047") + feuille(24, 27, 13, 7.5, -55, "#4caf50") + feuille(24, 27, 13, 7.5, 55, "#4caf50") + feuille(24, 18, 12, 6.5, 0, "#66bb6a"),
  "thym": () => ombreSol(24, 14) + [[-30, 22], [-14, 27], [0, 30], [14, 27], [30, 22]].map(([a, h]) => `<g transform="rotate(${a} 24 44)">` + trait(`M24 44 L24 ${44 - h}`, "#8a6a4a", 1.3)
    + [0.35, 0.5, 0.65, 0.8, 0.95].map(f => rond(22.2, 44 - h * f, 1.7, "#93ad84", false) + rond(25.8, 44 - h * f + 1, 1.7, "#7f9a70", false)).join("") + `</g>`).join("") + rond(16, 16, 1.6, "#d9b8e3", false) + rond(31, 14, 1.6, "#d9b8e3", false),
  "romarin": () => brin(22, 44, 36, -12, "#7a5a3a", "#456b4f", 3, 2.4) + brin(28, 44, 30, 16, "#7a5a3a", "#527a5c", 2.8, 2.4) + rond(16, 12, 2, "#7f9de6", false) + rond(35, 19, 2, "#7f9de6", false),
  "menthe": () => trait("M24 44 L24 10", COUL.v2, 2) + [[38, 9, 7], [29, 8.5, 6.5], [20, 7.5, 6]].map(([y, l, w]) => feuille(24, y, l + 4, w * 0.75, -72, "#5cbf6e") + feuille(24, y, l + 4, w * 0.75, 72, "#5cbf6e")).join("") + feuille(24, 13, 9, 4, 0, "#7fd38a"),
  "coriandre": () => trait("M24 44 L15 22 M24 44 L24 16 M24 44 L33 22", COUL.v2, 1.5) + [[15, 19], [24, 13], [33, 19]].map(([x, y]) => rond(x - 3, y, 3.4, "#7cc06a", false) + rond(x + 3, y, 3.4, "#7cc06a", false) + rond(x, y - 3.4, 3.4, "#8fcd7c", false)).join(""),
  "aneth": () => trait("M24 44 L24 16", COUL.v2, 1.8) + [[-8, 30], [8, 26], [-7, 22]].map(([dx, y]) => trait(`M24 ${y + 6} Q${24 + dx * 0.6} ${y} ${24 + dx} ${y - 4}`, "#8bc77a", 1)).join("")
    + [-7, -3.5, 0, 3.5, 7].map(dx => trait(`M24 16 L${24 + dx} 9`, "#b5a33a", 0.9) + rond(24 + dx, 8.5, 1.6, COUL.jaune, false)).join(""),
  "cerfeuil": () => [[-14, 22], [0, 26], [14, 22]].map(([a, h]) => `<g transform="rotate(${a} 24 44)">` + trait(`M24 44 L24 ${44 - h}`, "#7fb86a", 1.3) + [0.35, 0.55, 0.75, 0.92].map(f => feuille(24, 44 - h * f, 6, 2.6, -55, "#a5d68a", false) + feuille(24, 44 - h * f, 6, 2.6, 55, "#a5d68a", false)).join("") + `</g>`).join(""),
  "sauge": () => ombreSol(24, 12) + trait("M24 44 L24 18", "#7d8f74", 2) + feuille(24, 40, 15, 6, -55, "#9db39a") + feuille(24, 40, 15, 6, 55, "#9db39a") + feuille(24, 30, 14, 5.5, -45, "#a9bea6") + feuille(24, 30, 14, 5.5, 45, "#a9bea6") + feuille(24, 21, 13, 5, 0, "#b4c8b0"),
  "origan": () => trait("M24 44 L18 16 M24 44 L30 16", COUL.v2, 1.4) + [[20, 34], [28, 34], [19, 26], [29, 26]].map(([x, y]) => rond(x - 2.6, y, 2.4, "#6fa25a", false) + rond(x + 2.6, y, 2.4, "#6fa25a", false)).join("") + [[18, 13], [30, 13]].map(([x, y]) => rond(x, y, 4, "#d48cc0", false) + rond(x - 1, y - 1, 1.3, "#f0c3e2", false)).join(""),
  "estragon": () => [[-20, 30], [-7, 34], [7, 34], [20, 30]].map(([a, h]) => `<g transform="rotate(${a} 24 44)">` + trait(`M24 44 L24 ${44 - h}`, COUL.v2, 1.2) + feuille(24, 44 - h * 0.45, 12, 1.8, -25, "#6a9a4a", false) + feuille(24, 44 - h * 0.7, 11, 1.8, 25, "#6a9a4a", false) + `</g>`).join(""),
  "sarriette": () => brin(19, 44, 28, -14, "#6b7d4a", "#6f9a55", 1.4, 2.4) + brin(29, 44, 30, 12, "#6b7d4a", "#6f9a55", 1.4, 2.4) + [[14, 18], [36, 15], [22, 15], [30, 20]].map(([x, y]) => rond(x, y, 1.6, "#f4eef8", false)).join(""),
  "fenouil": () => [-14, -5, 5, 14].map(a => `<g transform="rotate(${a} 24 26)">` + trait("M24 26 L24 8", "#8bc77a", 1.6) + [12, 16, 20].map(y => trait(`M24 ${y} L20 ${y - 3} M24 ${y} L28 ${y - 3}`, "#a7d78f", 1)).join("") + `</g>`).join("")
    + `<path d="M15 34 Q15 25 24 25 Q33 25 33 34 Q33 42 24 42 Q15 42 15 34Z" fill="#eef3df"/>` + trait("M20 27 Q19 34 21 41 M28 27 Q29 34 27 41", "#cfdcb5", 1.2),
  "melisse": () => ombreSol(24, 12) + trait("M24 44 L24 16", COUL.v2, 1.8) + feuille(24, 40, 13, 7.5, -60, "#a3c94f") + feuille(24, 40, 13, 7.5, 60, "#a3c94f") + feuille(24, 30, 12, 7, -50, "#b2d35f") + feuille(24, 30, 12, 7, 50, "#b2d35f") + feuille(24, 21, 11, 6, 0, "#c2dd74"),

  // --- Fleurs
  "capucine": () => trait("M18 44 Q16 34 17 28 M28 44 Q30 36 31 30", COUL.v3, 1.6) + rond(16, 24, 8.5, "#7cb85f", false) + trait("M16 24 L16 16 M16 24 L23 21 M16 24 L22 29 M16 24 L9 21 M16 24 L11 30", "#b6dba0", 0.9)
    + `<path d="M31 30 Q26 22 30 16 Q35 12 40 16 Q43 22 38 26Z" fill="#f05a22"/>` + `<path d="M33 18 Q36 16 38 19" stroke="#ffb04a" stroke-width="1.4" fill="none"/>`,
  "souci": () => trait("M24 44 L24 30", COUL.v2, 2) + feuille(24, 40, 10, 3.5, -55, COUL.v3) + fleur(24, 20, 17, 14, "#f59e1b", "#c25e00", 0.24, 0.3),
  "tournesol": () => trait("M24 44 L24 30", COUL.v2, 2.6) + feuille(24, 38, 11, 5.5, -60, COUL.v2) + feuille(24, 35, 11, 5.5, 60, COUL.v2) + fleur(24, 19, 18, 16, COUL.jaune, "#6b4423", 0.24, 0.45) + `<circle cx="24" cy="19" r="5" fill="#4d2f17"/>`,
  "oeillet-inde": () => trait("M24 44 L24 30", COUL.v2, 2) + brin(24, 44, 12, -50, COUL.v2, COUL.v3, 1.6, 2.4) + fleur(24, 20, 17, 11, "#d9480f", "#d9480f", 0.32, 0.2) + fleur(24, 20, 11, 9, "#f08c00", "#f6b40a", 0.36, 0.32),
  "lavande": () => ombreSol(24, 11) + epi(18, 44, 30, -14, "#8f6bd6", "#7f9a6a") + epi(24, 44, 34, 0, "#7d5ac9", "#7f9a6a") + epi(30, 44, 30, 14, "#8f6bd6", "#7f9a6a"),
  "bourrache": () => trait("M18 44 Q20 34 17 24 M30 44 Q28 36 32 28", "#7d9a6d", 1.8) + [[17, 18, 9], [32, 25, 7.5]].map(([x, y, r]) => {
    let s = ""; for (let i = 0; i < 5; i++) s += `<path d="M${x} ${y} L${x - r * 0.35} ${y - r * 0.6} L${x} ${y - r} L${x + r * 0.35} ${y - r * 0.6}Z" fill="#4a72d9" transform="rotate(${i * 72} ${x} ${y})"/>`;
    return s + `<circle cx="${x}" cy="${y}" r="${r * 0.22}" fill="#2b2b3a"/>`; }).join(""),
  "cosmos": () => trait("M24 44 Q22 34 24 28", COUL.v3, 1.6) + trait("M23 36 L16 31 M24 33 L31 29", "#8bc77a", 1) + fleur(24, 19, 17, 8, "#ef7fb0", "#f5c518", 0.36, 0.26),
  "zinnia": () => trait("M24 44 L24 30", COUL.v2, 2) + feuille(24, 41, 10, 4, 55, COUL.v3) + fleur(24, 20, 17, 12, "#d6336c", "#d6336c", 0.3, 0.2) + fleur(24, 20, 11, 10, "#f06595", "#f2c230", 0.32, 0.3),
  "bleuet": () => trait("M24 44 L24 28", "#8aa17a", 1.6) + feuille(24, 38, 10, 2, -40, "#8aa17a", false) + [...Array(9)].map((_, i) => `<path d="M24 20 L21.5 10 L23 11.5 L24 9 L25 11.5 L26.5 10Z" fill="#3f6fd8" transform="rotate(${i * 40} 24 20)"/>`).join("") + `<circle cx="24" cy="20" r="3.4" fill="#5b3a9a"/>`,
  "pois-de-senteur": () => trait("M10 44 Q18 30 28 24 Q36 18 34 10", COUL.v3, 1.6) + trait("M34 10 Q38 6 36 4", COUL.v3, 1) + [[18, 28, "#e8a0d0"], [30, 18, "#c79ae6"]].map(([x, y, c]) => `<path d="M${x} ${y} Q${x - 9} ${y - 4} ${x - 5} ${y - 11} Q${x} ${y - 13} ${x + 5} ${y - 11} Q${x + 9} ${y - 4} ${x} ${y}Z" fill="${c}"/><path d="M${x} ${y} Q${x - 3} ${y - 4} ${x} ${y - 7} Q${x + 3} ${y - 4} ${x} ${y}Z" fill="#fff" opacity=".5"/>`).join(""),
  "nigelle": () => trait("M24 44 L24 30", "#8bc77a", 1.5) + [...Array(12)].map((_, i) => trait(`M24 20 L${(24 + 15 * Math.cos(i * Math.PI / 6)).toFixed(1)} ${(20 + 15 * Math.sin(i * Math.PI / 6)).toFixed(1)}`, "#9bcf86", 0.8)).join("") + fleur(24, 20, 13, 5, "#8fb3ef", "#5a6f8f", 0.48, 0.3),
  "achillee": () => trait("M24 44 L24 22 M24 30 L16 18 M24 30 L32 18", "#8aa17a", 1.4) + feuille(24, 40, 10, 2.4, -45, "#8aa17a", false)
    + [[16, 16], [24, 19], [32, 16]].map(([x, y]) => [[0, 0], [-3, 1], [3, 1], [-1.5, -2.5], [1.5, -2.5]].map(([dx, dy]) => rond(x + dx, y + dy, 1.9, "#ee9cc0", false)).join("")).join("")
};

// Icône générique pour les plantes ajoutées par l'utilisateur
function dessinGenerique(plante) {
  const cat = plante && plante.categorie;
  if (cat === "fleur") return trait("M24 44 L24 28", COUL.v2, 2) + fleur(24, 20, 15, 6, COUL.rose, COUL.jaune);
  if (cat === "fruit") return ombreSol() + feuille(30, 18, 10, 4.5, 40, COUL.v2) + rond(19, 30, 9, COUL.rouge) + rond(30, 33, 7.5, "#e65a6a");
  if (cat === "aromate") return brin(24, 44, 32, 0, COUL.v2, COUL.v3, 2.6, 3);
  return ombreSol() + feuille(24, 41, 24, 9, -35, COUL.v3) + feuille(24, 41, 24, 9, 35, COUL.v3) + feuille(24, 41, 28, 9, 0, COUL.v2);
}

const cacheIcones = new Map();
function contenuIcone(plante) {
  const id = plante && plante.id;
  if (cacheIcones.has(id)) return cacheIcones.get(id);
  const f = DESSINS[id];
  const s = f ? f() : dessinGenerique(plante);
  cacheIcones.set(id, s);
  return s;
}

// Icône HTML (inline SVG) : ico(plante, 28) ou ico(plante, "1.4em")
function ico(plante, taille = 28, classe = "") {
  const t = typeof taille === "number" ? taille + "px" : taille;
  return `<svg class="ico${classe ? " " + classe : ""}" viewBox="0 0 48 48" width="${t}" height="${t}" aria-hidden="true" focusable="false">${contenuIcone(plante)}</svg>`;
}
// Icône à poser dans le plan SVG
function icoSVG(plante, x, y, taille) {
  return `<svg x="${x}" y="${y}" width="${taille}" height="${taille}" viewBox="0 0 48 48" class="plan-ico" aria-hidden="true">${contenuIcone(plante)}</svg>`;
}

/* ---------- Besoin en eau (pour la vue « Arrosage » du plan) ---------- */
const BESOIN_EAU = {
  fort: ["aubergine", "piment", "celeri", "tomate", "courgette", "concombre", "courge", "salade", "poivron", "haricot-vert", "epinard", "chou", "chou-fleur", "fraise", "framboise", "cassis", "myrtille", "rhubarbe", "menthe", "basilic", "celeri"],
  faible: ["thym", "romarin", "sauge", "lavande", "origan", "sarriette", "estragon", "ail", "echalote", "oignon", "achillee", "capucine", "bleuet", "nigelle", "zinnia", "cosmos", "engrais-vert", "asperge"]
};
function besoinEau(plante) {
  if (!plante) return "moyen";
  if (BESOIN_EAU.fort.includes(plante.id)) return "fort";
  if (BESOIN_EAU.faible.includes(plante.id)) return "faible";
  return "moyen";
}
