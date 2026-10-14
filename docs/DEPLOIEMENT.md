# Mettre la régie en ligne (avec ton nom de domaine)

Pour le propriétaire (ou la personne qui l'aide) : héberger la régie sur Internet, avec un mot de passe et un nom de domaine, puis y transférer les données et y brancher OBS. En local, rien de tout cela n'est nécessaire.

> **À surveiller au premier déploiement.** L'image Docker (`Dockerfile`, `docker-compose.yml`, `tools/docker-start.sh`) a été réécrite récemment et **n'a pas pu être testée** (pas de Docker sur la machine de développement). Fais le premier déploiement hors période de tournoi, vérifie le journal de démarrage, la connexion, l'envoi d'un logo dans ASSETS et un import de données avant de compter dessus.

## Pourquoi pas Vercel
Vercel n'exécute que des fonctions courtes : pas de serveur allumé en permanence, pas de WebSockets
(indispensables pour que la régie et les overlays se synchronisent en direct), pas de disque pour la base
et les logos. NodeCG ne peut donc pas y tourner. Il faut un hébergeur qui garde un serveur Node allumé.

## Les réglages (variables d'environnement)
| Nom | Obligatoire | Valeur |
|---|---|---|
| `NODECG_PASSWORD` | **Oui** | Mot de passe de la régie (protège la régie **et** les overlays). En ligne, le serveur **refuse de démarrer** sans mot de passe, et refuse la valeur d'exemple `change-moi`. |
| `NODECG_USER` | Non | Identifiant de connexion (défaut : `regie`). |
| `NODECG_BASE_URL` | Oui avec `docker-compose.yml` | Ton domaine sans `https://`, ex. `regie.tondomaine.fr`. |
| `NODECG_SESSION_SECRET` | Non | Longue chaîne aléatoire qui signe les connexions. Si absente, un secret est créé une fois dans le volume (`/data/db/session-secret`) et réutilisé. |
| `NODECG_HOST` | Non | Adresse d'écoute. L'image Docker la règle déjà sur `0.0.0.0` : n'y touche pas. |
| `PORT` | Non | Port d'écoute (défaut 9090). Railway le fournit tout seul. |

Le modèle de ces réglages est `.env.example`. Ton fichier `.env` (sur un VPS) contient le mot de passe : ne l'envoie jamais sur GitHub (il est ignoré par git et exclu de l'image Docker), ne le copie pas ailleurs, ne le partage pas.

Toutes les données (base, sauvegardes, logos, photos) vivent dans **un seul volume monté sur `/data`**. Sans ce volume, tout est perdu à chaque redéploiement.

## Option A — Railway (le plus simple, ~5 $/mois)
1. Crée un compte sur https://railway.app (plan Hobby).
2. Mets le projet en ligne :
   - **avec GitHub** : crée un projet Railway à partir de ton dépôt GitHub. Railway fonctionne avec un dépôt public ou privé ; préfère un dépôt **privé** si tu ne veux pas exposer le projet ;
   - **ou sans GitHub** : installe la CLI (`npm i -g @railway/cli`), puis dans le dossier du projet : `railway login`, `railway init`, `railway up` (les dossiers listés dans `.railwayignore`, dont `db/` et `assets/`, ne sont pas envoyés).
   Railway détecte le `Dockerfile` tout seul.
3. Ajoute un **volume** au service, point de montage **`/data`**.
4. Dans les **variables** du service : `NODECG_PASSWORD` (obligatoire), et si tu veux `NODECG_USER`, `NODECG_BASE_URL`, `NODECG_SESSION_SECRET` (voir le tableau plus haut).
5. Dans les réglages réseau du service, ajoute ton domaine personnalisé `regie.tondomaine.fr`. Railway affiche un enregistrement **CNAME** :
   ajoute-le chez ton registrar (OVH, Gandi, Cloudflare…). Le HTTPS est automatique.
6. Ouvre `https://regie.tondomaine.fr` → connexion avec l'identifiant et le mot de passe.

## Option B — Serveur perso (VPS ~4-6 €/mois : Hetzner, OVH, Scaleway…)
1. VPS Ubuntu, installe Docker (`curl -fsSL https://get.docker.com | sh`).
2. Copie le dossier du projet sur le serveur, **sans** `node_modules/`, `db/` ni `assets/`.
3. Chez ton registrar : enregistrement **A** `regie.tondomaine.fr` → IP du VPS. Les ports 80 et 443 du VPS doivent être ouverts.
4. Sur le serveur, dans le dossier du projet : `cp .env.example .env`, remplis-le (au moins `NODECG_BASE_URL` et `NODECG_PASSWORD`), puis `docker compose up -d --build`.
   Caddy obtient le certificat HTTPS tout seul. Les données vont dans le volume Docker `nodecg-data`.
5. Journal en cas de souci : `docker compose logs -f nodecg`.

## Sauvegarder le volume `/data`
- **Partout** : panneau **Données** → **⬇ Exporter mes données** régulièrement (et avant chaque mise à jour), fichier rangé hors du serveur. Voir [DONNEES.md](DONNEES.md).
- **Sur un VPS**, copie brute du volume : `docker volume ls` pour trouver son nom exact (il se termine par `nodecg-data`), puis
  `docker run --rm -v <nom_du_volume>:/data -v "$PWD":/backup alpine tar czf /backup/nodecg-data.tgz -C /data .`

## Mettre à jour
1. **⬇ Exporter mes données** sur la régie en ligne.
2. Envoie la nouvelle version :
   - **Railway avec GitHub** : pousse la nouvelle version sur la branche suivie ; Railway redéploie (si le déploiement automatique est actif, sinon relance un déploiement) ;
   - **Railway sans GitHub** : `railway up` dans le dossier du projet ;
   - **VPS** : remplace le code (toujours sans `db/` ni `assets/`), puis `docker compose up -d --build`.
3. Le volume `/data` n'est pas touché. Après le redémarrage, **reconnecte-toi** : les connexions sont gardées en mémoire et perdues à chaque redémarrage (les panneaux déjà ouverts continuent en général de fonctionner).

## Après la mise en ligne
1. **Transférer tes données** : sur ta régie locale, panneau **Données** → **⬇ Exporter mes données**
   (équipes, joueurs, réglages, logos et photos dans un seul fichier), puis sur la régie en ligne
   **⬆ Importer un fichier…**. Une sauvegarde est faite avant l'import, et les overlays sont masqués après.
   Au-delà de 150 Mo de logos et photos, exporte sans les fichiers et renvoie-les dans **ASSETS**.
2. **OBS** (sur le PC de stream) : les overlays sont protégés par le mot de passe, OBS utilise la **clé** de la régie :
   régie en ligne → **SETTINGS** (en haut à droite) → carte **Your Key** → **Copy Key**, puis l'URL de la source navigateur :
   `https://regie.tondomaine.fr/bundles/valorant-tournament/graphics/stream.html?key=TA_CLE`
   Cette clé donne un **accès complet** à la régie : traite-la comme un mot de passe, ne la montre jamais à l'écran.
   En cas de fuite : **Reset Key** sur la même page, puis mets à jour l'URL dans OBS. Détails : [OBS.md](OBS.md#régie-protégée-par-un-mot-de-passe).
3. **Extension d'import tracker.gg** (Chrome, Edge ou Firefox) : actualise-la (voir [son guide](../tools/tracker-extension/README.md#mettre-à-jour)) ; elle fonctionne sur le domaine
   tant que tu es connecté à la régie dans le même navigateur. Refais aussi le favori « ⇪ Envoyer à NodeCG » depuis la régie en ligne.
4. **Export PNG de la transition** : impossible en ligne (l'image n'embarque ni navigateur ni les outils d'export). Fais-le depuis la régie locale.

## En local, rien ne change
`start.bat` : pas de mot de passe, http://localhost:9090, joignable seulement depuis ce PC. La configuration est dans `cfg/nodecg.js`
(elle lit les variables d'environnement ci-dessus seulement si elles existent). Pour ouvrir la régie au réseau local : `start-reseau.bat` ([INSTALLATION.md](INSTALLATION.md)).
