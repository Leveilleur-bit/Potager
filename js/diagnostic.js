/* ============================================================
   « Qu'est-ce qui cloche ? »
   Tu choisis ce que tu vois (et la culture concernée) : l'appli propose
   les causes les plus probables chez toi, et quoi faire sans produits agressifs.
   S'appuie sur les fiches « Santé » (PROBLEMES) + quelques causes de culture.
   ============================================================ */

const SYMPTOMES = [
  { id: "trous", icone: "🕳️", label: "Feuilles trouées ou mangées" },
  { id: "semis", icone: "🌱", label: "Semis ou jeunes plants disparus" },
  { id: "taches", icone: "🟤", label: "Taches sur les feuilles" },
  { id: "jaune", icone: "🟡", label: "Feuilles qui jaunissent" },
  { id: "blanc", icone: "🤍", label: "Feutrage blanc" },
  { id: "fletrit", icone: "🥀", label: "Plante qui flétrit" },
  { id: "fruits", icone: "🍓", label: "Fruits abîmés ou pourris" },
  { id: "insectes", icone: "🐛", label: "Petites bêtes sur la plante" },
  { id: "enroule", icone: "🌀", label: "Feuilles enroulées ou déformées" },
  { id: "graines", icone: "🌾", label: "Monte en graines trop tôt" }
];

// Causes « de culture » (pas des ravageurs), sur le même modèle que les fiches Santé
const CAUSES_CULTURE = [
  { id: "manque-eau", nom: "Manque d'eau", icone: "💧", plantes: null, mois: [5, 6, 7, 8, 9],
    signes: "Feuilles molles aux heures chaudes, qui jaunissent par le bas ; sol sec en profondeur.",
    prevenir: "Paillis épais, arrosage copieux au pied mais espacé, binage.",
    agir: "Arrose abondamment au pied, tôt le matin ou le soir, puis paille. La plante doit se redresser dans la soirée." },
  { id: "exces-eau", nom: "Trop d'eau, sol détrempé", icone: "🌧️", plantes: null, mois: [1, 2, 3, 4, 10, 11, 12],
    signes: "Feuilles jaunes ou molles même quand le sol est mouillé, racines brunes, plantes qui végètent.",
    prevenir: "Bacs surélevés, compost pour aérer la terre, pas d'arrosage après la pluie.",
    agir: "Arrête d'arroser, aère le sol en surface, attends qu'il ressuie avant de replanter." },
  { id: "azote", nom: "Sol fatigué (manque d'azote)", icone: "🍂", plantes: null, mois: null,
    signes: "Les feuilles du bas jaunissent d'abord, la plante pousse lentement et pâlit.",
    prevenir: "Compost mûr à l'automne, rotation, légumineuses ou engrais vert (phacélie, trèfle).",
    agir: "Un peu de compost bien mûr au pied ou un purin d'ortie dilué (1 pour 10)." },
  { id: "froid", nom: "Coup de froid", icone: "❄️", plantes: null, mois: [10, 11, 12, 1, 2, 3, 4, 5],
    signes: "Feuilles noircies ou translucides après une nuit froide, semis qui ne lèvent pas, plants qui bleuissent.",
    prevenir: "Voile d'hivernage les nuits fraîches, pas de plantation des frileuses avant mi-mai.",
    agir: "Coupe les parties gelées quand il fait doux ; la plante repart souvent du pied." },
  { id: "montaison", nom: "Chaleur ou sécheresse : montée en graines", icone: "☀️", plantes: ["salade", "epinard", "radis", "coriandre", "chou", "betterave", "celeri", "aneth", "cerfeuil", "epinard-hiver"], mois: [5, 6, 7, 8],
    signes: "Une tige florale pousse au cœur, les feuilles deviennent amères.",
    prevenir: "Variétés d'été, semis échelonnés, ombre légère et arrosage régulier en été.",
    agir: "Récolte aussitôt ce qui reste ; ressème plus tard en saison ou à mi-ombre." },
  { id: "arrosage-irregulier", nom: "Arrosage irrégulier (nécrose)", icone: "🍅", plantes: ["tomate", "courgette", "poivron", "piment", "aubergine", "courge", "concombre"], mois: [6, 7, 8, 9],
    signes: "Tache noire et sèche au bout des fruits (cul noir), fruits qui avortent ou se fendent.",
    prevenir: "Arrosage régulier plutôt que copieux de temps en temps, paillis pour garder la fraîcheur.",
    agir: "Retire les fruits touchés et garde un arrosage régulier : les suivants seront sains." },
  { id: "fin-cycle", nom: "Fin de vie naturelle", icone: "🍁", plantes: null, mois: [9, 10, 11],
    signes: "Les feuilles du bas jaunissent et sèchent en fin de saison, la production ralentit.",
    prevenir: "Rien à craindre : c'est le cycle normal de la plante.",
    agir: "Récolte ce qui reste, puis « Fin de culture » et un paillis ou un engrais vert pour l'hiver." }
];

// Poids de chaque cause par symptôme (3 : typique, 2 : fréquent, 1 : possible)
const CAUSES_PAR_SYMPTOME = {
  trous: { limaces: 3, pieride: 3, altise: 2, doryphore: 2, criocere: 2, oiseaux: 1 },
  semis: { limaces: 3, oiseaux: 3, altise: 1, froid: 1 },
  taches: { mildiou: 3, rouille: 3, botrytis: 1, oidium: 1 },
  jaune: { azote: 3, "manque-eau": 2, "exces-eau": 2, "fin-cycle": 2, rouille: 2, mildiou: 1, hernie: 1, "mouche-carotte": 1, froid: 1 },
  blanc: { oidium: 3, botrytis: 1 },
  fletrit: { "manque-eau": 3, hernie: 2, "exces-eau": 1, "mouche-carotte": 1, montaison: 1 },
  fruits: { botrytis: 3, oiseaux: 3, "arrosage-irregulier": 3, mildiou: 2, limaces: 2 },
  insectes: { pucerons: 3, pieride: 2, doryphore: 2, criocere: 2, altise: 1 },
  enroule: { pucerons: 3, "manque-eau": 1, froid: 1 },
  graines: { montaison: 3, "manque-eau": 1 }
};

function causeParId(id) { return PROBLEMES.find(p => p.id === id) || CAUSES_CULTURE.find(p => p.id === id) || null; }

function diagnostiquer(symptomes, planteId = null) {
  if (!symptomes.length) return [];
  const m = moisCourant();
  const jours = typeof joursMeteoValides === "function" ? joursMeteoValides() : null;
  const humide = !!(jours && jours.slice(0, 3).some(j => j.pluie >= 2));
  const presentes = new Set(listerCultures().map(c => c.plante.id));
  const soucis = typeof prefsJardin === "function" ? prefsJardin().soucis : [];
  const scores = new Map();
  symptomes.forEach(s => Object.entries(CAUSES_PAR_SYMPTOME[s] || {}).forEach(([id, poids]) => {
    const c = causeParId(id);
    if (!c) return;
    const x = scores.get(id) || { cause: c, score: 0, raisons: new Set(), symptomes: 0 };
    x.score += poids * 2; x.symptomes++;
    scores.set(id, x);
  }));
  scores.forEach(x => {
    const c = x.cause;
    if (x.symptomes > 1) x.raisons.add("correspond à plusieurs signes");
    if (planteId && c.plantes) {
      if (c.plantes.includes(planteId)) { x.score += 4; x.raisons.add("fréquent sur " + nomCourt(planteParId(planteId)).toLowerCase()); }
      else x.score -= 6;
    } else if (!planteId && c.plantes && c.plantes.some(id => presentes.has(id))) x.score += 1;
    if (c.mois) { if (c.mois.includes(m)) { x.score += 2; x.raisons.add("c'est la saison"); } else x.score -= 2; }
    if (c.humide && humide) { x.score += 2; x.raisons.add("le temps humide le favorise"); }
    if (soucis.includes(c.id)) { x.score += 1; x.raisons.add("un de tes soucis habituels"); }
  });
  return [...scores.values()].filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);
}

function carteDiagnosticHTML() {
  const st = ui.diagnostic || (ui.diagnostic = { symptomes: [], planteId: null });
  const cultures = [...new Map(listerCultures().map(c => [c.plante.id, c.plante])).values()].sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  const res = diagnostiquer(st.symptomes, st.planteId);
  return `<section class="carte carte-diagnostic" id="carte-diagnostic">
    <div class="carte-titre"><h2>🔎 Qu'est-ce qui cloche ?</h2></div>
    <p class="texte-doux petit">Touche ce que tu vois (un ou plusieurs signes), puis la culture concernée.</p>
    <div class="chips">${SYMPTOMES.map(s => `<button class="chip${st.symptomes.includes(s.id) ? " actif" : ""}" data-symptome="${s.id}" aria-pressed="${st.symptomes.includes(s.id)}">${s.icone} ${esc(s.label)}</button>`).join("")}</div>
    ${st.symptomes.length && cultures.length ? `<h3 class="sous-titre-section">Sur quelle culture ?</h3>
      <div class="chips">${cultures.map(p => `<button class="chip${st.planteId === p.id ? " actif" : ""}" data-diag-plante="${p.id}">${ico(p, "1.3em")} ${esc(nomCourt(p))}</button>`).join("")}</div>` : ""}
    ${st.symptomes.length ? (res.length ? `<h3 class="sous-titre-section">Le plus probable</h3>${res.map((x, i) => `
      <details class="diag-cause"${i === 0 ? " open" : ""}>
        <summary><span>${x.cause.icone} <strong>${esc(x.cause.nom)}</strong></span>${i === 0 ? `<span class="tag-info">le plus probable</span>` : `<span class="texte-doux petit">possible</span>`}</summary>
        ${x.raisons.size ? `<p class="texte-doux petit">${esc(majuscule([...x.raisons].join(", ")))}.</p>` : ""}
        <h4>À vérifier</h4><p>${esc(x.cause.signes)}</p>
        <h4>Que faire</h4><p>${esc(x.cause.agir)}</p>
        <h4>La prochaine fois</h4><p>${esc(x.cause.prevenir)}</p>
        ${x.cause.breton ? `<p class="sa-breton">🌧️ ${esc(x.cause.breton)}</p>` : ""}
      </details>`).join("")}
      <p class="texte-doux petit">Un doute ? Prends une photo (onglet Journal) : tu pourras comparer dans quelques jours.</p>`
      : `<p class="vide">Rien de typique ne correspond${st.planteId ? " pour cette culture" : ""}. Regarde aussi sous les feuilles et au pied, le soir ou tôt le matin.</p>`) : ""}
    ${st.symptomes.length ? `<button class="btn-discret" id="diag-effacer">Recommencer</button>` : ""}
  </section>`;
}

function brancherDiagnostic(zone) {
  const carte = zone.querySelector("#carte-diagnostic");
  if (!carte) return;
  const redessiner = () => {
    const tmp = document.createElement("div");
    tmp.innerHTML = carteDiagnosticHTML();
    carte.replaceWith(tmp.firstElementChild);
    brancherDiagnostic(zone);
  };
  const st = ui.diagnostic;
  carte.querySelectorAll("[data-symptome]").forEach(b => b.addEventListener("click", () => {
    const s = b.dataset.symptome;
    st.symptomes = st.symptomes.includes(s) ? st.symptomes.filter(x => x !== s) : [...st.symptomes, s];
    redessiner();
  }));
  carte.querySelectorAll("[data-diag-plante]").forEach(b => b.addEventListener("click", () => {
    st.planteId = st.planteId === b.dataset.diagPlante ? null : b.dataset.diagPlante;
    redessiner();
  }));
  const eff = carte.querySelector("#diag-effacer");
  if (eff) eff.addEventListener("click", () => { ui.diagnostic = { symptomes: [], planteId: null }; redessiner(); });
}
