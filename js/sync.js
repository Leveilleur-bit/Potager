/* ============================================================
   Mon Potager — synchronisation avec GitHub
   Les données sont rangées dans un dépôt GitHub PRIVÉ à toi
   (ex. « potager-donnees ») : potager-breton.json + photos/.
   Chaque appareil garde une copie locale (l'appli marche hors
   ligne) et se met à jour tout seul à l'ouverture et après
   chaque changement. Chargé après app.js et extras.js.
   ============================================================ */
"use strict";

const CLE_SYNCHRO = "potagerBretonSync";
const CLE_AVANT_SYNCHRO = "potagerBretonAvantSynchro";
const FICHIER_DONNEES = "potager-breton.json";
const API_GITHUB = "https://api.github.com";
const FORMAT_DEPOT = /^[\w.-]+\/[\w.-]+$/;

// statut : inactif | ok | attente | encours | erreur
const syncEtat = { enCours: false, statut: "inactif", message: "", minuterie: null, faiteCetteSession: false, dernierEssai: 0 };

function lireSynchro() { return lireJSON(CLE_SYNCHRO); }
function ecrireSynchro(valeur) {
  if (valeur) ecrireJSON(CLE_SYNCHRO, valeur);
  else { try { localStorage.removeItem(CLE_SYNCHRO); } catch (e) { /* rien */ } }
}
function synchroActive() { const s = lireSynchro(); return !!(s && s.depot && s.jeton); }
function nettoyerDepot(v) { return String(v || "").trim().replace(/^https?:\/\/github\.com\//i, "").replace(/\.git$/i, "").replace(/\/+$/, ""); }
function proprietaireProbable() {
  const m = /^([\w-]+)\.github\.io$/i.exec(location.hostname);
  return m ? m[1] : "ton-pseudo";
}

/* ---------- Bouton de l'en-tête ---------- */

function definirStatut(statut, message = "") {
  syncEtat.statut = statut;
  syncEtat.message = message;
  majBoutonSynchro();
}
function majBoutonSynchro() {
  const b = document.getElementById("btn-synchro");
  if (!b) return;
  b.hidden = !synchroActive();
  b.dataset.etat = syncEtat.statut;
  const titres = {
    ok: "Synchronisé avec GitHub",
    attente: "Des changements attendent d'être synchronisés : touche pour synchroniser",
    encours: "Synchronisation en cours…",
    erreur: "Erreur de synchronisation : touche pour réessayer",
    inactif: "Synchroniser avec GitHub"
  };
  const titre = syncEtat.message || titres[syncEtat.statut] || titres.inactif;
  b.title = titre;
  b.setAttribute("aria-label", titre);
}

/* ---------- API GitHub (contenu d'un dépôt) ---------- */

async function github(chemin, options = {}, cfg = lireSynchro()) {
  const { permettre404, ...opts } = options;
  let r;
  try {
    r = await fetch(API_GITHUB + chemin, {
      cache: "no-store", ...opts,
      headers: { Accept: "application/vnd.github+json", Authorization: "Bearer " + cfg.jeton, ...(opts.headers || {}) }
    });
  } catch (e) { throw new Error("reseau"); }
  if (r.status === 404 && permettre404) return null;
  if (!r.ok) throw new Error("github-" + r.status);
  return r;
}
const cheminContenu = (cfg, chemin) => `/repos/${cfg.depot}/contents/${chemin.split("/").map(encodeURIComponent).join("/")}`;

function texteVersBase64(texte) {
  const octets = new TextEncoder().encode(texte);
  let bin = "";
  for (let i = 0; i < octets.length; i += 0x8000) bin += String.fromCharCode.apply(null, octets.subarray(i, i + 0x8000));
  return btoa(bin);
}
function blobVersBase64(blob) {
  return new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1]); r.onerror = ko; r.readAsDataURL(blob); });
}
// Lit un fichier : { sha, texte } ou null s'il n'existe pas encore
async function lireFichier(chemin, cfg = lireSynchro()) {
  const r = await github(cheminContenu(cfg, chemin), { permettre404: true }, cfg);
  if (!r) return null;
  const j = await r.json();
  let texte;
  if (j.content && j.encoding === "base64") {
    const bin = atob(j.content.replace(/\s/g, ""));
    texte = new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
  } else {
    // fichier volumineux : on le demande « brut »
    const brut = await github(cheminContenu(cfg, chemin), { headers: { Accept: "application/vnd.github.raw+json" } }, cfg);
    texte = await brut.text();
  }
  return { sha: j.sha, texte };
}
async function ecrireFichier(chemin, base64, message, sha = null, cfg = lireSynchro()) {
  const corps = { message, content: base64 };
  if (sha) corps.sha = sha;
  const r = await github(cheminContenu(cfg, chemin), { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corps) }, cfg);
  const j = await r.json();
  return j.content && j.content.sha;
}
async function listerPhotosDistantes(cfg = lireSynchro()) {
  const r = await github(cheminContenu(cfg, "photos"), { permettre404: true }, cfg);
  if (!r) return new Map();
  const liste = await r.json();
  return new Map((Array.isArray(liste) ? liste : []).map(f => [f.name.replace(/\.[a-z]+$/i, ""), f]));
}
async function telechargerPhoto(nomFichier, cfg = lireSynchro()) {
  const r = await github(cheminContenu(cfg, "photos/" + nomFichier), { headers: { Accept: "application/vnd.github.raw+json" } }, cfg);
  return r.blob();
}

/* ---------- Cycle de synchronisation ---------- */

function etatEstVierge() {
  return etat.parcelles.length <= 1 && !etat.journal.length && !etat.projets.length && !etat.graines.length
    && !etat.courses.length && !etat.plantesPerso.length
    && etat.parcelles.every(p => !Object.keys(p.cases).length && !p.historique.length && !Object.keys(p.protections || {}).length);
}
function nombreCultures(d) {
  return (d.parcelles || []).reduce((n, p) => n + Object.values(p.cases || {}).reduce((m, v) => m + (Array.isArray(v) ? v.length : 1), 0), 0);
}

function demanderConflit(distant) {
  return new Promise(resolve => {
    let choisi = false;
    const resume = d => `${(d.parcelles || []).length} parcelle(s), ${nombreCultures(d)} culture(s), ${(d.journal || []).length} note(s) au journal`;
    const dlg = document.getElementById("fenetre");
    dlg.addEventListener("close", () => { if (!choisi) resolve(null); }, { once: true });
    ouvrirFenetre(`
      <h2>Deux versions différentes</h2>
      <p>Ton potager a changé sur cet appareil <strong>et</strong> sur GitHub depuis la dernière synchronisation. Laquelle garder ?</p>
      <div class="conflit">
        <div><strong>Cet appareil</strong><span>${esc(resume(etat))}</span></div>
        <div><strong>GitHub</strong><span>${esc(resume(distant))}</span></div>
      </div>
      <p class="texte-doux petit">La version non choisie est remplacée. Si tu gardes GitHub, la version de cet appareil reste récupérable dans Réglages → Synchronisation (et GitHub garde l'historique de toutes les versions).</p>
      <div class="actions-fenetre">
        <button class="btn" id="cf-local">Garder cet appareil</button>
        <button class="btn-discret" id="cf-distant">Garder GitHub</button>
        <button class="btn-discret" id="cf-plus-tard">Décider plus tard</button>
      </div>`, fen => {
      const fin = valeur => { choisi = true; fermerFenetre(); resolve(valeur); };
      fen.querySelector("#cf-local").addEventListener("click", () => fin("envoyer"));
      fen.querySelector("#cf-distant").addEventListener("click", () => fin("recevoir"));
      fen.querySelector("#cf-plus-tard").addEventListener("click", () => fin(null));
    });
  });
}

function recevoirDonnees(donnees) {
  if (!etatEstVierge()) ecrireJSON(CLE_AVANT_SYNCHRO, etat);   // filet de sécurité
  const lieuLocal = etat.reglages.lieu;
  donnees.reglages = Object.assign({}, donnees.reglages);
  if (!donnees.reglages.lieu && lieuLocal) donnees.reglages.lieu = lieuLocal;
  adopterEtat(donnees);
}

async function synchroniserPhotos() {
  const utilisees = [...idsPhotosUtilises()];
  if (!utilisees.length) return false;
  const distantes = await listerPhotosDistantes();
  const locales = new Set(await PhotosDB.identifiants());
  let recues = false;
  for (const id of utilisees) {
    if (locales.has(id) && !distantes.has(id)) {
      const blob = await PhotosDB.lire(id);
      if (blob) await ecrireFichier("photos/" + id + ".jpg", await blobVersBase64(blob), "Photo du journal");
    } else if (!locales.has(id) && distantes.has(id)) {
      await PhotosDB.sauver(id, await telechargerPhoto(distantes.get(id).name));
      recues = true;
    }
  }
  return recues;
}

// Renvoie "envoyé", "reçu", "à jour" ou "reporté"
async function cycleSynchro() {
  const s = lireSynchro();
  const distant = await lireFichier(FICHIER_DONNEES);
  const donneesDistantes = distant ? JSON.parse(distant.texte) : null;
  const derniere = s.versionSynchro || null;
  const locale = etat.modifieLe || null;
  const vierge = etatEstVierge();
  const changementLocal = !vierge && (locale !== derniere || derniere === null);
  const versionDistante = donneesDistantes ? donneesDistantes.modifieLe || null : null;
  const changementDistant = !!donneesDistantes && versionDistante !== derniere;

  let action;
  if (!donneesDistantes) action = vierge ? "rien" : "envoyer";
  else if (!changementLocal && !changementDistant) action = "rien";
  else if (changementLocal && !changementDistant) action = "envoyer";
  else if (!changementLocal && changementDistant) action = "recevoir";
  else if (versionDistante && versionDistante === locale) action = "rien";
  else action = await demanderConflit(donneesDistantes);
  if (!action) return "reporté";

  let resultat = "à jour";
  if (action === "recevoir") {
    recevoirDonnees(donneesDistantes);
    ecrireSynchro({ ...lireSynchro(), versionSynchro: etat.modifieLe || versionDistante });
    resultat = "reçu";
  } else if (action === "envoyer") {
    if (!etat.modifieLe) { etat.modifieLe = new Date().toISOString(); ecrireJSON(CLE_STOCKAGE, etat); }
    const version = etat.modifieLe;
    await ecrireFichier(FICHIER_DONNEES, texteVersBase64(JSON.stringify(etat, null, 1)), "Potager mis à jour", distant ? distant.sha : null);
    ecrireSynchro({ ...lireSynchro(), versionSynchro: version });
    resultat = "envoyé";
  } else if (donneesDistantes) {
    ecrireSynchro({ ...lireSynchro(), versionSynchro: versionDistante || locale });
  }
  if (await synchroniserPhotos()) rendre();
  return resultat;
}

function messageErreur(e) {
  const m = String(e && e.message || e);
  if (m === "reseau") return "Pas de réseau : la synchronisation reprendra plus tard.";
  if (m === "github-401") return "GitHub refuse le jeton : il est faux ou a expiré. Crée-en un nouveau et colle-le dans Réglages → Synchronisation.";
  if (m === "github-403") return "Le jeton n'a pas le droit d'écrire dans ce dépôt : donne-lui la permission « Contents : Read and write ».";
  if (m === "github-404") return "Dépôt introuvable : vérifie son nom (propriétaire/dépôt) et que le jeton y a bien accès.";
  if (m === "github-409" || m === "github-422") return "Le fichier a changé sur GitHub pendant l'envoi : réessaie, je récupérerai d'abord la dernière version.";
  if (/github-/.test(m)) return "GitHub a répondu par une erreur (" + m.replace("github-", "") + ").";
  return "La synchronisation a échoué (" + m + ").";
}

async function synchroniser({ manuel = false } = {}) {
  if (!synchroActive() || syncEtat.enCours) return;
  clearTimeout(syncEtat.minuterie);
  syncEtat.enCours = true;
  syncEtat.dernierEssai = Date.now();
  definirStatut("encours");
  try {
    const resultat = await cycleSynchro();
    syncEtat.enCours = false;
    if (resultat === "reporté") { definirStatut("attente", "Conflit non résolu : touche pour choisir."); return; }
    syncEtat.faiteCetteSession = true;
    ecrireSynchro({ ...lireSynchro(), derniereSynchro: new Date().toISOString() });
    definirStatut("ok");
    if (manuel) toast(resultat === "reçu" ? "Données mises à jour depuis GitHub." : resultat === "envoyé" ? "Données envoyées sur GitHub." : "Déjà à jour.");
    else if (resultat === "reçu") toast("Potager mis à jour depuis ton autre appareil.");
    if (ui.vue === "reglages") rendreReglages();
    if (ui.vue === "accueil") rendreCoach();
  } catch (e) {
    syncEtat.enCours = false;
    definirStatut("erreur", messageErreur(e));
    if (manuel) toast(messageErreur(e));
    if (ui.vue === "reglages") rendreReglages();
    if (ui.vue === "accueil") rendreCoach();
  } finally {
    syncEtat.enCours = false;
  }
}

// Appelée par sauvegarder() à chaque modification des données
function planifierSynchro() {
  if (!synchroActive()) return;
  clearTimeout(syncEtat.minuterie);
  definirStatut("attente");
  syncEtat.minuterie = setTimeout(() => synchroniser({ manuel: false }), 4000);
}

function deconnecterSynchro() {
  clearTimeout(syncEtat.minuterie);
  syncEtat.faiteCetteSession = false;
  ecrireSynchro(null);
  definirStatut("inactif");
}

/* ---------- Coach : seulement quand il y a quelque chose à faire ---------- */

function conseilsSynchro() {
  const s = lireSynchro();
  if (!synchroActive()) {
    // Ancienne configuration Google Drive : on invite à passer à GitHub
    return s && s.clientId ? [{
      type: "conseil", icone: "☁️", titre: "La synchronisation passe maintenant par GitHub",
      texte: "Google Drive n'est plus utilisé. Configure la synchronisation GitHub (5 minutes) pour retrouver ton potager sur tous tes appareils.",
      action: { label: "Configurer", vue: "reglages" }
    }] : [];
  }
  if (syncEtat.statut === "erreur") return [{ type: "alerte", icone: "☁️", titre: "La synchronisation a échoué", texte: syncEtat.message, action: { label: "Réessayer", synchroniser: true } }];
  if (!s.derniereSynchro) return [{ type: "conseil", icone: "☁️", titre: "Première synchronisation", texte: "Envoie ton potager sur GitHub pour le retrouver sur tes autres appareils.", action: { label: "Synchroniser", synchroniser: true } }];
  return [];
}

/* ---------- Réglages ---------- */

function carteSynchroHTML() {
  const s = lireSynchro();
  const actif = synchroActive();
  const derniere = s && s.derniereSynchro ? new Date(s.derniereSynchro) : null;
  const avant = !!lireJSON(CLE_AVANT_SYNCHRO);
  const statut = syncEtat.enCours ? "Synchronisation en cours…"
    : syncEtat.statut === "erreur" ? "⚠️ " + syncEtat.message
    : syncEtat.statut === "attente" ? "Des changements attendent d'être envoyés."
    : derniere ? "✓ À jour" : "Pas encore synchronisé.";
  const proprio = proprietaireProbable();
  return `
    <section class="carte" id="rg-synchro">
      <div class="carte-titre"><h2>Synchronisation GitHub</h2></div>
      ${actif ? `
        <p class="texte-doux">Ton potager est rangé dans ton dépôt privé <strong>${esc(s.depot)}</strong>. Chaque appareil configuré avec ce dépôt se met à jour tout seul : à l'ouverture de l'appli et quelques secondes après chaque changement.</p>
        <p class="petit" id="sy-statut">${esc(statut)}${derniere ? ` Dernière synchronisation : ${esc(derniere.toLocaleString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }))}.` : ""}</p>
        <div class="actions-fenetre">
          <button class="btn" id="sy-lancer"${syncEtat.enCours ? " disabled" : ""}>☁️ Synchroniser maintenant</button>
          ${avant ? `<button class="btn-discret" id="sy-annuler-derniere">Retrouver la version d'avant la dernière réception</button>` : ""}
          <button class="btn-discret" id="sy-verifier">🔍 Vérifier la configuration</button>
          <button class="btn-discret" id="sy-deconnecter">Arrêter sur cet appareil</button>
        </div>
        <div id="sy-diag" class="diag" aria-live="polite"></div>`
      : `
        <p class="texte-doux">Pour retrouver le même potager sur ton téléphone et ton ordinateur, l'appli range tes données dans un <strong>dépôt GitHub privé</strong>, à côté de celui de l'appli. Configuration unique d'environ 5 minutes ; ensuite il suffit de coller le jeton sur chaque appareil.</p>
        <label for="sy-depot">Dépôt des données (propriétaire/nom)</label>
        <input id="sy-depot" type="text" autocomplete="off" spellcheck="false" autocapitalize="off" placeholder="${esc(proprio)}/potager-donnees" value="${esc((s && s.depot) || "")}">
        <label for="sy-jeton">Jeton d'accès GitHub</label>
        <input id="sy-jeton" type="password" autocomplete="off" spellcheck="false" autocapitalize="off" placeholder="github_pat_…">
        <div class="actions-fenetre">
          <button class="btn" id="sy-enregistrer">Enregistrer et synchroniser</button>
          <button class="btn-discret" id="sy-verifier">🔍 Vérifier</button>
        </div>
        <div id="sy-diag" class="diag" aria-live="polite"></div>
        <details class="accordeon" open>
          <summary>Comment faire ? (une seule fois)</summary>
          <ol class="etapes">
            <li>Sur GitHub, crée un <a href="https://github.com/new" target="_blank" rel="noopener"><strong>nouveau dépôt</strong></a> nommé <code>potager-donnees</code>, en <strong>Private</strong> (ton journal et tes photos ne seront visibles que par toi). Coche « Add a README ».</li>
            <li>Crée un <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener"><strong>jeton d'accès « fine-grained »</strong></a> : nom « Potager », expiration la plus longue possible, <em>Repository access</em> → <strong>Only select repositories</strong> → <code>potager-donnees</code>.</li>
            <li>Dans <em>Permissions → Repository permissions</em>, mets <strong>Contents</strong> sur <strong>Read and write</strong>, puis <strong>Generate token</strong>. Copie le jeton (il commence par <code>github_pat_</code>).</li>
            <li>Colle ici <code>${esc(proprio)}/potager-donnees</code> et le jeton, puis « Enregistrer ». Refais la même chose sur ton autre appareil.</li>
          </ol>
          <p class="texte-doux petit">Le jeton reste sur l'appareil et ne donne accès qu'à ce dépôt. Si un appareil est perdu, supprime le jeton sur GitHub et crées-en un autre.</p>
        </details>`}
    </section>`;
}

// Vérifie la configuration étape par étape et explique en clair ce qui manque
async function diagnostiquerSynchro(zone) {
  const sortie = zone.querySelector("#sy-diag");
  const enreg = lireSynchro() || {};
  const champDepot = zone.querySelector("#sy-depot"), champJeton = zone.querySelector("#sy-jeton");
  const depot = nettoyerDepot((champDepot && champDepot.value) || enreg.depot);
  const jeton = String((champJeton && champJeton.value) || enreg.jeton || "").trim();
  const cfg = { depot, jeton };
  const etapes = [];
  const dessiner = enCours => {
    sortie.innerHTML = etapes.map(e => `<div class="diag-ligne ${e.ok ? "ok" : "ko"}"><span>${e.ok ? "✓" : "✗"}</span><div><strong>${esc(e.titre)}</strong>${e.aide ? `<div class="petit">${esc(e.aide)}</div>` : ""}</div></div>`).join("")
      + (enCours ? `<div class="diag-ligne"><span>…</span><div>${esc(enCours)}</div></div>` : "");
  };
  const ajouter = (ok, titre, aide) => { etapes.push({ ok, titre, aide }); dessiner(); return ok; };
  if (!ajouter(FORMAT_DEPOT.test(depot), "Nom du dépôt", FORMAT_DEPOT.test(depot) ? depot : `Écris-le sous la forme propriétaire/nom, par exemple ${proprietaireProbable()}/potager-donnees.`)) return;
  if (!ajouter(jeton.length >= 20, "Jeton d'accès", jeton.length >= 20 ? "" : "Colle le jeton GitHub (il commence par github_pat_).")) return;
  dessiner("Connexion au dépôt…");
  let infos;
  try { infos = await (await github(`/repos/${depot}`, {}, cfg)).json(); }
  catch (e) { ajouter(false, "Accès au dépôt", messageErreur(e)); return; }
  ajouter(true, "Accès au dépôt");
  ajouter(!!infos.private, "Dépôt privé", infos.private ? "" : "Ce dépôt est public : tout le monde pourrait lire ton journal et voir tes photos. Rends-le privé (Settings → Danger Zone → Change visibility).");
  try {
    const f = await lireFichier(FICHIER_DONNEES, cfg);
    ajouter(true, "Lecture des données", f ? "Un potager est déjà enregistré : il sera récupéré." : "Pas encore de données : ton potager sera envoyé à la première synchronisation.");
  } catch (e) { ajouter(false, "Lecture des données", messageErreur(e)); return; }
  etapes.push({ ok: true, titre: "Tout est prêt", aide: synchroActive() ? "" : "Touche « Enregistrer et synchroniser »." });
  dessiner();
}

function brancherSynchro(zone) {
  const verifier = zone.querySelector("#sy-verifier");
  if (verifier) verifier.addEventListener("click", () => diagnostiquerSynchro(zone));
  const enregistrer = zone.querySelector("#sy-enregistrer");
  if (enregistrer) enregistrer.addEventListener("click", () => {
    const depot = nettoyerDepot(zone.querySelector("#sy-depot").value);
    const jeton = zone.querySelector("#sy-jeton").value.trim();
    if (!FORMAT_DEPOT.test(depot)) { toast("Écris le dépôt sous la forme propriétaire/nom."); return; }
    if (jeton.length < 20) { toast("Colle le jeton GitHub (il commence par github_pat_)."); return; }
    ecrireSynchro({ depot, jeton });
    majBoutonSynchro();
    rendreReglages();
    synchroniser({ manuel: true });
  });
  const lancer = zone.querySelector("#sy-lancer");
  if (lancer) lancer.addEventListener("click", () => { synchroniser({ manuel: true }); rendreReglages(); });
  const deco = zone.querySelector("#sy-deconnecter");
  if (deco) deco.addEventListener("click", () => {
    if (!confirm("Arrêter la synchronisation sur cet appareil ? Tes données restent sur l'appareil et sur GitHub.")) return;
    deconnecterSynchro();
    rendreReglages();
    toast("Synchronisation arrêtée sur cet appareil.");
  });
  const avant = zone.querySelector("#sy-annuler-derniere");
  if (avant) avant.addEventListener("click", () => {
    const ancien = lireJSON(CLE_AVANT_SYNCHRO);
    if (!ancien) return;
    adopterEtat(ancien);
    try { localStorage.removeItem(CLE_AVANT_SYNCHRO); } catch (e) { /* rien */ }
    toast("Version précédente retrouvée. La prochaine synchronisation l'enverra sur GitHub.");
    planifierSynchro();
    rendreReglages();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const b = document.getElementById("btn-synchro");
  if (b) b.addEventListener("click", () => synchroniser({ manuel: true }));
  majBoutonSynchro();
  // Synchronisation automatique : à l'ouverture, puis au retour sur l'appli
  if (synchroActive()) setTimeout(() => synchroniser({ manuel: false }), 800);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && synchroActive() && Date.now() - syncEtat.dernierEssai > 60000) synchroniser({ manuel: false });
  });
});
