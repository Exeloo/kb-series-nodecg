# Dépannage

Pour le régisseur (et celui qui l'aide) : les problèmes courants, classés par symptôme, avec leur cause et la solution.

## Lancement

| Symptôme | Cause | Solution |
|---|---|---|
| La fenêtre affiche `[ERREUR] Node.js est introuvable` | Node.js n'est pas installé (ou Windows ne le trouve pas encore). | Installe [Node.js 24 LTS](https://nodejs.org), puis relance `start.bat`. S'il était déjà installé, redémarre le PC. |
| `[ERREUR] L'installation a echoue` | Pas d'Internet au premier lancement, ou installation interrompue. | Vérifie la connexion, supprime le dossier `node_modules/` s'il existe, relance `start.bat`. |
| `start.bat` dit « La regie tourne deja » mais la page affichée n'est pas la régie | Un autre logiciel utilise déjà le port 9090. | Ferme ce logiciel, ou lance la régie sur un autre port (voir [INSTALLATION.md](INSTALLATION.md#changer-de-port)). |
| Le navigateur ne s'ouvre pas tout seul | Le serveur a mis plus de 90 secondes à démarrer, ou il s'est arrêté. | Lis la fenêtre noire : si elle affiche « Le serveur s'est arrete », note le message d'erreur au-dessus. Sinon ouvre http://localhost:9090 à la main. |
| `[ERREUR] NODECG_PASSWORD vaut encore « change-moi »`, puis « Le serveur s'est arrete » | Le mot de passe est encore la valeur d'exemple, refusée exprès. | Choisis un vrai mot de passe (`start-reseau.bat`, fichier `.env` ou variables de l'hébergeur : voir [DEPLOIEMENT.md](DEPLOIEMENT.md)). |
| La page http://localhost:9090 ne s'ouvre pas | La fenêtre noire est fermée : le serveur est arrêté. | Relance `start.bat`. |

## Réseau

| Symptôme | Cause | Solution |
|---|---|---|
| La régie ne s'ouvre pas depuis un autre PC (ou OBS sur un autre PC ne voit rien) | `start.bat` n'accepte que les connexions de ce PC. | Arrête la régie et lance **`start-reseau.bat`**, de préférence avec un mot de passe ([INSTALLATION.md](INSTALLATION.md#régie-ou-obs-sur-un-autre-appareil--start-reseaubat)). Utilise l'adresse IP affichée, pas `localhost`. |
| Toujours injoignable avec `start-reseau.bat` | Le pare-feu Windows bloque Node.js, ou les deux appareils ne sont pas sur le même réseau. | Autorise Node.js dans le pare-feu Windows pour les réseaux privés ; vérifie le réseau Wi-Fi / câble des deux appareils. |
| OBS affiche une page de connexion au lieu des overlays | La régie a un mot de passe. | Ajoute `?key=TA_CLE` à l'URL de la source ([OBS.md](OBS.md#régie-protégée-par-un-mot-de-passe)). |
| Données → section 8 : « ⚠ Pas reliée … reconnexion automatique » | La régie sur place ne joint pas la régie en ligne (Internet coupé, régie en ligne arrêtée ou en cours de redéploiement, adresse fausse). | Elle continue seule et se reconnecte toute seule. Vérifie l'adresse (`regie.tondomaine.fr`) et que la régie en ligne s'ouvre dans un navigateur ([DEPLOIEMENT.md](DEPLOIEMENT.md#deux-régies--en-ligne--sur-place-overlays-sans-délai)). |
| Données → section 8 : « Jeton de synchronisation refusé » | Le jeton recopié n'est pas (ou plus) celui de la régie en ligne. | Recopie le jeton depuis le panneau Données de la régie en ligne (section 8), puis **Relier à la régie en ligne**. Pas de nouvelle tentative automatique tant que le jeton est faux. |
| Après un redémarrage du serveur, la régie redemande le mot de passe | Les connexions sont gardées en mémoire et perdues au redémarrage. | Reconnecte-toi. Les panneaux déjà ouverts continuent en général de fonctionner. |

## Overlays et OBS

| Symptôme | Cause | Solution |
|---|---|---|
| Un overlay ne se met pas à jour dans OBS | La source a perdu la connexion (serveur redémarré, PC en veille), ou mauvaise URL. | Vérifie que la régie tourne. Dans OBS, propriétés de la source → bouton d'actualisation du cache de la page. Vérifie l'URL (`…/graphics/stream.html`, port 9090). |
| Un overlay disparaît ou rejoue son animation quand on change de scène OBS | Source réglée pour s'arrêter quand elle est cachée, ou pour s'actualiser quand la scène devient active. | Décoche ces deux réglages ([OBS.md](OBS.md#mise-en-place)). |
| Les overlays se rechargent tout seuls pendant le direct | Le rechargement automatique est actif : il recharge tous les overlays dès qu'un fichier de `graphics/` ou `shared/` est modifié (mise à jour, édition), et aussi quand le serveur redémarre. | Panneau **Données** → **5. Réglages** → décoche **Recharger automatiquement les overlays quand leur code change**. À faire avant chaque direct. |
| Un bouton **AFFICHER** est grisé | L'overlay n'a rien à montrer. | **Stats joueur** : choisis un joueur dans **Stats Joueur**. **Duel** : choisis au moins un joueur. |
| Un overlay plein écran en masque un autre | Case « Un seul plein écran à la fois » : afficher un plein écran masque les autres. | Comportement voulu. Décoche la case dans la Régie si tu veux en superposer. |
| Les images des maps ou des agents manquent | Pas d'Internet au premier lancement : les données de valorant-api.com n'ont jamais été téléchargées. | Une fois connecté : panneau **Données** → **5. Réglages** → **↻ Mettre à jour les maps et agents Valorant**. Ensuite elles restent en mémoire, même hors ligne. |
| Les icônes de rang des joueurs manquent | Elles sont chargées depuis Internet (tracker.gg). | Vérifie la connexion Internet du PC qui fait tourner OBS. |

## Import tracker.gg

| Symptôme | Cause | Solution |
|---|---|---|
| « Extension non détectée » alors qu'elle est installée | La régie était ouverte avant l'installation ou la mise à jour de l'extension, ou l'extension est désactivée. | `chrome://extensions` (Chrome, Edge) ou `about:addons` (Firefox) : vérifie qu'elle est activée ; recharge la régie (F5) ; bouton ⟳ du panneau **Équipes & Joueurs**. La régie doit être ouverte dans le navigateur où l'extension est installée. Firefox : clique sur l'icône de l'extension et, si demandé, **Autoriser l'accès** ; une installation temporaire disparaît quand Firefox est fermé. |
| L'extension est détectée mais l'import n'aboutit pas | Vérification anti-robot de tracker.gg (Cloudflare, message « tracker.gg a bloqué la requête »), accès aux sites non autorisé (Firefox), profil privé ou introuvable. | Si l'onglet tracker.gg passe au premier plan avec une vérification, valide-la : l'import reprend seul. Sinon voir le [guide de l'extension](../tools/tracker-extension/README.md#cas-particuliers). |
| tracker.gg bloque (« Just a moment… », erreur 403) | tracker.gg filtre les robots. | Ouvre une fois tracker.gg dans le navigateur de la régie, passe la vérification, puis relance l'import. En dernier recours : copier-coller du JSON ([méthode 3](REGIE.md#méthode-3--copier-coller-du-json)) ou saisie à la main. |
| « Aucune stat de saison trouvée » | Profil privé, ou aucune partie classée cette saison. | Le joueur doit rendre son profil public sur tracker.gg ; sinon saisis ses stats à la main dans sa fiche. |
| « Connecte-toi à la régie NodeCG (même navigateur) puis réessaie. » | Régie protégée par un mot de passe et navigateur non connecté. | Connecte-toi à la régie dans le navigateur qui fait l'import. |
| Le favori ne fait rien ou ouvre une mauvaise adresse | Favori pris sur une autre adresse de régie, ou cliqué ailleurs que sur un profil tracker.gg. | Clique-le sur la page d'un profil Valorant de tracker.gg. Si la régie a changé d'adresse, refais le favori. |

## Transition

| Symptôme | Cause | Solution |
|---|---|---|
| L'export PNG échoue : « Aucun navigateur trouvé » | Ni Chrome, ni Edge, ni Firefox à l'emplacement habituel. | Installe l'un des trois, ou indique son chemin avant de lancer la régie (invite de commandes : `set CHROME_PATH=C:\chemin\vers\chrome.exe` ou `set FIREFOX_PATH=C:\chemin\vers\firefox.exe`, puis `start.bat`). |
| L'export PNG est lent | Avec Firefox, chaque image est capturée deux fois (sur fond noir puis blanc) pour calculer la transparence. | Normal : compter environ 1 image par seconde. Avec Chrome ou Edge installé, l'export les utilise en priorité et va plus vite. |
| « Export indisponible sur ce serveur : fais-le depuis la régie locale » | Régie en ligne : l'export a besoin d'un navigateur (Chrome, Edge ou Firefox) sur la machine. | Fais l'export depuis la régie locale (`start.bat`). |
| « Un export est déjà en cours » | Un export tourne. | Attends la fin (barre de progression). Un export est arrêté au bout de 5 minutes. |

## Données

| Symptôme | Cause | Solution |
|---|---|---|
| Un clic a tout effacé (équipes, match, bracket…) | Une réinitialisation, un import ou des données de test. | Panneau **Données** → **2. Sauvegardes automatiques** → la ligne juste avant l'erreur (raison affichée) → **Restaurer** (2 clics). Voir [DONNEES.md](DONNEES.md#restaurer-une-sauvegarde). |
| Un logo ou une photo a disparu | Les sauvegardes automatiques ne contiennent pas les fichiers. | Renvoie-le dans **ASSETS**, ou importe ton dernier export complet. |

### Import ou export refusé
| Message | Solution |
|---|---|
| « Fichier non reconnu (export KB SERIES attendu) » | Ce n'est pas un fichier créé par **⬇ Exporter mes données**. |
| « Fichier illisible (JSON invalide) » ou « Fichier abîmé : … » | Fichier tronqué ou modifié : refais l'export. |
| « Donnée inconnue dans le fichier : … » | Le fichier vient d'une version plus récente du projet : mets d'abord à jour cette régie. |
| « Type de fichier refusé » / « Catégorie d'asset inconnue » | Un logo ou une photo du fichier a un format non accepté : exporte sans les logos / photos. |
| « Logos et photos trop lourds pour un export » | Plus de 150 Mo de fichiers : **⬇ Exporter sans les logos / photos** et copie le dossier `assets/` à la main. |

## Après une modification du code
Pour vérifier que tout va bien (terminal ouvert dans le dossier du projet) :
1. `npm run lint` : signale les erreurs évidentes dans le code. Doit se terminer sans erreur.
2. Régie lancée, `npm run check` : ouvre chaque overlay et chaque panneau dans Chrome (ou Edge, ou Firefox) et signale les erreurs. Doit afficher « aucune erreur ».
