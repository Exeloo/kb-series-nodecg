// Effacement des données (section « Réinitialiser » du panneau Données), liste et restauration des sauvegardes (db/backups/).
// Une sauvegarde complète est TOUJOURS écrite avant d'effacer ou de restaurer.
// Messages :
//   'data:clearAll' { teams, players, match, schedule, bracket, overlays, texts } (groupes à effacer) → { backup }
//   'data:backups'  → [noms de fichiers], plus récent d'abord
//   'data:restore'  { file } → { backup } (sauvegarde « avant-restauration » faite juste avant) ; overlays masqués ensuite
const path = require('path');
const D = require('../shared/defaults.js');
const LIVE = require('../shared/live.js');
const KBM = require('../shared/maps.js');
const KBP = require('../shared/player.js');
const KBB = require('../shared/bracket.js');
const { MATCH_DEFAULTS } = require('../shared/match.js');
const { DEFAULT_TEXTS, DEFAULT_ROTATION } = require('../shared/scenes.js');
const { clone, hideAll } = require('./lib/backup');

const GROUPS = {
	teams: ['teams'],
	players: ['playerData', 'playerProfiles'],
	match: ['match', 'veto', 'matchVeto'],
	schedule: ['schedule', 'countdown'],
	bracket: ['bracket'],
	texts: ['scenesTexts', 'scenesRotation', 'tournament', 'casters', 'liveTicker'],
	overlays: ['liveLowerThird', 'matchGraphics', 'mapsGraphics', 'playerStatsGraphic', 'playerDuel', 'bracketGraphics', 'streamScene', 'liveDualCam', 'liveReplayBug'],
};

module.exports = function (nodecg, listen, backup) {
	const rep = (name) => nodecg.Replicant(name);

	// Valeur « effacée » de chaque replicant (opts = groupes demandés). undefined = on n'y touche pas.
	const emptied = (n, opts) => {
		const cur = rep(n).value;
		switch (n) {
			case 'tournament': return undefined; // identité du tournoi (nom, dates…) : rien de dangereux à effacer
			case 'casters': return []; // effacer = plus aucun caster (pas les « Caster 1 / 2 » d'exemple)
			case 'countdown': return { ...D.countdown(), label: (cur && cur.label) || D.COUNTDOWN_LABEL };
			case 'matchVeto': return clone(MATCH_DEFAULTS.matchVeto);
			case 'bracket': return KBB.defaultBracket();
			case 'scenesTexts': return clone(DEFAULT_TEXTS);
			case 'scenesRotation': return clone(DEFAULT_ROTATION);
			case 'liveTicker': return opts.texts ? { ...(cur || {}), visible: false, messages: [] } : cur && { ...cur, visible: false };
			case 'streamScene': return { ...D.streamScene(), at: Date.now() };
			case 'playerStatsGraphic': return clone(KBP.STATS_DEFAULT);
			case 'playerDuel': return clone(KBP.DUEL_DEFAULT);
			case 'mapsGraphics': return clone(KBM.DEFAULT);
			// Lower thirds et étiquettes du 50/50 sont des textes : vidés seulement avec le groupe « texts »
			case 'liveLowerThird': return opts.texts ? clone(LIVE.defaults.liveLowerThird) : cur && hideAll(clone(cur));
			case 'liveDualCam': {
				if (!opts.texts) return undefined;
				const def = clone(LIVE.defaults.liveDualCam);
				return { ...(cur || {}), left: def.left, right: def.right, infoText: def.infoText };
			}
		}
		if (typeof D[n] === 'function') return D[n]();
		if (GROUPS.overlays.includes(n)) return cur && hideAll(clone(cur));
		return undefined;
	};

	listen('data:clearAll', (opts) => {
		const picked = Object.keys(GROUPS).filter((g) => opts[g]).flatMap((g) => GROUPS[g]);
		// « Textes » vide aussi les lower thirds et les étiquettes du 50/50, même sans le groupe « overlays »
		if (opts.texts) picked.push('liveLowerThird', 'liveDualCam');
		// « Overlays » masque tout ce qui peut être à l'antenne, ticker compris (ses messages restent)
		if (opts.overlays) picked.push('liveTicker');
		const names = [...new Set(picked)];
		if (!names.length) throw new Error('Rien de sélectionné');
		const file = backup.snapshot('avant-effacement');
		for (const n of names) {
			const v = emptied(n, opts);
			if (v !== undefined && v !== null) rep(n).value = v;
		}
		nodecg.log.info(`Données effacées (${names.join(', ')}) — sauvegarde : ${file}`);
		return { backup: backup.relative(file) };
	});

	listen('data:backups', () => backup.list());

	listen('data:restore', ({ file }) => {
		const snap = backup.read(file); // lu et vérifié AVANT de sauvegarder / écraser quoi que ce soit
		const saved = backup.snapshot('avant-restauration');
		backup.apply(snap);
		nodecg.log.info(`Sauvegarde restaurée : ${path.basename(String(file))} (état précédent : ${saved})`);
		return { backup: backup.relative(saved) };
	});
};

module.exports.GROUPS = GROUPS;
