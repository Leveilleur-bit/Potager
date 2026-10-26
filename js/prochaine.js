/* ============================================================
   Mon potager de l'an prochain
   Un plan « brouillon » de la saison suivante, case par case, dessiné
   sur le vrai plan : rotation, soleil, bons voisins, tes envies et tes avis.
   Les vivaces restent en place. Au printemps, le coach s'en sert pour
   proposer les emplacements.
   ============================================================ */

// L'année que l'on prépare : l'an prochain à partir de juillet, sinon l'année en cours
function anneeProchaine() { return moisCourant() >= 7 ? new Date().getFullYear() + 1 : new Date().getFullYear(); }

function planFutur(annee = anneeProchaine()) {
  if (!etat.prochaineSaison || typeof etat.prochaineSaison !== "object") etat.prochaineSaison = {};
  const k = String(annee);
  if (!etat.prochaineSaison[k] || typeof etat.prochaineSaison[k] !== "object") etat.prochaineSaison[k] = {};
  return etat.prochaineSaison[k];
}
function prevusDans(parcelle, coord, annee = anneeProchaine()) {
  const p = ((etat.prochaineSaison || {})[String(annee)] || {})[parcelle.id] || {};
  return (p[coord] || []).filter(id => planteParId(id));
}
// Ce qui occupera la case : les vivaces déjà là + ce qui est prévu
function vivacesDans(parcelle, coord) {
  return culturesReelles(parcelle, coord).filter(c => estPerenne(planteParId(c.planteId)));
}
function contenuFutur(parcelle, coord, annee = anneeProchaine()) {
  return [...vivacesDans(parcelle, coord).map(c => ({ id: c.id, planteId: c.planteId, vivace: true })),
    ...prevusDans(parcelle, coord, annee).map(id => ({ id: "f-" + id, planteId: id }))];
}
function nbPrevus(annee = anneeProchaine()) {
  return Object.values((etat.prochaineSaison || {})[String(annee)] || {}).reduce((n, bac) => n + Object.values(bac).reduce((m, l) => m + l.length, 0), 0);
}
function definirPrevus(parcelle, coord, ids, annee = anneeProchaine()) {
  const plan = planFutur(annee);
  plan[parcelle.id] = plan[parcelle.id] || {};
  if (ids.length) plan[parcelle.id][coord] = ids; else delete plan[parcelle.id][coord];
  if (!Object.keys(plan[parcelle.id]).length) delete plan[parcelle.id];
}

/* ---------- Rotation : quel groupe pour chaque bac l'an prochain ---------- */

function groupeConseille(parcelle) {
  const hist = historiqueRotation(parcelle);
  const annees = Object.keys(hist).map(Number).sort((a, b) => b - a);
  if (!annees.length) return { suivant: null, dernier: null, annee: null };
  const an = annees[0];
  const dominant = Object.entries(hist[an]).sort((x, y) => y[1] - x[1])[0][0];
  const idx = GROUPES_ROTATION.findIndex(g => g.id === dominant);
  return { suivant: GROUPES_ROTATION[(idx + 1) % GROUPES_ROTATION.length], dernier: GROUPES_ROTATION[idx], annee: an, eviter: Object.keys(hist[an]) };
}
function dansRotation(plante) { return plante.categorie === "legume" && !ROTATION_IGNORED_FAMILIES.includes(plante.famille) && !estPerenne(plante); }

/* ---------- Proposition automatique ---------- */

// Ce que tu aimerais cultiver : tes envies, ce qui a marché (ou presque), ce qui est déjà prévu dans ton année
function candidatsProchaineSaison(annee = anneeProchaine()) {
  const liste = new Map();
  const ajouter = (id, raison, poids) => {
    const p = planteParId(id);
    if (!p || estPerenne(p)) return;
    const x = liste.get(id) || { plante: p, raisons: [], poids: 0 };
    if (!x.raisons.includes(raison)) x.raisons.push(raison);
    x.poids += poids;
    liste.set(id, x);
  };
  (etat.envies || []).forEach(e => { if (e.planteId && !envieRealisee(e)) ajouter(e.planteId, "ton envie", 5); });
  etat.projets.filter(pr => pr.mois.startsWith(String(annee)) && !pr.fait).forEach(pr => ajouter(pr.planteId, "prévu dans ton année", 4));
  const rates = new Set();
  etat.parcelles.forEach(p => p.historique.forEach(h => {
    if (!h.fin || +h.fin.slice(0, 4) < annee - 2) return;
    if (h.avis === "rate") { rates.add(h.planteId); return; }
    ajouter(h.planteId, h.avis === "bien" ? "👍 l'an dernier" : "cultivée l'an dernier", h.avis === "bien" ? 3 : 1);
  }));
  etat.parcelles.forEach(p => Object.values(p.cases).forEach(l => l.forEach(c => {
    if (c.datePlantation && +c.datePlantation.slice(0, 4) >= annee - 1) ajouter(c.planteId, "cultivée cette année", 1);
  })));
  // Une ou deux fleurs pour les mois sans fleurs
  if (typeof fleursPourCreux === "function") fleursPourCreux(moisFleuris()).slice(0, 2).forEach(x => ajouter(x.p.id, "fleurs pour les mois creux", 2));
  rates.forEach(id => { const x = liste.get(id); if (x && !x.raisons.some(r => r === "ton envie")) liste.delete(id); });
  return [...liste.values()].sort((a, b) => b.poids - a.poids || a.plante.nom.localeCompare(b.plante.nom, "fr"));
}

function proposerPlanFutur({ remplacer = false } = {}, annee = anneeProchaine()) {
  if (remplacer) etat.prochaineSaison[String(annee)] = {};
  const dejaPrevus = new Set();
  etat.parcelles.forEach(p => Object.keys(p.cases).concat(Object.keys((planFutur(annee)[p.id]) || {})).forEach(c => prevusDans(p, c, annee).forEach(id => dejaPrevus.add(id))));
  const groupes = Object.fromEntries(etat.parcelles.map(p => [p.id, groupeConseille(p)]));
  const places = [], restants = [];
  candidatsProchaineSaison(annee).filter(x => !dejaPrevus.has(x.plante.id)).forEach(x => {
    const plante = x.plante;
    let meilleur = null;
    etat.parcelles.forEach(p => {
      const g = groupes[p.id];
      const gp = dansRotation(plante) ? groupeRotation(plante.famille) : null;
      for (let y = 0; y < p.hauteur; y++) for (let xx = 0; xx < p.largeur; xx++) {
        const coord = xx + "-" + y;
        if (!dansLimites(p, coord)) continue;
        const contenu = contenuFutur(p, coord, annee);
        const petite = plante.categorie === "aromate" || plante.categorie === "fleur";
        if (contenu.length >= (petite ? 3 : 1) && !(petite && contenu.length < 3)) continue;
        if (contenu.some(c => c.planteId === plante.id)) continue;
        // voisins prévus : dans la case et les cases d'à côté
        const voisins = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].flatMap(([dx, dy]) => contenuFutur(p, (xx + dx) + "-" + (y + dy), annee).map(c => c.planteId));
        if (voisins.some(v => relation(plante.id, v) === "ennemis")) continue;
        let score = contenu.length ? -2 : 3;
        score += voisins.filter(v => relation(plante.id, v) === "amis").length * 2;
        if (gp && g.suivant) score += gp.id === g.suivant.id ? 6 : (g.eviter || []).includes(gp.id) ? -8 : 0;
        if (typeof ensoleillementCase === "function") score += scoreEnsoleillement(plante, ensoleillementCase(p, coord)) * 1.5;
        if (petite && contenu.length) score += 1;   // les fleurs et aromates se glissent volontiers entre les légumes
        if (!meilleur || score > meilleur.score) meilleur = { p, coord, score };
      }
    });
    if (meilleur && meilleur.score > -4) {
      definirPrevus(meilleur.p, meilleur.coord, [...prevusDans(meilleur.p, meilleur.coord, annee), plante.id], annee);
      places.push(plante);
    } else restants.push(plante);
  });
  sauvegarder();
  return { places, restants };
}

/* ---------- Carte dans « Mon année » ---------- */

function cartePotagerFuturHTML() {
  const an = anneeProchaine();
  const n = nbPrevus(an);
  const resume = etat.parcelles.map(p => {
    const g = groupeConseille(p);
    const prevus = [...new Set(Object.keys(planFutur(an)[p.id] || {}).flatMap(c => prevusDans(p, c, an)))].map(planteParId);
    return `<div class="futur-bac">
      <div class="futur-bac-titre"><strong>${esc(p.nom)}</strong>${g.suivant ? `<span class="tag-info">${g.suivant.icone} ${esc(g.suivant.label.toLowerCase())}</span>` : ""}</div>
      ${g.dernier ? `<div class="texte-doux petit">En ${g.annee} : ${g.dernier.icone} ${esc(g.dernier.label.toLowerCase())} → en ${an}, plutôt ${esc(g.suivant.label.toLowerCase())} (${esc(g.suivant.note)}).</div>` : ""}
      ${prevus.length ? `<div class="futur-plantes">${prevus.map(pl => `${ico(pl, "1.3em")} ${esc(nomCourt(pl))}`).join(" · ")}</div>` : ""}
    </div>`;
  }).join("");
  return `<section class="carte carte-futur" id="carte-futur">
    <div class="carte-titre"><h2>🗺️ Mon potager ${an}</h2><span class="carte-sous-titre">${n ? n + " culture" + (n > 1 ? "s" : "") + " prévue" + (n > 1 ? "s" : "") : "à imaginer"}</span></div>
    <p class="texte-doux petit">Un brouillon de la saison prochaine, sur ton vrai plan. Les vivaces restent en place. Touche une case pour y mettre ou retirer une culture. Couleurs : la famille de rotation.</p>
    <div class="actions-fenetre futur-actions">
      <button class="btn" id="fu-proposer">✨ ${n ? "Compléter avec mes idées" : "Me proposer un plan"}</button>
      ${n ? `<button class="btn-discret" id="fu-effacer">Tout effacer</button>` : ""}
    </div>
    <div class="plan-cadre"><div id="fu-plan" class="plan-zone"></div></div>
    ${legendeFuturHTML(an)}
    <details class="accordeon"><summary>Bac par bac</summary>${resume}</details>
  </section>`;
}

function legendeFuturHTML(an) {
  const presentes = new Set();
  PLAN_FUTUR = an;
  try { etat.parcelles.forEach(p => { for (let y = 0; y < p.hauteur; y++) for (let x = 0; x < p.largeur; x++) categoriesCase(p, x + "-" + y, "rotation").forEach(k => presentes.add(k)); }); }
  finally { PLAN_FUTUR = null; }
  const items = Object.entries(LEGENDES_PLAN.rotation).filter(([k]) => presentes.has(k));
  return `<div class="legende legende-plan-vue">${items.map(([, [c, l]]) => `<span><span class="puce" style="background:${c}"></span>${esc(l)}</span>`).join("")}<span><span class="puce puce-libre"></span>Libre</span></div>`;
}

function brancherPotagerFutur(zone) {
  const carte = zone.querySelector("#carte-futur");
  if (!carte) return;
  const an = anneeProchaine();
  dessinerPlan(carte.querySelector("#fu-plan"), { futur: an, surCase: (pid, x, y) => ouvrirCaseFuture(pid, x, y) });
  carte.querySelector("#fu-proposer").addEventListener("click", () => {
    const avant = JSON.stringify(etat);
    const { places, restants } = proposerPlanFutur();
    rendreSaisons();
    const msg = places.length ? `${places.length} culture${places.length > 1 ? "s" : ""} placée${places.length > 1 ? "s" : ""}${restants.length ? `, ${restants.length} sans place` : ""}.` : "Rien de plus à proposer : ajoute des envies ou donne tes avis pour m'aider.";
    toast(msg, { annuler: () => { etat = migrer(JSON.parse(avant)); sauvegarder(); rendreSaisons(); } });
  });
  const eff = carte.querySelector("#fu-effacer");
  if (eff) eff.addEventListener("click", () => avecAnnulation(`Plan ${an} effacé.`, () => { etat.prochaineSaison[String(an)] = {}; }));
}

function ouvrirCaseFuture(parcelleId, x, y) {
  const an = anneeProchaine();
  const p = etat.parcelles.find(q => q.id === parcelleId);
  if (!p) return;
  const coord = x + "-" + y;
  const vivaces = vivacesDans(p, coord).map(c => planteParId(c.planteId));
  const prevus = prevusDans(p, coord, an).map(planteParId);
  const g = groupeConseille(p);
  const soleil = typeof ensoleillementCase === "function" ? libelleEnsoleillement(ensoleillementCase(p, coord)) : "";
  ouvrirFenetre(`
    <h2>${esc(p.nom)}, case ${x + 1}${p.hauteur > 1 ? "-" + (y + 1) : ""} <small>en ${an}</small></h2>
    <p class="texte-doux petit">${[soleil, g.suivant ? `rotation : plutôt ${g.suivant.icone} ${g.suivant.label.toLowerCase()}` : ""].filter(Boolean).map(esc).join(" · ")}</p>
    ${vivaces.length ? `<p>${vivaces.map(v => `${ico(v, "1.3em")} ${esc(nomCourt(v))}`).join(", ")} <span class="texte-doux petit">reste${vivaces.length > 1 ? "nt" : ""} en place</span></p>` : ""}
    ${prevus.length ? `<div class="chips">${prevus.map(pl => `<button class="chip actif" data-fu-retirer="${pl.id}">${ico(pl, "1.3em")} ${esc(nomCourt(pl))} ✕</button>`).join("")}</div>` : `<p class="texte-doux">Rien de prévu ici pour l'instant.</p>`}
    <h3 class="sous-titre-section">Ajouter</h3>
    <div id="fu-grille"></div>
    <div class="actions-fenetre"><button class="btn" id="fu-ok">Terminé</button></div>`, fen => {
    const fermer = () => { fermerFenetre(); if (ui.vue === "saisons") rendreSaisons(); };
    fen.querySelectorAll("[data-fu-retirer]").forEach(b => b.addEventListener("click", () => {
      definirPrevus(p, coord, prevusDans(p, coord, an).filter(id => id !== b.dataset.fuRetirer), an);
      sauvegarder(); ouvrirCaseFuture(parcelleId, x, y);
    }));
    brancherGrillePlantes(fen.querySelector("#fu-grille"), {
      desactivees: new Set([...prevus, ...vivaces].map(pl => pl.id)),
      onChoix: id => {
        const voisins = [[1, 0], [-1, 0], [0, 1], [0, -1], [0, 0]].flatMap(([dx, dy]) => contenuFutur(p, (x + dx) + "-" + (y + dy), an).map(c => c.planteId));
        const ennemi = voisins.find(v => v !== id && relation(id, v) === "ennemis");
        definirPrevus(p, coord, [...prevusDans(p, coord, an), id], an);
        sauvegarder();
        if (ennemi) toast(`${nomCourt(planteParId(id))} et ${nomCourt(planteParId(ennemi)).toLowerCase()} s'entendent mal : à éloigner si possible.`);
        ouvrirCaseFuture(parcelleId, x, y);
      }
    });
    fen.querySelector("#fu-ok").addEventListener("click", fermer);
  });
}

// Au printemps : la case prévue devient l'emplacement conseillé (voir meilleureCase)
function caseFuturePour(plante, annee = new Date().getFullYear()) {
  const plan = (etat.prochaineSaison || {})[String(annee)];
  if (!plan) return null;
  for (const p of etat.parcelles) {
    const bac = plan[p.id] || {};
    for (const coord of Object.keys(bac)) {
      if (!bac[coord].includes(plante.id) || !dansLimites(p, coord)) continue;
      const cultures = culturesDe(p, coord);
      if (cultures.some(c => c.planteId === plante.id) || cultures.length >= MAX_CULTURES_PAR_CASE) continue;
      const [x, y] = coord.split("-").map(Number);
      const v = voisinage(p, x, y, plante.id);
      if (v.ennemis.length) continue;
      return { parcelle: p, x, y, score: 100, libre: !cultures.length, amis: v.amis, rotation: null, prevu: true };
    }
  }
  return null;
}

// Coach : l'hiver, une invitation à préparer la saison
function conseilsPotagerFutur() {
  const m = moisCourant();
  if (![11, 12, 1, 2].includes(m)) return [];
  const an = anneeProchaine();
  if (nbPrevus(an) > 0) return [];
  return [{
    type: "conseil", icone: "🗺️", titre: `Imagine ton potager ${an}`,
    texte: "Le jardin se repose : c'est le bon moment pour rêver la saison prochaine. Je peux te proposer un plan bac par bac (rotation, soleil, bons voisins, tes envies), que tu ajustes ensuite.",
    action: { label: "Préparer mon potager " + an, vue: "saisons", sousVue: "annee" }
  }];
}
