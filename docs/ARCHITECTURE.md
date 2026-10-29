# Architecture

Pour un développeur ou un agent IA qui reprend le code : principe, arborescence, flux de données (replicants, messages, routes), socle partagé, conventions, charte visuelle, ajout d'un overlay ou d'un panneau, outils, mises en garde. Les fichiers sources font foi ; ce document dit où regarder.

## Principe
- Le dossier racine **est** le bundle NodeCG `valorant-tournament` (`package.json` → `name`, champ `nodecg`). NodeCG 2.8.0 est une simple dépendance : `npm start` = `node node_modules/nodecg/index.js`, lancé depuis la racine, qui sert de dossier de travail à NodeCG (`db/`, `assets/`, `logs/`, `cfg/`).
- JavaScript pur, **aucune étape de build** : les pages chargent leurs scripts avec `<script src>`, le serveur est en CommonJS.
- Node 24 (`start.bat`, `Dockerfile`, CI). `engines` accepte `>=22.13`, mais seul Node 24 est testé.
- Le propriétaire n'est pas développeur : code simple, commenté en français, textes d'interface en français.

## Arborescence
```
cfg/nodecg.js            configuration NodeCG lue au démarrage (port, hôte, connexion) ; tout vient des variables d'environnement
dashboard/               panneaux de régie (déclarés dans package.json → nodecg.dashboardPanels)
  companion.html          onglet « Companion » (fullbleed) : boutons Companion à copier, constructeur et test des routes, référence de l'API (suit docs/COMPANION.md)
  players.html + players/  panneau « Équipes & Joueurs » découpé : data.js (écritures), board.js, sheet.js, preview.js, main.js, players.css
graphics/                overlays 1920×1080 (package.json → nodecg.graphics) ; stream.html les empile tous
extension/               serveur du bundle
  index.js               charge chaque partie dans un try/catch (une partie en erreur n'arrête pas les autres)
  lib/paths.js           chemins (ROOT, DB, BACKUPS, TRACKER, ASSETS, EXT_DIR, STATIC)
  lib/listen.js          réception des messages sans jamais faire tomber le serveur
  lib/backup.js          sauvegardes db/backups/, liste des replicants de données (NAMES) et des overlays (OVERLAYS)
  lib/http.js            gardes des routes : requireLogin, sameOrigin
  lib/zip.js             archive ZIP envoyée en flux, sans compression (téléchargement des exports du stinger)
  state.js               replicants coeur + cache valorant-api.com
  tracker.js             normalisation d'un JSON tracker.gg → profil (playerProfiles), JSON brut dans db/tracker/
  tracker-routes.js      routes HTTP de l'import tracker.gg (+ static/ : tracker-receiver.html, tracker-guide.html)
  veto-teams.js          liens de veto envoyés aux équipes : routes HTTP, contrôle des tours (+ static/veto-team.html)
  companion.js           API HTTP à jeton pour Bitfocus Companion (docs/COMPANION.md)
  sync.js                synchro en direct de deux régies (en ligne ↔ sur place) : replicants dans les deux sens, logos et photos d'en ligne vers sur place (voir « Deux régies »)
  live.js maps.js match.js player.js bracket.js scenes.js   replicants et logique de chaque partie
  diag.js                diagnostic du direct : délai réseau et d'affichage des commandes dans chaque page d'overlay ouverte
  planning.js            planning de la journée : heures et classement des groupes recopiés dans le bracket, liste `schedule`, score du match en cours
  data-admin.js          réinitialisation par catégories, liste et restauration des sauvegardes
  data-transfer.js       export / import d'un fichier complet (données + assets en base64)
  test-data.js           données de test (aucun joueur créé)
  dev-reload.js          rechargement automatique des overlays quand leur code change
shared/                  code commun pages + serveur, thème, polices (fonts/, licence OFL), images (img/)
tools/                   outils Node (check, shot, export-stinger, browser, pack-extension, patch-deps, docker-start.sh) + tracker-extension/ (extension Chrome / Edge / Firefox)
docs/                    documentation
start.bat, start-reseau.bat   lanceurs Windows (ASCII, CRLF)
Dockerfile, docker-compose.yml, .env.example, .railwayignore, .dockerignore   mise en ligne (docs/DEPLOIEMENT.md)
```
Hors git : `db/` (base `nodecg.sqlite3`, `backups/`, `tracker/`, `session-secret`, `companion-token`, `sync-token`, `sync.json`, `sync-assets.json`), `assets/`, `exports/`, `shots/`, `Medias/`, `logs/`, `node_modules/`.

## Flux de données

### Replicants
Les replicants sont persistés par NodeCG dans `db/` (sauf mention). « Défaut » = où est définie la valeur par défaut (jamais recopiée ailleurs).

| Replicant | Rôle | Déclaré / écrit côté serveur | Écrit par (panneaux) | Lu par (overlays) | Défaut |
|---|---|---|---|---|---|
| `tournament` | Nom, édition, dates, lieu, hashtag | `state.js` | Écrans | starting, brb, ending, schedule, map-intro, player-stats, bracket | `shared/defaults.js` |
| `teams` | `{ [id]: { id, name, tag, logo, color, players: [{ riotId, role }] } }` | `state.js`, `test-data.js` | Équipes & Joueurs | presque tous | `shared/defaults.js` |
| `match` | Phase, format, équipes A/B, `swap`, `currentMap`, `maps[]` (scores, vainqueur, statut, `picks`) | `state.js`, `live.js` (`live:series`), `match.js` (`maps` recalculées quand les picks du veto changent — `KBMatch.mapsFromVeto`), `test-data.js` | Match, Live, Équipes & Joueurs (renommage) | versus, veto, maps, joueurs, brb, starting, dual-cam, transition | `shared/defaults.js` |
| `veto` | Pool + étapes jouées | `state.js`, `test-data.js` | Veto des maps | veto, veto-recap, map-intro | `shared/defaults.js` |
| `matchVeto` | Déroulé prévu du veto : `{ format, first, custom, sequence }`. `format` suit `match.format` (dans les deux sens) ; sans `custom`, `sequence` est recalculée (`KBMatch.buildSequence`) quand `format`, `first` ou la taille de `veto.pool` change | `match.js` | Veto des maps | veto | `shared/match.js` (`MATCH_DEFAULTS`) |
| `vetoTeams` | `{ open, tokens: { A, B } }` : pages équipes actives ou en pause, jetons des liens | `veto-teams.js` | Veto des maps | — | `extension/veto-teams.js` |
| `vetoTeamsInfo` | Non persisté : `{ urls, lan, online: { A, B } }` (adresses réseau du serveur, pages équipes ouvertes) | `veto-teams.js` | Veto des maps | — | `extension/veto-teams.js` |
| `matchGraphics` | Visibilité versus / veto / vetoRecap | `match.js` (complète une ancienne valeur) | via `KBO` | versus, veto, veto-recap | `shared/match.js` |
| `playerData` | Fiches saisies à la main (priment), clé = riotId en minuscules | `state.js` (migre l'ancien `playerPhotos`) | Équipes & Joueurs | via `KB.player` | `shared/defaults.js` |
| `playerProfiles` | Profils tracker.gg normalisés (dont `roles` : stats par rôle, plus joué d'abord). Un profil sans `roles` (import ancien) est re-normalisé au démarrage depuis son JSON brut de `db/tracker/` | `tracker.js` (route d'import, démarrage) | Équipes & Joueurs, Stats Joueur (suppression) | via `KB.player` | `shared/defaults.js` |
| `casters` | Intervenants `[{ name, handle, role }]`, `role` : `caster` \| `host` (absent = caster) | `state.js` | Lower thirds, Régie | lower-third (source « caster ») | `shared/defaults.js` |
| `planning` | Planning de la journée `{ start, duration, current, matches }` : créneaux, phase, lien bracket (`ref`) ou groupe, équipes / scores des poules, diffusion, format ; pauses (`phase: 'break'`, `label`, `minutes`) ; `minutes` d'un match = sa durée (sinon `duration`) : un créneau dure son match ou sa pause le plus long | `planning.js`, `test-data.js` | Planning | planning, schedule (via `KBPV`) | `shared/planning.js` (`KBPlan.DEFAULT`) |
| `planningGraphic` | `{ visible }` : overlay plein écran Planning | `planning.js` | Planning, Régie (via `KBO`) | planning | `shared/planning.js` (`KBPlan.GRAPHIC_DEFAULT`) |
| `schedule` | Planning à plat, **calculé** par `planning.js` (`KBPlan.legacy`) : ne pas l'écrire | `state.js`, `planning.js` | — | starting, brb, ending, lower third « Prochain match » | `shared/defaults.js` |
| `countdown` | `{ endsAt, label }` | `state.js`, `test-data.js` | Écrans | starting, brb | `shared/defaults.js` |
| `streamScene` | Scène de fond de `stream.html` + mode de passage | `state.js`, `lib/backup.js` (remise sur « none ») | Régie | stream | `shared/defaults.js` |
| `transition` | Déclencheur du stinger `{ at, map, kind, style? }` (`kind` : `logo` \| `map` \| `replay`, absent = déduit de `map` — `KBM.trKind` ; `style` : préréglage joué pour cette fois, `KBM.trStyle`, API Companion) | `state.js` | Régie, Maps & Transitions, API Companion | transition | `shared/defaults.js` |
| `valorantData` | Cache maps / agents de valorant-api.com | `state.js` | — | presque tous | `shared/defaults.js` |
| `liveLowerThird` | `{ left, center, right }` : contenu + visibilité ; masquage auto après `duration` (`hideAt` : heure prévue, posée par le serveur) ; `center` ajouté au démarrage s'il manque | `live.js` | Régie, Lower thirds (`KBLT`, `KBO`) | lower-third | `shared/live.js` (`LIVE.defaults`) |
| `liveLowerThirdPresets` | Presets de lower third | `live.js` | Lower thirds, Régie (`KBLT`) | — | `shared/live.js` |
| `liveTicker` | Visibilité, messages, vitesse, partenaires | `live.js` | Ticker, Régie | ticker | `shared/live.js` |
| `liveDualCam` | Étiquettes et bandeau de l'écran 50/50 | `live.js` | Écran 50/50 | dual-cam | `shared/live.js` |
| `fullscreenStinger` | `{ enabled }` : afficher / masquer un plein écran passe par le stinger (changement au point de coupe, minuteur côté serveur) | `companion.js` | Régie (case, via `KBO.stinger`), API | — | `shared/overlay-list.js` (`KBOList.STINGER_DEFAULT`) |
| `liveReplayBug` | `{ visible }` : bug « REPLAY » en haut à droite | `live.js` | Régie (via `KBO`) | replay-bug | `shared/live.js` (`LIVE.defaults`) |
| `diagPing` | `{ run, id, t }` non persistant : mesure du diagnostic du direct, chaque page graphique répond (`kb.js`) | `diag.js` | — | toutes (réponse `diag:pong`) | `extension/diag.js` |
| `mapsGraphics` | Visibilité + map / MVP de intro, series, result | `maps.js` | Maps & Transitions, Régie, Équipes & Joueurs (renommage) | map-intro, map-series, map-result | `shared/maps.js` (`KBM.DEFAULT`) |
| `mapsTransitionSettings` | Réglages du stinger + préréglages perso | `maps.js` | Maps & Transitions | transition | `shared/maps.js` (`KBM.TRANSITION_DEFAULT`) |
| `mapsExport` | État de l'export PNG | `maps.js` | — | — (lu par Maps & Transitions) | `extension/maps.js` |
| `playerStatsGraphic` | `{ playerId, visible, agentId, view }` (`view` : `overview` \| `roles`, absent = `overview` — `KBP.view`) | `player.js` | Stats Joueur, Régie | player-stats | `shared/player.js` (`KBP.STATS_DEFAULT`) |
| `playerDuel` | `{ left, right, visible }` | `player.js` | Stats Joueur, Régie | player-duel | `shared/player.js` (`KBP.DUEL_DEFAULT`) |
| `bracket` | Groupes + phase finale ; propagation des vainqueurs à chaque changement | `bracket.js`, `test-data.js` | Bracket & Groupes | groups, bracket | `shared/bracket.js` (`KBB.defaultBracket()`) |
| `bracketGraphics` | Visibilité groupes / bracket, `highlightLive` | `bracket.js` | Bracket & Groupes, Régie | groups, bracket | `shared/bracket.js` (`KBB.GRAPHICS_DEFAULT`) |
| `scenesTexts` | Textes des écrans de fond | `scenes.js` | Écrans | starting, brb, ending, schedule | `shared/scenes.js` (`DEFAULT_TEXTS`) |
| `scenesRotation` | Rotation du bas de la pause | `scenes.js` | Écrans | brb | `shared/scenes.js` (`DEFAULT_ROTATION`) |
| `kbAutoReload` | Interrupteur du rechargement automatique | `dev-reload.js` | Données | — | `true` (`dev-reload.js`) |
| `kbBuild` | « Version » du code ; non persistant | `dev-reload.js` | — | tous (via `shared/kb.js`) | `0` |
| `playerPhotos` | Ancien stockage des photos, vidé au démarrage (migration) | `state.js` | — | — | `{}` |
| `syncStatus` | Non persisté : `{ role: 'hub', clients: [{ id, address, since }] }` ou `{ role: 'client', url, connected, since, error, assets }`. Sur une régie reliée (`client`), `veto-teams.js` ne publie plus `vetoTeamsInfo` (reçu d'en ligne) | `sync.js` | — (lu par Données) | — | `{}` |

Les sauvegardes, l'export et l'import portent sur la liste `NAMES` de `extension/lib/backup.js` (tous les replicants ci-dessus sauf `valorantData`, `mapsExport`, `kbAutoReload`, `kbBuild`, `playerPhotos`). Après un import ou une restauration, `backup.apply` masque tous les overlays (`OVERLAYS`) et remet `streamScene` sur `none`.

### Messages (`nodecg.sendMessage` → `listen` côté serveur)
| Message | Données | Réponse | Fichier |
|---|---|---|---|
| `valorantData:refresh` | — | `{ maps, agents }` (nombres) | `state.js` |
| `live:series` | `{ team: 'A'\|'B', delta: 1\|-1 }` | `{ A, B, currentMap }` | `live.js` |
| `maps:exportStinger` | `{ map, kind }` | `{ started: true }` ; progression dans `mapsExport` | `maps.js` |
| `bracket:reset` | — | `{ backup }` | `bracket.js` |
| `bracket:fillQuarters` | — | `[[a, b] ×4]` | `bracket.js` |
| `planning:start` | `{ id }` | `{ title, reset }` : match chargé dans `match` (maps et veto remis à zéro si l'affiche change, sauvegarde avant) et suivi | `planning.js` |
| `planning:stop` | — | `{ stopped }` | `planning.js` |
| `data:clearAll` | `{ teams, players, match, schedule (planning + compte à rebours), bracket, overlays, texts }` (booléens) | `{ backup }` | `data-admin.js` |
| `data:backups` | — | noms de fichiers, plus récent d'abord | `data-admin.js` |
| `data:restore` | `{ file }` | `{ backup }` | `data-admin.js` |
| `data:testData` | — | `{ backup }` | `test-data.js` |
| `vetoTeams:newLinks` | — | `{ tokens }` (les anciens liens ne marchent plus) | `veto-teams.js` |
| `overlay:stinger` | `{ id, action: 'show'\|'hide'\|'toggle', exclusive? }` | `{ done }` ; le changement a lieu au point de coupe (envoyé par `KBO` quand `fullscreenStinger` est actif) | `companion.js` |
| `transition:cancel` | — | `{ cancelled }` : annule l'action en attente d'une transition lancée par le serveur (Régie, « Tout masquer ») | `companion.js` |
| `companion:info` | — | `{ token, fromEnv }` (jeton de l'API Companion) | `companion.js` |
| `companion:newToken` | — | `{ token }` (l'ancien ne marche plus) ; refusé si `COMPANION_TOKEN` est fixé | `companion.js` |
| `diag:run` | — | `{ sent, clients: [{ client, ua, pages: [{ page, got, net, raf, tmo, vis, transport }] }] }` (≈ 6 s) | `diag.js` |
| `sync:info` | — | `{ token, tokenFromEnv, url, urlFromEnv }` (jeton de cette régie, régie en ligne suivie) | `sync.js` |
| `sync:connect` | `{ url, token }` | `{ url }` : enregistré dans `db/sync.json`, connexion lancée ; refusé si `SYNC_URL` est fixée | `sync.js` |
| `sync:disconnect` | — | `{ stopped }` | `sync.js` |
| `sync:newToken` | — | `{ token }` (régies reliées déconnectées) ; refusé si `SYNC_TOKEN` est fixé | `sync.js` |
| `diag:pong` | envoyé par les pages graphiques : `{ run, id, stage: 'recv' \| 'frame', raf?, tmo?, client, page, ua, vis, transport }` | — | `diag.js` |

Une erreur levée dans un handler est renvoyée au panneau comme message d'erreur (texte) ; `TypeError` / `ReferenceError` sont journalisées avec la pile.

### Routes HTTP (montées à la racine du serveur)
| Route | Garde | Rôle | Fichier |
|---|---|---|---|
| `GET /valorant-tournament/data-export[?files=0]` | connexion | Télécharge l'export (refus 413 au-delà de 150 Mo d'assets) | `data-transfer.js` |
| `POST /valorant-tournament/data-import` | connexion + même origine, 200 Mo | Vérifie tout, sauvegarde, écrit, masque les overlays | `data-transfer.js` |
| `POST /valorant-tournament/tracker-import?playlist=` | connexion + même origine, 20 Mo, `text/plain` | JSON brut tracker.gg → profil | `tracker-routes.js` |
| `GET /valorant-tournament/tracker-receiver` | aucune | Fenêtre ouverte par le favori | `tracker-routes.js` |
| `GET /valorant-tournament/tracker-status` | aucune (CORS ouvert ; détails seulement si connecté) | État lu par les panneaux et la popup de l'extension | `tracker-routes.js` |
| `GET /valorant-tournament/tracker-extension` | connexion | Guide de l'extension (README rendu en HTML) | `tracker-routes.js` |
| `GET /valorant-tournament/veto/:jeton` | jeton du lien (pas de connexion : envoyé aux équipes) | Page de veto d'une équipe (`static/veto-team.html`, sans NodeCG) | `veto-teams.js` |
| `GET /valorant-tournament/veto/:jeton/state?v=` | jeton | État vu par l'équipe, interrogé chaque seconde ; 204 si la version `v` est à jour | `veto-teams.js` |
| `POST /valorant-tournament/veto/:jeton/action` | jeton + même origine, 4 ko | `{ type: 'map', map, index }` ou `{ type: 'side', side, index }` ; refusé (409) hors tour ou si `index` est dépassé | `veto-teams.js` |
| `GET /valorant-tournament/veto-assets/…` | aucune | Polices et logo de la page équipe | `veto-teams.js` |
| `GET\|POST /valorant-tournament/api/…` | jeton Companion (+ même origine pour un POST) | API de pilotage : overlays, scène, transition, lower thirds, score, état. Détail de chaque route : [COMPANION.md](COMPANION.md#4-référence-de-lapi) | `companion.js` |

`nodecg.mount` n'applique aucune authentification : toute route ajoutée doit utiliser `requireLogin` (et `sameOrigin` pour un POST), voir `extension/lib/http.js`. Exceptions voulues : les pages de veto des équipes, protégées par leur jeton et limitées au veto de leur équipe ; l'API Companion, protégée par son jeton (`db/companion-token` ou `COMPANION_TOKEN`), qui reproduit côté serveur les règles de `KBO` (plein écran exclusif) et de la Régie (scène, transition). Une route ajoutée à cette API se documente à deux endroits : `docs/COMPANION.md` et `ROUTES` (et `QUICK` si besoin) dans `dashboard/companion.html`. Pas de connexion permanente (SSE, WebSocket) sur ces routes : NodeCG attendrait sa fermeture pour s'arrêter. « Connexion » n'a d'effet que si un mot de passe est configuré.

### Deux régies (`extension/sync.js`)
Une régie **sur place** (overlays servis en local à OBS / vMix) se relie à la régie **en ligne** (veto des équipes, maps, pilotage à distance) : elle ouvre une connexion socket.io sortante vers l'espace `/kb-sync` du serveur NodeCG en ligne (même port ; jeton `SYNC_TOKEN` ou `db/sync-token`, vérifié par `nsp.use` : la connexion de NodeCG ne protège que l'espace `/`). Réglage : `SYNC_URL` + `SYNC_TOKEN`, sinon panneau Données (`db/sync.json`). Une régie reliée refuse elle-même toute régie (pas de chaîne).
- **Replicants recopiés** : `NAMES` de `lib/backup.js` + `transition` + `vetoTeams` dans les deux sens ; `valorantData`, `vetoTeamsInfo` d'en ligne vers sur place seulement. Tout autre replicant reste propre à chaque régie. Un replicant ajouté à `NAMES` est donc synchronisé d'office.
- **Champ par champ** : chaque changement part en opérations `{ p: chemin, v }` calculées par rapport à la dernière valeur commune (`diff` / `patch`) ; deux écritures sur des champs différents se fusionnent. La régie en ligne fait foi : elle confirme chaque envoi (`ack` avec sa valeur) ; tant qu'un envoi plus récent est en route, la confirmation précédente est ignorée (pas de retour en arrière visible).
- **Les deux serveurs exécutent les mêmes réactions** (`match.js`, `planning.js`, `bracket.js`, minuteurs de `live.js`…) : elles doivent rester déterministes (même entrée → même valeur), sinon les deux régies se renverraient la balle. Une valeur reçue identique à la valeur locale n'est jamais réécrite.
- **(Re)connexion** : la régie en ligne envoie un instantané. Premier contact après un démarrage : ses valeurs priment. Après une coupure : les changements faits sur place pendant la coupure (écart avec la dernière valeur commune) sont rejoués sur l'instantané puis renvoyés. Sauvegarde `avant-synchro` si l'instantané change des données d'ici (hors overlays) : toujours au premier contact, puis au plus une fois par 10 minutes. Dans tous les cas, rien ne change à l'antenne (`keepOnAir`) : dans `OVERLAYS`, un objet `visible: true` ici est gardé en entier (contenu compris), un `visible: false` le reste ; `streamScene` reste celle d'ici ; `transition` n'est jamais reprise de l'instantané (elle relancerait un stinger).
- **Logos et photos** : copiés d'en ligne vers sur place (`assets:list`, `assets:get` sur la socket ; empreinte SHA-1), écrits en `.part` puis renommés. Un fichier supprimé en ligne est supprimé sur place s'il n'y a pas été modifié depuis sa copie (`db/sync-assets.json`). Rien ne remonte : un logo envoyé seulement sur place n'existe pas en ligne.
- **Gros messages** : socket.io refuse plus de 1 Mo reçu par le serveur ; au-delà de 256 k caractères, la régie reliée découpe son message (`part`).
- Heures absolues (`countdown.endsAt`, `hideAt`) : écrites par une régie, lues sur l'autre machine ; les horloges des deux machines doivent être à l'heure (synchronisation automatique de Windows).

## Le socle partagé (`shared/`)
| Objet | Fichier | Rôle |
|---|---|---|
| `KB` | `kb.js` | Socle de toutes les pages : `KB.esc`, `KB.rep.<coeur>`, `KB.watch(names, render)` (rendu groupé par image, au plus tard 50 ms après le changement même si le navigateur ne dessine pas), équipes (`team`, `sides`, `seriesScore`, `teamColor`, `teamLogo`, `orderedTeams`), données Valorant (`map`, `agent`, `mapNames`, `agentInfo`), joueurs (`player`, `roster`, `pickOf`, `teamOf`, `key`, `roleLabel`), animations (`presence`, `scene`, `restart`, `countUp`, `fit`), `formatCountdown`. Contient aussi le rechargement automatique des graphics (`kbBuild`) et la réponse au diagnostic du direct (`diagPing`). |
| `KBDefaults` | `defaults.js` | Valeurs par défaut des replicants coeur (fonctions qui renvoient un objet neuf), `DEFAULT_POOL`, `COUNTDOWN_LABEL`. UMD. |
| `KBD` | `dash.js` | Outils des panneaux : `flash`, `confirm` / `arm` (2 clics), `deferWhileEditing`, `fillSelect`, `teamOptions`, `getPath` / `setPath`, `bindDirty` (brouillon + « non appliqué »). |
| `KBOList` | `overlay-list.js` | Liste des overlays pilotables (`ITEMS` : id, replicant, chemin du booléen, plein écran, `needs`) et des scènes de fond (`SCENES`). UMD : lue par `KBO`, la Régie et l'API Companion. |
| `KBO` | `overlays.js` | Registre des overlays pilotables (`ITEMS` = `KBOList.ITEMS` + précisions `hint`) ; option `KBO.stinger` (plein écran par le stinger, `{ stinger: false }` pour une action déjà sous transition) ; `show` / `hide` / `toggle` / `hideAll`, exclusivité « un seul plein écran », bouton et ligne **AFFICHER / ● À L'ANTENNE**. N'écrit que les booléens `visible`. |
| `KBLT` | `lt-form.js` | Formulaire des lower thirds (gauche / centre / droite), commun à la Régie (`compact`) et au panneau Lower thirds ; `mountCrew` : plateau host / casters ; `mountMonitor` : moniteur « À l'antenne » (aperçu réel + état). |
| `KBI` | `tracker-import.js` | Import tracker.gg côté navigateur : `parseRiotId`, `request` (extension sinon onglet manuel), `hasExtension`, `bookmarklet`, `trackerUrl`, `apiUrl`. Indépendant de `kb.js`. |
| `KBM` | `maps.js` | Partie maps : `mapsGraphics`, réglages et modèle géométrique du stinger (`trSettings`, `stingerTiming`, `stingerModel`, `TRANSITION_*`), helpers des écrans maps (`mapAt`, `patch`, `flashChanges`…). UMD. |
| `KBMatch` | `match.js` | Préréglages de veto, `MATCH_DEFAULTS`, état du veto, phases. UMD. |
| `KBScenes` | `scenes.js` | Écrans de fond : `DEFAULT_TEXTS`, `DEFAULT_ROTATION`, `ROTATION_TYPES`, helpers (compte à rebours, prochain match, ambiance). UMD (côté Node : les seules constantes). |
| `KBP` | `player.js` | Défauts `STATS_DEFAULT`, `DUEL_DEFAULT`, vues de la fiche (`VIEWS`, `view`), lignes du tableau par rôle (`ROLE_KEYS`, `roleRows`), stats du duel, particules. UMD. |
| `KBPlan` | `planning.js` | Planning : `DEFAULT`, `PHASES`, `normalize`, heures des créneaux, lien bracket (`bracketPath`, `bracketMatch`), `resolve` / `view` / `slots`, `legacy` (liste `schedule`), `groupStandings`, `fromLegacy`. UMD, utilisé aussi par le serveur. |
| `KBPV` | `planning-view.js` | Rendu du planning (`mount({ mode: 'overlay' \| 'scene' })`), commun à `planning.html` et `schedule.html`, avec `planning.css`. |
| `KBB` | `bracket.js` | Bracket : `defaultBracket`, `emptyMatch`, `standings`, `propagate`, `quarterPairs`, `GRAPHICS_DEFAULT`. UMD, utilisé aussi par le serveur. |
| `LIVE` | `live.js` | Défauts `live*`, emplacements (`SIDES`), rôles des intervenants (`ROLES`), styles et presets automatiques des lower thirds, géométrie du 50/50 (`dualFrames`). UMD. |

Feuilles de style : `theme.css` (overlays, importe `fonts.css`), `dashboard.css` (panneaux), `maps.css`, `match.css`, `scenes.css`, `planning.css` (par partie). Ordre de chargement dans un panneau : `kb.js` → modules de partie → `dash.js` → `overlay-list.js` → `overlays.js` → `lt-form.js`.

## Conventions de code
- Tabulations, guillemets simples, points-virgules, style compact existant (`.editorconfig`). Pas de reformatage en masse.
- CommonJS côté Node ; scripts classiques côté navigateur (ni modules ES, ni build). Module partagé serveur + navigateur au format UMD :
  `(function (root) { …; if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.X = api; })(typeof window !== 'undefined' ? window : globalThis);`
- Commentaires en français, sur le « pourquoi ». Pas de commentaire qui raconte l'historique d'un changement.
- Tout texte venant d'un replicant passe par `KB.esc` avant d'entrer dans du HTML (attributs et `style` compris).
- Lire un joueur : toujours `KB.player(riotId)` (fusion tracker.gg + saisie manuelle), jamais `playerProfiles` directement.
- Panneaux :
  - toute action destructrice demande 2 clics : `KBD.confirm` (bouton fixe) ou `KBD.arm` (liste re-rendue) ;
  - afficher / masquer un overlay : uniquement via `KBO` (jamais réécrire tout le replicant depuis une copie : deux écritures rapprochées s'écraseraient) ;
  - rendu d'une zone éditable : `KBD.deferWhileEditing` ; menus remplis depuis un replicant : `KBD.fillSelect` ; formulaire à appliquer : `KBD.bindDirty` ;
  - un serveur ne doit jamais tomber : messages via `listen` (`extension/lib/listen.js`).
- Valeurs par défaut : jamais recopiées. Côté serveur, `require` du fichier `shared/` qui les définit ; côté page, l'objet global correspondant.
- Replicants persistés : ne change ni leur nom ni leur forme (la base contient de vraies données). Ajouts de champs optionnels et rétro-compatibles seulement ; une valeur ancienne doit être complétée au démarrage (exemples : `extension/match.js`, `extension/live.js`).
- Pas de JSON Schema (pas de dossier `schemas/`) : NodeCG efface sans prévenir une valeur persistée qui ne valide pas son schéma.
- Ne renomme pas les fichiers de `graphics/` et `dashboard/` (URLs enregistrées dans OBS) ni le `name` des panneaux.

## Charte visuelle
Références : `Medias/` (affiche et logo, hors git) et `shared/theme.css`, à lire en entier avant de toucher un overlay.
- **Identité** : tournoi **KB SERIES**, édition spéciale **Epitech**, présenté par **CYCOM**. Nuit bleu-indigo, étoiles, bleu électrique, filets et cadres **dorés**, néon orange rare ; langage Valorant : coins coupés, trapèzes, diagonales, typo condensée en capitales.
- **Tokens** (`:root` de `theme.css`) : fonds `--kb-night-0…3`, `--kb-indigo` ; bleus `--kb-blue`, `--kb-blue-hi`, `--kb-blue-glow` ; or `--kb-gold`, `--kb-gold-hi`, `--kb-gold-dim` ; `--kb-orange`, `--kb-red` ; texte `--kb-text`, `--kb-muted`, `--kb-line`, `--kb-ink` (texte sur fond or) ; `--team-a` / `--team-b` ; `--kb-cut` ; easings `--kb-ease-out`, `--kb-ease-inout`. Pas de nouvelle palette.
- **Polices** (locales, `shared/fonts/`, licence OFL, aucune dépendance à Google Fonts) : Anton `--kb-display` (gros titres, chiffres), Poppins `--kb-ui` (labels espacés), Barlow Condensed `--kb-num` (infos compactes).
- **Couleurs** : `--kb-red` réservé aux défaites, au LIVE, aux bans et au bug Replay. Couleur d'équipe : `team.color`, sinon `KB.teamColor` (`KB.TEAM_COLORS`, mêmes valeurs que `--team-a` / `--team-b`).
- **Compatibilité navigateurs anciens** (vMix, OBS anciens : Chromium avant 111 / 120) : pas de `color-mix()` pour une couleur transparente, mais `rgba(var(--x-rgb), a)` avec la couleur posée par `KB.setColor(el, 'x', couleur)` (pose `--x` et `--x-rgb`), les tokens ayant leur `-rgb` (`--kb-blue-rgb`, `--team-a-rgb`…) ; un `color-mix()` indispensable passe en 2de déclaration après un repli. Tout `mask-image` est doublé d'un `-webkit-mask-image` (sinon le dégradé devient un rectangle plein).
- **Classes** : `.kb-bg` (+ `__art`, `__stars`, `__grid`), `.kb-frame`, `.kb-panel`, `.kb-rule`, `.kb-kicker`, `.kb-label`, `.kb-title`, `.kb-neon`, `.kb-pill`, `.kb-trapeze`, `.kb-team-mono`, `.kb-marquee`, `.kb-shine`. Logos via `KB.img` (`kbs-logo.png`, `cycom-alpha.png`, `epitech-alpha.png`, `poster-art.webp`).
- **Mise en page** : 1920×1080, `<html class="kb-graphic">` ; fond **transparent** pour les overlays en jeu (lower thirds, ticker), fond plein `.kb-bg` pour les écrans plein écran ; 64 px de marge de sécurité ; données manquantes gérées proprement (monogramme `KB.teamLogo`, « – », jamais `undefined`).
- **Animations** : entrée en cascade `.kb-anim` + `--i` sous `.kb-in`, sortie `.kb-out` rapide ; `KB.scene` / `KB.presence` gèrent l'affichage (`.kb-settled` reste posée pendant la sortie : une règle « installé » en `!important` s'écrit `.kb-settled:not(.kb-out)` pour laisser jouer le fondu) ; `.kb-idle` met en pause toutes les animations d'un overlay masqué (n'anime jamais un élément visible dans une racine masquée) ; animer `transform` / `opacity`, pas la mise en page ; une donnée qui change se met à jour en place, sans rejouer toute l'entrée.

## Ajouter un overlay
1. Crée `graphics/<nom>.html` : `<html class="kb-graphic">`, `theme.css`, `kb.js` (+ modules de partie), lecture par `KB.watch`, affichage par `KB.scene` ou `KB.presence`.
2. Déclare-le dans `package.json` → `nodecg.graphics` (`file`, `width: 1920`, `height: 1080`) : `npm run check` le parcourt alors automatiquement.
3. S'il a besoin d'un replicant de visibilité : déclare-le avec sa valeur par défaut dans `extension/<partie>.js` (valeur définie dans `shared/<partie>.js`), ajoute-le à `NAMES` (et à `OVERLAYS`) dans `extension/lib/backup.js`, et au bon groupe de `extension/data-admin.js`.
4. Pour le piloter depuis la Régie et l'API Companion : ajoute une entrée à `KBOList.ITEMS` (`shared/overlay-list.js`), et sa précision éventuelle à `HINTS` (`shared/overlays.js`). Ajoute-le au tableau des identifiants de `docs/COMPANION.md` (la page `dashboard/companion.html` le reprend toute seule).
5. Pour qu'il soit dans la source unique : ajoute-le à `LAYERS` (ou `SCENES` pour un écran de fond) dans `graphics/stream.html`, et à la liste des URLs de `dashboard/regie.html`.
6. Mets à jour le tableau des overlays du `README.md`.

## Ajouter un panneau
1. Crée `dashboard/<nom>.html` avec `../shared/dashboard.css` et les scripts dans l'ordre du socle (voir plus haut).
2. Déclare-le dans `package.json` → `nodecg.dashboardPanels` (`name`, `title`, `file`, `width`, `headerColor`, `workspace` ; sans `workspace` il va dans « Main Workspace » ; `fullbleed: true` à la place de `width` et `workspace` = onglet à part en pleine largeur).
3. Nouveau global partagé : ajoute son nom à la liste `kb` de `eslint.config.js`.
4. Mets à jour le tableau des panneaux du `README.md` et `docs/REGIE.md`.

## Outils et vérification
| Commande | Effet |
|---|---|
| `npm run lint` | ESLint (`eslint.config.js`) : erreurs réelles uniquement, aucune règle de style. Lancé aussi par la CI GitHub (`.github/workflows/ci.yml`). |
| `npm run check` | Ouvre chaque overlay et chaque panneau dans un navigateur invisible (Playwright) et signale erreurs console, exceptions, fichiers 4xx/5xx. Serveur lancé. Options : `--base <url>`, `--shots <dossier>`, `--only graphics\|dashboard`, `--wait <ms>`. |
| `npm run verify` | `lint` puis `check`. |
| `npm run shot -- <url> <sortie.png>` | Capture d'une page (`--wait`, `--w`, `--h`, `--eval`). Panneau hors tableau de bord : ajouter `?standalone=true` à l'URL. |
| `npm run export:stinger` | Exporte `transition.html` en PNG (`--map` ou `--replay`, `--fps`, `--out`, `--host`, `--settings`) dans `exports/stinger[-<map>\|-replay]/` + `info.txt`. Téléchargement en .zip depuis le panneau : routes `GET /valorant-tournament/stinger-exports` (liste) et `…/stinger-exports/<dossier>.zip` (`extension/maps.js`, archive écrite en flux par `extension/lib/zip.js`). Serveur lancé. |
| `npm run pack:extension` | Empaquette `tools/tracker-extension` en `exports/kb-tracker-import-<version>.zip` (à faire signer sur addons.mozilla.org pour Firefox). |
| `npm run dev` | Serveur redémarré quand `extension/` ou `package.json` change. |

Le navigateur des outils est trouvé et lancé par `tools/browser.js` : Chrome, puis Edge, puis Firefox (Firefox standard piloté en WebDriver BiDi, canal Playwright `moz-firefox`). Pour forcer : `CHROME_PATH`, `FIREFOX_PATH`, ou `KB_BROWSER=firefox`. Firefox ne sait pas capturer sans fond : `captureTransparent` capture chaque image sur fond noir puis blanc et en déduit l'alpha (export 2× plus lent). Firefox en snap (Ubuntu) : profil temporaire placé dans `~/snap/firefox/common/tmp`. `playwright-core` et `sharp` sont des dépendances de développement : absentes de l'image Docker, d'où l'export impossible en ligne.

L'extension tracker.gg a un seul `manifest.json` pour Chrome et Firefox : `background.service_worker` (Chrome) et `background.scripts` (Firefox), `browser_specific_settings.gecko` (identifiant, Firefox 140+). Firefox refuse les motifs d'adresse avec hôte joker et port (`http://*:9090/*`) : la régie est reconnue par `*://*/bundles/valorant-tournament/*`. Sous Firefox, l'envoi à la régie passe par `content.fetch` (requête au nom de la page) et l'accès aux sites peut devoir être accordé depuis la popup.

## Le correctif `tools/patch-deps.js`
Lancé par `postinstall` après chaque `npm install` / `npm ci`. `hasha` 5 (utilisé par NodeCG pour les assets) plante sous Node 24 quand son worker répond pour une tâche déjà résolue (« Cannot read properties of undefined (reading 'resolve') ») : le script ajoute une garde dans `node_modules/hasha/index.js`. **Ne pas le retirer** : sans lui, l'envoi de fichiers dans ASSETS peut faire tomber le serveur. S'il n'arrive plus à s'appliquer (nouvelle version de `hasha`), il affiche un avertissement très visible au lieu d'échouer.

## Mises en garde
- Ne lance **pas** `npm audit fix --force` : il rétrograderait NodeCG vers une version incompatible.
- Reste sur Node 24 (image Docker, CI et lanceurs sont alignés dessus).
- **Aucun faux joueur** : n'invente aucun joueur ni Riot ID, ne fais aucun import tracker.gg à la place du propriétaire. Les exemples utilisent `Pseudo#TAG`. Le dépôt GitHub est public : n'y écris aucun Riot ID réel.
- `db/` et `assets/` contiennent les vraies données : ne les modifie jamais à la main, travaille sur une copie.
