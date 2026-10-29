// Point d'entrée du serveur du bundle : charge chaque partie (un fichier = une responsabilité).
// Une partie qui plante au démarrage est journalisée sans empêcher les autres de tourner.
// Les messages des panneaux passent par `listen` (lib/listen.js) : une erreur répond au panneau sans arrêter le serveur.
const createListen = require('./lib/listen');
const createBackup = require('./lib/backup');

module.exports = function (nodecg) {
	const listen = createListen(nodecg);
	const backup = createBackup(nodecg);
	let tracker = null;
	let live = null;
	const parts = [
		['state', () => require('./state')(nodecg, listen)],             // replicants coeur + données Valorant
		['tracker', () => { tracker = require('./tracker')(nodecg); }],   // profils tracker.gg (normalisation, stockage)
		['tracker-routes', () => require('./tracker-routes')(nodecg, tracker)],
		['player', () => require('./player')(nodecg)],
		['maps', () => require('./maps')(nodecg, listen)],
		['scenes', () => require('./scenes')(nodecg)],
		['live', () => { live = require('./live')(nodecg, listen); }],
		['match', () => require('./match')(nodecg)],
		['veto-teams', () => require('./veto-teams')(nodecg, listen)],   // pages de veto envoyées aux équipes
		['bracket', () => require('./bracket')(nodecg, listen, backup)],
		['planning', () => require('./planning')(nodecg, listen, backup)], // planning de la journée (lié au bracket, au match en cours)
		['data-admin', () => require('./data-admin')(nodecg, listen, backup)],
		['test-data', () => require('./test-data')(nodecg, listen, backup)],
		['data-transfer', () => require('./data-transfer')(nodecg, listen, backup)],
		['dev-reload', () => require('./dev-reload')(nodecg)],
		['diag', () => require('./diag')(nodecg, listen)],                 // diagnostic : délai des commandes dans chaque page d'overlay
		['companion', () => require('./companion')(nodecg, listen, live)],   // API HTTP pour Bitfocus Companion (replicants déjà déclarés)
		['sync', () => require('./sync')(nodecg, listen, backup)],          // synchro en direct régie en ligne ↔ régie sur place (en dernier : tous les replicants déclarés)
	];
	for (const [name, load] of parts) {
		try {
			load();
		} catch (e) {
			nodecg.log.error(`Partie "${name}" du bundle en erreur (le reste fonctionne) :`, e.stack || e.message);
		}
	}
	nodecg.log.info('Bundle Valorant Tournament chargé');
};
