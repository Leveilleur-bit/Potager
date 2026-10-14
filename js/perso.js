/* ============================================================
   Réglages et aides propres à ce jardin
   - soleil et ombre des arbres (plan « Voir par Soleil », idées de plantation)
   - mes soucis (limaces, oiseaux, vent du nord) en priorité
   - récupérateur d'eau de pluie dans les conseils d'arrosage
   - une touche fleurie dans le coach
   - rappels du matin en notification (si le téléphone le permet)
   ============================================================ */

/* ---------- Préférences du jardin ---------- */

const SOUCIS = { limaces: "🐌 Limaces", oiseaux: "🐦 Oiseaux", vent: "🌬️ Vent du nord", pucerons: "🐛 Pucerons", secheresse: "☀️ Sécheresse" };
function prefsJardin() {
  const j = (etat.reglages && etat.reglages.jardin) || {};
  return {
    recuperateur: j.recuperateur !== false,                         // oui par défaut
    soucis: Array.isArray(j.soucis) ? j.soucis.filter(s => SOUCIS[s]) : ["limaces", "oiseaux", "vent"]
  };
}
function majPrefsJardin(modif) {
  etat.reglages.jardin = Object.assign({}, etat.reglages.jardin || {}, modif);
  sauvegarder();
}

/* ---------- Soleil et ombre ---------- */

// Le soleil de midi vient du sud : l'ombre d'un arbre tombe vers le nord
const VECTEURS_SUD = { haut: [0, -1], bas: [0, 1], gauche: [-1, 0], droite: [1, 0] };
function arbresEnMetres() {
  const jardin = reglagesJardin();
  return (jardin.arbres || []).map(a => {
    const p = etat.parcelles.find(x => x.id === a.parcelle);
    if (!p) return null;
    const t = (Number(p.angle) || 0) * Math.PI / 180;
    return { type: a.type, r: a.r || 0.8, x: p.posX + a.dx * Math.cos(t) - a.dy * Math.sin(t), y: p.posY + a.dx * Math.sin(t) + a.dy * Math.cos(t) };
  }).filter(Boolean);
}
function centreCase(p, coord) {
  const [x, y] = coord.split("-").map(Number);
  const { W, H } = dimsReelles(p);
  const lx = (x + 0.5) * W / p.largeur, ly = (y + 0.5) * H / p.hauteur;
  const t = (Number(p.angle) || 0) * Math.PI / 180;
  return [p.posX + lx * Math.cos(t) - ly * Math.sin(t), p.posY + lx * Math.sin(t) + ly * Math.cos(t)];
}
// "soleil", "mi-ombre" ou "ombre", avec l'arbre responsable
function ensoleillementCase(p, coord) {
  const jardin = reglagesJardin();
  const sud = VECTEURS_SUD[jardin.sud || "haut"];
  const [cx, cy] = centreCase(p, coord);
  let pire = { niveau: "soleil", arbre: null };
  arbresEnMetres().forEach(a => {
    // centre de l'ombre : décalé vers le nord (soleil bas en Bretagne une bonne partie de l'année)
    const ox = a.x - sud[0] * a.r * 1.1, oy = a.y - sud[1] * a.r * 1.1;
    const d = Math.hypot(cx - ox, cy - oy), dTronc = Math.hypot(cx - a.x, cy - a.y);
    const niveau = d < a.r * 0.9 || dTronc < a.r * 0.6 ? "ombre" : d < a.r * 1.7 ? "mi-ombre" : "soleil";
    if (niveau === "ombre" || (niveau === "mi-ombre" && pire.niveau === "soleil")) pire = { niveau, arbre: a };
  });
  return pire;
}
const NOMS_ARBRES = { palmier: "du palmier", cordyline: "de la cordyline", fruitier: "du cerisier", arbre: "de l'arbre" };
function libelleEnsoleillement(e) {
  if (e.niveau === "soleil") return "☀️ Plein soleil";
  return (e.niveau === "ombre" ? "🌑 À l'ombre " : "⛅ Mi-ombre ") + (NOMS_ARBRES[e.arbre && e.arbre.type] || "");
}
function aimeOmbre(plante) { return /mi-ombre|tout/.test(plante.exposition || ""); }
function veutSoleil(plante) { return /^plein soleil|^soleil, sol/.test(plante.exposition || "") && !/mi-ombre/.test(plante.exposition || ""); }
// Bonus/malus d'une plante pour l'ensoleillement d'une case
function scoreEnsoleillement(plante, e) {
  if (e.niveau === "soleil") return veutSoleil(plante) ? 1 : 0;
  if (e.niveau === "mi-ombre") return veutSoleil(plante) ? -3 : aimeOmbre(plante) ? 2 : 0;
  return veutSoleil(plante) ? -8 : aimeOmbre(plante) ? 2 : -2;
}

/* ---------- Coach : soucis, vent du nord, fleurs ---------- */

function conseilsPerso(cultures) {
  const conseils = [];
  const prefs = prefsJardin();
  const m = moisCourant();
  const jours = joursMeteoValides();
  // Vent du nord (froid et desséchant chez toi)
  if (prefs.soucis.includes("vent") && jours) {
    const nord = jours.slice(0, 3).find(j => j.rafales >= 40 && j.directionVent != null && (j.directionVent >= 315 || j.directionVent <= 45));
    if (nord) conseils.push({
      type: "alerte", icone: "🌬️", titre: `Vent du nord ${nomJour(nord.date)}`,
      texte: "Il arrive par la maison et dessèche tout. Pose un voile sur les jeunes plants, vérifie les tuteurs et rentre ou abrite les pots légers." + (m >= 11 || m <= 3 ? " Avec ce vent, le froid se ressent plus fort : protège les frileuses." : "")
    });
  }
  // Oiseaux : au moment des semis et des fruits
  if (prefs.soucis.includes("oiseaux")) {
    const fruits = cultures.filter(c => ["fraise", "framboise", "cassis", "myrtille"].includes(c.plante.id) && (c.plante.moisRecolte || []).includes(m));
    const semis = cultures.filter(c => joursEntre(c.datePlantation, aujourdhui()) <= 20 && ["petit-pois", "feve", "salade", "chou", "radis", "haricot-vert"].includes(c.plante.id));
    if (fruits.length || semis.length) conseils.push({
      type: "conseil", icone: "🐦", titre: fruits.length ? "Les oiseaux guettent les fruits" : "Protège les semis des oiseaux",
      texte: fruits.length ? `Garde le filet bien fermé sur ${listeFr([...new Set(fruits.map(c => nomCourt(c.plante).toLowerCase()))].slice(0, 3))} et cueille tous les jours ou deux.`
        : "Les jeunes pousses de pois, fèves et salades sont vite picorées : un voile ou un filet tendu sur arceaux jusqu'à ce qu'elles aient quelques feuilles."
    });
  }
  // Des fleurs toute l'année (mois creux d'abord), voir saison.js
  const fl = typeof conseilFleurs === "function" ? conseilFleurs(cultures) : null;
  if (fl) conseils.push(fl);
  return conseils;
}

/* ---------- Rappels du matin (notifications) ---------- */

const CLE_NOTIF = "potagerBretonNotif";
function lireNotif() { try { return JSON.parse(localStorage.getItem(CLE_NOTIF) || "{}"); } catch (e) { return {}; } }
function ecrireNotif(v) { try { localStorage.setItem(CLE_NOTIF, JSON.stringify(v)); } catch (e) { /* rien */ } }
function notificationsPossibles() { return "Notification" in window && "serviceWorker" in navigator; }

// Le service worker lit ce résumé (IndexedDB) pour composer la notification du matin
function ecrireResumeMatin() {
  if (!lireNotif().actif) return;
  let conseils = [];
  try { conseils = genererCoaching().slice(0, 3).map(c => ({ titre: c.titre, texte: c.texte })); } catch (e) { return; }
  const req = indexedDB.open("potagerBretonNotif", 1);
  req.onupgradeneeded = () => req.result.createObjectStore("resume");
  req.onsuccess = () => {
    try { req.result.transaction("resume", "readwrite").objectStore("resume").put({ conseils, ecritLe: Date.now(), heure: lireNotif().heure || 8 }, "matin"); } catch (e) { /* rien */ }
  };
}

async function activerNotifications() {
  if (!notificationsPossibles()) { toast("Ce navigateur ne permet pas les notifications."); return false; }
  const perm = await Notification.requestPermission();
  if (perm !== "granted") { toast("Notifications refusées : tu peux les autoriser dans les réglages du navigateur."); return false; }
  const reg = await navigator.serviceWorker.ready;
  let periodique = false;
  try {
    if ("periodicSync" in reg) {
      const statut = await navigator.permissions.query({ name: "periodic-background-sync" }).catch(() => ({ state: "granted" }));
      if (statut.state === "granted") { await reg.periodicSync.register("rappels-matin", { minInterval: 6 * 3600 * 1000 }); periodique = true; }
    }
  } catch (e) { periodique = false; }
  ecrireNotif({ ...lireNotif(), actif: true, periodique, heure: lireNotif().heure || 8 });
  ecrireResumeMatin();
  return true;
}
async function desactiverNotifications() {
  try { const reg = await navigator.serviceWorker.ready; if (reg.periodicSync) await reg.periodicSync.unregister("rappels-matin"); } catch (e) { /* rien */ }
  ecrireNotif({ ...lireNotif(), actif: false });
}
async function notificationTest() {
  const reg = await navigator.serviceWorker.ready;
  const c = genererCoaching()[0];
  await reg.showNotification("Ce matin au jardin", { body: c ? c.titre : "Rien d'urgent : profite du jardin !", icon: "icon-192.png", badge: "icon-192.png", tag: "potager-matin" });
}

function carteNotificationsHTML() {
  const n = lireNotif();
  const possible = notificationsPossibles();
  const installee = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  return `<section class="carte" id="rg-notif">
    <div class="carte-titre"><h2>Rappels du matin</h2></div>
    ${!possible ? `<p class="texte-doux">Ce navigateur ne permet pas les notifications. Utilise plutôt « Ajouter mes rappels à mon agenda » (Saisons → Mon année).</p>` : n.actif ? `
      <p class="texte-doux">Activés. Le matin, une notification te résume ce qu'il y a à faire au jardin${n.periodique ? "" : " (quand tu ouvres l'appli)"}.</p>
      ${n.periodique ? "" : `<p class="texte-doux petit">Ton téléphone n'autorise pas encore les rappels en arrière-plan. Ils fonctionnent mieux une fois l'appli <strong>installée sur l'écran d'accueil</strong>${installee ? "" : " (voir « Installer l'appli » plus bas)"} et utilisée régulièrement. Pour des rappels garantis à heure fixe, ajoute aussi tes rappels à ton agenda.</p>`}
      <label for="nt-heure">Heure du rappel</label>
      <select id="nt-heure">${[6, 7, 8, 9, 10].map(h => `<option value="${h}"${(n.heure || 8) === h ? " selected" : ""}>${h} h</option>`).join("")}</select>
      <div class="actions-fenetre"><button class="btn-discret" id="nt-test">Envoyer une notification d'essai</button><button class="btn-discret" id="nt-off">Désactiver</button></div>`
    : `<p class="texte-doux">Reçois chaque matin sur ton téléphone le geste du jour au jardin : gel annoncé, limaces, récolte, semis prévus…</p>
      <div class="actions-fenetre"><button class="btn" id="nt-on">🔔 Activer les rappels du matin</button></div>`}
  </section>`;
}
function brancherNotifications(zone) {
  const on = zone.querySelector("#nt-on"), off = zone.querySelector("#nt-off"), test = zone.querySelector("#nt-test"), heure = zone.querySelector("#nt-heure");
  if (on) on.addEventListener("click", async () => { if (await activerNotifications()) { toast("Rappels du matin activés."); rendreReglages(); } });
  if (off) off.addEventListener("click", async () => { await desactiverNotifications(); toast("Rappels désactivés."); rendreReglages(); });
  if (test) test.addEventListener("click", () => notificationTest().catch(() => toast("La notification n'a pas pu s'afficher.")));
  if (heure) heure.addEventListener("change", () => { ecrireNotif({ ...lireNotif(), heure: +heure.value }); ecrireResumeMatin(); toast("Heure enregistrée."); });
}

/* ---------- Réglages du jardin : eau et soucis ---------- */

function sectionPrefsJardinHTML() {
  const p = prefsJardin();
  return `<h3 class="sous-titre-section">Arrosage</h3>
    <label class="case-a-cocher"><input type="checkbox" id="rj-recup"${p.recuperateur ? " checked" : ""}> J'arrose avec un récupérateur d'eau de pluie</label>
    <h3 class="sous-titre-section">Mes soucis au jardin</h3>
    <p class="texte-doux petit">Le coach les surveille en priorité.</p>
    <div class="chips">${Object.entries(SOUCIS).map(([k, l]) => `<button class="chip${p.soucis.includes(k) ? " actif" : ""}" data-souci="${k}" aria-pressed="${p.soucis.includes(k)}">${l}</button>`).join("")}</div>`;
}
function brancherPrefsJardin(fen, rouvrir) {
  const r = fen.querySelector("#rj-recup");
  if (r) r.addEventListener("change", () => { majPrefsJardin({ recuperateur: r.checked }); });
  fen.querySelectorAll("[data-souci]").forEach(b => b.addEventListener("click", () => {
    const s = new Set(prefsJardin().soucis);
    if (s.has(b.dataset.souci)) s.delete(b.dataset.souci); else s.add(b.dataset.souci);
    majPrefsJardin({ soucis: [...s] });
    rouvrir();
  }));
}

/* ---------- Oiseaux : une fiche de plus dans « Santé » ---------- */
if (typeof PROBLEMES !== "undefined" && !PROBLEMES.some(p => p.id === "oiseaux")) {
  PROBLEMES.push({ id: "oiseaux", nom: "Oiseaux", icone: "🐦", plantes: ["fraise", "framboise", "cassis", "myrtille", "petit-pois", "feve", "salade", "chou", "radis"], mois: [3, 4, 5, 6, 7, 8], humide: false,
    signes: "Semis déterrés, jeunes pousses picorées, fruits entamés juste avant la récolte.",
    prevenir: "Filet ou voile sur arceaux, bien fermé au sol, dès le semis et dès que les fruits colorent. Des CD ou rubans qui bougent effraient un temps, à déplacer souvent.",
    agir: "Récolte un peu avant la pleine maturité et tous les jours ou deux. Laisse un coin « pour eux » loin du potager (un petit fruitier, une coupelle d'eau) : ils mangent aussi beaucoup d'insectes.",
    breton: "Merles et pies sont malins : vérifie qu'aucun trou ne reste au pied du filet." });
}
