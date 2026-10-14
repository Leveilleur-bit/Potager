/* ============================================================
   Aide au jardinage : un coach qualitatif, sans chiffres à saisir.
   - plantes pérennes (âge, entretien de l'année, renouvellement)
   - santé du potager (maladies et ravageurs, prévention douce)
   - arrosage et météo (conseils selon la pluie récente et prévue)
   - « refaire comme l'an dernier » (plan de l'année)
   - apparence (thème clair/sombre, taille du texte)
   ============================================================ */

/* ---------- Plantes pérennes ---------- */

// m : mois concernés, t : le geste. ren : renouvellement conseillé après N années.
const VIVACES = {
  "asperge": {
    note: "Une aspergère reste en place 10 à 15 ans : on ne la déplace pas.",
    soins: [
      { m: [1, 12], t: "Rien à faire : évite de piétiner la planche. Si le sol est nu, une couche de paillis ou de compost mûr protège les griffes." },
      { m: [2], t: "Arrache les adventices à la main, sans abîmer les griffes, puis étale du compost mûr ou du fumier décomposé sur la planche." },
      { m: [3], t: "Désherbe et dresse de petites buttes de 20 à 30 cm au-dessus des griffes : elles feront blanchir les turions et réchaufferont le sol." },
      { m: [4], t: "La récolte commence : coupe les turions de 18 à 22 cm au couteau, sans blesser les voisins. Cueille tous les jours ou tous les deux jours quand il fait doux." },
      { m: [5], t: "Pleine récolte : cueille le matin et arrose en cas de printemps sec, les turions grossissent mieux." },
      { m: [6], t: "Arrête de couper vers la Saint-Jean (24 juin), plus tôt si les turions s'affinent : laisse monter le feuillage pour que la plante refasse ses réserves.", alerte: true },
      { m: [7, 8], t: "Laisse le feuillage (le « plumet ») nourrir les griffes pour l'an prochain. Tuteure-le s'il se couche au vent, arrose en période sèche et surveille le criocère." },
      { m: [9], t: "Le feuillage va jaunir : prépare un sécateur propre pour la coupe d'automne." },
      { m: [10, 11], t: "Quand le feuillage est bien jaune ou brun, coupe-le à 5 cm du sol et évacue-le (pas au compost s'il porte des criocères), puis paille ou étale du compost.", alerte: true }
    ]
  },
  "narcisse": {
    note: "Les narcisses restent en place et se multiplient d'année en année.",
    soins: [
      { m: [2, 3, 4], t: "Floraison : coupe les fleurs fanées, mais laisse le feuillage jaunir seul, il nourrit le bulbe pour l'an prochain." },
      { m: [5, 6], t: "Quand le feuillage est sec, tu peux le retirer. Ne le coupe jamais encore vert." },
      { m: [9, 10], t: "Bon moment pour diviser les touffes trop serrées ou en planter de nouveaux." }
    ]
  },
  "rhubarbe": {
    note: "La rhubarbe vit des années au même endroit.",
    soins: [
      { m: [2, 3], t: "Apporte une belle couche de compost ou de fumier décomposé autour de la touffe, sans couvrir le cœur." },
      { m: [4, 5, 6], t: "Récolte en tirant les tiges d'un coup sec, jamais plus du tiers de la touffe à la fois. Coupe les hampes florales dès qu'elles apparaissent." },
      { m: [7], t: "Arrête de récolter : laisse les feuilles refaire les réserves de la plante." },
      { m: [11], t: "Quand les feuilles se flétrissent, nettoie et couvre le pied de paille ou de compost pour l'hiver." }
    ],
    ren: { ans: 6, mois: [10, 11, 2, 3], t: "La touffe vieillit et les tiges s'affinent : divise-la en plusieurs éclats, avec un bourgeon chacun, et replante les plus beaux." }
  },
  "fraise": {
    note: "Les fraisiers produisent bien environ trois ans.",
    soins: [
      { m: [3], t: "Dégage les feuilles abîmées et pose un paillis de paille : les fruits resteront propres et la terre fraîche." },
      { m: [4, 5], t: "Protège les fleurs d'un voile en cas de gelée tardive et arrose au pied, sans mouiller les fruits." },
      { m: [6], t: "Récolte régulièrement et retire les fruits abîmés pour éviter la pourriture grise." },
      { m: [7, 8], t: "Après la récolte, coupe les vieilles feuilles. Garde les stolons des pieds les plus vigoureux pour renouveler la plantation." },
      { m: [9, 10], t: "C'est le bon moment pour installer les nouveaux plants issus de stolons." }
    ],
    ren: { ans: 3, mois: [8, 9, 10, 3], t: "Vers la 3ᵉ année les fraisiers s'épuisent : replante les stolons les plus vigoureux dans une autre case, et retire les vieux pieds." }
  },
  "framboise": {
    note: "Un framboisier bien taillé produit pendant une dizaine d'années.",
    soins: [
      { m: [2, 3], t: "Rabats les remontants au ras du sol en fin d'hiver. Pour les non-remontants, garde les jeunes cannes et supprime les plus faibles : 6 à 8 par mètre suffisent." },
      { m: [4, 5], t: "Paille le pied, palisse les cannes sur le fil et arrose en cas de sécheresse." },
      { m: [7], t: "Après la récolte, coupe au ras du sol les cannes qui viennent de fructifier." },
      { m: [11], t: "Palisse les nouvelles cannes et pose un paillis de feuilles ou de broyat." }
    ],
    ren: { ans: 10, mois: [11, 2, 3], t: "Le framboisier fatigue vers 10 ans : replante des drageons sains dans un sol neuf." }
  },
  "cassis": {
    note: "Le cassissier se taille en renouvelant le vieux bois.",
    soins: [
      { m: [11, 12, 1, 2], t: "Taille hivernale : supprime les plus vieilles branches (les plus foncées) à la base et garde du bois jeune et aéré." },
      { m: [4, 5], t: "Paille le pied et arrose en cas de printemps sec : le cassis aime le frais." },
      { m: [7], t: "Récolte quand les grappes sont bien noires et brillantes." }
    ],
    ren: { ans: 15, mois: [11, 2], t: "Si la production baisse, bouture quelques branches saines en hiver pour préparer des pieds neufs." }
  },
  "myrtille": {
    note: "La myrtille adore les sols acides, comme beaucoup de sols bretons.",
    soins: [
      { m: [2, 3], t: "Taille légèrement : retire le bois mort et les branches qui se croisent." },
      { m: [4, 5, 6], t: "Arrose à l'eau de pluie (le calcaire lui nuit) et paille avec des aiguilles de pin, des copeaux ou de l'écorce." },
      { m: [7, 8], t: "Récolte au fur et à mesure et protège des oiseaux avec un filet." },
      { m: [11], t: "Renouvelle le paillis acide pour protéger les racines superficielles." }
    ]
  },
  "artichaut": {
    note: "L'artichaut reste 3 à 4 ans, puis se renouvelle par œilletons.",
    soins: [
      { m: [3, 4], t: "Dégage la souche et ne garde que 2 ou 3 œilletons vigoureux : ils donneront les têtes de l'année." },
      { m: [5, 6], t: "Récolte les têtes avant que les écailles ne s'ouvrent et arrose en cas de sécheresse." },
      { m: [11, 12], t: "Coupe les tiges fanées, bute et couvre d'un épais paillis de feuilles ou de paille : il craint le gel humide." }
    ],
    ren: { ans: 4, mois: [3, 4], t: "Les vieilles souches s'essoufflent : plante des œilletons prélevés au printemps et remplace la souche épuisée." }
  },
  "laurier": { note: "Le laurier vit très longtemps.", soins: [{ m: [3, 4], t: "Taille légère pour garder une forme compacte et limiter l'ombre sur le potager." }, { m: [8, 9], t: "Seconde taille possible ; fais sécher les feuilles à l'ombre pour la cuisine." }] },
  "verveine": { note: "Arbuste vivace un peu frileux.", soins: [
      { m: [4, 5], t: "Elle repart tard : attends les nouvelles pousses, puis rabats les tiges mortes au-dessus d'un bourgeon." },
      { m: [6, 7, 8, 9], t: "Cueille les feuilles régulièrement pour les tisanes : elle se ramifie et reste touffue." },
      { m: [11], t: "Paille épais le pied (feuilles, paille) pour le protéger du froid humide." }] },
  "thym": { aro: true, ren: { ans: 5, mois: [4, 5, 9], t: "Les vieux pieds se dégarnissent : bouture-les ou remplace-les." }, taille: [3, 4, 8] },
  "romarin": { aro: true, ren: { ans: 8, mois: [4, 5, 9], t: "Les vieux pieds se dégarnissent : bouture-les ou remplace-les." }, taille: [4, 8] },
  "sauge": { aro: true, ren: { ans: 5, mois: [4, 5, 9], t: "La sauge devient ligneuse : bouture-la ou remplace-la." }, taille: [3, 4, 8] },
  "lavande": { aro: true, ren: { ans: 8, mois: [4, 9], t: "La lavande se dégarnit avec l'âge : bouture-la ou remplace-la." }, taille: [8, 9] },
  "origan": { aro: true, ren: { ans: 5, mois: [3, 4, 9], t: "Divise la touffe pour la rajeunir." }, taille: [3, 9] },
  "estragon": { aro: true, ren: { ans: 4, mois: [3, 4], t: "Divise la touffe pour la rajeunir." }, taille: [3, 11] },
  "melisse": { aro: true, ren: { ans: 4, mois: [3, 4, 9], t: "Divise la touffe pour la rajeunir." }, taille: [3, 9] },
  "menthe": { aro: true, ren: { ans: 3, mois: [3, 4, 9], t: "La menthe s'épuise et envahit : divise la touffe, garde les jeunes pousses et contiens-la dans un pot enterré." }, taille: [3, 8] },
  "ciboulette": { aro: true, ren: { ans: 3, mois: [3, 4, 9], t: "Divise la touffe en plusieurs mottes : elle repart plus vigoureusement." }, taille: [8] },
  "achillee": { aro: true, ren: { ans: 4, mois: [3, 4, 9], t: "Divise la touffe pour la rajeunir." }, taille: [9, 10] }
};

function estPerenne(plante) { return !!(plante && VIVACES[plante.id]); }

// Nombre d'années écoulées depuis la plantation (0 = première année)
function ageEnAnnees(datePlantation) {
  if (!datePlantation) return 0;
  return Math.max(0, Math.floor(joursEntre(datePlantation, aujourdhui()) / 365.25));
}
function libelleAnnee(n) { const k = n + 1; return k === 1 ? "1re année" : k + "ᵉ année"; }

function soinsDeVivace(plante, mois) {
  const v = VIVACES[plante.id];
  if (!v) return [];
  if (v.soins) return v.soins.filter(s => s.m.includes(mois));
  if (v.taille && v.taille.includes(mois)) return [{ t: "Après la floraison, rabats légèrement pour garder un pied compact et dense. Ne coupe jamais dans le vieux bois nu." }];
  return [];
}

function conseilsVivaces(cultures) {
  const m = moisCourant();
  const vus = new Set(), conseils = [];
  const uniques = [];
  cultures.forEach(c => { if (estPerenne(c.plante) && !vus.has(c.plante.id)) { vus.add(c.plante.id); uniques.push(c); } });
  uniques.forEach(c => {
    const plante = c.plante, v = VIVACES[plante.id];
    const age = ageEnAnnees(c.datePlantation);
    const ren = v.ren && age >= v.ren.ans && v.ren.mois.includes(m);
    if (ren) {
      conseils.push({
        type: "conseil", icone: "🔁", titre: `${nomCourt(plante)} : pense à renouveler`,
        texte: `Planté en ${c.datePlantation.getFullYear()} (${libelleAnnee(age)}). ${v.ren.t}`
      });
      return;
    }
    soinsDeVivace(plante, m).slice(0, 1).forEach(s => {
      conseils.push({
        type: s.alerte ? "alerte" : "conseil", icone: iconePlante(plante),
        titre: `${nomCourt(plante)} (pérenne) : ${s.alerte ? "c'est le moment" : "le geste du mois"}`,
        texte: s.t
      });
    });
  });
  // pas plus de trois rappels pérennes à la fois, les alertes d'abord
  return conseils.sort((a, b) => (b.type === "alerte") - (a.type === "alerte")).slice(0, 3);
}

/* ---------- Santé du potager ---------- */

const PROBLEMES = [
  { id: "mildiou", nom: "Mildiou", icone: "🍂", plantes: ["tomate", "pomme-de-terre"], mois: [6, 7, 8, 9], humide: true,
    signes: "Taches brunes d'aspect huileux sur les feuilles, léger duvet blanc dessous, puis fruits et tubercules touchés.",
    prevenir: "Espace les pieds, aère, arrose au pied sans mouiller le feuillage, supprime les feuilles du bas, pose un paillis. Les tomates sous un auvent ou un abri sont bien plus épargnées.",
    agir: "Coupe et évacue aussitôt les parties atteintes (pas au compost). En prévention, le purin de prêle peut aider. Arrache un pied très atteint pour protéger les autres.",
    breton: "Les étés doux et humides bretons sont idéaux pour lui : sois vigilant après chaque série de pluies." },
  { id: "limaces", nom: "Limaces et escargots", icone: "🐌", plantes: ["salade", "chou", "chou-fleur", "haricot-vert", "courgette", "fraise", "epinard", "radis", "betterave"], mois: [3, 4, 5, 6, 9, 10], humide: true,
    signes: "Feuilles mangées avec des trous irréguliers, traînées argentées, jeunes plants coupés au ras du sol.",
    prevenir: "Évite d'arroser le soir, laisse des abris (planches) pour les ramasser, installe des barrières (cendre, coquilles broyées, laine) autour des jeunes plants.",
    agir: "Ramasse à la lampe à la tombée de la nuit, pose des pièges à bière, encourage les hérissons, crapauds et oiseaux.",
    breton: "Ce sont les ravageurs numéro un en Bretagne : protège surtout les plants fraîchement repiqués." },
  { id: "pieride", nom: "Piéride du chou", icone: "🦋", plantes: ["chou", "chou-fleur", "navet", "radis"], mois: [5, 6, 7, 8, 9], humide: false,
    signes: "Papillons blancs qui tournent autour des choux, petits œufs jaunes sous les feuilles, chenilles vert-jaune qui dévorent tout.",
    prevenir: "Un filet anti-insectes posé dès la plantation et bien fermé sur les bords est la meilleure protection. Des plantes aromatiques voisines (thym, sauge, aneth) perturbent aussi les papillons.",
    agir: "Écrase les amas d'œufs jaunes et ramasse les chenilles à la main.",
    breton: "Plusieurs générations par été : regarde sous les feuilles chaque semaine." },
  { id: "mouche-carotte", nom: "Mouche de la carotte", icone: "🪰", plantes: ["carotte"], mois: [4, 5, 6, 8, 9], humide: false,
    signes: "Feuillage qui rougit et se flétrit, galeries brunes dans les racines.",
    prevenir: "Voile anti-insectes, semis clairsemés pour éviter d'éclaircir (l'odeur attire la mouche), poireaux ou oignons en voisins. Si tu éclaircis, fais-le le soir et arrose ensuite.",
    agir: "Retire et évacue les carottes atteintes ; sème tard (juin) pour passer entre deux générations.",
    breton: "" },
  { id: "rouille", nom: "Rouille du poireau et de l'ail", icone: "🟠", plantes: ["poireau", "ail", "echalote", "oignon"], mois: [4, 5, 6, 9, 10, 11], humide: true,
    signes: "Pustules orange en relief sur les feuilles, qui jaunissent et se dessèchent.",
    prevenir: "Espace bien les plants, évite les excès d'azote, arrose le matin, respecte une rotation de quatre ans.",
    agir: "Coupe les feuilles les plus atteintes sans les mettre au compost. Un poireau touché reste comestible.",
    breton: "Fréquente avec l'humidité d'automne : ça ne dévaste pas la culture, il faut surtout garder l'air circulant." },
  { id: "oidium", nom: "Oïdium", icone: "🤍", plantes: ["courgette", "courge", "concombre", "petit-pois"], mois: [7, 8, 9], humide: false,
    signes: "Feutrage blanc comme de la farine sur les feuilles.",
    prevenir: "Espace les pieds, arrose au pied le matin, évite les excès d'azote. Un purin de prêle en prévention renforce les feuilles.",
    agir: "Supprime les feuilles très atteintes. En fin de saison, il progresse mais la récolte se poursuit.",
    breton: "" },
  { id: "pucerons", nom: "Pucerons", icone: "🐛", plantes: ["feve", "haricot-vert", "chou", "petit-pois", "capucine"], mois: [4, 5, 6, 7], humide: false,
    signes: "Colonies serrées sur les jeunes pousses, feuilles qui s'enroulent, miellat collant.",
    prevenir: "Favorise leurs ennemis : coccinelles, syrphes, mésanges. Souci, capucine et fleurs mellifères attirent les auxiliaires. Pince les têtes des fèves dès les premiers pucerons.",
    agir: "Un jet d'eau ou un peu de savon noir dilué suffit souvent. Évite les insecticides, qui tuent aussi les coccinelles.",
    breton: "" },
  { id: "criocere", nom: "Criocère de l'asperge", icone: "🪲", plantes: ["asperge"], mois: [5, 6, 7, 8, 9], humide: false,
    signes: "Petits scarabées rouge et noir sur les tiges et les turions, larves grises qui rongent le feuillage.",
    prevenir: "Coupe et évacue le feuillage sec à l'automne (les adultes y passent l'hiver). Les poules et les oiseaux aident.",
    agir: "Ramasse les adultes et secoue les larves dans un seau d'eau. Ne coupe pas les turions abîmés en pleine récolte.",
    breton: "" },
  { id: "altise", nom: "Altises", icone: "🦗", plantes: ["radis", "navet", "chou", "chou-fleur"], mois: [4, 5, 6], humide: false,
    signes: "Petits trous ronds comme des grains de plomb dans les feuilles, surtout par temps sec.",
    prevenir: "Garde le sol frais avec un arrosage régulier et un paillage, couvre d'un voile après le semis.",
    agir: "Un binage léger et un arrosage fréquent les découragent.",
    breton: "" },
  { id: "doryphore", nom: "Doryphore", icone: "🐞", plantes: ["pomme-de-terre"], mois: [5, 6, 7], humide: false,
    signes: "Scarabées rayés jaune et noir et larves orangées qui dévorent les feuilles.",
    prevenir: "Paillage épais, rotation, et surveillance dès la sortie des plants.",
    agir: "Ramasse adultes, larves et amas d'œufs orangés sous les feuilles : à la main, c'est très efficace sur un petit potager.",
    breton: "" },
  { id: "botrytis", nom: "Pourriture grise (botrytis)", icone: "🍓", plantes: ["fraise", "framboise"], mois: [5, 6, 7], humide: true,
    signes: "Fruits recouverts d'un duvet gris, qui pourrissent rapidement.",
    prevenir: "Pose un paillis de paille sous les fruits, aère les touffes, arrose au pied le matin.",
    agir: "Cueille les fruits touchés tout de suite et évacue-les, sans les laisser sur le sol.",
    breton: "Les printemps pluvieux la favorisent : la paille fait toute la différence." },
  { id: "hernie", nom: "Hernie du chou", icone: "🥦", plantes: ["chou", "chou-fleur", "navet", "radis"], mois: [4, 5, 6, 7, 8, 9], humide: true,
    signes: "Plants qui se flétrissent par grande chaleur, racines déformées en grosses boules.",
    prevenir: "Elle aime les sols acides et mal drainés. Un chaulage léger avant l'hiver et une rotation d'au moins 4 ans sans crucifères la limitent beaucoup.",
    agir: "Arrache et évacue les pieds atteints sans les composter.",
    breton: "Les sols bretons sont souvent acides : pense au calcaire (maërl, chaux) pour les choux." }
];

// Problèmes à surveiller maintenant, classés (plantes présentes chez toi d'abord, météo douce et humide en bonus)
function problemesDuMoment(cultures, mois = moisCourant()) {
  const presentes = new Set(cultures.map(c => c.plante.id));
  const jours = typeof joursMeteoValides === "function" ? joursMeteoValides() : null;
  const humide = !!(jours && jours.slice(0, 4).some(j => j.pluie >= 2) && jours.slice(0, 4).every(j => j.tmin >= 5));
  return PROBLEMES.filter(p => p.mois.includes(mois)).map(p => {
    const chezMoi = p.plantes.filter(id => presentes.has(id));
    const souci = typeof prefsJardin === "function" && prefsJardin().soucis.some(x => p.id === x || (x === "pucerons" && p.id === "pucerons"));
    return { p, chezMoi, score: (chezMoi.length ? 10 : 0) + (humide && p.humide ? 3 : 0) + chezMoi.length + (souci ? 6 : 0), humideAujourdhui: humide && p.humide };
  }).sort((a, b) => b.score - a.score);
}

function conseilsSante(cultures) {
  // Limaces et oiseaux : rappels dédiés au bon moment (saison.js) quand ce sont tes soucis
  const dedies = typeof conseilsDefense === "function" && typeof prefsJardin === "function" ? prefsJardin().soucis.filter(s => ["limaces", "oiseaux"].includes(s)) : [];
  return problemesDuMoment(cultures).filter(x => x.chezMoi.length && !dedies.includes(x.p.id)).slice(0, 2).map(x => {
    const noms = x.chezMoi.map(id => nomCourt(planteParId(id)).toLowerCase());
    return {
      type: "conseil", icone: x.p.icone,
      titre: `À surveiller : ${x.p.nom.toLowerCase()} sur ${listeFr(noms.slice(0, 3))}`,
      texte: `${x.humideAujourdhui ? "Le temps doux et humide lui convient. " : ""}${x.p.prevenir}`,
      action: { label: "Voir la fiche", vue: "saisons", sousVue: "sante" }
    };
  });
}

function rendreSante(zone) {
  const cultures = listerCultures();
  const liste = problemesDuMoment(cultures);
  const toutes = PROBLEMES.filter(p => !liste.some(x => x.p === p));
  const nomsPlantes = ids => listeFr(ids.map(id => { const pl = planteParId(id); return pl ? nomCourt(pl).toLowerCase() : id; }).slice(0, 5));
  const moisTexte = p => { const noms = p.mois.map(i => MOIS_NOMS[i - 1]); return noms.length > 3 ? `de ${noms[0]} à ${noms[noms.length - 1]}` : listeFr(noms); };
  const fiche = (p, chezMoi, humideAujourdhui) => `
    <details class="carte sante" data-k="s${p.id}"${ui.ouverts.has("s" + p.id) ? " open" : ""}>
      <summary><span class="sa-nom">${p.icone} ${esc(p.nom)}</span>${chezMoi && chezMoi.length ? `<span class="tag-info">Chez toi</span>` : ""}${humideAujourdhui ? `<span class="tag-urgent">Temps favorable</span>` : ""}</summary>
      <p class="sa-sous">Plutôt ${esc(moisTexte(p))} · ${esc(nomsPlantes(p.plantes))}</p>
      <h4>Comment le reconnaître</h4><p>${esc(p.signes)}</p>
      <h4>Prévenir</h4><p>${esc(p.prevenir)}</p>
      <h4>Si ça arrive</h4><p>${esc(p.agir)}</p>
      ${p.breton ? `<p class="sa-breton">🌧️ ${esc(p.breton)}</p>` : ""}
    </details>`;
  const maintenant = liste.filter(x => x.chezMoi.length), voisines = liste.filter(x => !x.chezMoi.length);
  zone.innerHTML = `
    <section class="carte carte-coach3">
      <div class="carte-titre"><h2>Santé du potager</h2></div>
      <p class="intro-coach">Les maladies et ravageurs les plus courants en Bretagne : quand ils arrivent, comment les reconnaître, et surtout comment les prévenir sans produits agressifs. Un potager varié, aéré et paillé en limite déjà beaucoup.</p>
    </section>
    <h3 class="sous-titre-section">À surveiller en ce moment chez toi</h3>
    ${maintenant.length ? maintenant.map(x => fiche(x.p, x.chezMoi, x.humideAujourdhui)).join("") : `<section class="carte"><p class="vide">Rien de particulier à surveiller sur tes cultures en ce moment.</p></section>`}
    ${voisines.length ? `<h3 class="sous-titre-section">Ce mois-ci au jardin</h3>${voisines.map(x => fiche(x.p, [], x.humideAujourdhui)).join("")}` : ""}
    <h3 class="sous-titre-section">Les autres, en dehors de la saison</h3>
    ${toutes.map(p => fiche(p, [], false)).join("")}`;
  zone.querySelectorAll("details[data-k]").forEach(d => d.addEventListener("toggle", () => {
    if (d.open) ui.ouverts.add(d.dataset.k); else ui.ouverts.delete(d.dataset.k);
  }));
}

/* ---------- Arrosage et météo ---------- */

function joursPassesMeteo() {
  const lieu = etat.reglages.lieu;
  if (!lieu || !meteo || !meteo.jours) return [];
  if (meteo.cle !== lieu.lat.toFixed(2) + "," + lieu.lon.toFixed(2)) return [];
  const auj = isoLocal();
  return meteo.jours.filter(j => j.date < auj).slice(-7);
}

function conseilsEau(cultures) {
  const jours = joursMeteoValides();
  if (!jours || !cultures.length) return [];
  const m = moisCourant();
  const conseils = [];
  const passes = joursPassesMeteo();
  const proche = jours.slice(0, 3);
  const pluieProche = proche.slice(0, 2).reduce((s, j) => s + j.pluie, 0);
  const pluiePassee = passes.reduce((s, j) => s + j.pluie, 0);
  const jeunes = cultures.filter(c => joursEntre(c.datePlantation, aujourdhui()) <= 30 && !estPerenne(c.plante));
  const gourmandes = cultures.filter(c => ["tomate", "courgette", "courge", "concombre", "poivron", "haricot-vert", "salade"].includes(c.plante.id));
  const fruitiers = cultures.filter(c => c.plante.categorie === "fruit" || ["asperge", "artichaut"].includes(c.plante.id));
  const saison = m >= 4 && m <= 9;

  if (saison && passes.length >= 4 && pluiePassee < 3 && pluieProche < 3) {
    const qui = [];
    if (jeunes.length) qui.push("tes plantations récentes, qui n'ont pas encore de racines profondes");
    if (gourmandes.length) qui.push(`les cultures gourmandes en eau (${listeFr([...new Set(gourmandes.map(c => nomCourt(c.plante).toLowerCase()))].slice(0, 3))})`);
    if (fruitiers.length) qui.push("les petits fruits en pleine formation");
    conseils.push({
      type: "conseil", icone: "💧", titre: "Plus de pluie depuis plusieurs jours",
      texte: `Le sol s'est asséché. ${qui.length ? "Pense d'abord à " + listeFr(qui) + ". " : ""}Arrose au pied${typeof prefsJardin === "function" && prefsJardin().recuperateur ? " avec l'eau du récupérateur (elle est à bonne température et sans calcaire)" : ""}, copieusement mais pas tous les jours (l'eau descend alors vers les racines), tôt le matin ou le soir. Un binage vaut deux arrosages, et un paillis garde la fraîcheur${typeof prefsJardin === "function" && prefsJardin().recuperateur ? " : ton récupérateur durera plus longtemps" : ""}.`
    });
  }
  if (saison && pluieProche >= 4) {
    conseils.push({
      type: "conseil", icone: "🌧️", titre: "De la pluie est annoncée",
      texte: "Garde l'arrosoir au chaud : inutile d'arroser avant l'averse." + (typeof prefsJardin === "function" && prefsJardin().recuperateur ? " Vérifie que le récupérateur est bien raccordé et que son trop-plein s'évacue." : "") + " Profites-en pour arracher les herbes, la terre est meuble."
    });
  }
  const chaud = proche.find(j => j.tmax >= 28);
  if (saison && chaud) {
    conseils.push({
      type: "alerte", icone: "🔥", titre: `Forte chaleur ${nomJour(chaud.date)}`,
      texte: "Arrose le soir, surtout les jeunes plants. Ombre légère (voile d'ombrage, claie) pour salades et épinards, et ne taille ni ne désherbe en plein soleil. Cueille les salades tôt le matin."
    });
  }
  const forte = proche.find(j => j.pluie >= 12);
  if (forte) {
    conseils.push({
      type: "alerte", icone: "⛈️", titre: `Forte pluie annoncée ${nomJour(forte.date)}`,
      texte: "Ne marche pas sur les planches une fois le sol détrempé (il se tasse). Récolte avant l'averse ce qui peut éclater (tomates mûres, salades pommées) et vérifie que l'eau s'évacue des allées."
    });
  }
  return conseils;
}

/* ---------- Refaire comme l'an dernier ---------- */

function saisonReference() { return moisCourant() >= 7 ? new Date().getFullYear() : new Date().getFullYear() - 1; }

function culturesDeSaison(annee) {
  const groupes = new Map();
  const ajouter = (planteId, dateStr, parcelle) => {
    const plante = planteParId(planteId), d = parseDate(dateStr);
    if (!plante || !d || d.getFullYear() !== annee || estPerenne(plante)) return;
    if (!groupes.has(planteId)) groupes.set(planteId, { plante, mois: {}, lieux: new Set() });
    const g = groupes.get(planteId);
    g.mois[d.getMonth() + 1] = (g.mois[d.getMonth() + 1] || 0) + 1;
    g.lieux.add(parcelle.nom);
  };
  etat.parcelles.forEach(p => {
    p.historique.forEach(h => ajouter(h.planteId, h.debut, p));
    Object.keys(p.cases).forEach(coord => (p.cases[coord] || []).forEach(c => ajouter(c.planteId, c.datePlantation, p)));
  });
  return [...groupes.values()].map(g => {
    const mois = +Object.entries(g.mois).sort((a, b) => b[1] - a[1])[0][0];
    return { ...g, moisPlante: mois };
  }).sort((a, b) => a.moisPlante - b.moisPlante || a.plante.nom.localeCompare(b.plante.nom, "fr"));
}

// Mois conseillé pour refaire la culture (le mois d'origine, ou le plus proche dans la fenêtre de la plante)
function moisPourRefaire(plante, mois) {
  const ok = [...moisPourPlante(plante)];
  if (!ok.length) return null;
  if (ok.includes(mois)) return mois;
  const dist = (a, b) => Math.min((a - b + 12) % 12, (b - a + 12) % 12);
  return ok.sort((a, b) => dist(a, mois) - dist(b, mois))[0];
}
function cleProchaineOccurrence(mois) {
  const an = new Date().getFullYear();
  return cleMois(mois > moisCourant() ? an : an + 1, mois);
}

function lignesRefaire() {
  const an = saisonReference();
  return culturesDeSaison(an).map(g => {
    const mois = moisPourRefaire(g.plante, g.moisPlante);
    if (!mois) return null;
    const cle = cleProchaineOccurrence(mois);
    const rotation = g.plante.categorie === "legume" && !ROTATION_IGNORED_FAMILIES.includes(g.plante.famille);
    return { ...g, mois, cle, rotation, deja: !!projetDe(g.plante.id, cle) };
  }).filter(Boolean);
}

function carteRefaireHTML() {
  const an = saisonReference();
  const lignes = lignesRefaire();
  if (!lignes.length) {
    return `<section class="carte"><div class="carte-titre"><h2>Refaire comme l'an dernier</h2></div>
      <p class="texte-doux">Dès que tu auras planté des cultures cette saison (et terminé certaines avec « Fin de culture »), je te proposerai de les refaire d'un clic l'année suivante, au bon moment et avec un conseil de rotation.</p></section>`;
  }
  const restants = lignes.filter(l => !l.deja).length;
  return `<section class="carte" id="rf-carte">
    <div class="carte-titre"><h2>Refaire comme en ${an}</h2><span class="carte-sous-titre">${restants ? restants + " à prévoir" : "tout est prévu"}</span></div>
    <p class="texte-doux petit">Voici ce que tu as cultivé en ${an}. Je te propose de le prévoir au même moment de l'année : tu pourras ensuite retirer ou changer ce que tu veux.</p>
    ${lignes.map(l => `
      <div class="refaire">
        <div class="rf-corps">
          <div class="rf-titre">${ico(l.plante, "1.4em")} ${esc(l.plante.nom)} <small>${esc(MOIS_NOMS[l.mois - 1])}</small></div>
          <div class="rf-detail">${esc([...l.lieux].join(", "))}${l.rotation ? " · mets-la plutôt dans une autre parcelle (rotation)" : ""}</div>
        </div>
        <button class="btn-petit${l.deja ? " prevu" : ""}" data-prevoir="${l.plante.id}|${l.cle}" aria-pressed="${l.deja}">${l.deja ? "✓ Prévu" : "＋ Prévoir"}</button>
      </div>`).join("")}
    ${restants ? `<button class="btn" id="rf-tout" style="margin-top:0.8rem">Tout prévoir (${restants})</button>` : ""}
  </section>`;
}

function brancherRefaire(zone) {
  const b = zone.querySelector("#rf-tout");
  if (!b) return;
  b.addEventListener("click", () => {
    const aAjouter = lignesRefaire().filter(l => !l.deja);
    if (!aAjouter.length) return;
    avecAnnulation(`${aAjouter.length} culture${aAjouter.length > 1 ? "s" : ""} ajoutée${aAjouter.length > 1 ? "s" : ""} à ton année.`, () => {
      aAjouter.forEach(l => etat.projets.push({ id: creerId(), planteId: l.plante.id, mois: l.cle, fait: false }));
    });
  });
}

/* ---------- Apparence : thème et taille du texte ---------- */

const CLE_ASPECT = "potagerBretonAspect";   // propre à chaque appareil, non synchronisé
const TAILLES_TEXTE = { normal: "16px", grand: "18.5px", "tres-grand": "21px" };

function lireAspect() {
  try { return Object.assign({ theme: "auto", texte: "normal" }, JSON.parse(localStorage.getItem(CLE_ASPECT) || "{}")); }
  catch (e) { return { theme: "auto", texte: "normal" }; }
}
function appliquerAspect() {
  const a = lireAspect();
  const racine = document.documentElement;
  if (a.theme === "auto") racine.removeAttribute("data-theme"); else racine.setAttribute("data-theme", a.theme);
  racine.style.fontSize = TAILLES_TEXTE[a.texte] || TAILLES_TEXTE.normal;
  const sombre = a.theme === "sombre" || (a.theme === "auto" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", sombre ? "#141a11" : "#26331f");
}
function carteAspectHTML() {
  const a = lireAspect();
  const choix = (cle, valeur, label) => `<button class="chip${a[cle] === valeur ? " actif" : ""}" data-aspect="${cle}|${valeur}" aria-pressed="${a[cle] === valeur}">${label}</button>`;
  return `<section class="carte" id="rg-aspect">
    <div class="carte-titre"><h2>Apparence</h2></div>
    <p class="texte-doux petit">Pour lire facilement au jardin, en plein soleil ou le soir. Ce réglage est propre à cet appareil.</p>
    <h3 class="sous-titre-section">Thème</h3>
    <div class="chips">${choix("theme", "auto", "Automatique")}${choix("theme", "clair", "☀️ Clair")}${choix("theme", "sombre", "🌙 Sombre")}</div>
    <h3 class="sous-titre-section">Taille du texte</h3>
    <div class="chips">${choix("texte", "normal", "Normal")}${choix("texte", "grand", "Grand")}${choix("texte", "tres-grand", "Très grand")}</div>
  </section>`;
}
function brancherAspect(zone) {
  zone.querySelectorAll("[data-aspect]").forEach(b => b.addEventListener("click", () => {
    const [cle, valeur] = b.dataset.aspect.split("|");
    const a = lireAspect(); a[cle] = valeur;
    try { localStorage.setItem(CLE_ASPECT, JSON.stringify(a)); } catch (e) {}
    appliquerAspect();
    zone.querySelector("#rg-aspect").outerHTML = carteAspectHTML();
    brancherAspect(zone);
  }));
}
appliquerAspect();
if (window.matchMedia) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  if (mq.addEventListener) mq.addEventListener("change", appliquerAspect);
}

/* ---------- Aperçu d'une case au toucher (avant l'éditeur complet) ---------- */

function phraseEtatCulture(plante, inf, contenu) {
  if (!inf) return "";
  const f = inf.fenetre;
  switch (inf.statut) {
    case "retard": return "Récolte en retard ? Va voir si c'est encore bon.";
    case "recolter": return f ? `Prêt à récolter, jusqu'au ${formatDate(f.fin)} environ.` : "Prêt à récolter.";
    case "cueillette": return "En saison de récolte : cueille au fur et à mesure.";
    case "cueillette-libre": return "À cueillir selon tes besoins.";
    case "bientot": return f ? `Bientôt prêt, vers le ${formatDate(f.debut)}.` : "Bientôt prêt.";
    case "a-venir": return f ? `En train de pousser : récolte vers ${MOIS_NOMS[f.debut.getMonth()]}.` : "En train de pousser.";
    default: return estPerenne(plante) ? `Pérenne, ${libelleAnnee(ageEnAnnees(inf.datePlantation))}.` : `En place depuis le ${formatDate(contenu.datePlantation)}.`;
  }
}

async function ajouterPhotosCulture(parcelle, contenu, fichiers) {
  const pl = planteParId(contenu.planteId);
  const photos = [];
  for (const f of [...fichiers].slice(0, 6)) { try { photos.push(await enregistrerPhoto(f)); } catch (e) { toast("Une photo n'a pas pu être enregistrée."); } }
  if (!photos.length) return false;
  etat.journal.unshift({ id: creerId(), date: isoLocal(), type: "note", planteId: contenu.planteId, parcelleId: parcelle.id, texte: `Suivi : ${pl.nom} (${parcelle.nom})`, photos });
  sauvegarder();
  toast(`Photo ajoutée au suivi de ${nomCourt(pl)}.`);
  return true;
}

// Ce qu'on pourrait mettre dans une case libre maintenant
function ideesPourCase(parcelle, x, y) {
  const m = moisCourant(), coord = x + "-" + y;
  return PLANTS_DB.filter(p => moisPourPlante(p).has(m)).map(p => {
    const v = voisinage(parcelle, x, y, p.id);
    const rot = verifierRotation(parcelle, coord, p.id);
    const ombre = typeof ensoleillementCase === "function" ? scoreEnsoleillement(p, ensoleillementCase(parcelle, coord)) : 0;
    const score = v.amis.length * 2 - v.ennemis.length * 6 - (rot ? 3 : 0) + (p.categorie === "legume" ? 1.5 : 0) + (estDernierMois(p, m) ? 1 : 0) + ombre;
    return { p, score, amis: v.amis };
  }).filter(s => s.score >= 0).sort((a, b) => b.score - a.score || a.p.nom.localeCompare(b.p.nom, "fr")).slice(0, 5);
}

function ouvrirApercuCase(parcelleId, x, y) {
  const parcelle = etat.parcelles.find(p => p.id === parcelleId);
  if (!parcelle) return;
  const coord = x + "-" + y;
  const cultures = culturesDe(parcelle, coord);
  const prot = protectionDe(parcelle, coord);
  const m = moisCourant();
  const blocs = cultures.map(c => {
    const pl = planteParId(c.planteId);
    if (!pl) return "";
    const inf = infosCulture(parcelle, coord, c);
    const soin = estPerenne(pl) ? (soinsDeVivace(pl, m)[0] || {}).t : null;
    const geste = soin || pl.conseilCourt;
    const photos = photosDeCulture(c.planteId, parcelle.id, 4);
    return `<div class="ap-culture">
      <div class="ap-ico">${ico(pl, 52)}</div>
      <div class="ap-corps">
        <div class="ap-nom">${esc(pl.nom)}${c.notes ? ` <small>${esc(c.notes)}</small>` : ""}</div>
        <div class="ap-etat">${esc(phraseEtatCulture(pl, inf, c))}</div>
        ${geste ? `<p class="ap-geste">💡 ${esc(geste)}</p>` : ""}
        ${photos.length ? `<div class="photos-entree">${photos.map(p => `<button class="photo-mini" data-photo="${p.id}" data-entree="${p.entree}" aria-label="Voir la photo du ${esc(formatDate(p.date))}"><img alt="" data-photo-img="${p.id}"></button>`).join("")}</div>` : ""}
        <div class="ap-actions">
          <label class="btn-discret bouton-fichier">📷 Photo<input type="file" accept="image/*" data-ap-photo="${c.id}" hidden></label>
          <button class="btn-discret" data-fiche="${pl.id}">Fiche</button>
        </div>
      </div>
    </div>`;
  }).join("");
  const idees = cultures.length ? [] : ideesPourCase(parcelle, x, y);
  const soleil = typeof ensoleillementCase === "function" && reglagesJardin().arbres.length ? ensoleillementCase(parcelle, coord) : null;
  ouvrirFenetre(`
    <h2>${esc(parcelle.nom)} <small class="texte-doux">case ${x + 1}${parcelle.hauteur > 1 ? "-" + (y + 1) : ""}</small></h2>
    ${cultures.length ? blocs : `<p class="texte-doux">Case libre${prot ? ` · ${esc(PROTECTIONS[prot.type].label.toLowerCase())} posé` : ""}.</p>
      ${idees.length ? `<h3 class="sous-titre-section">Idées pour cette case en ${MOIS_NOMS[m - 1]}</h3>
      <div class="chips">${idees.map(s => `<button class="chip" data-planter="${s.p.id}" title="${s.amis.length ? "Bon voisin de " + esc(listeFr(s.amis.slice(0, 2))) : ""}">${ico(s.p, "1.4em")} ${esc(nomCourt(s.p))}</button>`).join("")}</div>` : ""}`}
    ${soleil ? `<p class="texte-doux petit ap-soleil">${esc(libelleEnsoleillement(soleil))}${soleil.niveau !== "soleil" ? " : préfère les plantes qui aiment la mi-ombre (salades, épinards, persil, menthe, fraisiers…)." : "."}</p>` : ""}
    ${cultures.length && prot ? `<p class="texte-doux petit">${PROTECTIONS[prot.type].icone} ${esc(PROTECTIONS[prot.type].label)} posé sur la case.</p>` : ""}
    <div class="actions-fenetre">
      ${cultures.length ? `<button class="btn" id="ap-modifier">Modifier, récolter…</button><button class="btn-discret" id="ap-planter">＋ Ajouter ici</button>`
        : `<button class="btn" id="ap-planter">＋ Planter ici</button><button class="btn-discret" id="ap-modifier">Plus d'options</button>`}
      <button class="btn-discret" id="ap-fermer">Fermer</button>
    </div>`, fen => {
    const rouvrir = () => ouvrirApercuCase(parcelleId, x, y);
    fen.querySelector("#ap-fermer").addEventListener("click", fermerFenetre);
    fen.querySelector("#ap-modifier").addEventListener("click", () => ouvrirEditeurCase(parcelleId, x, y));
    fen.querySelectorAll("[data-planter]").forEach(b => b.addEventListener("click", () => ouvrirAjoutCulture({ planteId: b.dataset.planter, parcelleId, coord })));
    fen.querySelector("#ap-planter").addEventListener("click", () => ouvrirAjoutCulture({ parcelleId, coord }));
    fen.querySelectorAll("[data-fiche]").forEach(b => b.addEventListener("click", () => ouvrirFichePlante(b.dataset.fiche, rouvrir)));
    chargerMiniatures(fen);
    fen.querySelectorAll("[data-photo]").forEach(b => b.addEventListener("click", () => ouvrirPhoto(b.dataset.photo, b.dataset.entree, rouvrir)));
    fen.querySelectorAll("[data-ap-photo]").forEach(inp => inp.addEventListener("change", async () => {
      const c = cultures.find(k => k.id === inp.dataset.apPhoto);
      if (c && await ajouterPhotosCulture(parcelle, c, inp.files)) rouvrir();
    }));
  });
}
