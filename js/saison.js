/* ============================================================
   Fin de saison et saison suivante
   - préparer l'hiver : une liste à cocher selon ce qui pousse chez toi
   - bilan de saison : léger (tes avis, tes photos, tes envies)
   - mes envies pour la saison prochaine, rappelées au bon moment
   - fleuri toute l'année : les mois sans fleurs et de quoi les combler
   - limaces et oiseaux : rappels au bon moment
   ============================================================ */

/* ---------- Données ---------- */

function donneesSaison() {
  if (!Array.isArray(etat.envies)) etat.envies = [];
  if (!etat.hivernage || typeof etat.hivernage !== "object") etat.hivernage = {};
  return etat;
}
// La saison « en cours » pour le bilan : de janvier à décembre, mais en début d'année on regarde encore l'an passé
function anneeBilan() { return moisCourant() >= 3 ? new Date().getFullYear() : new Date().getFullYear() - 1; }
// L'hiver qui vient : de septembre à mars
function cleHiver() { return String(moisCourant() >= 7 ? new Date().getFullYear() : new Date().getFullYear() - 1); }

function plantesPresentes(cultures) { return new Set(cultures.map(c => c.plante.id)); }
function nomsListe(ids) { return listeFr([...new Set(ids)].map(id => planteParId(id)).filter(Boolean).map(p => nomCourt(p).toLowerCase()).slice(0, 4)); }

/* ---------- Préparer l'hiver ---------- */

function casesNuesDe(parcelle) {
  return casesNuesSansProtection().filter(c => c.parcelle === parcelle);
}

function tachesHiver() {
  const m = moisCourant();
  const cultures = listerCultures();
  const ici = plantesPresentes(cultures);
  const prefs = typeof prefsJardin === "function" ? prefsJardin() : { recuperateur: true, soucis: [] };
  const t = [];
  const ajoute = (id, mois, icone, texte, extra = {}) => { if (mois.includes(m)) t.push({ id, icone, texte, ...extra }); };

  if (ici.has("gingembre")) ajoute("gingembre", [9, 10, 11], "🫚", "Rentrer le gingembre à l'abri dès que les nuits passent sous 10 °C, ou récolter les rhizomes.");
  if (ici.has("glaieul")) ajoute("glaieul", [10, 11], "🌸", "Arracher les bulbes de glaïeul quand le feuillage jaunit, les laisser sécher puis les ranger au sec, hors gel.");
  if (ici.has("verveine")) ajoute("verveine", [10, 11], "🌿", "Pailler épais le pied de la verveine citronnelle : elle craint le gel (si elle est en pot, rentre-la).");
  const frileuses = cultures.filter(c => estFrileuse(c.plante) && !estPerenne(c.plante) && !["gingembre", "glaieul", "verveine"].includes(c.plante.id)).map(c => c.plante.id);
  if (frileuses.length) ajoute("frileuses", [10, 11], "❄️", `Récolter ou arracher les dernières frileuses (${nomsListe(frileuses)}) avant les premières gelées.`);
  if (ici.has("asperge")) ajoute("asperge", [10, 11], "🎋", "Couper le feuillage jauni des asperges à 5 cm, l'évacuer (criocères), puis étaler du compost ou un paillis.");
  if (ici.has("fraise")) ajoute("fraise", [10, 11], "🍓", "Nettoyer les fraisiers : retirer feuilles sèches et stolons, puis pailler au pied.");
  if (ici.has("framboise")) ajoute("framboise", [11, 12], "🍒", "Couper au ras du sol les tiges de framboisier qui ont donné cette année.");
  if (ici.has("rhubarbe")) ajoute("rhubarbe", [10, 11, 12], "🍂", "Couvrir la rhubarbe de compost ou de fumier décomposé quand ses feuilles disparaissent.");
  if (ici.has("artichaut")) ajoute("artichaut", [11, 12], "🌵", "Butter les artichauts et les couvrir de paille contre le froid.");

  // Terre nue, bac par bac : relié aux protections « paillage » du plan
  etat.parcelles.forEach(p => {
    const nues = casesNuesDe(p).length;
    const vides = Object.keys(p.protections || {}).filter(c => p.protections[c].type === "paillage" && !(p.cases[c] || []).length).length;
    if (!nues && !vides) return;
    ajoute("sol-" + p.id, [10, 11, 12], "🍂", `« ${p.nom} » : couvrir la terre nue (feuilles mortes, paille) ou semer un engrais vert.`, { parcelle: p.id, fait: nues === 0 });
  });

  if (prefs.soucis.includes("vent")) ajoute("vent", [10, 11], "🌬️", "Vérifier tuteurs et voiles avant les tempêtes, et abriter les pots légers exposés au vent du nord.");
  if (prefs.recuperateur) ajoute("recup", [11, 12], "💧", "Récupérateur : laisser un peu de vide et ouvrir le robinet les nuits de gel fort, pour qu'il n'éclate pas.");
  ajoute("feuilles", [10, 11], "🍁", "Ramasser les feuilles mortes : le meilleur paillis, et un abri pour les hérissons, grands mangeurs de limaces.");
  if (!ici.has("narcisse") && !ici.has("tulipe")) ajoute("bulbes", [10, 11], "🌷", "Planter quelques bulbes (narcisses, tulipes) pour un potager fleuri dès la fin de l'hiver.", { ajout: "narcisse" });
  if (prefs.soucis.includes("oiseaux")) ajoute("mesanges", [11, 12], "🐦", "Installer une mangeoire ou un nichoir à mésanges, loin des semis : au printemps, elles mangent les pucerons.");
  ajoute("outils", [11, 12], "🧰", "Nettoyer, sécher et ranger les outils ; noter ce qui manque pour le printemps.");

  const coches = donneesSaison().hivernage[cleHiver()] || {};
  return t.map(x => ({ ...x, fait: x.parcelle ? x.fait : !!coches[x.id] }));
}

function cocherTacheHiver(tache, fait) {
  const cle = cleHiver();
  const h = donneesSaison().hivernage;
  if (tache.parcelle) {
    const p = etat.parcelles.find(x => x.id === tache.parcelle);
    if (!p) return;
    if (fait) protegerCases(casesNuesDe(p), "paillage");
    else Object.keys(p.protections || {}).forEach(c => { if (p.protections[c].type === "paillage" && !(p.cases[c] || []).length) delete p.protections[c]; });
  } else {
    h[cle] = Object.assign({}, h[cle] || {});
    if (fait) h[cle][tache.id] = isoLocal(); else delete h[cle][tache.id];
  }
  sauvegarder();
}

function carteHiverHTML() {
  const m = moisCourant();
  const taches = [9, 10, 11, 12].includes(m) ? tachesHiver() : [];
  const montrerBilan = [9, 10, 11, 12, 1, 2].includes(m);
  if (!taches.length && !montrerBilan) return "";
  const aFaire = taches.filter(x => !x.fait), faites = taches.filter(x => x.fait);
  const ligne = x => `<label class="tache-hiver${x.fait ? " faite" : ""}">
      <input type="checkbox" data-hiver="${esc(x.id)}"${x.fait ? " checked" : ""}>
      <span class="th-icone" aria-hidden="true">${x.icone}</span><span class="th-texte">${esc(x.texte)}</span>
      ${x.ajout && !x.fait ? `<button class="lien-bouton" data-hiver-ajout="${esc(x.ajout)}">Planter</button>` : ""}
    </label>`;
  return `<section class="carte carte-hiver" id="carte-hiver">
    <div class="carte-titre"><h2>${taches.length ? "🍂 Préparer l'hiver" : "🌻 La saison passée"}</h2>${taches.length ? `<span class="carte-sous-titre">${faites.length} sur ${taches.length} fait${faites.length > 1 ? "s" : ""}</span>` : ""}</div>
    ${taches.length ? `${aFaire.length ? aFaire.slice(0, 3).map(ligne).join("") : `<p class="texte-doux">Tout est prêt pour l'hiver. Bravo !</p>`}
      ${aFaire.length > 3 ? `<details class="coach-plus"><summary>${aFaire.length - 3} autre${aFaire.length - 3 > 1 ? "s" : ""} geste${aFaire.length - 3 > 1 ? "s" : ""}</summary>${aFaire.slice(3).map(ligne).join("")}</details>` : ""}
      ${faites.length ? `<details class="coach-plus"><summary>Déjà fait (${faites.length})</summary>${faites.map(ligne).join("")}</details>` : ""}` : ""}
    ${montrerBilan ? `<div class="inst-pied"><button class="btn" id="hv-bilan">🌻 Mon bilan de saison</button><span></span></div>` : ""}
  </section>`;
}

function brancherHiver(zone) {
  const carte = zone.querySelector("#carte-hiver");
  if (!carte) return;
  carte.querySelectorAll("[data-hiver]").forEach(cb => cb.addEventListener("change", () => {
    const t = tachesHiver().find(x => x.id === cb.dataset.hiver);
    if (!t) return;
    cocherTacheHiver(t, cb.checked);
    if (cb.checked) toast("Bien joué !");
    rendreCarteHiver();
    if (typeof rendreCoach === "function") rendreCoach();
  }));
  carte.querySelectorAll("[data-hiver-ajout]").forEach(b => b.addEventListener("click", e => { e.preventDefault(); ouvrirAjoutCulture({ planteId: b.dataset.hiverAjout }); }));
  const bilan = carte.querySelector("#hv-bilan");
  if (bilan) bilan.addEventListener("click", () => ouvrirBilan());
}
function rendreCarteHiver() {
  const ancienne = document.getElementById("carte-hiver");
  if (!ancienne) return;
  const tmp = document.createElement("div");
  tmp.innerHTML = carteHiverHTML();
  const nouvelle = tmp.firstElementChild;
  if (!nouvelle) { ancienne.remove(); return; }
  ancienne.replaceWith(nouvelle);
  brancherHiver(nouvelle.parentElement);
}

/* ---------- Mes envies pour la saison prochaine ---------- */

function trouverPlante(texte) {
  const q = normaliser(texte.trim());
  if (!q) return null;
  return PLANTS_DB.find(p => normaliser(p.nom) === q || normaliser(nomCourt(p)) === q)
    || PLANTS_DB.find(p => normaliser(nomCourt(p)).startsWith(q) || q.startsWith(normaliser(nomCourt(p))))
    || null;
}
function envieRealisee(e) {
  if (!e.planteId) return !!e.fait;
  const depuis = e.cree || "0000";
  const plantee = d => d && d >= depuis;
  return etat.parcelles.some(p => Object.values(p.cases).some(l => l.some(c => c.planteId === e.planteId && plantee(c.datePlantation)))
    || p.historique.some(h => h.planteId === e.planteId && plantee(h.debut)));
}
function quandEnvie(plante) {
  const mois = [...moisPourPlante(plante)].sort((a, b) => a - b);
  if (!mois.length) return "";
  const m = moisCourant();
  if (mois.includes(m)) return "c'est le moment";
  const suivant = mois.find(x => x > m) || mois[0];
  return "à partir de " + MOIS_NOMS[suivant - 1];
}
function ajouterEnvie(texte) {
  const t = String(texte || "").trim().slice(0, 80);
  if (!t) return false;
  const plante = trouverPlante(t);
  const envies = donneesSaison().envies;
  if (plante && envies.some(e => e.planteId === plante.id && !envieRealisee(e))) { toast("Elle est déjà dans tes envies."); return false; }
  envies.push({ id: creerId(), planteId: plante ? plante.id : null, texte: plante ? "" : t, cree: isoLocal() });
  sauvegarder();
  return true;
}

function listeEnviesHTML() {
  const envies = donneesSaison().envies.slice().sort((a, b) => envieRealisee(a) - envieRealisee(b));
  const noms = PLANTS_DB.slice().sort((a, b) => a.nom.localeCompare(b.nom, "fr")).map(p => `<option value="${esc(nomCourt(p))}">`).join("");
  return `${envies.length ? `<div class="liste-envies">${envies.map(e => {
      const p = e.planteId ? planteParId(e.planteId) : null, ok = envieRealisee(e);
      const quand = p && !ok ? quandEnvie(p) : "";
      return `<div class="envie${ok ? " realisee" : ""}">
        <span class="envie-nom">${p ? ico(p, "1.4em") + " " + esc(nomCourt(p)) : "✨ " + esc(e.texte)}</span>
        <span class="envie-quand${quand === "c'est le moment" ? " maintenant" : ""}">${ok ? "✓ plantée" : esc(quand)}</span>
        ${p && !ok && quand === "c'est le moment" ? `<button class="btn-petit" data-envie-ajout="${p.id}">Planter</button>` : ""}
        <button class="btn-icone" data-envie-suppr="${e.id}" aria-label="Retirer cette envie">✕</button>
      </div>`;
    }).join("")}</div>` : `<p class="texte-doux petit">Une variété vue chez un voisin, une fleur qui te fait envie, un légume jamais essayé… Note-les ici : je te les rappellerai au bon moment pour les semer.</p>`}
    <form class="envie-form" data-envie-form>
      <input type="text" list="envies-plantes" maxlength="80" placeholder="ex. tomate cerise, dahlias…" aria-label="Nouvelle envie">
      <datalist id="envies-plantes">${noms}</datalist>
      <button class="btn" type="submit">Ajouter</button>
    </form>`;
}
function brancherEnvies(zone, redessiner) {
  const f = zone.querySelector("[data-envie-form]");
  if (f) f.addEventListener("submit", e => {
    e.preventDefault();
    if (ajouterEnvie(f.querySelector("input").value)) redessiner();
  });
  zone.querySelectorAll("[data-envie-suppr]").forEach(b => b.addEventListener("click", () => {
    const envies = donneesSaison().envies, i = envies.findIndex(x => x.id === b.dataset.envieSuppr);
    if (i < 0) return;
    avecAnnulation("Envie retirée.", () => envies.splice(i, 1));
    redessiner();
  }));
  zone.querySelectorAll("[data-envie-ajout]").forEach(b => b.addEventListener("click", () => ouvrirAjoutCulture({ planteId: b.dataset.envieAjout })));
}
function carteEnviesHTML() {
  return `<section class="carte" id="carte-envies">
    <div class="carte-titre"><h2>✨ Mes envies</h2><span class="carte-sous-titre">pour la saison prochaine</span></div>
    <div id="envies-zone">${listeEnviesHTML()}</div>
  </section>`;
}
function brancherCarteEnvies(zone) {
  const z = zone.querySelector("#envies-zone");
  if (!z) return;
  const redessiner = () => { z.innerHTML = listeEnviesHTML(); brancherEnvies(z, redessiner); };
  brancherEnvies(z, redessiner);
}

function conseilsEnvies() {
  const m = moisCourant();
  return donneesSaison().envies.filter(e => e.planteId && !envieRealisee(e)).map(e => planteParId(e.planteId)).filter(Boolean)
    .filter(p => moisPourPlante(p).has(m)).slice(0, 2).map(p => ({
      type: "conseil", icone: "✨", titre: `Ton envie : ${nomCourt(p).toLowerCase()}, c'est le moment`,
      texte: `Tu avais noté l'envie de cultiver ${nomCourt(p).toLowerCase()}. ${majuscule(verbeAction(p, m).toLowerCase())} maintenant, c'est la bonne période.${p.conseilCourt ? " " + p.conseilCourt : ""}`,
      action: { label: "L'ajouter au potager", ajout: p.id }
    }));
}

/* ---------- Bilan de saison ---------- */

function bilanDeSaison(annee) {
  const dansAnnee = d => !!d && d.slice(0, 4) === String(annee);
  const terminees = [];
  etat.parcelles.forEach(p => p.historique.forEach(h => { if (dansAnnee(h.fin) && planteParId(h.planteId)) terminees.push({ h, parcelle: p }); }));
  const enPlace = [];
  etat.parcelles.forEach(p => Object.values(p.cases).forEach(l => l.forEach(c => { if (planteParId(c.planteId)) enPlace.push(c); })));
  const cultivees = new Set([...terminees.map(t => t.h.planteId), ...enPlace.filter(c => dansAnnee(c.datePlantation) || estPerenne(planteParId(c.planteId))).map(c => c.planteId)]);
  const photos = [];
  etat.journal.filter(j => dansAnnee(j.date) && (j.photos || []).length).sort((a, b) => a.date.localeCompare(b.date))
    .forEach(j => j.photos.forEach(id => photos.push({ id, entree: j })));
  return { terminees, cultivees, photos };
}

function ouvrirBilan(annee = anneeBilan()) {
  const b = bilanDeSaison(annee);
  const fleurs = [...b.cultivees].filter(id => (planteParId(id) || {}).categorie === "fleur").length;
  const groupe = avis => b.terminees.filter(t => t.h.avis === avis);
  const puce = t => {
    const p = planteParId(t.h.planteId);
    return `<div class="bilan-ligne">${ico(p, "1.4em")} <strong>${esc(nomCourt(p))}</strong>${t.h.variete ? ` <em class="variete">${esc(t.h.variete)}</em>` : ""}${t.h.commentaire ? `<div class="texte-doux petit">« ${esc(t.h.commentaire)} »</div>` : ""}</div>`;
  };
  const sansAvis = b.terminees.filter(t => !t.h.avis);
  const sections = [["bien", "👍 Ce qui a bien marché"], ["moyen", "😐 Mitigé"], ["rate", "👎 À revoir"]]
    .map(([k, titre]) => { const g = groupe(k); return g.length ? `<h3 class="sous-titre-section">${titre}</h3>${g.map(puce).join("")}` : ""; }).join("");
  const phrase = b.cultivees.size
    ? `Tu as cultivé <strong>${b.cultivees.size} plante${b.cultivees.size > 1 ? "s" : ""}</strong>${fleurs ? `, dont ${fleurs} fleur${fleurs > 1 ? "s" : ""}` : ""}${b.photos.length ? `, et gardé ${b.photos.length} photo${b.photos.length > 1 ? "s" : ""} au journal` : ""}.`
    : "Ta première saison dans l'appli commence : le bilan se remplira au fil de tes cultures et de tes photos.";
  ouvrirFenetre(`
    <h2>🌻 Ma saison ${annee}</h2>
    <p>${phrase}</p>
    ${sections}
    ${sansAvis.length ? `<h3 class="sous-titre-section">Pas encore d'avis</h3>
      ${sansAvis.slice(0, 8).map((t, i) => `<div class="bilan-ligne bilan-avis">${ico(planteParId(t.h.planteId), "1.4em")} <strong>${esc(nomCourt(planteParId(t.h.planteId)))}</strong>
        <span class="bilan-boutons">${Object.entries(AVIS).map(([k, l]) => `<button class="chip" data-bilan-avis="${i}|${k}" aria-label="${esc(l)}">${l.split(" ")[0]}</button>`).join("")}</span></div>`).join("")}` : ""}
    ${!sections && !sansAvis.length && b.cultivees.size ? `<p class="texte-doux petit">Quand tu termines une culture (« Fin de culture »), je te demande comment ça s'est passé : tes avis apparaîtront ici.</p>` : ""}
    ${b.photos.length ? `<h3 class="sous-titre-section">📷 L'année en photos${groupesAvantApres().length ? ` <button class="lien-bouton" id="bl-aa">↔ avant / après</button>` : ""}</h3>
      <div class="bilan-photos">${b.photos.slice(-12).map(x => `<button class="photo-mini" data-bilan-photo="${x.id}" data-entree="${x.entree.id}" aria-label="Voir la photo"><img alt="" data-photo-img="${x.id}"><span>${esc(MOIS_NOMS[+x.entree.date.slice(5, 7) - 1])}</span></button>`).join("")}</div>` : ""}
    <h3 class="sous-titre-section">✨ Pour la saison prochaine</h3>
    <div id="bilan-envies">${listeEnviesHTML()}</div>
    <div class="actions-fenetre">
      <button class="btn-discret" id="bl-annee">Refaire comme cette année →</button>
      <button class="btn" id="bl-fermer">Fermer</button>
    </div>`, fen => {
    chargerMiniatures(fen);
    fen.querySelectorAll("[data-bilan-photo]").forEach(bt => bt.addEventListener("click", () => ouvrirPhoto(bt.dataset.bilanPhoto, bt.dataset.entree, () => ouvrirBilan(annee))));
    fen.querySelectorAll("[data-bilan-avis]").forEach(bt => bt.addEventListener("click", () => {
      const [i, k] = bt.dataset.bilanAvis.split("|");
      sansAvis[+i].h.avis = k;
      sauvegarder();
      ouvrirBilan(annee);
    }));
    const z = fen.querySelector("#bilan-envies");
    const redessiner = () => { z.innerHTML = listeEnviesHTML(); brancherEnvies(z, redessiner); };
    brancherEnvies(z, redessiner);
    fen.querySelector("#bl-fermer").addEventListener("click", () => { fermerFenetre(); rendre(); });
    const aa = fen.querySelector("#bl-aa");
    if (aa) aa.addEventListener("click", () => ouvrirAvantApres());
    fen.querySelector("#bl-annee").addEventListener("click", () => { fermerFenetre(); ui.vueSaisons = "annee"; allerA("saisons"); });
  });
}

/* ---------- Fleuri toute l'année ---------- */

// Mois de floraison au jardin (Bretagne)
const FLORAISON = {
  glaieul: [7, 8, 9], capucine: [6, 7, 8, 9, 10], souci: [4, 5, 6, 7, 8, 9, 10, 11], tournesol: [7, 8, 9],
  "oeillet-inde": [6, 7, 8, 9, 10], lavande: [6, 7, 8], bourrache: [5, 6, 7, 8, 9], cosmos: [7, 8, 9, 10],
  zinnia: [7, 8, 9], bleuet: [5, 6, 7], "pois-de-senteur": [6, 7, 8], nigelle: [6, 7, 8], achillee: [6, 7, 8, 9],
  narcisse: [2, 3, 4], tulipe: [4, 5], pensee: [11, 12, 1, 2, 3, 4, 5],
  ciboulette: [5, 6], romarin: [1, 2, 3, 4], thym: [5, 6], sauge: [5, 6], origan: [7, 8], fraise: [4, 5, 6],
  artichaut: [7, 8], fenouil: [7, 8], aneth: [7, 8], coriandre: [6, 7], laurier: [3, 4]
};
function floraisonDe(plante) {
  if (!plante) return [];
  if (FLORAISON[plante.id]) return FLORAISON[plante.id];
  return plante.categorie === "fleur" ? (plante.moisRecolte || []) : [];
}
// Ce qui fleurit chez toi cette saison : cultures en place + terminées cette année
function moisFleuris() {
  const an = String(new Date().getFullYear());
  const ids = new Set();
  etat.parcelles.forEach(p => {
    Object.values(p.cases).forEach(l => l.forEach(c => ids.add(c.planteId)));
    p.historique.forEach(h => { if ((h.fin || "").slice(0, 4) === an) ids.add(h.planteId); });
  });
  const parMois = Array.from({ length: 12 }, () => []);
  ids.forEach(id => { const p = planteParId(id); floraisonDe(p).forEach(m => parMois[m - 1].push(p)); });
  return parMois;
}
// Les mois creux, regroupés en périodes (ex. « de novembre à mars »)
function periodesCreuses(parMois) {
  const creux = parMois.map((l, i) => l.length ? null : i + 1);
  if (creux.every(x => x === null) || creux.every(x => x !== null)) return [];
  const periodes = [];
  let debut = creux.findIndex((x, i) => x !== null && creux[(i + 11) % 12] === null);
  for (let n = 0, i = debut; n < 12; n++, i = (i + 1) % 12) {
    if (creux[i] !== null && creux[(i + 11) % 12] === null) periodes.push([i + 1, i + 1]);
    else if (creux[i] !== null) periodes[periodes.length - 1][1] = i + 1;
  }
  return periodes;
}
function libellePeriode([a, b]) {
  const n = MOIS_NOMS[a - 1];
  if (a === b) return "en " + n;
  if (b === a % 12 + 1) return `en ${n} et ${MOIS_NOMS[b - 1]}`;
  return `${/^[aeiou]/.test(n) ? "d'" : "de "}${n} à ${MOIS_NOMS[b - 1]}`;
}
// Fleurs qui combleraient les creux, celles qu'on peut planter bientôt d'abord
function fleursPourCreux(parMois) {
  const creux = new Set(parMois.map((l, i) => l.length ? 0 : i + 1).filter(Boolean));
  const m = moisCourant(), bientot = new Set([m, m % 12 + 1]);
  const presentes = new Set(parMois.flat().map(p => p.id));
  return PLANTS_DB.filter(p => (p.categorie === "fleur" || FLORAISON[p.id]) && !presentes.has(p.id))
    .map(p => ({ p, couvre: floraisonDe(p).filter(x => creux.has(x)).length, tot: [...moisPourPlante(p)].some(x => bientot.has(x)) }))
    .filter(x => x.couvre > 0)
    .sort((a, b) => b.tot - a.tot || b.couvre - a.couvre)
    .slice(0, 4);
}

function carteFleursHTML() {
  const parMois = moisFleuris();
  const periodes = periodesCreuses(parMois);
  const idees = fleursPourCreux(parMois);
  const presentes = [...new Map(parMois.flat().map(p => [p.id, p])).values()];
  const m = moisCourant();
  return `<section class="carte" id="carte-fleurs">
    <div class="carte-titre"><h2>🌼 Fleuri toute l'année</h2></div>
    <div class="bande-fleurs" role="img" aria-label="Mois en fleurs dans ton potager">
      ${parMois.map((l, i) => `<span class="bf-mois${l.length ? " fleuri" : ""}${i + 1 === m ? " courant" : ""}" title="${esc(MOIS_NOMS[i])} : ${l.length ? esc(l.map(p => nomCourt(p)).join(", ")) : "rien en fleur"}">${MOIS_INITIALES[i]}${l.length ? `<i>${l.length > 1 ? "✿" : "•"}</i>` : ""}</span>`).join("")}
    </div>
    ${presentes.length ? `<p class="texte-doux petit">En fleur chez toi : ${esc(listeFr(presentes.slice(0, 6).map(p => nomCourt(p).toLowerCase())))}.</p>` : ""}
    ${periodes.length ? `<p>Rien ne fleurit <strong>${esc(listeFr(periodes.map(libellePeriode)))}</strong>.${idees.length ? " De quoi combler ces mois :" : ""}</p>` : presentes.length ? `<p>Ton potager est en fleurs toute l'année. 🌸</p>` : `<p class="texte-doux">Ajoute quelques fleurs : elles attirent les pollinisateurs et les insectes qui mangent les pucerons.</p>`}
    ${idees.length ? `<div class="idees-fleurs">${idees.map(x => {
      const fl = floraisonDe(x.p), qd = quandEnvie(x.p);
      return `<button class="idee-fleur" data-fleur="${x.p.id}">${ico(x.p, "1.8em")}<span><strong>${esc(nomCourt(x.p))}</strong><small>fleurit ${esc(libellePeriode([fl[0], fl[fl.length - 1]]).replace(/^en (\S+)$/, "en $1"))} · ${esc(qd === "c'est le moment" ? "à planter maintenant" : qd.replace("à partir de", "à planter dès"))}</small></span></button>`;
    }).join("")}</div>` : ""}
  </section>`;
}
function brancherFleurs(zone) {
  zone.querySelectorAll("[data-fleur]").forEach(b => b.addEventListener("click", () => {
    const p = planteParId(b.dataset.fleur);
    if (moisPourPlante(p).has(moisCourant())) ouvrirAjoutCulture({ planteId: p.id });
    else ouvrirFichePlante(p.id);
  }));
}

// Pour le coach : une fleur à planter maintenant pour combler un creux (sinon une touche de couleur classique)
function conseilFleurs(cultures) {
  const m = moisCourant();
  const parMois = moisFleuris();
  const periodes = periodesCreuses(parMois);
  const maintenant = fleursPourCreux(parMois).filter(x => moisPourPlante(x.p).has(m)).slice(0, 2);
  if (periodes.length && maintenant.length) {
    const creuxTexte = listeFr(periodes.map(libellePeriode));
    return {
      type: "conseil", icone: "🌼", titre: `Des fleurs ${creuxTexte}`,
      texte: `Rien ne fleurit chez toi ${creuxTexte}. À planter maintenant pour fleurir justement à ce moment-là : ${listeFr(maintenant.map(x => nomCourt(x.p).toLowerCase()))}.`,
      action: { label: "L'ajouter au potager", ajout: maintenant[0].p.id }
    };
  }
  const fleurs = PLANTS_DB.filter(p => p.categorie === "fleur" && moisPourPlante(p).has(m));
  const { libres } = compterCases();
  if (fleurs.length && libres > 0 && !cultures.some(c => c.plante.categorie === "fleur" && joursEntre(c.datePlantation, aujourdhui()) < 40)) {
    const choix = fleurs.sort((a, b) => (COMPAGNONS[b.id] ? COMPAGNONS[b.id].amis.size : 0) - (COMPAGNONS[a.id] ? COMPAGNONS[a.id].amis.size : 0)).slice(0, 3);
    return {
      type: "conseil", icone: "🌼", titre: "Une touche de couleur ce mois-ci",
      texte: `Pour un potager beau et vivant : ${listeFr(choix.map(p => nomCourt(p).toLowerCase()))}. Ils attirent les pollinisateurs et les auxiliaires qui mangent les pucerons.`,
      action: { label: "Voir les idées", vue: "saisons", sousVue: "annee" }
    };
  }
  return null;
}

/* ---------- Limaces et oiseaux : au bon moment ---------- */

const PROIES_LIMACES = new Set(["salade", "chou", "chou-fleur", "haricot-vert", "courgette", "courge", "concombre", "fraise", "epinard", "epinard-hiver", "radis", "betterave", "celeri", "petit-pois", "feve", "basilic", "tournesol", "zinnia", "cosmos", "pois-de-senteur", "pensee", "tulipe", "capucine", "navet"]);

function conseilsDefense(cultures) {
  const prefs = typeof prefsJardin === "function" ? prefsJardin() : { soucis: [] };
  const conseils = [];
  const m = moisCourant();
  if (prefs.soucis.includes("limaces") && m >= 3 && m <= 11) {
    const proies = cultures.filter(c => PROIES_LIMACES.has(c.plante.id));
    const jeunes = proies.filter(c => joursEntre(c.datePlantation, aujourdhui()) <= 30);
    const jours = joursMeteoValides();
    const passes = typeof joursPassesMeteo === "function" ? joursPassesMeteo() : [];
    const humide = !!(jours && (passes.slice(-2).some(j => j.pluie >= 2) || jours.slice(0, 2).some(j => j.pluie >= 2)) && jours.slice(0, 2).every(j => j.tmin >= 5));
    const cibles = jeunes.length ? jeunes : proies;
    if (humide && cibles.length) {
      conseils.push({
        type: "alerte", icone: "🐌", titre: "Temps à limaces ce soir",
        texte: `Doux et humide : elles sortent en nombre. Fais un tour à la lampe à la tombée de la nuit, surtout près de tes ${jeunes.length ? "jeunes plants" : "cultures tendres"} (${nomsListe(cibles.map(c => c.plante.id))}), et vérifie les pièges à bière. Une planche posée au sol les rassemble pour le ramassage du matin.`
      });
    } else if (jeunes.length) {
      conseils.push({
        type: "conseil", icone: "🐌", titre: "Jeunes plants à protéger des limaces",
        texte: `${majuscule(nomsListe(jeunes.map(c => c.plante.id)))} ${jeunes.length > 1 ? "ont" : "a"} moins d'un mois : entoure-les de cendre, de coquilles broyées ou de laine, et regarde le matin sous les planches.`
      });
    }
  }
  if (prefs.soucis.includes("oiseaux")) {
    const jardin = typeof reglagesJardin === "function" ? reglagesJardin() : {};
    const cerisier = (jardin.arbres || []).some(a => a.type === "fruitier");
    if (cerisier && [5, 6].includes(m)) conseils.push({
      type: "conseil", icone: "🍒", titre: "Les cerises vont rougir",
      texte: "Merles et étourneaux les repèrent avant toi : pose un filet sur le cerisier dès que les fruits changent de couleur, ou accroche des rubans qui bougent au vent."
    });
    const semesAutomne = cultures.filter(c => ["feve", "petit-pois", "ail", "oignon", "echalote", "tulipe", "narcisse"].includes(c.plante.id) && joursEntre(c.datePlantation, aujourdhui()) <= 15);
    if ([10, 11, 12, 1, 2].includes(m) && semesAutomne.length) conseils.push({
      type: "conseil", icone: "🐦", titre: "Terre fraîchement travaillée : les oiseaux grattent",
      texte: `Les merles déterrent volontiers ${nomsListe(semesAutomne.map(c => c.plante.id))}. Un filet ou quelques branchages posés dessus pendant deux semaines suffisent.`
    });
  }
  return conseils;
}

/* ---------- Avant / après : le même bac ou la même culture au fil des mois ---------- */

// Bac d'une entrée du journal : noté directement, ou déduit de la culture si elle n'est que dans un bac
function bacDeEntree(j) {
  if (j.parcelleId && etat.parcelles.some(p => p.id === j.parcelleId)) return j.parcelleId;
  if (!j.planteId) return null;
  const bacs = etat.parcelles.filter(p => Object.values(p.cases).some(l => l.some(c => c.planteId === j.planteId)) || p.historique.some(h => h.planteId === j.planteId));
  return bacs.length === 1 ? bacs[0].id : null;
}
function groupesAvantApres() {
  const groupes = new Map();
  const ajouter = (cle, libelle, icone, j) => {
    if (!groupes.has(cle)) groupes.set(cle, { cle, libelle, icone, photos: [] });
    j.photos.forEach(id => groupes.get(cle).photos.push({ id, entree: j }));
  };
  etat.journal.filter(j => (j.photos || []).length && j.date).forEach(j => {
    const bac = bacDeEntree(j);
    if (bac) { const p = etat.parcelles.find(x => x.id === bac); ajouter("b:" + bac, p.nom, "🪴", j); }
    const pl = j.planteId && planteParId(j.planteId);
    if (pl) ajouter("p:" + pl.id, nomCourt(pl), ico(pl, "1.3em"), j);
  });
  return [...groupes.values()].filter(g => new Set(g.photos.map(x => x.entree.date)).size >= 2)
    .map(g => ({ ...g, photos: g.photos.sort((a, b) => a.entree.date.localeCompare(b.entree.date)) }))
    .sort((a, b) => a.cle[0].localeCompare(b.cle[0]) || b.photos.length - a.photos.length);
}
function ecartTexte(d1, d2) {
  const j = joursEntre(parseDate(d1), parseDate(d2));
  if (j < 14) return j <= 1 ? "le même jour ou presque" : `${j} jours d'écart`;
  if (j < 60) return `${Math.round(j / 7)} semaines d'écart`;
  const m = Math.round(j / 30.4);
  return m < 12 ? `${m} mois d'écart` : `${Math.floor(m / 12)} an${m >= 24 ? "s" : ""}${m % 12 ? " et " + (m % 12) + " mois" : ""} d'écart`;
}

function ouvrirAvantApres(cle = null, choix = null) {
  const groupes = groupesAvantApres();
  if (!groupes.length) {
    ouvrirFenetre(`<h2>↔ Avant / après</h2>
      <p>Prends en photo le même bac ou la même culture à plusieurs dates : je les mettrai côte à côte pour voir le potager évoluer.</p>
      <p class="texte-doux petit">Astuce : en ajoutant une photo, touche la culture ou le bac concerné.</p>
      <div class="actions-fenetre"><button class="btn" id="aa-fermer">Fermer</button></div>`, fen => fen.querySelector("#aa-fermer").addEventListener("click", fermerFenetre));
    return;
  }
  const g = groupes.find(x => x.cle === cle) || groupes[0];
  const n = g.photos.length;
  let [ia, ib] = choix && choix[0] < n && choix[1] < n ? choix : [0, n - 1];
  const A = g.photos[ia], B = g.photos[ib];
  const figure = (x, titre) => `<figure><div class="aa-img photo-mini"><img alt="${titre}" data-photo-img="${x.id}"></div>
    <figcaption><strong>${titre}</strong> · ${esc(formatDate(parseDate(x.entree.date)))}${x.entree.texte && !/^Photo/.test(x.entree.texte) ? `<br>${esc(x.entree.texte)}` : ""}</figcaption></figure>`;
  ouvrirFenetre(`
    <h2>↔ Avant / après</h2>
    <div class="chips">${groupes.map(x => `<button class="chip${x.cle === g.cle ? " actif" : ""}" data-aa-groupe="${esc(x.cle)}">${x.icone} ${esc(x.libelle)}</button>`).join("")}</div>
    <div class="avant-apres">${figure(A, "Avant")}${figure(B, "Après")}</div>
    <p class="texte-doux petit" style="text-align:center">${esc(ecartTexte(A.entree.date, B.entree.date))}</p>
    ${n > 2 ? `<p class="texte-doux petit">Touche une photo pour changer la comparaison :</p>
      <div class="aa-bande">${g.photos.map((x, i) => `<button class="photo-mini${i === ia ? " choisie-a" : i === ib ? " choisie-b" : ""}" data-aa="${i}" aria-label="Photo du ${esc(x.entree.date)}"><img alt="" data-photo-img="${x.id}"></button>`).join("")}</div>` : ""}
    <div class="actions-fenetre"><button class="btn" id="aa-fermer">Fermer</button></div>`, fen => {
    chargerMiniatures(fen);
    fen.querySelectorAll("[data-aa-groupe]").forEach(b => b.addEventListener("click", () => ouvrirAvantApres(b.dataset.aaGroupe)));
    fen.querySelectorAll("[data-aa]").forEach(b => b.addEventListener("click", () => {
      const i = +b.dataset.aa;
      if (i === ia || i === ib) return;
      ouvrirAvantApres(g.cle, i < ib ? [i, ib] : [ia, i]);
    }));
    fen.querySelector("#aa-fermer").addEventListener("click", fermerFenetre);
  });
}
