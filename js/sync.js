/* ============================================================
   Mon Potager Breton — synchronisation avec Google Drive
   Les données vivent dans le dossier caché de l'appli sur ton
   Drive (portée « drive.appdata ») : elles n'apparaissent pas dans
   tes fichiers et aucune autre appli ne peut les lire.
   Chaque appareil garde une copie locale (l'appli marche hors
   ligne) et se met à jour quand tu synchronises.
   Chargé après app.js et extras.js.
   ============================================================ */
"use strict";

const CLE_SYNCHRO = "potagerBretonSync";
const CLE_AVANT_SYNCHRO = "potagerBretonAvantSynchro";
const PORTEE_DRIVE = "https://www.googleapis.com/auth/drive.appdata";
const FICHIER_DONNEES = "potager-breton.json";
const API_DRIVE = "https://www.googleapis.com/drive/v3/files";
const API_TELEVERSER = "https://www.googleapis.com/upload/drive/v3/files";

// statut : inactif | ok | attente | encours | erreur
const syncEtat = { jeton: null, expire: 0, enCours: false, statut: "inactif", message: "", minuterie: null, faiteCetteSession: false };

function lireSynchro() { return lireJSON(CLE_SYNCHRO); }
function ecrireSynchro(valeur) {
  if (valeur) ecrireJSON(CLE_SYNCHRO, valeur);
  else { try { localStorage.removeItem(CLE_SYNCHRO); } catch (e) { /* rien */ } }
}
function synchroActive() { const s = lireSynchro(); return !!(s && s.clientId); }

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
    ok: "Synchronisé avec Google Drive",
    attente: "Des changements attendent d'être synchronisés : touche pour synchroniser",
    encours: "Synchronisation en cours…",
    erreur: "Erreur de synchronisation : touche pour réessayer",
    inactif: "Synchroniser avec Google Drive"
  };
  const titre = syncEtat.message || titres[syncEtat.statut] || titres.inactif;
  b.title = titre;
  b.setAttribute("aria-label", titre);
}

/* ---------- Connexion à Google ---------- */

function chargerGIS() {
  return new Promise((resolve, reject) => {
    if (window.google && google.accounts && google.accounts.oauth2) { resolve(); return; }
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("reseau"));
    document.head.appendChild(s);
  });
}

// Renvoie un jeton valide. Sans geste de l'utilisateur (interactif = false),
// on ne peut pas ouvrir la fenêtre Google : on renvoie null.
async function obtenirJeton(interactif) {
  if (syncEtat.jeton && Date.now() < syncEtat.expire) return syncEtat.jeton;
  if (!interactif) return null;
  const s = lireSynchro();
  await chargerGIS();
  await new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: s.clientId,
      scope: PORTEE_DRIVE,
      callback: r => {
        if (r.error) { reject(new Error(r.error)); return; }
        syncEtat.jeton = r.access_token;
        syncEtat.expire = Date.now() + (Number(r.expires_in || 3600) - 120) * 1000;
        resolve();
      },
      error_callback: err => reject(new Error((err && err.type) || "popup"))
    });
    client.requestAccessToken({ prompt: s.autorise ? "" : "consent" });
  });
  ecrireSynchro({ ...lireSynchro(), autorise: true });
  return syncEtat.jeton;
}

/* ---------- API Drive ---------- */

async function drive(url, options = {}) {
  const r = await fetch(url, { ...options, headers: { ...(options.headers || {}), Authorization: "Bearer " + syncEtat.jeton } });
  if (r.status === 401) { syncEtat.jeton = null; throw new Error("jeton"); }
  if (!r.ok) throw new Error("drive-" + r.status);
  return r;
}
async function listerFichiers(q) {
  let fichiers = [], page = "";
  do {
    const url = `${API_DRIVE}?spaces=appDataFolder&pageSize=1000&fields=${encodeURIComponent("nextPageToken,files(id,name,createdTime)")}&q=${encodeURIComponent(q)}${page ? "&pageToken=" + encodeURIComponent(page) : ""}`;
    const j = await (await drive(url)).json();
    fichiers = fichiers.concat(j.files || []);
    page = j.nextPageToken || "";
  } while (page);
  return fichiers;
}
async function televerser(nom, blob, type, idExistant = null) {
  if (idExistant) {
    await drive(`${API_TELEVERSER}/${idExistant}?uploadType=media`, { method: "PATCH", headers: { "Content-Type": type }, body: blob });
    return idExistant;
  }
  const b = "potager" + creerId() + creerId();
  const corps = new Blob([
    `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: nom, parents: ["appDataFolder"] })}\r\n--${b}\r\nContent-Type: ${type}\r\n\r\n`,
    blob, `\r\n--${b}--`
  ]);
  const r = await drive(`${API_TELEVERSER}?uploadType=multipart&fields=id`, { method: "POST", headers: { "Content-Type": "multipart/related; boundary=" + b }, body: corps });
  return (await r.json()).id;
}
async function telechargerFichier_(id) { return (await drive(`${API_DRIVE}/${id}?alt=media`)).blob(); }

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
      <p>Ton potager a changé sur cet appareil <strong>et</strong> sur Google Drive depuis la dernière synchronisation. Laquelle garder ?</p>
      <div class="conflit">
        <div><strong>Cet appareil</strong><span>${esc(resume(etat))}</span></div>
        <div><strong>Google Drive</strong><span>${esc(resume(distant))}</span></div>
      </div>
      <p class="texte-doux petit">La version non choisie est remplacée. Si tu gardes Drive, la version de cet appareil reste récupérable dans Réglages → Synchronisation.</p>
      <div class="actions-fenetre">
        <button class="btn" id="cf-local">Garder cet appareil</button>
        <button class="btn-discret" id="cf-distant">Garder Google Drive</button>
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
  const distantes = new Map((await listerFichiers("name contains 'photo-'")).map(f => [f.name, f]));
  const locales = new Set(await PhotosDB.identifiants());
  let recues = false;
  for (const id of utilisees) {
    if (locales.has(id) && !distantes.has(id)) {
      const blob = await PhotosDB.lire(id);
      if (blob) await televerser(id, blob, blob.type || "image/jpeg");
    } else if (!locales.has(id) && distantes.has(id)) {
      await PhotosDB.sauver(id, await telechargerFichier_(distantes.get(id).id));
      recues = true;
    }
  }
  return recues;
}

// Renvoie "envoyé", "reçu", "à jour" ou "reporté"
async function cycleSynchro() {
  const s = lireSynchro();
  const fichiers = (await listerFichiers(`name='${FICHIER_DONNEES}'`)).sort((a, b) => String(a.createdTime).localeCompare(String(b.createdTime)));
  const distant = fichiers[0] || null;
  const donneesDistantes = distant ? JSON.parse(await (await telechargerFichier_(distant.id)).text()) : null;
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
    const blob = new Blob([JSON.stringify(etat)], { type: "application/json" });
    await televerser(FICHIER_DONNEES, blob, "application/json", distant ? distant.id : null);
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
  if (m === "popup_failed_to_open") return "Le navigateur a bloqué la fenêtre Google : autorise les fenêtres surgissantes pour ce site, puis réessaie.";
  if (m === "popup_closed") return "La fenêtre Google a été fermée avant la fin. Si elle affichait une erreur « origine non valide » ou « redirect_uri », l'adresse du site n'est pas autorisée : touche « Vérifier la configuration ».";
  if (m === "invalid_client" || m === "unauthorized_client") return "Google ne reconnaît pas cet identifiant client. Vérifie-le avec « Vérifier la configuration ».";
  if (m === "access_denied") return "Accès refusé. Vérifie que ton adresse est bien « utilisateur test » dans la console Google.";
  if (m === "reseau" || /Failed to fetch|NetworkError|Load failed/i.test(m)) return "Pas de réseau : la synchronisation reprendra plus tard.";
  if (/drive-403/.test(m)) return "Google refuse l'accès. Vérifie que « Google Drive API » est activée pour ton projet.";
  if (/drive-/.test(m)) return "Google Drive a répondu par une erreur (" + m.replace("drive-", "") + ").";
  return "La synchronisation a échoué (" + m + ").";
}

async function synchroniser({ manuel = false } = {}) {
  if (!synchroActive() || syncEtat.enCours) return;
  clearTimeout(syncEtat.minuterie);
  syncEtat.enCours = true;
  definirStatut("encours");
  try {
    const jeton = await obtenirJeton(manuel);
    if (!jeton) { definirStatut("attente"); return; }
    const resultat = await cycleSynchro();
    if (resultat === "reporté") { definirStatut("attente", "Conflit non résolu : touche pour choisir."); return; }
    syncEtat.faiteCetteSession = true;
    ecrireSynchro({ ...lireSynchro(), derniereSynchro: new Date().toISOString() });
    definirStatut("ok");
    if (manuel) toast(resultat === "reçu" ? "Données mises à jour depuis Google Drive." : resultat === "envoyé" ? "Données envoyées sur Google Drive." : "Déjà à jour.");
    syncEtat.enCours = false;
    if (ui.vue === "reglages") rendreReglages();
    if (ui.vue === "accueil") rendreCoach();
  } catch (e) {
    syncEtat.enCours = false;
    if (e.message === "jeton") definirStatut("attente");
    else definirStatut("erreur", messageErreur(e));
    if (manuel) toast(messageErreur(e));
    syncEtat.enCours = false;
    if (ui.vue === "reglages") rendreReglages();
  } finally {
    syncEtat.enCours = false;
  }
}

// Appelée par sauvegarder() à chaque modification des données
function planifierSynchro() {
  if (!synchroActive()) return;
  clearTimeout(syncEtat.minuterie);
  if (syncEtat.jeton && Date.now() < syncEtat.expire) {
    definirStatut("attente");
    syncEtat.minuterie = setTimeout(() => synchroniser({ manuel: false }), 4000);
  } else {
    definirStatut("attente");
  }
}

function deconnecterSynchro() {
  try { if (syncEtat.jeton && window.google && google.accounts) google.accounts.oauth2.revoke(syncEtat.jeton, () => {}); } catch (e) { /* rien */ }
  syncEtat.jeton = null; syncEtat.expire = 0; syncEtat.faiteCetteSession = false;
  ecrireSynchro(null);
  definirStatut("inactif");
}

/* ---------- Coach : rappels de synchronisation ---------- */

function conseilsSynchro() {
  if (!synchroActive()) return [];
  const s = lireSynchro();
  if (syncEtat.faiteCetteSession && syncEtat.statut === "ok") return [];
  const jours = s.derniereSynchro ? joursEntre(parseDate(s.derniereSynchro.slice(0, 10)), aujourdhui()) : null;
  return [{
    type: syncEtat.statut === "erreur" ? "alerte" : "conseil", icone: "☁️",
    titre: syncEtat.statut === "erreur" ? "La synchronisation a échoué"
      : jours === null ? "Termine la connexion à Google Drive"
      : "Synchronise tes données",
    texte: syncEtat.statut === "erreur" ? syncEtat.message
      : jours === null ? "Une fois synchronisé, ton potager sera le même sur ton téléphone et ton ordinateur."
      : jours > 0 ? `Dernière synchronisation il y a ${jours} jour${jours > 1 ? "s" : ""}. Récupère les changements faits sur tes autres appareils et envoie les tiens.`
      : "Récupère les changements faits sur tes autres appareils et envoie les tiens.",
    action: { label: "Synchroniser", synchroniser: true }
  }];
}

/* ---------- Réglages ---------- */

function carteSynchroHTML() {
  const s = lireSynchro();
  const actif = !!(s && s.clientId);
  const derniere = s && s.derniereSynchro ? new Date(s.derniereSynchro) : null;
  const avant = !!lireJSON(CLE_AVANT_SYNCHRO);
  const statut = syncEtat.enCours ? "Synchronisation en cours…"
    : syncEtat.statut === "erreur" ? "⚠️ " + syncEtat.message
    : syncEtat.statut === "attente" ? "Des changements attendent d'être envoyés."
    : derniere ? "✓ À jour" : "Pas encore synchronisé.";
  return `
    <section class="carte" id="rg-synchro">
      <div class="carte-titre"><h2>Synchronisation Google Drive</h2></div>
      ${actif ? `
        <p class="texte-doux">Ton potager est copié dans le dossier caché de l'appli sur ton Google Drive. Ouvre l'appli sur un autre appareil, connecte-toi avec le même compte Google, et tu retrouves tout.</p>
        <p class="petit" id="sy-statut">${esc(statut)}${derniere ? ` Dernière synchronisation : ${esc(derniere.toLocaleString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }))}.` : ""}</p>
        <div class="actions-fenetre">
          <button class="btn" id="sy-lancer"${syncEtat.enCours ? " disabled" : ""}>☁️ Synchroniser maintenant</button>
          ${avant ? `<button class="btn-discret" id="sy-annuler-derniere">Retrouver la version d'avant la dernière réception</button>` : ""}
          <button class="btn-discret" id="sy-verifier">🔍 Vérifier la configuration</button>
          <button class="btn-discret" id="sy-deconnecter">Se déconnecter</button>
        </div>
        <div id="sy-diag" class="diag" aria-live="polite"></div>`
      : `
        <p class="texte-doux">Pour retrouver le même potager sur ton téléphone et ton ordinateur, l'appli peut copier tes données dans un dossier privé de ton Google Drive. Cela demande une configuration unique (environ 10 minutes) pour obtenir un identifiant Google gratuit.</p>
        <label for="sy-client">Identifiant client Google</label>
        <input id="sy-client" type="text" inputmode="url" autocomplete="off" spellcheck="false" placeholder="123456-abc.apps.googleusercontent.com">
        <div class="actions-fenetre">
          <button class="btn" id="sy-enregistrer">Enregistrer et se connecter</button>
          <button class="btn-discret" id="sy-verifier">🔍 Vérifier la configuration</button>
        </div>
        <div id="sy-diag" class="diag" aria-live="polite"></div>
        <details class="accordeon">
          <summary>Comment obtenir cet identifiant ?</summary>
          <ol class="etapes">
            <li>Sur ordinateur, ouvre <a href="https://console.cloud.google.com/projectcreate" target="_blank" rel="noopener"><strong>console.cloud.google.com</strong></a> avec ton compte Google et crée un projet (nom libre, par exemple « Potager »).</li>
            <li><strong>API et services → Bibliothèque</strong> : cherche « Google Drive API » et clique sur <strong>Activer</strong>.</li>
            <li><strong>Écran de consentement OAuth</strong> (ou « Google Auth Platform ») : type <em>Externe</em>, nom « Mon Potager », ton e-mail. Dans « Accès aux données », ajoute le champ d'application <code>…/auth/drive.appdata</code>.</li>
            <li>Toujours dans l'écran de consentement : clique sur <strong>Publier l'application</strong> (aucune vérification n'est demandée pour ce champ). Sinon, ajoute ton adresse comme « utilisateur test » ; Google te demandera alors de te reconnecter chaque semaine.</li>
            <li><strong>Identifiants → Créer des identifiants → ID client OAuth</strong>, type <em>Application Web</em>. Dans « Origines JavaScript autorisées », ajoute exactement : <code>${esc(location.origin)}</code> <button class="lien-bouton" id="sy-copier-origine" type="button">Copier</button></li>
            <li>Copie l'<strong>ID client</strong> (il se termine par <code>.apps.googleusercontent.com</code>) et colle-le ci-dessus.</li>
          </ol>
        </details>`}
    </section>`;
}

// Vérifie chaque étape de la configuration et explique en clair ce qui manque
async function diagnostiquerSynchro(zone) {
  const sortie = zone.querySelector("#sy-diag");
  const saisie = zone.querySelector("#sy-client");
  const enregistre = lireSynchro();
  const id = ((saisie && saisie.value.trim()) || (enregistre && enregistre.clientId) || "");
  const etapes = [];
  const dessiner = (enCours) => {
    sortie.innerHTML = etapes.map(e => `<div class="diag-ligne ${e.ok ? "ok" : "ko"}"><span>${e.ok ? "✓" : "✗"}</span><div><strong>${esc(e.titre)}</strong>${e.aide ? `<div class="petit">${esc(e.aide)}</div>` : ""}</div></div>`).join("")
      + (enCours ? `<div class="diag-ligne"><span>…</span><div>${esc(enCours)}</div></div>` : "");
  };
  const ajouter = (ok, titre, aide) => { etapes.push({ ok, titre, aide }); dessiner(); return ok; };

  if (!id) { ajouter(false, "Identifiant client", "Colle d'abord l'identifiant client Google dans le champ ci-dessus."); return; }
  if (!ajouter(/^[\w.-]+\.apps\.googleusercontent\.com$/.test(id), "Identifiant client", "Il doit se terminer par .apps.googleusercontent.com. Copie-le en entier depuis la console Google (Identifiants).")) return;
  ajouter(location.protocol === "https:" || location.hostname === "localhost", "Adresse du site",
    location.protocol === "https:" ? `À autoriser dans la console Google (« Origines JavaScript autorisées ») : ${location.origin}` : "Google exige une adresse en https.");
  dessiner("Connexion au service Google…");
  try { await chargerGIS(); ajouter(true, "Service de connexion Google joignable"); }
  catch (e) { ajouter(false, "Service de connexion Google joignable", "Vérifie ta connexion internet (ou un bloqueur de publicités) puis réessaie."); return; }
  dessiner("Une fenêtre Google va s'ouvrir : choisis ton compte et accepte l'accès…");
  const sauvegarde = enregistre;
  try {
    ecrireSynchro({ ...(sauvegarde || {}), clientId: id });
    syncEtat.jeton = null;
    await obtenirJeton(true);
    ajouter(true, "Connexion à ton compte Google");
  } catch (e) {
    ajouter(false, "Connexion à ton compte Google", messageErreur(e));
    if (!sauvegarde) { try { localStorage.removeItem(CLE_SYNCHRO); } catch (x) { /* rien */ } }
    return;
  }
  try { await listerFichiers("name = '" + FICHIER_DONNEES + "'"); ajouter(true, "Accès au dossier privé de l'appli sur Drive"); }
  catch (e) { ajouter(false, "Accès au dossier privé de l'appli sur Drive", messageErreur(e)); return; }
  etapes.push({ ok: true, titre: "Tout est prêt", aide: "Tu peux enregistrer l'identifiant et synchroniser." });
  dessiner();
  if (!sauvegarde) { try { localStorage.removeItem(CLE_SYNCHRO); } catch (x) { /* rien */ } }
}

function brancherSynchro(zone) {
  const verifier = zone.querySelector("#sy-verifier");
  if (verifier) verifier.addEventListener("click", () => diagnostiquerSynchro(zone));
  const copier = zone.querySelector("#sy-copier-origine");
  if (copier) copier.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(location.origin); toast("Adresse copiée."); } catch (e) { toast("Copie impossible : recopie l'adresse à la main."); }
  });
  const enregistrer = zone.querySelector("#sy-enregistrer");
  if (enregistrer) enregistrer.addEventListener("click", () => {
    const id = zone.querySelector("#sy-client").value.trim();
    if (!/^[\w.-]+\.apps\.googleusercontent\.com$/.test(id)) {
      toast("Cet identifiant ne ressemble pas à un identifiant Google (il se termine par .apps.googleusercontent.com).");
      return;
    }
    ecrireSynchro({ clientId: id });
    majBoutonSynchro();
    rendreReglages();
    synchroniser({ manuel: true });
  });
  const lancer = zone.querySelector("#sy-lancer");
  if (lancer) lancer.addEventListener("click", () => { synchroniser({ manuel: true }); rendreReglages(); });
  const deco = zone.querySelector("#sy-deconnecter");
  if (deco) deco.addEventListener("click", () => {
    if (!confirm("Se déconnecter de Google Drive ? Tes données restent sur cet appareil et sur Drive.")) return;
    deconnecterSynchro();
    rendreReglages();
    toast("Synchronisation désactivée.");
  });
  const avant = zone.querySelector("#sy-annuler-derniere");
  if (avant) avant.addEventListener("click", () => {
    const ancien = lireJSON(CLE_AVANT_SYNCHRO);
    if (!ancien) return;
    adopterEtat(ancien);
    try { localStorage.removeItem(CLE_AVANT_SYNCHRO); } catch (e) { /* rien */ }
    toast("Version précédente retrouvée. La prochaine synchronisation l'enverra sur Drive.");
    planifierSynchro();
    rendreReglages();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const b = document.getElementById("btn-synchro");
  if (b) b.addEventListener("click", () => synchroniser({ manuel: true }));
  if (synchroActive()) {
    const s = lireSynchro();
    definirStatut(!s.versionSynchro || etat.modifieLe !== s.versionSynchro ? "attente" : "inactif");
  }
  majBoutonSynchro();
});
