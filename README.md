# 🌱 Mon Potager Breton

Une petite application web pour suivre un potager en Bretagne : modélisation
des parcelles en carrés, rappels de récolte, idées de plantation selon la
saison, conseils et journal de jardin.

Site statique en HTML/CSS/JS, sans base de données ni serveur : toutes les
données sont enregistrées dans le navigateur (`localStorage`). C'est simple à
héberger gratuitement sur **GitHub Pages**.

## Fonctionnalités

- **Tableau de bord** : rappels de récolte (à venir / bientôt / en retard),
  tâches du mois adaptées au climat breton, aperçu des semis du moment.
- **Plan du potager** : une ou plusieurs parcelles découpées en carrés, à
  remplir case par case (plante, date de plantation, notes). Les couleurs
  indiquent la famille botanique pour t'aider à penser la rotation des
  cultures.
- **Mes cultures** : liste de toutes les cultures en cours avec leur statut.
- **Idées & saisons** : que semer/planter et que récolter, mois par mois,
  filtrable par légumes / fruits / aromates / fleurs.
- **Journal & conseils** : un journal de bord personnel, des conseils mois
  par mois et des fiches conseils générales, pensés pour le climat océanique
  breton (pluie, vent, limaces, sols acides...).
- **Export / import** : sauvegarde de tes données en fichier `.json`, pour
  ne rien perdre ou changer d'appareil.

## Déployer sur GitHub Pages

1. Crée un nouveau dépôt GitHub et mets-y le contenu de ce dossier
   (`index.html`, `css/`, `js/`, ce fichier `README.md`).
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

## Idées d'évolution possibles

- Ajouter tes propres plantes à la base (`js/plants-data.js`).
- Associations de cultures (compagnonnage) et distances de rotation
  suggérées automatiquement.
- Historique visuel d'une parcelle sur plusieurs années.
