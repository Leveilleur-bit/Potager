/* ============================================================
   Service Worker — Mon Potager Breton
   Permet d'utiliser l'appli hors-ligne (au fond du jardin sans
   réseau) et de l'installer sur l'écran d'accueil du téléphone.

   Stratégie :
   - fichiers de l'appli (HTML/CSS/JS/icônes) : "cache d'abord",
     avec une mise à jour en arrière-plan dès que le réseau est là.
   - autres ressources (polices Google) : réseau d'abord, avec
     repli sur le cache si hors-ligne.

   Incrémente CACHE_VERSION à chaque changement des fichiers
   listés ci-dessous pour forcer les appareils à récupérer la
   nouvelle version.
   ============================================================ */

const CACHE_VERSION = "v5";
const CACHE_NAME = "potager-breton-" + CACHE_VERSION;

const FICHIERS_A_METTRE_EN_CACHE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/style.css",
  "./js/app.js",
  "./js/plants-data.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(FICHIERS_A_METTRE_EN_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((noms) =>
      Promise.all(
        noms
          .filter((nom) => nom.startsWith("potager-breton-") && nom !== CACHE_NAME)
          .map((nom) => caches.delete(nom))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const requete = event.request;
  if (requete.method !== "GET") return;

  const estMemeOrigine = new URL(requete.url).origin === self.location.origin;

  if (estMemeOrigine) {
    // Cache d'abord, avec rafraîchissement silencieux en arrière-plan
    event.respondWith(
      caches.match(requete).then((reponseCache) => {
        const recherchePromesse = fetch(requete)
          .then((reponseReseau) => {
            if (reponseReseau && reponseReseau.ok) {
              const copie = reponseReseau.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(requete, copie));
            }
            return reponseReseau;
          })
          .catch(() => reponseCache);
        return reponseCache || recherchePromesse;
      })
    );
  } else {
    // Ressources externes (polices, météo) : réseau d'abord, repli sur le
    // cache hors ligne. La recherche de commune n'est jamais mise en cache.
    if (requete.url.includes("geocoding-api")) return;
    event.respondWith(
      fetch(requete)
        .then((reponseReseau) => {
          if (reponseReseau && (reponseReseau.ok || reponseReseau.type === "opaque")) {
            const copie = reponseReseau.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(requete, copie));
          }
          return reponseReseau;
        })
        .catch(() => caches.match(requete))
    );
  }
});
