# Installation

Pour le régisseur : installer la régie sur un PC Windows, la lancer, l'ouvrir aux autres appareils du réseau, la mettre à jour et l'arrêter.

## Prérequis
| Quoi | Pourquoi |
|---|---|
| Windows | Les lanceurs `start.bat` et `start-reseau.bat` sont des fichiers Windows. |
| [Node.js 24 LTS](https://nodejs.org) | Fait tourner la régie. Prends la version **LTS** 24 ; installe-la avec les options par défaut. |
| Google Chrome, Microsoft Edge ou Mozilla Firefox (140+) | Navigateur de la régie et de l'extension d'import tracker.gg (les trois conviennent). L'export de la transition en PNG et les outils de vérification utilisent Chrome, sinon Edge, sinon Firefox. |
| Internet au premier lancement | Installation des dépendances, puis téléchargement des images des maps et des agents (gardées ensuite pour fonctionner hors ligne). |

## Installer depuis zéro
Au choix :
- **ZIP** : sur la page GitHub du projet, bouton **Code** → **Download ZIP**, puis extrais le dossier où tu veux (ex. `D:\valorant-nodecg`).
- **git** : `git clone https://github.com/Tomi-Tom/kb-series-nodecg.git`

## Premier lancement
1. Double-clique sur **`start.bat`** dans le dossier du projet. Une fenêtre noire « KB SERIES - Regie NodeCG » s'ouvre.
2. Si Node.js manque, elle affiche `[ERREUR] Node.js est introuvable` : installe Node.js 24 LTS, puis relance `start.bat`.
3. Au tout premier lancement, elle affiche « Premiere installation, patiente 1 a 3 minutes... » et installe les dépendances.
4. Dès que le serveur répond, ton navigateur s'ouvre sur **http://localhost:9090** (la régie NodeCG).
5. **Laisse la fenêtre noire ouverte** pendant tout le direct : c'est elle qui fait tourner la régie.

Si tu relances `start.bat` alors que la régie tourne déjà, il ne lance rien de plus : il ouvre seulement le navigateur sur la régie.

## Régie ou OBS sur un autre appareil : `start-reseau.bat`
Par défaut, `start.bat` rend la régie joignable **uniquement depuis ce PC**. C'est le plus sûr, et c'est suffisant si OBS tourne sur le même PC.

Si OBS, une deuxième régie ou une tablette sont sur **un autre appareil du même réseau** :
1. Ferme la fenêtre de `start.bat` si elle est ouverte.
2. Conseillé : protège la régie par un mot de passe. Ouvre `start-reseau.bat` avec le Bloc-notes (clic droit → **Ouvrir avec** → Bloc-notes), retire `rem ` au début des deux lignes `set "NODECG_PASSWORD=..."` et `set "NODECG_USER=regie"`, remplace `mon-mot-de-passe` par ton mot de passe, enregistre.
3. Double-clique sur **`start-reseau.bat`**. La fenêtre affiche l'adresse IP de ce PC (ex. `192.168.1.20`).
4. Sur l'autre appareil, ouvre `http://192.168.1.20:9090` (avec ta propre adresse IP).

Avec un mot de passe : la régie demande l'identifiant (`regie`) et le mot de passe, et une source OBS doit ajouter la clé de la régie à son URL (`?key=…`, voir [OBS.md](OBS.md#régie-protégée-par-un-mot-de-passe)).
Sans mot de passe, la fenêtre affiche `[ATTENTION] Aucun mot de passe` : n'importe qui sur le même réseau peut piloter le stream. À réserver à un réseau de confiance.

Windows peut demander d'autoriser Node.js sur le réseau au premier lancement de `start-reseau.bat` : accepte pour les réseaux privés, sinon les autres appareils ne pourront pas joindre la régie.

## Changer de port
La régie utilise le port **9090**. Si un autre logiciel l'occupe, ouvre une invite de commandes dans le dossier du projet (tape `cmd` dans la barre d'adresse de l'explorateur, puis Entrée) et tape :
```
set PORT=9091
start.bat
```
La régie est alors sur `http://localhost:9091` (adapte aussi l'URL dans OBS). L'extension d'import tracker.gg marche sur n'importe quel port : rien à changer ([son guide](../tools/tracker-extension/README.md#régie-sur-un-autre-port-ou-en-ligne)).

## Mettre à jour le projet
1. **Avant tout** : panneau **Données** → **⬇ Exporter mes données** (copie de sécurité, voir [DONNEES.md](DONNEES.md)).
2. Arrête la régie (ferme la fenêtre noire).
3. Récupère la nouvelle version :
   - **avec git** : `git pull` dans le dossier du projet ;
   - **avec un ZIP** : extrais la nouvelle version dans un **nouveau** dossier, puis copie dedans les dossiers `db/` et `assets/` de l'ancien (tes données, logos et photos). Copie aussi `exports/` et `Medias/` si tu t'en sers.
4. Si la mise à jour change les dépendances (fichiers `package.json` ou `package-lock.json`), supprime le dossier `node_modules/` : `start.bat` réinstallera tout au prochain lancement.
5. Relance `start.bat`.
6. Si tu utilises l'extension d'import : actualise-la (Chrome / Edge : `chrome://extensions` → bouton d'actualisation sur sa carte ; Firefox : voir [son guide](../tools/tracker-extension/README.md#mettre-à-jour)), puis recharge la régie (F5).

## Arrêter la régie
Ferme la fenêtre noire. Les données sont enregistrées au fil de l'eau : rien à sauvegarder avant.
