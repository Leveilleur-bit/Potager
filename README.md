# 🌱 Mon Potager Breton

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
  **Une case peut accueillir jusqu'à 4 cultures** (ex. tomate + basilic +
  œillet d'Inde), chacune avec sa date, ses notes et son suivi.
- **Rotation et compagnonnage** : en plantant, l'appli signale si la même
  famille a occupé la case ces 3 dernières années et si les voisins
  s'entendent bien ou mal.
- **Cultures** : chaque culture avec sa barre de progression et sa fenêtre
  de récolte estimée (les cultures qui passent l'hiver sont gérées).
- **Saisons** : quoi semer ou récolter mois par mois, calendrier annuel de
  toutes les plantes, recherche, fiches détaillées (40 plantes).
- **Journal** : notes, semis, récoltes et problèmes, bilan des récoltes de
  l'année, conseils mois par mois.
- **Réglages** : commune pour la météo, export / import, installation.
- **Annuler** : chaque suppression ou modification peut être annulée pendant
  quelques secondes.
- **Hors ligne et installable** (PWA) : sur téléphone, menu du navigateur →
  « Ajouter à l'écran d'accueil ».

La météo vient d'Open-Meteo (gratuit, sans compte). Seule la position de la
commune choisie est envoyée.

## Déployer sur GitHub Pages

1. Crée un nouveau dépôt GitHub et mets-y le contenu de ce dossier
   (`index.html`, `css/`, `js/`, `icons/`, `manifest.json`, `sw.js`, ce
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

## Idées d'évolution possibles

- Ajouter tes propres plantes à la base (`js/plants-data.js`).
- Associations de cultures (compagnonnage) et distances de rotation
  suggérées automatiquement.
- Historique visuel d'une parcelle sur plusieurs années.
