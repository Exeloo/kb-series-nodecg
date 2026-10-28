# Piloter la régie avec Bitfocus Companion (Stream Deck)

La régie expose une petite **API HTTP** : chaque bouton de Companion envoie une requête, et la régie fait exactement ce que ferait le bouton de la **Régie** (mêmes règles : un seul plein écran à la fois, une scène de fond masque les plein écran, etc.).
Elle sert aussi à tout autre outil capable d'envoyer une requête HTTP (curl, Streamer.bot, scripts…).

Ce que l'API sait faire :
- afficher, masquer ou basculer chaque overlay, tout masquer ;
- changer la scène de fond (Bientôt, Pause, Fin, Planning, 50/50 caméras, Jeu) ;
- lancer la transition (logo, logo + map, replay), avec une action faite pendant que l'écran est couvert, et au besoin dans un autre style (ex. Cinématique) pour cette fois seulement ;
- afficher un lower third, ou un preset (enregistré, intervenant, pause technique, prochain match) ;
- changer le score de la série (+1 / −1) ;
- donner l'état du direct, pour allumer les boutons de ce qui est à l'antenne et afficher le score sur une touche.

**Le plus simple** : l'onglet **Companion** du tableau de bord donne, pour chaque bouton, l'URL, l'en-tête et le corps prêts à copier (selon ta façon de passer le jeton), un constructeur et un test pour chaque route, et cette référence. Ce document en est la version texte.

Ce qu'elle ne fait pas (à régler dans la régie) : les textes, équipes, joueurs, veto, bracket, réglages de la transition.

## 1. Mise en place

### Le jeton
Toutes les requêtes doivent présenter un **jeton secret**. Il se trouve dans le panneau **Données** → **6. Bitfocus Companion** (boutons **Voir** et **Copier**).
- Il est créé tout seul au premier démarrage et gardé dans `db/companion-token` (jamais dans les exports ni les sauvegardes).
- **Créer un nouveau jeton** (2 clics) : l'ancien ne marche plus, à remplacer dans Companion.
- En ligne (Docker, Railway) : tu peux le fixer avec la variable d'environnement `COMPANION_TOKEN` (au moins 16 caractères aléatoires) ; le bouton du panneau est alors désactivé.

Le jeton donne la main sur le direct : traite-le comme un mot de passe, ne le montre pas à l'écran.

### L'adresse
| Où est Companion ? | Adresse de base |
|---|---|
| Sur le même PC que la régie (`start.bat`) | `http://localhost:9090/valorant-tournament/api` |
| Sur un autre PC du réseau | Lance la régie avec `start-reseau.bat` ([INSTALLATION.md](INSTALLATION.md)), puis `http://<IP du PC de la régie>:9090/valorant-tournament/api` |
| Régie en ligne | `https://<ton domaine>/valorant-tournament/api` |

Le panneau Données affiche l'adresse de base telle que ton navigateur la voit (bouton **Copier**).

### Dans Companion
1. **Connections** → ajoute **Generic: HTTP Requests**. Dans ses réglages, mets l'adresse de base ci-dessus dans **Base URL**.
2. Conseillé : **Variables** → **Custom Variables** → crée `kb_token` avec le jeton comme valeur. Si tu changes de jeton, tu n'as qu'un endroit à modifier.
3. Pour chaque bouton : action **POST** de cette connexion, avec
   - **URL** : la fin de l'adresse, par exemple `/overlay/versus/toggle` (voir les boutons prêts à l'emploi plus bas) ;
   - **Header input** : `{ "Authorization": "Bearer $(internal:custom_kb_token)" }` ;
   - **Body** : laisse vide.

Si ta version du module ne remplace pas les variables dans l'en-tête, colle directement le jeton à la place de `$(internal:custom_kb_token)`.

Autre possibilité : laisser l'en-tête vide et mettre le jeton dans le **Body**, en JSON : `{ "key": "$(internal:custom_kb_token)" }`.
Les paramètres des actions peuvent y aller aussi, au lieu de l'URL : URL `/transition`, Body `{ "key": "…", "kind": "map", "then": "overlay:map-intro" }`.

Dernier recours : ajoute `?key=<jeton>` au bout de l'URL (ou `&key=<jeton>` si elle contient déjà un `?`). Ça marche, mais le jeton apparaît alors dans l'URL.

### Vérifier que ça marche
Dans un navigateur, ouvre `http://localhost:9090/valorant-tournament/api?key=<jeton>`. La page doit afficher la liste des overlays, scènes, presets et maps. `401` : jeton faux ou absent.

## 2. Boutons prêts à l'emploi
Toutes ces URL sont à mettre dans une action **POST** (elles viennent après l'adresse de base).

| Bouton | URL |
|---|---|
| Versus (afficher / masquer) | `/overlay/versus/toggle` |
| Veto des maps | `/overlay/veto/toggle` |
| Récap du veto | `/overlay/veto-recap/toggle` |
| Intro de map | `/overlay/map-intro/toggle` |
| Maps de la série | `/overlay/map-series/toggle` |
| Résultat de map | `/overlay/map-result/toggle` |
| Stats joueur | `/overlay/player-stats/toggle` |
| Duel | `/overlay/player-duel/toggle` |
| Planning | `/overlay/planning/toggle` |
| Groupes | `/overlay/groups/toggle` |
| Bracket | `/overlay/bracket/toggle` |
| Ticker | `/overlay/ticker/toggle` |
| Bug Replay (haut droite) | `/overlay/replay-bug/toggle` |
| Lower third gauche / centre / droite | `/lower-third/left/toggle`, `/lower-third/center/toggle`, `/lower-third/right/toggle` |
| Lower third : 1er intervenant (à gauche) | `/lower-third/left/preset/caster-1` |
| Lower third : pause technique | `/lower-third/center/preset/pause` |
| Lower third : prochain match | `/lower-third/center/preset/next` |
| Lower third : preset enregistré « Mon preset » | `/lower-third/left/preset/Mon%20preset` |
| Scène : Bientôt / Pause / Fin / Planning / 50-50 | `/scene/starting`, `/scene/brb`, `/scene/ending`, `/scene/schedule`, `/scene/dual-cam` |
| Scène : retour au jeu | `/scene/none` |
| Transition logo | `/transition` |
| Transition + map en cours | `/transition?kind=map` |
| Transition replay | `/transition?kind=replay` |
| Transition cinématique (logo) | `/transition?style=cinema` |
| Transition cinématique + map puis Intro de map | `/transition?kind=map&then=overlay:map-intro&style=cinema` |
| Ralenti : transition replay + bug REPLAY affiché | `/replay/start` |
| Fin du ralenti : transition replay + bug REPLAY masqué | `/replay/end` |
| Transition puis Pause | `/transition?then=scene:brb` |
| Transition + map puis Intro de map | `/transition?kind=map&then=overlay:map-intro` |
| Transition puis retour au jeu | `/transition?then=clear` |
| Score +1 équipe A / B | `/score/A/plus`, `/score/B/plus` |
| Score −1 équipe A / B | `/score/A/minus`, `/score/B/minus` |
| Tout masquer, retour au jeu | `/clear` |
| Option : transition des plein écran (bascule) | `/option/fullscreen-stinger/toggle` |

## 3. Boutons qui s'allument (retours visuels)
L'API ne prévient pas Companion d'un changement : Companion doit demander l'état régulièrement. Le plus simple passe par les adresses `/value/…`, qui répondent **une seule valeur en texte brut** (`true`, `false`, `2`, `brb`…).

1. Crée une variable personnalisée par information à suivre, par exemple `kb_versus`.
2. **Triggers** → nouveau déclencheur, événement **intervalle de temps** (toutes les 1 seconde par exemple), action **GET** de la connexion HTTP sur `/value/overlays/versus`, en enregistrant la réponse dans la variable `kb_versus` (option de l'action GET qui stocke le résultat dans une variable personnalisée).
3. Sur le bouton Versus : feedback **Internal → Variable: Check value**, `$(internal:custom_kb_versus)` égal à `true` → fond rouge.

Pour afficher le score sur une touche : variables `kb_scoreA` / `kb_scoreB` alimentées par `/value/match/scoreA` et `/value/match/scoreB`, puis texte du bouton `$(internal:custom_kb_scoreA) - $(internal:custom_kb_scoreB)`.

Valeurs utiles (le détail de `/state` est plus bas) :

| Valeur | Adresse GET |
|---|---|
| Overlay à l'antenne ? | `/value/overlays/<overlay>` (ex. `/value/overlays/map-intro`) |
| Scène de fond en cours | `/value/scene` |
| Plein écran à l'antenne (vide si aucun) | `/value/fullscreen` |
| Lower third gauche visible ? | `/value/lowerThirds/left/visible` |
| Score de série | `/value/match/scoreA`, `/value/match/scoreB` |
| Nom / tag des équipes | `/value/match/teamA/tag`, `/value/match/teamB/name` |
| Numéro et nom de la map en cours | `/value/match/map/number`, `/value/match/map/name` |
| Transition en attente de son action ? | `/value/transition/pending` |

Une interrogation par seconde ne coûte rien à la régie. Évite tout de même de descendre sous 250 ms.

## 4. Référence de l'API

### Généralités
- **Préfixe** de toutes les routes : `/valorant-tournament/api`.
- **Jeton** obligatoire sur toutes les routes, au choix :
  - en-tête `Authorization: Bearer <jeton>` (recommandé) ;
  - en-tête `X-Api-Key: <jeton>` ;
  - paramètre `?key=<jeton>` ;
  - champ `key` du corps JSON : `{ "key": "<jeton>" }`.
- Les actions sont des **POST** ; les lectures sont des **GET**.
- **Paramètres** des actions (`kind`, `map`, `then`, `style`, `via`, `exclusive`, `fullscreen`, `stinger`) : dans l'adresse (`?kind=map`) **ou** dans le corps JSON (`{ "kind": "map" }`). Si les deux sont donnés, l'adresse l'emporte.
  Le corps est lu en JSON quel que soit son `Content-Type` (4 ko au plus) ; un corps qui n'est pas un objet JSON est ignoré. Exception : un JSON mal formé envoyé en `application/json` est refusé par NodeCG lui-même (`500`, texte « Internal error »).
  Ce qui fait partie du chemin (overlay, scène, emplacement, preset, équipe, `plus` / `minus`) reste dans l'URL.
- Une requête POST envoyée par une **page web d'un autre site** est refusée (`403`). Companion, curl et les scripts ne sont pas concernés.
- Rien n'est mis en cache (`Cache-Control: no-store`).
- Chaque action réussie est notée dans le journal de la régie (`Companion : …`).

**Réponse d'une action réussie** (`200`) :
```json
{ "ok": true, "done": "Versus affiché", "state": { … } }
```
`done` décrit ce qui a été fait ; `state` est l'état complet après l'action (même contenu que `GET /state`). Certaines actions ajoutent des champs, indiqués plus bas.

**Réponse d'un refus** :
```json
{ "ok": false, "error": "Stats joueur : rien à afficher, à régler d'abord dans la régie." }
```

| Code | Signification |
|---|---|
| `400` | Paramètre invalide (`via`, `kind`, `then`…) |
| `401` | Jeton absent ou faux |
| `403` | Requête envoyée par une page web d'un autre site |
| `404` | Route, overlay, scène, emplacement, preset, map ou équipe inconnus |
| `409` | Action impossible dans l'état actuel (rien à afficher, série terminée, aucune map gagnée à retirer, aucune map en cours…) |
| `500` | Erreur interne (voir le journal de la régie), ou corps JSON mal formé (réponse texte « Internal error ») |
| `503` | Partie du serveur indisponible (erreur au démarrage, voir le journal) |

### Identifiants
**Overlays** (`<overlay>`) :

| Identifiant | Overlay | Plein écran |
|---|---|---|
| `lower-third-left`, `lower-third-center`, `lower-third-right` | Lower thirds | non |
| `ticker` | Ticker | non |
| `replay-bug` | Bug Replay (haut droite) | non |
| `versus` | Versus | oui |
| `veto` | Veto des maps | oui |
| `veto-recap` | Récap du veto | oui |
| `map-intro` | Intro de map | oui |
| `map-series` | Maps de la série | oui |
| `map-result` | Résultat de map | oui |
| `player-stats` | Stats joueur | oui |
| `player-duel` | Duel | oui |
| `planning` | Planning de la journée | oui |
| `groups` | Groupes | oui |
| `bracket` | Bracket | oui |

**Scènes de fond** (`<scène>`) : `none` (jeu, aucune scène), `starting` (Bientôt), `brb` (Pause), `ending` (Fin), `schedule` (Planning), `dual-cam` (50/50 caméras).

**Emplacements de lower third** (`<côté>`) : `left`, `center`, `right`.

**Presets de lower third** (`<preset>`), cherchés dans cet ordre :
1. l'identifiant exact d'un preset (donné par `GET /valorant-tournament/api`) ;
2. les raccourcis `caster-1`, `caster-2`… (intervenants dans l'ordre de la liste host / casters), `pause` (pause technique), `next` (prochain match) ;
3. le **nom** d'un preset enregistré, sans tenir compte des majuscules (espaces écrits `%20` dans l'URL).

---

### `GET /valorant-tournament/api`
Tout ce que l'API accepte, avec les valeurs du moment : utile pour configurer les boutons.

```json
{
  "ok": true,
  "overlays": [{ "id": "versus", "label": "Versus", "fullscreen": true }, …],
  "scenes": [{ "id": "brb", "label": "Pause" }, …],
  "lowerThirdSides": ["left", "center", "right"],
  "presets": [{ "id": "p1abc", "name": "Mon preset" }, { "id": "auto:caster:0", "name": "Host : Alice" }, { "id": "auto:pause", "name": "Pause technique" }, …],
  "transitionKinds": ["logo", "map", "replay"],
  "transitionStyles": [{ "id": "cinema", "label": "Cinématique" }, …, { "id": "Mon style", "label": "Mon style (perso)" }],
  "maps": ["Abyss", "Ascent", …]
}
```

### `GET /valorant-tournament/api/state`
État du direct.

```json
{
  "ok": true,
  "scene": "none",
  "overlays": { "lower-third-left": false, "ticker": true, "versus": false, … },
  "onAir": ["ticker"],
  "fullscreen": null,
  "lowerThirds": {
    "left": { "visible": false, "kicker": "Caster", "title": "Alice", "subtitle": "@alice" },
    "center": { … }, "right": { … }
  },
  "match": {
    "teamA": { "name": "Équipe Une", "tag": "EQ1" }, "teamB": { "name": "Équipe Deux", "tag": "EQ2" },
    "scoreA": 1, "scoreB": 0, "format": "bo3", "stage": "Phase de groupes", "swap": false,
    "map": { "number": 2, "name": "Ascent", "scoreA": 7, "scoreB": 5 }
  },
  "transition": { "pending": false, "then": null }
}
```
| Champ | Contenu |
|---|---|
| `scene` | Scène de fond en cours |
| `overlays` | Pour chaque overlay : `true` s'il est à l'antenne |
| `onAir` | Liste des overlays à l'antenne |
| `fullscreen` | Plein écran à l'antenne, `null` si aucun |
| `lowerThirds` | Par emplacement : visibilité et texte réellement affiché (intervenant résolu) |
| `match` | Équipes A / B du match, score de série, format, phase, `swap` (gauche / droite inversées), map en cours (`null` si aucune) |
| `transition` | `pending` : une transition attend de faire son action ; `then` : laquelle |
| `fullscreenStinger` | Option « transition des plein écran » active |

### `GET /valorant-tournament/api/value/<chemin>`
Une seule valeur de `/state`, en **texte brut**. Le chemin suit les champs, séparés par `/` :
`/value/overlays/versus` → `true`, `/value/match/scoreA` → `1`, `/value/match/map/name` → `Ascent`, `/value/lowerThirds/left` → l'objet en JSON.
Une valeur `null` répond un texte vide. Chemin inexistant : `404` (corps vide).

---

### `POST /valorant-tournament/api/overlay/<overlay>/<show|hide|toggle>`
Affiche, masque ou bascule un overlay.
- `show` d'un plein écran masque les autres plein écran (comme la Régie). `?exclusive=0` pour les laisser.
- `show` refuse (`409`) un overlay qui n'a rien à afficher : Stats joueur sans joueur choisi, Duel sans joueur, lower third sans texte.
- `toggle` : `hide` s'il est à l'antenne, sinon `show`.
- **Transition des plein écran** activée (case de la Régie, ou `/option/fullscreen-stinger/on`) : pour un overlay plein écran, `show` / `hide` jouent le stinger (logo) et le changement est fait au point de coupe ; passer d'un plein écran à un autre = un seul stinger. La réponse arrive tout de suite (avant le changement) avec les champs de `/transition`. Rien à changer : pas de stinger (`done` : « … déjà affiché / masqué »). `?stinger=0` : tout de suite, sans stinger.

Exemple : `POST /overlay/map-intro/show` → `{ "ok": true, "done": "Intro de map affiché", "state": … }`

### `POST /valorant-tournament/api/option/fullscreen-stinger/<on|off|toggle>`
Active, désactive ou bascule l'option **Transition des plein écran** (même réglage que la case de la Régie, commun à toute la régie). État : `fullscreenStinger` dans `/state`.

### `POST /valorant-tournament/api/overlays/hide-all`
Masque tous les overlays. `?fullscreen=1` : seulement les plein écran (lower thirds et ticker restent). La scène de fond ne change pas.

### `POST /valorant-tournament/api/clear`
Comme **Tout masquer** de la Régie : masque tous les overlays et repasse la scène sur `none` (coupe sèche). Annule aussi l'action d'une transition en cours qui n'a pas encore eu lieu.

### `POST /valorant-tournament/api/scene/<scène>`
Change la scène de fond de `stream.html`.
- `?via=fade` (fondu, défaut) ou `?via=cut` (coupe sèche).
- Masque d'abord les overlays plein écran (comme la Régie) : ils cacheraient la scène, et `none` veut dire retour au jeu. Lower thirds et ticker restent.
- Demander la scène déjà affichée ne la rejoue pas (les plein écran sont quand même masqués).

### `POST /valorant-tournament/api/transition`
Lance la transition (stinger), avec les réglages du panneau **Maps & Transitions**.

| Paramètre | Valeurs | Défaut |
|---|---|---|
| `kind` | `logo`, `map` (logo + map), `replay` | `map` si `map` est donné, sinon `logo` |
| `map` | Nom d'une map (majuscules indifférentes), ex. `Ascent` | Avec `kind=map` : la map en cours du match (`409` s'il n'y en a pas) |
| `then` | `none` · `clear` (tout masquer, retour au jeu) · `scene:<scène>` · `overlay:<overlay>` (afficher) · `hide:<overlay>` (masquer) | `none` |
| `style` | Préréglage du panneau **Maps & Transitions** : `cinema` (Cinématique), `rapide`, `normal`, `long`, `coupure`, `explosif`, ou le nom d'un préréglage perso | Réglages enregistrés |

L'action `then` est faite pendant que la transition couvre l'écran, exactement comme dans la Régie : au point de coupe, ou dès le début de la couverture pour une scène de fond. Un `overlay:` est affiché (en plein écran exclusif s'il s'agit d'un plein écran) ; un `hide:` est masqué. Une nouvelle transition remplace l'action d'une transition précédente pas encore faite.

`style` joue la transition avec ce préréglage **pour cette fois seulement** : les réglages enregistrés (et donc les transitions de la Régie) ne changent pas. Le libellé marche aussi (`Cinématique`, `cinematic`), sans tenir compte des accents ni des majuscules. Style inconnu : `404` avec la liste. La liste du moment est dans `transitionStyles` de `GET /valorant-tournament/api`.

Champs ajoutés à la réponse : `kind`, `map`, `then`, `style` (`null` sans style), `duration` (durée de la transition, ms), `actionAt` (moment de l'action après le lancement, ms, ou `null`).

Exemple : `POST /transition?kind=map&then=overlay:map-intro` → `{ "ok": true, "done": "Transition + Ascent lancée → overlay:map-intro", "kind": "map", "map": "Ascent", "then": "overlay:map-intro", "duration": 3640, "actionAt": 1820, "state": … }`

### `POST /valorant-tournament/api/replay/start` · `POST /valorant-tournament/api/replay/end`
Ralenti en un appel, comme les boutons **▶ Replay + bug** et **■ Fin du replay** de la Régie :
- `/replay/start` = `/transition?kind=replay&then=overlay:replay-bug` : transition replay, le bug « REPLAY » apparaît pendant que l'écran est couvert ;
- `/replay/end` : le bug disparaît d'abord, puis la transition replay est jouée une fois sa sortie finie (0,4 s ; champ `stingerAt` de la réponse). `/clear` pendant cette attente annule la transition. Bug déjà masqué : transition replay tout de suite.

Les deux acceptent `style` comme `/transition` (ex. `/replay/start?style=cinema`) ; un style inconnu est refusé avant de masquer le bug.
Mêmes champs de réponse que `/transition` (pour `/replay/end` avec le bug affiché : `stingerAt` au lieu de `actionAt`). Le bug déjà dans l'état demandé n'est pas une erreur (la transition est jouée quand même).

### `POST /valorant-tournament/api/transition/cancel`
Annule l'action prévue par la dernière transition si elle n'a pas encore eu lieu (la transition elle-même continue). Champ `cancelled: false` si rien n'était en attente.

### `POST /valorant-tournament/api/lower-third/<côté>/<show|hide|toggle>`
Affiche, masque ou bascule le lower third de cet emplacement avec son contenu actuel (réglé dans la régie). Même chose que `/overlay/lower-third-<côté>/…`. Le masquage automatique (durée réglée dans le lower third) s'applique.

### `POST /valorant-tournament/api/lower-third/<côté>/preset/<preset>`
Charge un preset dans cet emplacement et l'affiche (comme un clic sur un preset dans le panneau Lower thirds). Si le lower third est déjà affiché, son texte change en place.

Exemple : `POST /lower-third/left/preset/caster-2` → `{ "ok": true, "done": "Lower third left : preset « Caster : Bob » affiché", "state": … }`

### `POST /valorant-tournament/api/score/<A|B>/<plus|minus>`
Score de la série, comme les boutons +1 / −1 du panneau **Live** :
- `plus` : la map en cours (ou la première sans vainqueur) est gagnée par l'équipe, la map suivante passe « en cours ». `409` si la série est déjà terminée.
- `minus` : annule la dernière map gagnée par l'équipe. `409` s'il n'y en a pas.

`A` / `B` sont les équipes du match (pas la gauche / droite à l'écran) ; minuscules acceptées. `+1` et `-1` sont acceptés à la place de `plus` / `minus`.
Champs ajoutés à la réponse : `A`, `B` (score après l'action), `currentMap` (index de la map en cours, à partir de 0).

## 5. Tester sans Companion (curl)
```sh
TOKEN=colle-ton-jeton-ici
API=http://localhost:9090/valorant-tournament/api
curl -H "Authorization: Bearer $TOKEN" $API/state
curl -X POST -H "Authorization: Bearer $TOKEN" $API/overlay/versus/toggle
curl -X POST -H "Authorization: Bearer $TOKEN" "$API/transition?kind=map&then=overlay:map-intro"
# même chose, tout dans le corps JSON
curl -X POST -H "Content-Type: application/json" -d "{\"key\":\"$TOKEN\",\"kind\":\"map\",\"then\":\"overlay:map-intro\"}" $API/transition
```
Sous Windows (PowerShell), remplace `curl` par `curl.exe`.

## Un problème ?
| Symptôme | Cause → solution |
|---|---|
| `401` | Jeton faux ou absent : recopie-le depuis le panneau Données ; vérifie l'en-tête (`Bearer` + espace + jeton) ou le champ `"key"` du Body. |
| `500` « Internal error » | Le Body n'est pas du JSON valide (guillemets droits `"`, virgules, accolades). |
| Companion n'arrive pas à joindre la régie (délai dépassé) | Companion est sur un autre PC : lance la régie avec `start-reseau.bat`, utilise l'IP du PC de la régie, autorise Node.js dans le pare-feu Windows. |
| `409` « rien à afficher » | L'overlay n'est pas prêt : choisis le joueur, le duel ou le texte dans la régie. |
| `404` « Route inconnue » | Faute de frappe dans l'URL, ou action envoyée en GET au lieu de POST. |
| Le bouton ne s'allume pas | Le déclencheur qui interroge `/value/…` ne tourne pas, ou la feedback compare à autre chose que `true`. |
