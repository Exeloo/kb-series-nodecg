# KB SERIES × Valorant — régie et overlays

Habillage du tournoi Valorant **KB SERIES** pour OBS : 20 overlays 1920×1080, réunis dans une seule page pour OBS, et une régie web pour tout piloter en direct.
Le projet tourne sur ton PC avec [NodeCG](https://www.nodecg.dev/) ; aucune connaissance technique n'est nécessaire pour l'utiliser.

## Démarrage rapide
Prérequis : Windows, [Node.js 24 LTS](https://nodejs.org), Google Chrome, Microsoft Edge ou Mozilla Firefox.

1. Double-clique sur **`start.bat`**. Au premier lancement, il installe tout (1 à 3 minutes, Internet nécessaire).
2. La régie s'ouvre toute seule dans ton navigateur : **http://localhost:9090**
3. Pour arrêter : ferme la fenêtre noire.

Détails, mise à jour, accès depuis un autre PC : [docs/INSTALLATION.md](docs/INSTALLATION.md).

## OBS en 30 secondes
Une seule source **Navigateur** : `http://localhost:9090/bundles/valorant-tournament/graphics/stream.html`
- largeur **1920**, hauteur **1080** ;
- ne coche **pas** l'arrêt de la source quand elle n'est pas visible, ni l'actualisation quand la scène devient active ;
- fréquence d'images : celle de ton stream.

Scènes d'attente, overlays et transition se pilotent ensuite depuis la **Régie**. Guide complet : [docs/OBS.md](docs/OBS.md).

## Les panneaux
| Panneau (titre exact) | Onglet | À quoi il sert |
|---|---|---|
| **Régie · tout afficher / masquer** | Main Workspace | Le direct : transition, scène de fond, AFFICHER / masquer chaque overlay, plateau host / casters, lower thirds rapides |
| **Live · score de série** | Main Workspace | Score de la série (+1 / −1, inverser gauche / droite) |
| **Lower thirds · plateau, presets, intervenants** | Main Workspace | Plateau host / casters, lower thirds gauche / centre / droite et presets, liste host et casters |
| **Ticker défilant** | Main Workspace | Ticker du bas d'écran : affichage, messages, vitesse, partenaires |
| **Écran 50/50 (dual-cam)** | Main Workspace | Labels des deux moitiés, bandeau du match, coordonnées des caméras |
| **Maps & Transitions** | Main Workspace | Transition : aperçu, réglages, export PNG ; intro, série et résultat de map |
| **Équipes & Joueurs** | 1. Match & Joueurs | Équipes, joueurs, fiches, import tracker.gg |
| **Match (maps, scores, agents)** | 1. Match & Joueurs | Équipes du match, format, maps, scores, agents joués |
| **Veto des maps** | 1. Match & Joueurs | Veto en direct : bans, picks, côtés ; liens à envoyer aux équipes pour qu'elles le jouent elles-mêmes |
| **Stats Joueur · fiche et duel** | 1. Match & Joueurs | Fiche stats d'un joueur, duel entre deux joueurs |
| **Planning de la journée** | 2. Écrans & Tournoi | Matchs du jour en créneaux d'une heure, phases (poules → grande finale), diffusés ou non, lancement du match sur le stream ; lié au bracket et au match en cours |
| **Écrans (attente, pause, fin)** | 2. Écrans & Tournoi | Compte à rebours, textes des écrans, infos du tournoi |
| **Bracket & Groupes** | 2. Écrans & Tournoi | Classement des groupes et phase finale |
| **Données · sauvegarde, import, réglages** | 3. Données | Exporter / importer, sauvegardes, données de test, réinitialisation, jeton Bitfocus Companion, deux régies (en ligne ↔ sur place) |
| **Companion · boutons et API** | Companion (onglet plein écran) | Boutons Bitfocus Companion prêts à copier (URL, en-tête, corps), constructeur et test de chaque route, référence de l'API |

Visite guidée, bouton par bouton : [docs/REGIE.md](docs/REGIE.md).

## Les overlays
Avec `stream.html`, tu n'as besoin d'aucune autre URL. Chaque overlay reste disponible seul : `http://localhost:9090/bundles/valorant-tournament/graphics/<fichier>`.

| Fichier | Usage | Panneau |
|---|---|---|
| `stream.html` | **Toutes les couches en une source** | Régie |
| `starting.html` | Le stream commence bientôt + compte à rebours | Écrans ; Régie (scène **Bientôt**) |
| `brb.html` | Pause | Écrans ; Régie (scène **Pause**) |
| `ending.html` | Fin de stream, résultats du jour | Écrans ; Régie (scène **Fin**) |
| `schedule.html` | Planning de la journée, en scène de fond | Planning ; Régie (scène **Planning**) |
| `dual-cam.html` | Écran 50/50, deux trous caméra | Écran 50/50 ; Régie (scène **50/50 caméras**) |
| `transition.html` | Transition (stinger), au-dessus de tout | Régie, Maps & Transitions |
| `lower-third.html` | 3 lower thirds, gauche, centre et droite (transparent) : host, casters, annonces | Lower thirds, Régie |
| `ticker.html` | Bandeau défilant en bas (transparent) | Ticker défilant, Régie |
| `replay-bug.html` | Bug « REPLAY » en haut à droite, pendant un ralenti (transparent) | Régie |
| `versus.html` | Présentation du match + rosters | Match, Veto des maps, Régie |
| `veto.html` | Veto des maps en direct | Veto des maps, Match, Régie |
| `veto-recap.html` | Récap : ordre des maps, picks, côtés | Veto des maps, Match, Régie |
| `map-intro.html` | Intro de map + rosters des deux équipes | Maps & Transitions, Régie |
| `map-series.html` | Maps de la série | Maps & Transitions, Régie |
| `map-result.html` | Résultat de map + MVP | Maps & Transitions, Régie |
| `player-stats.html` | Stats d'un joueur (vue générale ou performances par rôle) | Stats Joueur, Régie |
| `player-duel.html` | Duel joueur contre joueur | Stats Joueur, Régie |
| `planning.html` | Planning de la journée, overlay plein écran (même rendu que la scène) | Planning, Régie |
| `groups.html` | Classement des groupes | Bracket & Groupes, Régie |
| `bracket.html` | Arbre de la phase finale | Bracket & Groupes, Régie |

## Mes données
Tout s'enregistre tout seul sur ton PC (dossiers `db/` et `assets/`), et une sauvegarde est faite avant chaque opération qui efface.
Pour garder une copie ou changer de PC : panneau **Données** → **⬇ Exporter mes données**. Détails : [docs/DONNEES.md](docs/DONNEES.md).

## Un problème ?
[docs/DEPANNAGE.md](docs/DEPANNAGE.md) : symptôme → cause → solution.

## Aller plus loin
- [docs/JOUR-DE-MATCH.md](docs/JOUR-DE-MATCH.md) : checklist imprimable, de la veille au soir.
- [docs/DEPLOIEMENT.md](docs/DEPLOIEMENT.md) : mettre la régie en ligne (Railway, serveur perso), et la relier à une régie sur place qui sert les overlays sans délai.
- [docs/COMPANION.md](docs/COMPANION.md) : piloter la régie depuis un Stream Deck avec Bitfocus Companion (API HTTP) ; la même chose, avec les valeurs prêtes à copier, dans l'onglet **Companion** du tableau de bord.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) : fonctionnement du code (développeurs, agents IA).
- [tools/tracker-extension/README.md](tools/tracker-extension/README.md) : extension d'import tracker.gg (Chrome, Edge, Firefox).

Commandes, dans un terminal ouvert dans le dossier du projet : `npm start` (ce que fait `start.bat`), `npm run dev` (redémarre seul quand `extension/` change),
`npm run lint`, `npm run check` (ouvre toutes les pages et signale les erreurs ; serveur lancé), `npm run verify` (les deux),
`npm run shot -- <url> <sortie.png>`, `npm run export:stinger` (serveur lancé), `npm run pack:extension` (extension tracker.gg à faire signer pour Firefox).

## Dossiers
| Dans git (le code) | Reste sur ton PC (jamais envoyé sur GitHub) |
|---|---|
| `dashboard/` panneaux · `graphics/` overlays · `extension/` serveur · `shared/` code commun, thème, polices · `tools/` outils · `cfg/` configuration · `docs/` | `db/` tes données · `assets/` logos et photos · `exports/` transitions en PNG · `shots/` captures · `Medias/` affiche et logo de référence · `logs/` · `node_modules/` |
