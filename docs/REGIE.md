# La régie, panneau par panneau

Pour le régisseur : à quoi sert chaque panneau, section par section, dans l'ordre des onglets ; puis l'import des joueurs depuis tracker.gg, pas à pas.

La régie s'ouvre sur http://localhost:9090. Les onglets sont en haut : **MAIN WORKSPACE**, **1. MATCH & JOUEURS**, **2. ÉCRANS & TOURNOI**, **3. DONNÉES**. En haut à droite, **ASSETS** sert à envoyer les logos et les photos (voir [Équipes & Joueurs](#équipes--joueurs)).

## Le vocabulaire commun
| À l'écran | Signification |
|---|---|
| **AFFICHER** | L'overlay est masqué. Un clic l'affiche à l'antenne. |
| **● À L'ANTENNE** | L'overlay est à l'antenne. Un clic le masque. La pastille devant son nom est allumée. |
| Bouton grisé | L'overlay n'a rien à montrer (ex. **Stats joueur** sans joueur choisi). |
| **Tout masquer** | Masque les overlays du panneau (ou de la section). N'efface aucune donnée. |
| Confirmation en 2 clics | Tout bouton qui efface ou remplace des données change de texte au 1er clic (ex. « Supprimer ? », « Effacer tout le veto ? »). Reclique dans les secondes qui suivent pour confirmer ; sinon il revient à son état normal et rien ne se passe. |
| « Modifications non appliquées » / « Modifications non enregistrées » | Tu as modifié un formulaire (lower third, ticker, host et casters) sans l'envoyer à l'antenne. Clique **Mettre à jour** ou **Enregistrer**. Tant qu'un champ est modifié, ce qui vient d'un autre panneau ne l'écrase pas. |

Les autres champs (textes des écrans, scores, réglages de la transition…) s'enregistrent tout seuls dès que tu les changes.

### Un seul plein écran à la fois
Case **Un seul plein écran à la fois (masque les autres automatiquement)**, dans la Régie, cochée par défaut : afficher un overlay plein écran (versus, veto, maps, joueurs, groupes, bracket) masque les autres plein écran. Les lower thirds, le ticker et le bug Replay ne sont pas concernés. Ce choix est mémorisé dans ce navigateur et vaut pour tous les panneaux.

### Transition des plein écran
Case **Transition (stinger) pour entrer, sortir et passer d'un plein écran à l'autre**, dans la Régie, décochée par défaut. Cochée, afficher ou masquer un overlay plein écran, depuis n'importe quel panneau ou Companion, joue le stinger (logo) et fait le changement quand il couvre l'écran (environ 1 s après le clic). Passer d'un plein écran à un autre (ex. Maps de la série → Récap du veto) = un seul stinger. Le réglage est commun à toute la régie et à Companion. Restent immédiats : **Tout masquer** (qui annule aussi un plein écran en attente de son stinger), les scènes de fond et l'action **Vers** d'une transition lancée à la main (déjà sous un stinger).

---

## MAIN WORKSPACE

### Régie · tout afficher / masquer
Le panneau du direct. Il ne touche jamais aux données.
- **Match en cours** : équipes, score de la série, phase, format, map en cours et son score.
- **Transition** : **1. Type** (**Logo seul**, **Logo + map** avec le menu de la map, ou **Replay** : titre « REPLAY » pour lancer ou quitter un ralenti), **2. Vers** (ce qui se passe quand l'écran est couvert : rien, **Tout masquer · retour au jeu**, une scène de fond ou un overlay plein écran), puis **▶ LANCER LA TRANSITION**. La ligne en dessous rappelle la durée et le point de coupe (réglables dans Maps & Transitions).
  **Ralenti** en un clic : **▶ Replay + bug** (transition replay, puis le bug « REPLAY » en haut à droite apparaît écran couvert) et **■ Fin du replay** (le bug disparaît d'abord, puis la transition replay est jouée une fois sa sortie finie). Tant que le bug est à l'antenne, **■ Fin du replay** est en doré.
- **Sans transition** : **Tout masquer · retour au jeu** masque tous les overlays et repasse sur le jeu. Les boutons de scène de fond (**Jeu (aucune)**, **Bientôt**, **Pause**, **Fin**, **Planning**, **50/50 caméras**) changent le fond de `stream.html` ; chacun masque d'abord les overlays plein écran (**Jeu** = retour au jeu sans eux ; lower thirds et ticker restent). **Passage** : **Fondu** ou **Coupe sèche**.
- **Overlays** : chaque overlay avec son bouton **AFFICHER** / **● À L'ANTENNE**, rangés par groupe (En jeu, Match, Maps, Joueurs, Tournoi), et la case **Un seul plein écran à la fois**.
- **Plateau : host et casters** : pour **Gauche**, **Centre** et **Droite**, choisis qui apparaît (ou « — personne — »), puis **AFFICHER LE PLATEAU** ; **Masquer** retire les trois. Par défaut : le host au centre, les deux premiers casters à gauche et à droite. Avec le centre affiché, les trois lower thirds se resserrent pour tenir côte à côte.
- **Lower thirds rapides** : gauche, centre et droite ; menu **Preset…**, style, titre, sous-titre, **Mettre à jour** (ou Entrée dans un champ), **AFFICHER**. C'est le même lower third que dans le panneau Lower thirds : les deux restent synchronisés.
- **URLs pour OBS** (à déplier) : bouton **Copier** pour chaque overlay. Seule `stream.html` (★ STREAM) est nécessaire.

### Live · score de série
- **Score de la série** : **+1** / **−1** map gagnée pour chaque équipe (dans l'ordre gauche → droite de l'écran). **+1** termine la map en cours au profit de l'équipe et passe à la map suivante. **⇄ Inverser gauche / droite** échange les côtés à l'écran.

### Lower thirds · plateau, presets, intervenants
- **À l'antenne** (en haut du panneau) : ce qui est envoyé en direct, d'un coup d'œil.
  - **Aperçu de l'antenne** : le vrai graphique des lower thirds, en petit, tel qu'il sort dans OBS (animations comprises).
  - Une case par emplacement (**Gauche**, **Centre**, **Droite**) : encadrée en rouge avec **● EN DIRECT** quand il est à l'antenne, sinon **Masqué**. Elle montre le surtitre, le titre et le sous-titre réellement affichés, et « masqué auto dans … s » si un masquage automatique est prévu (sinon « reste affiché »).
  - **Masquer** retire cet emplacement de l'antenne ; **Réafficher** remet son dernier texte tel quel.
  - **Masquer les 3 lower thirds** retire les trois (pas le ticker).
- **Plateau : host et casters** : le même que dans la Régie (voir plus haut).
- **Lower thirds (gauche / centre / droite)** : pour chaque emplacement, **AFFICHER**, les presets en 1 clic (host et casters, « Pause technique », « Prochain match », puis les tiens), **Charger un preset dans les champs (sans l'afficher)**, **Style** (Standard, Annonce dorée, Alerte rouge), **Masquer après (s, 0 = manuel)**, **Surtitre**, **Titre**, **Sous-titre**, **Mettre à jour (sans masquer)**, et **Enregistrer comme preset**.
- **Mes presets de lower third** : **◀ G** / **C** / **D ▶** affichent le preset à gauche, au centre ou à droite ; ↑ ↓ pour l'ordre ; **Renommer** ; ✕ supprime (2 clics).
- **Host et casters** : pour chacun, rôle (**Caster** ou **Host**, affiché en surtitre), nom et pseudo ; **+ Ajouter un host**, **+ Ajouter un caster**, ✕ pour retirer, puis **Enregistrer**. Chaque intervenant devient un preset de lower third et un choix du **Plateau**.

### Ticker défilant
- **Ticker défilant (bas d'écran)** : **AFFICHER** agit tout de suite. Messages (un par ligne), vitesse, case **Partenaires CYCOM / EPITECH** : à envoyer avec **Enregistrer le ticker**.

### Écran 50/50 (dual-cam)
- **Écran 50/50 (dual-cam)** : coordonnées des trous caméra ; pour chaque moitié, un label (**Aucun**, **Texte libre**, **Équipe**, **Joueur**), un titre et un sous-titre ; le bandeau du match en bas. Appliqué en direct. La scène s'affiche avec le bouton **50/50 caméras** de la Régie.

### Maps & Transitions
- **Aperçu** : joue la transition dans le panneau seulement (rien ne part à l'antenne) : ▶, ⏸, curseur, case **relance auto**. Le menu sous l'aperçu choisit la map montrée (aperçu, antenne et export).
- **Transition à l'antenne** : **▶ Transition logo**, **▶ Transition + map** et **▶ Replay** jouent la transition à l'antenne, sans rien changer d'autre. Le texte en dessous donne le point de coupe.
- **Réglages de la transition (enregistrés automatiquement)** : chaque changement part **aussitôt à l'antenne**. **Préréglages** (Rapide, Normal, Long sur la map, Coupure nette, Cinématique, Explosif) et les tiens (**Enregistrer mes réglages**, ✕ en 2 clics) ; **Durées** ; **Volets** ; **Logo** ; **Map**.
- **Revenir aux réglages par défaut** : 2 clics, appliqué à l'antenne aussitôt (tes préréglages perso sont gardés).
- **Exporter en séquence PNG** : **Exporter (logo)** / **Exporter + map choisie** / **Exporter (replay)** → dossier `exports/` du serveur ; **Télécharger cet export (.zip)** à la fin, et liste **Exports disponibles** (↻ pour la recharger) avec un bouton **Télécharger .zip** par export (voir [OBS.md](OBS.md#la-transition-stinger)).
- **Écrans maps** : **Intro de map** (menu **Map**, par défaut « Auto — map courante »), **Maps de la série**, **Résultat de map** (map, **MVP** parmi les joueurs de l'équipe gagnante, ou nom libre + équipe + **OK**), chacun avec **AFFICHER**. **Tout masquer** masque ces trois écrans.

---

## 1. MATCH & JOUEURS

### Équipes & Joueurs
- **Tableau** : une colonne par équipe, plus **Sans équipe** (les joueurs à placer). Les 5 premiers d'une équipe sont titulaires, les suivants remplaçants.
  - **+ Nouvelle équipe** : nom, TAG, couleur, logo, puis **Créer l'équipe**.
  - Clic (ou Entrée) sur l'en-tête d'une équipe : modifier nom, TAG, couleur, logo, **Enregistrer** ; **Supprimer** demande 2 clics (ses joueurs passent dans « Sans équipe »).
  - Champ **+ Pseudo#TAG ou lien tracker.gg** en bas d'une colonne, puis **+** ou Entrée : ajoute le joueur dans cette colonne et lance son import tracker.gg.
  - Glisser une carte d'une colonne à l'autre, ou menu **Déplacer…** ; menu de rôle sur chaque carte.
  - Pastilles : **TRK** allumée = profil importé de tracker.gg ; **MAN** allumée = données saisies à la main.
- **Logos** : envoie le fichier dans **ASSETS** → catégorie « Logos équipes », puis choisis-le dans le menu logo du formulaire de l'équipe (ou colle une URL ; vide = monogramme).
- **Fiche joueur** (clic ou Entrée sur une carte) :
  - **Importer depuis tracker.gg** (ou **Actualiser depuis tracker.gg**) et **Ouvrir tracker.gg ↗** ;
  - **Identité** : pseudo affiché, nom réel, Riot ID, équipe, rôle. Changer le Riot ID met tout à jour (équipes, overlays, agents joués) ; il faut ensuite réimporter le profil ;
  - **Photo** : choisis-la dans le menu (photos envoyées dans **ASSETS** → « Photos joueurs (PNG détouré conseillé) ») ou colle une URL ; ✕ la retire ;
  - **Rang** et **Peak** : icône officielle ou texte libre ; **Auto** revient à la valeur tracker.gg ;
  - **Stats** (12 valeurs) et **Agents favoris** (3) : en gris, la valeur tracker.gg ; ce que tu tapes la remplace ;
  - **↺ Revenir aux données tracker** (efface rang, stats et agents saisis à la main) et **Supprimer le joueur** (fiche, profil et place en équipe) : 2 clics chacun.
- **Aperçu · ce que verront les overlays** : la fiche telle que les overlays l'affichent ; cadre doré = valeur saisie à la main.
- **Import tracker.gg** : état de l'extension (Chrome, Edge, Firefox), favori de secours, copier-coller du JSON (voir [plus bas](#importer-les-joueurs-depuis-trackergg)).

### Match (maps, scores, agents)
- **Barre du haut** : **Versus**, **Veto des maps** et **Récap du veto**, chacun avec **AFFICHER** / **● À L'ANTENNE**.
- **Match** : **Phase** (liste, ou « Autre (libre)… »), **Format** (BO1, BO3, BO5), **Équipe A**, **Équipe B**, **⇄ Inverser gauche / droite** (côtés à l'écran).
- **Tableau des maps** : map, pick, **Score A**, **Score B**, vainqueur, statut (À venir, En cours, Terminée). **Définir en cours** fait de cette map la map courante ; **Terminer** la passe en « Terminée » avec le vainqueur selon le score (refusé en cas d'égalité) ; ✕ supprime la map (2 clics).
- **+ Ajouter une map** ; **Remplir depuis le veto** refait la liste des maps à partir des picks et du decider du veto, par exemple après une modification à la main (2 clics si des scores existent déjà ; les scores des maps gardées sont conservés). La liste suit déjà le veto toute seule ; **Réinitialiser le match** remet scores, vainqueurs et statuts à zéro, revient à la map 1 et annule l'inversion gauche / droite (2 clics).
- **Agents joués par map** : choisis la map, puis l'agent de chaque joueur. **Copier depuis la map précédente** ; **Effacer** (2 clics).
- **Équipes du match** : rappel des 5 titulaires de chaque équipe. Les équipes se gèrent dans **Équipes & Joueurs**.

### Veto des maps
- **Écrans** : **Veto des maps**, **Versus**, **Récap du veto** avec **AFFICHER** / **● À L'ANTENNE**.
- **Paramètres du veto** (ouvert tant que le veto n'a pas commencé) :
  - **Nombre de maps** : **BO1**, **BO3** ou **BO5**. C'est le même réglage que le **Format** du panneau Match : changer l'un change l'autre.
  - **Commence le veto** : l'équipe A ou l'équipe B fait le premier ban.
  - **Maps en rotation** : clique une map pour l'ajouter ou la retirer (✓ = en rotation) ; **Tout cocher** ; **Rotation par défaut** (Abyss, Ascent, Bind, Corrode, Haven, Lotus, Sunset).
  - L'ordre des étapes se calcule tout seul et s'affiche en dessous : 2 bans, puis les picks (2 en BO3, 4 en BO5), puis des bans jusqu'à ce qu'il reste une map, qui devient le decider. Avec 7 maps : BO1 = 6 bans ; BO3 = ban, ban, pick, pick, ban, ban ; BO5 = ban, ban, 4 picks. Un message rouge prévient s'il n'y a pas assez de maps (BO3 : 3 au minimum ; BO5 : 5).
  - Verrouillé pendant un veto en cours : **Réinitialiser le veto** pour les changer.
- **Liens pour les équipes** (à déplier) : un lien pour l'équipe A du match, un pour l'équipe B, à leur envoyer (**Copier**, ou **Ouvrir** pour voir ce qu'elles voient). Sur sa page, l'équipe bannit ou choisit ses maps et son côté quand c'est son tour, avec confirmation ; tout le reste est en lecture seule. Ses choix arrivent ici et sur le graphique du veto comme si tu avais cliqué. La dernière map restante devient le decider d'elle-même. « ● page ouverte » indique que la page d'une équipe est ouverte.
  - Case **Les équipes peuvent jouer leur veto depuis leur lien** : décochée, leurs pages passent en pause (elles voient le veto mais ne peuvent plus rien choisir).
  - Tu gardes toujours la main : cliquer une map ou un côté ici, **↶ Annuler la dernière étape**, **Réinitialiser le veto** fonctionnent pendant que les équipes jouent. Si une équipe clique en même temps que toi, son choix est refusé et sa page se met à jour.
  - **Nouveaux liens** (2 clics) : les anciens liens cessent de marcher. À faire si un lien a circulé hors de l'équipe.
  - Les liens marchent sur le réseau local seulement : la régie doit être lancée en mode réseau (`start-reseau.bat`), et les équipes connectées au même réseau. Les liens suivent la place A / B dans le panneau Match : change les équipes du match avant d'envoyer les liens.
- **Bandeau d'étape** : qui doit bannir ou choisir, ou quelle équipe choisit son côté.
- **Grille des maps** : un clic sur une map joue l'étape en cours (ban, pick ou decider). Après un pick ou le decider, choisis l'équipe qui prend son côté, puis **… en ATTAQUE** ou **… en DÉFENSE**.
- **↶ Annuler la dernière étape** (annule d'abord le choix du côté, puis l'étape) ; **Réinitialiser le veto** efface toutes les étapes (2 clics).
- **Déroulé** : étapes jouées et à venir.
- **Ordre du veto personnalisé (avancé)** (à déplier) : modifier l'action ou l'équipe de chaque étape, ✕ pour la retirer, **+ Étape**. Dès la première modification, l'ordre ne suit plus les paramètres ; **Revenir à l'ordre automatique** annule cela.

Le veto remplit tout seul la liste des maps du match, au fil des picks et du decider : Intro de map, Maps de la série et Récap du veto suivent immédiatement. Les scores déjà saisis sont gardés ; annuler un pick retire sa map ; vider le veto ne touche pas à la série.

### Stats Joueur · fiche et duel
- **Stats joueur** : **Équipe** (ou « Sans équipe ») puis **Joueur**, l'agent mis en avant et la **Vue** :
  - **Stats générales** : rang actuel, peak et 6 stats (K/D, ACS, ADR, HS%, KAST, victoires) ;
  - **Performances par rôle** : Duelliste, Initiateur, Contrôleur, Sentinelle, du plus joué au moins joué, avec matchs, temps de jeu, part du temps, Win %, K/D, ACS, ADR et KAST. Le rôle le plus joué porte la mention **Principal** ; la meilleure valeur de chaque colonne est en or (seulement entre rôles joués au moins 2 fois) ; un rôle jamais joué est estompé. Ces stats viennent de l'import tracker.gg (pas de saisie manuelle).

  Changer de vue pendant que la fiche est à l'antenne : la nouvelle vue arrive par-dessus l'ancienne en volet diagonal doré (0,7 s), sans que la fiche sorte. Changer de joueur ou d'agent la fait sortir puis revenir. **AFFICHER** (grisé tant qu'aucun joueur n'est choisi).
- **Duel (face-à-face)** : un joueur à gauche, un à droite. **Équipes du match** propose un joueur de chaque équipe du match (de même rôle si possible) ; **⇄** inverse les côtés. **AFFICHER**.
- **Profils manquants** : joueurs d'équipe sans profil tracker.gg, à importer dans **Équipes & Joueurs**.
- **Profils importés** : un clic sur un profil le choisit pour l'overlay **Stats joueur** ; ✕ (2 clics) supprime seulement le profil tracker.gg (la fiche et la place en équipe sont gardées).

---

## 2. ÉCRANS & TOURNOI

### Planning de la journée
Un seul planning, affiché par l'overlay plein écran **Planning** (bouton **AFFICHER**, aussi dans la Régie et Companion) et par la scène de fond **Planning** de la Régie.
- **À l'antenne** : **Planning** avec **AFFICHER** / **● À L'ANTENNE**.
- **Journée** : **Début du 1er créneau** et **Durée par défaut d'un match** (60 min) : les heures des créneaux se calculent seules. **Sur-titre** et **Titre** de l'écran.
- **Match en cours sur le stream** : le match suivi, **Arrêter le suivi**.
- **Matchs** : **+ Match de poules**, **+ Quarts de finale (4)** (deux par créneau, un seul sur le stream), **+ Demi-finales (2)**, **+ Petite finale**, **+ Grande finale**, **+ Pause** ajoutent des créneaux à la suite ; **Resserrer les créneaux** supprime les trous.
- **Un bloc par créneau** (heure de début et de fin) : ↑ ↓ l'échangent avec le créneau voisin, **☕ Pause après** insère une pause juste derrière (les créneaux suivants reculent), **+ En parallèle** ajoute un match joué en même temps.
- **Pause** : nom (« Pause déjeuner »…) et durée en minutes ; elle prend tout son créneau, qui dure sa durée au lieu d'un match : les heures des créneaux suivants (et du bracket) sont décalées d'autant. Elle s'affiche sur le planning (bandeau avec son nom et sa durée), pas sur les écrans Pause / Fin ni dans le lower third « Prochain match ».
- **Un bloc par match** : phase, match du bracket (QF1…QF4, DF1, DF2) ou groupe (poules), format, durée (**min** : vide = durée par défaut ; un créneau dure son match le plus long, les suivants sont décalés), **Sur le stream**, créneau (le changer déplace le match), équipes, scores, statut, **▶ Lancer**, ✕ (2 clics).
  - **Quarts, demies, petite et grande finale** sont liés au **Bracket** : équipes, scores, statut et vainqueur sont les mêmes des deux côtés, et les qualifiés avancent seuls. L'heure du créneau est recopiée dans le bracket.
  - **Matchs de poules** : avec un groupe, leurs résultats calculent le classement de ce groupe (victoires, défaites, rounds) ; sans groupe, ils ne comptent pas.
  - **▶ Lancer** : le match devient le match en cours (panneau **Match** : équipes, phase, format ; maps et veto remis à zéro si l'affiche change, sauvegarde avant) et passe « En cours » et « Sur le stream ». Ensuite, le score de série du panneau **Match** (rounds pour un BO1 de poules) revient tout seul dans le planning, le bracket et le classement. Changer d'affiche à la main dans **Match** arrête le suivi.
- **Alertes** : match du bracket présent deux fois, deux matchs sur le stream dans le même créneau, équipe qui joue deux matchs en même temps.

### Écrans (attente, pause, fin)
- **À l'antenne : …** (en haut) : scène de fond actuellement diffusée. Elle se change dans la Régie.
- **Compte à rebours** : **Texte au-dessus (écran d'attente)** ; **Lancer (minutes)** ou **Jusqu'à cette heure** ; **−1 min**, **+1 min**, **+5 min**, **+10 min** ; **Réinitialiser** l'arrête ; **Message à zéro**. Le même compte à rebours sert à l'écran d'attente et à la pause.
- **Écran d'attente (starting)**, **Pause (brb)**, **Fin de stream (ending)** : textes de chaque écran (enregistrés en tapant).
- **Rotation en bas de la pause** : éléments affichés à tour de rôle (texte libre, prochain match, planning à venir, score de la série, infos tournoi) : case pour activer, durée, ↑ ↓, ✕ (2 clics), **+ Ajouter**, **Rotation par défaut** (2 clics).
- Le planning (affiché aussi par la pause, la fin et le lower third « Prochain match ») se règle dans **Planning de la journée**.
- **Infos tournoi** : nom, présenté par, édition, sous-titre, dates, hashtag, lieu, repris par les écrans.
- **Aperçus** : liens qui ouvrent chaque écran dans un nouvel onglet.

### Bracket & Groupes
- **Affichage** : **Groupes** et **Bracket** avec **AFFICHER** / **● À L'ANTENNE** ; case **Mettre en avant le match en cours (LIVE)**.
- **Actions** : **Remplir les quarts depuis les groupes** (2 clics si des quarts sont déjà joués) ; **Réinitialiser** vide groupes et phase finale (2 clics, sauvegarde automatique avant).
- **Phase de groupes** : nombre de qualifiés par groupe (en or) ; pour chaque groupe, équipes, victoires, défaites, rounds gagnés et perdus. Classement et différence se calculent seuls. Un groupe qui a des matchs de poules dans le **Planning** prend son classement de leurs résultats (champs grisés). **+ Équipe**, **+ Ajouter un groupe**, ✕ sur un groupe (2 clics).
- **Phase finale** : pour chaque match, libellé, heure (fixée par le **Planning** si le match y est), statut, équipes, scores, bouton **V** (vainqueur). Les vainqueurs avancent seuls ; les perdants des demi-finales vont en petite finale.

Le planning, le bracket et le match en cours sont liés : un match de phase finale du planning est le même que celui du bracket, et le match lancé depuis le planning y renvoie son score. Un match saisi à la main dans **Match** sans passer par **▶ Lancer** n'est recopié nulle part.

---

## 3. DONNÉES

### Données · sauvegarde, import, réglages
- **1. Sauvegarder / transférer** : **⬇ Exporter mes données** (un fichier avec tout, logos et photos compris), **⬇ Exporter sans les logos / photos**, **⬆ Importer un fichier…** (remplace les données actuelles ; sauvegarde avant ; overlays masqués après).
- **2. Sauvegardes automatiques** : les 50 dernières, avec date et raison ; **Restaurer** (2 clics) ; **↻ Actualiser la liste**.
- **3. Tester** : **Charger des données de test** (2 clics) remplit match, scores, veto, agents, planning, bracket et compte à rebours pour répéter. Aucun joueur créé ; tes équipes sont gardées (des équipes adverses vides sont ajoutées s'il en faut 8).
- **4. Réinitialiser** : coche les catégories à effacer, puis **Réinitialiser la sélection** (2 clics, sauvegarde avant).
- **5. Réglages** : **Recharger automatiquement les overlays quand leur code change** (à couper pendant le direct) ; **↻ Mettre à jour les maps et agents Valorant**.
- **7. Diagnostic du direct** : **Tester la réactivité des overlays** envoie 5 mesures à toutes les pages d'overlay ouvertes (vMix, OBS…) ; pour chaque navigateur, le délai réseau et le délai d'affichage, page par page, et la cause probable d'un retard. Voir [OBS.md](OBS.md#commandes-en-retard-ou-ignorées-vmix-obs).
- **6. Bitfocus Companion** : adresse de l'API et jeton secret (**Voir**, **Copier**), **Créer un nouveau jeton** (2 clics). Mise en place des boutons : onglet **Companion** (ci-dessous) ou [COMPANION.md](COMPANION.md).

Tout le détail : [DONNEES.md](DONNEES.md).

### Companion · boutons et API
Onglet à part (pleine largeur), pour configurer les boutons de Bitfocus Companion sans rien taper :
- **1. Mise en place** : où mettre le jeton (en-tête, corps JSON ou URL), jeton par variable Companion ou en clair, URL relative ou complète ; les étapes dans Companion avec la Base URL, le nom de la variable et le jeton à copier (jamais affiché). Réglages gardés dans le navigateur.
- **2. Boutons prêts à l'emploi** : un bouton par ligne (overlays, lower thirds, scènes, transitions, ralenti, score…) avec **URL**, **En-tête** et **Corps** à copier, filtre de recherche ; **⚙** ouvre la route dans la référence.
- **3. Boutons qui s'allument** : retours visuels par `/value/…`.
- **Référence** : généralités, codes de réponse, identifiants du moment (presets, maps), puis chaque route avec sa description et **Construire le bouton** (menus des paramètres, valeurs à copier, **▶ Tester**, **Copier en curl**). Tester une action agit sur le direct : 2 clics.

---

## Importer les joueurs depuis tracker.gg
tracker.gg refuse les demandes venant du serveur de la régie : l'import passe par **ton** navigateur. Tout se fait dans le panneau **Équipes & Joueurs**. Le joueur doit avoir un profil tracker.gg public avec des parties classées cette saison.

### Méthode 1 : l'extension (recommandée, tout automatique)
Elle marche dans Chrome, Edge et Firefox, installée dans le navigateur où la régie est ouverte. Une seule fois :
1. **Chrome / Edge** : ouvre `chrome://extensions` (ou `edge://extensions`), active le **Mode développeur**, puis **Charger l'extension non empaquetée** → choisis le dossier `tools/tracker-extension` du projet.
   **Firefox** : `about:debugging#/runtime/this-firefox` → **Charger un module complémentaire temporaire…** → fichier `manifest.json` du dossier `tools/tracker-extension` (à refaire à chaque redémarrage de Firefox ; pour une installation durable, voir la version signée dans le [guide de l'extension](../tools/tracker-extension/README.md#firefox)). Clique ensuite sur l'icône de l'extension : si elle affiche **Accès aux sites non autorisé**, clique sur **Autoriser l'accès**.
2. Recharge la régie (F5). En haut du panneau **Équipes & Joueurs**, la pastille passe au vert : **Extension tracker.gg détectée** (bouton ⟳ pour re-tester).

Le lien **Guide d'installation** du panneau ouvre le [guide complet de l'extension](../tools/tracker-extension/README.md).

Ensuite, pour chaque joueur :
1. Tape `Pseudo#TAG` (ou colle le lien de son profil tracker.gg) dans **+ Pseudo#TAG ou lien tracker.gg** en bas de la colonne de son équipe, puis Entrée ;
   ou, sur sa fiche, clique **Importer depuis tracker.gg** / **Actualiser depuis tracker.gg**.
2. Un onglet tracker.gg s'ouvre en arrière-plan puis se referme. La carte passe en **TRK**.

### Méthode 2 : le favori « ⇪ Envoyer à NodeCG »
Une seule fois :
1. Panneau **Équipes & Joueurs** → carte **Import tracker.gg** → déplie **Favori de secours « ⇪ Envoyer à NodeCG » (sans extension)**.
2. Affiche la barre de favoris du navigateur (Ctrl+Maj+B) et fais-y glisser le bouton **⇪ Envoyer à NodeCG**.

Le favori contient l'adresse de la régie où tu l'as pris : si la régie change d'adresse (autre PC, régie en ligne), refais cette étape.

Ensuite, pour chaque joueur :
1. Ouvre sa page tracker.gg : **+** de la colonne (ou Entrée dans le champ), **Importer depuis tracker.gg** ou **Ouvrir tracker.gg ↗** sur sa fiche.
2. Sur la page tracker.gg du joueur, clique sur le favori **⇪ Envoyer à NodeCG**. Une petite fenêtre de la régie s'ouvre et confirme ; la carte passe en **TRK**.

### Méthode 3 : copier-coller du JSON
1. Ouvre la fiche du joueur (clic sur sa carte).
2. Carte **Import tracker.gg** → déplie **Plan C : copier-coller le JSON**.
3. Clique sur **le lien API de Pseudo#TAG** : une page de texte s'ouvre.
4. Sur cette page, Ctrl+A puis Ctrl+C.
5. Reviens dans la régie, colle dans la zone de texte, puis **Importer le JSON**.

Si tracker.gg affiche une vérification anti-robot ou une erreur : voir [DEPANNAGE.md](DEPANNAGE.md#import-trackergg).
Sans profil tracker.gg, tout peut aussi se saisir à la main dans la fiche du joueur.
