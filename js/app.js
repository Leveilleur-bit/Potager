/* ============================================================
   Mon Potager Breton — logique de l'application
   Tout est stocké en local (localStorage) : rien n'est envoyé à
   un serveur, sauf la position de la commune choisie, transmise
   au service météo gratuit Open-Meteo pour les prévisions.
   ============================================================ */
"use strict";

const CLE_STOCKAGE = "potagerBretonState";
const CLE_METEO = "potagerBretonMeteo";
const VERSION_DONNEES = 3;
const MAX_CULTURES_PAR_CASE = 5;
const U = 100; // 1 mètre = 100 unités dans les plans SVG

const MOIS_NOMS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
const MOIS_INITIALES = ["J","F","M","A","M","J","J","A","S","O","N","D"];
const SAISONS = { hiver: "Hiver", printemps: "Printemps", ete: "Été", automne: "Automne" };
const VUES = ["accueil", "plan", "cultures", "saisons", "journal", "reglages"];

const TYPES_JOURNAL = {
  note: { label: "Note", icone: "📝" },
  semis: { label: "Semis / plantation", icone: "🌱" },
  recolte: { label: "Récolte", icone: "🧺" },
  probleme: { label: "Problème", icone: "🐌" }
};

const STATUTS = {
  "a-venir":          { classe: "etat-croissance", texte: "en croissance" },
  "bientot":          { classe: "etat-bientot",    texte: "récolte bientôt" },
  "recolter":         { classe: "etat-recolte",    texte: "à récolter" },
  "retard":           { classe: "etat-retard",     texte: "récolte en retard ?" },
  "cueillette":       { classe: "etat-recolte",    texte: "en saison de récolte" },
  "cueillette-libre": { classe: "etat-croissance", texte: "à cueillir au besoin" },
  "en-place":         { classe: "etat-place",      texte: "en place" }
};
const STATUTS_A_RECOLTER = ["recolter", "retard", "cueillette"];

/* ---------- État global ---------- */

let etat = migrer(chargerEtat());
let meteo = lireJSON(CLE_METEO);
let invitationInstallation = null;

const ui = {
  vue: "accueil",
  filtreCategorie: "toutes",
  moisSaisons: moisCourant(),
  rechercheSaisons: "",
  vueSaisons: "mois",
  editionDisposition: false,
  resultatsCommune: null,
  rechercheCommuneEnCours: false,
  rafraichirFenetre: null
};

/* ============================================================
   Utilitaires
   ============================================================ */

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function creerId() { return Math.random().toString(36).slice(2, 10); }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function moisCourant() { return new Date().getMonth() + 1; }
function majuscule(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
function normaliser(s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }

function aujourdhui() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function isoLocal(d = new Date()) {
  const z = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}
// Lit une date "AAAA-MM-JJ" comme une date locale (évite le décalage UTC)
function parseDate(s) {
  if (!s) return null;
  if (s instanceof Date) return new Date(s);
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  const d = new Date(s);
  return isNaN(d) ? null : d;
}
function ajouterJours(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function joursEntre(a, b) { return Math.round((b - a) / 86400000); }
function formatDate(d) {
  d = parseDate(d);
  if (!d) return "";
  const options = { day: "numeric", month: "long" };
  if (d.getFullYear() !== new Date().getFullYear()) options.year = "numeric";
  return d.toLocaleDateString("fr-FR", options);
}
function nomJour(d) {
  d = parseDate(d);
  const ecart = joursEntre(aujourdhui(), d);
  if (ecart === 0) return "aujourd'hui";
  if (ecart === 1) return "demain";
  return d.toLocaleDateString("fr-FR", { weekday: "long" });
}
function nomJourCourt(d) {
  d = parseDate(d);
  const ecart = joursEntre(aujourdhui(), d);
  if (ecart === 0) return "Auj.";
  if (ecart === 1) return "Demain";
  return majuscule(d.toLocaleDateString("fr-FR", { weekday: "short" }));
}
function saisonDuMois(m) {
  if ([12, 1, 2].includes(m)) return "hiver";
  if ([3, 4, 5].includes(m)) return "printemps";
  if ([6, 7, 8].includes(m)) return "ete";
  return "automne";
}
function formatNombre(n) { return Number(n).toLocaleString("fr-FR", { maximumFractionDigits: 2 }); }
function listeFr(noms) {
  if (noms.length <= 1) return noms.join("");
  return noms.slice(0, -1).join(", ") + " et " + noms[noms.length - 1];
}

function lireJSON(cle) {
  try { const brut = localStorage.getItem(cle); return brut ? JSON.parse(brut) : null; }
  catch (e) { return null; }
}
function ecrireJSON(cle, valeur) {
  try { localStorage.setItem(cle, JSON.stringify(valeur)); return true; }
  catch (e) { return false; }
}

/* ============================================================
   Données : chargement, migration, sauvegarde
   ============================================================ */

function etatParDefaut() {
  return {
    version: VERSION_DONNEES,
    parcelles: [{ id: creerId(), nom: "Carré n°1", largeur: 3, hauteur: 3, posX: 0, posY: 0, cases: {}, historique: [] }],
    journal: [],
    reglages: { lieu: null, derniereSauvegarde: null }
  };
}

function chargerEtat() {
  return lireJSON(CLE_STOCKAGE) || etatParDefaut();
}

// Complète et répare les données (anciennes sauvegardes, imports partiels)
function migrer(e) {
  if (!e || !Array.isArray(e.parcelles)) e = etatParDefaut();
  e.version = VERSION_DONNEES;
  e.journal = Array.isArray(e.journal) ? e.journal : [];
  e.journal.forEach(j => {
    if (!j.id) j.id = creerId();
    if (!j.type || !TYPES_JOURNAL[j.type]) j.type = /^Récolte/.test(j.texte || "") ? "recolte" : "note";
  });
  e.reglages = Object.assign({ lieu: null, derniereSauvegarde: null }, e.reglages || {});
  let yLibre = 0;
  e.parcelles.forEach(p => {
    if (!p.id) p.id = creerId();
    p.nom = p.nom || "Parcelle";
    p.largeur = clamp(Math.round(+p.largeur || 1), 1, 20);
    p.hauteur = clamp(Math.round(+p.hauteur || 1), 1, 20);
    p.cases = p.cases && typeof p.cases === "object" ? p.cases : {};
    // Version 3 : une case contient une liste de cultures (avant : une seule)
    Object.keys(p.cases).forEach(coord => {
      let v = p.cases[coord];
      if (!Array.isArray(v)) v = v && v.planteId ? [v] : [];
      v = v.filter(c => c && c.planteId);
      v.forEach(c => { if (!c.id) c.id = creerId(); });
      if (v.length) p.cases[coord] = v; else delete p.cases[coord];
    });
    p.historique = Array.isArray(p.historique) ? p.historique : [];
    if (!Number.isFinite(p.posX) || !Number.isFinite(p.posY)) { p.posX = 0; p.posY = yLibre; }
    yLibre = Math.max(yLibre, p.posY + p.hauteur + 1);
  });
  normaliserPositions(e);
  return e;
}

function normaliserPositions(e = etat) {
  if (!e.parcelles.length) return;
  const minX = Math.min(...e.parcelles.map(p => p.posX));
  const minY = Math.min(...e.parcelles.map(p => p.posY));
  e.parcelles.forEach(p => { p.posX = +(p.posX - minX).toFixed(2); p.posY = +(p.posY - minY).toFixed(2); });
}

function sauvegarder() {
  if (!ecrireJSON(CLE_STOCKAGE, etat)) {
    toast("Enregistrement impossible : le stockage du navigateur est indisponible ou plein.");
  }
}

// Exécute une modification et propose de l'annuler pendant quelques secondes
function avecAnnulation(message, action) {
  const avant = JSON.stringify(etat);
  action();
  sauvegarder();
  rendre();
  if (ui.rafraichirFenetre) ui.rafraichirFenetre();
  toast(message, {
    annuler: () => {
      etat = migrer(JSON.parse(avant));
      sauvegarder();
      rendre();
      if (ui.rafraichirFenetre) ui.rafraichirFenetre();
      toast("Modification annulée.");
    }
  });
}

/* ============================================================
   Plantes, cultures, rotation, compagnonnage
   ============================================================ */

const PLANTES_PAR_ID = Object.fromEntries(PLANTS_DB.map(p => [p.id, p]));
function planteParId(id) { return PLANTES_PAR_ID[id] || null; }
function familleDe(plante) { return FAMILIES[plante && plante.famille] || FAMILIES.autre; }
function iconePlante(plante) { return (plante && (PLANT_ICONS[plante.id] || CATEGORY_ICONS[plante.categorie])) || "🌱"; }
function nomCourt(plante) { return plante.nom.replace(/\s*\(.*\)\s*/, "").split(" / ")[0]; }

const COMPAGNONS = (() => {
  const index = {};
  const ajouter = (a, b, type) => {
    index[a] = index[a] || { amis: new Set(), ennemis: new Set() };
    index[a][type].add(b);
  };
  COMPANION_PAIRS.amis.forEach(([a, b]) => { ajouter(a, b, "amis"); ajouter(b, a, "amis"); });
  COMPANION_PAIRS.ennemis.forEach(([a, b]) => { ajouter(a, b, "ennemis"); ajouter(b, a, "ennemis"); });
  return index;
})();
function relation(a, b) {
  const r = COMPAGNONS[a];
  if (!r) return null;
  if (r.ennemis.has(b)) return "ennemis";
  if (r.amis.has(b)) return "amis";
  return null;
}

function estFrileuse(plante) {
  return FROST_SENSITIVE_FAMILIES.includes(plante.famille) || FROST_SENSITIVE_PLANTS.includes(plante.id);
}

// Les cultures présentes dans une case (valides uniquement)
function culturesDe(parcelle, coord) {
  const v = parcelle.cases[coord];
  return Array.isArray(v) ? v.filter(c => c && planteParId(c.planteId)) : [];
}
function ajouterCulture(parcelle, coord, donnees) {
  if (!Array.isArray(parcelle.cases[coord])) parcelle.cases[coord] = [];
  parcelle.cases[coord].push({ id: creerId(), ...donnees });
}
function supprimerCulture(parcelle, coord, cid) {
  const reste = (parcelle.cases[coord] || []).filter(c => c.id !== cid);
  if (reste.length) parcelle.cases[coord] = reste; else delete parcelle.cases[coord];
}
// Dégradé à bandes nettes pour une case qui accueille plusieurs familles
function fondDegrade(couleurs) {
  if (couleurs.length === 1) return couleurs[0];
  const n = couleurs.length;
  return "linear-gradient(135deg, " + couleurs.map((c, i) => `${c} ${Math.round(i * 100 / n)}% ${Math.round((i + 1) * 100 / n)}%`).join(", ") + ")";
}
const ORDRE_STATUT = { retard: 0, recolter: 1, cueillette: 2, bientot: 3, "a-venir": 4, "cueillette-libre": 5, "en-place": 6 };
// Statut le plus urgent de chaque case, pour les pastilles du plan
function statutsParCase() {
  const res = {};
  listerCultures().forEach(c => {
    const cle = c.parcelle.id + "|" + c.coord;
    if (!(cle in res) || ORDRE_STATUT[c.statut] < ORDRE_STATUT[res[cle]]) res[cle] = c.statut;
  });
  return res;
}

function dansLimites(parcelle, coord) {
  const [x, y] = coord.split("-").map(Number);
  return x >= 0 && y >= 0 && x < parcelle.largeur && y < parcelle.hauteur;
}

// Fenêtre de récolte estimée. Si la date calculée tombe hors des mois de
// récolte (ex. petit pois semé en novembre), on la repousse au prochain
// mois de récolte : la plante passe l'hiver.
function fenetreRecolte(plante, datePlantation) {
  if (!plante.dureeJoursMin && !plante.dureeJoursMax) return null;
  let debut = ajouterJours(datePlantation, plante.dureeJoursMin || plante.dureeJoursMax);
  let fin = ajouterJours(datePlantation, plante.dureeJoursMax || plante.dureeJoursMin);
  const mois = plante.moisRecolte || [];
  if (mois.length && !mois.includes(debut.getMonth() + 1)) {
    const d = new Date(debut.getFullYear(), debut.getMonth(), 1);
    for (let i = 0; i < 12; i++) {
      d.setMonth(d.getMonth() + 1);
      if (mois.includes(d.getMonth() + 1)) break;
    }
    const duree = Math.max(fin - debut, 30 * 86400000);
    debut = new Date(d);
    fin = new Date(d.getTime() + duree);
  }
  return { debut, fin };
}

function infosCulture(parcelle, coord, contenu) {
  const plante = planteParId(contenu.planteId);
  const datePlantation = parseDate(contenu.datePlantation);
  if (!plante || !datePlantation) return null;
  const [x, y] = coord.split("-").map(Number);
  const auj = aujourdhui();
  const m = moisCourant();
  const joursDepuis = joursEntre(datePlantation, auj);
  const fenetre = fenetreRecolte(plante, datePlantation);
  let statut, progression = null;

  if (!fenetre) {
    const mois = plante.moisRecolte || [];
    if (!mois.length) statut = "en-place";
    else if (mois.length >= 10) statut = "cueillette-libre";
    else if (mois.includes(m) && joursDepuis >= 60) statut = "cueillette";
    else statut = "en-place";
  } else {
    const avantDebut = joursEntre(auj, fenetre.debut);
    if (avantDebut > 14) statut = "a-venir";
    else if (avantDebut > 0) statut = "bientot";
    else if (joursEntre(fenetre.fin, auj) <= 21) statut = "recolter";
    else statut = "retard";
    const total = Math.max(1, joursEntre(datePlantation, fenetre.debut));
    progression = clamp(joursDepuis / total, 0, 1);
  }
  return { parcelle, coord, x, y, contenu, plante, datePlantation, fenetre, statut, progression };
}

function listerCultures() {
  const liste = [];
  etat.parcelles.forEach(parcelle => {
    Object.keys(parcelle.cases).forEach(coord => {
      if (!dansLimites(parcelle, coord)) return;
      culturesDe(parcelle, coord).forEach(contenu => {
        const infos = infosCulture(parcelle, coord, contenu);
        if (infos) liste.push(infos);
      });
    });
  });
  return liste;
}

// Regroupe les cases plantées avec la même plante, le même jour, dans la
// même parcelle (ex. une rangée de pommes de terre sur 5 m)
function regrouperCultures(cultures) {
  const groupes = new Map();
  cultures.forEach(c => {
    const cle = c.parcelle.id + "|" + c.plante.id + "|" + c.contenu.datePlantation;
    if (!groupes.has(cle)) groupes.set(cle, { ...c, cases: [] });
    groupes.get(cle).cases.push(c.coord);
  });
  return [...groupes.values()];
}

function compterCases() {
  let total = 0, occupees = 0;
  etat.parcelles.forEach(p => {
    total += p.largeur * p.hauteur;
    occupees += Object.keys(p.cases).filter(coord => dansLimites(p, coord) && culturesDe(p, coord).length).length;
  });
  return { total, occupees, libres: total - occupees };
}

// Rotation : une même famille est-elle passée ici récemment ?
function verifierRotation(parcelle, coord, planteId, dateReference = aujourdhui()) {
  const plante = planteParId(planteId);
  if (!plante || ROTATION_IGNORED_FAMILIES.includes(plante.famille)) return null;
  const limite = ajouterJours(dateReference, -3 * 365);
  const recents = parcelle.historique.filter(h =>
    h.famille === plante.famille && parseDate(h.fin) >= limite && parseDate(h.fin) <= dateReference
  ).sort((a, b) => parseDate(b.fin) - parseDate(a.fin));
  const memeCase = recents.find(h => h.coord === coord);
  const precedent = memeCase || recents[0];
  if (!precedent) return null;
  const anc = planteParId(precedent.planteId);
  const quand = parseDate(precedent.fin).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const famille = familleDe(plante).label;
  return memeCase
    ? `Des ${famille} (${anc ? anc.nom : "?"}) occupaient déjà cette case jusqu'en ${quand}. Idéalement, attends 3 ans avant d'y remettre la même famille.`
    : `Cette parcelle a accueilli des ${famille} (${anc ? anc.nom : "?"}) jusqu'en ${quand} : choisis plutôt une autre case si tu peux.`;
}

// Voisins : les autres cultures de la même case et celles des 8 cases autour
function voisinage(parcelle, x, y, planteId) {
  const amis = new Set(), ennemis = new Set();
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      culturesDe(parcelle, (x + dx) + "-" + (y + dy)).forEach(c => {
        if (c.planteId === planteId) return;
        const r = relation(planteId, c.planteId);
        const p = planteParId(c.planteId);
        if (r === "amis") amis.add(p.nom);
        if (r === "ennemis") ennemis.add(p.nom);
      });
    }
  }
  return { amis: [...amis], ennemis: [...ennemis] };
}

// Termine une culture : la case est libérée et l'historique garde sa trace
// pour les conseils de rotation des années suivantes
function terminerCulture(parcelle, coord, cid) {
  const c = (parcelle.cases[coord] || []).find(x => x.id === cid);
  if (!c) return;
  const plante = planteParId(c.planteId);
  if (plante) {
    parcelle.historique.push({
      coord, planteId: c.planteId, famille: plante.famille,
      debut: c.datePlantation || isoLocal(), fin: isoLocal()
    });
  }
  supprimerCulture(parcelle, coord, cid);
}

/* ============================================================
   Météo (Open-Meteo, gratuit et sans clé)
   ============================================================ */

const CODES_METEO = [
  [[0], "☀️", "Ensoleillé"], [[1, 2], "🌤️", "Éclaircies"], [[3], "☁️", "Couvert"],
  [[45, 48], "🌫️", "Brouillard"], [[51, 53, 55, 56, 57], "🌦️", "Bruine"],
  [[61, 63, 65, 66, 67], "🌧️", "Pluie"], [[71, 73, 75, 77, 85, 86], "🌨️", "Neige"],
  [[80, 81, 82], "🌦️", "Averses"], [[95, 96, 99], "⛈️", "Orage"]
];
function decrireMeteo(code) {
  const t = CODES_METEO.find(([codes]) => codes.includes(code));
  return t ? { icone: t[1], texte: t[2] } : { icone: "🌡️", texte: "" };
}

let meteoEnCours = null;
async function actualiserMeteo(force = false) {
  const lieu = etat.reglages.lieu;
  if (!lieu) return;
  const cle = lieu.lat.toFixed(2) + "," + lieu.lon.toFixed(2);
  const frais = meteo && meteo.cle === cle && Date.now() - meteo.at < 2 * 3600 * 1000;
  if (frais && !force) return;
  if (meteoEnCours) return meteoEnCours;
  meteoEnCours = (async () => {
    try {
      const url = "https://api.open-meteo.com/v1/forecast?latitude=" + lieu.lat + "&longitude=" + lieu.lon +
        "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_gusts_10m_max" +
        "&timezone=Europe%2FParis&forecast_days=5";
      const r = await fetch(url);
      if (!r.ok) throw new Error("HTTP " + r.status);
      const d = (await r.json()).daily;
      meteo = {
        cle, at: Date.now(),
        jours: d.time.map((t, i) => ({
          date: t, code: d.weather_code[i],
          tmin: d.temperature_2m_min[i], tmax: d.temperature_2m_max[i],
          pluie: d.precipitation_sum[i] || 0, rafales: d.wind_gusts_10m_max[i] || 0
        }))
      };
      ecrireJSON(CLE_METEO, meteo);
    } catch (e) {
      if (meteo && meteo.cle === cle) meteo.horsLigne = true;
      else meteo = { cle, erreur: true };
    } finally {
      meteoEnCours = null;
      if (ui.vue === "accueil") { rendreMeteo(); rendreCoach(); }
    }
  })();
  return meteoEnCours;
}

function joursMeteoValides() {
  const lieu = etat.reglages.lieu;
  if (!lieu || !meteo || !meteo.jours) return null;
  if (meteo.cle !== lieu.lat.toFixed(2) + "," + lieu.lon.toFixed(2)) return null;
  const auj = isoLocal();
  const jours = meteo.jours.filter(j => j.date >= auj);
  return jours.length ? jours : null;
}

/* ============================================================
   Le coach : conseils personnalisés selon le potager, la
   saison et la météo
   ============================================================ */

function genererCoaching() {
  const conseils = [];
  const m = moisCourant();
  const cultures = listerCultures();
  const jours = joursMeteoValides();

  if (jours) {
    const prochains = jours.slice(0, 4);
    const gel = prochains.find(j => j.tmin <= 1);
    if (gel) {
      const frileuses = [...new Set(cultures.filter(c => estFrileuse(c.plante)).map(c => c.plante.nom))];
      conseils.push({
        type: "alerte", icone: "❄️",
        titre: `Gel possible ${nomJour(gel.date)} (${Math.round(gel.tmin)} °C)`,
        texte: frileuses.length
          ? `Cultures sensibles chez toi : ${listeFr(frileuses.slice(0, 4))}. Couvre-les d'un voile d'hivernage la veille au soir, ou récolte ce qui peut l'être.`
          : "Couvre les jeunes semis et les plants fragiles d'un voile la veille au soir."
      });
    }
    const vent = prochains.find(j => j.rafales >= 60);
    if (vent) {
      conseils.push({
        type: "alerte", icone: "💨",
        titre: `Coup de vent ${nomJour(vent.date)} (rafales ${Math.round(vent.rafales)} km/h)`,
        texte: "Vérifie les tuteurs, lestes les voiles et ferme bien les serres ou tunnels."
      });
    }
    const pluieDouce = prochains.find(j => j.pluie >= 4 && j.tmin >= 7);
    if (pluieDouce && [3, 4, 5, 6, 9, 10].includes(m)) {
      conseils.push({
        type: "conseil", icone: "🐌",
        titre: `Pluie douce ${nomJour(pluieDouce.date)} : les limaces vont sortir`,
        texte: "Protège les jeunes plants (salades, choux, haricots) : barrière de cendre, pièges à bière ou ronde à la lampe à la tombée de la nuit."
      });
    }
    const pluie3j = prochains.slice(0, 3).reduce((s, j) => s + j.pluie, 0);
    const chaud = prochains.slice(0, 3).find(j => j.tmax >= 24);
    if (pluie3j < 1 && chaud && cultures.length) {
      conseils.push({
        type: "conseil", icone: "💧",
        titre: `Temps sec et ${Math.round(chaud.tmax)} °C ${nomJour(chaud.date)}`,
        texte: "Arrose copieusement au pied, tôt le matin ou le soir, et paille le sol pour garder la fraîcheur."
      });
    }
  }

  // Cultures en retard de récolte
  regrouperCultures(cultures).filter(c => c.statut === "retard").slice(0, 2).forEach(c => {
    conseils.push({
      type: "conseil", icone: "⏰",
      titre: `${c.plante.nom} dans « ${c.parcelle.nom} » : récolte en retard ?`,
      texte: `La récolte était attendue vers le ${formatDate(c.fenetre.debut)}. Vérifie-les : au-delà, elles risquent de durcir ou de monter en graines. Une fois fini, utilise « Fin de culture » pour libérer la place.`,
      action: { label: "Voir", parcelle: c.parcelle.id, coord: c.cases[0], cid: c.contenu.id }
    });
  });

  // Mauvais voisinages et rotations dans le potager actuel
  const dejaSignales = new Set();
  cultures.forEach(c => {
    const v = voisinage(c.parcelle, c.x, c.y, c.plante.id);
    v.ennemis.forEach(nom => {
      const cle = c.parcelle.id + [c.plante.nom, nom].sort().join("|");
      if (dejaSignales.has(cle)) return;
      dejaSignales.add(cle);
      conseils.push({
        type: "conseil", icone: "🤝",
        titre: `${c.plante.nom} et ${nom} sont voisins dans « ${c.parcelle.nom} »`,
        texte: "Ces deux-là s'entendent mal. Ce n'est pas grave pour cette saison, mais pense à les éloigner la prochaine fois."
      });
    });
  });

  // Place libre
  const { libres } = compterCases();
  if (libres > 0) {
    if ([11, 12, 1].includes(m)) {
      conseils.push({
        type: "conseil", icone: "🍂",
        titre: `${libres} m² libres pour l'hiver`,
        texte: "Couvre le sol nu (paille, feuilles mortes, engrais vert) : les pluies d'hiver bretonnes tassent et lessivent la terre non protégée."
      });
    } else {
      const idees = PLANTS_DB.filter(p => (p.moisSemis.includes(m) || p.moisPlantation.includes(m)) && p.categorie !== "fleur");
      if (idees.length) {
        conseils.push({
          type: "conseil", icone: "🌱",
          titre: `${libres} m² libres à occuper`,
          texte: `En ${MOIS_NOMS[m - 1]}, tu peux y mettre : ${listeFr(idees.slice(0, 5).map(nomCourt))}.`,
          action: { label: "Idées de saison", vue: "saisons" }
        });
      }
    }
  }

  // Sauvegarde
  const aDesDonnees = cultures.length > 0 || etat.journal.length > 0;
  const derniere = parseDate(etat.reglages.derniereSauvegarde);
  if (aDesDonnees && (!derniere || joursEntre(derniere, aujourdhui()) > 30)) {
    conseils.push({
      type: "conseil", icone: "💾",
      titre: derniere ? "Dernière sauvegarde il y a plus d'un mois" : "Pense à sauvegarder ton potager",
      texte: "Tes données ne vivent que dans ce navigateur. Exporte un fichier de sauvegarde de temps en temps.",
      action: { label: "Sauvegarder", vue: "reglages" }
    });
  }

  // Astuce du jour (change chaque jour)
  const pool = [
    ...GENERAL_TIPS.map(t => ({ titre: t.titre, texte: t.court })),
    ...PLANTS_DB.filter(p => p.conseilCourt && (p.moisSemis.includes(m) || p.moisPlantation.includes(m) || p.moisRecolte.includes(m)))
      .map(p => ({ titre: p.nom, texte: p.conseilCourt }))
  ];
  if (pool.length) {
    const debutAnnee = new Date(new Date().getFullYear(), 0, 0);
    const jourAnnee = joursEntre(debutAnnee, aujourdhui());
    const a = pool[jourAnnee % pool.length];
    conseils.push({ type: "astuce", icone: "💡", titre: "Astuce du jour : " + a.titre, texte: a.texte });
  }

  return conseils;
}

/* ============================================================
   Navigation (avec l'historique du navigateur : le bouton
   retour du téléphone fonctionne)
   ============================================================ */

function vueDepuisHash() {
  const v = location.hash.replace("#", "");
  return VUES.includes(v) ? v : "accueil";
}
function allerA(vue) {
  if (location.hash !== "#" + vue) location.hash = vue;
  else rendre();
}
function rendre() {
  ui.vue = vueDepuisHash();
  document.querySelectorAll(".vue").forEach(v => v.classList.toggle("actif", v.id === "vue-" + ui.vue));
  document.querySelectorAll("[data-vue]").forEach(b => {
    const actif = b.dataset.vue === ui.vue;
    b.classList.toggle("actif", actif);
    if (b.closest("nav")) b.setAttribute("aria-current", actif ? "page" : "false");
  });
  rendreEntete();
  ({ accueil: rendreAccueil, plan: rendrePlan, cultures: rendreCultures, saisons: rendreSaisons,
     journal: rendreJournal, reglages: rendreReglages })[ui.vue]();
}

function rendreEntete() {
  const auj = aujourdhui();
  document.getElementById("date-du-jour").textContent =
    majuscule(auj.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }));
  document.getElementById("badge-saison").textContent = SAISONS[saisonDuMois(auj.getMonth() + 1)];
}

/* ============================================================
   Plan SVG (accueil et onglet Plan)
   ============================================================ */

let compteurPlans = 0;
// Position et taille des icônes selon le nombre de cultures dans la case
const DISPOSITION_ICONES = {
  1: { taille: 44, pos: [[.5, .5]] },
  2: { taille: 34, pos: [[.3, .34], [.7, .66]] },
  3: { taille: 30, pos: [[.3, .3], [.7, .3], [.5, .72]] },
  4: { taille: 28, pos: [[.3, .3], [.7, .3], [.3, .7], [.7, .7]] },
  5: { taille: 24, pos: [[.28, .28], [.72, .28], [.5, .5], [.28, .74], [.72, .74]] }
};

function dessinerPlan(conteneur, { edition = false } = {}) {
  conteneur.innerHTML = "";
  if (!etat.parcelles.length) {
    conteneur.innerHTML = `<p class="vide">Ajoute une parcelle pour voir apparaître le plan de ton potager.</p>`;
    return;
  }
  const MARGE = 0.5, MARGE_HAUT = 0.75;
  // Le nom d'une parcelle étroite peut dépasser sa largeur : on l'estime
  const finNom = p => p.posX + MARGE + (p.nom.length * 16) / U;
  const maxX = Math.max(...etat.parcelles.map(p => Math.max(p.posX + p.largeur + MARGE, finNom(p))));
  const maxY = Math.max(...etat.parcelles.map(p => p.posY + p.hauteur));
  const largeur = (maxX + MARGE) * U;
  const hauteur = (maxY + MARGE + MARGE_HAUT) * U;

  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${largeur} ${hauteur}`);
  svg.setAttribute("class", "plan-svg" + (edition ? " en-edition" : ""));
  svg.setAttribute("role", "group");
  svg.setAttribute("aria-label", "Plan du potager");

  // Cases à plusieurs familles : fond en bandes nettes (dégradés SVG).
  // Les identifiants sont propres à chaque dessin pour ne pas se mélanger.
  const defs = document.createElementNS(NS, "defs");
  svg.appendChild(defs);
  const prefixe = "gr" + (++compteurPlans) + "-";
  const degrades = new Map();
  const remplissage = couleurs => {
    if (couleurs.length === 1) return couleurs[0];
    const cle = couleurs.join("");
    if (!degrades.has(cle)) {
      const id = prefixe + degrades.size;
      const lg = document.createElementNS(NS, "linearGradient");
      Object.entries({ id, x1: 0, y1: 0, x2: 1, y2: 1 }).forEach(([k, v]) => lg.setAttribute(k, v));
      const n = couleurs.length;
      couleurs.forEach((c, i) => [i / n, (i + 1) / n].forEach(off => {
        const stop = document.createElementNS(NS, "stop");
        stop.setAttribute("offset", off);
        stop.setAttribute("stop-color", c);
        lg.appendChild(stop);
      }));
      defs.appendChild(lg);
      degrades.set(cle, `url(#${id})`);
    }
    return degrades.get(cle);
  };

  const statuts = statutsParCase();

  etat.parcelles.forEach(parcelle => {
    const gx = (parcelle.posX + MARGE) * U;
    const gy = (parcelle.posY + MARGE_HAUT) * U;
    const g = document.createElementNS(NS, "g");
    g.setAttribute("class", "plan-parcelle");

    const fond = document.createElementNS(NS, "rect");
    Object.entries({ x: gx - 6, y: gy - 6, width: parcelle.largeur * U + 12, height: parcelle.hauteur * U + 12, rx: 10, class: "plan-bordure" })
      .forEach(([k, v]) => fond.setAttribute(k, v));
    g.appendChild(fond);

    for (let y = 0; y < parcelle.hauteur; y++) {
      for (let x = 0; x < parcelle.largeur; x++) {
        const coord = x + "-" + y;
        const plantes = culturesDe(parcelle, coord).map(c => planteParId(c.planteId));
        const rect = document.createElementNS(NS, "rect");
        Object.entries({ x: gx + x * U + 4, y: gy + y * U + 4, width: U - 8, height: U - 8, rx: 8 })
          .forEach(([k, v]) => rect.setAttribute(k, v));
        rect.setAttribute("class", "plan-case" + (plantes.length ? " occupee" : ""));
        if (plantes.length) rect.style.fill = remplissage(plantes.map(pl => familleDe(pl).color));
        if (!edition) {
          rect.setAttribute("tabindex", "0");
          rect.setAttribute("role", "button");
          rect.setAttribute("aria-label", parcelle.nom + ", case " + (x + 1) + "-" + (y + 1) + (plantes.length ? " : " + plantes.map(pl => pl.nom).join(", ") : " : vide"));
          const ouvrir = () => ouvrirEditeurCase(parcelle.id, x, y);
          rect.addEventListener("click", ouvrir);
          rect.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); ouvrir(); } });
        }
        g.appendChild(rect);

        if (plantes.length) {
          const mise = DISPOSITION_ICONES[Math.min(plantes.length, 5)];
          plantes.slice(0, 5).forEach((plante, i) => {
            const t = document.createElementNS(NS, "text");
            t.setAttribute("x", gx + x * U + mise.pos[i][0] * U);
            t.setAttribute("y", gy + y * U + mise.pos[i][1] * U);
            t.setAttribute("class", "plan-icone");
            t.style.fontSize = mise.taille + "px";
            t.textContent = iconePlante(plante);
            g.appendChild(t);
          });
          const statut = statuts[parcelle.id + "|" + coord];
          if (STATUTS_A_RECOLTER.includes(statut)) {
            const pastille = document.createElementNS(NS, "circle");
            Object.entries({ cx: gx + (x + 1) * U - 16, cy: gy + y * U + 16, r: 10, class: "plan-pastille" + (statut === "retard" ? " retard" : "") })
              .forEach(([k, v]) => pastille.setAttribute(k, v));
            g.appendChild(pastille);
          }
        }
      }
    }

    const label = document.createElementNS(NS, "text");
    label.setAttribute("x", gx);
    label.setAttribute("y", gy - 18);
    label.setAttribute("class", "plan-nom");
    label.textContent = parcelle.nom;
    g.appendChild(label);

    if (edition) activerGlisser(svg, g, parcelle);
    svg.appendChild(g);
  });

  conteneur.appendChild(svg);
}

function pointSVG(svg, evt) {
  const pt = svg.createSVGPoint();
  pt.x = evt.clientX; pt.y = evt.clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
}

// Déplacement des parcelles au doigt ou à la souris (pas de 50 cm)
function activerGlisser(svg, g, parcelle) {
  let depart = null, dx = 0, dy = 0;
  g.addEventListener("pointerdown", e => {
    e.preventDefault();
    g.setPointerCapture(e.pointerId);
    depart = pointSVG(svg, e);
    dx = dy = 0;
    g.classList.add("glisse");
  });
  g.addEventListener("pointermove", e => {
    if (!depart) return;
    const p = pointSVG(svg, e);
    dx = Math.round((p.x - depart.x) / U * 2) / 2;
    dy = Math.round((p.y - depart.y) / U * 2) / 2;
    g.setAttribute("transform", `translate(${dx * U} ${dy * U})`);
  });
  const fin = () => {
    if (!depart) return;
    depart = null;
    g.classList.remove("glisse");
    if (dx || dy) {
      parcelle.posX += dx;
      parcelle.posY += dy;
      normaliserPositions();
      sauvegarder();
    }
    rendrePlan();
  };
  g.addEventListener("pointerup", fin);
  g.addEventListener("pointercancel", fin);
}

/* ============================================================
   Accueil
   ============================================================ */

function rendreAccueil() {
  const vue = document.getElementById("vue-accueil");
  const { total, occupees } = compterCases();
  vue.innerHTML = `
    <section class="carte carte-plan">
      <div class="carte-titre">
        <h2>Mon potager</h2>
        <span class="carte-sous-titre">${occupees} m² cultivés sur ${total} m²</span>
      </div>
      <div id="plan-accueil" class="plan-zone"></div>
      <div class="legende-plan">
        <span><span class="puce puce-recolte"></span>prêt à récolter</span>
        <span><span class="puce puce-retard"></span>récolte en retard</span>
        <span class="legende-aide">Touche une case pour la modifier</span>
      </div>
    </section>
    <section class="carte">
      <div class="carte-titre"><h2>Le coach du jour</h2></div>
      <div id="coach"></div>
    </section>
    <section class="carte">
      <div class="carte-titre"><h2>Météo du jardin</h2><span class="carte-sous-titre" id="meteo-lieu"></span></div>
      <div id="meteo"></div>
    </section>
    <section class="carte">
      <div class="carte-titre"><h2>Récoltes</h2></div>
      <div id="rappels"></div>
    </section>
    <section class="carte">
      <div class="carte-titre"><h2>En ${MOIS_NOMS[moisCourant() - 1]} au potager</h2></div>
      <div id="taches-du-mois"></div>
    </section>`;

  dessinerPlan(document.getElementById("plan-accueil"));
  rendreCoach();
  rendreMeteo();
  rendreRappels();
  rendreTachesDuMois();
  actualiserMeteo();
}

function rendreCoach() {
  const zone = document.getElementById("coach");
  if (!zone) return;
  const conseils = genererCoaching();
  const VISIBLES = 4;
  const item = (c, i) => `
    <div class="coach-item coach-${c.type}">
      <span class="coach-icone" aria-hidden="true">${c.icone}</span>
      <div class="coach-corps">
        <div class="coach-titre">${esc(c.titre)}</div>
        <div class="coach-texte">${esc(c.texte)}</div>
        ${c.action ? `<button class="lien-bouton" data-coach="${i}">${esc(c.action.label)}</button>` : ""}
      </div>
    </div>`;
  const reste = conseils.length - VISIBLES;
  zone.innerHTML = conseils.slice(0, VISIBLES).map(item).join("") + (reste > 0 ? `
    <details class="coach-plus">
      <summary>${reste} autre${reste > 1 ? "s" : ""} conseil${reste > 1 ? "s" : ""}</summary>
      ${conseils.slice(VISIBLES).map((c, i) => item(c, i + VISIBLES)).join("")}
    </details>` : "");
  zone.querySelectorAll("[data-coach]").forEach(b => b.addEventListener("click", () => {
    const a = conseils[+b.dataset.coach].action;
    if (a.vue) allerA(a.vue);
    else if (a.parcelle) {
      const [x, y] = a.coord.split("-").map(Number);
      ouvrirEditeurCase(a.parcelle, x, y, { editId: a.cid });
    }
  }));
}

function rendreMeteo() {
  const zone = document.getElementById("meteo");
  if (!zone) return;
  const lieu = etat.reglages.lieu;
  const zoneLieu = document.getElementById("meteo-lieu");
  if (zoneLieu) zoneLieu.textContent = lieu ? lieu.nom : "";
  if (!lieu) {
    zone.innerHTML = `
      <p class="texte-doux">Indique ta commune pour recevoir les alertes gel, coups de vent et limaces du coach.</p>
      <button class="btn" data-vue-lien="reglages">Choisir ma commune</button>`;
    zone.querySelector("[data-vue-lien]").addEventListener("click", () => allerA("reglages"));
    return;
  }
  const jours = joursMeteoValides();
  if (!jours) {
    zone.innerHTML = meteo && meteo.erreur
      ? `<p class="vide">Prévisions indisponibles pour le moment (pas de réseau ?).</p>`
      : `<p class="vide">Chargement des prévisions…</p>`;
    return;
  }
  zone.innerHTML = `
    <div class="meteo-jours">
      ${jours.slice(0, 5).map(j => {
        const d = decrireMeteo(j.code);
        const gel = j.tmin <= 1;
        return `
        <div class="meteo-jour${gel ? " gel" : ""}">
          <div class="meteo-nom">${esc(nomJourCourt(j.date))}</div>
          <div class="meteo-icone" title="${esc(d.texte)}">${d.icone}</div>
          <div class="meteo-temp"><strong>${Math.round(j.tmax)}°</strong> <span>${Math.round(j.tmin)}°</span></div>
          <div class="meteo-detail">${j.pluie >= 0.5 ? formatNombre(Math.round(j.pluie)) + " mm" : "sec"}</div>
          ${j.rafales >= 50 ? `<div class="meteo-detail vent">💨 ${Math.round(j.rafales)}</div>` : ""}
        </div>`;
      }).join("")}
    </div>
    ${meteo.horsLigne ? `<p class="texte-doux petit">Hors ligne : dernières prévisions connues.</p>` : ""}`;
}

function rendreRappels() {
  const zone = document.getElementById("rappels");
  const groupes = regrouperCultures(listerCultures())
    .filter(c => [...STATUTS_A_RECOLTER, "bientot"].includes(c.statut))
    .sort((a, b) => {
      const ordre = { retard: 0, recolter: 1, cueillette: 2, bientot: 3 };
      return ordre[a.statut] - ordre[b.statut];
    });
  if (!groupes.length) {
    const prochaine = regrouperCultures(listerCultures())
      .filter(c => c.fenetre && c.statut === "a-venir")
      .sort((a, b) => a.fenetre.debut - b.fenetre.debut)[0];
    zone.innerHTML = `<p class="vide">Rien à récolter pour l'instant.${prochaine
      ? ` Prochaine récolte : ${esc(prochaine.plante.nom)} vers le ${formatDate(prochaine.fenetre.debut)}.` : ""}</p>`;
    return;
  }
  zone.innerHTML = groupes.map(ligneCulture).join("");
  brancherLignesCulture(zone);
}

function rendreTachesDuMois() {
  const zone = document.getElementById("taches-du-mois");
  const m = moisCourant();
  const infos = MONTHLY_ADVICE.find(x => x.mois === m);
  const idees = PLANTS_DB.filter(p => p.moisSemis.includes(m) || p.moisPlantation.includes(m));
  zone.innerHTML = `
    ${infos ? `<ul class="liste-taches">${infos.court.map(t => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
    ${infos && infos.detail ? `<details class="accordeon"><summary>Pourquoi ces gestes en Bretagne ?</summary><p>${esc(infos.detail)}</p></details>` : ""}
    ${idees.length ? `
      <h3 class="sous-titre-section">À semer ou planter ce mois-ci</h3>
      <div class="chips">${idees.map(p => `<button class="chip" data-fiche="${p.id}">${iconePlante(p)} ${esc(p.nom)}</button>`).join("")}</div>` : ""}`;
  brancherFiches(zone);
}

/* ---------- Ligne de culture (accueil + onglet Cultures) ---------- */

function ligneCulture(c) {
  const st = STATUTS[c.statut];
  const n = c.cases.length;
  let detail = "Planté le " + formatDate(c.datePlantation);
  if (c.fenetre) {
    if (["a-venir", "bientot"].includes(c.statut)) {
      const j = joursEntre(aujourdhui(), c.fenetre.debut);
      detail += `, récolte dans ${j} jour${j > 1 ? "s" : ""} environ`;
    } else {
      detail += `, récolte du ${formatDate(c.fenetre.debut)} au ${formatDate(c.fenetre.fin)}`;
    }
  }
  return `
    <button class="ligne-culture" data-parcelle="${c.parcelle.id}" data-coord="${c.cases[0]}" data-cid="${c.contenu.id}">
      <span class="ligne-icone" style="background:${familleDe(c.plante).color}">${iconePlante(c.plante)}</span>
      <span class="ligne-corps">
        <span class="ligne-titre">${esc(c.plante.nom)}<span class="ligne-lieu">${esc(c.parcelle.nom)}${n > 1 ? `, ${n} m²` : ""}</span></span>
        <span class="ligne-detail">${esc(detail)}${c.contenu.notes ? " — " + esc(c.contenu.notes) : ""}</span>
        ${c.progression !== null ? `<span class="progression" aria-hidden="true"><span style="width:${Math.round(c.progression * 100)}%"></span></span>` : ""}
      </span>
      <span class="etat ${st.classe}">${st.texte}</span>
    </button>`;
}
function brancherLignesCulture(zone) {
  zone.querySelectorAll(".ligne-culture").forEach(b => b.addEventListener("click", () => {
    const [x, y] = b.dataset.coord.split("-").map(Number);
    ouvrirEditeurCase(b.dataset.parcelle, x, y, { editId: b.dataset.cid });
  }));
}

/* ============================================================
   Onglet Plan
   ============================================================ */

function rendrePlan() {
  const vue = document.getElementById("vue-plan");
  vue.innerHTML = `
    <section class="carte">
      <div class="carte-titre">
        <h2>Vue d'ensemble</h2>
        <button class="btn-discret${ui.editionDisposition ? " actif" : ""}" id="btn-disposition">
          ${ui.editionDisposition ? "Terminer" : "Déplacer les parcelles"}
        </button>
      </div>
      <p class="texte-doux petit">${ui.editionDisposition
        ? "Fais glisser les parcelles pour reproduire la disposition de ton jardin. Elles s'alignent tous les 50 cm."
        : "Touche une case pour planter, récolter ou ajouter une note. Chaque case fait 1 m × 1 m."}</p>
      <div id="plan-global" class="plan-zone"></div>
    </section>
    <section class="carte">
      <div class="carte-titre"><h2>Détail des parcelles</h2></div>
      <div id="liste-parcelles"></div>
      <button class="btn" id="btn-ajouter-parcelle">+ Ajouter une parcelle</button>
    </section>`;

  dessinerPlan(document.getElementById("plan-global"), { edition: ui.editionDisposition });
  document.getElementById("btn-disposition").addEventListener("click", () => {
    ui.editionDisposition = !ui.editionDisposition;
    rendrePlan();
  });
  document.getElementById("btn-ajouter-parcelle").addEventListener("click", ajouterParcelle);

  const zone = document.getElementById("liste-parcelles");
  if (!etat.parcelles.length) {
    zone.innerHTML = `<p class="vide">Aucune parcelle. Ajoute la première ci-dessous.</p>`;
    return;
  }
  const statuts = statutsParCase();

  zone.innerHTML = etat.parcelles.map(p => {
    let cases = "";
    for (let y = 0; y < p.hauteur; y++) {
      for (let x = 0; x < p.largeur; x++) {
        const coord = x + "-" + y;
        const cs = culturesDe(p, coord);
        const plantes = cs.map(c => planteParId(c.planteId));
        const statut = statuts[p.id + "|" + coord];
        const pastille = STATUTS_A_RECOLTER.includes(statut) ? `<span class="case-pastille${statut === "retard" ? " retard" : ""}"></span>` : "";
        const lieu = `data-parcelle="${p.id}" data-x="${x}" data-y="${y}"`;
        if (!plantes.length) {
          cases += `<button class="case" ${lieu} aria-label="Case vide ${x + 1}-${y + 1}"><span class="case-vide">+</span></button>`;
        } else if (plantes.length === 1) {
          cases += `<button class="case occupee" ${lieu}
               style="--famille:${familleDe(plantes[0]).color}" title="${esc(plantes[0].nom)}, planté le ${esc(formatDate(cs[0].datePlantation))}">
               ${pastille}
               <span class="case-icone">${iconePlante(plantes[0])}</span><span class="case-nom">${esc(nomCourt(plantes[0]))}</span>
             </button>`;
        } else {
          cases += `<button class="case occupee multi" ${lieu}
               style="background:${fondDegrade(plantes.map(pl => familleDe(pl).color))}" title="${esc(plantes.map(pl => pl.nom).join(", "))}"
               aria-label="Case ${x + 1}-${y + 1} : ${esc(plantes.map(pl => pl.nom).join(", "))}">
               ${pastille}
               <span class="case-icones">${plantes.slice(0, 5).map(pl => `<span>${iconePlante(pl)}</span>`).join("")}</span>
             </button>`;
        }
      }
    }
    const familles = [...new Set(Object.keys(p.cases)
      .filter(coord => dansLimites(p, coord))
      .flatMap(coord => culturesDe(p, coord))
      .map(c => planteParId(c.planteId).famille))];
    return `
      <div class="parcelle-bloc" id="parcelle-${p.id}">
        <div class="parcelle-entete">
          <h3>${esc(p.nom)} <span class="dimensions">${formatNombre(p.largeur)} × ${formatNombre(p.hauteur)} m</span></h3>
          <button class="btn-discret" data-modifier="${p.id}">Modifier</button>
        </div>
        <div class="grille-carres" style="grid-template-columns:repeat(${p.largeur}, minmax(30px, 64px))">${cases}</div>
        ${familles.length ? `<div class="legende">${familles.map(f => `<span><span class="puce" style="background:${FAMILIES[f].color}"></span>${FAMILIES[f].label}</span>`).join("")}</div>` : ""}
      </div>`;
  }).join("");

  zone.querySelectorAll(".case").forEach(b => b.addEventListener("click", () =>
    ouvrirEditeurCase(b.dataset.parcelle, +b.dataset.x, +b.dataset.y)));
  zone.querySelectorAll("[data-modifier]").forEach(b => b.addEventListener("click", () =>
    ouvrirReglagesParcelle(b.dataset.modifier)));
}

function ajouterParcelle() {
  const posY = etat.parcelles.length ? Math.max(...etat.parcelles.map(p => p.posY + p.hauteur)) + 1 : 0;
  const parcelle = { id: creerId(), nom: "Parcelle " + (etat.parcelles.length + 1), largeur: 3, hauteur: 1, posX: 0, posY, cases: {}, historique: [] };
  etat.parcelles.push(parcelle);
  sauvegarder();
  rendrePlan();
  ouvrirReglagesParcelle(parcelle.id);
}

function ouvrirReglagesParcelle(id) {
  const p = etat.parcelles.find(x => x.id === id);
  if (!p) return;
  ouvrirFenetre(`
    <h2>Modifier la parcelle</h2>
    <label for="rp-nom">Nom</label>
    <input id="rp-nom" type="text" value="${esc(p.nom)}" maxlength="40">
    <div class="ligne-champs deux">
      <div><label for="rp-l">Largeur (m)</label><input id="rp-l" type="number" min="1" max="20" step="1" value="${p.largeur}"></div>
      <div><label for="rp-h">Profondeur (m)</label><input id="rp-h" type="number" min="1" max="20" step="1" value="${p.hauteur}"></div>
    </div>
    <p class="texte-doux petit">Pour placer la parcelle sur le plan, utilise « Déplacer les parcelles » dans la vue d'ensemble.</p>
    <div class="actions-fenetre">
      <button class="btn" id="rp-ok">Enregistrer</button>
      <button class="btn-discret" id="rp-pivoter">Pivoter d'un quart de tour</button>
      <button class="btn-danger" id="rp-suppr">Supprimer</button>
    </div>`, fen => {
    fen.querySelector("#rp-ok").addEventListener("click", () => {
      const nom = fen.querySelector("#rp-nom").value.trim() || p.nom;
      const l = clamp(parseInt(fen.querySelector("#rp-l").value, 10) || 1, 1, 20);
      const h = clamp(parseInt(fen.querySelector("#rp-h").value, 10) || 1, 1, 20);
      const horsLimites = Object.keys(p.cases).filter(coord => {
        const [x, y] = coord.split("-").map(Number);
        return culturesDe(p, coord).length && (x >= l || y >= h);
      });
      fermerFenetre();
      avecAnnulation(horsLimites.length
        ? `Parcelle réduite : ${horsLimites.length} culture(s) hors du cadre retirée(s).`
        : "Parcelle enregistrée.", () => {
        p.nom = nom; p.largeur = l; p.hauteur = h;
        horsLimites.forEach(coord => culturesDe(p, coord).forEach(c => terminerCulture(p, coord, c.id)));
      });
    });
    fen.querySelector("#rp-pivoter").addEventListener("click", () => {
      fermerFenetre();
      avecAnnulation("Parcelle pivotée.", () => {
        const nouvellesCases = {};
        Object.entries(p.cases).forEach(([coord, c]) => {
          const [x, y] = coord.split("-").map(Number);
          nouvellesCases[(p.hauteur - 1 - y) + "-" + x] = c;
        });
        p.historique.forEach(hh => {
          const [x, y] = hh.coord.split("-").map(Number);
          hh.coord = (p.hauteur - 1 - y) + "-" + x;
        });
        [p.largeur, p.hauteur] = [p.hauteur, p.largeur];
        p.cases = nouvellesCases;
      });
    });
    fen.querySelector("#rp-suppr").addEventListener("click", () => {
      fermerFenetre();
      avecAnnulation(`« ${p.nom} » supprimée.`, () => {
        etat.parcelles = etat.parcelles.filter(x => x.id !== p.id);
        normaliserPositions();
      });
    });
  });
}

/* ============================================================
   Éditeur d'une case (fenêtre)
   ============================================================ */

function ouvrirEditeurCase(parcelleId, x, y, { editId = null, recolteId = null } = {}) {
  const parcelle = etat.parcelles.find(p => p.id === parcelleId);
  if (!parcelle) return;
  const coord = x + "-" + y;
  const cultures = culturesDe(parcelle, coord);
  const edite = editId ? cultures.find(c => c.id === editId) || null : null;
  const recolte = recolteId ? cultures.find(c => c.id === recolteId) || null : null;
  const pleine = !edite && cultures.length >= MAX_CULTURES_PAR_CASE;
  const m = moisCourant();
  // Une même plante ne peut pas être deux fois dans la même case
  const dejaLa = new Set(cultures.filter(c => !edite || c.id !== edite.id).map(c => c.planteId));
  const plantesTriees = PLANTS_DB.slice().sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  const deSaison = plantesTriees.filter(p => p.moisSemis.includes(m) || p.moisPlantation.includes(m));
  const autres = plantesTriees.filter(p => !deSaison.includes(p));
  const option = p => `<option value="${p.id}"${edite && edite.planteId === p.id ? " selected" : ""}${dejaLa.has(p.id) ? " disabled" : ""}>${iconePlante(p)} ${esc(p.nom)}${dejaLa.has(p.id) ? " (déjà dans cette case)" : ""}</option>`;
  const autresVides = [];
  for (let yy = 0; yy < parcelle.hauteur; yy++)
    for (let xx = 0; xx < parcelle.largeur; xx++) {
      const cc = xx + "-" + yy;
      if (cc !== coord && !culturesDe(parcelle, cc).length) autresVides.push(cc);
    }

  const lignes = cultures.map(c => {
    const plante = planteParId(c.planteId);
    const inf = infosCulture(parcelle, coord, c);
    const st = inf ? STATUTS[inf.statut] : null;
    return `
      <div class="culture-case${edite && edite.id === c.id ? " en-edition" : ""}">
        <span class="ligne-icone" style="background:${familleDe(plante).color}">${iconePlante(plante)}</span>
        <div class="cc-corps">
          <div class="ligne-titre">${esc(plante.nom)}</div>
          <div class="ligne-detail">Planté le ${esc(formatDate(c.datePlantation))}${c.notes ? " — " + esc(c.notes) : ""}</div>
          ${inf && inf.progression !== null ? `<span class="progression" aria-hidden="true"><span style="width:${Math.round(inf.progression * 100)}%"></span></span>` : ""}
          ${st ? `<span class="etat ${st.classe}">${st.texte}</span>` : ""}
        </div>
        <div class="cc-actions">
          <button class="btn-discret" data-act="edit" data-cid="${c.id}">Modifier</button>
          <button class="btn-discret" data-act="recolte" data-cid="${c.id}" aria-label="Noter une récolte de ${esc(plante.nom)}">🧺 Récolte</button>
          <button class="btn-discret" data-act="fin" data-cid="${c.id}" aria-label="Fin de culture : ${esc(plante.nom)}">Fin de culture</button>
        </div>
      </div>`;
  }).join("");

  const nomRecolte = recolte ? planteParId(recolte.planteId).nom : "";

  ouvrirFenetre(`
    <h2>${esc(parcelle.nom)}, case ${x + 1}${parcelle.hauteur > 1 ? "-" + (y + 1) : ""}</h2>
    ${cultures.length
      ? `<div class="cultures-case">${lignes}</div>`
      : `<p class="texte-doux">Case vide. Tu peux y mettre plusieurs cultures, par exemple des plantes qui s'entendent bien comme la tomate et le basilic.</p>`}
    ${recolte ? `
    <div id="ec-zone-recolte">
      <h3 class="sous-titre-section">Récolte : ${esc(nomRecolte)}</h3>
      <div class="ligne-champs deux">
        <div><label for="ec-qte">Quantité (facultatif)</label><input type="number" id="ec-qte" min="0" step="0.1" inputmode="decimal"></div>
        <div><label for="ec-unite">Unité</label>
          <select id="ec-unite"><option value="kg">kg</option><option value="g">g</option><option value="pièces">pièces</option><option value="bottes">bottes</option></select></div>
      </div>
      <label class="case-a-cocher"><input type="checkbox" id="ec-recolte-fin"> C'était la dernière récolte (retirer ${esc(nomRecolte)} de la case)</label>
      <div class="actions-fenetre">
        <button class="btn" id="ec-recolte-ok">Enregistrer la récolte</button>
        <button class="btn-discret" id="ec-recolte-annuler">Annuler</button>
      </div>
    </div>` : ""}
    <div id="ec-form" class="ec-form">
      <h3 class="sous-titre-section">${edite ? "Modifier : " + esc(planteParId(edite.planteId).nom) : cultures.length ? "Ajouter une autre culture" : "Ajouter une culture"}</h3>
      ${pleine ? `<p class="vide">Cette case est pleine (${MAX_CULTURES_PAR_CASE} cultures au maximum). Termine une culture pour faire de la place.</p>` : `
      <label for="ec-plante">Plante</label>
      <select id="ec-plante">
        <option value="">— Choisir une plante —</option>
        <optgroup label="De saison en ${MOIS_NOMS[m - 1]}">${deSaison.map(option).join("")}</optgroup>
        <optgroup label="Autres plantes">${autres.map(option).join("")}</optgroup>
      </select>
      <div class="ligne-champs deux">
        <div>
          <label for="ec-date">Semé ou planté le</label>
          <input type="date" id="ec-date" value="${edite && edite.datePlantation ? esc(edite.datePlantation.slice(0, 10)) : isoLocal()}">
        </div>
        <div>
          <label for="ec-notes">Variété, remarque</label>
          <input type="text" id="ec-notes" maxlength="120" placeholder="ex. Cœur de bœuf" value="${esc(edite ? edite.notes : "")}">
        </div>
      </div>
      <div id="ec-aide" class="aide-plante" aria-live="polite"></div>
      ${!edite && autresVides.length ? `
        <label class="case-a-cocher" id="ec-toutes-ligne" hidden>
          <input type="checkbox" id="ec-toutes"> Mettre la même chose dans les ${autresVides.length} autres cases vides de cette parcelle
        </label>` : ""}
      <div class="actions-fenetre">
        <button class="btn" id="ec-ok">${edite ? "Enregistrer" : "Ajouter à la case"}</button>
        ${edite ? `<button class="btn-discret" id="ec-annuler-edit">Annuler la modification</button>
                   <button class="btn-danger" id="ec-suppr">Supprimer (erreur de saisie)</button>` : ""}
      </div>`}
    </div>
    <div class="actions-fenetre"><button class="btn-discret" id="ec-fermer">Fermer</button></div>`, fen => {
    const rouvrir = options => ouvrirEditeurCase(parcelleId, x, y, options);
    fen.querySelector("#ec-fermer").addEventListener("click", fermerFenetre);

    // Actions sur chaque culture de la case
    fen.querySelectorAll("[data-act]").forEach(b => b.addEventListener("click", () => {
      const cid = b.dataset.cid;
      const c = cultures.find(k => k.id === cid);
      if (!c) return;
      if (b.dataset.act === "edit") rouvrir({ editId: cid });
      else if (b.dataset.act === "recolte") rouvrir({ recolteId: cid });
      else avecAnnulation(`Fin de culture : ${planteParId(c.planteId).nom} retiré(e) de la case.`, () => terminerCulture(parcelle, coord, cid));
    }));

    if (recolte) {
      const rp = planteParId(recolte.planteId);
      fen.querySelector("#ec-recolte-annuler").addEventListener("click", () => rouvrir());
      fen.querySelector("#ec-recolte-ok").addEventListener("click", () => {
        const qte = parseFloat(String(fen.querySelector("#ec-qte").value).replace(",", "."));
        const unite = fen.querySelector("#ec-unite").value;
        const derniere = fen.querySelector("#ec-recolte-fin").checked;
        const avecQte = Number.isFinite(qte) && qte > 0;
        avecAnnulation(`Récolte de ${rp.nom} notée.`, () => {
          etat.journal.unshift({
            id: creerId(), date: isoLocal(), type: "recolte", planteId: recolte.planteId, parcelleId: parcelle.id,
            quantite: avecQte ? qte : null, unite,
            texte: `Récolte : ${rp.nom} (${parcelle.nom})${avecQte ? ` — ${formatNombre(qte)} ${unite}` : ""}`
          });
          if (derniere) terminerCulture(parcelle, coord, recolte.id);
        });
      });
    }

    const sel = fen.querySelector("#ec-plante");
    if (sel) {
      const dateInput = fen.querySelector("#ec-date");
      const aide = fen.querySelector("#ec-aide");
      const ligneToutes = fen.querySelector("#ec-toutes-ligne");

      const majAide = () => {
        const plante = planteParId(sel.value);
        if (ligneToutes) ligneToutes.hidden = !plante;
        if (!plante) { aide.innerHTML = ""; return; }
        const morceaux = [];
        const dp = parseDate(dateInput.value) || aujourdhui();
        const f = fenetreRecolte(plante, dp);
        if (f) morceaux.push(`<p>🧺 Récolte estimée à partir du <strong>${formatDate(f.debut)}</strong>.</p>`);
        else if (plante.moisRecolte.length && plante.moisRecolte.length < 12)
          morceaux.push(`<p>🧺 Se récolte en ${listeFr(plante.moisRecolte.map(i => MOIS_NOMS[i - 1]))}.</p>`);
        if (!(edite && edite.planteId === plante.id)) {
          const rot = verifierRotation(parcelle, coord, plante.id, dp);
          if (rot) morceaux.push(`<p class="aide-alerte">🔄 ${esc(rot)}</p>`);
        }
        const v = voisinage(parcelle, x, y, plante.id);
        if (v.ennemis.length) morceaux.push(`<p class="aide-alerte">🤝 À éviter à côté de ${esc(listeFr(v.ennemis))}.</p>`);
        if (v.amis.length) morceaux.push(`<p class="aide-bien">🤝 S'entend bien avec ${esc(listeFr(v.amis))}.</p>`);
        if (plante.conseilCourt) morceaux.push(`<p>💡 ${esc(plante.conseilCourt)}</p>`);
        morceaux.push(`<button class="lien-bouton" data-fiche="${plante.id}">Voir la fiche complète</button>`);
        aide.innerHTML = morceaux.join("");
        aide.querySelector("[data-fiche]").addEventListener("click", () =>
          ouvrirFichePlante(plante.id, () => rouvrir({ editId: edite ? edite.id : null })));
      };
      sel.addEventListener("change", majAide);
      dateInput.addEventListener("change", majAide);
      majAide();

      fen.querySelector("#ec-ok").addEventListener("click", () => {
        const planteId = sel.value;
        if (!planteId) {
          aide.innerHTML = `<p class="aide-alerte">Choisis d'abord une plante.</p>`;
          sel.focus();
          return;
        }
        const plante = planteParId(planteId);
        const date = dateInput.value || isoLocal();
        const notes = fen.querySelector("#ec-notes").value.trim();
        if (edite) {
          avecAnnulation("Culture modifiée.", () => {
            edite.planteId = planteId; edite.datePlantation = date; edite.notes = notes;
          });
          return;
        }
        const toutes = fen.querySelector("#ec-toutes");
        const etendre = !!(toutes && toutes.checked && ligneToutes && !ligneToutes.hidden);
        avecAnnulation(etendre ? `${plante.nom} planté(e) sur ${autresVides.length + 1} cases.` : `${plante.nom} ajouté(e) à la case.`, () => {
          ajouterCulture(parcelle, coord, { planteId, datePlantation: date, notes });
          if (etendre) autresVides.forEach(cc => ajouterCulture(parcelle, cc, { planteId, datePlantation: date, notes }));
          etat.journal.unshift({ id: creerId(), date, type: "semis", planteId, parcelleId: parcelle.id,
            texte: `${plante.nom} en place dans « ${parcelle.nom} »${etendre ? ` (${autresVides.length + 1} m²)` : ""}${notes ? " — " + notes : ""}` });
        });
      });

      if (edite) {
        fen.querySelector("#ec-annuler-edit").addEventListener("click", () => rouvrir());
        fen.querySelector("#ec-suppr").addEventListener("click", () => {
          avecAnnulation("Culture supprimée.", () => supprimerCulture(parcelle, coord, edite.id));
        });
      }
    }

    // Amène le formulaire ou la zone de récolte à l'écran quand on vient d'en choisir un
    const cible = recolte ? "#ec-zone-recolte" : edite ? "#ec-form" : null;
    if (cible) fen.querySelector(cible).scrollIntoView({ block: "nearest" });
    if (recolte) fen.querySelector("#ec-qte").focus({ preventScroll: true });
  });
  // Le contenu se rafraîchit tout seul après chaque modification (ou annulation)
  ui.rafraichirFenetre = () => ouvrirEditeurCase(parcelleId, x, y);
}

/* ============================================================
   Fiche plante (fenêtre)
   ============================================================ */

function bandeauMois(p, { entete = true } = {}) {
  const m = moisCourant();
  return `
    <div class="bandeau-mois">
      ${MOIS_INITIALES.map((l, i) => {
        const mois = i + 1;
        return `<div class="bm-col${mois === m ? " courant" : ""}">
          ${entete ? `<span class="bm-lettre">${l}</span>` : ""}
          <span class="bm-barre s${p.moisSemis.includes(mois) ? " on" : ""}"></span>
          <span class="bm-barre p${p.moisPlantation.includes(mois) ? " on" : ""}"></span>
          <span class="bm-barre r${p.moisRecolte.includes(mois) ? " on" : ""}"></span>
        </div>`;
      }).join("")}
    </div>`;
}
const LEGENDE_CALENDRIER = `
  <div class="legende legende-calendrier">
    <span><span class="puce bm-s"></span>semis</span>
    <span><span class="puce bm-p"></span>plantation</span>
    <span><span class="puce bm-r"></span>récolte</span>
  </div>`;

function ouvrirFichePlante(id, retour = null) {
  const p = planteParId(id);
  if (!p) return;
  const f = familleDe(p);
  const amis = COMPAGNONS[p.id] ? [...COMPAGNONS[p.id].amis].map(i => planteParId(i).nom) : [];
  const ennemis = COMPAGNONS[p.id] ? [...COMPAGNONS[p.id].ennemis].map(i => planteParId(i).nom) : [];
  ouvrirFenetre(`
    <h2>${iconePlante(p)} ${esc(p.nom)}</h2>
    <p class="meta-plante"><span class="tag-famille" style="background:${f.color}">${f.label}</span>
      ${esc(majuscule(p.exposition))}${p.espacementCm ? `, espacer d'environ ${p.espacementCm} cm` : ""}</p>
    ${bandeauMois(p)}
    ${LEGENDE_CALENDRIER}
    ${p.conseilCourt ? `<p class="conseil-fort">${esc(p.conseilCourt)}</p>` : ""}
    ${p.conseilDetail ? `<p class="texte-doux">${esc(p.conseilDetail)}</p>` : ""}
    ${amis.length ? `<p><strong>Bons voisins :</strong> ${esc(listeFr(amis))}.</p>` : ""}
    ${ennemis.length ? `<p><strong>À éloigner :</strong> ${esc(listeFr(ennemis))}.</p>` : ""}
    <div class="actions-fenetre"><button class="btn-discret" id="fp-fermer">${retour ? "Retour" : "Fermer"}</button></div>`, fen => {
    fen.querySelector("#fp-fermer").addEventListener("click", retour || fermerFenetre);
  });
}

function brancherFiches(zone) {
  zone.querySelectorAll("[data-fiche]").forEach(b => b.addEventListener("click", () => ouvrirFichePlante(b.dataset.fiche)));
}

/* ============================================================
   Onglet Cultures
   ============================================================ */

function rendreCultures() {
  const vue = document.getElementById("vue-cultures");
  const groupes = regrouperCultures(listerCultures());
  if (!groupes.length) {
    vue.innerHTML = `<section class="carte"><div class="carte-titre"><h2>Mes cultures</h2></div>
      <p class="vide">Aucune culture en place. Touche une case du plan pour planter quelque chose.</p>
      <button class="btn" id="btn-vers-plan">Ouvrir le plan</button></section>`;
    vue.querySelector("#btn-vers-plan").addEventListener("click", () => allerA("plan"));
    return;
  }
  const ordre = { retard: 0, recolter: 1, cueillette: 2, bientot: 3, "a-venir": 4, "cueillette-libre": 5, "en-place": 6 };
  vue.innerHTML = etat.parcelles.map(p => {
    const liste = groupes.filter(g => g.parcelle.id === p.id)
      .sort((a, b) => ordre[a.statut] - ordre[b.statut] || a.datePlantation - b.datePlantation);
    if (!liste.length) return "";
    return `<section class="carte">
      <div class="carte-titre"><h2>${esc(p.nom)}</h2><span class="carte-sous-titre">${Object.keys(p.cases).filter(k => culturesDe(p, k).length).length} / ${p.largeur * p.hauteur} m² occupés</span></div>
      ${liste.map(ligneCulture).join("")}
    </section>`;
  }).join("");
  brancherLignesCulture(vue);
}

/* ============================================================
   Onglet Saisons (idées, calendrier, fiches)
   ============================================================ */

function rendreSaisons() {
  const vue = document.getElementById("vue-saisons");
  const categories = [["toutes", "Tout"], ["legume", "🥕 Légumes"], ["fruit", "🍓 Fruits"], ["aromate", "🌿 Aromates"], ["fleur", "🌼 Fleurs"]];
  vue.innerHTML = `
    <section class="carte">
      <div class="onglets-internes" role="tablist">
        <button role="tab" aria-selected="${ui.vueSaisons === "mois"}" data-vs="mois">Mois par mois</button>
        <button role="tab" aria-selected="${ui.vueSaisons === "calendrier"}" data-vs="calendrier">Calendrier de l'année</button>
      </div>
      <div class="ligne-champs deux">
        <div><label for="rs-recherche">Rechercher une plante</label>
          <input type="search" id="rs-recherche" placeholder="ex. tomate" value="${esc(ui.rechercheSaisons)}"></div>
        ${ui.vueSaisons === "mois" ? `<div><label for="rs-mois">Mois</label>
          <select id="rs-mois">${MOIS_NOMS.map((n, i) => `<option value="${i + 1}"${i + 1 === ui.moisSaisons ? " selected" : ""}>${majuscule(n)}</option>`).join("")}</select></div>` : ""}
      </div>
      <div class="chips">${categories.map(([id, label]) =>
        `<button class="chip${ui.filtreCategorie === id ? " actif" : ""}" data-cat="${id}">${label}</button>`).join("")}</div>
    </section>
    <div id="saisons-contenu"></div>`;

  vue.querySelectorAll("[data-vs]").forEach(b => b.addEventListener("click", () => { ui.vueSaisons = b.dataset.vs; rendreSaisons(); }));
  vue.querySelectorAll("[data-cat]").forEach(b => b.addEventListener("click", () => { ui.filtreCategorie = b.dataset.cat; rendreSaisons(); }));
  const mois = vue.querySelector("#rs-mois");
  if (mois) mois.addEventListener("change", () => { ui.moisSaisons = +mois.value; rendreContenuSaisons(); });
  vue.querySelector("#rs-recherche").addEventListener("input", e => { ui.rechercheSaisons = e.target.value; rendreContenuSaisons(); });
  rendreContenuSaisons();
}

function plantesFiltrees() {
  const q = normaliser(ui.rechercheSaisons.trim());
  return PLANTS_DB.filter(p =>
    (ui.filtreCategorie === "toutes" || p.categorie === ui.filtreCategorie) &&
    (!q || normaliser(p.nom).includes(q))
  ).sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
}

function rendreContenuSaisons() {
  const zone = document.getElementById("saisons-contenu");
  const plantes = plantesFiltrees();
  if (ui.vueSaisons === "calendrier") {
    const m = moisCourant();
    zone.innerHTML = `<section class="carte">
      ${LEGENDE_CALENDRIER}
      ${plantes.length ? `<div class="calendrier">
        <div class="cal-ligne cal-entete"><span class="cal-nom"></span><div class="bandeau-mois">${MOIS_INITIALES.map((l, i) => `<span class="cal-mois${i + 1 === m ? " courant" : ""}">${l}</span>`).join("")}</div></div>
        ${plantes.map(p => `
          <div class="cal-ligne">
            <button class="cal-nom" data-fiche="${p.id}">${iconePlante(p)} ${esc(nomCourt(p))}</button>
            ${bandeauMois(p, { entete: false })}
          </div>`).join("")}
      </div>` : `<p class="vide">Aucune plante ne correspond à ta recherche.</p>`}
    </section>`;
    brancherFiches(zone);
    return;
  }
  const m = ui.moisSaisons;
  const aSemer = plantes.filter(p => p.moisSemis.includes(m) || p.moisPlantation.includes(m));
  const aRecolter = plantes.filter(p => p.moisRecolte.includes(m));
  const fiche = p => {
    const f = familleDe(p);
    const actions = [p.moisSemis.includes(m) && "semis", p.moisPlantation.includes(m) && "plantation"].filter(Boolean);
    return `
      <button class="plante-fiche" data-fiche="${p.id}" style="--famille:${f.color}">
        <span class="pf-titre">${iconePlante(p)} ${esc(p.nom)} <span class="tag-famille" style="background:${f.color}">${f.label}</span></span>
        ${actions.length ? `<span class="pf-meta">${majuscule(actions.join(" ou "))} ce mois-ci, ${esc(p.exposition)}</span>` : `<span class="pf-meta">${esc(majuscule(p.exposition))}</span>`}
        ${p.conseilCourt ? `<span class="pf-conseil">${esc(p.conseilCourt)}</span>` : ""}
      </button>`;
  };
  zone.innerHTML = `
    <section class="carte">
      <div class="carte-titre"><h2>À semer ou planter en ${MOIS_NOMS[m - 1]}</h2></div>
      ${aSemer.length ? aSemer.map(fiche).join("") : `<p class="vide">Rien de particulier à semer ce mois-ci dans cette catégorie.</p>`}
    </section>
    <section class="carte">
      <div class="carte-titre"><h2>À récolter en ${MOIS_NOMS[m - 1]}</h2></div>
      ${aRecolter.length ? aRecolter.map(fiche).join("") : `<p class="vide">Rien à récolter ce mois-ci dans cette catégorie.</p>`}
    </section>`;
  brancherFiches(zone);
}

/* ============================================================
   Onglet Journal & conseils
   ============================================================ */

function rendreJournal() {
  const vue = document.getElementById("vue-journal");
  const annee = new Date().getFullYear();
  const recoltes = etat.journal.filter(j => j.type === "recolte" && j.quantite && parseDate(j.date).getFullYear() === annee);
  const totaux = {};
  recoltes.forEach(r => {
    const nom = planteParId(r.planteId) ? planteParId(r.planteId).nom : "Autre";
    const unite = r.unite === "g" ? "kg" : r.unite;
    const q = r.unite === "g" ? r.quantite / 1000 : r.quantite;
    const cle = nom + "|" + unite;
    totaux[cle] = (totaux[cle] || 0) + q;
  });
  const m = moisCourant();

  vue.innerHTML = `
    <section class="carte">
      <div class="carte-titre"><h2>Mon journal de jardin</h2></div>
      <div class="ligne-champs deux">
        <div><label for="jn-type">Type</label>
          <select id="jn-type">${Object.entries(TYPES_JOURNAL).map(([k, t]) => `<option value="${k}">${t.icone} ${t.label}</option>`).join("")}</select></div>
        <div><label for="jn-date">Date</label><input type="date" id="jn-date" value="${isoLocal()}"></div>
      </div>
      <label for="jn-texte">Ce que tu as observé ou fait</label>
      <textarea id="jn-texte" rows="2" placeholder="ex. Les limaces ont attaqué les jeunes salades : essayer un voile la prochaine fois."></textarea>
      <button class="btn" id="jn-ajouter">Ajouter au journal</button>
      <div class="journal-liste">
        ${etat.journal.length ? etat.journal.slice().sort((a, b) => (b.date || "").localeCompare(a.date || "")).map(j => `
          <div class="entree-journal">
            <span class="entree-icone" aria-hidden="true">${(TYPES_JOURNAL[j.type] || TYPES_JOURNAL.note).icone}</span>
            <div class="entree-corps">
              <div class="entree-date">${esc(formatDate(j.date))}</div>
              <div>${esc(j.texte)}</div>
            </div>
            <button class="btn-icone" data-suppr="${j.id}" aria-label="Supprimer cette entrée">✕</button>
          </div>`).join("") : `<p class="vide">Ton journal est vide. Note tes observations, réussites et essais : ils te serviront la saison prochaine.</p>`}
      </div>
    </section>
    ${Object.keys(totaux).length ? `
    <section class="carte">
      <div class="carte-titre"><h2>Récoltes ${annee}</h2></div>
      <ul class="liste-totaux">${Object.entries(totaux).sort((a, b) => b[1] - a[1]).map(([cle, q]) => {
        const [nom, unite] = cle.split("|");
        return `<li><span>${esc(nom)}</span><strong>${formatNombre(q)} ${esc(unite)}</strong></li>`;
      }).join("")}</ul>
    </section>` : ""}
    <section class="carte">
      <div class="carte-titre"><h2>Conseils mois par mois</h2></div>
      ${MONTHLY_ADVICE.map(x => `
        <details class="accordeon"${x.mois === m ? " open" : ""}>
          <summary>${x.titre}${x.mois === m ? " (ce mois-ci)" : ""}</summary>
          <ul class="liste-taches">${x.court.map(t => `<li>${esc(t)}</li>`).join("")}</ul>
          ${x.detail ? `<p class="texte-doux">${esc(x.detail)}</p>` : ""}
        </details>`).join("")}
    </section>
    <section class="carte">
      <div class="carte-titre"><h2>Bien jardiner en Bretagne</h2></div>
      ${GENERAL_TIPS.map(t => `
        <details class="accordeon">
          <summary>${esc(t.titre)}</summary>
          <p>${esc(t.court)}</p>
          ${t.detail ? `<p class="texte-doux">${esc(t.detail)}</p>` : ""}
        </details>`).join("")}
    </section>`;

  vue.querySelector("#jn-ajouter").addEventListener("click", () => {
    const texte = vue.querySelector("#jn-texte").value.trim();
    if (!texte) { vue.querySelector("#jn-texte").focus(); return; }
    const type = vue.querySelector("#jn-type").value;
    const date = vue.querySelector("#jn-date").value || isoLocal();
    etat.journal.unshift({ id: creerId(), date, type, texte });
    sauvegarder();
    rendreJournal();
    toast("Ajouté au journal.");
  });
  vue.querySelectorAll("[data-suppr]").forEach(b => b.addEventListener("click", () => {
    avecAnnulation("Entrée supprimée.", () => { etat.journal = etat.journal.filter(j => j.id !== b.dataset.suppr); });
  }));
}

/* ============================================================
   Réglages : commune météo, sauvegarde, installation
   ============================================================ */

function rendreReglages() {
  const vue = document.getElementById("vue-reglages");
  const lieu = etat.reglages.lieu;
  const derniere = etat.reglages.derniereSauvegarde;
  const estIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const installee = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;

  vue.innerHTML = `
    <section class="carte">
      <div class="carte-titre"><h2>Ma commune (météo)</h2></div>
      ${lieu ? `<p>Prévisions pour <strong>${esc(lieu.nom)}</strong>. <button class="lien-bouton" id="rg-retirer">Retirer</button></p>` : ""}
      <p class="texte-doux petit">La météo sert au coach pour t'alerter du gel, des coups de vent et des pluies à limaces. Seule la position de la commune est envoyée au service gratuit Open-Meteo.</p>
      <form id="rg-form" class="ligne-recherche">
        <input type="search" id="rg-commune" placeholder="ex. Quimper, Lannion, 35000…" autocomplete="off" aria-label="Commune">
        <button class="btn" type="submit">${ui.rechercheCommuneEnCours ? "…" : "Chercher"}</button>
      </form>
      <button class="lien-bouton" id="rg-position">📍 Utiliser ma position actuelle</button>
      <div id="rg-resultats">${ui.resultatsCommune === null ? "" : ui.resultatsCommune.length
        ? ui.resultatsCommune.map((r, i) => `<button class="resultat-commune" data-i="${i}">${esc(r.name)}<span>${esc([r.admin2, r.admin1].filter(Boolean).join(", "))}</span></button>`).join("")
        : `<p class="vide">Aucune commune trouvée.</p>`}</div>
    </section>

    <section class="carte">
      <div class="carte-titre"><h2>Sauvegarde</h2></div>
      <p class="texte-doux">Tes données restent uniquement sur cet appareil. Exporte un fichier régulièrement pour ne rien perdre ou pour passer sur un autre appareil.</p>
      <p class="petit">${derniere ? `Dernière sauvegarde : ${esc(formatDate(derniere))}.` : "Aucune sauvegarde exportée pour l'instant."}
        <span id="rg-persist"></span></p>
      <div class="actions-fenetre">
        <button class="btn" id="rg-exporter">Exporter mes données</button>
        <label class="btn-discret bouton-fichier">Importer une sauvegarde
          <input type="file" id="rg-importer" accept="application/json,.json" hidden></label>
      </div>
    </section>

    <section class="carte">
      <div class="carte-titre"><h2>Installer l'appli</h2></div>
      ${installee ? `<p>L'appli est installée sur cet appareil. Elle fonctionne même sans réseau au fond du jardin.</p>`
        : invitationInstallation ? `<p class="texte-doux">Ajoute le potager à ton écran d'accueil pour l'ouvrir comme une vraie appli, même hors ligne.</p>
          <button class="btn" id="rg-installer">Installer sur cet appareil</button>`
        : estIOS ? `<p class="texte-doux">Dans Safari, touche le bouton Partager puis « Sur l'écran d'accueil ». Sur iPhone, c'est aussi ce qui protège tes données : Safari efface les données des sites non installés après quelques semaines sans visite.</p>`
        : `<p class="texte-doux">Dans le menu du navigateur, choisis « Ajouter à l'écran d'accueil » ou « Installer l'application ».</p>`}
    </section>

    <section class="carte">
      <div class="carte-titre"><h2>Repartir de zéro</h2></div>
      <p class="texte-doux petit">Efface toutes les parcelles, cultures et le journal de cet appareil.</p>
      <button class="btn-danger" id="rg-effacer">Tout effacer</button>
    </section>`;

  const persist = vue.querySelector("#rg-persist");
  if (navigator.storage && navigator.storage.persisted) {
    navigator.storage.persisted().then(ok => { if (ok) persist.textContent = " Stockage protégé contre l'effacement automatique."; });
  }

  vue.querySelector("#rg-form").addEventListener("submit", async e => {
    e.preventDefault();
    const q = vue.querySelector("#rg-commune").value.trim();
    if (!q) return;
    ui.rechercheCommuneEnCours = true;
    try {
      const r = await fetch("https://geocoding-api.open-meteo.com/v1/search?count=6&language=fr&countryCode=FR&name=" + encodeURIComponent(q));
      const data = await r.json();
      ui.resultatsCommune = data.results || [];
    } catch (err) {
      ui.resultatsCommune = null;
      toast("Recherche impossible : vérifie ta connexion.");
    }
    ui.rechercheCommuneEnCours = false;
    rendreReglages();
  });
  vue.querySelectorAll(".resultat-commune").forEach(b => b.addEventListener("click", () => {
    const r = ui.resultatsCommune[+b.dataset.i];
    choisirLieu({ nom: r.name, lat: r.latitude, lon: r.longitude });
  }));
  vue.querySelector("#rg-position").addEventListener("click", () => {
    if (!navigator.geolocation) { toast("La géolocalisation n'est pas disponible sur cet appareil."); return; }
    navigator.geolocation.getCurrentPosition(
      pos => choisirLieu({ nom: "Ma position", lat: +pos.coords.latitude.toFixed(3), lon: +pos.coords.longitude.toFixed(3) }),
      () => toast("Position refusée ou indisponible. Cherche plutôt ta commune."),
      { timeout: 10000 }
    );
  });
  const retirer = vue.querySelector("#rg-retirer");
  if (retirer) retirer.addEventListener("click", () => {
    etat.reglages.lieu = null;
    sauvegarder();
    rendreReglages();
  });
  vue.querySelector("#rg-exporter").addEventListener("click", exporterDonnees);
  vue.querySelector("#rg-importer").addEventListener("change", e => { if (e.target.files[0]) importerDonnees(e.target.files[0]); });
  const installer = vue.querySelector("#rg-installer");
  if (installer) installer.addEventListener("click", async () => {
    invitationInstallation.prompt();
    await invitationInstallation.userChoice;
    invitationInstallation = null;
    rendreReglages();
  });
  vue.querySelector("#rg-effacer").addEventListener("click", () => {
    if (!confirm("Effacer tout le potager de cet appareil ? (tu pourras annuler juste après)")) return;
    avecAnnulation("Potager effacé.", () => { etat = etatParDefaut(); });
  });
}

function choisirLieu(lieu) {
  etat.reglages.lieu = lieu;
  ui.resultatsCommune = null;
  sauvegarder();
  toast(`Météo réglée sur ${lieu.nom}.`);
  actualiserMeteo(true);
  allerA("accueil");
}

function exporterDonnees() {
  etat.reglages.derniereSauvegarde = isoLocal();
  sauvegarder();
  const blob = new Blob([JSON.stringify(etat, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "mon-potager-breton-" + isoLocal() + ".json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  rendre();
  toast("Sauvegarde exportée.");
}

function importerDonnees(fichier) {
  const lecteur = new FileReader();
  lecteur.onload = () => {
    let donnees;
    try {
      donnees = JSON.parse(lecteur.result);
      if (!donnees || !Array.isArray(donnees.parcelles)) throw new Error("format");
    } catch (e) {
      toast("Ce fichier n'est pas une sauvegarde valide de Mon Potager Breton.");
      return;
    }
    // On garde la commune météo si le fichier importé n'en a pas
    const lieuActuel = etat.reglages.lieu;
    avecAnnulation(`Sauvegarde importée : ${donnees.parcelles.length} parcelle(s).`, () => {
      etat = migrer(donnees);
      if (!etat.reglages.lieu) etat.reglages.lieu = lieuActuel;
    });
    allerA("plan");
  };
  lecteur.readAsText(fichier);
}

/* ============================================================
   Fenêtre (dialog) et notifications
   ============================================================ */

function ouvrirFenetre(html, init) {
  const dlg = document.getElementById("fenetre");
  const contenu = dlg.querySelector(".fenetre-contenu");
  ui.rafraichirFenetre = null;
  contenu.innerHTML = html;
  if (!dlg.open) {
    if (typeof dlg.showModal === "function") dlg.showModal();
    else dlg.setAttribute("open", "");
  }
  // Une fenêtre modale rend tout le reste de la page inactif : la notification
  // (avec son bouton « Annuler ») doit donc vivre dans la fenêtre tant qu'elle est ouverte.
  dlg.appendChild(document.getElementById("toast"));
  contenu.scrollTop = 0;
  if (init) init(contenu);
}
function rangerToast() {
  const t = document.getElementById("toast");
  if (t.parentNode !== document.body) document.body.appendChild(t);
}
function fermerFenetre() {
  const dlg = document.getElementById("fenetre");
  ui.rafraichirFenetre = null;
  if (!dlg.open) return;
  if (typeof dlg.close === "function") dlg.close();
  else dlg.removeAttribute("open");
  rangerToast();
}

let minuterieToast = null;
function toast(message, { annuler } = {}) {
  const t = document.getElementById("toast");
  t.innerHTML = `<span>${esc(message)}</span>${annuler ? `<button type="button">Annuler</button>` : ""}`;
  t.classList.add("visible");
  if (annuler) t.querySelector("button").addEventListener("click", () => { t.classList.remove("visible"); annuler(); });
  clearTimeout(minuterieToast);
  minuterieToast = setTimeout(() => t.classList.remove("visible"), annuler ? 6000 : 3000);
}

/* ============================================================
   Démarrage
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-vue]").forEach(b => b.addEventListener("click", () => allerA(b.dataset.vue)));
  window.addEventListener("hashchange", () => { fermerFenetre(); rendre(); window.scrollTo(0, 0); });

  const dlg = document.getElementById("fenetre");
  // Fermer en touchant le fond assombri
  dlg.addEventListener("click", e => { if (e.target === dlg) fermerFenetre(); });
  dlg.addEventListener("close", () => { ui.rafraichirFenetre = null; rangerToast(); });

  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault();
    invitationInstallation = e;
    if (ui.vue === "reglages") rendreReglages();
  });

  // Demande au navigateur de ne pas effacer les données automatiquement
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  // Données modifiées dans un autre onglet
  window.addEventListener("storage", e => {
    if (e.key === CLE_STOCKAGE) { etat = migrer(chargerEtat()); rendre(); }
  });

  sauvegarder();
  rendre();
});
