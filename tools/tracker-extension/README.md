# Extension « KB SERIES · Import tracker.gg → NodeCG » (Chrome, Edge, Firefox)

Guide d'installation et d'utilisation de l'extension qui importe les stats tracker.gg d'un joueur **en un clic depuis la régie** (panneau **Équipes & Joueurs**), à partir d'un `Pseudo#TAG` ou d'un lien tracker.gg.

## Pourquoi une extension ?

tracker.gg (protégé par Cloudflare) refuse les requêtes venant du serveur de la régie (erreur 403). Il les accepte en revanche depuis **ton** navigateur. L'extension :

1. ouvre le profil tracker.gg du joueur dans un **onglet en arrière-plan** ;
2. récupère les stats (le même contenu que le favori « ⇪ Envoyer à NodeCG ») ;
3. les transmet à la page de la régie, qui les enregistre ;
4. referme l'onglet. La carte du joueur passe en **TRK**.

Si plusieurs imports sont lancés à la suite, ils passent dans une file d'attente : un seul onglet tracker.gg à la fois.

## Installation (une seule fois)

L'extension s'installe dans **le navigateur où tu ouvres la régie** : c'est lui qui fait les requêtes à tracker.gg. Elle marche dans Google Chrome, Microsoft Edge (et les autres navigateurs Chromium : Brave…) et Mozilla Firefox (version 140 ou plus récente).

### Chrome ou Edge (environ 1 minute)

1. Va à l'adresse `chrome://extensions` (sur Edge : `edge://extensions`).
2. Active le **Mode développeur** (en haut à droite sur Chrome, dans la colonne de gauche sur Edge).
3. Clique sur **Charger l'extension non empaquetée**.
4. Sélectionne le dossier `tools/tracker-extension` du projet (quand ce guide est ouvert depuis la régie, le chemin exact est affiché en haut de la page).
5. L'extension « KB SERIES · Import tracker.gg → NodeCG » apparaît dans la liste : vérifie qu'elle est **activée**.
6. Facultatif : icône puzzle de la barre d'outils → épingle, pour garder l'icône de l'extension visible.
7. **Recharge la page de la régie** (F5) : l'extension ne s'installe que dans les pages ouvertes après elle.

### Firefox

Firefox n'installe durablement que les extensions **signées par Mozilla**. Deux possibilités :

**A. Installation temporaire (2 minutes, à refaire à chaque redémarrage de Firefox)** : pratique pour essayer, ou pour un jour de match si Firefox reste ouvert.

1. Va à l'adresse `about:debugging#/runtime/this-firefox`.
2. Clique sur **Charger un module complémentaire temporaire…**.
3. Dans le dossier `tools/tracker-extension` du projet, choisis le fichier **`manifest.json`**.
4. Clique sur l'icône de l'extension (pièce de puzzle de la barre d'outils, puis « KB SERIES · Import tracker.gg ») : si la fenêtre affiche **Accès aux sites non autorisé**, clique sur **Autoriser l'accès (tracker.gg et régie)** et accepte.
5. **Recharge la page de la régie** (F5).

Quand Firefox est fermé, l'extension disparaît : refais les étapes 1 à 5 au prochain lancement.

**B. Installation durable (version signée, environ 15 minutes la première fois)** : la signature est gratuite et automatique ; l'extension n'est pas publiée, elle reste privée.

1. Dans le dossier du projet, lance `npm run pack:extension` : le fichier `exports/kb-tracker-import-<version>.zip` est créé.
2. Crée un compte (gratuit) sur [addons.mozilla.org](https://addons.mozilla.org/developers/) et ouvre le **Developer Hub**.
3. **Soumettre un nouveau module** → choisis **Sur votre propre site** (distribution hors catalogue : l'extension reste privée) → envoie le fichier `.zip`.
4. Si on te demande le code source : réponds que non, le code n'est ni minifié ni généré.
5. Après la vérification automatique (quelques minutes), télécharge le fichier **`.xpi`** signé.
6. Glisse ce fichier `.xpi` dans une fenêtre Firefox, puis accepte l'installation et l'accès aux sites demandés.
7. Clique sur l'icône de l'extension : si **Accès aux sites non autorisé** s'affiche, clique sur **Autoriser l'accès**. Puis **recharge la régie** (F5).

À chaque nouvelle version de l'extension (champ `version` de `manifest.json`), refais les étapes 1, 3 (via **Soumettre une nouvelle version** sur la page de l'extension), 5 et 6.

### Vérifier

En haut du panneau **Équipes & Joueurs** (onglet « 1. Match & Joueurs »), la pastille doit être verte : **Extension tracker.gg détectée** (bouton ⟳ pour re-tester).

> Utilise le même navigateur pour la régie et pour tracker.gg : c'est lui qui fait la requête.

## Utilisation

1. Dans le panneau **Équipes & Joueurs**, tape `Pseudo#TAG` (ou colle le lien tracker.gg du joueur) dans le champ **+ Pseudo#TAG ou lien tracker.gg** en bas d'une colonne, puis Entrée ; ou ouvre la fiche d'un joueur et clique **Importer depuis tracker.gg** (ou **Actualiser depuis tracker.gg**).
2. Un onglet tracker.gg s'ouvre en arrière-plan (sans prendre le focus), puis se referme au bout de quelques secondes.
3. Le panneau affiche « ✔ Pseudo#TAG importé depuis tracker.gg » et la pastille **TRK** de la carte s'allume.
4. L'icône de l'extension ouvre une petite fenêtre : régie joignable ou non, import en cours, derniers imports (réussis ou non, avec la raison), bouton **Ouvrir la régie**.

## Cas particuliers

- **Vérification anti-robot (Cloudflare)** : si tracker.gg affiche « Just a moment… » ou une case à cocher, l'onglet passe au premier plan. Valide la vérification : l'import reprend tout seul (jusqu'à 3 minutes). Sinon, relance l'import une fois la vérification passée.
- **Profil privé** : le joueur doit se connecter une fois sur tracker.gg avec son compte Riot pour rendre ses stats publiques.
- **Profil introuvable** : vérifie l'orthographe exacte du Riot ID (`Pseudo#TAG`, majuscules et espaces compris).
- **Aucune stat de saison** : le joueur n'a pas (encore) joué de partie classée cette saison ; saisis ses stats à la main dans sa fiche.
- **Régie protégée par un mot de passe** (réseau local ou en ligne) : connecte-toi à la régie dans ce même navigateur avant d'importer.
- **« Extension non détectée »** après une mise à jour ou un rechargement de l'extension : recharge la page de la régie (F5). Sous Firefox, vérifie aussi que l'accès aux sites est autorisé (icône de l'extension) et, en installation temporaire, que Firefox n'a pas été redémarré depuis.
- **« L'extension n'a pas l'autorisation d'accéder à tracker.gg »** (Firefox) : clique sur l'icône de l'extension, puis sur **Autoriser l'accès**.
- **« tracker.gg a bloqué la requête »** : tracker.gg veut une vérification anti-robot. Ouvre tracker.gg dans un onglet de ce navigateur, passe la vérification, puis relance l'import.

## Ce que l'extension peut voir

D'après son `manifest.json` (Manifest V3, le même fichier pour Chrome, Edge et Firefox) :

- **Permissions** : `scripting` (lire les stats dans l'onglet tracker.gg qu'elle a ouvert) et `storage` (son état et ses derniers imports).
- **Sites auxquels elle a accès** : `tracker.gg` et `api.tracker.gg`.
- **Pages où elle s'installe** (petit relais entre la page et l'extension, aussi dans les cadres) : toute page dont l'adresse contient `/bundles/valorant-tournament/`, **sur n'importe quel site et n'importe quel port** : les panneaux de la régie, en local comme en ligne. Le navigateur peut donc l'annoncer comme ayant accès à « tous les sites ».
- Elle ouvre et ferme elle-même les onglets tracker.gg. Elle n'envoie les stats qu'à la page de la régie qui a demandé l'import. Elle ne collecte aucune donnée pour qui que ce soit d'autre.

## Régie sur un autre port ou en ligne

Rien à changer : l'extension reconnaît la régie à l'adresse de ses panneaux (`/bundles/valorant-tournament/…`), quels que soient la machine et le port.

## Mettre à jour

Après une mise à jour du projet (ou une modification des fichiers de l'extension), puis F5 sur la régie :

- **Chrome / Edge** : `chrome://extensions` (ou `edge://extensions`) → bouton d'actualisation sur la carte de l'extension.
- **Firefox, installation temporaire** : `about:debugging#/runtime/this-firefox` → **Actualiser** sous l'extension.
- **Firefox, version signée** : nouvelle signature (voir « Installation durable » plus haut), seulement si la `version` du `manifest.json` a changé.

## Secours sans extension

Dans le panneau **Équipes & Joueurs**, carte **Import tracker.gg** :

- **Favori « ⇪ Envoyer à NodeCG »** (section « Favori de secours ») : à glisser une fois dans la barre de favoris ; ensuite, ouvre la page tracker.gg du joueur et clique sur le favori.
- **Plan C : copier-coller le JSON** : ouvre la fiche du joueur, ouvre son lien API, Ctrl+A, Ctrl+C, colle dans la zone, **Importer le JSON**.
- Toutes les données d'une fiche (rang, stats, agents…) peuvent aussi être **saisies à la main**.

Pas à pas détaillé : `docs/REGIE.md` du projet, section « Importer les joueurs depuis tracker.gg ».

## Fichiers

- `manifest.json` : déclaration de l'extension (permissions, sites, pages), commune à Chrome et Firefox.
- `content.js` : injecté dans la régie, relaie les demandes du panneau (`window.postMessage`) vers l'extension ; envoie les stats à la régie au nom de la page (`content.fetch` sous Firefox).
- `background.js` : file d'attente, ouverture de l'onglet tracker.gg, récupération du JSON, renvoi à la page de la régie qui l'envoie à `POST /valorant-tournament/tracker-import`.
- `popup.html` / `popup.js` : petite fenêtre d'état (et bouton d'autorisation d'accès aux sites sous Firefox).
- `make-icons.js` : régénère les icônes (`node tools/tracker-extension/make-icons.js`).
- `npm run pack:extension` (`tools/pack-extension.js`) : crée le `.zip` à faire signer par Mozilla (ou à distribuer), sans `make-icons.js` ni ce guide.
