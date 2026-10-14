/* ============================================================
   Ajout simplifié d'une culture (Quoi ? Où ? Quand ?),
   variétés avec ton avis, et photo rapide dans le journal.
   ============================================================ */

/* ---------- Grille de choix des plantes (réutilisable) ---------- */

const sansAccents = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function brancherGrillePlantes(zone, { choisie = null, desactivees = new Set(), onChoix }) {
  const m = moisCourant();
  const triees = PLANTS_DB.slice().sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  const deSaison = triees.filter(p => moisPourPlante(p).has(m));
  const autres = triees.filter(p => !deSaison.includes(p));
  zone.innerHTML = `
    <input type="search" class="gp-recherche" placeholder="Chercher (ex. ail, gingembre…)" autocomplete="off">
    <div class="chips gp-cats">${[["toutes", "Tout"], ["legume", "Légumes"], ["fruit", "Fruits"], ["aromate", "Aromates"], ["fleur", "Fleurs"]].map(([k, l], i) => `<button type="button" class="chip${i === 0 ? " actif" : ""}" data-gpcat="${k}">${l}</button>`).join("")}</div>
    <div class="gp-grille"></div>`;
  const recherche = zone.querySelector(".gp-recherche"), grille = zone.querySelector(".gp-grille");
  let categorie = "toutes";
  const tuile = p => `<button type="button" class="tuile-plante${choisie === p.id ? " choisie" : ""}" data-gp="${p.id}"${desactivees.has(p.id) ? " disabled" : ""}>${ico(p, 40)}<span>${esc(nomCourt(p))}</span></button>`;
  const dessiner = () => {
    const q = sansAccents(recherche.value.trim());
    const ok = p => (categorie === "toutes" || p.categorie === categorie) && (!q || sansAccents(p.nom).includes(q));
    const a1 = deSaison.filter(ok), a2 = autres.filter(ok);
    grille.innerHTML = (a1.length ? `<h4 class="grille-titre">De saison en ${MOIS_NOMS[m - 1]}</h4><div class="grille-plantes">${a1.map(tuile).join("")}</div>` : "")
      + (a2.length ? `<h4 class="grille-titre">Autres plantes</h4><div class="grille-plantes">${a2.map(tuile).join("")}</div>` : "")
      || `<p class="vide">Aucune plante ne correspond. Tu peux en créer une dans Réglages → Mes plantes.</p>`;
    grille.querySelectorAll("[data-gp]").forEach(b => b.addEventListener("click", () => onChoix(b.dataset.gp)));
  };
  recherche.addEventListener("input", dessiner);
  zone.querySelectorAll("[data-gpcat]").forEach(c => c.addEventListener("click", () => {
    categorie = c.dataset.gpcat;
    zone.querySelectorAll("[data-gpcat]").forEach(x => x.classList.toggle("actif", x === c));
    dessiner();
  }));
  dessiner();
}

/* ---------- Variétés et avis ---------- */

const AVIS = { bien: "👍 Bien", moyen: "😐 Moyen", rate: "👎 Raté" };
// Toutes les variétés déjà cultivées pour une plante, avec l'avis le plus récent
function varietesConnues(planteId) {
  const vus = new Map();
  const noter = (v, annee, avis, commentaire) => {
    if (!v) return;
    const cle = v.trim().toLowerCase();
    const prec = vus.get(cle);
    if (!prec || annee > prec.annee || (annee === prec.annee && avis)) vus.set(cle, { nom: v.trim(), annee, avis: avis || (prec && prec.avis) || null, commentaire: commentaire || (prec && prec.commentaire) || "" });
  };
  etat.parcelles.forEach(p => {
    p.historique.forEach(h => { if (h.planteId === planteId) noter(h.variete, (parseDate(h.debut) || new Date()).getFullYear(), h.avis, h.commentaire); });
    Object.values(p.cases).forEach(l => (l || []).forEach(c => { if (c.planteId === planteId) noter(c.variete, (parseDate(c.datePlantation) || new Date()).getFullYear(), null, ""); }));
  });
  return [...vus.values()].sort((a, b) => b.annee - a.annee);
}
// Expérience passée (cultures terminées avec un avis), pour la fiche plante
function experiencesPlante(planteId) {
  const res = [];
  etat.parcelles.forEach(p => p.historique.forEach(h => {
    if (h.planteId === planteId && (h.avis || h.commentaire)) res.push({ annee: (parseDate(h.debut) || new Date()).getFullYear(), variete: h.variete || "", avis: h.avis, commentaire: h.commentaire || "", lieu: p.nom });
  }));
  return res.sort((a, b) => b.annee - a.annee);
}
function experiencesHTML(planteId) {
  const ex = experiencesPlante(planteId);
  if (!ex.length) return "";
  return `<h3 class="sous-titre-section">Ton expérience</h3><ul class="liste-experiences">${ex.slice(0, 8).map(e =>
    `<li><strong>${e.annee}</strong>${e.variete ? " · " + esc(e.variete) : ""} — ${e.avis ? AVIS[e.avis] : ""}${e.commentaire ? ` <span class="texte-doux">« ${esc(e.commentaire)} »</span>` : ""}</li>`).join("")}</ul>`;
}
function datalistVarietes(id, planteId) {
  return `<datalist id="${id}">${varietesConnues(planteId).map(v => `<option value="${esc(v.nom)}">${v.avis ? AVIS[v.avis] + " en " + v.annee : "cultivée en " + v.annee}</option>`).join("")}</datalist>`;
}
function rappelVarietes(planteId) {
  const v = varietesConnues(planteId).filter(x => x.avis);
  if (!v.length) return "";
  return `<p class="petit rappel-varietes">📒 ${v.slice(0, 3).map(x => `${esc(x.nom)} : ${AVIS[x.avis]} (${x.annee})`).join(" · ")}</p>`;
}

// Après « Fin de culture » : comment ça s'est passé ? (facultatif)
function demanderAvis(parcelle, entreeHistorique) {
  const plante = planteParId(entreeHistorique.planteId);
  if (!plante) return;
  ouvrirFenetre(`
    <h2 class="titre-ico">${ico(plante, 36)} ${esc(plante.nom)}${entreeHistorique.variete ? ` <small>${esc(entreeHistorique.variete)}</small>` : ""}</h2>
    <p>Comment s'est passée cette culture ? Je m'en souviendrai l'an prochain.</p>
    <div class="chips">${Object.entries(AVIS).map(([k, l]) => `<button class="chip" data-avis="${k}">${l}</button>`).join("")}</div>
    <label for="av-com">Un mot pour l'an prochain (facultatif)</label>
    <input id="av-com" type="text" maxlength="120" placeholder="ex. très productive, à replanter plus tôt">
    <div class="actions-fenetre"><button class="btn-discret" id="av-passer">Passer</button></div>`, fen => {
    fen.querySelectorAll("[data-avis]").forEach(b => b.addEventListener("click", () => {
      entreeHistorique.avis = b.dataset.avis;
      const c = fen.querySelector("#av-com").value.trim();
      if (c) entreeHistorique.commentaire = c;
      sauvegarder(); fermerFenetre(); rendre();
      toast("Noté pour l'an prochain.");
    }));
    fen.querySelector("#av-passer").addEventListener("click", fermerFenetre);
  });
}

/* ---------- Assistant : ajouter une culture ---------- */

function ouvrirAjoutCulture(pre = {}) {
  const st = { planteId: pre.planteId || null, parcelleId: pre.parcelleId || (etat.parcelles[0] && etat.parcelles[0].id), cases: new Set(pre.coord ? [pre.coord] : []), date: isoLocal(), variete: "" };
  const dessiner = () => {
    const plante = planteParId(st.planteId);
    const parcelle = etat.parcelles.find(p => p.id === st.parcelleId);
    ouvrirFenetre(`
      <h2>Ajouter une culture</h2>
      <div class="etape-ajout">
        <div class="etape-tete"><span class="etape-num">1</span> Quoi ?</div>
        ${plante ? `<button class="choix-plante" id="aj-changer">${ico(plante, 34)}<span><strong>${esc(plante.nom)}</strong><small>Toucher pour changer</small></span></button>` : `<div id="aj-grille"></div>`}
      </div>
      ${plante ? `
      <div class="etape-ajout">
        <div class="etape-tete"><span class="etape-num">2</span> Où ? <small class="texte-doux">touche une ou plusieurs zones</small></div>
        <div class="chips">${etat.parcelles.map(p => `<button class="chip${p.id === st.parcelleId ? " actif" : ""}" data-aj-parcelle="${p.id}">${esc(p.nom)}</button>`).join("")}</div>
        ${parcelle ? zonesParcelleHTML(parcelle, plante, st.cases) : ""}
      </div>
      <div class="etape-ajout">
        <div class="etape-tete"><span class="etape-num">3</span> Quand ?</div>
        <div class="ligne-champs deux">
          <div><label for="aj-date">Semé ou planté le</label><input type="date" id="aj-date" value="${esc(st.date)}"></div>
          <div><label for="aj-variete">Variété (facultatif)</label><input id="aj-variete" list="aj-varietes" maxlength="40" placeholder="ex. Gariguette" value="${esc(st.variete)}">${datalistVarietes("aj-varietes", plante.id)}</div>
        </div>
        ${rappelVarietes(plante.id)}
        ${plante.conseilCourt ? `<p class="petit">💡 ${esc(plante.conseilCourt)}</p>` : ""}
      </div>
      <div class="actions-fenetre">
        <button class="btn" id="aj-ok"${st.cases.size ? "" : " disabled"}>${st.cases.size ? `Ajouter ${st.cases.size > 1 ? "dans " + st.cases.size + " zones" : ""}` : "Choisis où planter"}</button>
        <button class="btn-discret" id="aj-annuler">Annuler</button>
      </div>` : `<div class="actions-fenetre"><button class="btn-discret" id="aj-annuler">Annuler</button></div>`}`, fen => {
      fen.querySelector("#aj-annuler").addEventListener("click", fermerFenetre);
      const g = fen.querySelector("#aj-grille");
      if (g) brancherGrillePlantes(g, { onChoix: id => { st.planteId = id; proposerZones(); dessiner(); } });
      const ch = fen.querySelector("#aj-changer");
      if (ch) ch.addEventListener("click", () => { st.planteId = null; dessiner(); });
      const garder = () => { const d = fen.querySelector("#aj-date"), v = fen.querySelector("#aj-variete"); if (d) st.date = d.value || isoLocal(); if (v) st.variete = v.value; };
      fen.querySelectorAll("[data-aj-parcelle]").forEach(b => b.addEventListener("click", () => { garder(); st.parcelleId = b.dataset.ajParcelle; st.cases.clear(); dessiner(); }));
      fen.querySelectorAll("[data-aj-case]").forEach(b => b.addEventListener("click", () => {
        garder();
        const c = b.dataset.ajCase;
        if (st.cases.has(c)) st.cases.delete(c); else st.cases.add(c);
        dessiner();
      }));
      const ok = fen.querySelector("#aj-ok");
      if (ok) ok.addEventListener("click", () => {
        garder();
        const pl = planteParId(st.planteId), par = etat.parcelles.find(p => p.id === st.parcelleId);
        const cases = [...st.cases].filter(c => culturesDe(par, c).length < MAX_CULTURES_PAR_CASE && !culturesDe(par, c).some(k => k.planteId === pl.id));
        if (!cases.length) { toast("Ces zones sont pleines ou ont déjà cette plante."); return; }
        const variete = st.variete.trim();
        avecAnnulation(`${pl.nom} ajouté(e)${cases.length > 1 ? " dans " + cases.length + " zones" : ""}.`, () => {
          cases.forEach(c => ajouterCulture(par, c, { planteId: pl.id, datePlantation: st.date, notes: "", ...(variete ? { variete } : {}) }));
          etat.journal.unshift({ id: creerId(), date: st.date, type: "semis", planteId: pl.id, parcelleId: par.id,
            texte: `${pl.nom}${variete ? " « " + variete + " »" : ""} en place dans « ${par.nom} »${cases.length > 1 ? ` (${cases.length} zones)` : ""}` });
        });
        fermerFenetre();
      });
    });
  };
  // Zone conseillée pour la plante choisie (bons voisins, rotation, soleil)
  const proposerZones = () => {
    const plante = planteParId(st.planteId);
    if (!plante || st.cases.size) return;
    const e = meilleureCase(plante);
    if (e) { st.parcelleId = e.parcelle.id; st.cases = new Set([e.x + "-" + e.y]); }
  };
  if (st.planteId && !st.cases.size) proposerZones();
  dessiner();
}

// Petit schéma cliquable des zones d'une parcelle
function zonesParcelleHTML(parcelle, plante, choisies) {
  const meilleure = meilleureCase(plante);
  let s = `<div class="aj-zones" style="grid-template-columns:repeat(${parcelle.largeur}, minmax(34px, 1fr))">`;
  for (let y = 0; y < parcelle.hauteur; y++) for (let x = 0; x < parcelle.largeur; x++) {
    const c = x + "-" + y, cult = culturesDe(parcelle, c);
    const conseil = meilleure && meilleure.parcelle.id === parcelle.id && meilleure.x === x && meilleure.y === y;
    const plein = cult.length >= MAX_CULTURES_PAR_CASE || cult.some(k => k.planteId === plante.id);
    const v = voisinage(parcelle, x, y, plante.id);
    const ombre = typeof ensoleillementCase === "function" ? ensoleillementCase(parcelle, c).niveau : "soleil";
    s += `<button type="button" class="aj-zone${choisies.has(c) ? " choisie" : ""}${conseil ? " conseillee" : ""}${v.ennemis.length ? " mauvaise" : ""}" data-aj-case="${c}"${plein ? " disabled" : ""} title="${esc(cult.map(k => planteParId(k.planteId).nom).join(", ") || "Libre")}">
      <span class="aj-ico">${cult.slice(0, 2).map(k => ico(planteParId(k.planteId), 18)).join("") || (ombre !== "soleil" ? "⛅" : "")}</span>
      ${conseil ? `<span class="aj-badge">conseillé</span>` : v.ennemis.length ? `<span class="aj-badge mauvais">voisin ✗</span>` : ""}
    </button>`;
  }
  return s + `</div><p class="texte-doux petit">Zones de gauche à droite${parcelle.hauteur > 1 ? ", rangée par rangée" : ""}. « conseillé » tient compte des voisins, de la rotation et du soleil.</p>`;
}

/* ---------- Journal : photo rapide ---------- */

function ouvrirPhotoRapide(fichiers) {
  const liste = [...fichiers].slice(0, 6);
  if (!liste.length) return;
  const ids = [...new Set(listerCultures().map(c => c.plante.id))].map(planteParId).sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  ouvrirFenetre(`
    <h2>Nouvelle photo</h2>
    <div class="photos-entree" id="pr-apercu">${liste.map(() => `<span class="photo-mini grande"><img alt="Aperçu"></span>`).join("")}</div>
    <label for="pr-plante">C'est quelle culture ? (facultatif)</label>
    <div class="chips" id="pr-plantes">${ids.map(p => `<button type="button" class="chip" data-pr="${p.id}">${ico(p, "1.3em")} ${esc(nomCourt(p))}</button>`).join("") || `<span class="texte-doux petit">Aucune culture enregistrée.</span>`}</div>
    ${etat.parcelles.length > 1 ? `<label>Dans quel bac ? (facultatif, pour comparer avant / après)</label>
    <div class="chips" id="pr-bacs">${etat.parcelles.map(p => `<button type="button" class="chip" data-pr-bac="${p.id}">🪴 ${esc(p.nom)}</button>`).join("")}</div>` : ""}
    <label for="pr-legende">Légende (facultatif)</label>
    <input id="pr-legende" type="text" maxlength="140" placeholder="ex. premières fleurs, attaque de limaces…">
    <div class="actions-fenetre"><button class="btn" id="pr-ok">Enregistrer</button><button class="btn-discret" id="pr-annuler">Annuler</button></div>`, fen => {
    fen.querySelectorAll("#pr-apercu img").forEach((img, i) => { img.src = URL.createObjectURL(liste[i]); });
    let planteId = null, bacId = etat.parcelles.length === 1 ? etat.parcelles[0].id : null;
    const majBacs = () => fen.querySelectorAll("[data-pr-bac]").forEach(x => x.classList.toggle("actif", x.dataset.prBac === bacId));
    fen.querySelectorAll("[data-pr]").forEach(b => b.addEventListener("click", () => {
      planteId = planteId === b.dataset.pr ? null : b.dataset.pr;
      fen.querySelectorAll("[data-pr]").forEach(x => x.classList.toggle("actif", x.dataset.pr === planteId));
      // la culture n'est que dans un bac : on le coche pour toi
      const bacs = planteId ? etat.parcelles.filter(p => Object.values(p.cases).some(l => l.some(c => c.planteId === planteId))) : [];
      if (bacs.length === 1) { bacId = bacs[0].id; majBacs(); }
    }));
    fen.querySelectorAll("[data-pr-bac]").forEach(b => b.addEventListener("click", () => { bacId = bacId === b.dataset.prBac ? null : b.dataset.prBac; majBacs(); }));
    fen.querySelector("#pr-annuler").addEventListener("click", fermerFenetre);
    fen.querySelector("#pr-ok").addEventListener("click", async () => {
      const b = fen.querySelector("#pr-ok"); b.disabled = true; b.textContent = "Enregistrement…";
      const photos = [];
      for (const f of liste) { try { photos.push(await enregistrerPhoto(f)); } catch (e) { toast("Une photo n'a pas pu être enregistrée."); } }
      if (!photos.length) { fermerFenetre(); return; }
      const legende = fen.querySelector("#pr-legende").value.trim();
      const pl = planteParId(planteId);
      const entree = { id: creerId(), date: isoLocal(), type: "note", texte: legende || (pl ? "Photo : " + pl.nom : "Photo"), photos };
      if (pl) entree.planteId = pl.id;
      if (bacId) entree.parcelleId = bacId;
      etat.journal.unshift(entree);
      sauvegarder(); fermerFenetre(); rendre();
      toast("Photo ajoutée au journal.");
    });
  });
}
