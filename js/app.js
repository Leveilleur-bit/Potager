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
const VERSION_APP = "14";                 // à incrémenter à chaque livraison (avec version.json et sw.js)
const DATE_VERSION_APP = "2026-10-12";
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
// Protections posées sur une case (paillage, voile, bâche)
const PROTECTIONS = {
  paillage: { label: "Paillage", icone: "🍂", conseil: "5 à 10 cm de feuilles mortes, paille ou tontes séchées : le sol reste vivant, ne se tasse pas et ne lessive pas sous la pluie." },
  voile: { label: "Voile d'hivernage", icone: "🛡️", conseil: "Protège du gel sans priver de lumière. Lesté sur les bords, il résiste mieux au vent." },
  bache: { label: "Bâche ou tunnel", icone: "⛺", conseil: "Abri contre pluie et gel. Pense à aérer par temps doux pour éviter les moisissures." }
};
const STATUTS_A_RECOLTER = ["recolter", "retard", "cueillette"];

/* ---------- Plantes (base + plantes personnalisées) ---------- */
const PLANTES_PAR_ID = Object.fromEntries(PLANTS_DB.map(p => [p.id, p]));

function nettoyerPlantePerso(p) {
  if (!p || !p.nom) return null;
  const mois = a => [...new Set((Array.isArray(a) ? a : []).map(Number).filter(m => m >= 1 && m <= 12))].sort((x, y) => x - y);
  const min = Math.max(0, Math.round(+p.dureeJoursMin || 0));
  return {
    id: /^perso-/.test(String(p.id || "")) ? String(p.id) : "perso-" + creerId(),
    nom: String(p.nom).trim().slice(0, 40) || "Ma plante",
    categorie: ["legume", "fruit", "aromate", "fleur"].includes(p.categorie) ? p.categorie : "legume",
    famille: FAMILIES[p.famille] ? p.famille : "autre",
    moisSemis: mois(p.moisSemis), moisPlantation: mois(p.moisPlantation), moisRecolte: mois(p.moisRecolte),
    dureeJoursMin: min, dureeJoursMax: Math.max(min, Math.round(+p.dureeJoursMax || 0)),
    exposition: String(p.exposition || "soleil").slice(0, 60),
    espacementCm: Math.max(0, Math.round(+p.espacementCm || 0)),
    conseilCourt: p.conseilCourt ? String(p.conseilCourt).slice(0, 200) : null,
    conseilDetail: null,
    icone: String(p.icone || "").trim().slice(0, 4),
    perso: true
  };
}
// Ajoute les plantes personnalisées à la base (et retire les anciennes)
function appliquerPlantesPerso(liste) {
  for (let i = PLANTS_DB.length - 1; i >= 0; i--) {
    if (PLANTS_DB[i].perso) { delete PLANTES_PAR_ID[PLANTS_DB[i].id]; PLANTS_DB.splice(i, 1); }
  }
  liste.forEach(p => {
    PLANTS_DB.push(p);
    PLANTES_PAR_ID[p.id] = p;
    if (p.icone) PLANT_ICONS[p.id] = p.icone;
  });
}

/* ---------- État global ---------- */

let etat = migrer(chargerEtat());
let meteo = lireJSON(CLE_METEO);
let invitationInstallation = null;

const ui = {
  vue: "accueil",
  filtreCategorie: "toutes",
  moisSaisons: moisCourant(),
  rechercheSaisons: "",
  vueSaisons: "plan",
  ouverts: new Set(),
  filtrePlan: "toutes",
  vueCultures: "cultures",
  anneeFrise: new Date().getFullYear(),
  editionDisposition: false,
  resultatsCommune: null,
  rechercheCommuneEnCours: false,
  rafraichirFenetre: null,
  empreinte: null,
  versionDistante: null,
  versionErreur: false,
  verifEnCours: false
};

ui.empreinte = JSON.stringify(etat, (k, v) => (k === "modifieLe" ? undefined : v));

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
    parcelles: [{ id: creerId(), nom: "Carré n°1", largeur: 3, hauteur: 3, posX: 0, posY: 0, cases: {}, protections: {}, historique: [] }],
    journal: [],
    projets: [],
    plantesPerso: [],
    graines: [],
    courses: [],
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
  e.modifieLe = typeof e.modifieLe === "string" ? e.modifieLe : null;
  e.journal = Array.isArray(e.journal) ? e.journal : [];
  e.journal.forEach(j => {
    if (!j.id) j.id = creerId();
    j.photos = Array.isArray(j.photos) ? j.photos.filter(x => typeof x === "string") : [];
    if (!j.type || !TYPES_JOURNAL[j.type]) j.type = /^Récolte/.test(j.texte || "") ? "recolte" : "note";
  });
  // Plantes personnalisées : ajoutées à la base avant tout le reste
  e.plantesPerso = (Array.isArray(e.plantesPerso) ? e.plantesPerso : []).map(nettoyerPlantePerso).filter(Boolean);
  appliquerPlantesPerso(e.plantesPerso);
  // Réserve de graines et liste de courses
  e.graines = (Array.isArray(e.graines) ? e.graines : []).filter(g => g && (g.nom || PLANTS_DB.some(p => p.id === g.planteId)))
    .map(g => ({
      id: g.id || creerId(),
      planteId: PLANTS_DB.some(p => p.id === g.planteId) ? g.planteId : "",
      nom: String(g.nom || "").slice(0, 60), variete: String(g.variete || "").slice(0, 60),
      quantite: String(g.quantite || "").slice(0, 40), peremption: Number.isFinite(+g.peremption) && +g.peremption > 0 ? Math.round(+g.peremption) : null,
      note: String(g.note || "").slice(0, 120)
    }));
  e.courses = (Array.isArray(e.courses) ? e.courses : []).filter(c => c && c.texte)
    .map(c => ({ id: c.id || creerId(), texte: String(c.texte).slice(0, 80), fait: !!c.fait }));
  // Projets : cultures que l'on prévoit de lancer (coach des 3 mois)
  e.projets = (Array.isArray(e.projets) ? e.projets : [])
    .filter(pr => pr && PLANTS_DB.some(p => p.id === pr.planteId) && /^\d{4}-\d{2}$/.test(pr.mois || ""))
    .map(pr => ({ id: pr.id || creerId(), planteId: pr.planteId, mois: pr.mois, fait: !!pr.fait }));
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
    p.protections = Object.fromEntries(Object.entries(p.protections && typeof p.protections === "object" ? p.protections : {})
      .filter(([c, v]) => v && PROTECTIONS[v.type] && dansLimites(p, c))
      .map(([c, v]) => [c, { type: v.type, date: v.date || null }]));
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

// Empreinte des données (sans la date de modification) : sert à ne dater
// que les vrais changements, pour la synchronisation
function empreinteEtat() {
  return JSON.stringify(etat, (k, v) => (k === "modifieLe" ? undefined : v));
}
// Remplace les données sans les considérer comme une modification locale
function adopterEtat(nouveau) {
  etat = migrer(nouveau);
  ui.empreinte = empreinteEtat();
  ecrireJSON(CLE_STOCKAGE, etat);
  rendre();
}

function sauvegarder() {
  const empreinte = empreinteEtat();
  if (empreinte !== ui.empreinte) {
    etat.modifieLe = new Date().toISOString();
    ui.empreinte = empreinte;
    if (typeof planifierSynchro === "function") planifierSynchro();
  }
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
  const projet = (etat.projets || []).find(pr => !pr.fait && pr.planteId === donnees.planteId);
  if (projet) projet.fait = true;
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

function protectionDe(parcelle, coord) {
  const v = parcelle.protections && parcelle.protections[coord];
  return v && PROTECTIONS[v.type] ? v : null;
}
function definirProtection(parcelle, coord, type, date = isoLocal()) {
  if (!parcelle.protections) parcelle.protections = {};
  if (type) parcelle.protections[coord] = { type, date }; else delete parcelle.protections[coord];
}
// Cases vides, dans le cadre, sans protection
function casesNuesSansProtection() {
  const liste = [];
  etat.parcelles.forEach(parcelle => {
    for (let y = 0; y < parcelle.hauteur; y++)
      for (let x = 0; x < parcelle.largeur; x++) {
        const coord = x + "-" + y;
        if (!culturesDe(parcelle, coord).length && !protectionDe(parcelle, coord)) liste.push({ parcelle, coord });
      }
  });
  return liste;
}
function compterProtections() {
  let n = 0;
  etat.parcelles.forEach(p => Object.keys(p.protections || {}).forEach(c => { if (dansLimites(p, c) && protectionDe(p, c)) n++; }));
  return n;
}
function protegerCases(cibles, type) {
  cibles.forEach(({ parcelle, coord }) => definirProtection(parcelle, coord, type));
  if (cibles.length) {
    etat.journal.unshift({
      id: creerId(), date: isoLocal(), type: "note",
      texte: `${PROTECTIONS[type].label} : ${cibles.length} case${cibles.length > 1 ? "s" : ""} protégée${cibles.length > 1 ? "s" : ""}.`
    });
  }
}
function retirerToutesProtections(parcelles = etat.parcelles) {
  parcelles.forEach(p => { p.protections = {}; });
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
  // Les pérennes n'ont pas de « fenêtre » de récolte unique : on suit les mois de récolte
  const fenetre = typeof estPerenne === "function" && estPerenne(plante) ? null : fenetreRecolte(plante, datePlantation);
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
        "&timezone=Europe%2FParis&past_days=7&forecast_days=5";
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
      if (ui.vue === "accueil") { rendreMeteo(); rendreCoach(); rendreJour(); }
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
      const sensibles = cultures.filter(c => estFrileuse(c.plante));
      const abritee = c => ["voile", "bache"].includes((protectionDe(c.parcelle, c.coord) || {}).type);
      const frileuses = [...new Set(sensibles.filter(c => !abritee(c)).map(c => c.plante.nom))];
      conseils.push({
        type: "alerte", icone: "❄️",
        titre: `Gel possible ${nomJour(gel.date)} (${Math.round(gel.tmin)} °C)`,
        texte: !frileuses.length && sensibles.length
          ? "Tes cultures sensibles sont déjà sous voile ou bâche : vérifie qu'ils sont bien lestés contre le vent."
          : frileuses.length
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
  }

  if (majDisponible()) {
    conseils.push({
      type: "conseil", icone: "🔄",
      titre: `Nouvelle version disponible (${ui.versionDistante.version})`,
      texte: "Tu utilises la version " + VERSION_APP + ". Mets à jour pour profiter des nouveautés : tes données ne sont pas touchées.",
      action: { label: "Mettre à jour", vue: "reglages" }
    });
  }

  conseils.push(...conseilsSynchro());

  // Rappels du plan des 3 mois
  conseils.push(...conseilsDuPlan());
  if (typeof conseilsVivaces === "function") conseils.push(...conseilsVivaces(cultures), ...conseilsSante(cultures), ...conseilsEau(cultures));

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

  // Place libre, paillage et hivernage
  const { libres } = compterCases();
  const nues = casesNuesSansProtection().length;
  const hiver = [10, 11, 12, 1, 2].includes(m);
  if (hiver && nues > 0) {
    conseils.push({
      type: "conseil", icone: "🍂",
      titre: `${nues} m² nu${nues > 1 ? "s" : ""} pour l'hiver : pense au paillage`,
      texte: "Un sol nu se tasse et se lessive sous les pluies bretonnes. Couvre-le de 5 à 10 cm de feuilles mortes, de paille ou de tontes séchées (ou sème un engrais vert). Note-le ici pour t'en souvenir.",
      action: { label: `Marquer ${nues > 1 ? "les " + nues + " cases" : "la case"} comme paillée${nues > 1 ? "s" : ""}`, proteger: "paillage" }
    });
  } else if (libres > 0 && ![11, 12, 1].includes(m)) {
    const idees = PLANTS_DB.filter(p => (p.moisSemis.includes(m) || p.moisPlantation.includes(m)) && p.categorie !== "fleur");
    if (idees.length) {
      conseils.push({
        type: "conseil", icone: "🌱",
        titre: `${libres} m² libres à occuper`,
        texte: `En ${MOIS_NOMS[m - 1]}, tu peux y mettre : ${listeFr(idees.slice(0, 5).map(nomCourt))}.`,
        action: { label: "Idées de saison", vue: "saisons", sousVue: "plan" }
      });
    }
  }
  if ([3, 4].includes(m) && compterProtections() > 0) {
    conseils.push({
      type: "conseil", icone: "☀️",
      titre: "Fin d'hivernage : libère le sol",
      texte: "Écarte le paillage là où tu vas semer pour que la terre se réchauffe, et retire les voiles et bâches quand les nuits ne gèlent plus.",
      action: { label: "J'ai retiré les protections", retirerProtections: true }
    });
  }

  // Sauvegarde
  const aDesDonnees = cultures.length > 0 || etat.journal.length > 0;
  const derniere = parseDate(etat.reglages.derniereSauvegarde);
  const synchro = typeof lireSynchro === "function" ? lireSynchro() : null;
  const synchroRecente = !!(synchro && synchro.derniereSynchro && joursEntre(parseDate(synchro.derniereSynchro.slice(0, 10)), aujourdhui()) <= 14);
  if (aDesDonnees && !synchroRecente && (!derniere || joursEntre(derniere, aujourdhui()) > 14)) {
    conseils.push({
      type: "conseil", icone: "💾",
      titre: derniere ? "Dernière sauvegarde il y a plus de deux semaines" : "Pense à sauvegarder ton potager",
      texte: "Tes données ne vivent que dans ce navigateur. Active la synchronisation Google Drive ou envoie un fichier de sauvegarde.",
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
   Coach des 3 prochains mois : quoi cultiver, où, et rappels
   ============================================================ */

function cleMois(annee, mois) { return annee + "-" + String(mois).padStart(2, "0"); }

function troisProchainsMois(nb = 3) {
  const auj = new Date();
  return Array.from({ length: nb }, (_, i) => i).map(i => {
    const d = new Date(auj.getFullYear(), auj.getMonth() + i, 1);
    return { mois: d.getMonth() + 1, annee: d.getFullYear(), cle: cleMois(d.getFullYear(), d.getMonth() + 1), debut: d, courant: i === 0 };
  });
}
function nomMoisCle(cle) {
  const [a, m] = cle.split("-").map(Number);
  return MOIS_NOMS[m - 1] + (a !== new Date().getFullYear() ? " " + a : "");
}
// Comparaison de mois "AAAA-MM" avec le mois courant : -1 passé, 0 courant, 1 futur
function positionMois(cle) {
  const c = cleMois(new Date().getFullYear(), moisCourant());
  return cle < c ? -1 : cle === c ? 0 : 1;
}

function moisPourPlante(plante) { return new Set([...plante.moisSemis, ...plante.moisPlantation]); }
function actionPourMois(plante, m) {
  const semis = plante.moisSemis.includes(m), plant = plante.moisPlantation.includes(m);
  if (semis && plant) return "semis ou plantation";
  return semis ? "semis" : "plantation";
}
function estDernierMois(plante, m) {
  const ms = moisPourPlante(plante);
  return ms.has(m) && !ms.has(m === 12 ? 1 : m + 1);
}
function verbeAction(plante, m) {
  const a = actionPourMois(plante, m);
  return a === "semis" ? "Semer" : a === "plantation" ? "Planter" : "Semer ou planter";
}

function libelleCase(parcelle, x, y) {
  return `${parcelle.nom}, case ${x + 1}${parcelle.hauteur > 1 ? "-" + (y + 1) : ""}`;
}

// Meilleur emplacement pour une plante : case libre sans mauvais voisin ni
// rotation gênante, ou case déjà occupée par de bons compagnons (aromates, fleurs)
function meilleureCase(plante, dateRef = aujourdhui()) {
  const petite = plante.categorie === "aromate" || plante.categorie === "fleur";
  let meilleur = null;
  etat.parcelles.forEach(parcelle => {
    for (let y = 0; y < parcelle.hauteur; y++) {
      for (let x = 0; x < parcelle.largeur; x++) {
        const cultures = culturesDe(parcelle, x + "-" + y);
        if (cultures.length >= MAX_CULTURES_PAR_CASE) continue;
        if (cultures.some(c => c.planteId === plante.id)) continue;
        const v = voisinage(parcelle, x, y, plante.id);
        if (v.ennemis.length) continue;
        const libre = cultures.length === 0;
        if (!libre && !petite && !v.amis.length) continue;
        const rotation = verifierRotation(parcelle, x + "-" + y, plante.id, dateRef);
        let score = (libre ? (petite ? 2 : 4) : (petite ? 1 : -1)) + v.amis.length * 3 - (rotation ? 4 : 0);
        if (!libre && petite && v.amis.length) score += 3;
        if (!meilleur || score > meilleur.score) {
          meilleur = { parcelle, x, y, score, libre, amis: v.amis, rotation };
        }
      }
    }
  });
  return meilleur;
}

// Emplacement conseillé pour chaque projet à faire, en tenant compte des autres
// projets (deux projets ne sont pas proposés dans la même case s'ils s'entendent mal)
function emplacementsDuPlan() {
  const resultat = {};
  const virtuelles = [];
  try {
    etat.projets.filter(pr => !pr.fait).sort((a, b) => a.mois.localeCompare(b.mois)).forEach(pr => {
      const plante = planteParId(pr.planteId);
      const e = meilleureCase(plante);
      resultat[pr.id] = e;
      if (e) {
        const coord = e.x + "-" + e.y;
        if (!Array.isArray(e.parcelle.cases[coord])) e.parcelle.cases[coord] = [];
        const v = { id: "virtuelle-" + pr.id, planteId: plante.id, datePlantation: isoLocal(), notes: "" };
        e.parcelle.cases[coord].push(v);
        virtuelles.push([e.parcelle, coord, v]);
      }
    });
  } finally {
    virtuelles.forEach(([parcelle, coord, v]) => {
      const reste = (parcelle.cases[coord] || []).filter(c => c !== v);
      if (reste.length) parcelle.cases[coord] = reste; else delete parcelle.cases[coord];
    });
  }
  return resultat;
}

function raisonsSuggestion(plante, emplacement) {
  const raisons = [];
  if (!emplacement) return ["Plus de place adaptée : libère une case ou une parcelle."];
  if (emplacement.amis.length) raisons.push(`Bon voisin de ${listeFr(emplacement.amis.slice(0, 3))}`);
  raisons.push(emplacement.libre ? `Case libre : ${libelleCase(emplacement.parcelle, emplacement.x, emplacement.y)}` : `Se glisse dans ${libelleCase(emplacement.parcelle, emplacement.x, emplacement.y)}`);
  if (emplacement.rotation) raisons.push("Rotation à surveiller (même famille récemment)");
  return raisons;
}

function suggestionsDuMois(moisInfo) {
  const presentes = new Set(listerCultures().map(c => c.plante.id));
  const prevues = new Set(etat.projets.filter(pr => !pr.fait).map(pr => pr.planteId));
  const dateRef = moisInfo.courant ? aujourdhui() : moisInfo.debut;
  return PLANTS_DB
    .filter(p => moisPourPlante(p).has(moisInfo.mois))
    .map(plante => {
      const emplacement = meilleureCase(plante, dateRef);
      const dernier = estDernierMois(plante, moisInfo.mois);
      let score = (emplacement ? emplacement.score : -6) + (dernier ? 2 : 0) + (plante.moisRecolte.length ? 1 : 0)
        + (plante.categorie === "legume" ? 3 : plante.categorie === "fruit" ? 2 : 0);
      if (presentes.has(plante.id)) score -= 3;
      if (prevues.has(plante.id)) score += 1;
      return { plante, emplacement, dernier, score, dejaLa: presentes.has(plante.id) };
    })
    .sort((a, b) => b.score - a.score || a.plante.nom.localeCompare(b.plante.nom, "fr"));
}

function projetDe(planteId, cle) { return etat.projets.find(pr => pr.planteId === planteId && pr.mois === cle); }

function statutProjet(pr) {
  const plante = planteParId(pr.planteId);
  const [a, m] = pr.mois.split("-").map(Number);
  const pos = positionMois(pr.mois);
  if (pr.fait) return { code: "fait", label: "✓ Lancé", classe: "fait" };
  const mc = moisCourant();
  const fenetreOuverte = moisPourPlante(plante).has(mc);
  if (pos < 0) return fenetreOuverte
    ? { code: "retard", label: "Prévu plus tôt : c'est encore possible", classe: "retard" }
    : { code: "retard", label: "Fenêtre passée", classe: "retard" };
  if (pos === 0) return estDernierMois(plante, mc)
    ? { code: "dernier", label: "Dernier mois pour le faire", classe: "dernier" }
    : { code: "maintenant", label: "À faire ce mois-ci", classe: "maintenant" };
  return { code: "plus-tard", label: "En " + MOIS_NOMS[m - 1], classe: "plus-tard" };
}

function basculerProjet(planteId, cle) {
  const plante = planteParId(planteId);
  const existant = projetDe(planteId, cle);
  if (existant) {
    avecAnnulation(`${nomCourt(plante)} retiré du plan.`, () => { etat.projets = etat.projets.filter(pr => pr !== existant); });
  } else {
    avecAnnulation(`${nomCourt(plante)} ajouté au plan de ${nomMoisCle(cle)}.`, () => {
      etat.projets.push({ id: creerId(), planteId, mois: cle, fait: false });
    });
  }
}

function placerProjet(pr) {
  const plante = planteParId(pr.planteId);
  const e = emplacementsDuPlan()[pr.id] || meilleureCase(plante);
  if (!e) { toast("Plus de place adaptée : libère une case d'abord."); return; }
  ouvrirEditeurCase(e.parcelle.id, e.x, e.y, { plante: plante.id });
}

function rendrePlanTroisMois(zone, annee = false) {
  const nb = annee ? 12 : 3;
  const mois3 = troisProchainsMois(nb);
  const categories = [["toutes", "Tout"], ["legume", "🥕 Légumes"], ["fruit", "🍓 Fruits"], ["aromate", "🌿 Aromates"], ["fleur", "🌼 Fleurs"]];
  const { libres } = compterCases();
  const debut = MOIS_NOMS[mois3[0].mois - 1], fin = MOIS_NOMS[mois3[nb - 1].mois - 1];
  const fenetre = new Set(mois3.map(mm => mm.cle));
  const projets = etat.projets
    .filter(pr => !pr.fait || fenetre.has(pr.mois))
    .sort((a, b) => a.fait - b.fait || a.mois.localeCompare(b.mois));
  const nbAFaire = projets.filter(pr => !pr.fait).length;

  const emplacements = emplacementsDuPlan();
  const ligneProjet = pr => {
    const plante = planteParId(pr.planteId);
    const st = statutProjet(pr);
    const e = pr.fait ? null : emplacements[pr.id];
    return `
      <div class="projet projet-${st.classe}">
        <div class="projet-tete">
          <span class="projet-nom">${ico(plante, "1.4em")} ${esc(plante.nom)}</span>
          <span class="projet-statut st-${st.classe}">${esc(st.label)}</span>
        </div>
        ${pr.fait ? "" : `<div class="projet-detail">${e ? "📍 " + esc(libelleCase(e.parcelle, e.x, e.y)) + (e.amis.length ? " — bon voisin de " + esc(listeFr(e.amis.slice(0, 2))) : "") : "Plus de place adaptée pour l'instant"}</div>
        <div class="projet-actions">
          <button class="btn-petit" data-placer="${pr.id}"${e ? "" : " disabled"}>Planter maintenant</button>
          <button class="btn-discret" data-fiche="${plante.id}">Fiche</button>
          <button class="btn-discret" data-retirer="${pr.id}">Retirer</button>
        </div>`}
      </div>`;
  };

  const ligneSuggestion = (sg, mm) => {
    const pr = projetDe(sg.plante.id, mm.cle);
    const f = familleDe(sg.plante);
    return `
      <div class="suggestion" style="--famille:${f.color}">
        <div class="sg-corps">
          <div class="sg-titre">${ico(sg.plante, "1.4em")} ${esc(sg.plante.nom)}
            <span class="tag-famille" style="background:${f.color}">${esc(majuscule(actionPourMois(sg.plante, mm.mois)))}</span>
            ${sg.dernier ? `<span class="tag-urgent">Dernière occasion</span>` : ""}
            ${sg.dejaLa ? `<span class="tag-info">Déjà chez toi</span>` : ""}</div>
          <div class="sg-raisons">${raisonsSuggestion(sg.plante, sg.emplacement).map(esc).join(" · ")}</div>
          ${sg.plante.conseilCourt ? `<div class="sg-conseil">💡 ${esc(sg.plante.conseilCourt)}</div>` : ""}
        </div>
        <div class="sg-actions">
          <button class="btn-petit${pr ? " prevu" : ""}" data-prevoir="${sg.plante.id}|${mm.cle}" aria-pressed="${!!pr}">${pr ? (pr.fait ? "✓ Lancé" : "✓ Prévu") : "＋ Je le prévois"}</button>
          <button class="lien-bouton" data-fiche="${sg.plante.id}">Fiche</button>
        </div>
      </div>`;
  };

  const cartesMois = mois3.map((mm, idx) => {
    const tout = suggestionsDuMois(mm).filter(sg => ui.filtrePlan === "toutes" || sg.plante.categorie === ui.filtrePlan);
    const visibles = tout.slice(0, 5), reste = tout.slice(5);
    const nomMois = (mm.courant ? "Ce mois-ci" : majuscule(MOIS_NOMS[mm.mois - 1])) + (annee && mm.annee !== new Date().getFullYear() ? " " + mm.annee : "");
    const prevus = etat.projets.filter(pr => pr.mois === mm.cle && !pr.fait).length;
    const corps = `${tout.length ? visibles.map(sg => ligneSuggestion(sg, mm)).join("") : `<p class="vide">Rien de particulier à lancer dans cette catégorie ce mois-là.</p>`}
        ${reste.length ? `<details class="coach-plus" data-k="p${mm.cle}"${ui.ouverts.has("p" + mm.cle) ? " open" : ""}><summary>${reste.length} autre${reste.length > 1 ? "s" : ""} idée${reste.length > 1 ? "s" : ""}</summary>${reste.map(sg => ligneSuggestion(sg, mm)).join("")}</details>` : ""}`;
    if (annee && idx >= 3) {
      return `
      <details class="carte mois-annee" data-k="m${mm.cle}"${prevus || ui.ouverts.has("m" + mm.cle) ? " open" : ""}>
        <summary><span class="ma-nom">${esc(nomMois)}</span><span class="carte-sous-titre">${prevus ? prevus + " prévu" + (prevus > 1 ? "s" : "") + " · " : ""}${tout.length} idée${tout.length > 1 ? "s" : ""}</span></summary>
        ${corps}
      </details>`;
    }
    return `
      <section class="carte">
        <div class="carte-titre"><h2>${nomMois}${mm.courant ? ` <small>(${MOIS_NOMS[mm.mois - 1]})</small>` : ""}</h2>
          <span class="carte-sous-titre">${prevus ? prevus + " prévu" + (prevus > 1 ? "s" : "") + " · " : ""}${tout.length} idée${tout.length > 1 ? "s" : ""}</span></div>
        ${corps}
      </section>`;
  }).join("");

  // Récoltes attendues dans les 3 mois
  const fin3 = new Date(mois3[nb - 1].debut.getFullYear(), mois3[nb - 1].debut.getMonth() + 1, 0);
  const recoltes = regrouperCultures(listerCultures()).map(g => {
    if (g.fenetre) {
      if (g.fenetre.fin < aujourdhui() && g.statut !== "retard") return null;
      if (g.fenetre.debut > fin3) return null;
      return { g, quand: g.statut === "retard" ? "à vérifier maintenant" : g.fenetre.debut <= aujourdhui() ? "récolte en cours" : "vers le " + formatDate(g.fenetre.debut), tri: g.fenetre.debut };
    }
    const ms = g.plante.moisRecolte || [];
    if (!mois3.some(mm => ms.includes(mm.mois))) return null;
    return { g, quand: "cueillette possible", tri: aujourdhui() };
  }).filter(Boolean).sort((a, b) => a.tri - b.tri);

  const conseils = mois3.map(mm => {
    if (annee) return "";
    const info = MONTHLY_ADVICE.find(a => a.mois === mm.mois);
    return info ? `<div class="trimestre-mois"><h3 class="sous-titre-section">${esc(info.titre)}</h3><ul>${info.court.map(t => `<li>${esc(t)}</li>`).join("")}</ul></div>` : "";
  }).join("");

  zone.innerHTML = `
    <section class="carte carte-coach3">
      <div class="carte-titre"><h2>${annee ? "Mon année au potager" : "Coach du trimestre"}</h2><span class="carte-sous-titre">${debut} → ${fin}</span></div>
      <p class="intro-coach">${libres > 0 ? `Tu as <strong>${libres} m² libres</strong>. ` : "Ton potager est plein pour l'instant. "}${annee ? "Prévois ce que tu veux cultiver dans les douze prochains mois, mois par mois" : "Choisis ce que tu veux cultiver ces trois prochains mois"} : je te propose les meilleures idées de saison, avec l'endroit le plus adapté dans ton potager, et je te rappellerai chaque étape sur l'accueil.</p>
      <div class="chips">${categories.map(([id, label]) => `<button class="chip${ui.filtrePlan === id ? " actif" : ""}" data-catplan="${id}">${label}</button>`).join("")}</div>
      <button class="btn-discret" id="p3-agenda" style="margin-top:0.8rem">📅 Ajouter mes rappels à mon agenda</button>
    </section>
    ${annee ? carteRefaireHTML() : ""}
    ${projets.length ? `<section class="carte">
      <div class="carte-titre"><h2>Mon plan</h2><span class="carte-sous-titre">${nbAFaire} à faire</span></div>
      ${projets.map(ligneProjet).join("")}
    </section>` : ""}
    ${cartesMois}
    <section class="carte">
      <div class="carte-titre"><h2>Récoltes attendues</h2></div>
      ${recoltes.length ? recoltes.map(r => `<div class="recolte-prevue"><span>${ico(r.g.plante, "1.4em")} <strong>${esc(r.g.plante.nom)}</strong> <small>${esc(r.g.parcelle.nom)}</small></span><span class="rp-quand">${esc(r.quand)}</span></div>`).join("")
        : `<p class="vide">Aucune récolte prévue d'ici ${fin}. Plante dès maintenant pour en avoir ensuite !</p>`}
    </section>
    ${annee ? "" : `<section class="carte">
      <div class="carte-titre"><h2>Les gestes du trimestre</h2></div>
      ${conseils}
    </section>`}`;

  zone.querySelectorAll("details[data-k]").forEach(d => d.addEventListener("toggle", () => {
    if (d.open) ui.ouverts.add(d.dataset.k); else ui.ouverts.delete(d.dataset.k);
  }));
  if (annee) brancherRefaire(zone);
  zone.querySelector("#p3-agenda").addEventListener("click", exporterAgenda);
  zone.querySelectorAll("[data-catplan]").forEach(b => b.addEventListener("click", () => { ui.filtrePlan = b.dataset.catplan; rendreSaisons(); }));
  zone.querySelectorAll("[data-prevoir]").forEach(b => b.addEventListener("click", () => { const [id, cle] = b.dataset.prevoir.split("|"); basculerProjet(id, cle); }));
  zone.querySelectorAll("[data-placer]").forEach(b => b.addEventListener("click", () => { const pr = etat.projets.find(k => k.id === b.dataset.placer); if (pr) placerProjet(pr); }));
  zone.querySelectorAll("[data-retirer]").forEach(b => b.addEventListener("click", () => {
    const pr = etat.projets.find(k => k.id === b.dataset.retirer);
    if (pr) avecAnnulation("Retiré du plan.", () => { etat.projets = etat.projets.filter(k => k !== pr); });
  }));
  brancherFiches(zone);
}

// Rappels du coach liés au plan des 3 mois
function conseilsDuPlan() {
  const conseils = [];
  const mc = moisCourant();
  const aFaire = etat.projets.filter(pr => !pr.fait);
  const emplacements = emplacementsDuPlan();
  const nomEmpl = e => e ? ` Emplacement conseillé : ${libelleCase(e.parcelle, e.x, e.y)}.` : "";
  aFaire.filter(pr => positionMois(pr.mois) <= 0).forEach(pr => {
    const plante = planteParId(pr.planteId);
    const ouverte = moisPourPlante(plante).has(mc);
    const e = emplacements[pr.id];
    const verbe = verbeAction(plante, mc).toLowerCase();
    if (ouverte) {
      const dernier = estDernierMois(plante, mc);
      conseils.push({
        type: dernier ? "alerte" : "conseil", icone: dernier ? "⏳" : "🌱",
        titre: `${dernier ? "Dernier mois pour " + verbe : "À " + verbe + " ce mois-ci"} : ${plante.nom}`,
        texte: `C'est dans ton plan.${nomEmpl(e)}${etat.graines.length && !etat.graines.some(g => g.planteId === plante.id) ? " Tu n'as pas de graines ou de plants en stock : pense à en acheter." : ""}${plante.conseilCourt ? " " + plante.conseilCourt : ""}`,
        action: e ? { label: "Planter", parcelle: e.parcelle.id, coord: e.x + "-" + e.y, plante: plante.id } : { label: "Voir le plan", vue: "saisons", sousVue: "plan" }
      });
    } else {
      conseils.push({
        type: "conseil", icone: "📅",
        titre: `${plante.nom} : la fenêtre est passée`,
        texte: `Prévu en ${nomMoisCle(pr.mois)} mais pas lancé. Prochaine fenêtre : ${listeFr([...moisPourPlante(plante)].sort((a, b) => a - b).map(i => MOIS_NOMS[i - 1]))}. Retire-le du plan ou garde-le pour la prochaine saison.`,
        action: { label: "Voir le plan", vue: "saisons", sousVue: "plan" }
      });
    }
  });
  const prochain = troisProchainsMois()[1];
  const mois1 = aFaire.filter(pr => pr.mois === prochain.cle);
  if (mois1.length) {
    conseils.push({
      type: "conseil", icone: "🗓️",
      titre: `Le mois prochain : ${listeFr(mois1.slice(0, 4).map(pr => nomCourt(planteParId(pr.planteId))))}`,
      texte: "Prépare le terrain (désherbage, compost) et commande tes graines ou plants dès maintenant.",
      action: { label: "Voir le plan", vue: "saisons", sousVue: "plan" }
    });
  }
  const plusLoin = aFaire.filter(pr => positionMois(pr.mois) > 0 && pr.mois !== prochain.cle).sort((x, y) => x.mois.localeCompare(y.mois));
  if (plusLoin.length) {
    const lignes = plusLoin.slice(0, 5).map(pr => `${nomCourt(planteParId(pr.planteId))} (${nomMoisCle(pr.mois)})`);
    conseils.push({
      type: "conseil", icone: "🗓️",
      titre: `Au programme des prochains mois : ${plusLoin.length} culture${plusLoin.length > 1 ? "s" : ""}`,
      texte: lignes.join(", ") + (plusLoin.length > 5 ? "…" : "") + ". Je te le rappellerai le moment venu, et le mois d'avant pour commander graines et plants.",
      action: { label: "Voir mon année", vue: "saisons", sousVue: "annee" }
    });
  }
  if (!aFaire.length && !etat.projets.some(pr => pr.fait)) {
    conseils.push({
      type: "conseil", icone: "🧭",
      titre: "Prépare ton année au potager",
      texte: "Choisis ce que tu veux cultiver dans les mois à venir, jusqu'à un an à l'avance : je te propose des idées de saison, l'endroit idéal, et je te rappelle chaque étape.",
      action: { label: "Planifier mon année", vue: "saisons", sousVue: "annee" }
    });
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

/* ---------- Couleurs du plan selon la vue choisie (État, Rotation, Arrosage) ---------- */
const VUES_PLAN = { etat: "État", rotation: "Rotation", eau: "Arrosage" };
const LEGENDES_PLAN = {
  etat: { retard: ["#e07a5f", "Récolte en retard"], recolte: ["#e9b949", "À récolter"], bientot: ["#f0d48a", "Bientôt prêt"], pousse: ["#a7c98a", "En train de pousser"], perenne: ["#6f9e64", "Pérenne"] },
  rotation: { fruits: ["#e48a6a", "Légumes-fruits"], feuilles: ["#9cc77a", "Feuilles et choux"], racines: ["#e3b66a", "Racines et bulbes"], legumineuses: ["#b6a3d8", "Légumineuses"], hors: ["#a9c3b8", "Hors rotation (vivaces, aromates, fleurs)"] },
  eau: { fort: ["#4f86c6", "Beaucoup d'eau"], moyen: ["#8db8dd", "Arrosage moyen"], faible: ["#e2d3a8", "Peu d'eau"] }
};
const ORDRE_ETAT = ["retard", "recolte", "bientot", "pousse", "perenne"];
function lireVuePlan() { try { const v = localStorage.getItem("potagerBretonVuePlan"); return LEGENDES_PLAN[v] ? v : "etat"; } catch (e) { return "etat"; } }
function categoriePlan(parcelle, coord, contenu, mode) {
  const plante = planteParId(contenu.planteId);
  if (!plante) return null;
  if (mode === "eau") return typeof besoinEau === "function" ? besoinEau(plante) : "moyen";
  if (mode === "rotation") {
    if (plante.categorie !== "legume" || ROTATION_IGNORED_FAMILIES.includes(plante.famille) || (typeof estPerenne === "function" && estPerenne(plante))) return "hors";
    const g = typeof groupeRotation === "function" ? groupeRotation(plante.famille) : null;
    return g ? g.id : "hors";
  }
  const inf = infosCulture(parcelle, coord, contenu);
  const st = inf ? inf.statut : "en-place";
  if (st === "retard") return "retard";
  if (STATUTS_A_RECOLTER.includes(st)) return "recolte";
  if (st === "bientot") return "bientot";
  return typeof estPerenne === "function" && estPerenne(plante) ? "perenne" : "pousse";
}
// Catégories d'une case (une seule, la plus urgente, pour la vue État)
function categoriesCase(parcelle, coord, mode) {
  const cats = [...new Set(culturesDe(parcelle, coord).map(c => categoriePlan(parcelle, coord, c, mode)).filter(Boolean))];
  if (mode === "etat" && cats.length) return [cats.sort((x, y) => ORDRE_ETAT.indexOf(x) - ORDRE_ETAT.indexOf(y))[0]];
  return cats;
}
function couleursCase(parcelle, coord, mode) { return categoriesCase(parcelle, coord, mode).map(k => LEGENDES_PLAN[mode][k][0]); }
function legendePlanHTML(mode) {
  const presentes = new Set();
  etat.parcelles.forEach(p => Object.keys(p.cases).filter(c => dansLimites(p, c)).forEach(c => categoriesCase(p, c, mode).forEach(k => presentes.add(k))));
  const items = Object.entries(LEGENDES_PLAN[mode]).filter(([k]) => presentes.has(k));
  const prot = new Set();
  etat.parcelles.forEach(p => Object.keys(p.protections || {}).filter(c => dansLimites(p, c) && protectionDe(p, c)).forEach(c => prot.add(p.protections[c].type)));
  return `<div class="legende legende-plan-vue">${items.map(([, [c, l]]) => `<span><span class="puce" style="background:${c}"></span>${esc(l)}</span>`).join("")}
    <span><span class="puce puce-libre"></span>Libre</span>
    ${[...prot].map(t => `<span>${PROTECTIONS[t].icone} ${esc(PROTECTIONS[t].label)}</span>`).join("")}</div>`;
}

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
  const mode = lireVuePlan();

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
        const prot = protectionDe(parcelle, coord);
        rect.setAttribute("class", "plan-case" + (plantes.length ? " occupee" : "") + (prot ? " protegee prot-" + prot.type : ""));
        if (plantes.length) rect.style.fill = remplissage(couleursCase(parcelle, coord, mode));
        if (!edition) {
          rect.setAttribute("tabindex", "0");
          rect.setAttribute("role", "button");
          rect.setAttribute("aria-label", parcelle.nom + ", case " + (x + 1) + "-" + (y + 1) + (plantes.length ? " : " + plantes.map(pl => pl.nom).join(", ") : " : vide"));
          const ouvrir = () => ouvrirApercuCase(parcelle.id, x, y);
          rect.addEventListener("click", ouvrir);
          rect.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); ouvrir(); } });
        }
        g.appendChild(rect);

        if (prot) {
          const badge = document.createElementNS(NS, "text");
          badge.setAttribute("x", gx + x * U + 20);
          badge.setAttribute("y", gy + (y + 1) * U - 16);
          badge.setAttribute("class", "plan-protection");
          badge.textContent = PROTECTIONS[prot.type].icone;
          g.appendChild(badge);
        }

        if (plantes.length) {
          const mise = DISPOSITION_ICONES[Math.min(plantes.length, 5)];
          const gi = document.createElementNS(NS, "g");
          gi.setAttribute("class", "plan-icones");
          gi.innerHTML = plantes.slice(0, 5).map((plante, i) => {
            const t = mise.taille * 1.55, cx = gx + x * U + mise.pos[i][0] * U, cy = gy + y * U + mise.pos[i][1] * U;
            return `<circle cx="${cx}" cy="${cy}" r="${t * 0.52}" class="plan-ico-fond"/>` + icoSVG(plante, cx - t / 2, cy - t / 2, t);
          }).join("");
          g.appendChild(gi);
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
  const m = moisCourant();
  vue.innerHTML = `
    <section class="carte carte-jour" id="jour"></section>
    <section class="carte">
      <div class="carte-titre"><h2>Cette semaine au jardin</h2></div>
      <div id="coach"></div>
    </section>
    <section class="carte">
      <div class="carte-titre"><h2>En ce moment au potager</h2></div>
      <div id="instantane"></div>
    </section>
    <section class="carte" id="carte-bientot" hidden>
      <div class="carte-titre"><h2>Bientôt</h2></div>
      <div id="bientot"></div>
    </section>
    <section class="carte">
      <div class="carte-titre"><h2>Les prochains jours</h2><span class="carte-sous-titre" id="meteo-lieu"></span></div>
      <div id="meteo"></div>
    </section>
    <section class="carte">
      <div class="carte-titre"><h2>Les gestes ${/^[aeiou]/i.test(MOIS_NOMS[m - 1]) ? "d'" : "de "}${MOIS_NOMS[m - 1]}</h2></div>
      <div id="taches-du-mois"></div>
    </section>`;

  rendreJour();
  rendreCoach();
  rendreInstantane();
  rendreBientot();
  rendreMeteo();
  rendreTachesDuMois();
  actualiserMeteo();
}

// Bandeau du jour : salutation, temps qu'il fait, idée de saison
function rendreJour() {
  const zone = document.getElementById("jour");
  if (!zone) return;
  const h = new Date().getHours();
  const salut = h < 5 ? "Bonsoir" : h < 12 ? "Bonjour" : h < 18 ? "Bon après-midi" : "Bonsoir";
  const jours = joursMeteoValides();
  let temps = "";
  if (jours) {
    const j = jours[0], d = decrireMeteo(j.code);
    const traits = [];
    if (j.tmin <= 1) traits.push("gel possible cette nuit");
    if (j.pluie >= 8) traits.push("bien arrosé par la pluie");
    else if (j.pluie >= 1) traits.push("quelques averses");
    if (j.rafales >= 50) traits.push("du vent");
    temps = `<div class="jour-meteo"><span class="jour-icone" aria-hidden="true">${d.icone}</span><div><strong>${esc(d.texte || "Aujourd'hui")}, ${Math.round(j.tmax)}°</strong>${traits.length ? `<div class="jour-traits">${esc(majuscule(listeFr(traits)))}</div>` : ""}</div></div>`;
  } else if (!etat.reglages.lieu) {
    temps = `<button class="lien-bouton" id="jour-commune">☁️ Ajoute ta commune pour avoir la météo du jardin</button>`;
  }
  const infos = MONTHLY_ADVICE.find(x => x.mois === moisCourant());
  const idee = infos && infos.court.length ? infos.court[new Date().getDate() % infos.court.length] : "";
  zone.innerHTML = `
    <div class="jour-salut">${salut} 🌿</div>
    ${temps}
    ${idee ? `<p class="jour-idee">💡 ${esc(idee)}</p>` : ""}`;
  const b = zone.querySelector("#jour-commune");
  if (b) b.addEventListener("click", () => allerA("reglages"));
}

// Ce qui se passe dans le potager, en mots (sans le plan, qui a son propre onglet)
function rendreInstantane() {
  const zone = document.getElementById("instantane");
  if (!zone) return;
  const groupes = regrouperCultures(listerCultures());
  const parPlante = filtre => {
    const vus = new Map();
    groupes.filter(filtre).forEach(g => { if (!vus.has(g.plante.id)) vus.set(g.plante.id, g); });
    return [...vus.values()].sort((a, b) => a.plante.nom.localeCompare(b.plante.nom, "fr"));
  };
  const perenne = g => typeof estPerenne === "function" && estPerenne(g.plante);
  const lignes = [
    ["🧺", "À récolter", parPlante(g => STATUTS_A_RECOLTER.includes(g.statut)), "recolte"],
    ["⏳", "Bientôt prêts", parPlante(g => g.statut === "bientot"), ""],
    ["🌱", "En train de pousser", parPlante(g => ["a-venir", "en-place", "cueillette-libre"].includes(g.statut) && !perenne(g)), ""],
    ["🌳", "Plantes pérennes", parPlante(g => perenne(g) && !STATUTS_A_RECOLTER.includes(g.statut)), ""]
  ].filter(l => l[2].length);
  const { libres, total } = compterCases();
  const place = !total ? "" : libres === 0 ? "Toutes les cases sont occupées."
    : libres === total ? "Toutes les cases sont libres." : libres <= total / 4 ? "Il reste un peu de place." : "Il reste de la place pour de nouvelles cultures.";
  zone.innerHTML = `
    ${lignes.length ? lignes.map(([ic, titre, liste, classe]) => `
      <div class="inst-ligne">
        <div class="inst-titre">${ic} ${titre}</div>
        <div class="chips">${liste.map(g => `<button class="chip${classe ? " chip-" + classe : ""}${g.statut === "retard" ? " chip-retard" : ""}" data-ouvrir="${g.parcelle.id}|${g.cases[0]}|${g.contenu.id}">${ico(g.plante, "1.4em")} ${esc(nomCourt(g.plante))}</button>`).join("")}</div>
      </div>`).join("")
      : `<p class="vide">Ton potager est vide pour l'instant : commence par placer tes cultures sur le plan.</p>`}
    <div class="inst-pied"><span class="texte-doux petit">${esc(place)}</span><button class="btn-discret" id="inst-plan">Voir le plan →</button></div>`;
  zone.querySelectorAll("[data-ouvrir]").forEach(b => b.addEventListener("click", () => {
    const [pid, coord, cid] = b.dataset.ouvrir.split("|");
    const [x, y] = coord.split("-").map(Number);
    ouvrirApercuCase(pid, x, y);
  }));
  zone.querySelector("#inst-plan").addEventListener("click", () => allerA("plan"));
}

// Ce qui est prévu dans les deux prochains mois (plan de l'année)
function rendreBientot() {
  const zone = document.getElementById("bientot");
  const carte = document.getElementById("carte-bientot");
  if (!zone || !carte) return;
  const limite = troisProchainsMois(3)[2].cle;
  const prevus = etat.projets.filter(pr => !pr.fait && pr.mois <= limite && planteParId(pr.planteId))
    .sort((a, b) => a.mois.localeCompare(b.mois)).slice(0, 5);
  carte.hidden = !prevus.length;
  if (!prevus.length) return;
  zone.innerHTML = prevus.map(pr => {
    const p = planteParId(pr.planteId);
    const [, mm] = pr.mois.split("-").map(Number);
    const quand = positionMois(pr.mois) <= 0 ? "ce mois-ci" : "en " + nomMoisCle(pr.mois);
    return `<div class="bientot-ligne"><span>${ico(p, "1.4em")} <strong>${esc(nomCourt(p))}</strong></span><span class="texte-doux petit">${esc(verbeAction(p, mm).toLowerCase())} ${esc(quand)}</span></div>`;
  }).join("") + `<div class="inst-pied"><span></span><button class="btn-discret" id="bientot-annee">Mon année →</button></div>`;
  zone.querySelector("#bientot-annee").addEventListener("click", () => { ui.vueSaisons = "annee"; allerA("saisons"); });
}

function rendreCoach() {
  const zone = document.getElementById("coach");
  if (!zone) return;
  const conseils = genererCoaching();
  const VISIBLES = 3;
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
    if (a.synchroniser) synchroniser({ manuel: true });
    else if (a.proteger) {
      const cibles = casesNuesSansProtection();
      avecAnnulation(`${PROTECTIONS[a.proteger].label} noté sur ${cibles.length} case${cibles.length > 1 ? "s" : ""}.`, () => protegerCases(cibles, a.proteger));
    }
    else if (a.retirerProtections) avecAnnulation("Protections retirées.", () => retirerToutesProtections());
    else if (a.vue) { if (a.sousVue) ui.vueSaisons = a.sousVue; allerA(a.vue); }
    else if (a.parcelle) {
      const [x, y] = a.coord.split("-").map(Number);
      ouvrirEditeurCase(a.parcelle, x, y, { editId: a.cid || null, plante: a.plante || null });
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
  if (!zone) return;
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
  if (!zone) return;
  const m = moisCourant();
  const infos = MONTHLY_ADVICE.find(x => x.mois === m);
  const idees = PLANTS_DB.filter(p => p.moisSemis.includes(m) || p.moisPlantation.includes(m));
  zone.innerHTML = `
    ${infos ? `<ul class="liste-taches">${infos.court.map(t => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
    ${infos && infos.detail ? `<details class="accordeon"><summary>Pourquoi ces gestes en Bretagne ?</summary><p>${esc(infos.detail)}</p></details>` : ""}
    ${idees.length ? `
      <details class="accordeon"><summary>Idées à semer ou planter ce mois-ci</summary>
      <div class="chips">${idees.map(p => `<button class="chip" data-fiche="${p.id}">${ico(p, "1.4em")} ${esc(p.nom)}</button>`).join("")}</div></details>` : ""}`;
  brancherFiches(zone);
}

/* ---------- Ligne de culture (accueil + onglet Cultures) ---------- */

function ligneCulture(c) {
  const st = STATUTS[c.statut];
  const n = c.cases.length;
  let detail = "Planté le " + formatDate(c.datePlantation);
  if (typeof estPerenne === "function" && estPerenne(c.plante)) detail += " · pérenne, " + libelleAnnee(ageEnAnnees(c.datePlantation));
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
      <span class="ligne-icone">${ico(c.plante, 30)}</span>
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
        : "Touche une case pour voir ce qu'elle contient. Chaque case fait 1 m × 1 m."}</p>
      ${ui.editionDisposition ? "" : `<div class="voir-par"><span class="texte-doux petit">Voir par</span><div class="chips">${Object.entries(VUES_PLAN).map(([k, l]) => `<button class="chip${lireVuePlan() === k ? " actif" : ""}" data-vueplan="${k}" aria-pressed="${lireVuePlan() === k}">${l}</button>`).join("")}</div></div>`}
      <div id="plan-global" class="plan-zone"></div>
      ${ui.editionDisposition ? "" : legendePlanHTML(lireVuePlan())}
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
  vue.querySelectorAll("[data-vueplan]").forEach(b => b.addEventListener("click", () => {
    try { localStorage.setItem("potagerBretonVuePlan", b.dataset.vueplan); } catch (e) { /* rien */ }
    const y = window.scrollY; rendrePlan(); window.scrollTo(0, y);
  }));

  const zone = document.getElementById("liste-parcelles");
  if (!etat.parcelles.length) {
    zone.innerHTML = `<p class="vide">Aucune parcelle. Ajoute la première ci-dessous.</p>`;
    return;
  }
  const statuts = statutsParCase();
  const mode = lireVuePlan();

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
        const prot = protectionDe(p, coord);
        const badgeProt = prot ? `<span class="case-protection" title="${esc(PROTECTIONS[prot.type].label)}">${PROTECTIONS[prot.type].icone}</span>` : "";
        const classeProt = prot ? " protegee prot-" + prot.type : "";
        if (!plantes.length) {
          cases += `<button class="case${classeProt}" ${lieu} aria-label="Case vide ${x + 1}-${y + 1}${prot ? ", " + esc(PROTECTIONS[prot.type].label) : ""}"><span class="case-vide">+</span>${badgeProt}</button>`;
        } else if (plantes.length === 1) {
          cases += `<button class="case occupee${classeProt}" ${lieu}
               style="--famille:${couleursCase(p, coord, mode)[0]}" title="${esc(plantes[0].nom)}, planté le ${esc(formatDate(cs[0].datePlantation))}">
               ${pastille}${badgeProt}
               <span class="case-icone">${ico(plantes[0], 34)}</span><span class="case-nom">${esc(nomCourt(plantes[0]))}</span>
             </button>`;
        } else {
          cases += `<button class="case occupee multi${classeProt}" ${lieu}
               style="background:${fondDegrade(couleursCase(p, coord, mode))}" title="${esc(plantes.map(pl => pl.nom).join(", "))}"
               aria-label="Case ${x + 1}-${y + 1} : ${esc(plantes.map(pl => pl.nom).join(", "))}">
               ${pastille}${badgeProt}
               <span class="case-icones">${plantes.slice(0, 5).map(pl => `<span>${ico(pl, 22)}</span>`).join("")}</span>
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

      </div>`;
  }).join("");

  zone.querySelectorAll(".case").forEach(b => b.addEventListener("click", () =>
    ouvrirApercuCase(b.dataset.parcelle, +b.dataset.x, +b.dataset.y)));
  zone.querySelectorAll("[data-modifier]").forEach(b => b.addEventListener("click", () =>
    ouvrirReglagesParcelle(b.dataset.modifier)));
}

function ajouterParcelle() {
  const posY = etat.parcelles.length ? Math.max(...etat.parcelles.map(p => p.posY + p.hauteur)) + 1 : 0;
  const parcelle = { id: creerId(), nom: "Parcelle " + (etat.parcelles.length + 1), largeur: 3, hauteur: 1, posX: 0, posY, cases: {}, protections: {}, historique: [] };
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
    <h3 class="sous-titre-section">Protéger pour l'hiver</h3>
    <p class="texte-doux petit">Note ici ce que tu poses sur les cases vides de cette parcelle. Pour une seule case, ouvre-la depuis le plan.</p>
    <div class="chips">${Object.entries(PROTECTIONS).map(([id, pr]) => `<button class="chip" data-protegerp="${id}">${pr.icone} ${pr.label}</button>`).join("")}</div>
    <button class="btn-discret" id="rp-retirer-prot">Retirer toutes les protections de la parcelle</button>
    <p class="texte-doux petit">Pour placer la parcelle sur le plan, utilise « Déplacer les parcelles » dans la vue d'ensemble.</p>
    <div class="actions-fenetre">
      <button class="btn" id="rp-ok">Enregistrer</button>
      <button class="btn-discret" id="rp-pivoter">Pivoter d'un quart de tour</button>
      <button class="btn-danger" id="rp-suppr">Supprimer</button>
    </div>`, fen => {
    fen.querySelectorAll("[data-protegerp]").forEach(b => b.addEventListener("click", () => {
      const type = b.dataset.protegerp;
      const nues = [];
      for (let yy = 0; yy < p.hauteur; yy++) for (let xx = 0; xx < p.largeur; xx++) {
        const coord = xx + "-" + yy;
        if (!culturesDe(p, coord).length && !protectionDe(p, coord)) nues.push({ parcelle: p, coord });
      }
      if (!nues.length) { toast("Toutes les cases libres de cette parcelle sont déjà protégées."); return; }
      fermerFenetre();
      avecAnnulation(`${PROTECTIONS[type].label} noté sur ${nues.length} case${nues.length > 1 ? "s" : ""}.`, () => protegerCases(nues, type));
    }));
    fen.querySelector("#rp-retirer-prot").addEventListener("click", () => {
      fermerFenetre();
      avecAnnulation("Protections retirées.", () => retirerToutesProtections([p]));
    });
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
        Object.keys(p.protections || {}).forEach(coord => { if (!dansLimites(p, coord)) delete p.protections[coord]; });
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
        const nouvellesProt = {};
        Object.entries(p.protections || {}).forEach(([coord, v]) => {
          const [x, y] = coord.split("-").map(Number);
          nouvellesProt[(p.hauteur - 1 - y) + "-" + x] = v;
        });
        [p.largeur, p.hauteur] = [p.hauteur, p.largeur];
        p.cases = nouvellesCases;
        p.protections = nouvellesProt;
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

function ouvrirEditeurCase(parcelleId, x, y, { editId = null, recolteId = null, plante: plantePresel = null } = {}) {
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
  const option = p => `<option value="${p.id}"${(edite && edite.planteId === p.id) || (!edite && plantePresel === p.id && !dejaLa.has(p.id)) ? " selected" : ""}${dejaLa.has(p.id) ? " disabled" : ""}>${iconePlante(p)} ${esc(p.nom)}${dejaLa.has(p.id) ? " (déjà dans cette case)" : ""}</option>`;
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
        <span class="ligne-icone">${ico(plante, 30)}</span>
        <div class="cc-corps">
          <div class="ligne-titre">${esc(plante.nom)}</div>
          <div class="ligne-detail">Planté le ${esc(formatDate(c.datePlantation))}${c.notes ? " — " + esc(c.notes) : ""}</div>
          ${(() => { const ph = photosDeCulture(c.planteId, parcelle.id); return ph.length ? `<div class="photos-entree">${ph.map(p => `<button class="photo-mini" data-photo="${p.id}" data-entree="${p.entree}" aria-label="Voir la photo du ${esc(formatDate(p.date))}"><img alt="" data-photo-img="${p.id}"></button>`).join("")}</div>` : ""; })()}
          ${inf && inf.progression !== null ? `<span class="progression" aria-hidden="true"><span style="width:${Math.round(inf.progression * 100)}%"></span></span>` : ""}
          ${st ? `<span class="etat ${st.classe}">${st.texte}</span>` : ""}
        </div>
        <div class="cc-actions">
          <button class="btn-discret" data-act="edit" data-cid="${c.id}">Modifier</button>
          <label class="btn-discret bouton-fichier" title="Prendre une photo de suivi de ${esc(plante.nom)}">📷 Photo<input type="file" accept="image/*" data-photo-culture="${c.id}" hidden></label>
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
    ${recolte ? "" : (() => {
      const cur = protectionDe(parcelle, coord);
      return `<div class="ec-protection">
        <h3 class="sous-titre-section">Protection de la case</h3>
        <div class="chips">${Object.entries(PROTECTIONS).map(([id, pr]) => `<button class="chip${cur && cur.type === id ? " actif" : ""}" data-protection="${id}" aria-pressed="${!!(cur && cur.type === id)}">${pr.icone} ${pr.label}</button>`).join("")}</div>
        <p class="texte-doux petit">${cur ? `${esc(PROTECTIONS[cur.type].label)}${cur.date ? " posé le " + esc(formatDate(cur.date)) : ""}. ${esc(PROTECTIONS[cur.type].conseil)} Touche à nouveau pour le retirer.`
          : "Paillage, voile d'hivernage ou bâche : note-le ici pour t'en souvenir. Je te rappellerai de l'enlever au printemps."}</p>
      </div>`; })()}
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
    fen.querySelectorAll("[data-protection]").forEach(b => b.addEventListener("click", () => {
      const type = b.dataset.protection;
      const cur = protectionDe(parcelle, coord);
      if (cur && cur.type === type) avecAnnulation("Protection retirée.", () => definirProtection(parcelle, coord, null));
      else avecAnnulation(`${PROTECTIONS[type].label} noté sur la case.`, () => definirProtection(parcelle, coord, type));
    }));

    // Photos de suivi : elles vont dans le journal, rattachées à cette culture
    chargerMiniatures(fen);
    fen.querySelectorAll("[data-photo]").forEach(b => b.addEventListener("click", () =>
      ouvrirPhoto(b.dataset.photo, b.dataset.entree, () => rouvrir({ editId: edite ? edite.id : null }))));
    fen.querySelectorAll("[data-photo-culture]").forEach(inp => inp.addEventListener("change", async () => {
      const c = cultures.find(k => k.id === inp.dataset.photoCulture);
      const fichiers = [...inp.files].slice(0, 6);
      if (!c || !fichiers.length) return;
      const pl = planteParId(c.planteId);
      const photos = [];
      for (const f of fichiers) { try { photos.push(await enregistrerPhoto(f)); } catch (e) { toast("Une photo n'a pas pu être enregistrée."); } }
      if (!photos.length) return;
      etat.journal.unshift({ id: creerId(), date: isoLocal(), type: "note", planteId: c.planteId, parcelleId: parcelle.id,
        texte: `Suivi : ${pl.nom} (${parcelle.nom})`, photos });
      sauvegarder();
      toast(`Photo ajoutée au suivi de ${nomCourt(pl)} (visible aussi dans le Journal).`);
      rouvrir({ editId: edite ? edite.id : null });
    }));

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
    <h2 class="titre-ico">${ico(p, 40)} ${esc(p.nom)}</h2>
    <p class="meta-plante"><span class="tag-famille" style="background:${f.color}">${f.label}</span>
      ${esc(majuscule(p.exposition))}${p.espacementCm ? `, espacer d'environ ${p.espacementCm} cm` : ""}</p>
    ${bandeauMois(p)}
    ${LEGENDE_CALENDRIER}
    ${p.conseilCourt ? `<p class="conseil-fort">${esc(p.conseilCourt)}</p>` : ""}
    ${p.conseilDetail ? `<p class="texte-doux">${esc(p.conseilDetail)}</p>` : ""}
    ${amis.length ? `<p><strong>Bons voisins :</strong> ${esc(listeFr(amis))}.</p>` : ""}
    ${ennemis.length ? `<p><strong>À éloigner :</strong> ${esc(listeFr(ennemis))}.</p>` : ""}
    ${(() => { const ph = photosDeCulture(p.id, null, 12); return ph.length ? `<h3 class="sous-titre-section">Tes photos de ${esc(nomCourt(p).toLowerCase())}</h3><div class="photos-entree">${ph.map(x => `<button class="photo-mini" data-photo="${x.id}" data-entree="${x.entree}" aria-label="Voir la photo du ${esc(formatDate(x.date))}"><img alt="" data-photo-img="${x.id}"></button>`).join("")}</div>` : ""; })()}
    <div class="actions-fenetre"><button class="btn-discret" id="fp-fermer">${retour ? "Retour" : "Fermer"}</button></div>`, fen => {
    fen.querySelector("#fp-fermer").addEventListener("click", retour || fermerFenetre);
    chargerMiniatures(fen);
    fen.querySelectorAll("[data-photo]").forEach(b => b.addEventListener("click", () =>
      ouvrirPhoto(b.dataset.photo, b.dataset.entree, () => ouvrirFichePlante(id, retour))));
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
  vue.innerHTML = `
    <section class="carte carte-onglets">
      <div class="onglets-internes" role="tablist">
        <button role="tab" aria-selected="${ui.vueCultures === "cultures"}" data-vc="cultures">Mes cultures</button>
        <button role="tab" aria-selected="${ui.vueCultures === "graines"}" data-vc="graines">Graines et courses</button>
      </div>
    </section>
    <div id="cultures-contenu"></div>`;
  vue.querySelectorAll("[data-vc]").forEach(b => b.addEventListener("click", () => { ui.vueCultures = b.dataset.vc; rendreCultures(); }));
  const zone = vue.querySelector("#cultures-contenu");
  if (ui.vueCultures === "graines") { rendreGraines(zone); return; }

  const groupes = regrouperCultures(listerCultures());
  if (!groupes.length) {
    zone.innerHTML = `<section class="carte"><div class="carte-titre"><h2>Mes cultures</h2></div>
      <p class="vide">Aucune culture en place. Touche une case du plan pour planter quelque chose.</p>
      <button class="btn" id="btn-vers-plan">Ouvrir le plan</button></section>`;
    zone.querySelector("#btn-vers-plan").addEventListener("click", () => allerA("plan"));
    return;
  }
  const ordre = { retard: 0, recolter: 1, cueillette: 2, bientot: 3, "a-venir": 4, "cueillette-libre": 5, "en-place": 6 };
  zone.innerHTML = etat.parcelles.map(p => {
    const liste = groupes.filter(g => g.parcelle.id === p.id)
      .sort((a, b) => ordre[a.statut] - ordre[b.statut] || a.datePlantation - b.datePlantation);
    if (!liste.length) return "";
    return `<section class="carte">
      <div class="carte-titre"><h2>${esc(p.nom)}</h2><span class="carte-sous-titre">${Object.keys(p.cases).filter(k => culturesDe(p, k).length).length} / ${p.largeur * p.hauteur} m² occupés</span></div>
      ${liste.map(ligneCulture).join("")}
    </section>`;
  }).join("");
  brancherLignesCulture(zone);
}

/* ============================================================
   Onglet Saisons (idées, calendrier, fiches)
   ============================================================ */

function rendreSaisons() {
  const vue = document.getElementById("vue-saisons");
  const categories = [["toutes", "Tout"], ["legume", "🥕 Légumes"], ["fruit", "🍓 Fruits"], ["aromate", "🌿 Aromates"], ["fleur", "🌼 Fleurs"]];
  const onglets = `
      <div class="onglets-internes" role="tablist">
        <button role="tab" aria-selected="${ui.vueSaisons === "plan"}" data-vs="plan">Plan 3 mois</button>
        <button role="tab" aria-selected="${ui.vueSaisons === "annee"}" data-vs="annee">Mon année</button>
        <button role="tab" aria-selected="${ui.vueSaisons === "mois"}" data-vs="mois">Mois par mois</button>
        <button role="tab" aria-selected="${ui.vueSaisons === "calendrier"}" data-vs="calendrier">Calendrier</button>
        <button role="tab" aria-selected="${ui.vueSaisons === "frise"}" data-vs="frise">Frise</button>
        <button role="tab" aria-selected="${ui.vueSaisons === "rotation"}" data-vs="rotation">Rotation</button>
        <button role="tab" aria-selected="${ui.vueSaisons === "sante"}" data-vs="sante">Santé</button>
      </div>`;
  const brancherOnglets = () => vue.querySelectorAll("[data-vs]").forEach(b => b.addEventListener("click", () => { ui.vueSaisons = b.dataset.vs; rendreSaisons(); }));

  if (ui.vueSaisons === "plan" || ui.vueSaisons === "annee") {
    const defilement = window.scrollY;
    vue.innerHTML = `<section class="carte carte-onglets">${onglets}</section><div id="plan3-contenu"></div>`;
    brancherOnglets();
    rendrePlanTroisMois(vue.querySelector("#plan3-contenu"), ui.vueSaisons === "annee");
    window.scrollTo(0, defilement);
    return;
  }
  if (ui.vueSaisons === "frise" || ui.vueSaisons === "rotation" || ui.vueSaisons === "sante") {
    vue.innerHTML = `<section class="carte carte-onglets">${onglets}</section><div id="saisons-extra"></div>`;
    brancherOnglets();
    const zone = vue.querySelector("#saisons-extra");
    if (ui.vueSaisons === "frise") rendreFrise(zone); else if (ui.vueSaisons === "sante") rendreSante(zone); else rendreRotation(zone);
    return;
  }
  vue.innerHTML = `
    <section class="carte">
      ${onglets}
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

  brancherOnglets();
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
            <button class="cal-nom" data-fiche="${p.id}">${ico(p, "1.4em")} ${esc(nomCourt(p))}</button>
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
        <span class="pf-titre">${ico(p, "1.4em")} ${esc(p.nom)} <span class="tag-famille" style="background:${f.color}">${f.label}</span></span>
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

// Photos du journal rattachées à une culture (les plus récentes d'abord)
function photosDeCulture(planteId, parcelleId, max = 6) {
  const liste = [];
  etat.journal.slice().sort((x, y) => (y.date || "").localeCompare(x.date || "")).forEach(j => {
    if (j.planteId !== planteId || !(j.photos || []).length) return;
    if (parcelleId && j.parcelleId && j.parcelleId !== parcelleId) return;
    j.photos.forEach(id => liste.push({ id, entree: j.id, date: j.date }));
  });
  return liste.slice(0, max);
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
      <label for="jn-plante">Culture concernée (facultatif)</label>
      <select id="jn-plante"><option value="">— Aucune en particulier —</option>${(() => {
        const ids = [...new Set(listerCultures().map(c => c.plante.id))];
        return ids.map(id => planteParId(id)).sort((p, q) => p.nom.localeCompare(q.nom, "fr")).map(p => `<option value="${p.id}">${iconePlante(p)} ${esc(p.nom)}</option>`).join("");
      })()}</select>
      <div class="ligne-photo">
        <label class="btn-discret bouton-fichier">📷 Ajouter des photos
          <input type="file" id="jn-photo" accept="image/*" multiple hidden></label>
        <span class="petit texte-doux" id="jn-photo-info"></span>
      </div>
      <div class="photos-entree" id="jn-apercu"></div>
      <p class="texte-doux petit">📷 Les photos servent à suivre l'évolution d'une culture, à garder une trace d'un problème (pour le reconnaître ou le montrer) et à comparer d'une année à l'autre. Elles restent dans ton journal et sur la fiche de la plante ; touche « Ajouter au journal » pour les enregistrer.</p>
      <button class="btn" id="jn-ajouter">Ajouter au journal</button>
      <div class="journal-liste">
        ${etat.journal.length ? etat.journal.slice().sort((a, b) => (b.date || "").localeCompare(a.date || "")).map(j => `
          <div class="entree-journal">
            <span class="entree-icone" aria-hidden="true">${(TYPES_JOURNAL[j.type] || TYPES_JOURNAL.note).icone}</span>
            <div class="entree-corps">
              <div class="entree-date">${esc(formatDate(j.date))}</div>
              <div>${esc(j.texte)}</div>
              ${j.planteId && planteParId(j.planteId) && j.type !== "recolte" ? `<span class="tag-info">${ico(planteParId(j.planteId), "1.4em")} ${esc(nomCourt(planteParId(j.planteId)))}</span>` : ""}
              ${j.photos && j.photos.length ? `<div class="photos-entree">${j.photos.map(id => `<button class="photo-mini" data-photo="${id}" data-entree="${j.id}" aria-label="Voir la photo"><img alt="" data-photo-img="${id}"></button>`).join("")}</div>` : ""}
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

  let fichiersPhotos = [];
  vue.querySelector("#jn-photo").addEventListener("change", e => {
    fichiersPhotos = [...e.target.files].slice(0, 6);
    vue.querySelector("#jn-photo-info").textContent = fichiersPhotos.length ? "✓ " + fichiersPhotos.length + " photo" + (fichiersPhotos.length > 1 ? "s" : "") + " choisie" + (fichiersPhotos.length > 1 ? "s" : "") + " : touche « Ajouter au journal »" : "";
    const apercu = vue.querySelector("#jn-apercu");
    apercu.innerHTML = fichiersPhotos.map(() => `<span class="photo-mini"><img alt="Aperçu"></span>`).join("");
    apercu.querySelectorAll("img").forEach((img, i) => { img.src = URL.createObjectURL(fichiersPhotos[i]); });
    const bj = vue.querySelector("#jn-ajouter");
    bj.textContent = fichiersPhotos.length ? "Ajouter au journal avec " + (fichiersPhotos.length > 1 ? "les photos" : "la photo") : "Ajouter au journal";
  });
  vue.querySelector("#jn-ajouter").addEventListener("click", async () => {
    const texte = vue.querySelector("#jn-texte").value.trim();
    if (!texte && !fichiersPhotos.length) { vue.querySelector("#jn-texte").focus(); return; }
    const type = vue.querySelector("#jn-type").value;
    const date = vue.querySelector("#jn-date").value || isoLocal();
    const bouton = vue.querySelector("#jn-ajouter");
    bouton.disabled = true;
    const photos = [];
    for (const f of fichiersPhotos) {
      try { photos.push(await enregistrerPhoto(f)); } catch (e) { toast("Une photo n'a pas pu être enregistrée."); }
    }
    const planteId = vue.querySelector("#jn-plante").value || null;
    const entree = { id: creerId(), date, type, texte: texte || "Photo", photos };
    if (planteId) entree.planteId = planteId;
    etat.journal.unshift(entree);
    sauvegarder();
    rendreJournal();
    toast("Ajouté au journal.");
  });
  chargerMiniatures(vue);
  vue.querySelectorAll("[data-photo]").forEach(b => b.addEventListener("click", () => ouvrirPhoto(b.dataset.photo, b.dataset.entree)));
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

    ${carteAspectHTML()}
    ${carteSynchroHTML()}

    <section class="carte">
      <div class="carte-titre"><h2>Sauvegarde manuelle</h2></div>
      <p class="texte-doux">Un fichier de sauvegarde que tu gardes où tu veux (Drive, e-mail, ordinateur). Utile en plus de la synchronisation, ou si tu ne veux pas la configurer. Les photos du journal sont incluses.</p>
      <p class="petit">${derniere ? `Dernière sauvegarde : ${esc(formatDate(derniere))}.` : "Aucune sauvegarde exportée pour l'instant."}
        <span id="rg-persist"></span></p>
      <div class="actions-fenetre">
        <button class="btn-discret" id="rg-drive">📤 Envoyer le fichier (Drive, mail…)</button>
        <button class="btn-discret" id="rg-exporter">Télécharger le fichier</button>
        <label class="btn-discret bouton-fichier">Restaurer une sauvegarde
          <input type="file" id="rg-importer" accept="application/json,.json" hidden></label>
      </div>
      <p class="texte-doux petit">« Envoyer le fichier » ouvre le menu de partage de ton téléphone : choisis Drive, ta messagerie… Pour restaurer, choisis le fichier depuis Drive (ou ton téléphone).</p>
    </section>

    ${carteAgendaHTML()}
    ${carteMesPlantesHTML()}

    <section class="carte">
      <div class="carte-titre"><h2>Installer l'appli</h2></div>
      ${installee ? `<p>L'appli est installée sur cet appareil. Elle fonctionne même sans réseau au fond du jardin.</p>`
        : invitationInstallation ? `<p class="texte-doux">Ajoute le potager à ton écran d'accueil pour l'ouvrir comme une vraie appli, même hors ligne.</p>
          <button class="btn" id="rg-installer">Installer sur cet appareil</button>`
        : estIOS ? `<p class="texte-doux">Dans Safari, touche le bouton Partager puis « Sur l'écran d'accueil ». Sur iPhone, c'est aussi ce qui protège tes données : Safari efface les données des sites non installés après quelques semaines sans visite.</p>`
        : `<p class="texte-doux">Dans le menu du navigateur, choisis « Ajouter à l'écran d'accueil » ou « Installer l'application ».</p>`}
    </section>

    <section class="carte" id="rg-version">
      <div class="carte-titre"><h2>Version de l'appli</h2></div>
      <p>Version installée : <strong>${VERSION_APP}</strong> <span class="texte-doux petit">(${esc(formatDate(DATE_VERSION_APP))})</span></p>
      <p class="texte-doux petit" id="rg-cache">Cache hors ligne : vérification…</p>
      <p id="rg-version-etat" class="petit" aria-live="polite">${
        ui.verifEnCours ? "Vérification en cours…"
        : ui.versionErreur ? "Impossible de vérifier (pas de réseau ?). Réessaie quand tu es connecté."
        : majDisponible() ? `⚠️ La version <strong>${esc(ui.versionDistante.version)}</strong>${ui.versionDistante.date ? " du " + esc(formatDate(ui.versionDistante.date)) : ""} est disponible.`
        : ui.versionDistante ? `✓ Tu as la dernière version (vérifié à ${ui.versionDistante.verifieLe.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}).`
        : "Pas encore vérifié."}</p>
      ${majDisponible() && ui.versionDistante.nouveautes.length ? `<ul class="petit">${ui.versionDistante.nouveautes.map(n => `<li>${esc(n)}</li>`).join("")}</ul>` : ""}
      <div class="actions-fenetre">
        ${majDisponible() ? `<button class="btn" id="rg-maj">Mettre à jour maintenant</button>` : ""}
        <button class="btn-discret" id="rg-verifier"${ui.verifEnCours ? " disabled" : ""}>Vérifier les mises à jour</button>
      </div>
    </section>

    <section class="carte">
      <div class="carte-titre"><h2>Repartir de zéro</h2></div>
      <p class="texte-doux petit">Efface toutes les parcelles, cultures et le journal de cet appareil.</p>
      <button class="btn-danger" id="rg-effacer">Tout effacer</button>
    </section>`;

  vue.querySelector("#rg-verifier").addEventListener("click", async () => {
    ui.verifEnCours = true; rendreReglages();
    await verifierVersion();
    actualiserApresVerification();
  });
  const btnMaj = vue.querySelector("#rg-maj");
  if (btnMaj) btnMaj.addEventListener("click", () => { btnMaj.disabled = true; btnMaj.textContent = "Mise à jour…"; mettreAJour(); });
  if (window.caches) {
    caches.keys().then(noms => {
      const c = noms.filter(n => n.startsWith("potager-breton-"));
      const zone = vue.querySelector("#rg-cache");
      if (zone) zone.textContent = c.length ? "Cache hors ligne : " + c.map(n => n.replace("potager-breton-", "")).join(", ") : "Cache hors ligne : aucun (l'appli n'est pas encore installée).";
    }).catch(() => {});
  }
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
  vue.querySelector("#rg-drive").addEventListener("click", sauvegarderVersDrive);
  brancherAspect(vue); brancherSynchro(vue);
  brancherAgenda(vue);
  brancherMesPlantes(vue);
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

function telechargerFichier(blob, nom) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function exporterDonnees() {
  etat.reglages.derniereSauvegarde = isoLocal();
  sauvegarder();
  const blob = await construireSauvegarde();
  telechargerFichier(blob, "mon-potager-breton-" + isoLocal() + ".json");
  rendre();
  toast("Sauvegarde exportée.");
}

function importerDonnees(fichier) {
  const lecteur = new FileReader();
  lecteur.onload = async () => {
    let donnees;
    try {
      donnees = JSON.parse(lecteur.result);
      if (!donnees || !Array.isArray(donnees.parcelles)) throw new Error("format");
    } catch (e) {
      toast("Ce fichier n'est pas une sauvegarde valide de Mon Potager Breton.");
      return;
    }
    const photos = donnees._photos;
    delete donnees._photos;
    if (photos) { try { await PhotosDB.importer(photos); } catch (e) { toast("Les photos n'ont pas pu être restaurées."); } }
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
   Version de l'appli : vérification et mise à jour
   ============================================================ */

const FICHIERS_APPLI = ["./", "index.html", "css/style.css", "js/app.js", "js/plants-data.js", "js/extras.js", "js/aide.js", "js/icones.js", "js/sync.js", "manifest.json", "sw.js"];

async function verifierVersion() {
  ui.verifEnCours = true;
  try {
    const r = await fetch("version.json?t=" + Date.now(), { cache: "no-store" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const j = await r.json();
    ui.versionDistante = { version: String(j.version), date: j.date || null, nouveautes: Array.isArray(j.nouveautes) ? j.nouveautes : [], verifieLe: new Date() };
    ui.versionErreur = false;
  } catch (e) {
    ui.versionErreur = true;
  }
  ui.verifEnCours = false;
}
function majDisponible() {
  return !!ui.versionDistante && Number(ui.versionDistante.version) > Number(VERSION_APP);
}
// Vide les caches de l'appli (jamais les données du potager) et recharge
async function mettreAJour() {
  try { await Promise.all(FICHIERS_APPLI.map(f => fetch(f, { cache: "reload" }).catch(() => null))); } catch (e) {}
  try {
    const regs = navigator.serviceWorker ? await navigator.serviceWorker.getRegistrations() : [];
    await Promise.all(regs.map(r => r.unregister()));
  } catch (e) {}
  try {
    const noms = window.caches ? await caches.keys() : [];
    await Promise.all(noms.filter(n => n.startsWith("potager-breton-")).map(n => caches.delete(n)));
  } catch (e) {}
  location.reload();
}
function actualiserApresVerification() {
  if (ui.vue === "accueil") rendreCoach();
  else if (ui.vue === "reglages") rendreReglages();
  const pied = document.getElementById("version-pied");
  if (pied) pied.textContent = "Version " + VERSION_APP + (majDisponible() ? " · mise à jour disponible" : "");
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
    if (e.key === CLE_STOCKAGE) { etat = migrer(chargerEtat()); ui.empreinte = empreinteEtat(); rendre(); }
  });

  sauvegarder();
  rendre();
  actualiserApresVerification();
  // Vérification discrète de la version au démarrage (sans réseau : on ne dit rien)
  if (navigator.onLine !== false) verifierVersion().then(actualiserApresVerification);
});
