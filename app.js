/* ============================================================
   Mon Potager Breton — logique de l'application
   Tout est stocké en local (localStorage), rien n'est envoyé
   à un serveur : l'appli fonctionne hors-ligne une fois chargée.
   ============================================================ */

const CLE_STOCKAGE = "potagerBretonState";
const MOIS_NOMS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
const SAISONS = { hiver: "Hiver", printemps: "Printemps", ete: "Été", automne: "Automne" };

let etat = chargerEtat();
let caseSelectionnee = null; // { parcelleId, x, y }
let filtreCategorie = "toutes";
let moisIdeesChoisi = new Date().getMonth() + 1;

function etatParDefaut() {
  return {
    parcelles: [
      { id: créerId(), nom: "Carré n°1", largeur: 3, hauteur: 3, cases: {} }
    ],
    journal: []
  };
}

function chargerEtat() {
  try {
    const brut = localStorage.getItem(CLE_STOCKAGE);
    if (!brut) return etatParDefaut();
    const parsed = JSON.parse(brut);
    if (!parsed.parcelles) return etatParDefaut();
    return parsed;
  } catch (e) {
    console.warn("Lecture des données locales impossible, redémarrage propre.", e);
    return etatParDefaut();
  }
}

function sauvegarder() {
  try {
    localStorage.setItem(CLE_STOCKAGE, JSON.stringify(etat));
  } catch (e) {
    alert("Impossible d'enregistrer : le stockage local du navigateur semble indisponible ou plein.");
  }
}

function créerId() {
  return Math.random().toString(36).slice(2, 10);
}

function planteParId(id) {
  return PLANTS_DB.find(p => p.id === id) || null;
}

function dateAujourdhui() {
  const d = new Date();
  d.setHours(0,0,0,0);
  return d;
}

function ajouterJours(date, jours) {
  const d = new Date(date);
  d.setDate(d.getDate() + jours);
  return d;
}

function formatDate(d) {
  if (!(d instanceof Date)) d = new Date(d);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function saisonDuMois(mois) {
  if ([12,1,2].includes(mois)) return "hiver";
  if ([3,4,5].includes(mois)) return "printemps";
  if ([6,7,8].includes(mois)) return "ete";
  return "automne";
}

/* ============================================================
   Navigation entre les onglets
   ============================================================ */

function initNavigation() {
  document.querySelectorAll("nav.onglets button").forEach(btn => {
    btn.addEventListener("click", () => afficherVue(btn.dataset.vue));
  });
}

function afficherVue(nomVue) {
  document.querySelectorAll(".vue").forEach(v => v.classList.toggle("actif", v.id === "vue-" + nomVue));
  document.querySelectorAll("nav.onglets button").forEach(b => b.classList.toggle("actif", b.dataset.vue === nomVue));
  if (nomVue === "tableau-de-bord") rendreTableauDeBord();
  if (nomVue === "plan") rendrePlan();
  if (nomVue === "cultures") rendreCultures();
  if (nomVue === "idees") rendreIdees();
  if (nomVue === "journal") rendreJournal();
  window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
}

/* ============================================================
   En-tête : date du jour + badge saison
   ============================================================ */

function rendreEntete() {
  const aujourdhui = dateAujourdhui();
  const mois = aujourdhui.getMonth() + 1;
  document.getElementById("date-du-jour").textContent =
    aujourdhui.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  document.getElementById("badge-saison").textContent = SAISONS[saisonDuMois(mois)];
}

/* ============================================================
   Calcul des rappels (récoltes à venir / en retard)
   ============================================================ */

function listerToutesLesCases() {
  const liste = [];
  etat.parcelles.forEach(parcelle => {
    Object.entries(parcelle.cases).forEach(([coord, contenu]) => {
      if (contenu && contenu.planteId) {
        liste.push({ parcelle, coord, ...contenu });
      }
    });
  });
  return liste;
}

function calculerEtatCulture(contenu) {
  const plante = planteParId(contenu.planteId);
  if (!plante || !contenu.datePlantation) return null;
  const datePlantation = new Date(contenu.datePlantation);
  const aujourdhui = dateAujourdhui();
  if (!plante.dureeJoursMin && !plante.dureeJoursMax) {
    return { plante, datePlantation, statut: "vivace" };
  }
  const debut = ajouterJours(datePlantation, plante.dureeJoursMin || 0);
  const fin = ajouterJours(datePlantation, plante.dureeJoursMax || plante.dureeJoursMin || 0);
  const joursAvantDebut = Math.round((debut - aujourdhui) / 86400000);
  const joursApresFin = Math.round((aujourdhui - fin) / 86400000);

  let statut;
  if (joursApresFin > 14) statut = "retard";
  else if (aujourdhui >= debut) statut = "recolter";
  else if (joursAvantDebut <= 10) statut = "bientot";
  else statut = "a-venir";

  return { plante, datePlantation, debut, fin, statut };
}

function libelleEtat(statut) {
  return {
    "a-venir": { classe: "etat-a-venir", texte: "à venir" },
    "bientot": { classe: "etat-bientot", texte: "récolte bientôt" },
    "recolter": { classe: "etat-bientot", texte: "à récolter" },
    "retard": { classe: "etat-retard", texte: "récolte en retard probable" },
    "vivace": { classe: "etat-a-venir", texte: "en place" }
  }[statut];
}

/* ============================================================
   Onglet Tableau de bord
   ============================================================ */

function rendreTableauDeBord() {
  rendreEntete();

  // Rappels de récolte
  const cases = listerToutesLesCases()
    .map(c => ({ ...c, infos: calculerEtatCulture(c) }))
    .filter(c => c.infos && ["bientot", "recolter", "retard"].includes(c.infos.statut))
    .sort((a, b) => (a.infos.fin || 0) - (b.infos.fin || 0));

  const zoneRappels = document.getElementById("liste-rappels-recolte");
  zoneRappels.innerHTML = "";
  if (cases.length === 0) {
    zoneRappels.innerHTML = `<p class="vide">Aucune récolte urgente pour l'instant. Regarde l'onglet « Idées & saisons » pour préparer les prochains semis.</p>`;
  } else {
    cases.forEach(c => {
      const lib = libelleEtat(c.infos.statut);
      const div = document.createElement("div");
      div.className = "rappel";
      div.innerHTML = `
        <div>
          <div class="rappel-texte">${c.infos.plante.nom} — ${c.parcelle.nom}</div>
          <div class="rappel-sous-texte">Planté le ${formatDate(c.infos.datePlantation)}</div>
        </div>
        <span class="etat ${lib.classe}">${lib.texte}</span>`;
      zoneRappels.appendChild(div);
    });
  }

  // Tâches du mois courant
  const moisActuel = new Date().getMonth() + 1;
  const infosMois = MONTHLY_ADVICE.find(m => m.mois === moisActuel);
  const zoneMois = document.getElementById("taches-du-mois");
  zoneMois.innerHTML = "";
  if (infosMois) {
    const ul = document.createElement("ul");
    ul.style.margin = "0";
    ul.style.paddingLeft = "1.1rem";
    infosMois.court.forEach(tache => {
      const li = document.createElement("li");
      li.textContent = tache;
      li.style.marginBottom = "0.3rem";
      ul.appendChild(li);
    });
    zoneMois.appendChild(ul);
    if (infosMois.detail) {
      const det = document.createElement("details");
      det.className = "accordeon";
      det.style.marginTop = "0.6rem";
      det.innerHTML = `<summary>En savoir plus sur ${infosMois.titre.toLowerCase()}</summary><p>${infosMois.detail}</p>`;
      zoneMois.appendChild(det);
    }
  }

  // Idées de semis du mois (aperçu rapide, 4 max)
  const idees = PLANTS_DB.filter(p => p.moisSemis.includes(moisActuel) || p.moisPlantation.includes(moisActuel)).slice(0, 4);
  const zoneIdees = document.getElementById("apercu-idees-mois");
  zoneIdees.innerHTML = "";
  if (idees.length === 0) {
    zoneIdees.innerHTML = `<p class="vide">Pas de nouveau semis particulièrement recommandé ce mois-ci en Bretagne.</p>`;
  } else {
    idees.forEach(p => {
      const span = document.createElement("span");
      span.className = "chip actif";
      span.style.cursor = "default";
      span.textContent = (CATEGORY_ICONS[p.categorie] || "") + " " + p.nom;
      zoneIdees.appendChild(span);
    });
  }
}

/* ============================================================
   Onglet Plan du potager
   ============================================================ */

function rendrePlan() {
  const zone = document.getElementById("liste-parcelles");
  zone.innerHTML = "";

  if (etat.parcelles.length === 0) {
    zone.innerHTML = `<p class="vide">Aucune parcelle pour l'instant. Ajoute ta première ci-dessous.</p>`;
  }

  etat.parcelles.forEach(parcelle => {
    const bloc = document.createElement("div");
    bloc.className = "parcelle-bloc";

    const entete = document.createElement("div");
    entete.className = "parcelle-entete";
    entete.innerHTML = `
      <h4>${parcelle.nom} <span style="color:var(--granit); font-weight:400; font-size:0.82rem;">(${parcelle.largeur} × ${parcelle.hauteur} carrés)</span></h4>
      <div>
        <button class="btn-discret" data-action="renommer" data-id="${parcelle.id}">Renommer</button>
        <button class="btn-danger" data-action="supprimer-parcelle" data-id="${parcelle.id}">Supprimer</button>
      </div>`;
    bloc.appendChild(entete);

    const grille = document.createElement("div");
    grille.className = "grille-carres";
    grille.style.gridTemplateColumns = `repeat(${parcelle.largeur}, minmax(38px, 68px))`;

    for (let y = 0; y < parcelle.hauteur; y++) {
      for (let x = 0; x < parcelle.largeur; x++) {
        const coord = x + "-" + y;
        const contenu = parcelle.cases[coord];
        const div = document.createElement("div");
        div.className = "case";
        if (contenu && contenu.planteId) {
          const plante = planteParId(contenu.planteId);
          if (plante) {
            div.classList.add("occupee");
            const famille = FAMILIES[plante.famille] || FAMILIES.autre;
            div.style.background = `linear-gradient(155deg, ${famille.color}, ${famille.color}dd)`;
            div.textContent = (CATEGORY_ICONS[plante.categorie] || "") + " " + plante.nom;
            div.title = plante.nom + " — planté le " + formatDate(contenu.datePlantation);
          }
        } else {
          const icone = document.createElement("span");
          icone.className = "case-vide-icone";
          icone.textContent = "+";
          div.appendChild(icone);
        }
        if (caseSelectionnee && caseSelectionnee.parcelleId === parcelle.id && caseSelectionnee.x === x && caseSelectionnee.y === y) {
          div.classList.add("selectionnee");
        }
        div.addEventListener("click", () => {
          caseSelectionnee = { parcelleId: parcelle.id, x, y };
          rendrePlan();
        });
        grille.appendChild(div);
      }
    }
    bloc.appendChild(grille);

    // Légende des familles présentes
    const famillesPresentes = new Set();
    Object.values(parcelle.cases).forEach(c => {
      if (c && c.planteId) {
        const p = planteParId(c.planteId);
        if (p) famillesPresentes.add(p.famille);
      }
    });
    if (famillesPresentes.size > 0) {
      const legende = document.createElement("div");
      legende.className = "legende";
      famillesPresentes.forEach(f => {
        const info = FAMILIES[f] || FAMILIES.autre;
        const span = document.createElement("span");
        span.innerHTML = `<span class="puce" style="background:${info.color}"></span>${info.label}`;
        legende.appendChild(span);
      });
      bloc.appendChild(legende);
    }

    // Éditeur de la case sélectionnée, s'il concerne cette parcelle
    if (caseSelectionnee && caseSelectionnee.parcelleId === parcelle.id) {
      bloc.appendChild(construireEditeurCase(parcelle, caseSelectionnee.x, caseSelectionnee.y));
    }

    // Redimensionnement de la parcelle
    const resize = document.createElement("div");
    resize.className = "ligne-champs trois";
    resize.style.marginTop = "0.7rem";
    resize.innerHTML = `
      <div>
        <label>Largeur (carrés)</label>
        <input type="number" min="1" max="10" value="${parcelle.largeur}" data-action="largeur" data-id="${parcelle.id}">
      </div>
      <div>
        <label>Hauteur (carrés)</label>
        <input type="number" min="1" max="10" value="${parcelle.hauteur}" data-action="hauteur" data-id="${parcelle.id}">
      </div>`;
    bloc.appendChild(resize);

    zone.appendChild(bloc);
  });

  // Attacher les événements des boutons/champs générés
  zone.querySelectorAll('[data-action="renommer"]').forEach(btn => {
    btn.addEventListener("click", () => {
      const parcelle = etat.parcelles.find(p => p.id === btn.dataset.id);
      const nouveauNom = prompt("Nouveau nom de la parcelle :", parcelle.nom);
      if (nouveauNom && nouveauNom.trim()) {
        parcelle.nom = nouveauNom.trim();
        sauvegarder();
        rendrePlan();
      }
    });
  });
  zone.querySelectorAll('[data-action="supprimer-parcelle"]').forEach(btn => {
    btn.addEventListener("click", () => {
      if (confirm("Supprimer cette parcelle et tout son contenu ?")) {
        etat.parcelles = etat.parcelles.filter(p => p.id !== btn.dataset.id);
        caseSelectionnee = null;
        sauvegarder();
        rendrePlan();
      }
    });
  });
  zone.querySelectorAll('[data-action="largeur"], [data-action="hauteur"]').forEach(input => {
    input.addEventListener("change", () => {
      const parcelle = etat.parcelles.find(p => p.id === input.dataset.id);
      const valeur = Math.max(1, Math.min(10, parseInt(input.value, 10) || 1));
      if (input.dataset.action === "largeur") parcelle.largeur = valeur;
      else parcelle.hauteur = valeur;
      sauvegarder();
      rendrePlan();
    });
  });
}

function construireEditeurCase(parcelle, x, y) {
  const coord = x + "-" + y;
  const contenu = parcelle.cases[coord] || {};
  const div = document.createElement("div");
  div.className = "editeur-case";

  const optionsPlante = ['<option value="">— vide —</option>']
    .concat(PLANTS_DB.slice().sort((a,b) => a.nom.localeCompare(b.nom)).map(p =>
      `<option value="${p.id}" ${contenu.planteId === p.id ? "selected" : ""}>${p.nom}</option>`
    )).join("");

  div.innerHTML = `
    <h4 style="margin-bottom:0.5rem; font-size:0.92rem;">Case (${x+1}, ${y+1})</h4>
    <div class="ligne-champs deux">
      <div>
        <label>Plante</label>
        <select id="editeur-plante">${optionsPlante}</select>
      </div>
      <div>
        <label>Date de plantation</label>
        <input type="date" id="editeur-date" value="${contenu.datePlantation ? contenu.datePlantation.slice(0,10) : new Date().toISOString().slice(0,10)}">
      </div>
    </div>
    <label>Notes</label>
    <textarea id="editeur-notes" rows="2" placeholder="Variété, emplacement, remarque...">${contenu.notes || ""}</textarea>
    <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
      <button class="btn" id="editeur-enregistrer">Enregistrer</button>
      ${contenu.planteId ? '<button class="btn-discret" id="editeur-recolte">Marquer récolté</button>' : ""}
      <button class="btn-discret" id="editeur-fermer">Fermer</button>
    </div>`;

  div.querySelector("#editeur-enregistrer").addEventListener("click", () => {
    const planteId = div.querySelector("#editeur-plante").value;
    const date = div.querySelector("#editeur-date").value;
    const notes = div.querySelector("#editeur-notes").value;
    if (!planteId) {
      delete parcelle.cases[coord];
    } else {
      parcelle.cases[coord] = { planteId, datePlantation: date, notes };
    }
    sauvegarder();
    rendrePlan();
  });

  if (contenu.planteId) {
    div.querySelector("#editeur-recolte").addEventListener("click", () => {
      const plante = planteParId(contenu.planteId);
      etat.journal.unshift({
        id: créerId(),
        date: new Date().toISOString().slice(0,10),
        texte: `Récolte : ${plante ? plante.nom : contenu.planteId} (${parcelle.nom})`
      });
      delete parcelle.cases[coord];
      caseSelectionnee = null;
      sauvegarder();
      rendrePlan();
    });
  }

  div.querySelector("#editeur-fermer").addEventListener("click", () => {
    caseSelectionnee = null;
    rendrePlan();
  });

  return div;
}

function ajouterParcelle() {
  const nom = "Carré n°" + (etat.parcelles.length + 1);
  etat.parcelles.push({ id: créerId(), nom, largeur: 3, hauteur: 3, cases: {} });
  sauvegarder();
  rendrePlan();
}

/* ============================================================
   Onglet Mes cultures (liste)
   ============================================================ */

function rendreCultures() {
  const zone = document.getElementById("liste-cultures");
  zone.innerHTML = "";
  const cases = listerToutesLesCases().map(c => ({ ...c, infos: calculerEtatCulture(c) }));

  if (cases.length === 0) {
    zone.innerHTML = `<p class="vide">Aucune culture enregistrée. Va dans « Plan du potager » pour ajouter une plantation dans une case.</p>`;
    return;
  }

  cases.sort((a,b) => new Date(a.datePlantation) - new Date(b.datePlantation));

  const table = document.createElement("div");
  cases.forEach(c => {
    if (!c.infos) return;
    const lib = libelleEtat(c.infos.statut);
    const ligne = document.createElement("div");
    ligne.className = "rappel";
    ligne.innerHTML = `
      <div>
        <div class="rappel-texte">${c.infos.plante.nom} — ${c.parcelle.nom}</div>
        <div class="rappel-sous-texte">
          Planté le ${formatDate(c.datePlantation)}
          ${c.infos.debut ? " · récolte estimée entre le " + formatDate(c.infos.debut) + " et le " + formatDate(c.infos.fin) : ""}
          ${c.notes ? " · " + c.notes : ""}
        </div>
      </div>
      <span class="etat ${lib.classe}">${lib.texte}</span>`;
    table.appendChild(ligne);
  });
  zone.appendChild(table);
}

/* ============================================================
   Onglet Idées & calendrier de saison
   ============================================================ */

function rendreIdees() {
  const selectMois = document.getElementById("select-mois-idees");
  if (!selectMois.dataset.rempli) {
    selectMois.innerHTML = MOIS_NOMS.map((nom, i) =>
      `<option value="${i+1}">${nom.charAt(0).toUpperCase() + nom.slice(1)}</option>`
    ).join("");
    selectMois.dataset.rempli = "1";
    selectMois.addEventListener("change", () => {
      moisIdeesChoisi = parseInt(selectMois.value, 10);
      rendreIdees();
    });
  }
  selectMois.value = moisIdeesChoisi;

  const categories = [
    { id: "toutes", label: "Toutes" },
    { id: "legume", label: "Légumes" },
    { id: "fruit", label: "Fruits" },
    { id: "aromate", label: "Aromates" },
    { id: "fleur", label: "Fleurs" }
  ];
  const zoneChips = document.getElementById("chips-categories");
  zoneChips.innerHTML = "";
  categories.forEach(cat => {
    const btn = document.createElement("button");
    btn.className = "chip" + (filtreCategorie === cat.id ? " actif" : "");
    btn.textContent = cat.label;
    btn.addEventListener("click", () => { filtreCategorie = cat.id; rendreIdees(); });
    zoneChips.appendChild(btn);
  });

  const aSemer = PLANTS_DB.filter(p =>
    (p.moisSemis.includes(moisIdeesChoisi) || p.moisPlantation.includes(moisIdeesChoisi)) &&
    (filtreCategorie === "toutes" || p.categorie === filtreCategorie)
  );
  const aRecolter = PLANTS_DB.filter(p =>
    p.moisRecolte.includes(moisIdeesChoisi) &&
    (filtreCategorie === "toutes" || p.categorie === filtreCategorie)
  );

  document.getElementById("zone-a-semer").innerHTML = "";
  document.getElementById("zone-a-recolter").innerHTML = "";
  remplirFichesPlantes(document.getElementById("zone-a-semer"), aSemer, "Rien de particulier à semer/planter ce mois-ci pour cette catégorie.");
  remplirFichesPlantes(document.getElementById("zone-a-recolter"), aRecolter, "Rien à récolter ce mois-ci pour cette catégorie.");
}

function remplirFichesPlantes(zone, plantes, messageVide) {
  if (plantes.length === 0) {
    zone.innerHTML = `<p class="vide">${messageVide}</p>`;
    return;
  }
  plantes.forEach(p => {
    const famille = FAMILIES[p.famille] || FAMILIES.autre;
    const fiche = document.createElement("div");
    fiche.className = "plante-fiche";
    fiche.style.borderLeftColor = famille.color;
    fiche.innerHTML = `
      <h4>${CATEGORY_ICONS[p.categorie] || ""} ${p.nom} <span class="tag-famille" style="background:${famille.color}">${famille.label}</span></h4>
      <div class="meta">${p.exposition}${p.espacementCm ? " · espacer d'environ " + p.espacementCm + " cm" : ""}</div>
      ${p.conseilCourt ? `<div class="conseil">${p.conseilCourt}</div>` : ""}
      ${p.conseilDetail ? `<details class="accordeon" style="margin-top:0.4rem;"><summary>En savoir plus</summary><p class="conseil-detail" style="margin:0.3rem 0 0;">${p.conseilDetail}</p></details>` : ""}`;
    zone.appendChild(fiche);
  });
}

/* ============================================================
   Onglet Journal & conseils
   ============================================================ */

function rendreJournal() {
  // Conseils mensuels (accordéon pour les 12 mois)
  const zoneConseilsMois = document.getElementById("accordeon-mois");
  if (!zoneConseilsMois.dataset.rempli) {
    zoneConseilsMois.innerHTML = "";
    const moisActuel = new Date().getMonth() + 1;
    MONTHLY_ADVICE.forEach(m => {
      const det = document.createElement("details");
      det.className = "accordeon";
      if (m.mois === moisActuel) det.open = true;
      det.innerHTML = `<summary>${m.titre}</summary>
        <ul style="margin:0.3rem 0 0; padding-left:1.1rem;">
          ${m.court.map(t => `<li style="margin-bottom:0.25rem;">${t}</li>`).join("")}
        </ul>
        ${m.detail ? `<p style="margin-top:0.5rem; color:var(--encre-douce); font-size:0.88rem;">${m.detail}</p>` : ""}`;
      zoneConseilsMois.appendChild(det);
    });
    zoneConseilsMois.dataset.rempli = "1";
  }

  // Conseils généraux
  const zoneGeneraux = document.getElementById("conseils-generaux");
  if (!zoneGeneraux.dataset.rempli) {
    zoneGeneraux.innerHTML = "";
    GENERAL_TIPS.forEach(t => {
      const det = document.createElement("details");
      det.className = "accordeon";
      det.innerHTML = `<summary>${t.titre}</summary>
        <p style="margin:0.3rem 0 0;">${t.court}</p>
        ${t.detail ? `<p style="margin-top:0.4rem; color:var(--encre-douce); font-size:0.88rem;">${t.detail}</p>` : ""}`;
      zoneGeneraux.appendChild(det);
    });
    zoneGeneraux.dataset.rempli = "1";
  }

  // Journal personnel
  const zoneJournal = document.getElementById("liste-journal");
  zoneJournal.innerHTML = "";
  if (etat.journal.length === 0) {
    zoneJournal.innerHTML = `<p class="vide">Ton journal est vide. Note tes observations, réussites et essais au fil des saisons.</p>`;
  } else {
    etat.journal.forEach(entree => {
      const div = document.createElement("div");
      div.className = "entree-journal";
      div.innerHTML = `<div class="date-journal">${formatDate(entree.date)}</div><div>${entree.texte}</div>`;
      zoneJournal.appendChild(div);
    });
  }
}

function ajouterEntreeJournal() {
  const texte = document.getElementById("nouvelle-entree-journal").value.trim();
  if (!texte) return;
  etat.journal.unshift({ id: créerId(), date: new Date().toISOString().slice(0,10), texte });
  document.getElementById("nouvelle-entree-journal").value = "";
  sauvegarder();
  rendreJournal();
  zoneGeneraux_reset();
}
// Petite aide : forcer le ré-affichage du journal seul sans re-générer les accordéons déjà construits
function zoneGeneraux_reset() {}

/* ============================================================
   Export / import des données (sauvegarde manuelle)
   ============================================================ */

function exporterDonnees() {
  const blob = new Blob([JSON.stringify(etat, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "mon-potager-breton-" + new Date().toISOString().slice(0,10) + ".json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importerDonnees(fichier) {
  const lecteur = new FileReader();
  lecteur.onload = () => {
    try {
      const donnees = JSON.parse(lecteur.result);
      if (!donnees.parcelles) throw new Error("format invalide");
      etat = donnees;
      etat.journal = etat.journal || [];
      sauvegarder();
      afficherVue("tableau-de-bord");
      alert("Données importées avec succès.");
    } catch (e) {
      alert("Ce fichier ne semble pas être une sauvegarde valide de Mon Potager Breton.");
    }
  };
  lecteur.readAsText(fichier);
}

/* ============================================================
   Démarrage
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
  initNavigation();
  rendreEntete();
  rendreTableauDeBord();

  document.getElementById("btn-ajouter-parcelle").addEventListener("click", ajouterParcelle);
  document.getElementById("btn-ajouter-journal").addEventListener("click", ajouterEntreeJournal);
  document.getElementById("btn-exporter").addEventListener("click", exporterDonnees);
  document.getElementById("champ-importer").addEventListener("change", (e) => {
    if (e.target.files[0]) importerDonnees(e.target.files[0]);
  });
});
