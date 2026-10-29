# Mes données

Pour le régisseur : où sont rangées les données, ce que contiennent les sauvegardes automatiques, comment exporter, importer, restaurer ou réinitialiser, et quoi faire avant une mise à jour.

## Où sont les données
Tout s'enregistre automatiquement, au fil de l'eau, dans le dossier du projet. Aucun de ces dossiers n'est envoyé sur GitHub.

| Dossier | Contenu |
|---|---|
| `db/` | La base de NodeCG : équipes, joueurs, match, veto, planning, bracket, textes, réglages… |
| `db/backups/` | Les sauvegardes automatiques (un fichier `.json` par sauvegarde, les 50 plus récentes). |
| `db/tracker/` | Les réponses brutes de tracker.gg, une par joueur importé. |
| `db/session-secret` | Seulement si un mot de passe est activé : secret des sessions de connexion. |
| `db/companion-token` | Jeton de l'API Bitfocus Companion ([COMPANION.md](COMPANION.md)). Ni exporté ni sauvegardé : sur une autre régie, un nouveau jeton est créé. |
| `assets/valorant-tournament/` | Les fichiers envoyés dans **ASSETS** : logos d'équipes, photos de joueurs. |

La copie la plus complète possible : régie **arrêtée**, copie les dossiers `db/` et `assets/` entiers.

## Les sauvegardes automatiques
Une sauvegarde est écrite dans `db/backups/` juste **avant** chacune de ces opérations :
| Opération | Raison affichée |
|---|---|
| **Réinitialiser la sélection** (Données) | Avant une réinitialisation |
| **Charger des données de test** | Avant les données de test |
| **⬆ Importer un fichier…** | Avant un import |
| **Restaurer** une sauvegarde | Avant une restauration |
| **Réinitialiser** (Bracket & Groupes) | Avant la remise à zéro du bracket |

Les 50 plus récentes sont gardées, les plus anciennes sont supprimées.

**Ce qu'elle contient** : toutes les données de la régie : tournoi, équipes, fiches joueurs, profils tracker.gg, host et casters, planning, compte à rebours, match, veto (et son format), bracket, textes des écrans, rotation de la pause, ticker, lower thirds et leurs presets, réglages de la transition, écran 50/50, scène de fond et état d'affichage de chaque overlay.

**Ce qu'elle ne contient pas** :
- les logos et photos (`assets/`) ;
- les réponses brutes de tracker.gg (`db/tracker/`) ;
- les images des maps et agents Valorant (retéléchargées au démarrage) ;
- l'interrupteur de rechargement automatique (panneau **Données** → **5. Réglages**) ;
- les préférences de ce navigateur (case « Un seul plein écran à la fois », dernier type de transition choisi…).

Une sauvegarde automatique n'est donc **pas** une copie complète : pour cela, utilise l'export avec les logos et photos.

## Exporter
Panneau **Données** → **1. Sauvegarder / transférer** :
- **⬇ Exporter mes données** : un seul fichier `kb-series-donnees-AAAA-MM-JJ.json` avec toutes les données **et** les logos et photos.
- **⬇ Exporter sans les logos / photos** : même chose sans les fichiers (`…-sans-fichiers.json`), beaucoup plus léger. Copie alors le dossier `assets/` à la main.

Le fichier arrive dans le dossier de téléchargement du navigateur. Range-le hors du PC.

## Importer (ou passer sur une autre régie)
Pour passer de la régie locale à une régie en ligne (ou à un autre PC) : exporte sur l'ancienne, puis, sur la nouvelle, panneau **Données** → **⬆ Importer un fichier…** et choisis le fichier.

Ce que fait l'import :
1. Il vérifie tout le fichier **avant** d'écrire quoi que ce soit : un fichier abîmé est refusé sans rien toucher.
2. Il sauvegarde l'état actuel (« Avant un import »).
3. Il remplace les données par celles du fichier. Une donnée absente du fichier reste telle quelle.
4. Il ajoute les logos et photos du fichier dans `assets/` (un fichier du même nom est remplacé ; les autres fichiers déjà présents restent).
5. Il masque tous les overlays et repasse la scène de fond sur **Jeu**, pour que rien n'apparaisse à l'antenne par surprise.

Messages de refus possibles : « Fichier non reconnu (export KB SERIES attendu) », « Fichier illisible (JSON invalide) », « Donnée inconnue dans le fichier », « Type de fichier refusé ». Voir [DEPANNAGE.md](DEPANNAGE.md#import-ou-export-refusé).

### Deux régies reliées
Une régie sur place reliée à une régie en ligne (panneau **Données** → **8. Deux régies**, [DEPLOIEMENT.md](DEPLOIEMENT.md#deux-régies--en-ligne--sur-place-overlays-sans-délai)) partage ses données avec elle en direct : sauvegarde, restauration, import ou réinitialisation faits d'un côté s'appliquent aussi de l'autre. Avant que la régie en ligne ne remplace des données de la régie sur place, une sauvegarde `avant-synchro` est faite sur place.

## Restaurer une sauvegarde
1. Panneau **Données** → **2. Sauvegardes automatiques** (**↻ Actualiser la liste** si besoin).
2. Repère la bonne ligne : date, heure et raison (ex. « Avant une réinitialisation »).
3. **Restaurer**, puis reclique sur **Confirmer : tout remplacer ?**

L'état actuel est d'abord sauvegardé (« Avant une restauration ») : une restauration se défait en restaurant cette sauvegarde-là. Après la restauration, tous les overlays sont masqués et la scène repasse sur **Jeu**. Les logos et photos ne sont pas concernés.

## Réinitialiser
Panneau **Données** → **4. Réinitialiser** : coche les catégories, puis **Réinitialiser la sélection** (2 clics). Une sauvegarde est faite avant.

| Case | Ce qui est effacé |
|---|---|
| Équipes | Toutes les équipes. |
| Joueurs (fiches, stats) | Fiches joueurs et profils tracker.gg (les réponses brutes de `db/tracker/` restent sur le disque). |
| Match en cours et veto | Match (maps, scores, agents), veto, format et pool du veto. |
| Planning et compte à rebours | Planning de la journée (matchs, créneaux, match suivi) ; compte à rebours arrêté (son texte est gardé). Le bracket n'est pas touché. |
| Bracket | Groupes et phase finale. |
| Textes (écrans, ticker, casters, lower thirds) | Textes des écrans et rotation de la pause remis par défaut, liste du host et des casters vidée, messages du ticker vidés, textes des lower thirds et étiquettes du 50/50 remis à zéro. |
| Overlays (tout masquer, réglages d'affichage) | Tous les overlays masqués, scène sur **Jeu**, choix d'affichage remis à zéro (joueur des stats, duel, map et MVP des écrans maps). |

Jamais effacés : les infos du tournoi (nom, dates, lieu…), les presets de lower third, les réglages de la transition, les logos et photos.

## Limites
| Opération | Limite |
|---|---|
| Export avec les logos et photos | Refusé si les fichiers dépassent **150 Mo** : utilise **⬇ Exporter sans les logos / photos** et copie `assets/` à la main. |
| Import | Fichier de **200 Mo** au plus. |
| Formats acceptés à l'import | Logos : png, jpg, jpeg, svg, webp, gif ; photos : png, webp, jpg, jpeg. |

## Avant une mise à jour du projet
1. **⬇ Exporter mes données** et range le fichier hors du PC.
2. Garde les dossiers `db/` et `assets/` : une mise à jour ne doit jamais les remplacer (voir [INSTALLATION.md](INSTALLATION.md#mettre-à-jour-le-projet)).
