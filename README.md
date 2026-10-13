# 🌱 Mon Potager

Une petite application web pour suivre un potager en Bretagne : modélisation
des parcelles en carrés, rappels de récolte, idées de plantation selon la
saison, conseils et journal de jardin.

Site statique en HTML/CSS/JS, sans base de données ni serveur : toutes les
données sont enregistrées dans le navigateur (`localStorage`). C'est simple à
héberger gratuitement sur **GitHub Pages**.

## Fonctionnalités

- **Accueil** : le plan de ton potager (pastilles sur ce qui est prêt à
  récolter), le coach du jour, la météo à 5 jours, les récoltes à venir et
  les gestes du mois.
- **Le coach** : conseils personnalisés selon ton potager et la météo de ta
  commune : alertes gel avec la liste de tes cultures sensibles, coups de
  vent, pluies douces à limaces, arrosage par temps sec, récoltes en retard,
  mauvais voisinages, place libre à occuper, rappel de sauvegarde, astuce du
  jour.
- **Plan** : vue d'ensemble à l'échelle (cases de 1 m²), parcelles
  déplaçables au doigt, détail de chaque parcelle. Touche une case pour
  planter, noter une récolte (avec quantité) ou terminer une culture.
  **Une case peut accueillir jusqu'à 5 cultures** (ex. tomate + basilic +
  œillet d'Inde), chacune avec sa date, ses notes et son suivi.
- **Rotation et compagnonnage** : en plantant, l'appli signale si la même
  famille a occupé la case ces 3 dernières années et si les voisins
  s'entendent bien ou mal.
- **Mon année** (onglet Saisons) : plan sur 12 mois, mois par mois ; le coach rappelle chaque culture au bon moment. Asperges incluses, avec leurs soins mensuels.
- **Santé du potager** (Saisons → Santé), **plantes pérennes** (âge et soins du mois), **arrosage selon la météo**, **thème sombre** et taille du texte (Réglages → Apparence).
- **Coach du trimestre** (onglet Saisons → « Plan 3 mois ») : pour les
  3 prochains mois, des idées de cultures classées selon ton potager (place
  libre, bons voisins, rotation, dernière occasion de semer). Un bouton
  « Je le prévois » les ajoute à ton plan ; l'appli propose la meilleure
  case, te rappelle sur l'accueil quand c'est le moment (ou le dernier
  mois pour le faire), et marque le projet « lancé » dès que tu plantes.
  Tu y vois aussi les récoltes attendues et les gestes du trimestre.
- **Paillage et hivernage** : sur chaque case, note un paillage, un voile
  d'hivernage ou une bâche (icône sur le plan). Le coach te rappelle de
  protéger les cases nues dès octobre, tient compte des voiles dans les
  alertes de gel, et te dit de les retirer au printemps. Tu peux aussi
  protéger toutes les cases libres d'une parcelle d'un coup.
- **Frise et rotation** (Saisons) : toutes tes cultures de l'année sur une
  même page, et pour chaque parcelle l'historique des familles avec le
  groupe conseillé l'an prochain (légumes-fruits, feuilles, racines,
  légumineuses).
- **Graines et courses** (Cultures) : ta réserve de sachets avec
  péremption, et une liste de courses qui se remplit toute seule avec ce
  qui manque pour ton plan.
- **Photos** dans le journal (stockées sur l'appareil, incluses dans les
  sauvegardes).
- **Mes plantes** (Réglages) : ajoute tes propres plantes et variétés.
- **Synchronisation GitHub** : les données vont dans un dépôt GitHub **privé** (ex. `potager-donnees`, fichier `potager-breton.json` + dossier `photos/`). Jeton « fine-grained » limité à ce dépôt, permission *Contents : Read and write*. Synchro automatique à l'ouverture et après chaque changement.
- **Sauvegarde manuelle** par fichier (menu de partage du téléphone), et
  **export des rappels vers l'agenda** (fichier .ics).
- **Cultures** : chaque culture avec sa barre de progression et sa fenêtre
  de récolte estimée (les cultures qui passent l'hiver sont gérées).
- **Saisons** : quoi semer ou récolter mois par mois, calendrier annuel de
  toutes les plantes, recherche, fiches détaillées (56 plantes, dont 15 aromates et 12 fleurs).
- **Journal** : notes, semis, récoltes et problèmes, bilan des récoltes de
  l'année, conseils mois par mois.
- **Réglages** : commune pour la météo, export / import, installation, et
  **version de l'appli** avec vérification des mises à jour.
- **Annuler** : chaque suppression ou modification peut être annulée pendant
  quelques secondes.
- **Hors ligne et installable** (PWA) : sur téléphone, menu du navigateur →
  « Ajouter à l'écran d'accueil ».

La météo vient d'Open-Meteo (gratuit, sans compte). Seule la position de la
commune choisie est envoyée.

## Déployer sur GitHub Pages

1. Crée un nouveau dépôt GitHub et mets-y le contenu de ce dossier
   (`index.html`, `css/`, `js/` (dont `aide.js` (pérennes, santé, arrosage, apparence), `extras.js` et `sync.js`), `icon-192.png`, `icon-512.png`, `manifest.json`, `sw.js`, ce
   fichier `README.md`) **en conservant l'arborescence** : les fichiers
   `style.css` et `app.js` doivent rester dans leurs sous-dossiers
   `css/` et `js/`, pas à la racine.
2. Dans le dépôt : **Settings → Pages**.
3. Sous « Build and deployment », choisis **Deploy from a branch**, branche
   `main` (ou `master`), dossier `/ (root)`.
4. Après une minute ou deux, ton site est accessible à une adresse du type :
   `https://<ton-pseudo-github>.github.io/<nom-du-depot>/`

Aucune commande de build n'est nécessaire : le site est déjà prêt à l'emploi.

## Utiliser le site en local

Ouvre simplement `index.html` dans un navigateur, ou lance un petit serveur
local si tu préfères :

```bash
python3 -m http.server 8000
# puis ouvre http://localhost:8000
```

## Limites à connaître

- Les données sont stockées **uniquement dans le navigateur** utilisé :
  pas de compte, pas de synchronisation automatique entre appareils.
  Utilise le bouton « Exporter mes données » régulièrement, et
  « Importer » sur un autre appareil si besoin.
- Les mois de semis/récolte de la base de plantes sont des repères généraux
  pour le climat breton (océanique doux) : ajuste-les selon ta météo réelle
  et ton micro-climat.
- Pas de notifications push : l'appli affiche les rappels lorsque tu
  l'ouvres (adapté à une utilisation régulière).
- Le service worker met les fichiers en cache : après avoir modifié
  `css/style.css` ou `js/app.js`, incrémente `CACHE_VERSION` en haut de
  `sw.js` pour forcer les appareils déjà installés à récupérer la nouvelle
  version.

## Publier une nouvelle version

À chaque livraison, change le numéro à **trois endroits** pour que la
vérification de version fonctionne :

1. `VERSION_APP` et `DATE_VERSION_APP` en haut de `js/app.js` ;
2. `version` et `date` dans `version.json` (avec la liste des nouveautés) ;
3. `CACHE_VERSION` dans `sw.js` (`"v7"` pour la version 7).

Dans Réglages → Version de l'appli, « Vérifier les mises à jour » compare la
version installée à `version.json` en ligne ; « Mettre à jour maintenant »
vide le cache de l'appli (jamais tes données) et recharge.

## Idées d'évolution possibles

- Ajouter tes propres plantes à la base (`js/plants-data.js`).
- Associations de cultures (compagnonnage) et distances de rotation
  suggérées automatiquement.
- Historique visuel d'une parcelle sur plusieurs années.
