// Chemins du projet utilisés par le serveur. Le dossier racine EST le bundle (et le dossier de travail de NodeCG),
// donc db/ et assets/ sont ceux de NodeCG (liens vers le volume persistant en Docker, voir tools/docker-start.sh).
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const DB = path.join(ROOT, 'db');

module.exports = {
	ROOT,
	DB,
	BACKUPS: path.join(DB, 'backups'),                          // sauvegardes JSON des replicants (extension/lib/backup.js)
	TRACKER: path.join(DB, 'tracker'),                          // JSON bruts tracker.gg (re-normalisables)
	ASSETS: path.join(ROOT, 'assets', 'valorant-tournament'),   // fichiers envoyés dans l'onglet Assets de NodeCG
	EXT_DIR: path.join(ROOT, 'tools', 'tracker-extension'),     // extension compagnon (Chrome, Edge, Firefox)
	STATIC: path.join(__dirname, '..', 'static'),               // pages HTML servies par les routes du bundle
};
