// Sauvegardes des données dans db/backups/ : un fichier JSON { [nom du replicant]: valeur } par sauvegarde.
// Faites automatiquement avant chaque opération qui écrase des données (effacement, données de test, import,
// restauration, remise à zéro du bracket). Les 50 plus récentes sont gardées.
//   const backup = require('./lib/backup')(nodecg);
//   backup.snapshot('avant-effacement') → nom du fichier (backup.relative(nom) → chemin à afficher) ; backup.list() → noms, plus récent d'abord ;
//   backup.read(nom) → { [replicant]: valeur } (noms inconnus ignorés) ; backup.apply(valeurs) → écrit puis masque les overlays
const fs = require('fs');
const path = require('path');
const { ROOT, BACKUPS } = require('./paths');

// Replicants de DONNÉES (sauvegardés, exportés, importables). Les autres (cache valorantData, état d'export,
// déclencheurs) se reconstruisent seuls.
const NAMES = [
	'tournament', 'teams', 'playerData', 'playerProfiles', 'casters', 'schedule', 'planning', 'countdown',
	'match', 'veto', 'matchVeto', 'bracket',
	'scenesTexts', 'scenesRotation', 'liveTicker', 'liveLowerThirdPresets', 'mapsTransitionSettings',
	'liveLowerThird', 'matchGraphics', 'mapsGraphics', 'playerStatsGraphic', 'playerDuel', 'bracketGraphics', 'streamScene', 'liveDualCam', 'liveReplayBug', 'fullscreenStinger', 'planningGraphic',
];
// Overlays (ce qui peut être à l'antenne) : masqués après un import ou une restauration
const OVERLAYS = ['liveLowerThird', 'matchGraphics', 'mapsGraphics', 'playerStatsGraphic', 'playerDuel', 'bracketGraphics', 'liveTicker', 'liveReplayBug', 'planningGraphic'];
const KEEP = 50;

const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
// Masquer = passer tous les "visible" à false, en gardant le reste des réglages
const hideAll = (v) => {
	if (Array.isArray(v)) return v.map(hideAll);
	if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === 'visible' ? false : hideAll(x)]));
	return v;
};
const stamp = () => new Date().toISOString().replace(/[:.]/g, '-');

module.exports = function (nodecg) {
	const values = () => Object.fromEntries(NAMES.map((n) => [n, clone(nodecg.Replicant(n).value)]));

	function list() {
		let files;
		try { files = fs.readdirSync(BACKUPS).filter((f) => f.endsWith('.json')); } catch { return []; }
		// Tri sur l'horodatage du nom (<label>-AAAA-MM-JJTHH-MM-SS-mmmZ.json) : la date de modification du fichier
		// devient fausse dès que le dossier est copié ou restauré.
		const when = (f) => (f.match(/(\d{4}-\d{2}-\d{2}T[\d-]+Z)\.json$/) || [])[1] || '';
		return files.sort((a, b) => when(b).localeCompare(when(a)) || b.localeCompare(a));
	}

	// Ne supprime que les sauvegardes automatiques (nom horodaté) : un fichier déposé à la main est toujours gardé
	function purge(keep = KEEP) {
		const auto = list().filter((f) => /-\d{4}-\d{2}-\d{2}T[\d-]+Z\.json$/.test(f));
		for (const f of auto.slice(keep)) {
			try { fs.unlinkSync(path.join(BACKUPS, f)); } catch { /* déjà supprimé */ }
		}
	}

	function snapshot(label) {
		fs.mkdirSync(BACKUPS, { recursive: true });
		const file = `${String(label).replace(/[^\w-]/g, '-')}-${stamp()}.json`;
		fs.writeFileSync(path.join(BACKUPS, file), JSON.stringify(values(), null, 1));
		purge();
		return file;
	}

	function read(file) {
		const name = path.basename(String(file || ''));
		if (!name.endsWith('.json') || !list().includes(name)) throw new Error('Sauvegarde introuvable : ' + name);
		const snap = JSON.parse(fs.readFileSync(path.join(BACKUPS, name), 'utf8'));
		if (!snap || typeof snap !== 'object' || Array.isArray(snap)) throw new Error('Sauvegarde illisible : ' + name);
		return Object.fromEntries(Object.entries(snap).filter(([n, v]) => NAMES.includes(n) && v != null));
	}

	// Rien n'apparaît à l'antenne par surprise : overlays masqués, scène de fond sur « jeu »
	function hideOverlays() {
		for (const n of OVERLAYS) {
			const r = nodecg.Replicant(n);
			if (r.value && typeof r.value === 'object') r.value = hideAll(clone(r.value));
		}
		const scene = nodecg.Replicant('streamScene');
		scene.value = { ...(scene.value || {}), scene: 'none', via: 'cut', at: Date.now() };
	}

	// Écrit des valeurs (import, restauration) puis masque tous les overlays
	function apply(snap) {
		for (const [n, v] of Object.entries(snap)) nodecg.Replicant(n).value = v;
		hideOverlays();
		return Object.keys(snap).length;
	}

	// Chemin affiché aux panneaux, ex. dbackupsavant-effacement-….json
	const relative = (file) => path.relative(ROOT, path.join(BACKUPS, file));

	return { snapshot, list, read, purge, values, apply, hideOverlays, relative };
};

module.exports.NAMES = NAMES;
module.exports.OVERLAYS = OVERLAYS;
module.exports.clone = clone;
module.exports.hideAll = hideAll;
