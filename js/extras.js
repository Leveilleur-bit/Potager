/* ============================================================
   Mon Potager — fonctions complémentaires
   Photos du journal, sauvegarde vers Drive, export agenda (.ics),
   rotation, frise de l'année, réserve de graines et courses,
   plantes personnalisées.
   Ce fichier est chargé après app.js et utilise ses fonctions.
   ============================================================ */
"use strict";

/* ============================================================
   Photos du journal (IndexedDB : trop lourdes pour localStorage)
   ============================================================ */

const PhotosDB = (() => {
  let ouverture = null;
  function ouvrir() {
    if (!ouverture) {
      ouverture = new Promise((resolve, reject) => {
        if (!window.indexedDB) { reject(new Error("IndexedDB indisponible")); return; }
        const req = indexedDB.open("potagerBretonPhotos", 1);
        req.onupgradeneeded = () => req.result.createObjectStore("photos", { keyPath: "id" });
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return ouverture;
  }
  function operation(mode, fn) {
    return ouvrir().then(db => new Promise((resolve, reject) => {
      const t = db.transaction("photos", mode);
      const r = fn(t.objectStore("photos"));
      t.oncomplete = () => resolve(r ? r.result : undefined);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    }));
  }
  const blobVersDataURL = blob => new Promise((resolve, reject) => {
    const l = new FileReader();
    l.onload = () => resolve(l.result);
    l.onerror = () => reject(l.error);
    l.readAsDataURL(blob);
  });
  return {
    sauver: (id, blob) => operation("readwrite", s => s.put({ id, blob })),
    lire: id => operation("readonly", s => s.get(id)).then(r => (r ? r.blob : null)),
    supprimer: id => operation("readwrite", s => s.delete(id)),
    identifiants: () => operation("readonly", s => s.getAllKeys()),
    async toutes(idsUtiles) {
      const ids = (await this.identifiants()).filter(id => !idsUtiles || idsUtiles.has(id));
      const sortie = {};
      for (const id of ids) {
        const blob = await this.lire(id);
        if (blob) sortie[id] = await blobVersDataURL(blob);
      }
      return sortie;
    },
    async importer(photos) {
      for (const [id, url] of Object.entries(photos || {})) {
        if (typeof url !== "string" || !url.startsWith("data:image/")) continue;
        const blob = await (await fetch(url)).blob();
        await this.sauver(id, blob);
      }
    },
    // Supprime les photos qu'aucune entrée du journal n'utilise plus
    async nettoyer(idsUtilises) {
      for (const id of await this.identifiants()) if (!idsUtilises.has(id)) await this.supprimer(id);
    }
  };
})();

async function compresserImage(fichier, max = 1280, qualite = 0.78) {
  try {
    const bmp = await createImageBitmap(fichier);
    const ratio = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bmp.width * ratio));
    canvas.height = Math.max(1, Math.round(bmp.height * ratio));
    canvas.getContext("2d").drawImage(bmp, 0, 0, canvas.width, canvas.height);
    if (bmp.close) bmp.close();
    const blob = await new Promise(res => canvas.toBlob(res, "image/jpeg", qualite));
    return blob || fichier;
  } catch (e) {
    return fichier;
  }
}

async function enregistrerPhoto(fichier) {
  const blob = await compresserImage(fichier);
  const id = "photo-" + creerId() + creerId();
  await PhotosDB.sauver(id, blob);
  return id;
}

function chargerMiniatures(zone) {
  zone.querySelectorAll("img[data-photo-img]").forEach(img => {
    PhotosDB.lire(img.dataset.photoImg).then(blob => {
      if (blob) img.src = URL.createObjectURL(blob);
      else img.closest(".photo-mini").classList.add("absente");
    }).catch(() => img.closest(".photo-mini").classList.add("absente"));
  });
}

function ouvrirPhoto(id, entreeId, retour = null) {
  const entree = etat.journal.find(j => j.id === entreeId);
  const pl = entree && entree.planteId ? planteParId(entree.planteId) : null;
  ouvrirFenetre(`
    <h2>Photo${pl ? " : " + esc(nomCourt(pl)) : ""}</h2>
    <div class="photo-grande"><img id="ph-img" alt="Photo du journal"></div>
    ${entree ? `<p class="texte-doux petit">${esc(formatDate(entree.date))} · ${esc(entree.texte || "")}</p>` : ""}
    <div class="actions-fenetre">
      <button class="btn-discret" id="ph-fermer">${retour ? "Retour" : "Fermer"}</button>
      <button class="btn-danger" id="ph-suppr">Retirer cette photo</button>
    </div>`, fen => {
    PhotosDB.lire(id).then(blob => { if (blob) fen.querySelector("#ph-img").src = URL.createObjectURL(blob); });
    fen.querySelector("#ph-fermer").addEventListener("click", retour || fermerFenetre);
    fen.querySelector("#ph-suppr").addEventListener("click", () => {
      fermerFenetre();
      avecAnnulation("Photo retirée.", () => {
        const e = etat.journal.find(j => j.id === entreeId);
        if (e) e.photos = e.photos.filter(p => p !== id);
      });
      if (retour) setTimeout(retour, 0);
    });
  });
}

function idsPhotosUtilises() {
  return new Set(etat.journal.flatMap(j => j.photos || []));
}

/* ============================================================
   Sauvegarde : fichier complet (avec photos) et envoi vers Drive
   ============================================================ */

async function construireSauvegarde() {
  const donnees = JSON.parse(JSON.stringify(etat));
  try {
    const photos = await PhotosDB.toutes(idsPhotosUtilises());
    if (Object.keys(photos).length) donnees._photos = photos;
  } catch (e) { /* pas de photos lisibles : on sauvegarde le reste */ }
  return new Blob([JSON.stringify(donnees)], { type: "application/json" });
}

// Ouvre le menu de partage du téléphone (Drive en fait partie) ;
// à défaut, télécharge le fichier et ouvre Drive pour le déposer.
async function envoyerFichier(blob, nom, type, titre) {
  const fichier = new File([blob], nom, { type });
  if (navigator.canShare && navigator.canShare({ files: [fichier] })) {
    try {
      await navigator.share({ files: [fichier], title: titre });
      return "partage";
    } catch (e) {
      if (e && e.name === "AbortError") return "annule";
    }
  }
  telechargerFichier(blob, nom);
  return "telecharge";
}

async function sauvegarderVersDrive() {
  const bouton = document.getElementById("rg-drive");
  if (bouton) { bouton.disabled = true; bouton.textContent = "Préparation…"; }
  const blob = await construireSauvegarde();
  const resultat = await envoyerFichier(blob, "mon-potager-" + isoLocal() + ".json", "application/json", "Sauvegarde Mon Potager");
  if (resultat !== "annule") {
    etat.reglages.derniereSauvegarde = isoLocal();
    sauvegarder();
  }
  rendre();
  toast(resultat === "partage" ? "Sauvegarde envoyée."
    : resultat === "telecharge" ? "Fichier téléchargé : dépose-le où tu veux (Drive, e-mail…)."
    : "Envoi annulé.");
}

/* ============================================================
   Agenda : export .ics (rappels dans l'agenda du téléphone)
   ============================================================ */

function icsEchapper(t) {
  return String(t || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}
// Les lignes d'un fichier .ics sont coupées à 75 octets
function icsPlier(ligne) {
  const enc = new TextEncoder();
  const lignes = [];
  let courante = "", octets = 0;
  for (const c of ligne) {
    const n = enc.encode(c).length;
    if (octets + n > (lignes.length ? 74 : 75)) { lignes.push(courante); courante = ""; octets = 0; }
    courante += c; octets += n;
  }
  lignes.push(courante);
  return lignes.join("\r\n ");
}
function icsDate(d) {
  return d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0");
}
function prochaineOccurrence(mois, jour) {
  const auj = aujourdhui();
  let d = new Date(auj.getFullYear(), mois - 1, jour);
  if (d < auj) d = new Date(auj.getFullYear() + 1, mois - 1, jour);
  return d;
}

function evenementsAgenda() {
  const auj = aujourdhui();
  const limite = ajouterJours(auj, 400);
  const evenements = [];
  const ajouter = (uid, date, titre, description, { alarmes = ["PT9H"], repetition = null } = {}) => {
    if (date < auj || date > limite) return;
    evenements.push({ uid, date, titre, description, alarmes, repetition });
  };

  // Projets du plan
  const emplacements = emplacementsDuPlan();
  etat.projets.filter(pr => !pr.fait).forEach(pr => {
    const plante = planteParId(pr.planteId);
    if (!plante) return;
    const [a, m] = pr.mois.split("-").map(Number);
    const debutMois = new Date(a, m - 1, 1);
    const date = debutMois < auj ? auj : debutMois;
    const e = emplacements[pr.id];
    const verbe = verbeAction(plante, m);
    ajouter("projet-" + pr.id, date, `${iconePlante(plante)} ${verbe} : ${plante.nom}`,
      [e ? `Emplacement conseillé : ${libelleCase(e.parcelle, e.x, e.y)}.` : "", plante.conseilCourt || ""].filter(Boolean).join("\n"));
  });

  // Récoltes à venir
  regrouperCultures(listerCultures()).forEach(g => {
    if (!g.fenetre) return;
    ajouter("recolte-" + g.parcelle.id + "-" + g.contenu.id, g.fenetre.debut, `🧺 Récolte : ${g.plante.nom}`,
      `${g.parcelle.nom}. Planté le ${formatDate(g.datePlantation)}.`, { alarmes: ["-PT15H", "PT9H"] });
  });

  // Rendez-vous de la saison
  ajouter("hivernage", prochaineOccurrence(11, 1), "🍂 Pailler les cases nues et protéger du gel",
    "Couvre le sol de 5 à 10 cm de feuilles mortes, paille ou tontes séchées. Pose un voile sur les cultures frileuses.");
  ajouter("fin-hivernage", prochaineOccurrence(3, 20), "☀️ Fin d'hivernage",
    "Écarte le paillage là où tu vas semer et retire voiles et bâches quand les nuits ne gèlent plus.");
  ajouter("saints-de-glace", prochaineOccurrence(5, 15), "🧊 Saints de glace passés",
    "Tu peux sortir les plants frileux : tomates, courgettes, basilic, haricots.");
  const debutProchainMois = new Date(auj.getFullYear(), auj.getMonth() + 1, 1);
  ajouter("sauvegarde", debutProchainMois, "💾 Sauvegarder mon potager",
    "Ouvre Mon Potager → Réglages → Synchroniser (ou Envoyer le fichier de sauvegarde).", { repetition: "FREQ=MONTHLY;COUNT=12" });
  return evenements;
}

function construireICS(evenements) {
  const maintenant = new Date();
  const horodatage = maintenant.getUTCFullYear() + String(maintenant.getUTCMonth() + 1).padStart(2, "0") + String(maintenant.getUTCDate()).padStart(2, "0")
    + "T" + String(maintenant.getUTCHours()).padStart(2, "0") + String(maintenant.getUTCMinutes()).padStart(2, "0") + String(maintenant.getUTCSeconds()).padStart(2, "0") + "Z";
  const lignes = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Mon Potager//FR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:Mon potager"];
  evenements.forEach(ev => {
    lignes.push("BEGIN:VEVENT",
      "UID:" + ev.uid + "@potager-breton",
      "DTSTAMP:" + horodatage,
      "DTSTART;VALUE=DATE:" + icsDate(ev.date),
      "DTEND;VALUE=DATE:" + icsDate(ajouterJours(ev.date, 1)),
      "SUMMARY:" + icsEchapper(ev.titre));
    if (ev.description) lignes.push("DESCRIPTION:" + icsEchapper(ev.description));
    if (ev.repetition) lignes.push("RRULE:" + ev.repetition);
    lignes.push("TRANSP:TRANSPARENT");
    ev.alarmes.forEach(a => lignes.push("BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + icsEchapper(ev.titre), "TRIGGER:" + a, "END:VALARM"));
    lignes.push("END:VEVENT");
  });
  lignes.push("END:VCALENDAR");
  return lignes.map(icsPlier).join("\r\n") + "\r\n";
}

async function exporterAgenda() {
  const evenements = evenementsAgenda();
  const blob = new Blob([construireICS(evenements)], { type: "text/calendar" });
  const resultat = await envoyerFichier(blob, "mon-potager-agenda.ics", "text/calendar", "Rappels Mon Potager");
  if (resultat === "annule") return;
  toast(resultat === "partage"
    ? `${evenements.length} rappels envoyés : choisis ton agenda.`
    : `${evenements.length} rappels dans le fichier : ouvre-le pour les ajouter à ton agenda.`);
}

function carteAgendaHTML() {
  return `
    <section class="carte">
      <div class="carte-titre"><h2>Rappels dans mon agenda</h2></div>
      <p class="texte-doux">L'appli ne peut pas t'envoyer de notification quand elle est fermée. Exporte tes rappels (semis prévus, récoltes attendues, paillage, saints de glace, sauvegarde mensuelle) vers l'agenda de ton téléphone : il sonnera à 9 h le bon jour.</p>
      <button class="btn" id="rg-agenda">📅 Exporter vers mon agenda</button>
      <p class="texte-doux petit">À refaire quand tu changes ton plan : les rappels déjà ajoutés ne se mettent pas à jour tout seuls.</p>
    </section>`;
}
function brancherAgenda(zone) {
  const b = zone.querySelector("#rg-agenda");
  if (b) b.addEventListener("click", exporterAgenda);
}

/* ============================================================
   Rotation des cultures : que mettre l'année prochaine ?
   ============================================================ */

const GROUPES_ROTATION = [
  { id: "fruits", label: "Légumes-fruits", icone: "🍅", familles: ["solanacees", "cucurbitacees"], note: "gourmands : ils aiment le compost bien mûr" },
  { id: "feuilles", label: "Feuilles et choux", icone: "🥬", familles: ["brassicacees", "asteracees"], note: "profitent encore de la fumure de l'année précédente" },
  { id: "racines", label: "Racines et bulbes", icone: "🥕", familles: ["apiacees", "liliacees", "chenopodiacees"], note: "peu exigeants : pas de compost frais" },
  { id: "legumineuses", label: "Légumineuses", icone: "🫘", familles: ["fabacees"], note: "elles enrichissent le sol en azote" }
];
function groupeRotation(famille) { return GROUPES_ROTATION.find(g => g.familles.includes(famille)) || null; }

// Pour chaque année : combien de cultures de chaque groupe sur la parcelle
function historiqueRotation(parcelle) {
  const annees = {};
  const compter = (annee, planteId, famille) => {
    const plante = planteParId(planteId);
    if (plante && plante.categorie !== "legume") return;
    const g = groupeRotation(famille);
    if (!g) return;
    annees[annee] = annees[annee] || {};
    annees[annee][g.id] = (annees[annee][g.id] || 0) + 1;
  };
  parcelle.historique.forEach(h => { const d = parseDate(h.fin); if (d) compter(d.getFullYear(), h.planteId, h.famille); });
  Object.keys(parcelle.cases).filter(c => dansLimites(parcelle, c)).forEach(coord => {
    culturesDe(parcelle, coord).forEach(c => {
      const d = parseDate(c.datePlantation), plante = planteParId(c.planteId);
      if (d && plante) compter(d.getFullYear(), plante.id, plante.famille);
    });
  });
  return annees;
}

function rendreRotation(zone) {
  const an = new Date().getFullYear();
  const cartes = etat.parcelles.map(p => {
    const hist = historiqueRotation(p);
    const anneesConnues = Object.keys(hist).map(Number).sort((a, b) => b - a);
    const lignesAnnees = [an, an - 1, an - 2].map(a => {
      const groupes = hist[a] ? Object.entries(hist[a]).sort((x, y) => y[1] - x[1]).map(([id]) => GROUPES_ROTATION.find(g => g.id === id)) : [];
      return `<div class="rot-annee"><span class="rot-an">${a}</span><span class="rot-groupes">${groupes.length
        ? groupes.map(g => `<span class="rot-puce">${g.icone} ${g.label}</span>`).join("")
        : `<span class="texte-doux">—</span>`}</span></div>`;
    }).join("");
    if (!anneesConnues.length) {
      return `<section class="carte"><div class="carte-titre"><h2>${esc(p.nom)}</h2></div>${lignesAnnees}
        <p class="vide">Pas encore d'historique de légumes ici. Plante des légumes et utilise « Fin de culture » : la rotation se construira toute seule.</p></section>`;
    }
    const dernier = anneesConnues[0];
    const dominant = Object.entries(hist[dernier]).sort((x, y) => y[1] - x[1])[0][0];
    const idx = GROUPES_ROTATION.findIndex(g => g.id === dominant);
    const suivant = GROUPES_ROTATION[(idx + 1) % GROUPES_ROTATION.length];
    const aEviter = Object.keys(hist[dernier]).map(id => GROUPES_ROTATION.find(g => g.id === id));
    const exemples = PLANTS_DB.filter(pl => pl.categorie === "legume" && suivant.familles.includes(pl.famille))
      .sort((a, b) => a.nom.localeCompare(b.nom, "fr")).slice(0, 8);
    return `<section class="carte">
      <div class="carte-titre"><h2>${esc(p.nom)}</h2></div>
      ${lignesAnnees}
      <div class="rot-conseil">
        <div class="rot-titre">Pour ${an + 1} : ${suivant.icone} ${suivant.label}</div>
        <p class="texte-doux petit">${esc(majuscule(suivant.note))}. ${aEviter.length ? `Évite d'y remettre ${esc(listeFr(aEviter.map(g => g.label.toLowerCase())))} (cultivés en ${dernier}).` : ""}</p>
        <div class="chips">${exemples.map(pl => `<button class="chip" data-fiche="${pl.id}">${ico(pl, "1.4em")} ${esc(nomCourt(pl))}</button>`).join("")}</div>
      </div>
    </section>`;
  });
  zone.innerHTML = `
    <section class="carte carte-coach3">
      <div class="carte-titre"><h2>Rotation des cultures</h2></div>
      <p class="intro-coach">Changer de famille de légumes chaque année sur une même parcelle limite les maladies et épuise moins le sol. Le cycle classique est : légumes-fruits, puis feuilles et choux, puis racines et bulbes, puis légumineuses. Les aromates, fleurs et fruitiers vivaces sont ignorés.</p>
    </section>
    ${cartes.length ? cartes.join("") : `<section class="carte"><p class="vide">Ajoute d'abord une parcelle dans l'onglet Plan.</p></section>`}`;
  brancherFiches(zone);
}

/* ============================================================
   Graines : réserve et liste de courses
   ============================================================ */

function grainesUtilisables(planteId) {
  const an = new Date().getFullYear();
  return etat.graines.some(g => g.planteId === planteId && (!g.peremption || g.peremption >= an));
}

// Liste de courses (la réserve de graines n'est plus affichée depuis la v28 ; les données restent dans la sauvegarde)
function rendreGraines(zone) {
  const aAcheter = etat.projets.filter(pr => !pr.fait && !pr.achete && planteParId(pr.planteId) && !grainesUtilisables(pr.planteId));
  const vus = new Set();
  const autoLignes = aAcheter.filter(pr => !vus.has(pr.planteId) && vus.add(pr.planteId));
  const manuelles = etat.courses;

  zone.innerHTML = `
    <section class="carte">
      <div class="carte-titre"><h2>Liste de courses</h2></div>
      ${autoLignes.length ? `<h3 class="sous-titre-section">Pour mon plan</h3>${autoLignes.map(pr => {
        const p = planteParId(pr.planteId);
        return `<div class="course"><span>${ico(p, "1.4em")} <strong>${esc(nomCourt(p))}</strong> <small class="texte-doux">prévu en ${esc(nomMoisCle(pr.mois))}</small></span>
          <button class="btn-discret" data-jen="${p.id}">J'ai ce qu'il faut</button></div>`;
      }).join("")}` : (etat.projets.some(pr => !pr.fait) ? `<p class="texte-doux petit">✓ Tu as tout ce qu'il faut pour ton plan.</p>` : `<p class="texte-doux petit">Ajoute des cultures à ton plan (onglet Saisons) : ce qui te manque apparaîtra ici.</p>`)}
      <h3 class="sous-titre-section">Mes autres achats</h3>
      ${manuelles.map(c => `<label class="course"><span><input type="checkbox" data-cfait="${c.id}"${c.fait ? " checked" : ""}> <span class="${c.fait ? "barre" : ""}">${esc(c.texte)}</span></span>
        <button class="btn-icone" data-csuppr="${c.id}" aria-label="Supprimer">✕</button></label>`).join("")}
      <form id="cs-form" class="ligne-recherche">
        <input type="text" id="cs-texte" maxlength="80" placeholder="ex. Terreau, paille, voile d'hivernage" aria-label="Nouvel achat">
        <button class="btn" type="submit">Ajouter</button>
      </form>
      <div class="actions-fenetre">
        <button class="btn-discret" id="cs-copier">Copier la liste</button>
        ${manuelles.some(c => c.fait) ? `<button class="btn-discret" id="cs-vider">Retirer les achats cochés</button>` : ""}
      </div>
    </section>`;

  zone.querySelectorAll("[data-jen]").forEach(b => b.addEventListener("click", () =>
    avecAnnulation("Noté : rien à acheter pour celle-ci.", () => etat.projets.forEach(pr => { if (pr.planteId === b.dataset.jen) pr.achete = true; }))));
  zone.querySelector("#cs-form").addEventListener("submit", e => {
    e.preventDefault();
    const t = zone.querySelector("#cs-texte").value.trim();
    if (!t) return;
    etat.courses.push({ id: creerId(), texte: t, fait: false });
    sauvegarder(); rendreCultures();
  });
  zone.querySelectorAll("[data-cfait]").forEach(c => c.addEventListener("change", () => {
    const item = etat.courses.find(x => x.id === c.dataset.cfait);
    if (item) { item.fait = c.checked; sauvegarder(); rendreCultures(); }
  }));
  zone.querySelectorAll("[data-csuppr]").forEach(b => b.addEventListener("click", e => {
    e.preventDefault();
    avecAnnulation("Achat retiré.", () => { etat.courses = etat.courses.filter(c => c.id !== b.dataset.csuppr); });
  }));
  const vider = zone.querySelector("#cs-vider");
  if (vider) vider.addEventListener("click", () => avecAnnulation("Achats cochés retirés.", () => { etat.courses = etat.courses.filter(c => !c.fait); }));
  zone.querySelector("#cs-copier").addEventListener("click", async () => {
    const texte = ["Courses du potager :", ...autoLignes.map(pr => "- " + nomCourt(planteParId(pr.planteId)) + " (graines ou plants)"),
      ...manuelles.filter(c => !c.fait).map(c => "- " + c.texte)].join("\n");
    try { await navigator.clipboard.writeText(texte); toast("Liste copiée."); }
    catch (e) { toast("Copie impossible sur cet appareil."); }
  });
}

/* ============================================================
   Plantes personnalisées
   ============================================================ */

const ICONES_PAR_CATEGORIE = { legume: "🥕", fruit: "🍓", aromate: "🌿", fleur: "🌼" };

function carteMesPlantesHTML() {
  return `
    <section class="carte">
      <div class="carte-titre"><h2>Mes plantes</h2></div>
      <p class="texte-doux petit">Ajoute une plante ou une variété absente de la base (rhubarbe rouge, physalis, cosmos…). Elle apparaît ensuite partout : plan, idées de saison, frise, graines.</p>
      ${etat.plantesPerso.length ? etat.plantesPerso.map(p => `
        <div class="plante-perso">
          <span class="graine-icone">${ico(p, "1.4em")}</span>
          <div class="graine-corps"><div class="ligne-titre">${esc(p.nom)}</div>
            <div class="ligne-detail">${esc(CATEGORIES_NOMS[p.categorie])}, ${esc(familleDe(p).label)}</div></div>
          <div class="graine-actions">
            <button class="btn-discret" data-pedit="${p.id}">Modifier</button>
            <button class="btn-icone" data-psuppr="${p.id}" aria-label="Supprimer ${esc(p.nom)}">✕</button>
          </div>
        </div>`).join("") : ""}
      <button class="btn" id="rg-plante-ajouter">+ Ajouter une plante</button>
    </section>`;
}
const CATEGORIES_NOMS = { legume: "Légume", fruit: "Fruit", aromate: "Aromate", fleur: "Fleur" };

function brancherMesPlantes(zone) {
  const ajouter = zone.querySelector("#rg-plante-ajouter");
  if (ajouter) ajouter.addEventListener("click", () => ouvrirFormPlante());
  zone.querySelectorAll("[data-pedit]").forEach(b => b.addEventListener("click", () => ouvrirFormPlante(b.dataset.pedit)));
  zone.querySelectorAll("[data-psuppr]").forEach(b => b.addEventListener("click", () => {
    const id = b.dataset.psuppr, p = planteParId(id);
    const utilisee = etat.parcelles.some(pa => Object.values(pa.cases).some(l => l.some(c => c.planteId === id)))
      || etat.projets.some(pr => pr.planteId === id) || etat.graines.some(g => g.planteId === id);
    if (utilisee) { toast(`« ${p.nom} » est utilisée dans ton potager, ton plan ou tes graines : retire-la d'abord.`); return; }
    avecAnnulation(`« ${p.nom} » supprimée.`, () => {
      etat.plantesPerso = etat.plantesPerso.filter(x => x.id !== id);
      appliquerPlantesPerso(etat.plantesPerso);
    });
  }));
}

function ouvrirFormPlante(id = null) {
  const p = id ? etat.plantesPerso.find(x => x.id === id) : null;
  const caseMois = (nom, liste) => `<div class="mois-choix" data-mois="${nom}">${MOIS_INITIALES.map((l, i) =>
    `<label class="mois-case" title="${MOIS_NOMS[i]}"><input type="checkbox" value="${i + 1}"${p && p[liste].includes(i + 1) ? " checked" : ""}><span>${l}</span></label>`).join("")}</div>`;
  ouvrirFenetre(`
    <h2>${p ? "Modifier la plante" : "Nouvelle plante"}</h2>
    <div class="ligne-champs deux">
      <div><label for="pp-nom">Nom</label><input id="pp-nom" type="text" maxlength="40" value="${esc(p ? p.nom : "")}" placeholder="ex. Physalis"></div>
      <div><label for="pp-icone">Icône (emoji)</label><input id="pp-icone" type="text" maxlength="4" value="${esc(p ? p.icone : "")}" placeholder="🌱"></div>
    </div>
    <div class="ligne-champs deux">
      <div><label for="pp-cat">Catégorie</label>
        <select id="pp-cat">${Object.entries(CATEGORIES_NOMS).map(([k, v]) => `<option value="${k}"${p && p.categorie === k ? " selected" : ""}>${v}</option>`).join("")}</select></div>
      <div><label for="pp-fam">Famille</label>
        <select id="pp-fam">${Object.entries(FAMILIES).map(([k, f]) => `<option value="${k}"${(p ? p.famille : "autre") === k ? " selected" : ""}>${esc(f.label)}</option>`).join("")}</select></div>
    </div>
    <p class="texte-doux petit">La famille sert à la rotation et à la couleur sur le plan. Choisis « Autre » si tu hésites.</p>
    <label>Mois de semis</label>${caseMois("semis", "moisSemis")}
    <label>Mois de plantation</label>${caseMois("plantation", "moisPlantation")}
    <label>Mois de récolte</label>${caseMois("recolte", "moisRecolte")}
    <div class="ligne-champs deux">
      <div><label for="pp-dmin">Récolte après (jours, min.)</label><input id="pp-dmin" type="number" min="0" max="1000" inputmode="numeric" value="${p ? p.dureeJoursMin || "" : ""}"></div>
      <div><label for="pp-dmax">Récolte après (jours, max.)</label><input id="pp-dmax" type="number" min="0" max="1000" inputmode="numeric" value="${p ? p.dureeJoursMax || "" : ""}"></div>
    </div>
    <div class="ligne-champs deux">
      <div><label for="pp-esp">Espacement (cm)</label><input id="pp-esp" type="number" min="0" max="300" inputmode="numeric" value="${p ? p.espacementCm || "" : ""}"></div>
      <div><label for="pp-expo">Exposition</label><input id="pp-expo" type="text" maxlength="60" value="${esc(p ? p.exposition : "plein soleil")}"></div>
    </div>
    <label for="pp-conseil">Conseil (facultatif)</label>
    <input id="pp-conseil" type="text" maxlength="200" value="${esc(p && p.conseilCourt ? p.conseilCourt : "")}" placeholder="ex. Aime un sol drainant et un tuteur">
    <div class="actions-fenetre">
      <button class="btn" id="pp-ok">Enregistrer</button>
      <button class="btn-discret" id="pp-annuler">Annuler</button>
    </div>`, fen => {
    fen.querySelector("#pp-annuler").addEventListener("click", fermerFenetre);
    fen.querySelector("#pp-ok").addEventListener("click", () => {
      const nom = fen.querySelector("#pp-nom").value.trim();
      if (!nom) { fen.querySelector("#pp-nom").focus(); return; }
      const mois = nomZone => [...fen.querySelectorAll(`[data-mois="${nomZone}"] input:checked`)].map(i => +i.value);
      const categorie = fen.querySelector("#pp-cat").value;
      const brute = {
        id: p ? p.id : "perso-" + creerId(), nom, categorie, famille: fen.querySelector("#pp-fam").value,
        icone: fen.querySelector("#pp-icone").value.trim() || ICONES_PAR_CATEGORIE[categorie],
        moisSemis: mois("semis"), moisPlantation: mois("plantation"), moisRecolte: mois("recolte"),
        dureeJoursMin: fen.querySelector("#pp-dmin").value, dureeJoursMax: fen.querySelector("#pp-dmax").value,
        espacementCm: fen.querySelector("#pp-esp").value, exposition: fen.querySelector("#pp-expo").value.trim() || "plein soleil",
        conseilCourt: fen.querySelector("#pp-conseil").value.trim()
      };
      const propre = nettoyerPlantePerso(brute);
      fermerFenetre();
      avecAnnulation(p ? `« ${nom} » modifiée.` : `« ${nom} » ajoutée à tes plantes.`, () => {
        etat.plantesPerso = p ? etat.plantesPerso.map(x => (x.id === p.id ? propre : x)) : [...etat.plantesPerso, propre];
        appliquerPlantesPerso(etat.plantesPerso);
      });
    });
  });
}

/* ============================================================
   Démarrage des extras : ménage des photos orphelines
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
  PhotosDB.nettoyer(idsPhotosUtilises()).catch(() => {});
});

